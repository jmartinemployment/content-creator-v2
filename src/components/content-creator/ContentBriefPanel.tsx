"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUDIENCE_SEGMENTS,
  BUYING_STAGES,
  CONTENT_ANGLES,
  CTA_TYPES,
  PRIMARY_INTENTS,
  SECONDARY_INTENTS,
  TONES_OF_VOICE,
  contentBriefMissingFields,
  emptyContentBrief,
  isContentBriefComplete,
  lengthBandForContentType,
  toneAllowed,
  type ContentBrief,
} from "@/lib/content-creator/brief-catalog";
import {
  ApiError,
  checkPartnerQuoteReadiness,
  type PartnerQuoteReadiness,
} from "@/services/gcc-api";
import { SerpIngestPanel } from "@/components/content-creator/SerpIngestPanel";
import NicheFramingPanel from "@/components/content-creator/NicheFramingPanel";
import {
  applyCuratedSerpToBrief,
  type CuratedSerpSeed,
  type SerpMergeConflict,
} from "@/lib/content-creator/serp-lens";
import {
  BRIEF_STALE_STATUS,
  briefToJson,
  createGccCreate,
  getGccCreate,
  getGccCreateVersion,
  patchBriefResearch,
  type BriefSaveKind,
} from "@/services/gcc-api";
import {
  briefDraftKey,
  briefFingerprint,
  clearNewBriefDraft,
  listBriefDrafts,
  loadBriefDraft,
  parseServerBrief,
  saveBriefDraft,
  type StoredBriefDraft,
} from "@/lib/content-creator/brief-drafts";
const SERP_FIELD_LABEL: Record<SerpMergeConflict["field"], string> = {
  paaQuestions: "People Also Ask",
};

/**
 * Whether the declared partners can answer the question this Angle demands of the block quotation.
 *
 * The project form already validates these URLs, but it asks a volume question — indexed, enough
 * pages and chunks — and volume is not fitness. A partner can carry thousands of chunks and still
 * say nothing that answers `problem_solution` for this keyword. The Angle lives here, on the brief,
 * so this is the first point at which the real question exists to be asked.
 *
 * Operator-triggered, not on render: each partner is a retrieval plus a model call, and ten of them
 * would hang the panel. The same reason the project form checks the index on blur rather than on
 * every keystroke.
 */
function PartnerQuoteFit({
  projectId,
  targetKeyword,
  angle,
}: {
  projectId?: string;
  targetKeyword: string;
  angle: string;
}) {
  const [checking, setChecking] = useState(false);
  const [answered, setAnswered] = useState<{
    key: string;
    data: PartnerQuoteReadiness | null;
    error: string | null;
  } | null>(null);

  const keyword = targetKeyword.trim();
  const ready = Boolean(projectId) && angle.length > 0 && keyword.length > 0;

  // An answer describes one project, angle and keyword. Tagging it with the question it answers and
  // comparing on render keeps a stale result off screen without clearing state from an effect —
  // which would re-render every time any of the three changed, to say nothing.
  const key = `${projectId ?? ""}\u0000${angle}\u0000${keyword}`;
  const current = answered?.key === key ? answered : null;

  async function run() {
    if (!projectId || checking) return;
    setChecking(true);
    try {
      const data = await checkPartnerQuoteReadiness(projectId, keyword, angle);
      setAnswered({ key, data, error: null });
    } catch (err) {
      setAnswered({
        key,
        data: null,
        error: err instanceof ApiError ? err.message : "Could not check the partners.",
      });
    } finally {
      setChecking(false);
    }
  }

  if (!ready) {
    return (
      <span className="text-xs font-normal text-muted">
        {projectId
          ? "Pick an angle and a target keyword to check the partners can answer it."
          : "No project on this create, so its declared partners are not known."}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={checking}
        className="self-start text-xs font-normal underline decoration-dotted underline-offset-2 disabled:opacity-60"
      >
        {checking ? "Checking the partners…" : "Check partners can answer this angle"}
      </button>

      {current?.error ? (
        <span className="text-xs font-normal text-red-600">{current.error}</span>
      ) : null}

      {current?.data ? (
        <div className="space-y-1 text-xs font-normal">
          <p className="text-muted">
            Looking for {current.data.question} — {current.data.canAnswer} of{" "}
            {current.data.declared} partners can.
          </p>
          {current.data.results.map((r) => (
            <p
              key={r.url}
              className={
                r.canAnswer
                  ? "text-green-700"
                  : r.outcome === "unavailable"
                    ? "text-amber-700"
                    : "text-red-600"
              }
            >
              <span className="font-mono">{r.url}</span> —{" "}
              {r.canAnswer ? (
                <>
                  &ldquo;{r.quote}&rdquo;{" "}
                  <span className="text-muted">({r.cite})</span>
                </>
              ) : (
                (r.reason ?? "cannot answer this angle")
              )}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** What a successful server write reports to the workspace. */
export type BriefSaved = {
  createId: string;
  briefJson: string;
  topic: string;
  updatedAtUtc: string;
  /** Whether the brief as saved has every field Generate requires. */
  complete: boolean;
  /** True on the save that minted the create. */
  minted: boolean;
};

/** When the browser draft and the server copy differ: both, so the operator chooses. */
type CopyChoice = {
  reason: "open" | "stale";
  local: ContentBrief;
  localTopic: string;
  localAt: string | null;
  server: ContentBrief;
  serverTopic: string;
  serverAt: string;
  serverVersion: number;
};

function hhmm(iso: string | null): string {
  if (!iso) return "an unknown time";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "an unknown time"
    : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/** Autosave runs this long after the last change; a failed save is retried on the longer delay. */
const AUTOSAVE_MS = 2000;
const RETRY_MS = 10000;

export default function ContentBriefPanel({
  clientId,
  projectId,
  projectSiteRunId,
  targetKeyword,
  keywordLocked = false,
  createId: createIdProp,
  startingContentType,
  onBriefSaved,
  onBriefValidityChange,
  onSyncChange,
}: {
  clientId: string;
  /** The project this create belongs to, when minted from a project context (e.g. /app/workflow).
   * Without it, GccGroundingResolver refuses any content type that needs partner/competitor
   * evidence with "this create belongs to no project" -- even when the project genuinely has
   * partner data, because nothing ever told the new create which project owns it. */
  projectId?: string;
  projectSiteRunId?: string;
  targetKeyword: string;
  /** True once anything has been generated on this create; the keyword is fixed from then on. */
  keywordLocked?: boolean;
  /** When set, brief saves onto this create (does not open a second create). */
  createId?: string | null;
  /** The content type this brief is for, chosen in the one picker the parent owns. Used only to
   * mint the create (its single StartingContentType) and to derive the length band; there is no
   * picker in here and no default. */
  startingContentType?: string;
  /** Called after every write that reached the server, with what the server now holds. */
  onBriefSaved: (saved: BriefSaved) => void;
  /** Whether the brief on screen has every field Generate requires. */
  onBriefValidityChange?: (complete: boolean) => void;
  /** True when what is on screen is what the server holds -- the condition Generate waits on. */
  onSyncChange?: (synced: boolean) => void;
}) {
  // The database is where the brief lives (plans/fix-persistence.md). Once a create exists every
  // change is PATCHed two seconds after the last edit, with the version this copy was read at, so a
  // save from a stale copy is refused rather than overwriting. This browser keeps a copy only as a
  // crash buffer, and on open the two are compared and the operator chooses when they differ.
  //
  // The server write used to happen only on "Save brief for generate", which refused any incomplete
  // brief before a network call -- so a brief being worked on could never reach the database, while
  // every keystroke went to browser storage and the panel looked saved. Jeff's last server-side brief
  // turned out to be from 9/16.
  // Before a create exists the only copy is this browser's "new" draft, read once here. The workspace
  // remounts this panel per create, so a mount never has to re-read for a different one.
  const [initialDraft] = useState(() =>
    createIdProp ? null : loadBriefDraft(briefDraftKey(projectId, null)),
  );
  const [brief, setBrief] = useState<ContentBrief>(() => initialDraft?.brief ?? emptyContentBrief());
  // The prop wins when given; internalCreateId holds the id this panel minted until the parent's URL
  // catches up and remounts it with the prop.
  const [internalCreateId, setInternalCreateId] = useState<string | null>(null);
  const createId = createIdProp ?? internalCreateId;
  const storageKey = briefDraftKey(projectId, createId);
  // What this create is about -- its topic. Editable until the first generate; every save writes it.
  const [keywordInput, setKeywordInput] = useState(initialDraft?.topic || targetKeyword || "");
  // There is no content-type picker in here any more. Brief and Generate are one section with one
  // picker now (Jeff, 2026-09-22: "The proposed fix that never happened was to combine these two
  // sections") -- CreateDraftWorkspace owns that selection and passes the type down. The create
  // row still has exactly one StartingContentType, so the parent hands us its first selection.
  const effectiveContentType = startingContentType ?? "";

  // "loading" until the server copy and this browser's are read; "choose" while they differ and the
  // operator has not picked; "unsafe" when the create's version cannot be read, so nothing can be
  // saved without risking an overwrite.
  const [phase, setPhase] = useState<"loading" | "ready" | "choose" | "unsafe">(
    createIdProp ? "loading" : "ready",
  );
  const [choice, setChoice] = useState<CopyChoice | null>(null);
  const [unsafeReason, setUnsafeReason] = useState<string | null>(null);
  // The row version the next save sends as expectedVersion. A ref, not state: it changes on every
  // save and nothing renders from it.
  const versionRef = useRef<number | null>(null);
  const mintAnnouncedRef = useRef(false);
  // The fingerprint of what the server holds, and when it was written. Dirty is the screen differing
  // from it.
  const [savedFp, setSavedFp] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [serpConflicts, setSerpConflicts] = useState<SerpMergeConflict[]>([]);

  // Hydration. Both copies are read, and neither silently replaces the other.
  useEffect(() => {
    if (!createIdProp) return;
    let cancelled = false;
    const local = loadBriefDraft(briefDraftKey(projectId, createIdProp));
    const cid = createIdProp;
    (async () => {
      try {
        const [server, version] = await Promise.all([
          getGccCreate(cid),
          getGccCreateVersion(clientId, cid),
        ]);
        if (cancelled) return;
        const serverBrief = parseServerBrief(server.briefJson);
        const serverTopic = server.topic;
        if (version === null) {
          // Shown, never saved: a write without the version is the overwrite it exists to refuse.
          setBrief(serverBrief ?? emptyContentBrief());
          setKeywordInput(serverTopic);
          setUnsafeReason(
            "This create's version could not be read from the server, so nothing here is saved. Reload the page.",
          );
          setPhase("unsafe");
          return;
        }
        versionRef.current = version;
        setSavedFp(serverBrief ? briefFingerprint(serverBrief, serverTopic) : null);
        setSavedAt(serverBrief ? server.updatedAtUtc : null);

        if (!local) {
          setBrief(serverBrief ?? emptyContentBrief());
          setKeywordInput(serverTopic);
          setPhase("ready");
          return;
        }
        const localTopic = local.topic || serverTopic;
        if (!serverBrief) {
          // Nothing on the server to lose: the draft is shown and autosave writes it.
          setBrief(local.brief);
          setKeywordInput(localTopic);
          setPhase("ready");
          return;
        }
        if (briefFingerprint(local.brief, localTopic) === briefFingerprint(serverBrief, serverTopic)) {
          setBrief(serverBrief);
          setKeywordInput(serverTopic);
          setPhase("ready");
          return;
        }
        setChoice({
          reason: "open",
          local: local.brief,
          localTopic,
          localAt: local.changedAtUtc,
          server: serverBrief,
          serverTopic,
          serverAt: server.updatedAtUtc,
          serverVersion: version,
        });
        setPhase("choose");
      } catch (err) {
        if (cancelled) return;
        setUnsafeReason(
          `The brief could not be read from the server, so nothing here is saved: ${
            err instanceof Error ? err.message : "unknown error"
          }. Reload the page.`,
        );
        setPhase("unsafe");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, projectId, createIdProp]);

  const missing = useMemo(() => contentBriefMissingFields(brief), [brief]);
  const complete = missing.length === 0;
  const currentFp = briefFingerprint(brief, keywordInput);
  const dirty = !!createId && currentFp !== savedFp;
  const keywordBlank = !keywordInput.trim();
  const synced =
    !!createId && phase === "ready" && !dirty && !saving && !saveError && !keywordBlank;

  useEffect(() => {
    if (phase === "loading") return;
    onBriefValidityChange?.(complete);
  }, [phase, complete, onBriefValidityChange]);

  useEffect(() => {
    onSyncChange?.(synced);
  }, [synced, onSyncChange]);

  // Length was its own choice; now it is not — it is a fact of the starting content type. Derived
  // at save rather than synced into `brief` state via an effect, so there is no state write racing
  // the content type prop or the brief's own hydration.
  const derivedLengthBand = lengthBandForContentType(effectiveContentType);

  // The crash buffer: every change, in this browser, under this create's own key. Never while the
  // operator is choosing between copies -- writing then would decide for them.
  useEffect(() => {
    if (phase !== "ready") return;
    saveBriefDraft(storageKey, brief, keywordInput);
  }, [phase, storageKey, brief, keywordInput]);

  async function writeToServer(
    id: string,
    version: number,
    b: ContentBrief,
    topic: string,
    kind: BriefSaveKind,
  ): Promise<void> {
    const sentFp = briefFingerprint(b, topic);
    const briefJson = briefToJson({ ...b, lengthBand: derivedLengthBand });
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchBriefResearch(id, {
        briefJson,
        topic,
        expectedVersion: version,
        kind,
      });
      if (typeof updated.version !== "number") {
        // Without the new version the next save would be refused as stale, every time.
        setUnsafeReason(
          "The server saved the brief but did not return its new version, so further saves are off. Reload the page.",
        );
        setPhase("unsafe");
        return;
      }
      versionRef.current = updated.version;
      setSavedFp(sentFp);
      setSavedAt(updated.updatedAtUtc);
      // The parent learns of a minted create from the first save that reaches the server, not from
      // the mint itself: if that first save failed, an announcement tied to it would never come and
      // the URL would never carry the new id.
      const minted = !createIdProp && !mintAnnouncedRef.current;
      if (minted) mintAnnouncedRef.current = true;
      onBriefSaved({
        createId: id,
        briefJson,
        topic: updated.topic,
        updatedAtUtc: updated.updatedAtUtc,
        complete: isContentBriefComplete(b),
        minted,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === BRIEF_STALE_STATUS) {
        await enterStaleChoice(id, b, topic);
      } else {
        setSaveError(
          err instanceof ApiError || err instanceof Error ? err.message : "The save did not reach the server.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  /** The server refused a save because the create changed since it was read: show both copies. */
  async function enterStaleChoice(id: string, b: ContentBrief, topic: string) {
    try {
      const [server, version] = await Promise.all([
        getGccCreate(id),
        getGccCreateVersion(clientId, id),
      ]);
      const serverBrief = parseServerBrief(server.briefJson);
      if (version === null || !serverBrief) {
        setUnsafeReason(
          "The server refused the save because this create changed elsewhere, and its current copy could not be read. Nothing was overwritten. Reload the page.",
        );
        setPhase("unsafe");
        return;
      }
      setChoice({
        reason: "stale",
        local: b,
        localTopic: topic,
        localAt: new Date().toISOString(),
        server: serverBrief,
        serverTopic: server.topic,
        serverAt: server.updatedAtUtc,
        serverVersion: version,
      });
      setPhase("choose");
    } catch {
      setUnsafeReason(
        "The server refused the save because this create changed elsewhere. Nothing was overwritten. Reload the page.",
      );
      setPhase("unsafe");
    }
  }

  function save(kind: BriefSaveKind, b: ContentBrief = brief, topic: string = keywordInput) {
    if (!createId || versionRef.current === null || phase !== "ready" || !topic.trim()) return;
    void writeToServer(createId, versionRef.current, b, topic, kind);
  }

  // Autosave: two seconds after the last change, or ten after a failed save, so a dropped connection
  // saves itself when it comes back.
  useEffect(() => {
    if (phase !== "ready" || !createId || saving || !dirty || keywordBlank) return;
    const t = setTimeout(() => save("autosave"), saveError ? RETRY_MS : AUTOSAVE_MS);
    return () => clearTimeout(t);
    // save reads the same state listed here; listing it would restart the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, createId, saving, dirty, keywordBlank, saveError, currentFp]);

  useEffect(() => {
    if (!saveError) return;
    const retry = () => save("autosave");
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError, currentFp]);

  // Leaving the page while the screen holds something the server does not.
  const unsaved = (!!createId && !synced) || (!createId && currentFp !== briefFingerprint(emptyContentBrief(), ""));
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // The create is minted the moment it has a keyword and a content type, once -- two seconds after
  // the last change, so it is not named after the first letter typed.
  async function mint() {
    const topic = keywordInput.trim();
    if (createId || minting || !topic || !effectiveContentType) return;
    setMinting(true);
    setMintError(null);
    try {
      const created = await createGccCreate({
        clientId,
        projectId: projectId || null,
        startingContentType: effectiveContentType,
        topic,
        projectSiteRunId: projectSiteRunId || null,
      });
      if (typeof created.version !== "number") {
        throw new ApiError(
          "The piece was created, but the server did not return its version, so its brief cannot be saved safely. Reload the page.",
          0,
        );
      }
      // The draft moves to the create's own slot first, so a keystroke from here on lands there.
      saveBriefDraft(briefDraftKey(projectId, created.id), brief, keywordInput);
      clearNewBriefDraft(projectId);
      setInternalCreateId(created.id);
      versionRef.current = created.version;
      setSavedFp(null);
      await writeToServer(created.id, created.version, brief, topic, "manual");
    } catch (err) {
      setMintError(
        err instanceof ApiError || err instanceof Error ? err.message : "The piece could not be created.",
      );
    } finally {
      setMinting(false);
    }
  }

  useEffect(() => {
    if (createId || phase !== "ready" || minting || mintError) return;
    if (!keywordInput.trim() || !effectiveContentType) return;
    const t = setTimeout(() => void mint(), AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createId, phase, minting, mintError, keywordInput, effectiveContentType]);

  function chooseLocal() {
    if (!choice) return;
    versionRef.current = choice.serverVersion;
    setSavedFp(briefFingerprint(choice.server, choice.serverTopic));
    setSavedAt(choice.serverAt);
    setBrief(choice.local);
    setKeywordInput(choice.localTopic);
    setChoice(null);
    setPhase("ready");
    if (createId && choice.localTopic.trim()) {
      void writeToServer(createId, choice.serverVersion, choice.local, choice.localTopic, "manual");
    }
  }

  function chooseServer() {
    if (!choice) return;
    versionRef.current = choice.serverVersion;
    setSavedFp(briefFingerprint(choice.server, choice.serverTopic));
    setSavedAt(choice.serverAt);
    setBrief(choice.server);
    setKeywordInput(choice.serverTopic);
    setChoice(null);
    setPhase("ready");
  }

  function recover(draft: StoredBriefDraft) {
    const topic = keywordLocked || !draft.topic ? keywordInput : draft.topic;
    setBrief(draft.brief);
    setKeywordInput(topic);
    if (createId && versionRef.current !== null && topic.trim()) {
      void writeToServer(createId, versionRef.current, draft.brief, topic, "recovered");
    }
  }


  // Stage 7: the only caller of applyCuratedSerpToBrief anywhere in this codebase -- everything
  // upstream of this (the parser, the panel, both merge modes) was already built and simply never
  // reached. fill-empty is the default because a confirmed SERP should never clobber an operator's
  // own edits without being asked; conflicts are surfaced, never silently dropped.
  function onSerpCurated(seed: CuratedSerpSeed | null) {
    if (!seed) return;
    const { brief: merged, conflicts } = applyCuratedSerpToBrief(brief, seed, "fill-empty");
    setBrief(merged);
    setSerpConflicts(conflicts);
  }

  function forceReplaceSerpField(field: SerpMergeConflict["field"], value: string) {
    const next = { ...brief, [field]: value };
    setBrief(next);
    setSerpConflicts((prev) => prev.filter((c) => c.field !== field));
  }

  function patch(partial: Partial<ContentBrief>) {
    setBrief((prev) => {
      let next = { ...prev, ...partial };
      // If a newly chosen intent/angle disqualifies the current tone, clear it.
      if (
        (partial.primaryIntent !== undefined || partial.angle !== undefined) &&
        next.toneOfVoice &&
        !toneAllowed(next.toneOfVoice, next.primaryIntent, next.angle)
      ) {
        next = { ...next, toneOfVoice: "" };
      }
      return next;
    });
  }

  if (phase === "loading") {
    return (
      <div>
        <p className="text-sm text-muted">Loading content brief…</p>
      </div>
    );
  }

  if (phase === "choose" && choice) {
    return (
      <CopyChooser
        choice={choice}
        onKeepLocal={chooseLocal}
        onUseServer={chooseServer}
      />
    );
  }

  // mt-auto is what keeps controls on the same line as each other. Each label is a flex column in
  // a grid cell, and grid cells stretch to the tallest in the row, so a label that wraps — and
  // "Secondary intent (optional)" wraps where "Primary intent" does not — pushed its own control
  // down while its neighbour's stayed put. Pushing every control to the bottom of its cell aligns
  // the row regardless of how many lines each label takes.
  const fieldClass =
    "mt-auto rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
  const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-foreground";

  return (
    // Read-only when nothing can be saved safely: an edit there would reach neither the server nor,
    // without a comparison against it, this browser's draft.
    <fieldset disabled={phase === "unsafe"} className="m-0 min-w-0 border-0 p-0">
      <p className="text-sm text-muted">
        Controls aligned to Google Search &amp; Ads terminology. Saves itself to the Content
        Creator create as you type; Generate reads the saved copy only.
      </p>

      <SaveStateLine
        createId={createId}
        phase={phase}
        unsafeReason={unsafeReason}
        dirty={dirty}
        saving={saving}
        saveError={saveError}
        savedAt={savedAt}
        keywordBlank={keywordBlank}
        hasContentType={!!effectiveContentType}
        minting={minting}
        mintError={mintError}
      />

      {/* What this create is about. mint() names the create from it, and every save after that
          writes it again as `topic` -- so it stays editable, and saved, until the first generate.
          After that it is fixed: the pages already written were written for this keyword. */}
      <div className="mt-5">
        <label className={labelClass}>
          Target keyword
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            disabled={keywordLocked}
            placeholder="ai chatbot implementation cost"
            className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
          />
          {keywordLocked ? (
            <span className="text-xs font-normal text-muted">
              Fixed once content has been generated from it.
            </span>
          ) : null}
        </label>
      </div>

      {/* Behind a disclosure, because it is optional and most creates never touch it -- it was
          sitting open in the middle of the brief, pushing the required fields and the save button
          below the fold on every visit.

          Named for what it is rather than what it is called internally. "SERP ingest" is the
          system's word; the operator is uploading a saved search results page. */}
      <details className="group mt-6 border-t border-border pt-5">
        <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-['']">
          <span className="text-[#C83803] underline-offset-2 group-open:no-underline hover:underline">
            Add a saved search results page
          </span>
          <span className="ml-2 text-sm font-normal text-muted">Optional</span>
        </summary>
        <SerpIngestPanel gapTopic={targetKeyword} onCurated={onSerpCurated} />
      </details>

      {/* Outside the disclosure above, deliberately. It was mounted directly after SerpIngestPanel and
          got swept inside when that panel was wrapped in <details>, so the niche fields ended up hidden
          behind a toggle labelled "Add a saved search results page" -- which is not what they are, and
          is why they could not be found. Saved inside the brief, through the same PATCH as every other
          field. */}
      <NicheFramingPanel
        projectId={projectId}
        value={brief.nicheFraming}
        onChange={(nicheFraming) => patch({ nicheFraming })}
      />

      {serpConflicts.length > 0 ? (
        <div className="mt-3 space-y-2 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 p-3 text-xs text-foreground">
          <p className="font-semibold">
            This brief already had content in {serpConflicts.length === 1 ? "a field" : "fields"} the
            confirmed SERP also offered — kept what was already here (fill-empty). Replace instead:
          </p>
          {serpConflicts.map((c) => (
            <div key={c.field} className="flex items-center justify-between gap-2">
              <span>{SERP_FIELD_LABEL[c.field]}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => forceReplaceSerpField(c.field, c.offered)}
                  className="rounded bg-brand px-2 py-1 font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Use SERP value
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSerpConflicts((prev) => prev.filter((x) => x.field !== c.field))
                  }
                  className="rounded bg-brand px-2 py-1 font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Keep existing
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Primary intent
          <select
            value={brief.primaryIntent}
            onChange={(e) =>
              patch({ primaryIntent: e.target.value as ContentBrief["primaryIntent"] })
            }
            className={fieldClass}
          >
            <option value="">Select primary intent</option>
            {PRIMARY_INTENTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {/* No "(optional)": it wrapped the label to two lines while "Primary intent" stayed at
            one, so the two selects sat at different heights. The select defaults to None and
            carries no required mark, which already says optional. */}
        <label className={labelClass}>
          Secondary intent
          <select
            value={brief.secondaryIntent}
            onChange={(e) =>
              patch({ secondaryIntent: e.target.value as ContentBrief["secondaryIntent"] })
            }
            className={fieldClass}
          >
            <option value="">None</option>
            {SECONDARY_INTENTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Buying stage
          <select
            value={brief.buyingStage}
            onChange={(e) =>
              patch({ buyingStage: e.target.value as ContentBrief["buyingStage"] })
            }
            className={fieldClass}
          >
            <option value="">Select buying stage</option>
            {BUYING_STAGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted">
            Google Ads Full-Funnel objective.
          </span>
        </label>

        <label className={labelClass}>
          Audience segment
          <select
            value={brief.audienceSegment}
            onChange={(e) =>
              patch({
                audienceSegment: e.target.value as ContentBrief["audienceSegment"],
              })
            }
            className={fieldClass}
          >
            <option value="">Select audience segment</option>
            {AUDIENCE_SEGMENTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted">Google Ads audience segments.</span>
        </label>


        <label className={`${labelClass} sm:col-span-2`}>
          Audience notes
          <textarea
            value={brief.audienceNotes}
            onChange={(e) => patch({ audienceNotes: e.target.value })}
            rows={2}
            placeholder="Concrete audience notes — these win if they conflict with the segment"
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          Angle for SEO
          <select
            value={brief.angle}
            onChange={(e) =>
              patch({ angle: e.target.value as ContentBrief["angle"] })
            }
            className={fieldClass}
          >
            <option value="">Select angle</option>
            {CONTENT_ANGLES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted">
            Editorial choice — match the dominant SERP format. It also decides what the tool page’s
            block quotation has to answer.
          </span>
          <PartnerQuoteFit
            projectId={projectId}
            targetKeyword={keywordInput || targetKeyword}
            angle={brief.angle}
          />
        </label>

        <label className={labelClass}>
          Discovery CTA type
          <select
            value={brief.ctaType}
            onChange={(e) =>
              patch({ ctaType: e.target.value as ContentBrief["ctaType"] })
            }
            className={fieldClass}
          >
            <option value="">Select CTA type</option>
            {CTA_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {/* Matches Angle for SEO's caption line so the two selects, row-mates in this grid,
              land at the same height instead of Discovery CTA type's sitting lower. */}
          <span className="text-xs font-normal text-muted">Google Ads call-to-action type.</span>
        </label>

        <label className={labelClass}>
          CTA label (optional)
          <input
            value={brief.ctaLabel}
            onChange={(e) => patch({ ctaLabel: e.target.value })}
            className={fieldClass}
          />
          <span className="text-xs font-normal text-muted">
            Overrides the CTA type&apos;s default wording, if set.
          </span>
        </label>

        <label className={labelClass}>
          Tone of voice
          <select
            value={brief.toneOfVoice}
            onChange={(e) =>
              patch({ toneOfVoice: e.target.value as ContentBrief["toneOfVoice"] })
            }
            className={fieldClass}
          >
            <option value="">Select tone</option>
            {TONES_OF_VOICE.map((o) => {
              const allowed = toneAllowed(o.value, brief.primaryIntent, brief.angle);
              return (
                <option key={o.value} value={o.value} disabled={!allowed}>
                  {o.label}
                  {allowed ? "" : " — not compatible with this intent/angle"}
                </option>
              );
            })}
          </select>
          <span className="text-xs font-normal text-muted">
            Internal control, not a Google attribute. Gated by primary intent and angle.
          </span>
        </label>
      </div>

      <label className={`${labelClass} mt-5`}>
        People Also Ask (direct entry, optional)
        {/* Stage 7: "Direct PAA entry — one question per line" — the field and splitLines already
            existed; the only thing missing was somewhere to type into it without a saved SERP
            page. Kept separate from SerpIngestPanel's upload flow on purpose: an operator who
            already knows the real questions from the SERP shouldn't need to save and parse a page
            just to enter them. fill-empty still applies if a SERP is uploaded afterward — typed
            entries here are exactly the "existing content" that upload will not clobber. */}
        <textarea
          value={brief.paaQuestions}
          onChange={(e) => patch({ paaQuestions: e.target.value })}
          rows={3}
          placeholder={"One question per line, e.g.\nWhat is AI implementation?\nHow much does it cost?"}
          className={`${fieldClass} font-mono text-xs`}
        />
      </label>

      <label className={`${labelClass} mt-5`}>
        Writing notes (optional)
        {/* Named "Writing Note for Image Prompt" on the strength of a 2026-09-21 audit that found
            only WriteImagePromptAsync read it. That is no longer true and the label was telling
            operators the opposite of what happens: GccGenerateService passes WritingNotes into
            GenerateStartingContentAsync, GenerateToolPageAsync and GeneratePillarBodyAsync, and it
            lands in every long-form body prompt as "Writing notes: ..." inside BRIEF CONTROLS
            (ContentPromptBuilder:839, :878). So it reaches pillar, blog and tool bodies. */}
        <textarea
          value={brief.writingNotes}
          onChange={(e) => patch({ writingNotes: e.target.value })}
          rows={2}
          className={fieldClass}
        />
      </label>

      {/* The reason Generate is off, not a reason to refuse a save: any draft saves. */}
      {!complete ? (
        <p className="mt-4 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2 text-sm text-foreground">
          Missing for Generate: {missing.join(", ")}. The brief saves as it is; Generate stays off
          until these are filled.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {createId ? (
          <button
            type="button"
            onClick={() => save("manual")}
            disabled={phase !== "ready" || saving || keywordBlank}
            className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save now"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void mint()}
            disabled={minting || keywordBlank || !effectiveContentType}
            className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            {minting ? "Creating…" : "Create the piece now"}
          </button>
        )}
        {createId ? (
          <span className="text-xs text-muted">Create {createId.slice(0, 8)}…</span>
        ) : null}
      </div>

      {createId && phase === "ready" ? <RecoverFromBrowser onRecover={recover} /> : null}
    </fieldset>
  );
}

/**
 * The one line that says which copy the screen is showing. Always on screen.
 */
function SaveStateLine({
  createId,
  phase,
  unsafeReason,
  dirty,
  saving,
  saveError,
  savedAt,
  keywordBlank,
  hasContentType,
  minting,
  mintError,
}: {
  createId: string | null;
  phase: "loading" | "ready" | "choose" | "unsafe";
  unsafeReason: string | null;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  savedAt: string | null;
  keywordBlank: boolean;
  hasContentType: boolean;
  minting: boolean;
  mintError: string | null;
}) {
  let text: string;
  let warn = true;
  if (phase === "unsafe") {
    text = unsafeReason ?? "Not saved.";
  } else if (!createId) {
    text = minting
      ? "Local draft, not yet saved — creating the piece…"
      : mintError
        ? `Local draft, not yet saved — ${mintError}`
        : keywordBlank || !hasContentType
          ? "Local draft, not yet saved — it saves to the server once it has a target keyword and a content type."
          : "Local draft, not yet saved — creating the piece in a moment.";
  } else if (keywordBlank) {
    text = "Local draft, not yet saved — the target keyword cannot be empty.";
  } else if (saveError) {
    text = `Local draft, not yet saved — ${saveError}. Retrying.`;
  } else if (saving) {
    text = "Local draft, not yet saved — saving…";
  } else if (dirty) {
    text = "Local draft, not yet saved";
  } else {
    text = `Saved to the server at ${savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}`;
    warn = false;
  }
  return (
    <p
      role="status"
      className={
        "mt-3 px-3 py-1.5 text-sm " +
        (warn
          ? "border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 text-foreground"
          : "border-l-2 border-border text-muted")
      }
    >
      {text}
    </p>
  );
}

/** Which brief fields differ between two copies, by the labels the form uses. */
function differingFields(a: ContentBrief, b: ContentBrief, aTopic: string, bTopic: string): string[] {
  const out: string[] = [];
  if (aTopic.trim() !== bTopic.trim()) out.push("Target keyword");
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ContentBrief>;
  for (const k of keys) {
    if (k === "lengthBand") continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(BRIEF_FIELD_LABEL[k] ?? String(k));
  }
  return out;
}

const BRIEF_FIELD_LABEL: Partial<Record<keyof ContentBrief, string>> = {
  primaryIntent: "Primary intent",
  secondaryIntent: "Secondary intent",
  buyingStage: "Buying stage",
  audienceSegment: "Audience segment",
  audienceNotes: "Audience notes",
  angle: "Angle for SEO",
  ctaType: "Discovery CTA type",
  ctaLabel: "CTA label",
  toneOfVoice: "Tone of voice",
  paaQuestions: "People Also Ask",
  writingNotes: "Writing notes",
  nicheFraming: "Niche framing",
};

/**
 * This browser's draft and the server copy differ: both are shown, with when each was written, and
 * the operator picks. Replaces "server brief wins", which discarded a newer local draft on open.
 */
function CopyChooser({
  choice,
  onKeepLocal,
  onUseServer,
}: {
  choice: CopyChoice;
  onKeepLocal: () => void;
  onUseServer: () => void;
}) {
  const serverNewer = !choice.localAt || choice.serverAt > choice.localAt;
  const fields = differingFields(choice.local, choice.server, choice.localTopic, choice.serverTopic);
  return (
    <div className="border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-4 py-3 text-sm text-foreground">
      <p role="status" className="font-medium">
        {choice.reason === "stale"
          ? "This create was changed somewhere else after you loaded it. Nothing was overwritten."
          : serverNewer
            ? "The server copy is newer than this draft"
            : "This browser holds a draft the server does not have"}
      </p>
      <ul className="mt-2 space-y-1 text-muted">
        <li>Server copy: saved {hhmm(choice.serverAt)}.</li>
        <li>This browser&rsquo;s draft: changed {hhmm(choice.localAt)}.</li>
        <li>They differ in: {fields.length ? fields.join(", ") : "formatting only"}.</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onKeepLocal}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Keep this browser&rsquo;s draft and save it
        </button>
        <button
          type="button"
          onClick={onUseServer}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted"
        >
          Use the server copy
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Either way the other copy is not deleted: the server keeps its revisions, and this
        browser&rsquo;s draft stays listed under &ldquo;Recover from this browser&rdquo; until it is
        replaced.
      </p>
    </div>
  );
}

/**
 * Every brief draft this browser holds, offered as a revision on this create.
 *
 * Reads keys and never deletes one. Drafts from before the brief saved itself -- `kw:<keyword>`
 * keys among them -- are only here, and stay until Jeff says he has what he needs.
 */
function RecoverFromBrowser({ onRecover }: { onRecover: (draft: StoredBriefDraft) => void }) {
  const [drafts, setDrafts] = useState<StoredBriefDraft[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <details
      className="group mt-6 border-t border-border pt-5"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setDrafts(listBriefDrafts());
      }}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-['']">
        <span className="text-[#C83803] underline-offset-2 group-open:no-underline hover:underline">
          Recover from this browser
        </span>
        <span className="ml-2 text-sm font-normal text-muted">
          Brief drafts this browser kept, including ones from before the brief saved itself
        </span>
      </summary>
      {drafts === null ? null : drafts.length === 0 ? (
        <p className="mt-3 text-sm text-muted">This browser holds no brief drafts.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {drafts.map((d) => (
            <li key={d.key} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-foreground">
                {d.label}
                <span className="ml-2 text-xs text-muted">
                  {(d.bytes / 1024).toFixed(1)} KB · changed {hhmm(d.changedAtUtc)}
                  {d.brief.nicheFraming.taxonomyPath ? ` · ${d.brief.nicheFraming.taxonomyPath}` : ""}
                </span>
              </span>
              {confirming === d.key ? (
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted">Replaces the brief on screen and saves it.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null);
                      onRecover(d);
                    }}
                    className="rounded-md bg-brand px-2.5 py-1 font-semibold text-white transition-colors hover:bg-brand-dark"
                  >
                    Save as a revision on this create
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="text-muted underline"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(d.key)}
                  className="text-xs text-[#C83803] underline"
                >
                  Use this draft
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

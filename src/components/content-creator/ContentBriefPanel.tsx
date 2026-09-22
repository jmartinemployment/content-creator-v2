"use client";

import { useEffect, useMemo, useState } from "react";
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
  loadBriefFromStorage,
  migrateBrief,
  saveBriefToStorage,
  toneAllowed,
  type ContentBrief,
} from "@/lib/content-creator/brief-catalog";
import { ApiError } from "@/services/gcc-api";
import { SerpIngestPanel } from "@/components/content-creator/SerpIngestPanel";
import {
  applyCuratedSerpToBrief,
  type CuratedSerpSeed,
  type SerpMergeConflict,
} from "@/lib/content-creator/serp-lens";
import {
  GCC_CREATE_STORAGE_PREFIX,
  briefToJson,
  createGccCreate,
  getGccCreate,
  patchBriefResearch,
} from "@/services/gcc-api";
/**
 * What's saved locally for this keyword. Used to seed a Site Analyzer handoff (gap reason +
 * curated SERP) — that handoff writer has had zero callers since the gap-pick flow was removed
 * (`b2a7fc8`), so the handoff-reading branch that used to live here was dead: it could never see
 * a value. Removed with `src/lib/site-section-storage.ts` rather than left as an always-false
 * check, per `plans/remove-site-analyzer.md`.
 */
function computeLocalBrief(targetKeyword: string): ContentBrief {
  const stored = loadBriefFromStorage(targetKeyword || "draft");
  const fromKw = loadBriefFromStorage(`kw:${targetKeyword}`);
  return fromKw ?? stored ?? emptyContentBrief();
}

const SERP_FIELD_LABEL: Record<SerpMergeConflict["field"], string> = {
  serpTitles: "SERP organic titles",
  serpUrls: "SERP organic URLs",
  paaQuestions: "People Also Ask",
  relatedSearches: "Related searches",
};

export default function ContentBriefPanel({
  clientId,
  projectId,
  projectSiteRunId,
  targetKeyword,
  createId: createIdProp,
  startingContentType,
  onBriefSaved,
  onBriefValidityChange,
}: {
  clientId: string;
  /** The project this create belongs to, when minted from a project context (e.g. /app/workflow).
   * Without it, GccGroundingResolver refuses any content type that needs partner/competitor
   * evidence with "this create belongs to no project" -- even when the project genuinely has
   * partner data, because nothing ever told the new create which project owns it. */
  projectId?: string;
  projectSiteRunId?: string;
  targetKeyword: string;
  /** When set, brief saves onto this create (does not open a second create). */
  createId?: string | null;
  /** The content type this brief is for, chosen in the one picker the parent owns. Used only to
   * mint the create (its single StartingContentType) and to derive the length band; there is no
   * picker in here and no default. */
  startingContentType?: string;
  /** Called when brief is persisted on a Content Creator create (server). */
  onBriefSaved: (createId: string, complete: boolean) => void;
  onBriefValidityChange: (complete: boolean) => void;
}) {
  // Identifies "which keyword/create this component is currently hydrated for". A \0 separator
  // keeps ("ab", "") distinct from ("a", "b") — the two pieces are never ambiguous once joined.
  const hydrationKey = `${targetKeyword}\0${createIdProp ?? ""}`;

  const [brief, setBrief] = useState<ContentBrief>(() => computeLocalBrief(targetKeyword));
  // The prop always wins when given; internalCreateId is what a fresh create's id (minted by
  // ensureCreateId, or resolved from localStorage during hydration) lives in when there is no
  // prop yet. createId itself is derived below, not stored — an effect syncing the prop into
  // state would add a render just to catch up to a value already available this render.
  const [internalCreateId, setInternalCreateId] = useState<string | null>(null);
  const createId = createIdProp ?? internalCreateId;
  // What this create is about. Used to be a read-only mirror of the project's own target keyword —
  // that field is gone (a project is an engagement now, not one article; see ProjectForm), so this
  // was left permanently empty with nothing able to set it, and every create silently got the
  // topic "untitled". Editable again: this is the create's topic and only the create's, so there is
  // nothing left for it to drift out of sync with.
  const [keywordInput, setKeywordInput] = useState(targetKeyword || "");
  // There is no content-type picker in here any more. Brief and Generate are one section with one
  // picker now (Jeff, 2026-09-22: "The proposed fix that never happened was to combine these two
  // sections") -- CreateDraftWorkspace owns that selection and passes the type down. The create
  // row still has exactly one StartingContentType, so the parent hands us its first selection.
  const effectiveContentType = startingContentType ?? "";
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [serpConflicts, setSerpConflicts] = useState<SerpMergeConflict[]>([]);

  // Re-seeds the local brief when targetKeyword/createIdProp actually change after mount. This
  // runs during render — React's own pattern for "adjusting state when a prop changes" — rather
  // than in an effect: an effect firing setBrief only after the fact would paint one frame of the
  // previous keyword's brief first. The useState initializer above already covers the first render,
  // so this only ever fires on a genuine later change, matching what the effect below used to do
  // unconditionally on every one of its own re-runs.
  const [hydratedForKey, setHydratedForKey] = useState(hydrationKey);
  if (hydrationKey !== hydratedForKey) {
    setHydratedForKey(hydrationKey);
    const recomputed = computeLocalBrief(targetKeyword);
    setBrief(recomputed);
    saveBriefToStorage(`kw:${targetKeyword}`, recomputed);
  }

  useEffect(() => {
    let cancelled = false;
    const localBrief = computeLocalBrief(targetKeyword);

    (async () => {
      let cid: string | null = createIdProp ?? null;
      if (!cid) {
        try {
          cid = localStorage.getItem(GCC_CREATE_STORAGE_PREFIX + targetKeyword);
        } catch {
          /* ignore */
        }
      }
      if (cid) {
        setInternalCreateId(cid);
        try {
          const create = await getGccCreate(cid);
          if (cancelled) return;
          if (create.briefJson) {
            try {
              const parsed = migrateBrief(JSON.parse(create.briefJson));
              // Prefer server brief, but keep locally seeded SERP/notes if server fields are empty.
              const merged = {
                ...parsed,
                serpTitles: parsed.serpTitles.trim() || localBrief.serpTitles,
                serpUrls: parsed.serpUrls.trim() || localBrief.serpUrls,
                paaQuestions: parsed.paaQuestions.trim() || localBrief.paaQuestions,
                relatedSearches:
                  parsed.relatedSearches.trim() || localBrief.relatedSearches,
                writingNotes: parsed.writingNotes.trim() || localBrief.writingNotes,
              };
              setBrief(merged);
              saveBriefToStorage(`kw:${targetKeyword}`, merged);
            } catch {
              /* keep local brief */
            }
            onBriefSaved(cid, true);
          } else {
            // No server brief yet — keep the locally-stored brief as-is.
            onBriefSaved(cid, false);
          }
        } catch {
          if (!cancelled) onBriefSaved(cid, false);
        }
      }
      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
    // onBriefSaved is stable enough from parent; avoid re-hydrate loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKeyword, createIdProp]);

  const missing = useMemo(() => contentBriefMissingFields(brief), [brief]);
  const complete = missing.length === 0;

  useEffect(() => {
    if (!hydrated) return;
    onBriefValidityChange(complete);
  }, [hydrated, complete, onBriefValidityChange]);

  // Length was its own choice; now it is not — it is a fact of the starting content type. Derived
  // at render and at save (handleSaveBrief) rather than synced into `brief` state via an effect,
  // so there is no state write racing the content type prop or the brief's own hydration/load.
  const derivedLengthBand = lengthBandForContentType(effectiveContentType);

  function persistLocal(next: ContentBrief) {
    saveBriefToStorage(`kw:${targetKeyword}`, next);
  }

  // Stage 7: the only caller of applyCuratedSerpToBrief anywhere in this codebase -- everything
  // upstream of this (the parser, the panel, both merge modes) was already built and simply never
  // reached. fill-empty is the default because a confirmed SERP should never clobber an operator's
  // own edits without being asked; conflicts are surfaced, never silently dropped.
  function onSerpCurated(seed: CuratedSerpSeed | null) {
    if (!seed) return;
    const { brief: merged, conflicts } = applyCuratedSerpToBrief(brief, seed, "fill-empty");
    setBrief(merged);
    persistLocal(merged);
    setSerpConflicts(conflicts);
  }

  function forceReplaceSerpField(field: SerpMergeConflict["field"], value: string) {
    const next = { ...brief, [field]: value };
    setBrief(next);
    persistLocal(next);
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
      persistLocal(next);
      return next;
    });
    setSavedMsg(null);
  }

  async function ensureCreateId(): Promise<string> {
    if (createId) return createId;
    const topic = keywordInput.trim();
    if (!topic) {
      // No placeholder topic. "untitled" used to stand in here silently — a generic label
      // masking a field nobody could actually fill in, which is exactly the auto-repair this
      // codebase's fail-closed rule forbids. Refuse instead: the operator sees why nothing
      // was created rather than discovering "untitled" three steps later.
      throw new ApiError("Target keyword is required before a create can be started.", 400);
    }
    if (!effectiveContentType) {
      // Same rule as above, for the same reason: "blog" used to stand in here silently as the
      // prop's default value, no operator choice involved at all. Checkboxes for a disabled type
      // are themselves disabled, so nothing here can ever resolve to one.
      throw new ApiError("Select a content type before a create can be started.", 400);
    }
    const created = await createGccCreate({
      clientId,
      projectId: projectId || null,
      startingContentType: effectiveContentType,
      topic,
      projectSiteRunId: projectSiteRunId || null,
    });
    setInternalCreateId(created.id);
    try {
      localStorage.setItem(GCC_CREATE_STORAGE_PREFIX + keywordInput, created.id);
    } catch {
      /* ignore */
    }
    return created.id;
  }

  async function handleSaveBrief() {
    setError(null);
    setSavedMsg(null);
    if (!createId && !keywordInput.trim()) {
      setError("Required: Target keyword");
      return;
    }
    if (!createId && !effectiveContentType) {
      setError("Required: Content type");
      return;
    }
    if (!isContentBriefComplete(brief)) {
      setError(`Required: ${missing.join(", ")}`);
      return;
    }
    setIsSaving(true);
    try {
      const id = await ensureCreateId();
      // The create holds the brief. There used to be a second write copying it onto a Workflow
      // project as well; that project store is being deleted, and two copies of one brief kept in
      // step by hand is what made them disagree.
      await patchBriefResearch(id, {
        briefJson: briefToJson({ ...brief, lengthBand: derivedLengthBand }),
      });
      setSavedMsg("Brief saved on Content Creator create.");
      onBriefSaved(id, true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not save brief.",
      );
      onBriefSaved(createId ?? "", false);
    } finally {
      setIsSaving(false);
    }
  }

  if (!hydrated) {
    return (
      <div>
        <p className="text-sm text-muted">Loading content brief…</p>
      </div>
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
    <div>
      <p className="text-sm text-muted">
        Controls aligned to Google Search &amp; Ads terminology. Saved on the Content Creator
        create (GeekAPI); Generate reads server state only. Fail closed: Generate stays disabled
        until required fields are saved.
      </p>

      {/* What this create is about. Editable up until a create exists: ensureCreateId reads it
          exactly once, to mint the create's topic, and returns early forever after — so once
          createId is set, further edits here are cosmetic and change nothing on the server. */}
      <div className="mt-5">
        <label className={labelClass}>
          Target keyword
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            disabled={!!createId}
            placeholder="ai chatbot implementation cost"
            className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
          />
          {createId ? (
            <span className="text-xs font-normal text-muted">
              Set when this create was started — no longer editable.
            </span>
          ) : null}
        </label>
      </div>

      <SerpIngestPanel gapTopic={targetKeyword} onCurated={onSerpCurated} />

      {serpConflicts.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
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
                  className="rounded border border-amber-400 px-2 py-1 font-semibold hover:bg-amber-100"
                >
                  Use SERP value
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSerpConflicts((prev) => prev.filter((x) => x.field !== c.field))
                  }
                  className="rounded border border-amber-300 px-2 py-1 text-amber-700 hover:bg-amber-100"
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
            Editorial choice — match the dominant SERP format.
          </span>
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
        Writing Note for Image Prompt (optional)
        {/* Renamed to say what it actually does (2026-09-21 audit): read only by
            WriteImagePromptAsync — every other content type ignores this field entirely. */}
        <textarea
          value={brief.writingNotes}
          onChange={(e) => patch({ writingNotes: e.target.value })}
          rows={2}
          className={fieldClass}
        />
      </label>

      {!complete ? (
        <p className="mt-4 text-sm text-amber-800">
          Missing required: {missing.join(", ")}. Generate stays disabled until these are filled
          and the brief is saved.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSaveBrief}
          disabled={isSaving || !complete}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save brief for generate"}
        </button>
        {createId ? (
          <span className="text-xs text-muted">Create {createId.slice(0, 8)}…</span>
        ) : null}
        {savedMsg ? <span className="text-sm text-green-700">{savedMsg}</span> : null}
        {error ? <span className="text-sm text-red-600 whitespace-pre-wrap">{error}</span> : null}
      </div>
    </div>
  );
}

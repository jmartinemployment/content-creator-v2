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
  briefFingerprint,
  emptyContentBrief,
  parseBriefJson,
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
  briefToJson,
  patchProjectBrief,
} from "@/services/gcc-api";
import { getProject } from "@/services/gcc-projects-api";
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
  provider,
}: {
  projectId?: string;
  targetKeyword: string;
  angle: string;
  /** The provider the workspace will write with. The answer is that provider's, so it is part of the question. */
  provider: string;
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
  const key = `${projectId ?? ""}\u0000${angle}\u0000${keyword}\u0000${provider}`;
  const current = answered?.key === key ? answered : null;

  async function run() {
    if (!projectId || checking) return;
    setChecking(true);
    try {
      const data = await checkPartnerQuoteReadiness(projectId, keyword, angle, provider);
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
          : "No project, so its declared partners are not known."}
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

/** What a Save that reached the server reports to the workspace. */
export type BriefSaved = { briefJson: string; topic: string };

export default function ContentBriefPanel({
  projectId,
  provider,
  keywordLocked = false,
  onBriefSaved,
  onSavedChange,
}: {
  /** The project whose brief this is. The project is the unit: one keyword, one brief (J1). */
  projectId: string;
  /** The provider the workspace has chosen to write with; the partner-quote check asks as that writer (fix-frontend F7). */
  provider: string;
  /** True once anything has been generated on this project; the keyword is fixed from then on. */
  keywordLocked?: boolean;
  /** Called after a Save that reached the server, with what the server now holds. */
  onBriefSaved: (saved: BriefSaved) => void;
  /** True when what is on screen is what the server holds -- the condition Generate waits on. */
  onSavedChange?: (saved: boolean) => void;
}) {
  // The brief is loaded from the database and written to it when Save is clicked, and at no other
  // time. Nothing is kept in the browser (plans/fix-project-persistence.md, J4 and J9).
  const [brief, setBrief] = useState<ContentBrief>(() => emptyContentBrief());
  // The project's keyword. Editable until the first generate; Save writes it with the brief.
  const [keywordInput, setKeywordInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  // Set when the project cannot be read, or carries no version: nothing can be saved safely, so the
  // form is read-only and says why.
  const [loadError, setLoadError] = useState<string | null>(null);
  // The version the next Save sends as expectedVersion, so a save from a stale copy is refused
  // rather than overwriting. A ref: it changes on every save and nothing renders from it.
  const versionRef = useRef<number | null>(null);
  // What the server holds, as a fingerprint, and when it was saved.
  const [savedFp, setSavedFp] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serpConflicts, setSerpConflicts] = useState<SerpMergeConflict[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (cancelled) return;
        const serverBrief = parseBriefJson(project.briefJson) ?? emptyContentBrief();
        const serverTopic = project.topic ?? "";
        setBrief(serverBrief);
        setKeywordInput(serverTopic);
        setSavedFp(briefFingerprint(serverBrief, serverTopic));
        setSavedAt(project.briefSavedAtUtc ?? null);
        if (typeof project.version === "number") {
          versionRef.current = project.version;
        } else {
          setLoadError(
            "This project's version could not be read from the server, so the brief cannot be saved. Reload the page.",
          );
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          `The brief could not be read from the server: ${
            err instanceof Error ? err.message : "unknown error"
          }. Reload the page.`,
        );
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const missing = useMemo(() => contentBriefMissingFields(brief), [brief]);
  const complete = missing.length === 0;
  const unsaved = loaded && !loadError && briefFingerprint(brief, keywordInput) !== savedFp;

  useEffect(() => {
    onSavedChange?.(loaded && !loadError && !unsaved && !saving);
  }, [loaded, loadError, unsaved, saving, onSavedChange]);

  // Leaving the page with unsaved changes: the browser's own warning.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  async function handleSave() {
    if (versionRef.current === null || saving) return;
    const b = brief;
    const typedTopic = keywordInput;
    // No length band: the brief carries none; it is derived per output type at generate time (J6).
    const briefJson = briefToJson({ ...b, lengthBand: "" });
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await patchProjectBrief(projectId, {
        briefJson,
        topic: typedTopic,
        expectedVersion: versionRef.current,
      });
      // A blank keyword leaves the server's as it was; the field then shows the one that is saved.
      const topic = saved.topic ?? typedTopic;
      versionRef.current = saved.version;
      setKeywordInput((current) => (current === typedTopic ? topic : current));
      setSavedFp(briefFingerprint(b, topic));
      setSavedAt(saved.savedAtUtc);
      onBriefSaved({ briefJson, topic });
    } catch (err) {
      // A stale save (409) arrives here with the server's own sentence: nothing was written.
      setSaveError(
        err instanceof ApiError || err instanceof Error ? err.message : "The save did not reach the server.",
      );
    } finally {
      setSaving(false);
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

  if (!loaded) {
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
    // Read-only when nothing can be saved safely: an edit there would reach neither the server nor,
    // without a comparison against it, this browser's draft.
    <fieldset disabled={loadError !== null} className="m-0 min-w-0 border-0 p-0">
      <p className="text-sm text-muted">
        Controls aligned to Google Search &amp; Ads terminology. Generate reads the saved brief
        only.
      </p>


      {/* The project's keyword. Every save writes it as `topic`, so it stays editable, and saved,
          until the first generate. After that it is fixed: the pages already written were written
          for this keyword. A second keyword is a second project (J1). */}
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
        <SerpIngestPanel gapTopic={keywordInput} onCurated={onSerpCurated} />
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
            targetKeyword={keywordInput}
            angle={brief.angle}
            provider={provider}
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
        Blog FAQ (optional)
        <span className="block text-xs font-normal text-muted">
          One question per line. Answered at the end of the blog, in calls of eight; the pillar
          answers the People Also Ask list above instead.
        </span>
        <textarea
          value={brief.blogFaqQuestions}
          onChange={(e) => patch({ blogFaqQuestions: e.target.value })}
          rows={3}
          placeholder={"One question per line, e.g.\nHow long does an AP automation rollout take?\nWhat does it cost to run?"}
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
          Missing for Generate: {missing.join(", ")}.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loadError !== null}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <span role="status" className="text-sm text-muted">
          {unsaved
            ? "Unsaved changes"
            : savedAt
              ? `Saved to the server at ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : ""}
        </span>
        {saveError || loadError ? (
          <span className="text-sm whitespace-pre-wrap text-[var(--gcc-accent-deep)]">
            {saveError ?? loadError}
          </span>
        ) : null}
      </div>
    </fieldset>
  );
}

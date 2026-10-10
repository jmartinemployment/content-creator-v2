/** SERP lens DTOs — mirror GeekAPI GccSerpLensModels (operator-saved SERP ingest). */

import type { ContentBrief } from "@/lib/content-creator/brief-catalog";

export type SavedSerpOrganic = {
  title: string;
  url: string;
  position: number;
};

export type PaaCandidate = {
  question: string;
  likelyRelevant: boolean;
  reason?: string | null;
};

export type SerpShapeSummary = {
  dominantFormats: string[];
  titlePatterns: string[];
  guidance: string;
  hasPeopleAlsoAsk: boolean;
  organicCount: number;
  pageHint?: string | null;
};

export type PaaPafCluster = {
  questions: PaaCandidate[];
  relatedSearches: string[];
};

export type InformationGainNote = {
  thisSiteCovers: string[];
  competitorOpens: string[];
  summary: string;
};

export type SavedSerpParseResult = {
  organics: SavedSerpOrganic[];
  peopleAlsoAsk: PaaCandidate[];
  relatedSearches: string[];
  shape: SerpShapeSummary;
  missingPaaLikelyPage2: boolean;
  parseWarning?: string | null;
};

/**
 * The curated subset the operator confirms.
 *
 * **Questions only.** This carried `serpTitles`, `serpUrls`, `relatedSearches` and three provenance
 * fields until 2026-10-03; every one of them was written to the brief and read by nothing — zero
 * references across every `.cs` file in GeekAPI, v1 and v2. `.cursor/rules/no-unwired-code.mdc` had
 * listed the defect since 2026-09-27 ("SERP ingest changed nothing"). Removed 2026-10-03 as Phase 1
 * of the dead-code removal.
 *
 * What survives is the half that does something: the questions become the pillar's FAQ section
 * (`GccGenerateService:2407`) and license headings against PAA (`:3120`).
 */
export type CuratedSerpSeed = {
  paaQuestions: string;
};

/** Build a curated seed from a parse result and the operator's question selection. */
export function buildCuratedSerpSeed(
  parsed: SavedSerpParseResult,
  paa: Set<number> | ReadonlySet<number>,
): CuratedSerpSeed {
  return {
    paaQuestions: parsed.peopleAlsoAsk
      .filter((_, i) => paa.has(i))
      .map((q) => q.question)
      .join("\n"),
  };
}

/** A field the seed offered but which `applyCuratedSerpToBrief` did not write, in `fill-empty`
 * mode, because the brief already had content there. Named so a caller can tell the operator what
 * was skipped instead of the conflict vanishing silently. */
export type SerpMergeConflict = {
  field: "paaQuestions";
  existing: string;
  offered: string;
};

export type SerpMergeResult = {
  brief: ContentBrief;
  /** Non-empty only in `fill-empty` mode, and only when the seed actually offered questions. Empty
   * in `replace` mode -- nothing is skipped there, so there is nothing to surface. */
  conflicts: SerpMergeConflict[];
};

/**
 * Apply a curated SERP seed onto a Content Brief.
 * `mode: "fill-empty"` keeps existing questions; `"replace"` overwrites them from the seed.
 */
export function applyCuratedSerpToBrief(
  brief: ContentBrief,
  seed: CuratedSerpSeed,
  mode: "fill-empty" | "replace" = "fill-empty",
): SerpMergeResult {
  const conflicts: SerpMergeConflict[] = [];
  const offered = seed.paaQuestions;
  let paaQuestions = brief.paaQuestions;

  if (offered.trim()) {
    if (mode === "replace" || !brief.paaQuestions.trim()) {
      paaQuestions = offered;
    } else {
      conflicts.push({ field: "paaQuestions", existing: brief.paaQuestions, offered });
    }
  }

  // No capture provenance is stamped. serpCapturedKeyword/At/Locale were written here and read by
  // nothing; a provenance claim nobody can act on is a field that has to be kept true for no reason.
  //
  // Nothing but the questions is written. Confirming a SERP used to put `SERP shape: ...` and
  // `Information Gain: ...` into a field of the operator's own when it happened to be empty, so a
  // field labelled as your input silently filled with machine output (Jeff, 2026-09-27: "None of it
  // belongs as a writing note").
  return { brief: { ...brief, paaQuestions }, conflicts };
}

/**
 * Whether the seed carries anything worth confirming.
 *
 * Was `curatedSerpHasOrganics`, gating Confirm on at least one selected organic result. With the
 * organics gone that gate would have been permanently false, disabling Confirm and silently taking
 * the pillar FAQ with it -- the questions are what the brief now receives, so they are what the
 * button waits for.
 */
export function curatedSerpHasQuestions(seed: CuratedSerpSeed): boolean {
  return seed.paaQuestions
    .split("\n")
    .map((s) => s.trim())
    .some(Boolean);
}


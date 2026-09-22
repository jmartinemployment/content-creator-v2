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

/** Curated subset the operator confirms before seeding the brief. */
export type CuratedSerpSeed = {
  serpTitles: string;
  serpUrls: string;
  paaQuestions: string;
  relatedSearches: string;
  shapeGuidance?: string;
  informationGainSummary?: string;
  /** The keyword this SERP was captured for — stamped at build time, never hand-edited. */
  capturedKeyword: string;
  /** ISO 8601, stamped at build time (the confirm moment, not the page-save moment). */
  capturedAt: string;
  /** GccSavedSerpParser has no locale signal to extract from a saved page; "en-US" until one
   * exists. Stated explicitly rather than left absent, so a real signal replaces it cleanly. */
  locale: string;
};

/** Build a curated seed from a parse result and operator selection sets. */
export function buildCuratedSerpSeed(
  parsed: SavedSerpParseResult,
  organics: Set<number> | ReadonlySet<number>,
  paa: Set<number> | ReadonlySet<number>,
  related: Set<number> | ReadonlySet<number>,
  extras?: {
    shapeGuidance?: string;
    informationGainSummary?: string;
    capturedKeyword?: string;
  },
): CuratedSerpSeed {
  const selectedO = parsed.organics.filter((_, i) => organics.has(i));
  return {
    serpTitles: selectedO.map((o) => o.title).join("\n"),
    serpUrls: selectedO.map((o) => o.url).join("\n"),
    paaQuestions: parsed.peopleAlsoAsk
      .filter((_, i) => paa.has(i))
      .map((q) => q.question)
      .join("\n"),
    relatedSearches: parsed.relatedSearches
      .filter((_, i) => related.has(i))
      .join("\n"),
    shapeGuidance: extras?.shapeGuidance ?? parsed.shape.guidance,
    informationGainSummary: extras?.informationGainSummary,
    capturedKeyword: extras?.capturedKeyword ?? "",
    capturedAt: new Date().toISOString(),
    locale: "en-US",
  };
}

/** A field the seed offered but which `applyCuratedSerpToBrief` did not write, in `fill-empty`
 * mode, because the brief already had content there. Named so a caller can tell the operator what
 * was skipped instead of the conflict vanishing silently. */
export type SerpMergeConflict = {
  field: "serpTitles" | "serpUrls" | "paaQuestions" | "relatedSearches";
  existing: string;
  offered: string;
};

export type SerpMergeResult = {
  brief: ContentBrief;
  /** Non-empty only in `fill-empty` mode, and only for fields the seed actually offered content
   * for. Empty in `replace` mode -- nothing is skipped there, so there is nothing to surface. */
  conflicts: SerpMergeConflict[];
};

/**
 * Apply a curated SERP seed onto a Content Brief.
 * `mode: "fill-empty"` keeps existing non-empty fields; `"replace"` overwrites SERP fields from the seed.
 * Stamps capture provenance (keyword/date/locale) whenever any SERP field is actually written --
 * never on a no-op call, so an untouched brief never gains a provenance claim it didn't earn.
 */
export function applyCuratedSerpToBrief(
  brief: ContentBrief,
  seed: CuratedSerpSeed,
  mode: "fill-empty" | "replace" = "fill-empty",
): SerpMergeResult {
  const conflicts: SerpMergeConflict[] = [];
  let wroteAnyField = false;

  const pick = (
    field: SerpMergeConflict["field"],
    current: string,
    offered: string,
  ) => {
    if (!offered.trim()) return current;
    if (mode === "replace") {
      wroteAnyField = true;
      return offered;
    }
    if (current.trim()) {
      conflicts.push({ field, existing: current, offered });
      return current;
    }
    wroteAnyField = true;
    return offered;
  };

  const next: ContentBrief = {
    ...brief,
    serpTitles: pick("serpTitles", brief.serpTitles, seed.serpTitles),
    serpUrls: pick("serpUrls", brief.serpUrls, seed.serpUrls),
    paaQuestions: pick("paaQuestions", brief.paaQuestions, seed.paaQuestions),
    relatedSearches: pick(
      "relatedSearches",
      brief.relatedSearches,
      seed.relatedSearches,
    ),
  };

  if (wroteAnyField) {
    next.serpCapturedKeyword = seed.capturedKeyword;
    next.serpCapturedAt = seed.capturedAt;
    next.serpLocale = seed.locale;
  }

  if (!brief.writingNotes.trim()) {
    const noteBits = [
      seed.shapeGuidance?.trim() ? `SERP shape: ${seed.shapeGuidance.trim()}` : "",
      seed.informationGainSummary?.trim()
        ? `Information Gain: ${seed.informationGainSummary.trim()}`
        : "",
    ].filter(Boolean);
    if (noteBits.length) {
      next.writingNotes = noteBits.join("\n");
    }
  }

  return { brief: next, conflicts };
}

export function curatedSerpHasOrganics(seed: CuratedSerpSeed): boolean {
  return seed.serpTitles
    .split("\n")
    .map((s) => s.trim())
    .some(Boolean);
}

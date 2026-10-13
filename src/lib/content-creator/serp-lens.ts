/** SERP lens DTOs — mirror GeekAPI GccSerpLensModels (operator-saved SERP ingest). */

import {
  faqRowHasAny,
  faqRowsWithQuestion,
  type ContentBrief,
  type FaqRow,
} from "@/lib/content-creator/brief-catalog";

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
 * (GeekAPI `GccGenerateService.WriteFaqInBatchesAsync`) and are headings an outline may take
 * (`GccHeadingProvenanceGuard`, the "paa" source).
 *
 * Still questions only, one per line, since 2026-10-13, when the brief's People Also Ask box became
 * rows of a question and the operator's own answer: a results page offers questions and never an
 * answer. `applyCuratedSerpToBrief` turns each into a row with no answer, for Jeff to answer; a
 * question with no answer is left off the page and reported.
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
 * was skipped instead of the conflict vanishing silently.
 *
 * `existing` and `offered` are questions only, one per line, as they always were: the brief's rows
 * are reported by their questions, without the answers typed for them. */
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
 *
 * Each offered question becomes a row with no answer (2026-10-13): the operator supplies the answer,
 * and a results page has none to offer. Two rules follow from a row now holding something typed:
 * - The box is empty, for `fill-empty`, only when no row holds a question or an answer. A row with an
 *   answer and no question yet is something typed, so it is a conflict and not overwritten.
 * - On `replace`, a question that is in both, compared trimmed, keeps the answer already typed for
 *   it. An answer is lost only for a question that is not in the new list, and only on `replace`,
 *   which is the operator's own choice.
 */
export function applyCuratedSerpToBrief(
  brief: ContentBrief,
  seed: CuratedSerpSeed,
  mode: "fill-empty" | "replace" = "fill-empty",
): SerpMergeResult {
  const conflicts: SerpMergeConflict[] = [];
  const offered = questionsOf(seed.paaQuestions);
  let paaQuestions = brief.paaQuestions;

  if (offered.length > 0) {
    if (mode === "replace" || !brief.paaQuestions.some(faqRowHasAny)) {
      paaQuestions = offered.map((question) => ({
        question,
        answer: answerTypedFor(brief.paaQuestions, question),
      }));
    } else {
      conflicts.push({
        field: "paaQuestions",
        existing: faqRowsWithQuestion(brief.paaQuestions)
          .map((row) => row.question.trim())
          .join("\n"),
        offered: seed.paaQuestions,
      });
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

/** The questions in a seed: one per line, trimmed, blank lines left out. */
function questionsOf(lines: string): string[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** The answer already typed for a question, or none. A row that has an answer is preferred. */
function answerTypedFor(rows: readonly FaqRow[], question: string): string {
  const answered = rows.find((row) => row.question.trim() === question && row.answer.trim().length > 0);
  return answered ? answered.answer : "";
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
  return questionsOf(seed.paaQuestions).length > 0;
}


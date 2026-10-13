import {
  applyCuratedSerpToBrief,
  buildCuratedSerpSeed,
  curatedSerpHasQuestions,
  type CuratedSerpSeed,
  type SavedSerpParseResult,
} from "./serp-lens.ts";
import { emptyContentBrief } from "./brief-catalog.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n expected ${JSON.stringify(expected)}\n actual   ${JSON.stringify(actual)}`);
  }
}

/**
 * The seed carries questions and nothing else since 2026-10-03. Organic titles, organic URLs,
 * related searches and three provenance fields were written to the brief and read by nothing;
 * Phase 1 of the 2026-10-03 dead-code removal took them out. The parse result still carries organics and
 * related searches because it mirrors the API response — the fixture keeps them to prove they are
 * now ignored rather than absent.
 */
const parsed: SavedSerpParseResult = {
  organics: [
    { title: "AI Implementation Guide", url: "https://a.test/guide", position: 1 },
    { title: "Best AI Tools 2026", url: "https://b.test/tools", position: 2 },
  ],
  peopleAlsoAsk: [
    { question: "What is AI implementation?", likelyRelevant: true },
    { question: "Make $1000 a day fast?", likelyRelevant: false, reason: "off-topic" },
  ],
  relatedSearches: ["ai consulting", "ai rollout"],
  shape: {
    dominantFormats: ["guide"],
    titlePatterns: ["AI Implementation Guide"],
    guidance: "Dominant SERP formats: guide.",
    hasPeopleAlsoAsk: true,
    organicCount: 2,
    pageHint: "page1-or-unknown",
  },
  missingPaaLikelyPage2: false,
  parseWarning: null,
};

// The seed is questions only. A parse result full of organics and related searches must produce a
// seed carrying neither -- this is the assertion that fails if anyone wires them back up.
const withQuestions = buildCuratedSerpSeed(parsed, new Set([0]));
assertEqual(
  Object.keys(withQuestions).sort(),
  ["paaQuestions"],
  "the seed carries questions and nothing else",
);
assertEqual(
  withQuestions.paaQuestions,
  "What is AI implementation?",
  "only the selected question is carried",
);

// "Never merge an empty result." The gate was curatedSerpHasOrganics; with organics gone it would
// have been permanently false, disabling Confirm and silently taking the pillar FAQ with it.
assert(curatedSerpHasQuestions(withQuestions), "a seed with a selected question has questions");
assert(
  !curatedSerpHasQuestions(buildCuratedSerpSeed(parsed, new Set())),
  "selecting no questions is an empty seed, whatever else the SERP parsed",
);

// The brief's People Also Ask box is rows of a question and the operator's own answer since
// 2026-10-13. A results page offers questions and no answers, so each offered question becomes a row
// with no answer.
const OFFERED_ROW = { question: "What is AI implementation?", answer: "" };
const TYPED_ROW = { question: "Typed by hand?", answer: "An answer typed by hand." };

// fill-empty keeps what the operator already wrote, and reports the skip rather than losing it.
const briefWithQuestions = { ...emptyContentBrief(), paaQuestions: [TYPED_ROW] };
const fillEmpty = applyCuratedSerpToBrief(briefWithQuestions, withQuestions, "fill-empty");
assertEqual(fillEmpty.brief.paaQuestions, [TYPED_ROW], "fill-empty keeps existing questions and their answers");
assertEqual(fillEmpty.conflicts.length, 1, "the skipped field is reported");
assertEqual(fillEmpty.conflicts[0]!.field, "paaQuestions", "the conflict names the field");
assertEqual(fillEmpty.conflicts[0]!.offered, "What is AI implementation?", "the conflict carries the offer");
// The conflict reports questions as text, as it always did: the answers are not in it.
assertEqual(fillEmpty.conflicts[0]!.existing, "Typed by hand?", "the conflict carries the existing questions, and no answer");

// replace overwrites and reports nothing, because nothing was skipped.
const replaced = applyCuratedSerpToBrief(briefWithQuestions, withQuestions, "replace");
assertEqual(replaced.brief.paaQuestions, [OFFERED_ROW], "replace overwrites, each offered question a row with no answer");
assertEqual(replaced.conflicts.length, 0, "replace skips nothing, so reports nothing");

// On replace, a question that is in both keeps the answer already typed for it. Only the answer to a
// question that is not in the new list goes, and only because the operator chose to replace.
const bothSeed: CuratedSerpSeed = { paaQuestions: "What is AI implementation?\nHow much does it cost?\n" };
const briefWithAnswers = {
  ...emptyContentBrief(),
  paaQuestions: [
    TYPED_ROW,
    { question: "  How much does it cost?  ", answer: "From $2,000 a month." },
    { question: "", answer: "An answer waiting for its question." },
  ],
};
const replacedKeepingAnswers = applyCuratedSerpToBrief(briefWithAnswers, bothSeed, "replace");
assertEqual(
  replacedKeepingAnswers.brief.paaQuestions,
  [OFFERED_ROW, { question: "How much does it cost?", answer: "From $2,000 a month." }],
  "replace keeps the answer typed for a question that is in both lists",
);
assertEqual(replacedKeepingAnswers.conflicts.length, 0, "replace still reports nothing");

// The same offer under fill-empty changes nothing: every typed answer is still there, and the
// conflict lists the questions the box holds, one per line.
const keptAnswers = applyCuratedSerpToBrief(briefWithAnswers, bothSeed, "fill-empty");
assertEqual(keptAnswers.brief.paaQuestions, briefWithAnswers.paaQuestions, "fill-empty loses no typed answer");
assertEqual(keptAnswers.conflicts[0]!.existing, "Typed by hand?\nHow much does it cost?", "existing questions, one per line");
assertEqual(keptAnswers.conflicts[0]!.offered, bothSeed.paaQuestions, "the offer is reported as it was offered");

// An answer typed with no question yet is something typed: the box is not empty, so fill-empty does
// not overwrite it.
const answerOnly = { ...emptyContentBrief(), paaQuestions: [{ question: " ", answer: "An answer waiting for its question." }] };
const answerKept = applyCuratedSerpToBrief(answerOnly, withQuestions, "fill-empty");
assertEqual(answerKept.brief.paaQuestions, answerOnly.paaQuestions, "an answer with no question is not overwritten");
assertEqual(answerKept.conflicts.length, 1, "and the offer is reported as skipped");

// An empty brief takes the questions with no conflict, and so does a box holding only rows that were
// added and never typed in.
const seeded = applyCuratedSerpToBrief(emptyContentBrief(), withQuestions, "fill-empty");
assertEqual(seeded.brief.paaQuestions, [OFFERED_ROW], "an empty brief is seeded with a row for each question");
assertEqual(seeded.conflicts.length, 0, "seeding an empty field is not a conflict");
const blankRows = { ...emptyContentBrief(), paaQuestions: [{ question: "", answer: "" }, { question: "  ", answer: "" }] };
const seededOverBlank = applyCuratedSerpToBrief(blankRows, withQuestions, "fill-empty");
assertEqual(seededOverBlank.brief.paaQuestions, [OFFERED_ROW], "blank rows are an empty box");
assertEqual(seededOverBlank.conflicts.length, 0, "seeding over blank rows is not a conflict");

// An empty seed is a no-op in both modes -- it must never blank a brief that has questions.
const emptySeed: CuratedSerpSeed = { paaQuestions: "" };
for (const mode of ["fill-empty", "replace"] as const) {
  const noop = applyCuratedSerpToBrief(briefWithQuestions, emptySeed, mode);
  assertEqual(noop.brief.paaQuestions, [TYPED_ROW], `an empty seed is a no-op in ${mode}`);
  assertEqual(noop.conflicts.length, 0, `an empty seed reports no conflict in ${mode}`);
}

// Confirming a SERP writes the questions and nothing else. It used to put "SERP shape: ..." and
// "Information Gain: ..." into a field of the operator's own when it happened to be empty, so a
// field labelled as your input filled with machine output (Jeff, 2026-09-27: "None of it belongs as
// a writing note").
const onlyQuestions = applyCuratedSerpToBrief(emptyContentBrief(), withQuestions, "fill-empty");
assertEqual(
  JSON.stringify({ ...onlyQuestions.brief, paaQuestions: [] }),
  JSON.stringify(emptyContentBrief()),
  "confirming a SERP changes nothing in the brief but the questions",
);

console.log("serp-lens.test.ts: all assertions passed");

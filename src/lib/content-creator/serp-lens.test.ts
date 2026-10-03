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
 * `plans/remove-unwired-code.md` Phase 1 removed them. The parse result still carries organics and
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

// fill-empty keeps what the operator already wrote, and reports the skip rather than losing it.
const briefWithQuestions = { ...emptyContentBrief(), paaQuestions: "Typed by hand?" };
const fillEmpty = applyCuratedSerpToBrief(briefWithQuestions, withQuestions, "fill-empty");
assertEqual(fillEmpty.brief.paaQuestions, "Typed by hand?", "fill-empty keeps existing questions");
assertEqual(fillEmpty.conflicts.length, 1, "the skipped field is reported");
assertEqual(fillEmpty.conflicts[0]!.field, "paaQuestions", "the conflict names the field");
assertEqual(fillEmpty.conflicts[0]!.offered, "What is AI implementation?", "the conflict carries the offer");

// replace overwrites and reports nothing, because nothing was skipped.
const replaced = applyCuratedSerpToBrief(briefWithQuestions, withQuestions, "replace");
assertEqual(replaced.brief.paaQuestions, "What is AI implementation?", "replace overwrites");
assertEqual(replaced.conflicts.length, 0, "replace skips nothing, so reports nothing");

// An empty brief takes the questions with no conflict.
const seeded = applyCuratedSerpToBrief(emptyContentBrief(), withQuestions, "fill-empty");
assertEqual(seeded.brief.paaQuestions, "What is AI implementation?", "an empty brief is seeded");
assertEqual(seeded.conflicts.length, 0, "seeding an empty field is not a conflict");

// An empty seed is a no-op in both modes -- it must never blank a brief that has questions.
const emptySeed: CuratedSerpSeed = { paaQuestions: "" };
for (const mode of ["fill-empty", "replace"] as const) {
  const noop = applyCuratedSerpToBrief(briefWithQuestions, emptySeed, mode);
  assertEqual(noop.brief.paaQuestions, "Typed by hand?", `an empty seed is a no-op in ${mode}`);
  assertEqual(noop.conflicts.length, 0, `an empty seed reports no conflict in ${mode}`);
}

// Writing notes are the operator's and nothing writes into them. Confirming a SERP used to put
// "SERP shape: ..." and "Information Gain: ..." there when the field happened to be empty, so a
// field labelled as your input filled with machine output (Jeff, 2026-09-27: "None of it belongs as
// a writing note").
const notes = applyCuratedSerpToBrief(emptyContentBrief(), withQuestions, "fill-empty");
assertEqual(notes.brief.writingNotes, "", "confirming a SERP never writes writing notes");

console.log("serp-lens.test.ts: all assertions passed");

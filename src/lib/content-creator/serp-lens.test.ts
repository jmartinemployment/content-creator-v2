import {
  applyCuratedSerpToBrief,
  buildCuratedSerpSeed,
  curatedSerpHasOrganics,
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

// Stage 7: "Zero organics parsed => fail. Never merge an empty result." curatedSerpHasOrganics is
// the gate this depends on -- prove it actually distinguishes the two cases.
const withOrganics = buildCuratedSerpSeed(parsed, new Set([0, 1]), new Set([0]), new Set([0]));
assert(curatedSerpHasOrganics(withOrganics), "a seed built from selected organics has organics");

const noOrganicsSelected = buildCuratedSerpSeed(parsed, new Set(), new Set([0]), new Set([0]));
assert(
  !curatedSerpHasOrganics(noOrganicsSelected),
  "a seed with zero organics selected must read as having no organics, even with PAA/related present",
);

// Provenance: stamped on every build, never left for the caller to forget.
assertEqual(withOrganics.locale, "en-US", "locale is stamped");
assert(withOrganics.capturedAt.length > 0, "capturedAt is stamped");
const keyed = buildCuratedSerpSeed(parsed, new Set([0]), new Set(), new Set(), {
  capturedKeyword: "ai implementation",
});
assertEqual(keyed.capturedKeyword, "ai implementation", "capturedKeyword passes through");

// Merge mode: fill-empty keeps existing content and reports the conflict rather than dropping it.
const briefWithExistingTitles = { ...emptyContentBrief(), serpTitles: "Operator's own title" };
const fillEmptyResult = applyCuratedSerpToBrief(briefWithExistingTitles, withOrganics, "fill-empty");
assertEqual(
  fillEmptyResult.brief.serpTitles,
  "Operator's own title",
  "fill-empty never overwrites existing content",
);
assertEqual(fillEmptyResult.conflicts.length, 1, "fill-empty reports exactly one conflict");
assertEqual(fillEmptyResult.conflicts[0]?.field, "serpTitles", "the conflict names the right field");
assertEqual(
  fillEmptyResult.conflicts[0]?.offered,
  withOrganics.serpTitles,
  "the conflict carries the value that was not written, so a caller can offer it",
);

// Merge mode: replace overwrites and reports no conflicts (nothing was skipped).
const replaceResult = applyCuratedSerpToBrief(briefWithExistingTitles, withOrganics, "replace");
assertEqual(replaceResult.brief.serpTitles, withOrganics.serpTitles, "replace overwrites existing content");
assertEqual(replaceResult.conflicts.length, 0, "replace never reports conflicts");

// Provenance is stamped only when a field was actually written -- never claimed on a no-op call.
const untouchedBrief = emptyContentBrief();
const emptySeed: CuratedSerpSeed = {
  serpTitles: "",
  serpUrls: "",
  paaQuestions: "",
  relatedSearches: "",
  capturedKeyword: "ai implementation",
  capturedAt: "2026-01-01T00:00:00.000Z",
  locale: "en-US",
};
const noopResult = applyCuratedSerpToBrief(untouchedBrief, emptySeed, "fill-empty");
assertEqual(noopResult.brief.serpCapturedAt, "", "no field written => no provenance claimed");

const realResult = applyCuratedSerpToBrief(untouchedBrief, withOrganics, "fill-empty");
assert(realResult.brief.serpCapturedAt.length > 0, "a field written => provenance is stamped");
assertEqual(realResult.brief.serpTitles, withOrganics.serpTitles, "the field itself was actually written");

console.log("serp-lens tests passed");

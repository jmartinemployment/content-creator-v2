import {
  appendUnique,
  draftWrittenLabel,
  lastRunLines,
  runRecord,
  runSavedLine,
  savedByRun,
  splitGroundingWarnings,
  summarizeEventPayload,
  timeOfDay,
} from "./run-display.ts";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n expected ${JSON.stringify(expected)}\n actual   ${JSON.stringify(actual)}`);
  }
}

const NY = "America/New_York";
const now = new Date("2026-10-05T18:40:00Z"); // 2:40 PM in New York

assertEqual(timeOfDay(new Date("2026-10-05T18:32:07Z"), NY, "en-US"), "2:32 PM", "a time of day");

// The two pillars on "test" on 2026-10-05: one from the morning run, one from the afternoon's. Same
// name, same tab. The time is what tells them apart.
assertEqual(
  draftWrittenLabel("2026-10-05T10:46:32.401027Z", now, NY, "en-US"),
  "6:46 AM",
  "a draft written today is labelled with its time",
);
assertEqual(
  draftWrittenLabel("2026-10-05T18:32:07.592186Z", now, NY, "en-US"),
  "2:32 PM",
  "and so is the one from the later run",
);

// Any other day carries its date: "6:46 AM" alone would read as this morning.
assertEqual(
  draftWrittenLabel("2026-10-03T22:15:00Z", now, NY, "en-US"),
  "Oct 3, 6:15 PM",
  "a draft from another day is labelled with the date and the time",
);

// "Today" is the reader's day, not UTC's: 03:30 UTC on the 6th is still the evening of the 5th in New York.
assertEqual(
  draftWrittenLabel("2026-10-06T03:30:00Z", new Date("2026-10-06T03:45:00Z"), NY, "en-US"),
  "11:30 PM",
  "the day is taken in the reader's time zone",
);

assertEqual(draftWrittenLabel("not a date", now, NY, "en-US"), "", "an unreadable time is no label, not a wrong one");

// What a finished run recorded. Three pieces, in the order they were written.
assertEqual(
  savedByRun(
    JSON.stringify({
      created: [
        { artifact: { id: "pillar" }, version: { versionNumber: 2 } },
        { artifact: { id: "blog" }, version: { versionNumber: 2 } },
        { artifact: { id: "tool-ramp" }, version: { versionNumber: 1 } },
      ],
      refusals: ["Approvalmax: Refused"],
    }),
  ),
  ["pillar", "blog", "tool-ramp"],
  "the pages a run saved are the ones its own result lists, rewritten pages included",
);
// One piece and nothing else to report: the server sends the piece itself.
assertEqual(
  savedByRun(JSON.stringify({ artifact: { id: "pillar" }, version: { versionNumber: 3 } })),
  ["pillar"],
  "a run that wrote one piece records it bare",
);
// Every tool page refused: the list is there and it is empty.
assertEqual(savedByRun(JSON.stringify({ created: [], refusals: ["a", "b"] })), [], "a run that saved nothing says so");
// Not known is not "nothing".
assertEqual(savedByRun(null), null, "no result is not a result of nothing");
assertEqual(savedByRun("not json"), null, "a result that will not parse is not known");
assertEqual(savedByRun(JSON.stringify({ refusals: [] })), null, "a result with no list of pieces is not known");
assertEqual(
  savedByRun(JSON.stringify({ created: [{ artifact: { id: "pillar" } }, { version: {} }] })),
  null,
  "a list with a piece that names no page is not vouched for",
);

// The record as GeekAPI stores it at 5671288: the result's own fields as declared, everything
// inside them as C# declares it. This is the 2:32 PM run on "test" on 2026-10-05, which the page
// showed as "0 of 5 can be grounded" and "undefined categories" five times over.
const storedRecord = JSON.stringify({
  created: [
    { artifact: { Id: "pillar", Type: "pillar" }, version: { Id: "v-pillar", VersionNumber: 2 } },
    { artifact: { Id: "tool-ramp", Type: "tool" }, version: { Id: "v-ramp", VersionNumber: 1 } },
  ],
  refusals: ["Approvalmax: Refused: the tool page 'Approvalmax'"],
  preflight: [
    {
      ProductName: "Ramp",
      Host: "ramp.com",
      Ready: true,
      Coverage: "12 of 20 categories",
      PagesAttempted: 9,
      PagesFailed: 0,
      PopulatedCategories: 12,
      HasCapabilitySignal: true,
      Reused: true,
      BankedAtUtc: "2026-10-05T10:46:00Z",
      TotalCategories: 20,
    },
    {
      ProductName: "Approvalmax",
      Host: "approvalmax.com",
      Ready: false,
      Coverage: "no capability signal",
      PagesAttempted: 4,
      PagesFailed: 0,
      PopulatedCategories: 1,
      HasCapabilitySignal: false,
      Reused: false,
      BankedAtUtc: null,
      TotalCategories: 20,
    },
  ],
  warnings: ["blog: Blog body sections 1-2 is 761 words against a 900-word floor"],
});
assertEqual(
  runRecord(storedRecord),
  {
    savedIds: ["pillar", "tool-ramp"],
    refusals: ["Approvalmax: Refused: the tool page 'Approvalmax'"],
    warnings: ["blog: Blog body sections 1-2 is 761 words against a 900-word floor"],
    preflight: [
      {
        productName: "Ramp",
        host: "ramp.com",
        ready: true,
        coverage: "12 of 20 categories",
        pagesAttempted: 9,
        pagesFailed: 0,
        populatedCategories: 12,
        hasCapabilitySignal: true,
        totalCategories: 20,
        reused: true,
        bankedAtUtc: "2026-10-05T10:46:00Z",
      },
      {
        productName: "Approvalmax",
        host: "approvalmax.com",
        ready: false,
        coverage: "no capability signal",
        pagesAttempted: 4,
        pagesFailed: 0,
        populatedCategories: 1,
        hasCapabilitySignal: false,
        totalCategories: 20,
        reused: false,
        bankedAtUtc: null,
      },
    ],
  },
  "the stored record is read under the contract's names whatever the server's spelling",
);
assertEqual(savedByRun(storedRecord), ["pillar", "tool-ramp"], "and the saved pages come from the same read");
// The hub's live spelling reads the same way: lowering the first letter of a camelCase key is the identity.
assertEqual(
  runRecord(
    JSON.stringify({
      created: [{ artifact: { id: "blog" }, version: { id: "v" } }],
      refusals: [],
      preflight: [
        {
          productName: "Bill",
          host: "bill.com",
          ready: true,
          coverage: "ok",
          pagesAttempted: 3,
          pagesFailed: 0,
          populatedCategories: 8,
          hasCapabilitySignal: true,
        },
      ],
      warnings: [],
    }),
  ),
  {
    savedIds: ["blog"],
    refusals: [],
    warnings: [],
    preflight: [
      {
        productName: "Bill",
        host: "bill.com",
        ready: true,
        coverage: "ok",
        pagesAttempted: 3,
        pagesFailed: 0,
        populatedCategories: 8,
        hasCapabilitySignal: true,
      },
    ],
  },
  "a camelCase record reads unchanged, optional fields left absent",
);
// A pre-flight row the page could not print makes the pre-flight not known -- not a shorter list.
assertEqual(
  runRecord(JSON.stringify({ created: [], preflight: [{ ProductName: "Ramp" }] }))?.preflight,
  null,
  "a partner row missing its counts is not a row, and the pre-flight is then not known",
);
assertEqual(
  runRecord(JSON.stringify({ artifact: { Id: "pillar" }, version: { Id: "v" } })),
  { savedIds: ["pillar"], refusals: null, warnings: null, preflight: null },
  "a bare single piece carries no lists, and absent is not empty",
);
assertEqual(runRecord(null), null, "no record is not a record");
assertEqual(runRecord("{"), null, "a record that will not parse is not a record");

assertEqual(runSavedLine(6), "It saved 6 drafts. The first is open below.", "a run that saved several");
assertEqual(runSavedLine(1), "It saved 1 draft. It is open below.", "a run that saved one");
assertEqual(runSavedLine(0), "It saved no drafts.", "a run that finished with every page refused");

// The 2:32 PM run on "test", read back after a reload.
assertEqual(
  lastRunLines(
    {
      status: "ready",
      finishedAtUtc: "2026-10-05T18:32:07Z",
      resultJson: JSON.stringify({ created: [{ artifact: { id: "a" } }, { artifact: { id: "b" } }], refusals: ["x"] }),
    },
    now,
    NY,
    "en-US",
  ),
  ["The last Generate finished at 2:32 PM. It saved 2 drafts."],
  "an ended run says when it finished and what it saved",
);
// The 2:11 PM run, which failed on the length band.
assertEqual(
  lastRunLines(
    { status: "failed", finishedAtUtc: "2026-10-05T18:14:30Z", error: "InvalidOperationException: brief required: missing lengthBand" },
    now,
    NY,
    "en-US",
  ),
  ["The last Generate failed at 2:14 PM: InvalidOperationException: brief required: missing lengthBand"],
  "a failed run says why, in the words it failed with",
);
assertEqual(
  lastRunLines({ status: "ready", finishedAtUtc: "2026-10-03T22:15:00Z", resultJson: null }, now, NY, "en-US"),
  ["The last Generate finished at Oct 3, 6:15 PM."],
  "a run from another day carries its date, and a result that is not there claims nothing",
);
assertEqual(
  lastRunLines({ status: "failed", finishedAtUtc: null, error: "  " }, now, NY, "en-US"),
  ["The last Generate failed: no reason was recorded."],
  "a failure with no reason says there is none",
);


// F9: a grounding warning is about the evidence, not a piece; the two go to different blocks.
assertEqual(
  splitGroundingWarnings([
    "pillar: never named a partner",
    "grounding: Ramp's crawl is 40 days old",
    "Grounding: a second one",
  ]),
  {
    grounding: ["grounding: Ramp's crawl is 40 days old", "Grounding: a second one"],
    pieces: ["pillar: never named a partner"],
  },
  "warnings split by the grounding label, order kept",
);
assertEqual(appendUnique(["a"], ["a", "b", "b"]), ["a", "b"], "appendUnique adds each new item once");
{
  const prev = ["a"];
  if (appendUnique(prev, ["a"]) !== prev) {
    throw new Error("appendUnique returns the same list when nothing is new");
  }
}

// GF6: the run log prints no identifier. A GUID-valued field goes, a GUID inside prose is replaced,
// a long string is cut and its length said, and everything else stays.
const summary = summarizeEventPayload(
  JSON.stringify({
    createId: "0f8fad5b-d9cb-469f-a165-70867728950e",
    provider: "Anthropic",
    note: "job 7c9e6679-7425-40de-944b-e07fc1f90ae7 not found",
    prompt: "x".repeat(1000),
    ids: ["0f8fad5b-d9cb-469f-a165-70867728950e", "keep"],
  }),
);
if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(summary)) {
  throw new Error(`the summary still carries a GUID:\n${summary}`);
}
if (summary.includes("createId")) throw new Error("a GUID-valued field is left out, not shown blank");
if (!summary.includes('"provider": "Anthropic"')) throw new Error("other fields stay");
if (!summary.includes("job (id) not found")) throw new Error("a GUID inside prose is replaced");
if (!summary.includes("… (1000 chars)")) throw new Error("a long string is cut and its length said");
if (!summary.includes('"keep"')) throw new Error("array entries that are not GUIDs stay");
assertEqual(
  summarizeEventPayload("not json 0f8fad5b-d9cb-469f-a165-70867728950e"),
  "not json (id)",
  "a payload that is not JSON is shown as text without its identifiers",
);

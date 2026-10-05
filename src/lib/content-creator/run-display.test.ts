import { draftWrittenLabel, runSavedLine, savedByRun, timeOfDay } from "./run-display.ts";

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

assertEqual(runSavedLine(6), "It saved 6 drafts. The first is open below.", "a run that saved several");
assertEqual(runSavedLine(1), "It saved 1 draft. It is open below.", "a run that saved one");
assertEqual(runSavedLine(0), "It saved no drafts.", "a run that finished with every page refused");

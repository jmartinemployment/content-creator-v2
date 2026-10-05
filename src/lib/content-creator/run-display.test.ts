import { draftWrittenLabel, draftsFromRun, runSavedLine, timeOfDay } from "./run-display.ts";

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

// The afternoon run on "test": new drafts beside the morning's, listed newest first.
const before = new Set(["pillar-am", "blog-am", "tool-am"]);
assertEqual(
  draftsFromRun(
    [{ id: "tool-pm" }, { id: "blog-pm" }, { id: "pillar-pm" }, { id: "tool-am" }, { id: "blog-am" }, { id: "pillar-am" }],
    before,
  ).map((d) => d.id),
  ["tool-pm", "blog-pm", "pillar-pm"],
  "the drafts a run saved are the ones that were not there before it, newest first",
);
// The 2:11 PM run was refused and saved nothing: there is no new draft to move to.
assertEqual(
  draftsFromRun([{ id: "pillar-am" }, { id: "blog-am" }, { id: "tool-am" }], before),
  [],
  "a run that saved nothing leaves the page where it was",
);

assertEqual(runSavedLine(6, false), "It saved 6 drafts. The newest is open below.", "a run that saved several");
assertEqual(runSavedLine(1, false), "It saved 1 draft. It is open below.", "a run that saved one");
assertEqual(runSavedLine(0, false), "It saved no drafts.", "a run that finished with every page refused");
assertEqual(runSavedLine(0, true), "Nothing was saved.", "a failed run saves nothing");
assertEqual(
  runSavedLine(2, true),
  "It saved 2 drafts before it failed. The newest is open below.",
  "a run that failed part-way through saving says what it left",
);

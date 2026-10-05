/**
 * How a Generate run and the drafts it writes are told apart on the page.
 *
 * 2026-10-05: a run was started and the page went on showing the drafts from a run eight hours
 * earlier, fully readable, with nothing over them saying a run was in progress. Each Generate writes
 * new drafts beside the old ones, under the same names, so "Pillar" held two pages called the same
 * thing with nothing between them but the order. The old one read as the new one -- "the copy is
 * identical" -- because it was the old one.
 *
 * Two facts fix that, and both are the draft's own: when it was written, and whether it is from the
 * run that just finished.
 */

/**
 * A time of day as the page says it: `2:32 PM`.
 *
 * `timeZone` and `locale` exist for the tests; the page passes neither and gets the reader's own.
 */
export function timeOfDay(at: Date, timeZone?: string, locale?: string): string {
  return at.toLocaleTimeString(locale, { timeZone, hour: "numeric", minute: "2-digit" });
}

/**
 * When a draft was written, as short as it can be said: the time alone for today, the date and the
 * time for any other day. Empty when the time cannot be read -- no label, never a wrong one.
 */
export function draftWrittenLabel(
  writtenAtUtc: string,
  now: Date = new Date(),
  timeZone?: string,
  locale?: string,
): string {
  const written = new Date(writtenAtUtc);
  if (Number.isNaN(written.getTime())) return "";

  const day = (d: Date) =>
    d.toLocaleDateString(locale, { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const time = timeOfDay(written, timeZone, locale);
  if (day(written) === day(now)) return time;

  const date = written.toLocaleDateString(locale, { timeZone, month: "short", day: "numeric" });
  return `${date}, ${time}`;
}

/**
 * The drafts a run saved: the ones on the project now that were not there when it started, in the
 * order given. The server lists drafts newest first, so the first of these is the newest.
 *
 * A run that was refused saves nothing, and then this is empty and the page stays on the draft the
 * operator was reading rather than moving to a different old one.
 */
export function draftsFromRun<T extends { id: string }>(
  drafts: readonly T[],
  idsBeforeTheRun: ReadonlySet<string>,
): T[] {
  return drafts.filter((draft) => !idsBeforeTheRun.has(draft.id));
}

/**
 * What a run left behind, in a sentence -- the answer to "did anything change?".
 *
 * A run whose types all pass saves every draft together at the end; one that fails saves none. So
 * "saved no drafts" after a failure is the expected outcome, and after a success it means every
 * page was refused, each by name, in the list under it.
 */
export function runSavedLine(saved: number, failed: boolean): string {
  if (saved === 0) return failed ? "Nothing was saved." : "It saved no drafts.";
  const count = saved === 1 ? "1 draft" : `${saved} drafts`;
  const where = saved === 1 ? "It is open below." : "The newest is open below.";
  return failed ? `It saved ${count} before it failed. ${where}` : `It saved ${count}. ${where}`;
}

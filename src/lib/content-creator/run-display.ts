/**
 * How a Generate run and the drafts it writes are told apart on the page.
 *
 * 2026-10-05: a run was started and the page went on showing the drafts from a run eight hours
 * earlier, fully readable, with nothing over them saying a run was in progress. Each Generate writes
 * new drafts beside the old ones, under the same names, so "Pillar" held two pages called the same
 * thing with nothing between them but the order. The old one read as the new one -- "the copy is
 * identical" -- because it was the old one.
 *
 * Two facts fix that: when a draft was written, which is the draft's own, and what the run that
 * just finished saved, which the run records.
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
 * The drafts a finished run saved, as the run itself recorded them: the ids of the pages it wrote,
 * in the order it wrote them. Null when the record carries no such list or will not parse -- which
 * is "not known", and nothing is then claimed about what the run saved.
 *
 * Read from the run's own result rather than worked out by comparing the project's drafts before
 * and after. A Generate rewrites a project's existing pages as new versions, so a run that rewrote
 * six pages leaves no new draft to find and a before-and-after comparison reports that it saved
 * nothing.
 *
 * Two shapes, both the server's: `{ created: [{ artifact, version }, ...] }`, and a bare
 * `{ artifact, version }` when the run wrote exactly one piece with nothing else to report.
 */
export function savedByRun(resultJson: string | null | undefined): string[] | null {
  if (!resultJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultJson);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const idOf = (piece: unknown): string | null => {
    if (!piece || typeof piece !== "object") return null;
    const artifact = (piece as { artifact?: unknown }).artifact;
    if (!artifact || typeof artifact !== "object") return null;
    const id = (artifact as { id?: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : null;
  };

  const created = (parsed as { created?: unknown }).created;
  if (Array.isArray(created)) {
    const ids = created.map(idOf);
    // A list with a piece that names no page is not a list this can vouch for.
    return ids.every((id): id is string => id !== null) ? ids : null;
  }

  const only = idOf(parsed);
  return only === null ? null : [only];
}

/**
 * What a finished run left behind, in a sentence -- the answer to "did anything change?".
 *
 * A run saves every draft together at the end, so "saved no drafts" means every page it tried was
 * refused, each by name, in the list under it.
 */
export function runSavedLine(saved: number): string {
  if (saved === 0) return "It saved no drafts.";
  return saved === 1 ? "It saved 1 draft. It is open below." : `It saved ${saved} drafts. The first is open below.`;
}

/**
 * A project's last Generate, as the page says it when it opens: that it ended, when, and what it
 * left -- the lines that used to exist only while the page that watched the run stayed open.
 *
 * Not "open below": on a page that has just loaded, nothing was opened by that run.
 */
export function lastRunLines(
  run: { status: string; finishedAtUtc?: string | null; resultJson?: string | null; error?: string | null },
  now: Date = new Date(),
  timeZone?: string,
  locale?: string,
): string[] {
  const when = run.finishedAtUtc ? draftWrittenLabel(run.finishedAtUtc, now, timeZone, locale) : "";
  const at = when ? ` at ${when}` : "";

  if (run.status === "failed") {
    return [`The last Generate failed${at}: ${run.error?.trim() || "no reason was recorded."}`];
  }

  const saved = savedByRun(run.resultJson);
  if (saved === null) return [`The last Generate finished${at}.`];
  const count = saved.length === 0 ? "no drafts" : saved.length === 1 ? "1 draft" : `${saved.length} drafts`;
  return [`The last Generate finished${at}. It saved ${count}.`];
}


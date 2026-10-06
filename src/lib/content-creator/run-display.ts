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

import type { GccPartnerToolReadiness } from "@/services/workflow-tools-hub";

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
 * A run's record, read the way the server spells it.
 *
 * The contract says camelCase (`plans/project-api-contract.md` §1), and the hub's live events are.
 * The record is not: GeekAPI stores the job's result with `JsonSerializer.Serialize(result)` and no
 * options (`GccJobsAndSeo.cs:48` at `5671288`), so the field names declared on the anonymous
 * result (`created`, `refusals`, `preflight`, `warnings`) come through as declared, while every
 * record and entity inside them -- the partner readiness rows, the saved artifact and version --
 * comes through as C# declares it: `ProductName`, `Ready`, `PopulatedCategories`, `Id`.
 *
 * On 2026-10-06 the page read that record through the hub's type and printed, for the Accounts
 * Payable run of the day before, "✗ — undefined categories, undefined pages extracted" five times
 * under "0 of 5 can be grounded", on a run that had written four tool pages; and "The last Generate
 * finished at 2:32 PM." with no count, because `artifact.id` was `artifact.Id`.
 *
 * So every key is read with its first letter lowered, which is the identity on a camelCase key and
 * the contract's spelling on a PascalCase one. Nothing is inferred and nothing is defaulted: a
 * field that is absent under both spellings is absent.
 */
function lowerFirst(key: string): string {
  return key.length === 0 ? key : key[0].toLowerCase() + key.slice(1);
}

function camelKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelKeys);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[lowerFirst(key)] = camelKeys(inner);
  }
  return out;
}

/**
 * One partner's row of the recorded pre-flight, as the hub's `GccPartnerToolReadiness` has it. A
 * row missing any field the page prints is not a row the page can print; null, and the record's
 * pre-flight is then not known.
 */
function partnerRow(value: unknown): GccPartnerToolReadiness | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const str = (k: string) => (typeof row[k] === "string" ? (row[k] as string) : null);
  const bool = (k: string) => (typeof row[k] === "boolean" ? (row[k] as boolean) : null);
  const num = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : null);

  const productName = str("productName");
  const host = str("host");
  const ready = bool("ready");
  const coverage = str("coverage");
  const pagesAttempted = num("pagesAttempted");
  const pagesFailed = num("pagesFailed");
  const populatedCategories = num("populatedCategories");
  const hasCapabilitySignal = bool("hasCapabilitySignal");
  if (
    productName === null ||
    host === null ||
    ready === null ||
    coverage === null ||
    pagesAttempted === null ||
    pagesFailed === null ||
    populatedCategories === null ||
    hasCapabilitySignal === null
  ) {
    return null;
  }

  const out: GccPartnerToolReadiness = {
    productName,
    host,
    ready,
    coverage,
    pagesAttempted,
    pagesFailed,
    populatedCategories,
    hasCapabilitySignal,
  };
  const totalCategories = num("totalCategories");
  if (totalCategories !== null) out.totalCategories = totalCategories;
  const reused = bool("reused");
  if (reused !== null) out.reused = reused;
  if (typeof row.bankedAtUtc === "string" || row.bankedAtUtc === null) {
    out.bankedAtUtc = row.bankedAtUtc as string | null;
  }
  return out;
}

/**
 * What a run recorded: the pages it saved, what it refused by name, the gaps it saved with, and the
 * partner pre-flight that decided the tool pages. Null when there is no record or it will not parse.
 *
 * Each list is `null` when the record does not carry it -- "not known" -- and never an empty list
 * standing in for one: a record with no `preflight` field and a record whose pre-flight had no
 * partners are different facts, and the page says different things for them.
 *
 * Two shapes, both the server's: `{ created: [{ artifact, version }, ...], refusals, preflight,
 * warnings }`, and a bare `{ artifact, version }` when the run wrote exactly one piece with nothing
 * else to report.
 */
export type RunRecord = {
  savedIds: string[] | null;
  refusals: string[] | null;
  warnings: string[] | null;
  preflight: GccPartnerToolReadiness[] | null;
};

export function runRecord(resultJson: string | null | undefined): RunRecord | null {
  if (!resultJson) return null;
  let parsed: unknown;
  try {
    parsed = camelKeys(JSON.parse(resultJson));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;

  const idOf = (piece: unknown): string | null => {
    if (!piece || typeof piece !== "object") return null;
    const artifact = (piece as { artifact?: unknown }).artifact;
    if (!artifact || typeof artifact !== "object") return null;
    const id = (artifact as { id?: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : null;
  };

  let savedIds: string[] | null;
  if (Array.isArray(record.created)) {
    const ids = record.created.map(idOf);
    // A list with a piece that names no page is not a list this can vouch for.
    savedIds = ids.every((id): id is string => id !== null) ? ids : null;
  } else {
    const only = idOf(record);
    savedIds = only === null ? null : [only];
  }

  const strings = (value: unknown): string[] | null =>
    Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : null;

  let preflight: GccPartnerToolReadiness[] | null = null;
  if (Array.isArray(record.preflight)) {
    const rows = record.preflight.map(partnerRow);
    preflight = rows.every((r): r is GccPartnerToolReadiness => r !== null) ? rows : null;
  }

  return {
    savedIds,
    refusals: strings(record.refusals),
    warnings: strings(record.warnings),
    preflight,
  };
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
 */
export function savedByRun(resultJson: string | null | undefined): string[] | null {
  return runRecord(resultJson)?.savedIds ?? null;
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


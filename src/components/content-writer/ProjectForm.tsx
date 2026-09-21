"use client";

import { useMemo, useState } from "react";
import { createProject, ApiError, type GccProject } from "@/services/gcc-projects-api";
import { checkHostsIndexed, type HostIndexed } from "@/services/gcc-api";

/** One URL per line; blanks dropped. Parsing only — validity is the index's answer. */
function parseLines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

/** Today as "YYYY-MM-DD" in the operator's own timezone, which is the day they mean. */
function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Whether an index exists for each entered URL. Green yes, red no.
 *
 * One check, because it subsumes the rest: a URL that will not parse was never crawled, so no index
 * can exist for it, and it lands red beside a well-formed URL that was never crawled. The operator
 * does the same thing about both.
 */
function IndexReport({
  urls,
  results,
  checking,
  error,
}: {
  urls: string[];
  results: Record<string, HostIndexed>;
  checking: boolean;
  error: string | null;
}) {
  if (urls.length === 0) return null;
  if (checking) return <p className="text-xs text-muted">Checking the index…</p>;
  if (error) return <p className="text-xs text-red-600">{error}</p>;

  const seen = urls.filter((u) => results[u] !== undefined);
  if (seen.length === 0) return null;

  return (
    <div className="space-y-1 text-xs font-normal">
      {seen.map((u) => {
        const r = results[u];
        return (
          <p key={u} className={r.indexed ? "text-green-700" : "text-red-600"}>
            <span className="font-mono">{u}</span> —{" "}
            {r.indexed ? "indexed" : "no index — crawl it first"}
            {r.indexed && !r.runId ? (
              <span className="text-red-600"> · no run id — nothing to read</span>
            ) : null}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Start a project for this client.
 *
 * A project is an engagement: a name, a schedule, and the site it targets. It is no longer a target
 * keyword — two pieces of content about one keyword are two pieces of content under one project,
 * and the keyword belongs to the create, not here.
 *
 * Nothing here crawls. Content Creator passes a Run ID; crawling is Geek-Crawler-v2's.
 */
export default function ProjectForm({
  clientId,
  onCreated,
}: {
  clientId: string;
  onCreated: (project: GccProject) => void;
}) {
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Declared partners and competitors, saved with the project. The index check beside each one
  // reports whether a crawl exists; it does not gate the declaration. A partner the client really
  // has, with no crawl yet, is a fact worth recording — and the gap between what is declared and
  // what is crawled is exactly the thing worth being able to see.
  const [partnerSeeds, setPartnerSeeds] = useState("");
  const [competitorSeeds, setCompetitorSeeds] = useState("");
  const [indexed, setIndexed] = useState<Record<string, HostIndexed>>({});
  const [checkingIndex, setCheckingIndex] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  /**
   * One key per form, minted when it opens.
   *
   * This is what makes a second click of Create Project return the project the first click made
   * instead of a duplicate. It is regenerated after a successful create, so the next project the
   * operator starts is a new one rather than a repeat of the last.
   */
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  // A new client is a new form — the page remounts this component with a key of the client id.
  // Resetting the fields in an effect instead would carry one client's typing into the next for a
  // render, and would carry the idempotency key with it: the first create under the new client
  // would then resolve to the project made under the old one.

  const siteUrls = useMemo(() => parseLines(siteUrl), [siteUrl]);
  const partnerUrls = useMemo(() => parseLines(partnerSeeds), [partnerSeeds]);
  const competitorUrls = useMemo(() => parseLines(competitorSeeds), [competitorSeeds]);

  // The Run ID for the project site. The index check already returns it; nothing else resolves one.
  const siteRow = siteUrls[0] ? indexed[siteUrls[0]] : undefined;
  const projectSiteRunId = siteRow?.indexed ? siteRow.runId : null;

  async function checkIndex(urls: string[]) {
    const pending = urls.filter((u) => indexed[u] === undefined);
    if (pending.length === 0) return;
    setCheckingIndex(true);
    setIndexError(null);
    try {
      const rows = await checkHostsIndexed(pending);
      setIndexed((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.url] = r;
        return next;
      });
    } catch (e) {
      // The check failing is not a verdict on the URL. Leave it unmarked rather than red.
      setIndexError(e instanceof Error ? e.message : "Could not reach the index.");
    } finally {
      setCheckingIndex(false);
    }
  }

  const canSubmit =
    name.trim().length > 0 && startDate.length > 0 && Boolean(projectSiteRunId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const project = await createProject({
        clientId,
        idempotencyKey,
        name,
        startDate,
        dueDate: dueDate || null,
        description: description.trim() || null,
        siteUrl: siteUrls[0] ?? null,
        projectSiteRunId,
        partnerUrls,
        competitorUrls,
      });

      // A fresh key, so the next project started here is a new one rather than a repeat of this.
      setIdempotencyKey(crypto.randomUUID());
      onCreated(project);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          "That submission belongs to another client's project. Reload the page to start a clean one.",
        );
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Your sign-in predates project access. Sign out and back in, then try again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not create the project.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "rounded-md border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  /**
   * Enter in any single-line field natively submits the form — standard browser behaviour with no
   * opt-out short of this. Harmless on most forms; a real problem here specifically, because a
   * successful submit deliberately leaves every field filled (so the operator can see what they
   * just created) and mints a fresh idempotency key for whatever comes next. Put those two together
   * and every stray Enter after a successful create — typing a description, tabbing through
   * fields, an old habit from a search box — resubmits the still-valid form under a brand new key,
   * which is not a duplicate the server can catch: it is a distinct, deliberate-looking create. The
   * idempotency key only ever protected against repeating one submission, never against a run of
   * genuinely new ones each triggered by a keystroke nobody meant as a submit.
   *
   * Textareas are excluded: Enter there inserts a newline, which is what Partner/Competitor URLs
   * need for one URL per line. The submit button is excluded too: a keyboard-only operator tabbing
   * to "Create Project" and pressing Enter there is the deliberate submit action, not a stray
   * keystroke, and blocking it would trade one accessibility problem for another.
   */
  function blockEnterSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
    if (
      e.key === "Enter" &&
      e.target instanceof HTMLElement &&
      e.target.tagName !== "TEXTAREA" &&
      e.target.tagName !== "BUTTON"
    ) {
      e.preventDefault();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={blockEnterSubmit}
      className="rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-foreground">New Project</h2>
      <p className="mt-1 text-sm text-muted">
        A project is one engagement for this client: a name, a schedule, and the site it targets.
        Content Creator does not crawl — Geek-Crawler does. Each URL below is checked against the
        index when you leave the field, to confirm evidence already exists.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
          Project Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Q4 content programme"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
          Site URL
          <input
            required
            type="url"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            onBlur={() => void checkIndex(siteUrls)}
            placeholder="https://client-site.com"
            className={inputClass}
          />
          <IndexReport
            urls={siteUrls}
            results={indexed}
            checking={checkingIndex}
            error={indexError}
          />
          {projectSiteRunId ? (
            <span className="break-all text-xs font-normal text-muted">
              Run <span className="font-mono">{projectSiteRunId}</span> — the crawl this project&apos;s
              content will be grounded on.
            </span>
          ) : null}
        </label>

        {/* mt-auto on both inputs: Due Date's helper line makes its cell taller, and grid cells
            stretch to the tallest in the row, so Start Date's input would otherwise sit one line
            above Due Date's. Bottom-aligning both is what puts them on the same row regardless —
            the same fix already applied to the brief form's paired fields. */}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Start Date
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`${inputClass} mt-auto`}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Due Date
          <span className="text-xs font-normal text-muted">Optional. Never before the start date.</span>
          <input
            type="date"
            value={dueDate}
            min={startDate || undefined}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${inputClass} mt-auto`}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
          Description
          <span className="text-xs font-normal text-muted">Optional. What this engagement is for.</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="mt-6 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium text-foreground">
          Partners &amp; competitors
        </legend>
        <p className="mb-3 text-xs text-muted">
          Saved with the project. Each is checked against the index as you leave the field — a red
          line means no crawl exists for it yet, which is worth knowing but does not stop you
          declaring it.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Partner URLs
            <span className="text-xs font-normal text-muted">Products you sell or recommend.</span>
            <textarea
              value={partnerSeeds}
              onChange={(e) => setPartnerSeeds(e.target.value)}
              onBlur={() => void checkIndex(partnerUrls)}
              rows={4}
              placeholder={"https://partner.example/pricing\nhttps://partner.example/docs"}
              className={`${inputClass} font-mono text-xs`}
            />
            <IndexReport
              urls={partnerUrls}
              results={indexed}
              checking={checkingIndex}
              error={indexError}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Competitor URLs
            <span className="text-xs font-normal text-muted">Rivals writing on the same topics.</span>
            <textarea
              value={competitorSeeds}
              onChange={(e) => setCompetitorSeeds(e.target.value)}
              onBlur={() => void checkIndex(competitorUrls)}
              rows={4}
              placeholder={"https://rival.example/services\nhttps://rival.example/about"}
              className={`${inputClass} font-mono text-xs`}
            />
            <IndexReport
              urls={competitorUrls}
              results={indexed}
              checking={checkingIndex}
              error={indexError}
            />
          </label>
        </div>
      </fieldset>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create Project"}
        </button>
        {/* The refusal, at the point of action and with its reason. A project with no Run ID has no
            crawl to ground on, and creating one would only defer the failure to generate time. */}
        {!projectSiteRunId ? (
          <span className="text-xs text-amber-800">
            Enter a site URL with crawl evidence — the Run ID is what the content is grounded on.
          </span>
        ) : null}
      </div>
    </form>
  );
}

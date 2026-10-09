"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createProject,
  updateProject,
  ApiError,
  type GccProject,
} from "@/services/gcc-projects-api";
import { checkHostsIndexed, type DeclaredUrlList, type HostIndexed } from "@/services/gcc-api";
import { declaredUrls, unindexedUrls } from "@/lib/declared-url-gate";

/** The three URL fields, each with its own check state so one field's error is not shown on all. */
type FieldKey = "site" | "partner" | "competitor";

/**
 * The list each field is, as the index names it. Sent with every check: a URL is usable as a member
 * of the list it is entered in, because that is how Generate searches its crawl.
 */
const LIST: Record<FieldKey, DeclaredUrlList> = {
  site: "project-site",
  partner: "partner",
  competitor: "competitors",
};

/**
 * The index's answers, per field. Not one map for the form: the same URL entered as a partner and as
 * a competitor is two questions with two answers.
 */
type Answers = Record<FieldKey, Record<string, HostIndexed>>;

const NO_ANSWERS: Answers = { site: {}, partner: {}, competitor: {} };

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
 * What the index says about each entered URL. Green it can be written from; amber it cannot yet, with
 * the server's reason — which also covers a crawl whose index is still running.
 *
 * One check, because it subsumes the rest: a URL that will not parse was never crawled, so no index
 * can exist for it, and it lands amber beside a well-formed URL that was never crawled. The operator
 * does the same thing about both.
 *
 * It reports and offers no action, which is the point: this app starts no crawl, and the line does
 * not decide whether the project saves. The project is saved with every URL declared; Generate is
 * what refuses one that cannot be written from, so the line says that rather than "excluded".
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
        if (r.usable) {
          return (
            <p key={u} className="text-green-700">
              <span className="font-mono">{u}</span> — indexed · {r.pages ?? 0} pages,{" "}
              {r.chunks ?? 0} chunks
            </p>
          );
        }

        const reason = r.reason ?? "cannot be written from";
        return (
          <p key={u} className="text-amber-700">
            <span className="font-mono">{u}</span> — {reason} · not usable yet; Generate refuses
            until it is
          </p>
        );
      })}
    </div>
  );
}

/**
 * Start a project for this client. Embedded in ProjectsPanel, behind its "+ New Project" toggle —
 * not a standalone sibling on the page, the same way ClientsPanel owns creating a client rather
 * than leaving that to whatever renders it.
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
  project,
}: {
  clientId: string;
  /** Called with the created project, or the updated one when editing. */
  onCreated: (project: GccProject) => void;
  /**
   * An existing project to edit. Omit to create a new one.
   *
   * Edit runs through this form rather than a second URL editor on purpose: the index feedback
   * beside each URL, and the Run ID the site's answer carries, are the same here as on create. A
   * separate editor would either duplicate that or, far more likely, skip it.
   */
  project?: GccProject;
}) {
  const editing = project !== undefined;

  const [name, setName] = useState(project?.name ?? "");
  const [siteUrl, setSiteUrl] = useState(project?.siteUrl ?? "");
  const [startDate, setStartDate] = useState(project?.startDate ?? today);
  const [dueDate, setDueDate] = useState(project?.dueDate ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Declared partners and competitors, saved with the project as declared. Whether each has a crawl
  // behind it is the index's answer, shown on its line as it is entered and asked again when
  // Generate is pressed -- Generate refuses until every declared URL can be written from. Declaring
  // one is what obliges the writer to name it. One per line, which is the shape the textareas take
  // and the shape the lists are stored in.
  const [partnerSeeds, setPartnerSeeds] = useState((project?.partnerUrls ?? []).join("\n"));
  const [competitorSeeds, setCompetitorSeeds] = useState((project?.competitorUrls ?? []).join("\n"));
  const [indexed, setIndexed] = useState<Answers>(NO_ANSWERS);
  // Per field, not per form. One shared pair of flags meant a check on the site URL rendered
  // "Checking the index…" under partners and competitors too, which with the gate live would
  // misreport which field is blocking.
  const [checking, setChecking] = useState<Record<FieldKey, boolean>>({
    site: false,
    partner: false,
    competitor: false,
  });
  const [indexErrors, setIndexErrors] = useState<Record<FieldKey, string | null>>({
    site: null,
    partner: null,
    competitor: null,
  });

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
  //
  // Gated on `usable`, not `indexed`. Those are different questions -- a crawl blocked at its first
  // page is indexed and gives a writer nothing -- and asking the weaker one here while every other
  // line asks the stronger one let a site read green, hand over a Run ID, and still be refused by
  // the server. One row, one verdict.
  const siteRow = siteUrls[0] ? indexed.site[siteUrls[0]] : undefined;
  const projectSiteRunId = siteRow?.usable ? siteRow.runId : null;

  /**
   * Ask the index about anything in `urls` that `known` has no answer for, and return the answers
   * including whatever came back.
   *
   * It returns the merged map rather than relying on the `indexed` state because submit asks about
   * three fields in a row: React has not re-rendered between them, so reading state would decide on
   * answers two calls out of date.
   */
  async function resolveAnswers(
    field: FieldKey,
    urls: string[],
    known: Answers,
  ): Promise<Answers> {
    const pending = urls.filter((u) => known[field][u] === undefined);
    if (pending.length === 0) return known;
    setChecking((prev) => ({ ...prev, [field]: true }));
    setIndexErrors((prev) => ({ ...prev, [field]: null }));
    try {
      const rows = await checkHostsIndexed(pending, LIST[field]);
      const merged: Answers = { ...known, [field]: { ...known[field] } };
      for (const r of rows) merged[field][r.url] = r;
      // Functional update: another field's check may have landed while this one was in flight.
      setIndexed((prev) => {
        const next: Answers = { ...prev, [field]: { ...prev[field] } };
        for (const r of rows) next[field][r.url] = r;
        return next;
      });
      return merged;
    } catch (e) {
      // The check failing is not a verdict on the URL. It stays unanswered, which the gate reads as
      // "unchecked" -- it still blocks, but it blames the index rather than the URL.
      setIndexErrors((prev) => ({
        ...prev,
        [field]: e instanceof Error ? e.message : "Could not reach the index.",
      }));
      return known;
    } finally {
      setChecking((prev) => ({ ...prev, [field]: false }));
    }
  }

  /** Ask the index again for URLs already answered, so a finished crawl can turn one green. */
  async function recheck(field: FieldKey, urls: string[]) {
    const without = (answers: Answers): Answers => ({
      ...answers,
      [field]: Object.fromEntries(
        Object.entries(answers[field]).filter(([u]) => !urls.includes(u)),
      ),
    });
    setIndexed(without);
    await resolveAnswers(field, urls, without(indexed));
  }

  // What the index has said so far, for the lines and the note beside the button. Nothing here
  // decides whether the project saves: it is saved with every URL declared, and Generate is what
  // refuses a URL that cannot be written from. Until 2026-10-09 these decided the save -- the floor
  // of five was measured on the usable URLs and the rest were dropped from the project -- so a
  // partner whose crawl was still being indexed was enough to disable Create.
  //
  // Re-check is the only action a URL without evidence has, the site included: a crawl that
  // finishes while the form is open could not otherwise be picked up without reloading.
  const recheckable: Record<FieldKey, string[]> = {
    site: unindexedUrls(siteUrls, indexed.site),
    partner: unindexedUrls(partnerUrls, indexed.partner),
    competitor: unindexedUrls(competitorUrls, indexed.competitor),
  };
  const withoutEvidence = [...recheckable.site, ...recheckable.partner, ...recheckable.competitor];
  const anyRecheckable = withoutEvidence.length > 0;

  // How many URLs the note beside the button counts. Nothing here gates the save. The only
  // requirements are the name, the start date and the site URL, and those inputs are `required`, so
  // the browser names the empty one. The five-of-each floor went on 2026-10-09 (Jeff: "Create
  // Project being disabled wastes my time, disable this blocking"); Generate names every declared
  // partner, however many there are.
  const declaredCount =
    declaredUrls(siteUrls).length + declaredUrls(partnerUrls).length + declaredUrls(competitorUrls).length;

  // Edit mode arrives with URLs already declared and nothing blurred, so `indexed` is empty on mount
  // and every line would be blank. This asks the index the same question a blur asks, at the one
  // moment the operator has no reason to trigger it, so each URL shows where it stands before they
  // decide what to change. Nothing here gates the save.
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    void (async () => {
      let answers = indexed;
      answers = await resolveAnswers("site", siteUrls, answers);
      if (cancelled) return;
      answers = await resolveAnswers("partner", partnerUrls, answers);
      if (cancelled) return;
      await resolveAnswers("competitor", competitorUrls, answers);
    })();
    return () => {
      cancelled = true;
    };
    // Once per mounted edit form. The URL lists are seeded from the project and the operator's own
    // edits re-check on blur, so re-running this on every keystroke would be a request per character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (name.trim().length === 0 || startDate.length === 0) return;
    setError(null);

    // Nothing is asked of the index here. The project is saved with every URL declared; whether
    // each can be written from is Generate's question, asked when Generate is pressed. Until
    // 2026-10-09 this asked three times and refused on the answers, so a site whose crawl was still
    // being indexed, or an index that was briefly unreachable, made the Profile unsaveable.
    setIsSubmitting(true);
    try {
      // The same payload either way: the declared lists, cleaned, and the site Run ID when the index
      // has already answered for it -- null otherwise, and Generate resolves and stores it.
      const saved = editing
        ? await updateProject(project.id, {
            name,
            startDate,
            code: project.code,
            description: description.trim() || null,
            siteUrl: siteUrls[0] ?? null,
            projectSiteRunId,
            department: project.department,
            partnerUrls: declaredUrls(partnerUrls),
            competitorUrls: declaredUrls(competitorUrls),
            dueDate: dueDate || null,
            estimatedHours: project.estimatedHours,
            budget: project.budget,
            budgetCurrency: project.budgetCurrency,
            // Carried through unchanged. The PUT replaces the row, and the server assigns both
            // unconditionally, so omitting them would blank the project's status -- which is managed in
            // the profile panel, not here.
            status: project.status,
            finishedDate: project.finishedDate,
          })
        : await createProject({
            clientId,
            idempotencyKey,
            name,
            startDate,
            dueDate: dueDate || null,
            description: description.trim() || null,
            siteUrl: siteUrls[0] ?? null,
            projectSiteRunId,
            partnerUrls: declaredUrls(partnerUrls),
            competitorUrls: declaredUrls(competitorUrls),
          });

      // A fresh key, so the next project started here is a new one rather than a repeat of this.
      // Harmless when editing, which does not use it.
      setIdempotencyKey(crypto.randomUUID());
      onCreated(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          "That submission belongs to another client's project. Reload the page to start a clean one.",
        );
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Your sign-in predates project access. Sign out and back in, then try again.");
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : `Could not ${editing ? "save" : "create"} the project.`,
        );
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
    <form onSubmit={handleSubmit} onKeyDown={blockEnterSubmit}>
      {/* No heading of its own — embedded in ProjectsPanel, under its "+ New Project" toggle,
          the same way ClientsPanel's inline create form has none either. */}
      <p className="text-sm text-muted">
        A project is one engagement for this client: a name, a schedule, and the site it targets.
      </p>
      <p className="mt-1 text-sm text-muted">
        This app starts no crawl; start one in Geek-Crawler-v2, then re-check here.
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
          <span className="text-xs font-normal text-muted">
            The site this content must not duplicate. Crawl it in Geek-Crawler-v2 as{" "}
            <span className="font-mono">project-site</span>.
          </span>
          <input
            required
            type="url"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            onBlur={() => void resolveAnswers("site", siteUrls, indexed)}
            placeholder="https://client-site.com"
            className={inputClass}
          />
          <IndexReport
            urls={siteUrls}
            results={indexed.site}
            checking={checking.site}
            error={indexErrors.site}
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
          Saved with the project as declared, however many. Every URL here is checked against the
          index as you leave the field; an amber line is one that cannot be written from yet, and
          the project still saves. Generate is what refuses until every declared URL has a usable
          crawl, because declaring a partner is what obliges the writer to name it. Being indexed is
          not enough: a crawl that was blocked at its first page still puts a row in the index and
          gives the writer nothing, so each line shows the pages and chunks behind it. Crawl an amber
          one in Geek-Crawler-v2 as <span className="font-mono">partner</span> or{" "}
          <span className="font-mono">competitors</span>, one URL per crawl — so those counts
          describe that host and not a batch it was bundled into.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Partner URLs
            <span className="text-xs font-normal text-muted">
              Products you sell or recommend. One per line.
            </span>
            <textarea
              value={partnerSeeds}
              onChange={(e) => setPartnerSeeds(e.target.value)}
              onBlur={() => void resolveAnswers("partner", partnerUrls, indexed)}
              rows={4}
              placeholder={"https://partner.example/pricing\nhttps://partner.example/docs"}
              className={`${inputClass} font-mono text-xs`}
            />
            <IndexReport
              urls={partnerUrls}
              results={indexed.partner}
              checking={checking.partner}
              error={indexErrors.partner}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Competitor URLs
            <span className="text-xs font-normal text-muted">
              Rivals writing on the same topics. One per line.
            </span>
            <textarea
              value={competitorSeeds}
              onChange={(e) => setCompetitorSeeds(e.target.value)}
              onBlur={() => void resolveAnswers("competitor", competitorUrls, indexed)}
              rows={4}
              placeholder={"https://rival.example/services\nhttps://rival.example/about"}
              className={`${inputClass} font-mono text-xs`}
            />
            <IndexReport
              urls={competitorUrls}
              results={indexed.competitor}
              checking={checking.competitor}
              error={indexErrors.competitor}
            />
          </label>
        </div>
      </fieldset>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Disabled only while a submit is in flight. The required inputs are the browser's to
            name; the index is information beside each URL and never a reason this cannot be pressed. */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          {isSubmitting
            ? editing
              ? "Saving..."
              : "Creating..."
            : editing
              ? "Save changes"
              : "Create Project"}
        </button>
        {/* Where the declared URLs stand with the index, as a count. Not a refusal: the project saves
            as declared, and Generate is what refuses until each has a usable crawl. Re-check covers
            all three fields, the site included, so a crawl that finishes while the form is open is
            picked up without reloading. */}
        {anyRecheckable ? (
          <span className="text-xs text-muted">
            {withoutEvidence.length} of {declaredCount} URLs not usable yet — saves as declared;
            Generate refuses until each has a usable crawl.{" "}
            <button
              type="button"
              onClick={() => {
                void recheck("site", recheckable.site);
                void recheck("partner", recheckable.partner);
                void recheck("competitor", recheckable.competitor);
              }}
              className="underline decoration-dotted underline-offset-2"
            >
              Re-check the index
            </button>
          </span>
        ) : null}
      </div>
    </form>
  );
}

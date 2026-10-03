"use client";

import { useMemo, useState } from "react";
import {
  createProject,
  updateProject,
  ApiError,
  type GccProject,
} from "@/services/gcc-projects-api";
import { checkHostsIndexed, startGeekCrawl, type HostIndexed } from "@/services/gcc-api";
import { unindexedUrls, usableUrls } from "@/lib/declared-url-gate";

/** The three URL fields, each with its own check state so one field's error is not shown on all. */
type FieldKey = "site" | "partner" | "competitor";

/** The crawl each field's URLs belong to. One run per URL, so this is per URL, not per batch. */
/**
 * How many URLs each list must carry (Jeff, 2026-09-29). Five is what a pillar names and what a
 * comparison needs to be a comparison; the site is one because it is the page this content must not
 * duplicate. All three pass the same test — only the count differs.
 */
const REQUIRED: Record<FieldKey, number> = { site: 1, partner: 5, competitor: 5 };

const CRAWL_TYPE: Record<FieldKey, "project-site" | "partner" | "competitors"> = {
  site: "project-site",
  partner: "partner",
  competitor: "competitors",
};

/**
 * Start one crawl through GeekAPI, and return the line the operator would read.
 *
 * **Unreachable on purpose since 2026-09-29, and kept so re-pointing it is one call site.**
 * `plans/geekapi-crawls-never-reach-rag.md` has the trace; the short version is that
 * `POST /api/geek-crawler/crawls` wakes a crawler inside the API container which runs no extractor,
 * so the pages it writes carry `Html` and no `blocks`, and the completion patch never stamps
 * `ContentReadyAt`. RAG treats a page without `blocks` as unindexable and its scheduler filters on
 * `ContentReadyAt`, so this call could raise a run id and never raise the pages or chunks the
 * operator is gated on. An action that cannot succeed is worse than none: it reads as the supported
 * way to fix a red line.
 *
 * It is not deleted because the shape is right and only the destination is wrong. When
 * Geek-Crawler-v2 grows a queue-claim path (Option A in that plan), what changes is the route this
 * posts to, and the three call sites that were removed come back as they were.
 *
 * One run, one URL — not a batch of the field's lines. A run's chunk and page counts are the run's,
 * so a run covering five partner hosts can say it indexed four hundred chunks while the one partner
 * you care about contributed none of them.
 *
 * Starting a crawl never made the URL indexed either: it takes minutes, and the index answers only
 * once it finishes. So the line it returns says what it did and leaves the URL red until a re-check
 * says otherwise — the gate is about evidence existing, not about a crawl having been requested.
 */
// Unused is the intended state, per the comment above. Left as a standing lint warning it would
// eventually be "fixed" by deleting, which is the one outcome this is written to prevent.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function crawlOne(field: FieldKey, url: string): Promise<string> {
  try {
    const result = await startGeekCrawl(CRAWL_TYPE[field], url);
    const refused = result.rejected.find((r) => r.raw === url);
    return refused ? `refused: ${refused.reason}` : "crawl started — re-check once it finishes";
  } catch (e) {
    return e instanceof Error ? `could not start: ${e.message}` : "could not start the crawl";
  }
}

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
 *
 * It reports and offers no action, which is the point. A red line used to carry a "Crawl it" button
 * that could never turn it green: the crawl it started ran inside GeekAPI, which writes `Html` and
 * no `blocks` and never stamps `ContentReadyAt`, so RAG had nothing to index and the pages and
 * chunks this line reads stayed null however long the operator waited
 * (`plans/geekapi-crawls-never-reach-rag.md`). Where the crawl does happen is on the field's own
 * helper line, once, because the crawl type is per field and not per URL.
 */
function IndexReport({
  urls,
  results,
  checking,
  error,
  kind,
}: {
  urls: string[];
  results: Record<string, HostIndexed>;
  checking: boolean;
  error: string | null;
  /**
   * What a failure means for this field, which is not the same for all three.
   *
   * `site` is one URL and the project is grounded on its run, so no evidence is a refusal. `list`
   * is partners and competitors, where the floor is five and a sixth without evidence is simply
   * left out — so the line has to say "excluded" rather than imply it has blocked the project.
   */
  kind: "site" | "list";
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
          <p key={u} className={kind === "site" ? "text-red-600" : "text-amber-700"}>
            <span className="font-mono">{u}</span> — {reason}
            {kind === "list" ? " · excluded from this project" : null}
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
   * Edit runs through this form rather than a second URL editor on purpose: the index gate below is
   * the whole value of declaring a URL — every partner and competitor must have an indexed crawl, and
   * the site URL resolves the run the project is grounded on. A separate editor would either
   * duplicate that or, far more likely, skip it and let a partner be saved with no evidence behind it.
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

  // Declared partners and competitors, saved with the project — and every one of them must have a
  // crawl behind it. `plans/validate-partner-competitor-urls.md` has said so since 2026-09-17; the
  // check shipped and the block did not, so a partner could be declared with nothing indexed and
  // the gap only surfaced at generate time, as a refusal reading "a partner with no evidence gives
  // the writer nothing to say about it". Declaring one is what obliges the writer to name it.
  // One per line, which is the shape the textareas take and the shape the lists are stored in.
  const [partnerSeeds, setPartnerSeeds] = useState((project?.partnerUrls ?? []).join("\n"));
  const [competitorSeeds, setCompetitorSeeds] = useState((project?.competitorUrls ?? []).join("\n"));
  const [indexed, setIndexed] = useState<Record<string, HostIndexed>>({});
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
  const siteRow = siteUrls[0] ? indexed[siteUrls[0]] : undefined;
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
    known: Record<string, HostIndexed>,
  ): Promise<Record<string, HostIndexed>> {
    const pending = urls.filter((u) => known[u] === undefined);
    if (pending.length === 0) return known;
    setChecking((prev) => ({ ...prev, [field]: true }));
    setIndexErrors((prev) => ({ ...prev, [field]: null }));
    try {
      const rows = await checkHostsIndexed(pending);
      const merged = { ...known };
      for (const r of rows) merged[r.url] = r;
      // Functional update: another field's check may have landed while this one was in flight.
      setIndexed((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.url] = r;
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
    setIndexed((prev) => {
      const next = { ...prev };
      for (const u of urls) delete next[u];
      return next;
    });
    await resolveAnswers(field, urls, Object.fromEntries(
      Object.entries(indexed).filter(([u]) => !urls.includes(u)),
    ));
  }

  // The affordance. The real gate is in handleSubmit, which asks the index first -- this can only
  // reflect answers already obtained, and pasting a URL then clicking Create never blurs the field.
  // One rule for all three lists. The site used to be gated by a different question -- does the
  // index return a run id for it -- which is the same question wearing a different shape, and two
  // shapes of one rule is how they come to disagree.
  // What the project is saved with, and what the floor of five is measured on. Mirrors
  // GccProjectsController.ResolveDeclaredUrlsAsync, so the form and the server cannot reach
  // different verdicts about the same list.
  const usablePartners = usableUrls(partnerUrls, indexed);
  const usableCompetitors = usableUrls(competitorUrls, indexed);

  // Excluded, not blocking. A URL with no crawl behind it is dropped from the project rather than
  // preventing it, so long as the floor is still met without it -- and dropping it is what keeps
  // the promise the server's docs make, since a declared partner obliges Pillar, Blog and Tool to
  // name it and one with no evidence buys a refusal at generate time instead.
  const excluded = unindexedUrls([...partnerUrls, ...competitorUrls], indexed);

  // Everything currently without an answer the form can act on, the site included. Re-check is the
  // only action these have, and the site has to be in it: it is the field whose Run ID the gate
  // reads, so a project-site crawl that finishes while the form is open could not otherwise be
  // picked up without reloading.
  const recheckable = unindexedUrls([...siteUrls, ...partnerUrls, ...competitorUrls], indexed);

  // Two stages, in the server's order. The declared count costs nothing and can be acted on before
  // the index is asked, and a list already shorter than the floor cannot reach it once the unusable
  // are removed. Only after that does the usable count mean anything: before the index answers it
  // is zero for every field, which is an unanswered question and not a shortfall.
  const declaredShortfalls = (
    [
      ["Project site URL", siteUrls.length, REQUIRED.site],
      ["Partner URLs", partnerUrls.length, REQUIRED.partner],
      ["Competitor URLs", competitorUrls.length, REQUIRED.competitor],
    ] as const
  )
    .filter(([, have, need]) => have < need)
    .map(([label, have, need]) => `${label}: ${have} of ${need}`);

  const evidenceShortfalls = (
    [
      ["Partner URLs", usablePartners.length, REQUIRED.partner],
      ["Competitor URLs", usableCompetitors.length, REQUIRED.competitor],
    ] as const
  )
    .filter(([, have, need]) => have < need)
    .map(([label, have, need]) => `${label}: ${have} of ${need} with usable crawl evidence`);

  const canSubmit =
    name.trim().length > 0 &&
    startDate.length > 0 &&
    Boolean(projectSiteRunId) &&
    declaredShortfalls.length === 0 &&
    evidenceShortfalls.length === 0;

  const blockingReason =
    declaredShortfalls.length > 0
      ? `${declaredShortfalls.join(" · ")} — every one needs its own indexed crawl.`
      : !projectSiteRunId
        ? "Enter a site URL with crawl evidence — the Run ID is what the content is grounded on."
        : evidenceShortfalls.length > 0
          ? `${evidenceShortfalls.join(" · ")}. Without evidence: ${excluded.join(", ")}. Crawl and index them, or declare others.`
          : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (name.trim().length === 0 || startDate.length === 0) return;
    setError(null);

    // The gate, and the reason it is here rather than in `canSubmit`: the index is asked on blur,
    // so pasting URLs and clicking Create submits a form nobody ever checked. Ask first, decide on
    // the answers, and only then create.
    let answers = indexed;
    answers = await resolveAnswers("site", siteUrls, answers);
    answers = await resolveAnswers("partner", partnerUrls, answers);
    answers = await resolveAnswers("competitor", competitorUrls, answers);

    // The site is not one of several. There is exactly one, the project is grounded on its run, and
    // nothing else can stand in for it — so an unusable site URL is a refusal and never an exclusion.
    const siteAnswer = siteUrls[0] ? answers[siteUrls[0]] : undefined;
    const runId = siteAnswer?.usable ? siteAnswer.runId : null;
    if (!runId) {
      setError(
        siteAnswer?.reason
          ? `The project site URL cannot be written from: ${siteAnswer.reason}. It is the crawl this project is grounded on, so nothing else can stand in for it.`
          : "This project has no crawl to ground on. Enter a site URL whose crawl is indexed, then try again.",
      );
      return;
    }

    // Saved with the usable subset, and the floor is measured on it. The ones without evidence are
    // excluded rather than blocking, which is also what stops them obliging a mention at generate
    // time that nothing could satisfy.
    const partnersToSave = usableUrls(partnerUrls, answers);
    const competitorsToSave = usableUrls(competitorUrls, answers);
    const withoutEvidence = unindexedUrls([...partnerUrls, ...competitorUrls], answers);

    if (
      partnersToSave.length < REQUIRED.partner ||
      competitorsToSave.length < REQUIRED.competitor
    ) {
      setError(
        `Partner URLs: ${partnersToSave.length} of ${REQUIRED.partner} · Competitor URLs: ` +
          `${competitorsToSave.length} of ${REQUIRED.competitor} with usable crawl evidence. ` +
          `Without evidence: ${withoutEvidence.join(", ")}. Crawl and index them, or declare others.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Everything above this point -- the index resolution, the site-run refusal, the partner and
      // competitor floors -- applies identically either way. Editing a project cannot be a way to get
      // URLs in that creating one would have rejected.
      const saved = editing
        ? await updateProject(project.id, {
            name,
            startDate,
            code: project.code,
            description: description.trim() || null,
            siteUrl: siteUrls[0] ?? null,
            projectSiteRunId: runId,
            department: project.department,
            partnerUrls: partnersToSave,
            competitorUrls: competitorsToSave,
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
            projectSiteRunId: runId,
            partnerUrls: partnersToSave,
            competitorUrls: competitorsToSave,
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
        Content Creator does not crawl — Geek-Crawler does, from its own submit form, on the machine
        it runs on. Each URL below is checked against the index when you leave the field, to confirm
        that evidence already exists; a red line is a crawl to go and start there, then re-check.
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
            The site this content must not duplicate. Crawl it in Geek-Crawler as{" "}
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
            results={indexed}
            checking={checking.site}
            error={indexErrors.site}
            kind="site"
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
          Saved with the project, and each one must already be crawled. Every URL here is checked
          against the index as you leave the field; a red line means no crawl exists for it yet, and
          the project cannot be created until it does. Declaring a partner is what obliges the
          writer to name it, so a partner with no evidence is a page it has nothing to say about.
          Five of each, and being indexed is not enough: a crawl that was blocked at its first page
          still puts a row in the index and gives the writer nothing, so each line shows the pages
          and chunks behind it. Crawl a red one in Geek-Crawler as{" "}
          <span className="font-mono">partner</span> or <span className="font-mono">competitors</span>
          , one URL per crawl — so those counts describe that host and not a batch it was bundled
          into.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Partner URLs
            <span className="text-xs font-normal text-muted">
              Products you sell or recommend. Five required, one per line.
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
              results={indexed}
              checking={checking.partner}
              error={indexErrors.partner}
              kind="list"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Competitor URLs
            <span className="text-xs font-normal text-muted">
              Rivals writing on the same topics. Five required, one per line.
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
              results={indexed}
              checking={checking.competitor}
              error={indexErrors.competitor}
              kind="list"
            />
          </label>
        </div>
      </fieldset>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
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
        {/* The refusal, at the point of action and with its reason. Creating a project whose
            declared URLs have no crawl behind them only defers the failure to generate time, where
            it surfaces as a draft that cannot be written rather than a field the operator can fix. */}
        {blockingReason ? (
          <span className="text-xs text-amber-800">
            {blockingReason}
            {recheckable.length > 0 ? (
              <>
                {" "}
                {/* All three fields, including the site. Re-check is the only action a URL without
                    evidence has now that the crawl is started in Geek-Crawler, and the site was the
                    one field it skipped — which is the field whose run id the gate actually reads,
                    so a finished project-site crawl could not be picked up without reloading. */}
                <button
                  type="button"
                  onClick={() => {
                    void recheck("site", siteUrls.filter((u) => recheckable.includes(u)));
                    void recheck("partner", partnerUrls.filter((u) => recheckable.includes(u)));
                    void recheck("competitor", competitorUrls.filter((u) => recheckable.includes(u)));
                  }}
                  className="underline decoration-dotted underline-offset-2"
                >
                  Re-check the index
                </button>
              </>
            ) : null}
          </span>
        ) : null}
      </div>
    </form>
  );
}

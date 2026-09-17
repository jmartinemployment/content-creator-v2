"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkflowGate, workflowHref } from "@/components/WorkflowGate";
import {
  createGccClient,
  getGccClientByName,
  listGeekCrawls,
  startGeekCrawl,
  type GeekCrawlerRunSnapshot,
} from "@/services/gcc-api";
import { checkSeedBatch, MAX_SEEDS_PER_REQUEST, type SeedBatch } from "@/lib/crawl-seeds";

/**
 * Start crawls. All three types go to Geek-Crawler.
 *
 * The project site used to be the odd one out: it posted to /api/site-analyzer/analyze and waited
 * on a Geek-SEO progress hub, while partner and competitor crawls went to Geek-Crawler. That split
 * is why this page depended on twelve Site Analyzer endpoints, and it was never a real difference —
 * a project-site crawl is a crawl, and Geek-Crawler owns crawling.
 *
 * One endpoint, three crawl types, three independent runs.
 */

type CrawlOutcome = {
  label: string;
  detail: string;
  ok: boolean;
};

/** Per-line verdicts for one field. Every problem at once, each naming the line it came from. */
function SeedReport({ batch }: { batch: SeedBatch }) {
  if (batch.checks.length === 0) return null;

  return (
    <div className="space-y-1 text-xs">
      {batch.capError ? <p className="text-red-600">{batch.capError}</p> : null}

      {batch.rejected.map((c, i) => (
        <p key={`bad-${i}-${c.raw}`} className="text-red-600">
          <span className="font-mono">{c.raw.trim() || "(blank)"}</span> — {c.reason}
        </p>
      ))}

      {batch.duplicates.map((c, i) => (
        <p key={`dup-${i}-${c.raw}`} className="text-amber-700">
          <span className="font-mono">{c.raw.trim()}</span> — duplicate of an earlier line, sent
          once.
        </p>
      ))}

      {batch.accepted.length > 0 ? (
        <p className="text-[var(--gcc-muted)]">
          {batch.accepted.length} URL{batch.accepted.length === 1 ? "" : "s"} ready
          {batch.checks.length > batch.accepted.length
            ? ` of ${batch.checks.length} line${batch.checks.length === 1 ? "" : "s"}`
            : ""}
          .
        </p>
      ) : null}
    </div>
  );
}

export function CreateClient() {
  const { unlockWorkflow } = useWorkflowGate();
  const [domain, setDomain] = useState("");
  // Default is to reuse. Crawling a project site REPLACES the copy held for it, so the destructive
  // path is the one that needs a deliberate untick rather than the one that happens by default.
  const [useExistingSite, setUseExistingSite] = useState(true);
  const [partnerSeeds, setPartnerSeeds] = useState("");
  const [competitorSeeds, setCompetitorSeeds] = useState("");
  const [outcomes, setOutcomes] = useState<CrawlOutcome[]>([]);
  const [projectRunId, setProjectRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // "Use existing site" claims a crawl is already held. That claim has to be checked -- asserting
  // it without looking is how a create ends up grounded on nothing while the page reports success.
  const [existingRuns, setExistingRuns] = useState<GeekCrawlerRunSnapshot[] | null>(null);
  const [existingError, setExistingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const runs = await listGeekCrawls("project-site");
        if (!cancelled) setExistingRuns(runs);
      } catch (e) {
        if (!cancelled) {
          setExistingRuns([]);
          setExistingError(e instanceof Error ? e.message : "Could not list existing crawls.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completedRuns = (existingRuns ?? []).filter(
    (r) => r.status.toLowerCase() === "complete",
  );
  const checkingExisting = existingRuns === null;
  const noExistingSite = !checkingExisting && completedRuns.length === 0;

  // Checked as you type, against the same rules the server applies -- so a bad URL is named here
  // rather than coming back as a single "Invalid seed URL" that rejects the whole batch.
  const siteBatch = checkSeedBatch(domain);
  const partnerBatch = checkSeedBatch(partnerSeeds);
  const competitorBatch = checkSeedBatch(competitorSeeds);

  // A project-site run is single-seed. GccV2MongoProjectSitePageSource.FirstSeedUrl takes the first
  // seed and ignores the rest, so a second URL here would not error -- it would be crawled and then
  // silently dropped from grounding. Refuse it instead.
  const siteTooMany = siteBatch.accepted.length > 1;
  const siteBlocked =
    siteBatch.rejected.length > 0 || siteBatch.capError !== null || siteTooMany;

  // Partner and competitor URLs are validated here, never crawled from here, so they do not gate
  // the crawl button and their problems do not block it.
  const canCrawlSite = !useExistingSite && siteBatch.accepted.length > 0;

  async function crawlProjectSite() {
    setOutcomes([]);
    setProjectRunId(null);
    setStarting(true);

    try {
      const run = await startGeekCrawl("project-site", siteBatch.accepted);
      setProjectRunId(run.runId);
      await attachProjectSite(run.runId);
      setOutcomes([
        {
          label: "Project site",
          detail: `${siteBatch.accepted.length} URL${siteBatch.accepted.length === 1 ? "" : "s"} — run ${run.runId}`,
          ok: true,
        },
      ]);
    } catch (e) {
      setOutcomes([
        {
          label: "Project site",
          detail: e instanceof Error ? e.message : "Could not start the crawl",
          ok: false,
        },
      ]);
    } finally {
      setStarting(false);
    }
  }

  /**
   * Hand the project-site run to Workflow. The run id is the grounding id now — there is no
   * site_analysis_profiles row behind it any more.
   */
  async function attachProjectSite(runId: string) {
    const domainTrimmed = domain.trim();
    let resolvedClientId: string | null = null;
    try {
      const existing = await getGccClientByName(domainTrimmed);
      resolvedClientId = existing
        ? existing.id
        : (await createGccClient({ name: domainTrimmed })).id;
    } catch (e) {
      console.error("Failed to resolve Workflow client:", e);
    }

    unlockWorkflow({
      siteAnalysisProfileId: runId,
      domain: domainTrimmed,
      clientId: resolvedClientId,
    });
  }

  return (
    <div className="mt-8 space-y-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-[var(--gcc-ink)]">Project site URL</span>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="geekatyourspot.com"
          className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 text-sm"
          disabled={starting}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={useExistingSite}
          onChange={(e) => setUseExistingSite(e.target.checked)}
          disabled={starting}
          className="h-4 w-4 rounded border-[var(--gcc-line)]"
        />
        <span>Use existing site</span>
      </label>
      {checkingExisting ? (
        <p className="-mt-2 text-xs text-[var(--gcc-muted)]">Checking for an existing crawl…</p>
      ) : noExistingSite ? (
        <p className="-mt-2 text-xs text-red-600">
          There is no completed project-site crawl to use
          {existingError ? ` (${existingError})` : ""}. Untick this to crawl the site — until then a
          draft has no site grounding.
        </p>
      ) : (
        <p className="-mt-2 text-xs text-[var(--gcc-muted)]">
          Keeps the crawl already held for this site ({completedRuns.length} available). Untick to
          crawl it again — that replaces the existing copy.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--gcc-ink)]">Partner URLs</span>
          <span className="text-xs text-[var(--gcc-muted)]">
            Products you sell or recommend — evidence a draft can cite. Checked here; crawled in
            Geek-Crawler.
          </span>
          <textarea
            value={partnerSeeds}
            onChange={(e) => setPartnerSeeds(e.target.value)}
            disabled={starting}
            rows={5}
            placeholder={"https://partner.example/pricing\nhttps://partner.example/docs"}
            className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
          />
          <SeedReport batch={partnerBatch} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--gcc-ink)]">Competitor URLs</span>
          <span className="text-xs text-[var(--gcc-muted)]">
            Rivals writing on the same topics — positioning, never cited as product evidence.
            Checked here; crawled in Geek-Crawler.
          </span>
          <textarea
            value={competitorSeeds}
            onChange={(e) => setCompetitorSeeds(e.target.value)}
            disabled={starting}
            rows={5}
            placeholder={"https://rival.example/services\nhttps://rival.example/about"}
            className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
          />
          <SeedReport batch={competitorBatch} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-[var(--gcc-muted)]">
        One URL per line, up to {MAX_SEEDS_PER_REQUEST} per field. These are validated against the
        crawler&rsquo;s own admission rules so a bad URL is caught before you take the list to
        Geek-Crawler — nothing here starts a partner or competitor crawl. A scheme is added when
        missing, and bullets or numbering are tolerated.
      </p>

      <button
        type="button"
        disabled={starting || !canCrawlSite || siteBlocked}
        onClick={() => void crawlProjectSite()}
        className="rounded-md bg-[var(--gcc-teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {starting ? "Crawling…" : "Crawl project site"}
      </button>

      {useExistingSite && noExistingSite ? (
        <p className="text-xs text-red-600">
          Untick “Use existing site” before crawling — there is nothing existing to use.
        </p>
      ) : null}

      {outcomes.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {outcomes.map((o) => (
            <li key={o.label} className={o.ok ? "text-[var(--gcc-muted)]" : "text-red-600"}>
              <span className="font-medium">{o.label}:</span> {o.detail}
            </li>
          ))}
        </ul>
      ) : null}

      {projectRunId ? (
        <div className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-3 text-sm">
          <p className="text-[var(--gcc-muted)]">
            Crawls run in Geek-Crawler and continue after you leave this page.{" "}
            <Link href="/app/creates/new" className="font-semibold text-[var(--gcc-teal)]">
              Start a create
            </Link>{" "}
            or open{" "}
            <Link href={workflowHref(projectRunId)} className="font-semibold text-[var(--gcc-teal)]">
              Workflow
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkflowGate, workflowHref } from "@/components/WorkflowGate";
import {
  createGccClient,
  getGccClientByName,
  startGeekCrawl,
  checkHostsIndexed,
  type HostIndexed,
} from "@/services/gcc-api";

/** One URL per line; blanks dropped. Parsing only — validity is the index's answer, not ours. */
function parseLines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

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

/**
 * Whether an index exists for each entered URL. Green yes, red no.
 *
 * One check, because it subsumes the rest: a URL that will not parse was never crawled, so no index
 * can exist for it, and it lands red alongside a well-formed URL that was never crawled. The
 * operator does the same thing about both.
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
  if (checking) return <p className="text-xs text-[var(--gcc-muted)]">Checking the index…</p>;
  if (error) return <p className="text-xs text-red-600">{error}</p>;

  const seen = urls.filter((u) => results[u] !== undefined);
  if (seen.length === 0) return null;

  return (
    <div className="space-y-1 text-xs">
      {seen.map((u) => {
        const r = results[u];
        return (
          <p key={u} className={r.indexed ? "text-green-700" : "text-red-600"}>
            <span className="font-mono">{u}</span> —{" "}
            {r.indexed ? "indexed" : "no index — crawl it first"}
          </p>
        );
      })}
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

  const siteUrls = parseLines(domain);
  const partnerUrls = parseLines(partnerSeeds);
  const competitorUrls = parseLines(competitorSeeds);

  // A project-site run is single-seed. GccV2MongoProjectSitePageSource.FirstSeedUrl takes the first
  // and ignores the rest, so a second URL would be crawled and then silently dropped from grounding.
  const siteTooMany = siteUrls.length > 1;
  const canCrawlSite = !useExistingSite && siteUrls.length === 1;

  // Every field is answered the same way: does an index exist for the URL. The project site used to
  // ask a different question -- whether a crawl run existed -- which could say yes for a run that
  // completed with nothing indexed, and therefore nothing a draft could cite.
  const siteChecked = siteUrls.length > 0 && siteUrls.every((u) => indexed[u] !== undefined);
  const siteIndexed = siteUrls.length > 0 && siteUrls.every((u) => indexed[u]?.indexed === true);

  const [indexed, setIndexed] = useState<Record<string, HostIndexed>>({});
  const [checking, setChecking] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  async function checkIndex(urls: string[]) {
    const pending = urls.filter((u) => indexed[u] === undefined);
    if (pending.length === 0) return;
    setChecking(true);
    setIndexError(null);
    try {
      const rows = await checkHostsIndexed(pending);
      setIndexed((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.url] = r;
        return next;
      });
    } catch (e) {
      // The check not running is not a verdict. Leave the URLs unmarked rather than showing them
      // red, which would blame the URL for a failure on our side.
      setIndexError(e instanceof Error ? e.message : "Could not reach the index.");
    } finally {
      setChecking(false);
    }
  }

  async function crawlProjectSite() {
    setOutcomes([]);
    setProjectRunId(null);
    setStarting(true);

    try {
      const started = await startGeekCrawl("project-site", siteUrls);
      const runId = started.run?.runId;
      if (!runId) throw new Error("The crawl started but returned no run id.");

      setProjectRunId(runId);
      await attachProjectSite(runId);
      setOutcomes([
        {
          label: "Project site",
          detail: `${siteUrls.length} URL${siteUrls.length === 1 ? "" : "s"} — run ${runId}`,
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
      <p className="-mt-2 text-xs text-[var(--gcc-muted)]">
        {siteIndexed
          ? "Uses what is already indexed for this site. Untick to crawl it again — that replaces it."
          : "Untick to crawl the site. Until it is indexed a draft has no site grounding."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--gcc-ink)]">Partner URLs</span>
          <span className="text-xs text-[var(--gcc-muted)]">
            Products you sell or recommend.
          </span>
          <textarea
            value={partnerSeeds}
            onChange={(e) => setPartnerSeeds(e.target.value)}
            onBlur={() => void checkIndex(partnerUrls)}
            disabled={starting}
            rows={5}
            placeholder={"https://partner.example/pricing\nhttps://partner.example/docs"}
            className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
          />
          <IndexReport urls={partnerUrls} results={indexed} checking={checking} error={indexError} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--gcc-ink)]">Competitor URLs</span>
          <span className="text-xs text-[var(--gcc-muted)]">
            Rivals writing on the same topics.
          </span>
          <textarea
            value={competitorSeeds}
            onChange={(e) => setCompetitorSeeds(e.target.value)}
            onBlur={() => void checkIndex(competitorUrls)}
            disabled={starting}
            rows={5}
            placeholder={"https://rival.example/services\nhttps://rival.example/about"}
            className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
          />
          <IndexReport urls={competitorUrls} results={indexed} checking={checking} error={indexError} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-[var(--gcc-muted)]">
        One URL per line. Checked against the index when you leave the field.
      </p>

      <button
        type="button"
        disabled={starting || !canCrawlSite || siteTooMany}
        onClick={() => void crawlProjectSite()}
        className="rounded-md bg-[var(--gcc-teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {starting ? "Crawling…" : "Crawl project site"}
      </button>

      {useExistingSite && siteChecked && !siteIndexed ? (
        <p className="text-xs text-red-600">
          Nothing is indexed for this site — untick “Use existing site” and crawl it.
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

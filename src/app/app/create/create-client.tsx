"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkflowGate, workflowHref } from "@/components/WorkflowGate";
import {
  createGccClient,
  getGccClientByName,
  parseSeedLines,
  startGeekCrawl,
} from "@/services/gcc-api";

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

export function CreateClient() {
  const { unlockWorkflow } = useWorkflowGate();
  const [domain, setDomain] = useState("");
  const [recrawl, setRecrawl] = useState(false);
  const [partnerSeeds, setPartnerSeeds] = useState("");
  const [competitorSeeds, setCompetitorSeeds] = useState("");
  const [outcomes, setOutcomes] = useState<CrawlOutcome[]>([]);
  const [projectRunId, setProjectRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const hasAnySeed =
    (recrawl && domain.trim().length > 0) ||
    parseSeedLines(partnerSeeds).length > 0 ||
    parseSeedLines(competitorSeeds).length > 0;

  async function startCrawls() {
    setOutcomes([]);
    setProjectRunId(null);
    setStarting(true);

    const results: CrawlOutcome[] = [];

    // Each type is its own run. partner is evidence a draft may cite, competitors is positioning,
    // project-site is grounding — a failure in one must not take the others' seeds with it.
    const jobs: Array<{
      label: string;
      type: "project-site" | "partner" | "competitors";
      seeds: string[];
    }> = [
      { label: "Project site", type: "project-site", seeds: parseSeedLines(domain) },
      { label: "Partner", type: "partner", seeds: parseSeedLines(partnerSeeds) },
      { label: "Competitor", type: "competitors", seeds: parseSeedLines(competitorSeeds) },
    ];

    for (const job of jobs) {
      if (job.seeds.length === 0) continue;

      // StartCrawlAsync requeues the run already held for a seed key rather than adding a second
      // one, so starting a project-site crawl always replaces the copy behind it. That is a
      // destructive act on the only grounding this app has, so it is gated on an explicit tick
      // rather than happening because a URL happened to be in the box.
      if (job.type === "project-site" && !recrawl) {
        results.push({
          label: job.label,
          detail: "Skipped — tick “Crawl project site” to replace the crawl held for it.",
          ok: true,
        });
        continue;
      }
      try {
        const run = await startGeekCrawl(job.type, job.seeds);
        results.push({
          label: job.label,
          detail: `${job.seeds.length} URL${job.seeds.length === 1 ? "" : "s"} — run ${run.runId}`,
          ok: true,
        });
        if (job.type === "project-site") {
          setProjectRunId(run.runId);
          await attachProjectSite(run.runId);
        }
      } catch (e) {
        results.push({
          label: job.label,
          detail: e instanceof Error ? e.message : "Could not start the crawl",
          ok: false,
        });
      }
    }

    setOutcomes(results);
    setStarting(false);
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
          checked={recrawl}
          onChange={(e) => setRecrawl(e.target.checked)}
          disabled={starting}
          className="h-4 w-4 rounded border-[var(--gcc-line)]"
        />
        <span>Crawl project site</span>
      </label>
      <p className="-mt-2 text-xs text-[var(--gcc-muted)]">
        Replaces the crawl already held for this site. Leave unchecked to keep it and crawl only the
        partner and competitor URLs below.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--gcc-ink)]">Partner URLs</span>
          <span className="text-xs text-[var(--gcc-muted)]">
            Products you sell or recommend. Crawled as evidence a draft can cite.
          </span>
          <textarea
            value={partnerSeeds}
            onChange={(e) => setPartnerSeeds(e.target.value)}
            disabled={starting}
            rows={5}
            placeholder={"https://partner.example/pricing\nhttps://partner.example/docs"}
            className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--gcc-ink)]">Competitor URLs</span>
          <span className="text-xs text-[var(--gcc-muted)]">
            Rivals writing on the same topics. Crawled for positioning, never cited as product
            evidence.
          </span>
          <textarea
            value={competitorSeeds}
            onChange={(e) => setCompetitorSeeds(e.target.value)}
            disabled={starting}
            rows={5}
            placeholder={"https://rival.example/services\nhttps://rival.example/about"}
            className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
          />
        </label>
      </div>
      <p className="-mt-2 text-xs text-[var(--gcc-muted)]">One URL per line. Leave blank to skip.</p>

      <button
        type="button"
        disabled={starting || !hasAnySeed}
        onClick={() => void startCrawls()}
        className="rounded-md bg-[var(--gcc-teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {starting ? "Starting…" : "Crawl"}
      </button>

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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkflowGate, workflowHref } from "@/components/WorkflowGate";
import {
  checkHostsIndexed,
  checkProjectSiteReadiness,
  type HostIndexed,
  type ProjectSiteReadiness,
} from "@/services/gcc-api";

/**
 * Whether an index exists for each entered URL. Green yes, red no.
 *
 * One check, because it subsumes the rest: a URL that will not parse was never crawled, so no index
 * can exist for it, and it lands red alongside a well-formed URL that was never crawled. The
 * operator does the same thing about both.
 */
/** One URL per line; blanks dropped. Parsing only — validity is the index's answer. */
function parseLines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

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

export function SiteAnalyzerClient() {
  // Partner and competitor URLs are entered here and checked against the RAG index. They are never
  // crawled from this page -- crawling them is Geek-Crawler's job. Deleted in 2367b08 when v1's
  // client was restored wholesale over the file that carried them; restored here.
  const [partnerSeeds, setPartnerSeeds] = useState("");
  const [competitorSeeds, setCompetitorSeeds] = useState("");
  const [indexed, setIndexed] = useState<Record<string, HostIndexed>>({});
  const [checkingIndex, setCheckingIndex] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  const partnerUrls = parseLines(partnerSeeds);
  const competitorUrls = parseLines(competitorSeeds);

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

  const [domain, setDomain] = useState("");
  const [project, setProject] = useState<ProjectSiteReadiness | null>(null);
  const [checkingProject, setCheckingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const router = useRouter();
  const { unlockWorkflow } = useWorkflowGate();

  /**
   * Checks the project site the same way the partner and competitor boxes check theirs — on blur,
   * reported inline — but against readiness rather than the host index.
   *
   * The host index only asks whether a host has vectors, which a crawl that fetched nothing can
   * satisfy. Readiness runs the same retrieval PLAN runs and returns the run id of the crawl that
   * actually holds the evidence. One signal for this field: asking both is how a run once read
   * "status says fine, store says empty, index says populated".
   *
   * Returns the verdict so the caller can act on it without re-reading state it just set.
   */
  async function checkProject(): Promise<ProjectSiteReadiness | null> {
    const projectUrl = domain.trim();
    if (!projectUrl) return null;

    setCheckingProject(true);
    setProjectError(null);
    try {
      const row = await checkProjectSiteReadiness(projectUrl);
      setProject(row);
      return row;
    } catch (e) {
      // A check that did not complete is not a verdict on the URL, so this reports the real failure
      // rather than marking the site unusable.
      setProject(null);
      setProjectError(e instanceof Error ? e.message : "Could not check this URL.");
      return null;
    } finally {
      setCheckingProject(false);
    }
  }

  /**
   * The gate into the rest of the app. Acts on the verdict already on screen, re-checking only if
   * the field has not been checked yet, so the button never disagrees with the line above it.
   *
   * Nothing downstream is handed the URL. Workflow is unlocked with the run id, and the run id is
   * what travels on the query string, because only it names a committed crawl.
   */
  async function continueToWorkflow() {
    const projectUrl = domain.trim();
    if (!projectUrl) return;

    const row = project ?? (await checkProject());
    if (!row?.ready || !row.runId) return;

    unlockWorkflow({ siteAnalysisProfileId: row.runId, domain: projectUrl, clientId: null });
    router.push(workflowHref(row.runId));
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              // A verdict belongs to the URL it was obtained for, so editing clears it rather than
              // leaving a stale green against a site nobody checked.
              setProject(null);
              setProjectError(null);
            }}
            placeholder="geekatyourspot.com"
            className="flex-1 rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 text-sm"
            disabled={checkingProject}
            onBlur={() => void checkProject()}
          />
          <button
            type="button"
            onClick={() => void continueToWorkflow()}
            disabled={checkingProject || !domain.trim()}
            className="rounded-md bg-[var(--gcc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {checkingProject ? "Checking…" : "Continue"}
          </button>
        </div>

        {/* The project site is checked only here, never also against the host index. Two answers
            that can disagree is how a run reported "complete" while holding nothing. */}
        {checkingProject ? (
          <p className="text-xs text-[var(--gcc-muted)]">Checking the crawl…</p>
        ) : projectError ? (
          <p className="text-xs text-red-600">{projectError}</p>
        ) : project && project.ready && project.runId ? (
          <p className="text-xs text-green-700">
            <span className="font-mono">{domain.trim()}</span> — crawled and retrievable. Run{" "}
            {project.runId.slice(0, 8)}…
          </p>
        ) : project && !project.ready ? (
          <p className="text-xs text-red-600">
            {project.reason ?? "No indexed pages are retrievable for this URL yet."}{" "}
            Crawl it in Geek-Crawler first — nothing on this page crawls.
          </p>
        ) : project && project.ready && !project.runId ? (
          <p className="text-xs text-red-600">
            This site has retrievable pages but no committed crawl run resolves for it, so there is
            no run id to carry forward.
          </p>
        ) : null}


        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--gcc-ink)]">Partner URLs</span>
            <span className="text-xs text-[var(--gcc-muted)]">Products you sell or recommend.</span>
            <textarea
              value={partnerSeeds}
              onChange={(e) => setPartnerSeeds(e.target.value)}
              onBlur={() => void checkIndex(partnerUrls)}
                rows={5}
              placeholder={"https://partner.example/pricing\nhttps://partner.example/docs"}
              className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
            />
            <IndexReport
              urls={partnerUrls}
              results={indexed}
              checking={checkingIndex}
              error={indexError}
            />
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
                rows={5}
              placeholder={"https://rival.example/services\nhttps://rival.example/about"}
              className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
            />
            <IndexReport
              urls={competitorUrls}
              results={indexed}
              checking={checkingIndex}
              error={indexError}
            />
          </label>
        </div>
        <p className="text-xs text-[var(--gcc-muted)]">
          One URL per line. Checked against the index when you leave the field.
        </p>
      </div>


    </div>
  );
}

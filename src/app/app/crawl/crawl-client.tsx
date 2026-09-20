"use client";

import { useState } from "react";
import Link from "next/link";
import { checkHostsIndexed, type HostIndexed } from "@/services/gcc-api";
import { useWorkflowGate, workflowHref } from "@/components/WorkflowGate";
import { SiteStructurePanel } from "@/components/SiteStructurePanel";

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
  const { unlockWorkflow } = useWorkflowGate();

  const partnerUrls = parseLines(partnerSeeds);
  const competitorUrls = parseLines(competitorSeeds);

  async function checkIndex(urls: string[], unlockUrl?: string) {
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
      // The Run ID has always been on this row; it was simply never read. Carrying it to the gate
      // is the whole handoff — Workflow is keyed on a Run ID and has no other source for one.
      //
      // Only the project URL unlocks. Partner and competitor rows carry run ids too, but they name
      // someone else's site: grounding Workflow on one would be the same defect as citing a partner
      // crawl as the client's own.
      if (unlockUrl) {
        const row = rows.find((r) => r.url === unlockUrl);
        // Indexed without a Run ID is not a usable answer — no partial unlock.
        if (row?.indexed && row.runId) {
          unlockWorkflow({ siteAnalysisProfileId: row.runId, domain: row.url });
        }
      }
    } catch (e) {
      // The check failing is not a verdict on the URL. Leave it unmarked rather than red.
      setIndexError(e instanceof Error ? e.message : "Could not reach the index.");
    } finally {
      setCheckingIndex(false);
    }
  }

  const [domain, setDomain] = useState("");
  const domainUrls = parseLines(domain);
  // The project site's run, once the index check has answered for it. Workflow is unreachable
  // without it, so it is also the gate's only key.
  const projectRow = domainUrls[0] ? indexed[domainUrls[0]] : undefined;
  const projectRunId = projectRow?.indexed ? projectRow.runId : null;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="geekatyourspot.com"
            className="flex-1 rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 text-sm"
            onBlur={() => void checkIndex(domainUrls, domainUrls[0])}
          />
        </div>
        <IndexReport
          urls={domainUrls}
          results={indexed}
          checking={checkingIndex}
          error={indexError}
        />
        {projectRunId ? (
          <>
            {/* TEMPORARY — shown on this step so the crawl can be judged before anything is
                grounded on it. Placement is revisited once the wizard settles. */}
            <SiteStructurePanel key={projectRunId} runId={projectRunId} />

            {/* The step is finished once a run answers for this URL, so say so and move on.
                Run ID stays visible: it is what the next step is keyed on. */}
            <div className="flex flex-col gap-2 rounded-md border border-[var(--gcc-line)] bg-[var(--gcc-paper)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs">
                <p className="font-medium text-[var(--gcc-ink)]">
                  Step 1 complete — this site has crawl evidence.
                </p>
                <p className="mt-0.5 break-all text-[var(--gcc-muted)]">
                  Run <span className="font-mono">{projectRunId}</span>
                </p>
              </div>
              <Link
                href={workflowHref(projectRunId)}
                className="shrink-0 rounded-md bg-[var(--gcc-accent)] px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--gcc-accent-deep)]"
              >
                Next: Content &rarr;
              </Link>
            </div>
          </>
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

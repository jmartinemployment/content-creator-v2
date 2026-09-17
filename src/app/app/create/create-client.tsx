"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useWorkflowGate, workflowHref } from "@/components/WorkflowGate";
import { createGccClient, getGccClientByName } from "@/services/gcc-api";
import { connectThroughCoverageHub } from "@/services/site-analysis-hub";

/**
 * Crawl a project site.
 *
 * This page used to carry the whole gap-to-create flow: content gaps, heading trees, site page
 * reports, an existing-crawl picker, SERP ingest and a create form. All of it read analysis that
 * belongs to Geek-SEO, and none of it is how a create starts any more — creates begin from a topic
 * on /app/creates/new, and site grounding comes from the crawl itself.
 *
 * What is left is the one thing Content Creator genuinely needs from this page: point it at a URL
 * and crawl it.
 */
export function CreateClient() {
  const { unlockWorkflow } = useWorkflowGate();
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState<string | null>(null);
  const [doneProfileId, setDoneProfileId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  // Unchecked reuses the crawl already held for this site; checked fetches it again. The old code
  // always sent force:true, so every visit re-crawled whether or not anything had changed.
  const [recrawl, setRecrawl] = useState(false);
  const [, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function applyFinishedCrawl(profileId: string) {
    const res = await fetch(`/api/site-analyzer/${encodeURIComponent(profileId)}`, {
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Could not load crawl");
    }

    const pageCount = ((body.pages ?? body.Pages ?? []) as unknown[]).length;
    const domainTrimmed = domain.trim();

    // Resolve the Workflow client for this domain. Reuse before create -- creating
    // unconditionally is how the same site ends up with several client rows.
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
      siteAnalysisProfileId: profileId,
      domain: domainTrimmed,
      clientId: resolvedClientId,
    });

    setStepLabel(null);
    setDoneProfileId(profileId);
    setDoneLabel(`Crawled ${domainTrimmed} — ${pageCount} page${pageCount === 1 ? "" : "s"}.`);
  }

  function analyze() {
    setError(null);
    setDoneLabel(null);
    setDoneProfileId(null);
    setStepLabel(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setAnalyzing(true);

    startTransition(async () => {
      try {
        const hub = await connectThroughCoverageHub({
          signal: ac.signal,
          onProgress: (p) => {
            if (p.stepNumber || p.step) {
              setStepLabel(
                p.step
                  ? `Step ${p.stepNumber}${p.totalSteps ? `/${p.totalSteps}` : ""}: ${p.step}`
                  : `Step ${p.stepNumber}${p.totalSteps ? `/${p.totalSteps}` : ""}`,
              );
            }
          },
        });
        const res = await fetch("/api/site-analyzer/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, force: recrawl }),
          signal: ac.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not start the crawl");
        const profileId = await hub.done;
        await applyFinishedCrawl(profileId);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Crawl failed");
      } finally {
        if (!ac.signal.aborted) setAnalyzing(false);
      }
    });
  }

  function cancel() {
    abortRef.current?.abort();
    setAnalyzing(false);
    setStepLabel(null);
    setError("Crawl cancelled.");
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="geekatyourspot.com"
          className="flex-1 rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 text-sm"
          disabled={analyzing}
        />
        <button
          type="button"
          disabled={analyzing || !domain.trim()}
          onClick={analyze}
          className="rounded-md bg-[var(--gcc-teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {analyzing ? "Crawling…" : "Crawl"}
        </button>
        {analyzing ? (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-[var(--gcc-line)] px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={recrawl}
          onChange={(e) => setRecrawl(e.target.checked)}
          disabled={analyzing}
          className="h-4 w-4 rounded border-[var(--gcc-line)]"
        />
        <span>Re-crawl project site</span>
      </label>
      <p className="-mt-2 text-xs text-[var(--gcc-muted)]">
        Leave unchecked to reuse the crawl already held for this site. Check it to fetch the site
        again — do that when the site has changed since the last crawl.
      </p>

      {stepLabel ? <p className="text-sm text-[var(--gcc-muted)]">{stepLabel}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {doneLabel ? (
        <div className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-3 text-sm">
          <p className="font-medium">{doneLabel}</p>
          <p className="mt-1 text-[var(--gcc-muted)]">
            <Link href="/app/creates/new" className="font-semibold text-[var(--gcc-teal)]">
              Start a create
            </Link>{" "}
            or open{" "}
            <Link href={workflowHref(doneProfileId)} className="font-semibold text-[var(--gcc-teal)]">
              Workflow
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ButtonBusyLabel, LoadingRow } from "@/app/components/loading-indicator";
import { resolveSiteAnalysis, type SiteAnalyzeResult } from "@/app/site-analyze-flow";

const inputClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";

export function HomeSiteCrawl() {
  const pollAbortRef = useRef<AbortController | null>(null);

  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [forceReanalyze, setForceReanalyze] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzingLabel, setAnalyzingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SiteAnalyzeResult | null>(null);

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  async function onAnalyze() {
    setError(null);
    pollAbortRef.current?.abort();
    const ac = new AbortController();
    pollAbortRef.current = ac;

    setBusy(true);
    setAnalyzingLabel("Starting…");
    setResult(null);

    try {
      const analyzed = await resolveSiteAnalysis(
        siteUrlInput,
        forceReanalyze,
        ac.signal,
        setAnalyzingLabel,
      );
      setResult(analyzed);
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        return;
      }
      setError(err instanceof Error ? err.message : "Site analysis failed");
    } finally {
      setBusy(false);
      setAnalyzingLabel(null);
    }
  }

  function onCancel() {
    pollAbortRef.current?.abort();
    setBusy(false);
    setAnalyzingLabel(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={fieldClass}>
        <label className={labelClass} htmlFor="homeSiteUrl">
          Project site URL
        </label>
        <input
          id="homeSiteUrl"
          className={inputClass}
          value={siteUrlInput}
          onChange={(e) => setSiteUrlInput(e.target.value)}
          placeholder="https://example.com or example.com"
          disabled={busy}
          required
        />
        <p className="text-xs text-[var(--cc-muted)]">
          Long-running crawl — start here before opening a content brief. Same URL as step 1 on the
          brief form.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--cc-ink)]">
        <input
          type="checkbox"
          checked={forceReanalyze}
          onChange={(e) => setForceReanalyze(e.target.checked)}
          disabled={busy}
        />
        Force new crawl (ignore existing ready profile)
      </label>

      {analyzingLabel ? <LoadingRow label={analyzingLabel} /> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !siteUrlInput.trim()}
          onClick={() => void onAnalyze()}
          className="rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--cc-accent-hover)] disabled:opacity-60"
        >
          <ButtonBusyLabel busy={busy} busyLabel="Analyzing…" idleLabel="Start site crawl" />
        </button>
        {busy ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--cc-ink)]"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-md border border-[var(--cc-line)] bg-white p-3 text-sm">
          <p className="font-medium text-[var(--cc-ink)]">
            Site crawl ready — writing for{" "}
            <span className="font-semibold">{result.siteUrl}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            {result.section.relatedPages.length} page
            {result.section.relatedPages.length === 1 ? "" : "s"} available for links and
            grounding
          </p>
          <Link
            href="/creates/new"
            className="mt-3 inline-flex w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--cc-accent-hover)]"
          >
            New content brief
          </Link>
        </div>
      ) : (
        <p className="text-xs text-[var(--cc-muted)]">
          Site crawl runs independently of vendor research — you can start both in parallel.
        </p>
      )}
    </div>
  );
}

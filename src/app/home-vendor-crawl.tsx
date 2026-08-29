"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ButtonBusyLabel } from "@/app/components/loading-indicator";
import {
  crawlStatusLabel,
  fetchToolSourceCrawlByRunId,
  fetchToolSourceCrawlStatus,
  isCrawlActive,
  mergeCrawlStatus,
  parseOperatorTools,
  startToolSourceCrawlRequest,
  type ToolSourceCrawlStatus,
  useToolSourceCrawlHub,
} from "@/app/tool-vendor-crawl";

const inputClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";
const STATUS_POLL_MS = 3000;

export function HomeVendorCrawl() {
  const statusSeqRef = useRef(0);
  const activeRunIdRef = useRef<string | null>(null);

  const [operatorToolsText, setOperatorToolsText] = useState("");
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [toolSourceCrawl, setToolSourceCrawl] = useState<ToolSourceCrawlStatus | null>(null);

  const operatorTools = useMemo(
    () => parseOperatorTools(operatorToolsText),
    [operatorToolsText],
  );

  const applyCrawlStatus = useCallback((next: ToolSourceCrawlStatus | null) => {
    setToolSourceCrawl((prev) => mergeCrawlStatus(prev, next));
    if (next?.runId) {
      activeRunIdRef.current = next.runId;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const requestSeq = statusSeqRef.current;
    const runId = activeRunIdRef.current;

    try {
      if (runId) {
        const run = await fetchToolSourceCrawlByRunId(runId);
        if (requestSeq !== statusSeqRef.current) return;
        applyCrawlStatus(run);
        return;
      }

      const tools = parseOperatorTools(operatorToolsText);
      if (tools.length === 0) {
        if (requestSeq === statusSeqRef.current) {
          setToolSourceCrawl(null);
        }
        return;
      }

      const run = await fetchToolSourceCrawlStatus(tools);
      if (requestSeq !== statusSeqRef.current) return;
      applyCrawlStatus(run);
    } catch (err: unknown) {
      if (requestSeq !== statusSeqRef.current) return;
      setCrawlError(err instanceof Error ? err.message : "Could not load crawl status.");
    }
  }, [applyCrawlStatus, operatorToolsText]);

  useToolSourceCrawlHub(toolSourceCrawl, applyCrawlStatus);

  useEffect(() => {
    activeRunIdRef.current = null;
    statusSeqRef.current += 1;
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!toolSourceCrawl || !isCrawlActive(toolSourceCrawl.status)) return;

    const timer = window.setInterval(() => {
      void refreshStatus();
    }, STATUS_POLL_MS);

    return () => window.clearInterval(timer);
  }, [refreshStatus, toolSourceCrawl?.runId, toolSourceCrawl?.status]);

  async function onStart(force = false) {
    if (operatorTools.length === 0) {
      setCrawlError("Enter at least one valid tool URL (https://… or domain.com).");
      return;
    }
    statusSeqRef.current += 1;
    setCrawlError(null);
    setCrawlBusy(true);
    try {
      const run = await startToolSourceCrawlRequest(operatorTools, force);
      activeRunIdRef.current = run.runId ?? null;
      statusSeqRef.current += 1;
      applyCrawlStatus(run);
    } catch (err: unknown) {
      setCrawlError(err instanceof Error ? err.message : "Could not start vendor crawl.");
    } finally {
      setCrawlBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={fieldClass}>
        <label className={labelClass} htmlFor="homeOperatorTools">
          Vendor tool URLs
        </label>
        <textarea
          id="homeOperatorTools"
          className={`${inputClass} min-h-[120px] font-mono text-xs`}
          value={operatorToolsText}
          onChange={(e) => setOperatorToolsText(e.target.value)}
          placeholder={"Name | URL per line\nPipedrive | https://www.pipedrive.com/"}
        />
        <p className="text-xs text-[var(--cc-muted)]">
          Long-running crawl of external tool sites. One name and URL per line.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={crawlBusy || operatorTools.length === 0}
          onClick={() => void onStart(false)}
          className="rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--cc-accent-hover)] disabled:opacity-60"
        >
          <ButtonBusyLabel busy={crawlBusy} busyLabel="Starting…" idleLabel="Start vendor research" />
        </button>
        {toolSourceCrawl && isCrawlActive(toolSourceCrawl.status) ? (
          <button
            type="button"
            disabled={crawlBusy}
            onClick={() => void onStart(true)}
            className="rounded-md border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--cc-ink)] disabled:opacity-60"
          >
            Force new crawl
          </button>
        ) : null}
      </div>

      {crawlError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {crawlError}
        </p>
      ) : null}

      {toolSourceCrawl ? (
        <div className="rounded-md border border-[var(--cc-line)] bg-white p-3 text-sm">
          <p className="font-medium text-[var(--cc-ink)]">{crawlStatusLabel(toolSourceCrawl)}</p>
          {toolSourceCrawl.runId ? (
            <p className="mt-1 font-mono text-xs text-[var(--cc-muted)]">Run {toolSourceCrawl.runId}</p>
          ) : null}
          {toolSourceCrawl.errorSummary ? (
            <p className="mt-1 text-red-700">{toolSourceCrawl.errorSummary}</p>
          ) : null}
          {toolSourceCrawl.hosts && toolSourceCrawl.hosts.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-[var(--cc-muted)]">
              {toolSourceCrawl.hosts.map((h) => (
                <li key={h.origin ?? "host"}>
                  {h.origin}: {h.pagesWithHtml ?? 0} page(s) HTML, {h.quotePages ?? 0} quoteable
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : operatorTools.length > 0 ? (
        <p className="text-xs text-[var(--cc-muted)]">Loading crawl status…</p>
      ) : null}
    </div>
  );
}

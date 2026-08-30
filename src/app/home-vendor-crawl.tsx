"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ButtonBusyLabel } from "@/app/components/loading-indicator";
import {
  crawlStatusLabel,
  fetchToolSourceCrawlStatus,
  isCrawlActive,
  parseOperatorTools,
  startToolSourceCrawlRequest,
  type ToolSourceCrawlStatus,
  useToolSourceCrawlHub,
} from "@/app/tool-vendor-crawl";

const inputClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";

export function HomeVendorCrawl() {
  const [operatorToolsText, setOperatorToolsText] = useState("");
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [toolSourceCrawl, setToolSourceCrawl] = useState<ToolSourceCrawlStatus | null>(null);

  const operatorTools = useMemo(
    () => parseOperatorTools(operatorToolsText),
    [operatorToolsText],
  );

  const refreshStatus = useCallback(() => {
    const tools = parseOperatorTools(operatorToolsText);
    if (tools.length === 0) {
      setToolSourceCrawl(null);
      return;
    }
    void fetchToolSourceCrawlStatus(tools)
      .then((run) => setToolSourceCrawl(run))
      .catch((err: unknown) => {
        setCrawlError(err instanceof Error ? err.message : "Could not load crawl status.");
      });
  }, [operatorToolsText]);

  useToolSourceCrawlHub(toolSourceCrawl, setToolSourceCrawl, refreshStatus);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function onStart(force = false) {
    if (operatorTools.length === 0) {
      setCrawlError("Enter at least one operator tool URL.");
      return;
    }
    setCrawlError(null);
    setCrawlBusy(true);
    try {
      const run = await startToolSourceCrawlRequest(operatorTools, force);
      setToolSourceCrawl(run);
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
      ) : null}
    </div>
  );
}

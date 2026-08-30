"use client";

import { useEffect } from "react";
import type { HubConnection } from "@microsoft/signalr";
import {
  createJobHubConnection,
  joinCrawlRun,
  onCrawlEvent,
  onCrawlHubReconnected,
  type GccV2CrawlEvent,
} from "@/app/auth/job-hub";

export type ToolSourceCrawlStatus = {
  runId?: string;
  status: string;
  errorSummary?: string | null;
  currentOrigin?: string | null;
  hosts?: Array<{
    origin?: string;
    pagesAttempted?: number;
    pagesWithHtml?: number;
    quotePages?: number;
  }> | null;
};

export function parseOperatorTools(text: string): Array<{ name?: string; url: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf("|");
      if (pipe >= 0) {
        const name = line.slice(0, pipe).trim();
        const url = line.slice(pipe + 1).trim();
        if (!url) return null;
        return name ? { name, url } : { url };
      }
      return { url: line };
    })
    .filter((row): row is { name?: string; url: string } => row !== null);
}

export function isCrawlActive(status: string | undefined): boolean {
  return status === "pending" || status === "running";
}

export function mapCrawlApiBody(body: Record<string, unknown>): ToolSourceCrawlStatus {
  const hosts = body.hosts;
  return {
    runId: typeof body.runId === "string" ? body.runId : undefined,
    status: String(body.status ?? "unknown"),
    errorSummary: (body.errorSummary ?? null) as string | null,
    currentOrigin: (body.currentOrigin ?? null) as string | null,
    hosts: Array.isArray(hosts) ? (hosts as ToolSourceCrawlStatus["hosts"]) : null,
  };
}

export function mapCrawlEvent(evt: GccV2CrawlEvent): ToolSourceCrawlStatus {
  return {
    runId: evt.runId,
    status: evt.status,
    errorSummary: evt.errorSummary,
    currentOrigin: evt.currentOrigin,
    hosts: evt.hosts,
  };
}

export function crawlStatusLabel(crawl: ToolSourceCrawlStatus): string {
  if (crawl.status === "pending") return "Queued — starting vendor crawl…";
  if (crawl.status === "running") {
    if (crawl.currentOrigin) {
      const done = crawl.hosts?.length ?? 0;
      return done > 0
        ? `Crawling ${crawl.currentOrigin}… (${done} site(s) done)`
        : `Crawling ${crawl.currentOrigin}…`;
    }
    return "Crawling vendor sites…";
  }
  if (crawl.status === "complete") {
    const quotes = crawl.hosts?.reduce((n, h) => n + (h.quotePages ?? 0), 0) ?? 0;
    return `Vendor research ready — ${quotes} quoteable page(s)`;
  }
  if (crawl.status === "failed") return "Crawl failed";
  if (crawl.status === "not_started") return "No vendor crawl for these URLs yet — start from home.";
  return crawl.status;
}

export async function fetchToolSourceCrawlStatus(
  operatorTools: Array<{ name?: string; url: string }>,
): Promise<ToolSourceCrawlStatus | null> {
  if (operatorTools.length === 0) return null;
  const res = await fetch("/api/gcc-v2/tool-sources/crawl/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operatorTools }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> & { error?: string };
  if (!res.ok) {
    throw new Error(body?.error || `Could not load crawl status (HTTP ${res.status})`);
  }
  if (body?.status === "not_started") return { status: "not_started" };
  return mapCrawlApiBody(body ?? {});
}

export async function startToolSourceCrawlRequest(
  operatorTools: Array<{ name?: string; url: string }>,
  force = false,
): Promise<ToolSourceCrawlStatus> {
  const res = await fetch("/api/gcc-v2/tool-sources/crawl", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operatorTools, force }),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> & { error?: string };
  if (!res.ok) {
    throw new Error(body?.error || `tool source crawl failed: HTTP ${res.status}`);
  }
  return mapCrawlApiBody(body ?? {});
}

export function useToolSourceCrawlHub(
  crawl: ToolSourceCrawlStatus | null,
  setCrawl: (next: ToolSourceCrawlStatus) => void,
  onHubError?: () => void,
) {
  useEffect(() => {
    const runId = crawl?.runId;
    if (!runId || !isCrawlActive(crawl?.status)) return;

    let cancelled = false;
    const connection: HubConnection = createJobHubConnection();
    const runIdRef = { current: runId };

    const offEvents = onCrawlEvent(connection, (evt) => {
      if (cancelled || evt.runId !== runIdRef.current) return;
      setCrawl(mapCrawlEvent(evt));
    });

    const offReconnect = onCrawlHubReconnected(connection, () => runIdRef.current);

    void (async () => {
      try {
        await connection.start();
        if (cancelled) return;
        await joinCrawlRun(connection, runId);
      } catch {
        if (!cancelled) onHubError?.();
      }
    })();

    return () => {
      cancelled = true;
      offEvents();
      offReconnect();
      void connection.stop();
    };
  }, [crawl?.runId, crawl?.status, onHubError, setCrawl]);
}

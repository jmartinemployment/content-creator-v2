"use client";

import { useEffect, useRef } from "react";
import type { HubConnection } from "@microsoft/signalr";
import { HubConnectionState } from "@microsoft/signalr";
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
        const url = normalizeToolUrl(line.slice(pipe + 1).trim());
        if (!url) return null;
        return name ? { name, url } : { url };
      }
      const url = normalizeToolUrl(line);
      if (!url) return null;
      return { url };
    })
    .filter((row): row is { name?: string; url: string } => row !== null);
}

/** Match backend seed normalization — bare domains get https://. */
export function normalizeToolUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const uri = new URL(withProto);
    if (uri.protocol !== "http:" && uri.protocol !== "https:") return null;
    if (!uri.hostname) return null;
    let url = uri.origin + uri.pathname + uri.search;
    if (uri.pathname === "/" || uri.pathname === "") {
      url = url.replace(/\/$/, "");
    }
    return url;
  } catch {
    return null;
  }
}

export function isCrawlActive(status: string | undefined): boolean {
  return status === "pending" || status === "running";
}

function pickString(body: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function mapCrawlApiBody(body: Record<string, unknown>): ToolSourceCrawlStatus {
  const hosts = body.hosts ?? body.Hosts;
  const runIdRaw = body.runId ?? body.RunId ?? body.id ?? body.Id;
  const runId =
    typeof runIdRaw === "string"
      ? runIdRaw.trim() || undefined
      : typeof runIdRaw === "number"
        ? String(runIdRaw)
        : undefined;
  return {
    runId,
    status: pickString(body, "status", "Status") ?? "unknown",
    errorSummary: (pickString(body, "errorSummary", "ErrorSummary") ?? null) as string | null,
    currentOrigin: (pickString(body, "currentOrigin", "CurrentOrigin") ?? null) as string | null,
    hosts: Array.isArray(hosts) ? (hosts as ToolSourceCrawlStatus["hosts"]) : null,
  };
}

/** Prefer run id once a crawl has started — avoids seed-hash lookup misses on status. */
export async function fetchToolSourceCrawlByRunId(runId: string): Promise<ToolSourceCrawlStatus> {
  const res = await fetch(`/api/gcc-v2/tool-sources/crawl/${encodeURIComponent(runId)}`, {
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> & { error?: string };
  if (!res.ok) {
    throw new Error(body?.error || `Could not load crawl (HTTP ${res.status})`);
  }
  return mapCrawlApiBody(body ?? {});
}

export function mergeCrawlStatus(
  prev: ToolSourceCrawlStatus | null,
  next: ToolSourceCrawlStatus | null,
): ToolSourceCrawlStatus | null {
  if (!next) return prev;
  if (!prev) return next;
  if (
    prev.runId &&
    isCrawlActive(prev.status) &&
    next.status === "not_started"
  ) {
    return prev;
  }
  return next;
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
  if (crawl.status === "not_started") return "No crawl yet for these URLs — click Start.";
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
  const status = pickString(body ?? {}, "status", "Status");
  if (status === "not_started") return { status: "not_started" };
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
  const status = pickString(body ?? {}, "status", "Status");
  if (status === "not_started") {
    throw new Error("Server did not start a crawl for these URLs.");
  }
  const mapped = mapCrawlApiBody(body ?? {});
  if (mapped.status === "unknown") {
    throw new Error("Unexpected crawl response from server.");
  }
  if (isCrawlActive(mapped.status) && !mapped.runId) {
    throw new Error("Crawl started but server did not return a run id.");
  }
  return mapped;
}

export function useToolSourceCrawlHub(
  crawl: ToolSourceCrawlStatus | null,
  setCrawl: (next: ToolSourceCrawlStatus) => void,
  onHubError?: () => void,
) {
  const setCrawlRef = useRef(setCrawl);
  const onHubErrorRef = useRef(onHubError);

  useEffect(() => {
    setCrawlRef.current = setCrawl;
    onHubErrorRef.current = onHubError;
  });

  const runId = crawl?.runId;
  const crawlActive = isCrawlActive(crawl?.status);

  useEffect(() => {
    if (!runId || !crawlActive) return;

    let cancelled = false;
    const connection: HubConnection = createJobHubConnection();
    const runIdRef = { current: runId };

    const offEvents = onCrawlEvent(connection, (evt) => {
      if (cancelled || evt.runId !== runIdRef.current) return;
      setCrawlRef.current(mapCrawlEvent(evt));
    });

    const offReconnect = onCrawlHubReconnected(connection, () => runIdRef.current);

    void (async () => {
      try {
        await connection.start();
        if (cancelled) return;
        await joinCrawlRun(connection, runId);
      } catch {
        if (!cancelled) onHubErrorRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
      offEvents();
      offReconnect();
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [runId, crawlActive]);
}

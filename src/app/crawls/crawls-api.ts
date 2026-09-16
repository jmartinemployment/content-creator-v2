import type { CrawlRun } from "./crawl-types";

async function crawlerFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api/geek-crawler/${path.replace(/^\//, "")}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });
}

export async function listCrawls(crawlType?: string): Promise<CrawlRun[]> {
  const query = crawlType ? `?crawlType=${encodeURIComponent(crawlType)}&limit=100` : "?limit=100";
  const response = await crawlerFetch(`crawls${query}`);
  if (!response.ok) throw new Error(`Could not load crawls (HTTP ${response.status}).`);
  return (await response.json()) as CrawlRun[];
}

export async function cancelCrawl(runId: string): Promise<void> {
  const response = await crawlerFetch(`crawls/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
  if (!response.ok) {
    const body = (await response.text().catch(() => "")) || `HTTP ${response.status}`;
    throw new Error(`Cancel failed: ${body}`);
  }
}

/**
 * Deletes vectors first, then crawl data. The backend aborts the whole operation if the vector purge
 * cannot be proven, so a failure here means nothing was deleted.
 */
export async function deleteCrawl(runId: string): Promise<void> {
  const response = await crawlerFetch(`runs/${encodeURIComponent(runId)}`, { method: "DELETE" });
  if (!response.ok) {
    const body = (await response.text().catch(() => "")) || `HTTP ${response.status}`;
    throw new Error(`Delete failed: ${body}`);
  }
}

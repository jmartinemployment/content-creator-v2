export type TaskAgentPageHydrateResult = {
  contractVersion: string;
  finalUrl: string;
  title: string;
  visibleContent: string;
  statusCode: number;
  loadTimeMs: number;
  contentCompleteness: "full" | "partial" | string;
  crawlable: "yes" | "no" | string;
};

export async function fetchTaskAgentPage(url: string): Promise<TaskAgentPageHydrateResult> {
  const response = await fetch("/api/gcc-v2/task-agents/fetch-page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (body && typeof body.error === "string" && body.error)
        || `Page fetch failed (HTTP ${response.status}).`,
    );
  }
  if (!body || typeof body.visibleContent !== "string" || !body.visibleContent.trim()) {
    throw new Error("Page fetch returned no visible content.");
  }
  return body as TaskAgentPageHydrateResult;
}

export function applyPageHydrateToSchemaValues(
  current: Record<string, string>,
  result: TaskAgentPageHydrateResult,
): Record<string, string> {
  const next: Record<string, string> = {
    ...current,
    sourceUrl: result.finalUrl || current.sourceUrl || "",
    visibleContent: result.visibleContent,
    contentCompleteness: result.contentCompleteness || "partial",
  };
  if ("technicalStatusCode" in current || result.statusCode) {
    next.technicalStatusCode = String(result.statusCode);
  }
  if ("technicalLoadTimeMs" in current || result.loadTimeMs) {
    next.technicalLoadTimeMs = String(result.loadTimeMs);
  }
  if ("technicalCrawlable" in current || result.crawlable) {
    next.technicalCrawlable = result.crawlable === "yes" ? "yes" : "no";
  }
  return next;
}

/** Geek-Crawler run snapshot, mirroring GeekCrawlerService.ToSnapshot. */
export type CrawlRun = Readonly<{
  id: string;
  crawlType: string;
  status: string;
  seeds?: readonly string[] | null;
  pageCount?: number | null;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  errorSummary?: string | null;
}>;

/** Statuses where cancelling still means something. */
export const CANCELLABLE = new Set(["queued", "running", "pending", "in_progress"]);

export function isCancellable(status: string): boolean {
  return CANCELLABLE.has(status.trim().toLowerCase());
}

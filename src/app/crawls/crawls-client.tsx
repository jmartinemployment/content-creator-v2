"use client";

import { useCallback, useEffect, useState } from "react";
import { cancelCrawl, deleteCrawl, listCrawls } from "./crawls-api";
import { isCancellable, type CrawlRun } from "./crawl-types";

export function CrawlsClient() {
  const [runs, setRuns] = useState<CrawlRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Delete destroys vectors and crawl data, so it is confirmed per-run rather than fired on click.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRuns(await listCrawls());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load crawls.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCancel(run: CrawlRun) {
    setBusyId(run.id);
    setError(null);
    setNotice(null);
    try {
      await cancelCrawl(run.id);
      setNotice(`Cancelled ${run.crawlType} run.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cancel failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(run: CrawlRun) {
    setBusyId(run.id);
    setError(null);
    setNotice(null);
    try {
      await deleteCrawl(run.id);
      setNotice(`Deleted ${run.crawlType} run and its indexed vectors.`);
      setConfirmingId(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--cc-ink)]">Crawls</h1>
          <p className="mt-1 text-sm text-[var(--cc-muted)]">
            Partner, competitor and local crawl runs. Create needs an indexed partner run before it can
            draft.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-[var(--cc-muted)]">Loading crawls…</p>
      ) : runs.length === 0 ? (
        <p className="mt-6 rounded-lg border border-[var(--cc-line)] bg-slate-50 px-4 py-6 text-sm text-[var(--cc-muted)]">
          No crawl runs yet. Without an indexed partner run, Create cannot draft.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {runs.map((run) => (
            <li key={run.id} className="rounded-lg border border-[var(--cc-line)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--cc-ink)]">
                    {run.crawlType} · {run.status}
                    {typeof run.pageCount === "number" ? ` · ${run.pageCount} page(s)` : ""}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--cc-muted)]">{run.id}</p>
                  {run.seeds?.length ? (
                    <p className="mt-1 break-all text-xs text-[var(--cc-muted)]">
                      {run.seeds.slice(0, 3).join(", ")}
                      {run.seeds.length > 3 ? ` +${run.seeds.length - 3} more` : ""}
                    </p>
                  ) : null}
                  {run.errorSummary ? (
                    <p className="mt-1 text-xs text-amber-800">{run.errorSummary}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-2">
                  {isCancellable(run.status) ? (
                    <button
                      type="button"
                      disabled={busyId === run.id}
                      onClick={() => void onCancel(run)}
                      className="rounded-lg border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {busyId === run.id ? "Cancelling…" : "Cancel"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === run.id}
                    onClick={() => setConfirmingId(confirmingId === run.id ? null : run.id)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {confirmingId === run.id ? (
                <div
                  role="alertdialog"
                  aria-label={`Confirm delete ${run.crawlType} run`}
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                >
                  <p className="text-xs text-red-900">
                    Permanently delete this run? Its indexed vectors are purged first, then its pages and
                    links. Anything grounded on this run loses its evidence. This cannot be undone.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === run.id}
                      onClick={() => void onDelete(run)}
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busyId === run.id ? "Deleting…" : "Delete permanently"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === run.id}
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg border border-[var(--cc-line)] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

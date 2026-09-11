"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listGrids, runDueGridSchedules } from "@/app/grid/grid-api";
import type { GridSummary } from "@/app/grid/grid-types";
import { fetchObservedTelemetry } from "@/app/roi/roi-api";
import type { ObservedTelemetry } from "@/app/roi/roi-model";

export function WorkspaceOpsCard() {
  const [grids, setGrids] = useState<GridSummary[]>([]);
  const [observed, setObserved] = useState<ObservedTelemetry | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      listGrids().catch(() => [] as GridSummary[]),
      fetchObservedTelemetry(90).catch(() => null),
    ])
      .then(([nextGrids, nextObserved]) => {
        setGrids(nextGrids);
        setObserved(nextObserved);
      })
      .finally(() => setReady(true));
  }, []);

  const dueGrids = grids.filter((grid) => grid.schedule?.enabled && grid.schedule.due);
  const scheduledCount = grids.filter((grid) => grid.schedule?.enabled).length;

  async function runDue() {
    if (dueGrids.length === 0) return;
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runDueGridSchedules();
      setGrids(result.grids);
      setNotice(
        result.ranCount > 0
          ? `Ran ${result.ranCount} due schedule${result.ranCount === 1 ? "" : "s"}.`
          : "No due schedules fired.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run due schedules.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm"
      aria-label="Workspace operations"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--cc-ink)]">Operations</h2>
          <p className="mt-1 text-sm text-[var(--cc-muted)]">
            Live due Grid schedules and observed ROI capacity.
          </p>
        </div>
        <button
          type="button"
          disabled={!ready || running || dueGrids.length === 0}
          onClick={() => void runDue()}
          className="rounded-lg bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {running
            ? "Running…"
            : dueGrids.length > 0
              ? `Run due (${dueGrids.length})`
              : "No due schedules"}
        </button>
      </div>

      {!ready ? (
        <p className="mt-4 text-sm text-[var(--cc-muted)]">Loading operations…</p>
      ) : (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--cc-muted)]">Due schedules</dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">{dueGrids.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--cc-muted)]">Enabled schedules</dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">{scheduledCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--cc-muted)]">Accepted (90d)</dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">
              {observed?.acceptedCount ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--cc-muted)]">Published (90d)</dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">
              {observed?.publishedCount ?? "—"}
            </dd>
          </div>
        </dl>
      )}

      {dueGrids.length > 0 ? (
        <ul className="mt-4 space-y-2" aria-label="Due schedule grids">
          {dueGrids.slice(0, 3).map((grid) => (
            <li key={grid.id} className="text-sm">
              <Link
                href={`/grid/${encodeURIComponent(grid.id)}`}
                className="font-semibold text-[var(--cc-accent)] underline"
              >
                {grid.name}
              </Link>
              <span className="text-[var(--cc-muted)]">
                {" "}
                · {grid.schedule?.cadence} · {grid.schedule?.mode}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-[var(--cc-ink)]">{notice}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/grid" className="font-semibold text-[var(--cc-accent)] underline">
          Open Grid
        </Link>
        <Link href="/roi" className="font-semibold text-[var(--cc-accent)] underline">
          Open ROI
        </Link>
      </div>
    </section>
  );
}

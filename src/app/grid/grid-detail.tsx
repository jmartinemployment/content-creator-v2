"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createGridRun, getGrid } from "@/app/grid/grid-api";
import {
  estimateBudget,
  inputPreview,
  outputPreview,
  selectRowsForRun,
  succeededCount,
} from "@/app/grid/grid-model";
import type { Grid, GridRowStatus } from "@/app/grid/grid-types";

const rowStatusStyles: Record<GridRowStatus, string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  running: "border-amber-200 bg-amber-50 text-amber-800",
  succeeded: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-red-200 bg-red-50 text-red-800",
  skipped: "border-slate-200 bg-slate-50 text-slate-500",
};

export function GridDetail({ gridId }: { gridId: string }) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void getGrid(gridId)
      .then(setGrid)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load grid."))
      .finally(() => setReady(true));
  }, [gridId]);

  const samplePreview = useMemo(() => {
    if (!grid) return null;
    const rows = selectRowsForRun(grid.rows, "sample", 10);
    return estimateBudget(grid.config, rows.length);
  }, [grid]);

  if (!ready) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-[var(--cc-muted)]">Loading grid…</main>;
  }

  if (!grid) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold text-[var(--cc-accent)]">Batch</p>
        <h1 className="mt-2 text-2xl font-semibold">Grid not found</h1>
        <p className="mt-3 text-sm text-[var(--cc-muted)]">{error ?? "This grid is not available."}</p>
        <Link href="/grid" className="mt-6 inline-block text-sm font-semibold text-[var(--cc-accent)]">
          ← Back to Grid
        </Link>
      </main>
    );
  }

  const inputColumn = grid.config.columns.find((column) => column.kind === "input");
  const latestRun = grid.runs[0] ?? null;

  async function run(mode: "sample" | "full") {
    setRunning(true);
    setError(null);
    try {
      const updated = await createGridRun(grid!.id, {
        mode,
        sampleSize: mode === "sample" ? 10 : undefined,
      });
      setGrid(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start run.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/grid" className="text-sm font-semibold text-[var(--cc-accent)] hover:underline">
        ← Grid
      </Link>

      <header className="mt-4 rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--cc-accent)]">
                Batch grid
              </p>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                TaskRun execution
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">{grid.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cc-muted)]">{grid.description}</p>
            <p className="mt-3 text-xs leading-5 text-[var(--cc-muted)]">{grid.config.executionNote}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={running}
              onClick={() => void run("sample")}
              className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--cc-ink)] disabled:opacity-50"
            >
              {running ? "Running…" : "Run sample (10)"}
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => void run("full")}
              className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {running ? "Running…" : "Run all rows"}
            </button>
          </div>
        </div>
        {samplePreview ? (
          <p className="mt-4 text-sm text-[var(--cc-muted)]">
            Sample budget preview: {samplePreview.estimatedCredits} credits
            ({samplePreview.creditsPerRow}/row × {samplePreview.rowCount} rows)
          </p>
        ) : null}
        {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
      </header>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border border-[var(--cc-line)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cc-line)] px-5 py-4">
            <div>
              <h2 className="font-semibold text-[var(--cc-ink)]">Work items</h2>
              <p className="mt-0.5 text-xs text-[var(--cc-muted)]">
                {grid.rows.length} rows · {succeededCount(grid)} succeeded
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f7f6] text-xs uppercase tracking-wide text-[var(--cc-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  {grid.config.columns.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-semibold">
                      {column.label}
                      {column.kind === "agent" && column.capability ? (
                        <span className="ml-2 font-normal normal-case text-[var(--cc-muted)]">
                          ({column.capability})
                        </span>
                      ) : null}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--cc-line)] align-top">
                    <td className="px-4 py-3 text-[var(--cc-muted)]">{row.rowIndex + 1}</td>
                    {grid.config.columns.map((column) => (
                      <td key={column.key} className="max-w-xs px-4 py-3 text-[var(--cc-ink)]">
                        {column.kind === "input"
                          ? inputPreview(row, inputColumn?.key ?? "topic")
                          : column.kind === "output"
                            ? outputPreview(row)
                            : column.capability ?? "agent"}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${rowStatusStyles[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">Latest run</h2>
            {latestRun ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Mode</dt>
                  <dd className="font-medium capitalize">{latestRun.mode}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Status</dt>
                  <dd className="font-medium capitalize">{latestRun.status}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Outputs</dt>
                  <dd className="font-medium">{latestRun.outputCount}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Est. credits</dt>
                  <dd className="font-medium">{latestRun.budgetPreview.estimatedCredits}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[var(--cc-muted)]">No runs yet. Start with a 10-row sample.</p>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">History</h2>
            <ul aria-label="Grid run history" className="mt-4 space-y-3">
              {grid.runs.flatMap((run) => run.history).length === 0 ? (
                <li className="text-sm text-[var(--cc-muted)]">History appears after the first run.</li>
              ) : (
                grid.runs.flatMap((run) =>
                  run.history.map((entry, index) => (
                    <li key={`${run.id}-${index}`} className="text-sm">
                      <p className="font-medium text-[var(--cc-ink)]">
                        {entry.mode} · {entry.outputCount} outputs · {entry.estimatedCredits} credits
                      </p>
                      <p className="mt-1 text-xs text-[var(--cc-muted)]">
                        {entry.status} · {entry.durationMs}ms · {new Date(entry.startedAt).toLocaleString()}
                      </p>
                    </li>
                  )),
                )
              )}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createGrid, listGrids } from "@/app/grid/grid-api";
import type { GridStatus, GridSummary } from "@/app/grid/grid-types";

const statusStyles: Record<GridStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  ready: "bg-blue-50 text-blue-700",
  running: "bg-amber-50 text-amber-700",
  complete: "bg-emerald-50 text-emerald-700",
};

export function GridList() {
  const [grids, setGrids] = useState<GridSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void listGrids()
      .then(setGrids)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load grids."))
      .finally(() => setReady(true));
  }, []);

  async function onCreateDemo() {
    setCreating(true);
    setError(null);
    try {
      const grid = await createGrid({ seedDemo: true });
      setGrids((current) => [
        {
          id: grid.id,
          name: grid.name,
          description: grid.description,
          status: grid.status,
          updatedAt: grid.updatedAt,
          owner: grid.owner,
          rowCount: grid.rows.length,
          lastRunStatus: grid.runs[0]?.status ?? null,
          persistence: "server",
        },
        ...current,
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create grid.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-[var(--cc-accent)]">Batch</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">Grid</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cc-muted)]">
            Run sample or full batches across work-item rows. Each selected row creates a durable
            TaskRun and completes in-process for this release.
          </p>
        </div>
        <button
          type="button"
          disabled={!ready || creating}
          onClick={() => void onCreateDemo()}
          className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New demo grid"}
        </button>
      </div>

      {error ? <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {!ready ? <p className="mt-8 text-sm text-[var(--cc-muted)]">Loading grids…</p> : null}
      {ready && grids.length === 0 && !error ? (
        <p className="mt-8 rounded-lg border border-[var(--cc-line)] bg-white p-4 text-sm text-[var(--cc-muted)]">
          No grids yet. Create a demo grid to explore sample runs, budgets, and history.
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {grids.map((grid) => (
          <article
            key={grid.id}
            className="group relative rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[grid.status]}`}>
                {grid.status}
              </span>
              <span className="text-xs text-[var(--cc-muted)]">
                Updated {new Date(grid.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[var(--cc-ink)]">
              <Link href={`/grid/${grid.id}`} className="after:absolute after:inset-0 group-hover:text-[var(--cc-accent)]">
                {grid.name}
              </Link>
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-muted)]">{grid.description}</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--cc-line)] pt-4 text-sm">
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Rows</dt>
                <dd className="mt-1 font-semibold text-[var(--cc-ink)]">{grid.rowCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Last run</dt>
                <dd className="mt-1 font-semibold capitalize text-[var(--cc-ink)]">
                  {grid.lastRunStatus ?? "none"}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  changeDeliverableStatus,
  createDeliverable,
  listDeliverables,
  ApiError,
  GCC_DELIVERABLE_STATUSES,
  GCC_DELIVERABLE_STATUS_LABELS,
  type GccDeliverable,
  type GccDeliverableStatus,
  type GccProject,
} from "@/services/gcc-projects-api";

/** "2026-09-21" → "21 Sep". Parsed as parts, never through Date, which would shift the day. */
function shortDate(value: string | null): string {
  if (!value) return "—";
  const [, month, day] = value.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return month && day ? `${day} ${months[month - 1]}` : "—";
}

const STATUS_CLASS: Record<GccDeliverableStatus, string> = {
  planned: "bg-background text-muted",
  in_progress: "bg-amber-100 text-amber-800",
  delivered: "bg-green-100 text-green-800",
};

/**
 * What this project has promised to hand over.
 *
 * A deliverable is a named, dated promise on the project. The project is the unit -- its brief and
 * its drafts are the project's -- so nothing is attached; opening one goes to the project's Brief &
 * Generate, which is where the work is.
 */
export default function ProjectDeliverablesPanel({
  project,
  onOpenWork,
}: {
  project: GccProject;
  onOpenWork: () => void;
}) {
  const [deliverables, setDeliverables] = useState<GccDeliverable[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const forProjectId = project.id;

    void (async () => {
      try {
        const rows = await listDeliverables(forProjectId);
        if (cancelled) return;
        setDeliverables(rows);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Could not load deliverables.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project.id, version]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setAdding(true);
    try {
      await createDeliverable(project.id, { name, dueDate: dueDate || null });
      setName("");
      setDueDate("");
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the deliverable.");
    } finally {
      setAdding(false);
    }
  }

  async function handleStatus(deliverable: GccDeliverable, status: GccDeliverableStatus) {
    setError(null);
    try {
      await changeDeliverableStatus(project.id, deliverable.id, status);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change the status.");
    }
  }

  const inputClass =
    "rounded-md border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Deliverables</h3>
        {deliverables ? (
          <span className="text-sm text-muted">
            {deliverables.filter((d) => d.status === "delivered").length} of {deliverables.length}{" "}
            delivered
          </span>
        ) : null}
      </div>

      {loadError ? <p className="mt-3 text-sm text-red-600">{loadError}</p> : null}
      {!deliverables && !loadError ? <p className="mt-3 text-sm text-muted">Loading…</p> : null}

      {deliverables && deliverables.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nothing promised yet. Add what this project owes below.
        </p>
      ) : null}

      {deliverables && deliverables.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {deliverables.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-3"
            >
              <button
                type="button"
                onClick={onOpenWork}
                className="flex-1 text-left text-sm font-medium text-[#C83803] hover:underline"
              >
                {d.name}
              </button>
              {d.type ? <span className="text-xs text-muted">{d.type}</span> : null}
              {d.dueDate ? (
                <span className="text-xs text-muted">Due {shortDate(d.dueDate)}</span>
              ) : null}
              <select
                value={d.status}
                onChange={(e) => void handleStatus(d, e.target.value as GccDeliverableStatus)}
                className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${STATUS_CLASS[d.status]}`}
              >
                {GCC_DELIVERABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {GCC_DELIVERABLE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-foreground">
          Deliverable
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pillar page and five tool pages"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Due
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={adding || !name.trim()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          {adding ? "Adding…" : "Add deliverable"}
        </button>
      </form>
    </div>
  );
}

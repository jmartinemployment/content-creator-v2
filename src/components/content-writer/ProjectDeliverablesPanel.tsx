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
import { listGccCreates, type GccCreate } from "@/services/gcc-api";

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
 * A deliverable is the project-side record of a create, so this lists the creates that belong to
 * the project's client and lets one be attached. Opening a deliverable opens its create in the
 * draft workspace — the content pipeline is unchanged, this is the schedule around it.
 */
export default function ProjectDeliverablesPanel({
  project,
  onOpenCreate,
}: {
  project: GccProject;
  onOpenCreate: (createId: string) => void;
}) {
  const [deliverables, setDeliverables] = useState<GccDeliverable[] | null>(null);
  const [creates, setCreates] = useState<GccCreate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCreateId, setSelectedCreateId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const forProjectId = project.id;

    void (async () => {
      try {
        const [rows, createRows] = await Promise.all([
          listDeliverables(forProjectId),
          // Only this client's creates can become this project's deliverables — the server refuses
          // anything else, so the picker does not offer it.
          listGccCreates(project.clientId),
        ]);
        if (cancelled) return;
        setDeliverables(rows);
        setCreates(createRows);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Could not load deliverables.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project.id, project.clientId, version]);

  /** Creates not already promised on this project — the ones left to attach. */
  const attached = new Set((deliverables ?? []).map((d) => d.createId));
  const available = creates.filter((c) => !attached.has(c.id));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCreateId) return;
    const create = creates.find((c) => c.id === selectedCreateId);
    if (!create) return;

    setError(null);
    setAdding(true);
    try {
      await createDeliverable(project.id, {
        createId: create.id,
        name: create.topic,
        type: create.startingContentType,
        dueDate: dueDate || null,
      });
      setSelectedCreateId("");
      setDueDate("");
      setVersion((v) => v + 1);
    } catch (err) {
      // A 409 says why: another client's create, or already a deliverable somewhere. Both are the
      // operator's to resolve, so the sentence is shown as sent.
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
          Nothing promised yet. Attach a create below to record it as a deliverable of this project.
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
                onClick={() => onOpenCreate(d.createId)}
                className="flex-1 text-left text-sm font-medium text-brand hover:underline"
              >
                {d.name}
              </button>
              <span className="text-xs text-muted">{d.type}</span>
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
          Attach a create
          <select
            value={selectedCreateId}
            onChange={(e) => setSelectedCreateId(e.target.value)}
            className={inputClass}
          >
            <option value="">
              {available.length === 0 ? "No unattached creates for this client" : "Choose a create"}
            </option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.topic}
              </option>
            ))}
          </select>
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
          disabled={adding || !selectedCreateId}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {adding ? "Adding…" : "Add deliverable"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  changeProjectStatus,
  deleteProjectLogEntry,
  getProjectLog,
  GCC_PROJECT_STATUSES,
  GCC_PROJECT_STATUS_LABELS,
  ApiError,
  type GccProject,
  type GccProjectLogEntry,
  type GccProjectStatus,
} from "@/services/gcc-projects-api";

/** "2026-09-21" → "21 Sep 2026". Parsed as parts, never through Date, which would shift the day. */
function formatDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "—";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${day} ${months[month - 1]} ${year}`;
}

function formatInstant(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/** Today as "YYYY-MM-DD" in the operator's own timezone. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
}

/** How each event type reads. Unknown types show their raw name rather than being hidden. */
const EVENT_LABELS: Record<string, string> = {
  project_created: "Project created",
  project_updated: "Project updated",
  project_status_changed: "Status changed",
  log_entry_deleted: "History entry deleted",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-sm text-foreground">{value}</dd>
    </div>
  );
}

/**
 * The actual declared URLs, not just how many — a count here is a measurement, not the record.
 * These are exactly what ProjectForm's Partner/Competitor URL textareas saved.
 */
function UrlListField({ label, urls }: { label: string; urls: readonly string[] }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label} ({urls.length})
      </dt>
      {urls.length > 0 ? (
        <dd className="mt-1 flex flex-col gap-0.5">
          {urls.map((u) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-xs text-brand hover:underline"
            >
              {u}
            </a>
          ))}
        </dd>
      ) : (
        <dd className="mt-0.5 text-sm text-muted">— none declared</dd>
      )}
    </div>
  );
}

/**
 * A project's profile, schedule and log.
 *
 * The log is shown because it is the record nothing can quietly rewrite — the database still
 * refuses to UPDATE a row in place. A row can be deleted outright since 2026-09-21, but even that
 * leaves a trace: deleting one writes a log_entry_deleted entry recording who removed it and when,
 * so the log still shows a removal happened even though it can no longer show what was removed.
 * Everything above the log describes what the project is now; the log is how it got there.
 */
export default function ProjectProfilePanel({
  project,
  onChanged,
}: {
  project: GccProject;
  onChanged: (project: GccProject) => void;
}) {
  // The log is stored with the project it was fetched for. Clearing it synchronously as the
  // effect starts would cost a second render pass; tagging it means a stale response for the
  // previously selected project can never be shown under this one.
  const [log, setLog] = useState<{ projectId: string; entries: GccProjectLogEntry[] } | null>(null);
  const [logError, setLogError] = useState<{ projectId: string; message: string } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const forProjectId = project.id;

    getProjectLog(forProjectId)
      .then((entries) => {
        if (!cancelled) setLog({ projectId: forProjectId, entries });
      })
      .catch((err) => {
        if (cancelled) return;
        setLogError({
          projectId: forProjectId,
          message: err instanceof ApiError ? err.message : "Could not load the project log.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [project.id, project.updatedAtUtc]);

  const entries = log?.projectId === project.id ? log.entries : null;
  const entriesError = logError?.projectId === project.id ? logError.message : null;

  const [confirmingEntryId, setConfirmingEntryId] = useState<number | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);

  /**
   * Deleting an entry also writes a new one (log_entry_deleted), so the list is refetched rather
   * than spliced locally — the replacement's id, timestamp and actor all come from the server.
   */
  async function handleDeleteEntry(entry: GccProjectLogEntry) {
    setDeleteEntryError(null);
    setDeletingEntryId(entry.id);
    try {
      await deleteProjectLogEntry(project.id, entry.id);
      setConfirmingEntryId(null);
      const refreshed = await getProjectLog(project.id);
      setLog({ projectId: project.id, entries: refreshed });
    } catch (err) {
      setDeleteEntryError(
        err instanceof ApiError ? err.message : "Could not delete that entry.",
      );
    } finally {
      setDeletingEntryId(null);
    }
  }

  async function handleStatus(next: GccProjectStatus) {
    if (next === project.status) return;
    setStatusError(null);
    setSaving(true);
    try {
      // A finish date is required for "finished" and refused for everything else — the API and the
      // database both enforce that pairing, so it is sent to match rather than left to be rejected.
      const updated = await changeProjectStatus(
        project.id,
        next,
        next === "finished" ? today() : null,
      );
      onChanged(updated);
    } catch (err) {
      setStatusError(
        err instanceof ApiError ? err.message : "Could not change the project status.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">{project.name}</h2>
            {project.description ? (
              <p className="mt-1 max-w-2xl text-sm text-muted">{project.description}</p>
            ) : null}
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
            Status
            <select
              value={project.status}
              disabled={saving}
              onChange={(e) => void handleStatus(e.target.value as GccProjectStatus)}
              className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
            >
              {GCC_PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {GCC_PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {statusError ? <p className="mt-3 text-sm text-red-600">{statusError}</p> : null}

        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Start" value={formatDate(project.startDate)} />
          <Field label="Due" value={formatDate(project.dueDate)} />
          <Field label="Finished" value={formatDate(project.finishedDate)} />
          <Field label="Site" value={project.siteUrl ?? "—"} />
          <Field label="Run ID" value={project.projectSiteRunId ?? "— no crawl evidence"} />
        </dl>

        <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <UrlListField label="Partner URLs" urls={project.partnerUrls} />
          <UrlListField label="Competitor URLs" urls={project.competitorUrls} />
        </dl>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">History</h3>

        {entriesError ? <p className="mt-3 text-sm text-red-600">{entriesError}</p> : null}
        {deleteEntryError ? <p className="mt-3 text-sm text-red-600">{deleteEntryError}</p> : null}
        {!entries && !entriesError ? <p className="mt-3 text-sm text-muted">Loading…</p> : null}

        {entries && entries.length === 0 ? (
          // Every project gets a created entry in the same transaction as its insert, so an empty
          // log is not "nothing happened yet" — it means something is wrong worth saying.
          <p className="mt-3 text-sm text-amber-700">
            No history recorded. Every project is created with an entry, so this is unexpected.
          </p>
        ) : null}

        {entries && entries.length > 0 ? (
          <ol className="mt-3 flex flex-col gap-3">
            {entries.map((entry) => {
              const confirming = confirmingEntryId === entry.id;
              const deleting = deletingEntryId === entry.id;
              return (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 border-l-2 border-border pl-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {EVENT_LABELS[entry.eventType] ?? entry.eventType}
                    </p>
                    <p className="text-xs text-muted">{formatInstant(entry.occurredAtUtc)}</p>
                  </div>

                  {/* Permanent — there is no undo, and no soft-delete underneath this one the way
                      a project has. A second, deliberate click is what stands between here and gone. */}
                  {confirming ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteEntry(entry)}
                      disabled={deleting}
                      className="shrink-0 rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Delete for good?"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingEntryId(entry.id)}
                      aria-label="Delete this history entry"
                      title="Delete this history entry"
                      className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-muted hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

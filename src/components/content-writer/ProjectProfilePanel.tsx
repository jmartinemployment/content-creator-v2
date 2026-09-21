"use client";

import { useEffect, useState } from "react";
import {
  changeProjectStatus,
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
 * A project's profile, schedule and log.
 *
 * The log is shown because it is the record nothing can quietly rewrite — the database refuses
 * UPDATE and DELETE on it. Everything above the log describes what the project is now; the log is
 * how it got there.
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
          <Field
            label="Partners / Competitors"
            value={`${project.partnerUrls.length} / ${project.competitorUrls.length}`}
          />
        </dl>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">History</h3>

        {entriesError ? <p className="mt-3 text-sm text-red-600">{entriesError}</p> : null}
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
            {entries.map((entry) => (
              <li key={entry.id} className="border-l-2 border-border pl-3">
                <p className="text-sm font-medium text-foreground">
                  {EVENT_LABELS[entry.eventType] ?? entry.eventType}
                </p>
                <p className="text-xs text-muted">{formatInstant(entry.occurredAtUtc)}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

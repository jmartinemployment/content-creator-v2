"use client";

import { useState } from "react";
import {
  ApiError,
  GCC_PROJECT_STATUS_LABELS,
  deleteProject,
  type GccProject,
  type GccProjectStatus,
} from "@/services/gcc-projects-api";

/** Status colours. Finished and cancelled are both terminal, and read differently on purpose. */
const STATUS_CLASS: Record<GccProjectStatus, string> = {
  planned: "bg-background text-muted",
  active: "bg-green-100 text-green-800",
  on_hold: "bg-amber-100 text-amber-800",
  finished: "bg-brand/10 text-brand",
  cancelled: "bg-border text-muted line-through",
};

/** "2026-09-21" → "21 Sep 2026". Parsed as parts, never through Date, which would shift the day. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${day} ${months[month - 1]} ${year}`;
}

/** Whole days from today to a due date; negative means overdue. */
function daysUntil(due: string): number {
  const [y, m, d] = due.split("-").map(Number);
  const dueUtc = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueUtc - todayUtc) / 86_400_000);
}

/**
 * What a due date means right now, or null when it does not need saying.
 *
 * Only surfaced for projects still running: an overdue badge on a finished project reports on work
 * that is already done, which is noise at best and wrong at worst.
 */
function dueNote(project: GccProject): { text: string; className: string } | null {
  if (!project.dueDate) return null;
  if (project.status === "finished" || project.status === "cancelled") return null;

  const days = daysUntil(project.dueDate);
  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      text: `${overdue} day${overdue === 1 ? "" : "s"} overdue`,
      className: "text-red-600",
    };
  }
  if (days === 0) return { text: "due today", className: "text-amber-700" };
  if (days <= 7) return { text: `due in ${days} day${days === 1 ? "" : "s"}`, className: "text-amber-700" };
  return null;
}

/**
 * This client's projects, newest first.
 *
 * Restores a list to the page. Between `bb8955b` and now there was none: the page opened whichever
 * project happened to come back first and nothing on screen said how many existed, which is how a
 * store that silently deleted them went unnoticed.
 */
export default function ProjectsPanel({
  projects,
  selectedProjectId,
  onSelect,
  onDeleted,
  loading,
}: {
  projects: GccProject[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
  onDeleted: (projectId: string) => void;
  loading: boolean;
}) {
  // Cancelled is a status, shown or hidden here without touching a row. Delete is a separate,
  // real action below — a project can never truly be removed (its log carries a row from the
  // moment it exists, and that log refuses to be edited or removed by design), but the server
  // marks it deleted and this list, like every other read, stops showing it. "Gone" here means
  // gone from view, permanently; there is no undo once it leaves this list.
  const [showCancelled, setShowCancelled] = useState(false);
  const cancelledCount = projects.filter((p) => p.status === "cancelled").length;
  const visible = showCancelled ? projects : projects.filter((p) => p.status !== "cancelled");

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(projectToDelete: GccProject) {
    setDeleteError(null);
    setDeletingId(projectToDelete.id);
    try {
      await deleteProject(projectToDelete.id);
      setConfirmingId(null);
      onDeleted(projectToDelete.id);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : `Could not delete “${projectToDelete.name}”.`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">Projects</h2>
        {/* The count is the point: it is answerable by looking, without a request that changes
            anything. Counts what is shown, not the raw row total — a cancelled duplicate hidden
            from view should not still be counted as if it were live. */}
        <span className="text-sm text-muted">
          {loading ? "Loading…" : `${visible.length} ${visible.length === 1 ? "project" : "projects"}`}
        </span>
      </div>

      {!loading && projects.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No projects for this client yet. Create one below.
        </p>
      ) : null}

      {!loading && cancelledCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowCancelled((v) => !v)}
          className="mt-2 text-xs font-medium text-brand hover:underline"
        >
          {showCancelled
            ? "Hide cancelled"
            : `Show ${cancelledCount} cancelled ${cancelledCount === 1 ? "project" : "projects"}`}
        </button>
      ) : null}

      {deleteError ? <p className="mt-2 text-sm text-red-600">{deleteError}</p> : null}

      <div className="mt-4 flex flex-col gap-2">
        {visible.map((project) => {
          const selected = project.id === selectedProjectId;
          const due = dueNote(project);
          const start = formatDate(project.startDate);
          const confirming = confirmingId === project.id;
          const deleting = deletingId === project.id;
          return (
            <div
              key={project.id}
              className={`flex items-start gap-2 rounded-lg border px-4 py-3 transition-colors ${
                selected
                  ? "border-brand bg-brand/5"
                  : "border-border bg-background hover:border-brand/40"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(project.id)}
                aria-current={selected ? "true" : undefined}
                className="flex flex-1 flex-col items-start gap-1 text-left"
              >
                <span className="flex w-full flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{project.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[project.status]}`}
                  >
                    {GCC_PROJECT_STATUS_LABELS[project.status]}
                  </span>
                  {due ? (
                    <span className={`text-xs font-medium ${due.className}`}>{due.text}</span>
                  ) : null}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  {start ? <span>Started {start}</span> : null}
                  {project.dueDate ? <span>· Due {formatDate(project.dueDate)}</span> : null}
                  {project.siteUrl ? (
                    <span className="break-all">· {project.siteUrl}</span>
                  ) : null}
                </span>
              </button>

              {/* Deletion is permanent from here — there is no undo control anywhere in this UI —
                  so it takes a second, deliberate click rather than firing on the first one. */}
              {confirming ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(project)}
                  disabled={deleting}
                  className="shrink-0 rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete for good?"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(project.id)}
                  aria-label={`Delete ${project.name}`}
                  title={`Delete ${project.name}`}
                  className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-muted hover:bg-red-50 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

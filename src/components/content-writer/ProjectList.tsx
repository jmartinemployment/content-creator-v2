"use client";

import { useState } from "react";
import { deleteProject, ApiError } from "@/services/content-writer-api";
import type { ProjectSummary } from "@/lib/types";

const STATUS_CLASS: Record<string, string> = {
  Draft: "bg-background text-muted",
  Crawling: "bg-amber-100 text-amber-800",
  ReadyForGeneration: "bg-blue-100 text-blue-800",
  Generating: "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
  Failed: "bg-red-100 text-red-800",
};

/**
 * Picking a project opens it underneath this list rather than navigating to it. The list stays on
 * screen while the work happens, so the operator can see which project the panels below belong to.
 */
export default function ProjectList({
  projects,
  selectedProjectId,
  onSelect,
  onDeleted,
}: {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
  onDeleted: (projectId: string) => void;
}) {
  // Two clicks, inline. The client chip needs no confirmation because the server refuses the
  // destructive case; nothing refuses here, so the second click is the guard — and it is a row in
  // the table rather than a modal, so a stray click lands on "Cancel", not on a dialog.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(project: ProjectSummary) {
    setError(null);
    setDeletingId(project.id);
    try {
      await deleteProject(project.id);
      onDeleted(project.id);
      setConfirmingId(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Could not delete “${project.targetKeyword}”.`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted">
        No projects for this client yet — create one above.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Target Keyword</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-right">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const selected = selectedProjectId === project.id;
            return (
              <tr
                key={project.id}
                className={`border-b border-border last:border-0 ${
                  selected ? "bg-brand/5" : "hover:bg-background/60"
                }`}
              >
                {/* The keyword is what the project is about and the only column that helps pick
                    one, so it is what you click. */}
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    aria-current={selected ? "true" : undefined}
                    className={`text-left font-medium text-brand hover:underline ${
                      selected ? "underline" : ""
                    }`}
                  >
                    {project.targetKeyword}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[project.status] ?? ""}`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{new Date(project.createdAtUtc).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  {confirmingId === project.id ? (
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(project)}
                        disabled={deletingId === project.id}
                        className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingId === project.id ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(project.id)}
                      aria-label={`Delete ${project.targetKeyword}`}
                      title={`Delete ${project.targetKeyword}`}
                      className="rounded-full px-2 text-sm leading-none text-muted opacity-60 hover:bg-border hover:opacity-100"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error ? <p className="border-t border-border px-4 py-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

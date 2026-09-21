"use client";

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
}: {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
}) {
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

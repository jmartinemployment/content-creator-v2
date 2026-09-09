"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createProject, listProjects, type ProjectSummary } from "@/app/projects/projects-api";

const statusStyles = {
  planning: "bg-slate-100 text-slate-700",
  "in-progress": "bg-blue-50 text-blue-700",
  review: "bg-amber-50 text-amber-700",
  complete: "bg-emerald-50 text-emerald-700",
} as const;

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void listProjects()
      .then(setProjects)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load projects."))
      .finally(() => setReady(true));
  }, []);

  async function onCreateDemo() {
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({
        name: "Evidence Engine launch",
        seedDemo: true,
      });
      setProjects((current) => [
        {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          updatedAt: project.updatedAt,
          owner: project.owner,
          collaborators: [...project.collaborators],
          persistence: "server",
          assetCount: project.assets.length,
        },
        ...current,
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create project.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-[var(--cc-accent)]">Canvas</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cc-muted)]">
            Organize related assets, immutable versions, and handoffs in one workspace.
          </p>
        </div>
        <button
          type="button"
          disabled={!ready || creating}
          onClick={() => void onCreateDemo()}
          className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New demo project"}
        </button>
      </div>

      {error ? <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {!ready ? <p className="mt-8 text-sm text-[var(--cc-muted)]">Loading projects…</p> : null}
      {ready && projects.length === 0 && !error ? (
        <p className="mt-8 rounded-lg border border-[var(--cc-line)] bg-white p-4 text-sm text-[var(--cc-muted)]">
          No projects yet. Create a demo project to explore the canvas, lineage, and version history.
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <article
            key={project.id}
            className="group relative rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[project.status]}`}>
                {project.status.replace("-", " ")}
              </span>
              <span className="text-xs text-[var(--cc-muted)]">
                Updated {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[var(--cc-ink)]">
              <Link href={`/projects/${project.id}`} className="after:absolute after:inset-0 group-hover:text-[var(--cc-accent)]">
                {project.name}
              </Link>
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-muted)]">{project.description}</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--cc-line)] pt-4 text-sm">
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Assets</dt>
                <dd className="mt-1 font-semibold text-[var(--cc-ink)]">{project.assetCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Persistence</dt>
                <dd className="mt-1 font-semibold text-[var(--cc-ink)]">server</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </main>
  );
}

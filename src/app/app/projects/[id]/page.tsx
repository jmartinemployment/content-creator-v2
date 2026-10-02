"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProjectProfilePanel from "@/components/content-writer/ProjectProfilePanel";
import ProjectWorkPanel from "@/components/content-writer/ProjectWorkPanel";
import ProjectDeliverablesPanel from "@/components/content-writer/ProjectDeliverablesPanel";
import CreateDraftWorkspace from "@/components/content-creator/CreateDraftWorkspace";
import { ApiError, getProject, type GccProject } from "@/services/gcc-projects-api";

/**
 * One project, everything it owns.
 *
 * Split off `/app/workflow`, which had six panels stacked in a single `max-w-4xl` column — profile,
 * history, tasks, time, deliverables and the whole brief-to-generate pipeline — and had stopped fitting.
 * Workflow is now the picker; this is the work.
 *
 * **Two layouts, not one responsive tree.** Desktop puts the section list in a rail beside the content;
 * mobile puts it in a scrolling tab strip above it. Those are different structures rather than the same
 * structure at two widths, so they are written separately and switched with `lg:hidden` /
 * `hidden lg:block`. The selected section is page state, so whichever layout is mounted reads the same
 * value and switching breakpoints mid-task keeps your place.
 */
const SECTIONS = [
  { key: "profile", label: "Profile", blurb: "The engagement: site, schedule, partners, budget." },
  { key: "content", label: "Brief & Generate", blurb: "The brief, generation, and the drafts it produced." },
  { key: "deliverables", label: "Deliverables", blurb: "What this project owes, and what has shipped." },
  { key: "tasks", label: "Tasks & Time", blurb: "Work outstanding, and the hours against it." },
  { key: "history", label: "History", blurb: "Every change to this project, append-only." },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<GccProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionKey>("profile");

  // The create the draft lives on. Resolved by the brief panel, as it was on the workflow page, and
  // reset when the project changes so one project's draft is never shown under another's name.
  const [createId, setCreateId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const row = await getProject(projectId);
        if (cancelled) return;
        setProject(row);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setProject(null);
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? "This project no longer exists."
            : err instanceof Error
              ? err.message
              : "Could not load the project.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const active = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];

  function body() {
    if (!project) return null;
    switch (section) {
      case "profile":
        return <ProjectProfilePanel project={project} onChanged={setProject} />;
      case "content":
        return (
          <CreateDraftWorkspace
            createId={createId}
            clientId={project.clientId}
            projectId={project.id}
            projectSiteRunId={project.projectSiteRunId ?? undefined}
            onCreateMinted={setCreateId}
          />
        );
      case "deliverables":
        return <ProjectDeliverablesPanel project={project} onOpenCreate={(id) => {
          setCreateId(id);
          setSection("content");
        }} />;
      case "tasks":
        return <ProjectWorkPanel project={project} />;
      case "history":
        // History lives inside the profile panel's own log reader. Shown here on its own so the
        // Profile section is the engagement's fields and nothing else.
        return <ProjectProfilePanel project={project} onChanged={setProject} historyOnly />;
      default:
        return null;
    }
  }

  const heading = project?.name ?? (loadError ? "Project" : "Loading…");
  const subheading = project
    ? [project.code, project.siteUrl, project.status].filter(Boolean).join(" · ")
    : null;

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[var(--gcc-ink)] min-h-screen py-5 lg:hidden">
        <div className="px-4">
          <Crumb />
          <h1 className="mt-2 font-display text-2xl font-semibold leading-tight text-white">
            {heading}
          </h1>
          {/* A graphic rule, not text: #c83803 on #0b162a is ~2.5:1, fine for a 3px bar and not for
              anything anyone has to read. */}
          <span className="mt-2 block h-[3px] w-12 rounded-full bg-brand" />
          {subheading ? <p className="mt-1 text-sm text-white/70">{subheading}</p> : null}
        </div>

        {/* A scrolling strip rather than a wrapped row: five labels wrap to three lines on a phone and
            push the content below the fold. Edge-to-edge with inset padding so it reads as scrollable. */}
        <nav className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              aria-current={s.key === section ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                s.key === section
                  ? "bg-white text-brand shadow-sm"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="mt-4 px-3">
          <Surface error={loadError}>{body()}</Surface>
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[var(--gcc-ink)] min-h-screen py-5 hidden lg:block">
        <div className="mx-auto w-full max-w-[1800px] px-8">
          <Crumb />
          <div className="mt-2 flex items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-3xl font-semibold leading-tight text-white">
                {heading}
              </h1>
              <span className="mt-2 block h-[3px] w-14 rounded-full bg-brand" />
              {subheading ? <p className="mt-1 text-sm text-white/70">{subheading}</p> : null}
            </div>
            <p className="max-w-md pb-1 text-right text-sm text-white/60">{active.blurb}</p>
          </div>

          {/* A fixed rail, not a fraction: the section list does not get wider usefully, so giving it a
              percentage would steal space from the content as the viewport grows. */}
          <div className="mt-5 flex items-start gap-6">
            <nav className="sticky top-[5.5rem] w-56 shrink-0">
              <ul className="space-y-1">
                {SECTIONS.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => setSection(s.key)}
                      aria-current={s.key === section ? "page" : undefined}
                      className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        s.key === section
                          ? "border-l-[3px] border-brand bg-white text-brand shadow-sm"
                          : "border-l-[3px] border-transparent text-white/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="min-w-0 flex-1">
              <Surface error={loadError}>{body()}</Surface>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Crumb() {
  return (
    <Link
      href="/app/workflow"
      className="text-sm text-white/60 transition-colors hover:text-white"
    >
      &larr; All projects
    </Link>
  );
}

/**
 * A layout container, not a surface.
 *
 * This was a `--gcc-paper` (#f3f6fb) card, which put a grey layer between the navy page and panels that
 * already draw their own white `bg-surface` card with a border and a shadow — a grey box around a white
 * box, which muted everything inside it. The panels are the surface; this only stacks them.
 *
 * Its own two states still need a card, because they are bare text with no panel around them and would
 * otherwise be dark text on navy.
 */
function Surface({ error, children }: { error: string | null; children: React.ReactNode }) {
  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!children) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm text-muted">Loading the project…</p>
      </div>
    );
  }

  return <div className="flex flex-col gap-6">{children}</div>;
}

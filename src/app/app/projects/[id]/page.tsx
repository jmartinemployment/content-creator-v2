"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ProjectForm from "@/components/content-writer/ProjectForm";
import ProjectProfilePanel from "@/components/content-writer/ProjectProfilePanel";
import ProjectWorkPanel from "@/components/content-writer/ProjectWorkPanel";
import ProjectDeliverablesPanel from "@/components/content-writer/ProjectDeliverablesPanel";
import CreateDraftWorkspace from "@/components/content-creator/CreateDraftWorkspace";
import { ApiError, getProject, type GccProject } from "@/services/gcc-projects-api";
import { listGccCreates, type GccCreate } from "@/services/gcc-api";

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
  { key: "content", label: "Brief & Generate", blurb: "The brief, generation, and the drafts it produced." },
  { key: "profile", label: "Profile", blurb: "The engagement: site, schedule, partners, budget." },
  { key: "deliverables", label: "Deliverables", blurb: "What this project owes, and what has shipped." },
  { key: "tasks", label: "Tasks & Time", blurb: "Work outstanding, and the hours against it." },
  { key: "history", label: "History", blurb: "Every change to this project, append-only." },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const projectId = params.id;

  const [project, setProject] = useState<GccProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Lands on the work, not on reference. Profile is the engagement's fields -- nothing to act on --
  // so opening a freshly created project there left no visible next step. The brief is what a new
  // project needs first, and generate follows it in the same section.
  // Section and edit mode live in the URL, not in state. Two reasons: a section becomes linkable, so
  // somewhere else in the app can send you straight to the one that matters -- which is how the brief's
  // "no partner URLs" message can point at the form that fixes it -- and the back button works.
  const sectionParam = search.get("section");
  const section: SectionKey =
    SECTIONS.find((s) => s.key === sectionParam)?.key ?? "content";
  const editing = search.get("edit") === "1";

  // The create the draft lives on, in the URL for the same reasons as the section. It was component
  // state, so a reload dropped it and the operator landed on an empty brief with no way back to the
  // piece they were working on. The URL is scoped to this project, so one project's create is never
  // shown under another's name. `new` is an explicit empty brief; no value at all means "open this
  // project's most recent piece", resolved below.
  const createParam = search.get("create");
  const createId = createParam && createParam !== "new" ? createParam : null;

  function go(next: SectionKey, edit = false, create: string | null = createParam) {
    const q = new URLSearchParams();
    q.set("section", next);
    if (edit) q.set("edit", "1");
    if (create) q.set("create", create);
    router.replace(`/app/projects/${projectId}?${q.toString()}`, { scroll: false });
  }

  function openCreate(id: string | null) {
    go("content", false, id ?? "new");
  }

  // This project's pieces, newest first. A project opened from the list used to land on an empty
  // "new" brief, its existing creates reachable only through Deliverables or a hand-typed URL (F12).
  const [creates, setCreates] = useState<GccCreate[] | null>(null);
  const [createsError, setCreatesError] = useState<string | null>(null);
  const [createsLoadedFor, setCreatesLoadedFor] = useState(0);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listGccCreates(project.clientId);
        if (cancelled) return;
        setCreates(
          rows
            .filter((c) => c.projectId === project.id)
            .sort((a, b) => b.updatedAtUtc.localeCompare(a.updatedAtUtc)),
        );
        setCreatesError(null);
      } catch (err) {
        if (cancelled) return;
        setCreatesError(err instanceof Error ? err.message : "Could not load this project's pieces.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, createsLoadedFor]);

  // No create in the URL: open the most recent piece, or an empty brief when there is none.
  useEffect(() => {
    if (section !== "content" || createParam !== null || creates === null) return;
    const q = new URLSearchParams();
    q.set("section", "content");
    q.set("create", creates[0]?.id ?? "new");
    router.replace(`/app/projects/${projectId}?${q.toString()}`, { scroll: false });
  }, [section, createParam, creates, projectId, router]);

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
        // Editing runs through ProjectForm, the same component that creates a project, so the index
        // gate travels with it: every partner and competitor URL must still have a usable crawl, and
        // the site URL still has to resolve the run the project is grounded on. A separate URL editor
        // would have skipped that and let a partner be declared with no evidence behind it.
        return editing ? (
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Edit project</h2>
              <button
                type="button"
                onClick={() => go("profile")}
                className="text-sm font-medium text-brand hover:underline"
              >
                Cancel
              </button>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <ProjectForm
                key={project.id}
                clientId={project.clientId}
                project={project}
                onCreated={(saved) => {
                  setProject(saved);
                  go("profile");
                }}
              />
            </div>
          </div>
        ) : (
          <>
            {/* A solid chip, not a text link. This was text-brand directly on the navy ground --
                #c83803 on #0b162a is about 2.5:1, so the only control for editing partner and
                competitor URLs was effectively invisible and went unfound twice. The accent belongs on
                a light surface; on the navy it needs the surface underneath it. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-line">
                Site, schedule, partner and competitor URLs.
              </p>
              <button
                type="button"
                onClick={() => go("profile", true)}
                className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-brand shadow-sm transition-colors hover:bg-paper"
              >
                Edit project &amp; URLs
              </button>
            </div>
            <ProjectProfilePanel project={project} onChanged={setProject} />
          </>
        );
      case "content":
        // Until it is known which piece to open, nothing is shown: an empty brief here would mint a
        // second create beside the one the operator came back for.
        if (createParam === null) {
          return createsError ? (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-foreground">
              This project&rsquo;s pieces could not be loaded, so none was opened: {createsError}{" "}
              <button
                type="button"
                onClick={() => openCreate(null)}
                className="text-brand underline"
              >
                Start a new piece
              </button>
            </p>
          ) : (
            <p className="text-sm text-line">Opening this project&rsquo;s latest piece…</p>
          );
        }
        return (
          <>
          <PieceSwitcher creates={creates} currentId={createId} onOpen={openCreate} />
          <CreateDraftWorkspace
            // One mount per create. The workspace holds a just-minted id in its own state until the
            // URL catches up, so without a remount "Start a new piece" would leave it on the old one.
            key={createId ?? "new"}
            createId={createId}
            clientId={project.clientId}
            projectId={project.id}
            projectSiteRunId={project.projectSiteRunId ?? undefined}
            onCreateMinted={(id) => {
              openCreate(id);
              setCreatesLoadedFor((n) => n + 1);
            }}
            onStartNew={() => openCreate(null)}
          />
          </>
        );
      case "deliverables":
        return <ProjectDeliverablesPanel project={project} onOpenCreate={openCreate} />;
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
          {subheading ? <p className="mt-1 text-sm text-[var(--gcc-line)]">{subheading}</p> : null}
        </div>

        {/* A scrolling strip rather than a wrapped row: five labels wrap to three lines on a phone and
            push the content below the fold. Edge-to-edge with inset padding so it reads as scrollable. */}
        <nav className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(s.key)}
              aria-current={s.key === section ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                s.key === section
                  ? "bg-white text-brand shadow-sm"
                  : "bg-slate text-white hover:bg-navy-raised"
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
              {subheading ? <p className="mt-1 text-sm text-[var(--gcc-line)]">{subheading}</p> : null}
            </div>
            <p className="max-w-md pb-1 text-right text-sm text-[var(--gcc-line)]">{active.blurb}</p>
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
                      onClick={() => go(s.key)}
                      aria-current={s.key === section ? "page" : undefined}
                      className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        s.key === section
                          ? "border-l-[3px] border-brand bg-white text-brand shadow-sm"
                          : "border-l-[3px] border-transparent text-line hover:bg-slate hover:text-white"
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
      className="text-sm text-[var(--gcc-line)] transition-colors hover:text-white"
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

/**
 * Every piece on this project, to switch between. The most recent opens by itself; this is how the
 * others are reached without going through Deliverables.
 */
function PieceSwitcher({
  creates,
  currentId,
  onOpen,
}: {
  creates: GccCreate[] | null;
  currentId: string | null;
  onOpen: (id: string) => void;
}) {
  if (!creates || creates.length < 2) return null;
  return (
    <label className="mb-4 flex flex-wrap items-center gap-2 text-sm text-line">
      Pieces on this project
      <select
        value={currentId ?? ""}
        onChange={(e) => {
          if (e.target.value) onOpen(e.target.value);
        }}
        className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground"
      >
        {currentId === null ? <option value="">New piece</option> : null}
        {creates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.topic} — {new Date(c.updatedAtUtc).toLocaleDateString()}
          </option>
        ))}
      </select>
    </label>
  );
}

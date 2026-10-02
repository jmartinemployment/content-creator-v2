"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ClientsPanel from "@/components/content-writer/ClientsPanel";
import ProjectsPanel from "@/components/content-writer/ProjectsPanel";
import {
  listClients,
  listProjects,
  ApiError,
  type GccClient,
  type GccProject,
} from "@/services/gcc-projects-api";

/**
 * The picker: choose a client, then a project.
 *
 * This page used to be the whole workflow — six panels stacked in one `max-w-4xl` column, from the
 * client list through profile, history, tasks, time and deliverables to the entire brief-and-generate
 * pipeline. It had stopped fitting. Everything a project owns now lives at `/app/projects/[id]`, and
 * choosing a project navigates there.
 *
 * **Two layouts, not one responsive tree.** Side by side above `lg`, stacked below. Those are different
 * structures rather than one structure at two widths, so they are written separately and switched with
 * `lg:hidden` / `hidden lg:block`. Client and project state is page state, so both trees read the same
 * selection.
 */
export default function WorkflowPage() {
  const router = useRouter();

  const [clients, setClients] = useState<GccClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [projects, setProjects] = useState<GccProject[]>([]);
  // Which client the rows in `projects` belong to. Loading is derived from this rather than kept as its
  // own flag: a separate flag has to be set synchronously as the effect starts, and the two can
  // disagree about which client is on screen.
  const [loadedForClientId, setLoadedForClientId] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listClients()
      .then((clientList) => {
        if (cancelled) return;
        setClients(clientList);
        setSelectedClientId(clientList[0]?.id ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.status === 403
            ? "Your sign-in predates client access. Sign out and back in to load clients."
            : err instanceof Error
              ? err.message
              : "Could not reach GeekAPI.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing is set before the first await. State written synchronously in an effect body costs a second
  // render pass, and the cancelled flag is what keeps a slow response for a client the operator has
  // already navigated off from landing on the one they are now looking at.
  useEffect(() => {
    if (!selectedClientId) return;
    let cancelled = false;

    void (async () => {
      try {
        const rows = await listProjects(selectedClientId);
        if (cancelled) return;
        setProjects(rows);
        setProjectsError(null);
        setLoadedForClientId(selectedClientId);
      } catch (err) {
        if (cancelled) return;
        setProjects([]);
        setLoadedForClientId(selectedClientId);
        setProjectsError(
          err instanceof ApiError && err.status === 403
            ? "Your sign-in predates project access. Sign out and back in to see projects."
            : err instanceof ApiError
              ? err.message
              : "Could not load projects.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  function openProject(projectId: string | null) {
    if (projectId) router.push(`/app/projects/${projectId}`);
  }

  function handleClientCreated(client: GccClient) {
    setClients((prev) => [...prev, client]);
    setSelectedClientId(client.id);
  }

  // A project is opened the moment it exists. Creating one is an act of intent -- nobody adds a project
  // to look at the list afterwards.
  function handleProjectCreated(created: GccProject) {
    setProjects((prev) => [created, ...prev]);
    openProject(created.id);
  }

  // Rows are only this client's once the load that fetched them has landed. Without this the previous
  // client's projects stay on screen for the length of the request, under the new client's name.
  const projectsLoading = loadedForClientId !== selectedClientId;
  const visibleProjects = projectsLoading ? [] : projects;

  const clientsPanel = (
    <ClientsPanel
      clients={clients}
      selectedClientId={selectedClientId}
      onSelect={setSelectedClientId}
      onCreated={handleClientCreated}
      onDeleted={(clientId) => {
        const remaining = clients.filter((c) => c.id !== clientId);
        setClients(remaining);
        // Deleting the selected client has to hand the selection on: the projects list is gated on a
        // client, so leaving it null empties the page with clients still sitting above it.
        if (selectedClientId === clientId) setSelectedClientId(remaining[0]?.id ?? null);
      }}
    />
  );

  const projectsSide = selectedClientId ? (
    <>
      <ProjectsPanel
        clientId={selectedClientId}
        projects={visibleProjects}
        selectedProjectId={null}
        onSelect={openProject}
        onCreated={handleProjectCreated}
        onDeleted={(projectId) =>
          setProjects((prev) => prev.filter((p) => p.id !== projectId))
        }
        loading={projectsLoading}
      />
      {projectsError ? <p className="text-sm text-red-600">{projectsError}</p> : null}
    </>
  ) : (
    <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
      Select a client to see its projects. Everything here is scoped to one.
    </p>
  );

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[#025E73] min-h-screen py-5 lg:hidden">
        <div className="px-4">
          <Masthead />
        </div>
        {loadError ? (
          <p className="mt-4 px-4 text-sm text-red-200">{loadError}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-4 px-3">
          <Sheet>{clientsPanel}</Sheet>
          <Sheet>{projectsSide}</Sheet>
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[#025E73] min-h-screen py-5 hidden lg:block">
        <div className="mx-auto w-full max-w-[1800px] px-8">
          <Masthead />
          {loadError ? <p className="mt-4 text-sm text-red-200">{loadError}</p> : null}

          {/* Clients is a short list that does not grow usefully wider, so it takes a fixed rail and the
              projects list — which carries dates, status and a form — gets everything else. */}
          <div className="mt-6 flex items-start gap-6">
            <div className="w-[340px] shrink-0">
              <Sheet>{clientsPanel}</Sheet>
            </div>
            <div className="min-w-0 flex-1">
              <Sheet>{projectsSide}</Sheet>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Masthead() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
        Content Creator
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-white lg:text-3xl">
        Projects
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-white/70">
        Pick a client, then open a project. Each project holds its own brief, deliverables, tasks and
        history &mdash; grounded in the crawl Geek-Crawler already performed for that site.
      </p>
    </div>
  );
}

/**
 * The light sheet the panels sit on.
 *
 * Every panel is styled for the app's paper background — `text-foreground` on `bg-surface` with
 * `border-border`. Dropping them onto the teal would put dark text on a dark ground, so the teal is the
 * page and this is the sheet. That is what keeps this a layout change rather than a restyle of
 * everything underneath it.
 */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--gcc-paper)] p-4 shadow-xl sm:p-6">
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

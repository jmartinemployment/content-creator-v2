"use client";

import { useEffect, useState } from "react";
import ClientsPanel from "@/components/content-writer/ClientsPanel";
import ProjectsPanel from "@/components/content-writer/ProjectsPanel";
import ProjectProfilePanel from "@/components/content-writer/ProjectProfilePanel";
import ProjectWorkPanel from "@/components/content-writer/ProjectWorkPanel";
import ProjectDeliverablesPanel from "@/components/content-writer/ProjectDeliverablesPanel";
import ContentBriefPanel from "@/components/content-creator/ContentBriefPanel";
import CreateDraftWorkspace from "@/components/content-creator/CreateDraftWorkspace";
import {
  listClients,
  listProjects,
  ApiError,
  type GccClient,
  type GccProject,
} from "@/services/gcc-projects-api";

/**
 * The whole workflow, on one page.
 *
 * Client → project → brief → generate → review. The project is an engagement now, not an article:
 * it has a schedule and a site, and the keyword belongs to the piece of content rather than to the
 * project. Several pieces can be written under one project, which is what a project is for.
 */
export default function WorkflowPage() {
  const [clients, setClients] = useState<GccClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [projects, setProjects] = useState<GccProject[]>([]);
  // Which client the rows in `projects` belong to. Loading is derived from this rather than kept
  // as its own flag: a separate flag has to be set synchronously as the effect starts, and the two
  // can disagree about which client is on screen.
  const [loadedForClientId, setLoadedForClientId] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [briefComplete, setBriefComplete] = useState(false);
  // The Content Creator create the draft lives on. A create is not yet owned by a project — that
  // link is gcc_deliverables, which Stage 4 adds — so it resolves the way it always has, from the
  // brief panel, and is cleared whenever the project changes.
  const [createId, setCreateId] = useState<string | null>(null);

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

  // Nothing is set before the first await. State written synchronously in an effect body costs a
  // second render pass, and the cancelled flag is what keeps a slow response for a client the
  // operator has already navigated off from landing on the one they are now looking at.
  useEffect(() => {
    if (!selectedClientId) return;
    let cancelled = false;

    void (async () => {
      try {
        const rows = await listProjects(selectedClientId);
        if (cancelled) return;
        setProjects(rows);
        setProjectsError(null);
        setSelectedProjectId(rows[0]?.id ?? null);
        setLoadedForClientId(selectedClientId);
      } catch (err) {
        if (cancelled) return;
        setProjects([]);
        setSelectedProjectId(null);
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

  /**
   * Selection clears the previous project's draft state here rather than in an effect. Carrying a
   * draft or a brief verdict into the next project would attribute one project's work to another,
   * and doing it at the point of selection means there is no render in between where the old
   * values are shown under the new project.
   */
  function selectProject(projectId: string | null) {
    setSelectedProjectId(projectId);
    setBriefComplete(false);
    setCreateId(null);
  }

  function handleClientCreated(client: GccClient) {
    setClients((prev) => [...prev, client]);
    setSelectedClientId(client.id);
    selectProject(null);
  }

  function handleProjectCreated(created: GccProject) {
    setProjects((prev) => [created, ...prev]);
    selectProject(created.id);
  }

  function handleProjectChanged(updated: GccProject) {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  // Rows are only this client's once the load that fetched them has landed. Without this the
  // previous client's projects stay on screen for the length of the request, under the new
  // client's name.
  const projectsLoading = loadedForClientId !== selectedClientId;
  const visibleProjects = projectsLoading ? [] : projects;
  const project = visibleProjects.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Content Writer v2
        </p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">Workflow</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Grounded in the crawl Geek-Crawler already performed for this site. Add research, generate
          a pillar article + companion content, run editorial review, and publish.
        </p>
      </div>

      {loadError ? <p className="mb-6 text-sm text-red-600">{loadError}</p> : null}

      <div className="flex flex-col gap-6">
        <ClientsPanel
          clients={clients}
          selectedClientId={selectedClientId}
          onSelect={(clientId) => {
            setSelectedClientId(clientId);
            selectProject(null);
          }}
          onCreated={handleClientCreated}
          onDeleted={(clientId) => {
            const remaining = clients.filter((c) => c.id !== clientId);
            setClients(remaining);

            // Deleting the selected client has to hand the selection to another one. Everything
            // below this panel is gated on a client being selected, so leaving it null empties the
            // page from here down: the projects list and the New Project form both vanish, with
            // clients still sitting in the panel above and nothing saying where the rest went.
            if (selectedClientId === clientId) {
              setSelectedClientId(remaining[0]?.id ?? null);
              selectProject(null);
            }
          }}
        />

        {/* The page used to render nothing in every state but "a project is loaded". It ended after
            the form with no explanation, which reads as broken rather than as empty. Each state now
            says what it is and what to do about it. */}
        {!selectedClientId ? (
          <p className="rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted">
            Select a client above to start. Everything below is scoped to it.
          </p>
        ) : null}

        {selectedClientId ? (
          <>
            <ProjectsPanel
              clientId={selectedClientId}
              projects={visibleProjects}
              selectedProjectId={selectedProjectId}
              onSelect={selectProject}
              onCreated={handleProjectCreated}
              onDeleted={(projectId) => {
                setProjects((prev) => prev.filter((p) => p.id !== projectId));

                // Deleting the selected project has to hand the selection to another one, the same
                // rule ClientsPanel's onDeleted follows above — otherwise everything gated on a
                // project (profile, work, deliverables, brief) vanishes with nothing explaining why.
                if (selectedProjectId === projectId) {
                  const remaining = visibleProjects.filter((p) => p.id !== projectId);
                  selectProject(remaining[0]?.id ?? null);
                }
              }}
              loading={projectsLoading}
            />

            {projectsError ? <p className="text-sm text-red-600">{projectsError}</p> : null}
          </>
        ) : null}

        {project ? (
          <>
            <ProjectProfilePanel project={project} onChanged={handleProjectChanged} />

            <ProjectWorkPanel project={project} />

            <ProjectDeliverablesPanel project={project} onOpenCreate={setCreateId} />

            {/* Generate is Content Creator's. The workspace brings its own Content Brief, so the
                standalone brief below is only the way in for a project that has no create yet —
                saving it mints one, and the workspace takes over from there. */}
            {createId ? (
              <CreateDraftWorkspace createId={createId} />
            ) : (
              <>
                <ContentBriefPanel
                  clientId={project.clientId}
                  projectSiteRunId={project.projectSiteRunId ?? undefined}
                  targetKeyword=""
                  onBriefSaved={(savedCreateId, complete) => {
                    setBriefComplete(complete);
                    if (savedCreateId) setCreateId(savedCreateId);
                  }}
                  onBriefValidityChange={setBriefComplete}
                />
                {briefComplete ? null : (
                  <p className="text-sm text-amber-700">
                    Content Brief incomplete — complete it to ensure lede + body honor
                    audience/angle/intent.
                  </p>
                )}
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

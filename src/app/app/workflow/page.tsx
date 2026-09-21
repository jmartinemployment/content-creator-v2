"use client";

import { useEffect, useState } from "react";
import ClientsPanel from "@/components/content-writer/ClientsPanel";
import ProjectForm from "@/components/content-writer/ProjectForm";
import ContentBriefPanel from "@/components/content-creator/ContentBriefPanel";
import CreateDraftWorkspace from "@/components/content-creator/CreateDraftWorkspace";
import { getClients, getProject, getRecentProjects } from "@/services/content-writer-api";
import { isContentBriefComplete, migrateBrief } from "@/lib/content-creator/brief-catalog";
import type { Client, ProjectDetail, ProjectSummary } from "@/lib/types";

/**
 * The whole workflow, on one page.
 *
 * Client → project → brief → tools → generate → review used to be two routes, and the second was
 * reached only by navigating away from the first. Nothing about the work needs that: the operator
 * picks a project and the panels open underneath the list, which stays on screen so it is always
 * visible which project the work below belongs to.
 */
/**
 * The project the list shows first for a client, or null when it has none. The list and this
 * function read the same array in the same order, so what opens is always the top row.
 */
function firstProjectOf(
  projects: ProjectSummary[],
  clientId: string | null,
): string | null {
  if (!clientId) return null;
  return projects.find((p) => p.clientId === clientId)?.id ?? null;
}

export default function WorkflowPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [briefComplete, setBriefComplete] = useState(false);
  // The Content Creator create the draft lives on. It comes off the project when one is already
  // linked; a project that has never had a brief saved has none yet, and saving the brief mints it.
  const [createId, setCreateId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getClients(), getRecentProjects()])
      .then(([clientList, projectList]) => {
        if (cancelled) return;
        setClients(clientList);
        setProjects(projectList);
        const firstClient = clientList[0] ?? null;
        setSelectedClientId(firstClient?.id ?? null);
        // Both halves of the page are populated on arrival. Opening the row the list already
        // shows first means the brief, tools, generate and review below are about a real project
        // rather than waiting on a click to exist at all.
        setSelectedProjectId(firstProjectOf(projectList, firstClient?.id ?? null));
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Could not reach the Content Writer API.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Selection clears the previous project's state here rather than in an effect. Carrying a draft
   * or a brief verdict into the next project would attribute one project's work to another, and
   * doing it at the point of selection means there is no render in between where the old values
   * are shown under the new heading.
   */
  function selectProject(projectId: string | null) {
    setSelectedProjectId(projectId);
    setProject(null);
    setProjectError(null);
    setBriefComplete(false);
    setCreateId(null);
  }

  // The cancelled flag is what keeps a slow response for a project the operator has already
  // navigated off from landing on the one they are now looking at.
  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getProject(selectedProjectId);
        if (cancelled) return;
        setProject(detail);
        setCreateId(detail.linkedCreateId ?? null);
        if (detail.briefJson) {
          const brief = migrateBrief(JSON.parse(detail.briefJson));
          setBriefComplete(isContentBriefComplete(brief));
        }
      } catch (err) {
        if (cancelled) return;
        setProjectError(
          err instanceof Error ? err.message : "Could not load this project.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  function handleClientCreated(client: Client) {
    setClients((prev) => [...prev, client]);
    setSelectedClientId(client.id);
    // A client created a moment ago has no projects; the form below is how it gets one.
    selectProject(null);
  }

  function handleClientSelected(clientId: string) {
    setSelectedClientId(clientId);
    selectProject(firstProjectOf(projects, clientId));
  }

  function handleProjectCreated(created: ProjectSummary) {
    setProjects((prev) => [created, ...prev]);
    selectProject(created.id);
  }

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
          onSelect={handleClientSelected}
          onCreated={handleClientCreated}
          onDeleted={(clientId) => {
            const remaining = clients.filter((c) => c.id !== clientId);
            setClients(remaining);
            // The server cascades, so that client's projects are gone too — drop them here rather
            // than leaving rows that 404 on the next click.
            setProjects((prev) => prev.filter((p) => p.clientId !== clientId));

            // Deleting the selected client has to hand the selection to another one. Everything
            // below this panel is gated on a client being selected, so leaving it null empties the
            // page from here down: the New Project form and the list both vanish, with clients
            // still sitting in the panel above and nothing saying where the rest went.
            if (selectedClientId === clientId) {
              const nextClientId = remaining[0]?.id ?? null;
              setSelectedClientId(nextClientId);
              selectProject(firstProjectOf(projects, nextClientId));
            }
          }}
        />

        {selectedClientId ? (
          <ProjectForm clientId={selectedClientId} onCreated={handleProjectCreated} />
        ) : null}

        {projectError ? <p className="text-sm text-red-600">{projectError}</p> : null}

        {selectedProjectId && !project && !projectError ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : null}

        {project ? (
          <>
            {/* The keyword leads: it is what the piece is about. The project name is a label the
                operator chose and nothing derives from it, so it sits underneath. */}
            <div className="border-t border-border pt-6">
              <h2 className="text-2xl font-bold text-foreground">{project.targetKeyword}</h2>
              <p className="mt-1 text-sm text-muted">
                {project.name} · <span className="break-all">{project.projectUrl}</span>
              </p>
            </div>

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
                  targetKeyword={project.targetKeyword}
                  projectId={project.id}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import HierarchyContextPanel, {
  type HierarchyGateState,
} from "@/components/content-writer/HierarchyContextPanel";
import ContentBriefPanel from "@/components/content-creator/ContentBriefPanel";
import ContentResults from "@/components/content-writer/ContentResults";
import ToolsFromNamesPanel from "@/components/content-writer/ToolsFromNamesPanel";
import ReviewPublishPanel from "@/components/content-writer/ReviewPublishPanel";
import { getProject } from "@/services/content-writer-api";
import { isContentBriefComplete, migrateBrief } from "@/lib/content-creator/brief-catalog";
import type {
  GeneratedContentSet,
  KeywordSourceResponse,
  ProjectDetail,
} from "@/lib/types";

export default function WorkflowProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [keywordSources, setKeywordSources] = useState<KeywordSourceResponse[]>([]);
  const [generated, setGenerated] = useState<GeneratedContentSet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hierarchyGate, setHierarchyGate] = useState<HierarchyGateState>({
    matched: false,
    allowOutsideSiteScope: false,
    loadError: null,
    loading: true,
  });
  const [briefComplete, setBriefComplete] = useState(false);
  const [briefSaved, setBriefSaved] = useState(false);

  const hierarchyOk =
    hierarchyGate.matched || hierarchyGate.allowOutsideSiteScope;
  // Brief is sole research input — no Upload Research Inputs panel; generation is Brief + Hierarchy only.
  const canGenerate =
    hierarchyOk && briefComplete && !hierarchyGate.loading;

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoadError(null);
      const detail = await getProject(projectId);
      setProject(detail);
      setKeywordSources(detail.keywordSources);
      setGenerated(detail.contentSet);
      if (detail.briefJson) {
        const brief = migrateBrief(JSON.parse(detail.briefJson));
        setBriefComplete(isContentBriefComplete(brief));
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not load this project.",
      );
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleProjectUpdated = useCallback((next: ProjectDetail) => {
    setProject(next);
  }, []);

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link
          href="/app/workflow"
          className="mt-4 inline-block text-sm text-brand hover:underline"
        >
          &larr; Back to Workflow
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  // The project's own Run ID. It was resolved when the project was created and stored with it;
  // there is no session state to fall back on, and a fallback would only mask a project saved
  // without one.
  const projectSiteRunId = project.projectSiteRunId ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/app/workflow" className="text-sm text-brand hover:underline">
        &larr; Back to Workflow
      </Link>

      {/* The keyword leads: it is what the piece is about and what the hierarchy match below keys
          on. The project name is a label the operator chose and nothing derives from it, so it
          sits underneath rather than as the page's title. */}
      <div className="mb-8 mt-2">
        <h1 className="text-3xl font-bold text-foreground">{project.targetKeyword}</h1>
        <p className="mt-1 text-sm text-muted">
          {project.name} · <span className="break-all">{project.projectUrl}</span>
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <HierarchyContextPanel
          projectId={project.id}
          targetKeyword={project.targetKeyword}
          projectSiteRunId={projectSiteRunId}
          initialPath={project.hierarchyPath ?? null}
          initialChildren={project.hierarchyChildHeadings ?? []}
          initialSourcePageUrl={project.hierarchySourcePageUrl ?? null}
          initialAllowOutside={project.allowOutsideSiteScope ?? false}
          onProjectUpdated={handleProjectUpdated}
          onGateChange={setHierarchyGate}
        />

        <ContentBriefPanel
          clientId={project.clientId}
          projectSiteRunId={projectSiteRunId ?? undefined}
          targetKeyword={project.targetKeyword}
          createId={project.linkedCreateId ?? undefined}
          projectId={project.id}
          onBriefSaved={(_id, complete) => {
            setBriefSaved(complete);
            setBriefComplete(complete);
          }}
          onBriefValidityChange={setBriefComplete}
        />
        {briefComplete ? null : (
          <p className="text-sm text-amber-700">Content Brief incomplete — Generate will use the saved brief on the linked create; complete the brief to ensure lede + body honor audience/angle/intent.</p>
        )}

        <ToolsFromNamesPanel projectId={project.id} onGenerated={setGenerated} />

        <ContentResults
          projectId={project.id}
          canGenerate={canGenerate}
          result={generated}
          onGenerated={setGenerated}
        />

        <ReviewPublishPanel
          projectId={project.id}
          result={generated}
          onGenerated={setGenerated}
        />
      </div>
    </div>
  );
}

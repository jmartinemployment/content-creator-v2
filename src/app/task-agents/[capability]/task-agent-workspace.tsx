"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StudioFormField } from "@/app/studio/studio-types";
import {
  EMPTY_CONTEXT_SELECTION,
  type ContextSelectionRequest,
  type ResolvedContextPreview,
} from "@/app/brand-sources/context-contract";
import { ContextSelector } from "@/app/creates/new/context-selector";
import {
  adaptTaskAgentInput,
  resolveTaskAgentUiFields,
  schemaFormCanStart,
} from "@/app/task-agents/input-adapters";
import {
  fetchLibraryState,
  putLibraryState,
  type LibrarySavedConfig,
} from "@/app/task-agents/library-preferences";
import {
  findArtifactVersionPayload,
  mergeParentArtifactIntoForm,
} from "@/app/task-agents/merge-parent-artifact";
import { SchemaForm } from "@/app/task-agents/schema-form";
import {
  applyPageHydrateToSchemaValues,
  fetchTaskAgentPage,
} from "@/app/task-agents/page-hydrate";
import {
  TaskAgentResultShell,
  type ResultShellModel,
} from "@/app/task-agents/result-shell";

export type TaskAgentDetail = {
  contractVersion: string;
  agent: {
    id: string;
    displayName: string;
    description: string;
    versionId: string;
    version: string;
    digest: string;
  };
  resultRenderer: { kind?: string; artifactType?: string };
  workflow?: {
    uiSchema?: { fields?: StudioFormField[] };
    endpoint?: string;
    artifactType?: string;
  } | null;
  inputSchema?: unknown;
};

type SharedContextPin = {
  contextManifestId?: string | null;
  contextManifestDigest?: string | null;
};

type TaskRun = {
  id: string;
  status: string;
  phase: string;
  progressPercent: number;
  terminalError?: string | null;
  sharedContext?: SharedContextPin | null;
};

function selectionHasPins(selection: ContextSelectionRequest) {
  return selection.knowledgeAssetVersionIds.length > 0
    || selection.runAttachmentIds.length > 0
    || Boolean(selection.audienceVersionId)
    || Boolean(selection.styleGuideVersionId)
    || Boolean(selection.visualGuidelineVersionId)
    || selection.productSelections.length > 0
    || Boolean(selection.brandKitVersionId);
}

const contractVersions: Record<string, string> = {
  "ai-readiness": "aiReadinessInput.v1",
  "fact-density": "factDensityInput.v1",
  "entity-mapper": "entityMapInput.v1",
  "schema-markup": "schemaMarkupInput.v1",
  "query-planner": "queryPlannerInput.v1",
  "competitor-page": "competitorPageAnalysisInput.v1",
  "content-gap": "contentGapInput.v1",
  "ai-readiness-comparison": "readinessComparisonInput.v1",
  "competitor-audit": "competitorAuditInput.v1",
  "competitor-positioning": "competitorPositioningInput.v1",
  "faq-generator": "faqGeneratorInput.v1",
  "citable-claims": "citableClaimsInput.v1",
  "comparison-brief": "comparisonBriefInput.v1",
  "pillar-outline": "pillarOutlineInput.v1",
  "pillar-article": "pillarArticleInput.v1",
  "competitive-response": "competitiveResponseInput.v1",
};

const intelligenceIds = new Set([
  "query-planner",
  "competitor-page",
  "content-gap",
  "ai-readiness-comparison",
  "competitor-audit",
  "competitor-positioning",
]);

const contentIds = new Set([
  "faq-generator",
  "citable-claims",
  "comparison-brief",
  "pillar-outline",
  "pillar-article",
  "competitive-response",
]);

const pairCompareIds = new Set([
  "content-gap",
  "ai-readiness-comparison",
  "competitor-audit",
  "competitor-positioning",
  "comparison-brief",
  "competitive-response",
]);

function pageSnapshot(
  sourceId: string,
  url: string,
  title: string,
  visibleContent: string,
  contentCompleteness: "full" | "partial" = "full",
) {
  return {
    source: {
      sourceId,
      url: url || undefined,
      title,
    },
    visibleContent,
    mediaType: "text/markdown",
    contentCompleteness,
    evidence: [],
  };
}

function competitorSlug(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-") || "competitor";
}

export function TaskAgentWorkspace({ detail }: { detail: TaskAgentDetail }) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [entitySeeds, setEntitySeeds] = useState("");
  const [hypothesisTopics, setHypothesisTopics] = useState("");
  const [importedQueries, setImportedQueries] = useState("");
  const [faqTopic, setFaqTopic] = useState("");
  const [subjectName, setSubjectName] = useState("Our brand");
  const [vagueStatements, setVagueStatements] = useState("");
  const [competitorName, setCompetitorName] = useState("Competitor");
  const [competitorContent, setCompetitorContent] = useState("");
  const [schemaValues, setSchemaValues] = useState<Record<string, string>>({});
  const [configName, setConfigName] = useState("");
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [configBusy, setConfigBusy] = useState(false);
  const [gscLoadBusy, setGscLoadBusy] = useState(false);
  const [gscNotice, setGscNotice] = useState<string | null>(null);
  const [fetchPageBusy, setFetchPageBusy] = useState(false);
  const [fetchPageNotice, setFetchPageNotice] = useState<string | null>(null);
  const [contextSelection, setContextSelection] = useState<ContextSelectionRequest>(EMPTY_CONTEXT_SELECTION);
  const [contextPreview, setContextPreview] = useState<ResolvedContextPreview | null>(null);
  const [contextUploadProcessing, setContextUploadProcessing] = useState(false);
  const [run, setRun] = useState<TaskRun | null>(null);
  const [result, setResult] = useState<ResultShellModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [lineageParents, setLineageParents] = useState<string[]>([]);
  const [lineageRelationship, setLineageRelationship] = useState<string | undefined>();
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [canvasHandoff, setCanvasHandoff] = useState<{
    projectId: string;
    assetId: string;
    versionId: string;
  } | null>(null);
  const capabilityId = detail.agent.id;
  const schemaFields = useMemo(
    () => resolveTaskAgentUiFields(capabilityId, detail.workflow),
    [capabilityId, detail.workflow],
  );
  const useSchemaDrivenForm = schemaFields.length > 0;
  const isEntityMapper = capabilityId === "entity-mapper";
  const isSchemaMarkup = capabilityId === "schema-markup";
  const isQueryPlanner = capabilityId === "query-planner";
  const isCompetitorPage = capabilityId === "competitor-page";
  const isPairCompare = pairCompareIds.has(capabilityId);
  const isFaqGenerator = capabilityId === "faq-generator";
  const isCitableClaims = capabilityId === "citable-claims";
  const isPillarOutline = capabilityId === "pillar-outline";
  const isComparisonBrief = capabilityId === "comparison-brief";
  const isCompetitiveResponse = capabilityId === "competitive-response";
  const isIntelligence = intelligenceIds.has(capabilityId);
  const isContent = contentIds.has(capabilityId);
  const schemaHasPageHydrate = schemaFields.some((field) => field.id === "sourceUrl")
    && schemaFields.some((field) => field.id === "visibleContent");
  const legacyHasPageHydrate = !useSchemaDrivenForm
    && !isQueryPlanner
    && !isPillarOutline
    && !isPairCompare;
  const showPageHydrate = useSchemaDrivenForm ? schemaHasPageHydrate : legacyHasPageHydrate;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromArtifact = params.get("fromArtifactVersionId");
    if (fromArtifact) setLineageParents([fromArtifact]);
    const relationship = params.get("lineageRelationship");
    if (relationship) setLineageRelationship(relationship);
    const fromRunId = params.get("fromRunId")?.trim() ?? "";

    const topic = params.get("topic")?.trim() ?? "";
    const sourceContent = params.get("sourceContent")?.trim() ?? "";
    const fromCanvasProjectId = params.get("fromCanvasProjectId")?.trim() ?? "";
    const fromCanvasAssetId = params.get("fromCanvasAssetId")?.trim() ?? "";
    const fromCanvasVersionId = params.get("fromCanvasVersionId")?.trim() ?? "";
    if (fromCanvasProjectId && fromCanvasAssetId && fromCanvasVersionId) {
      setCanvasHandoff({
        projectId: fromCanvasProjectId,
        assetId: fromCanvasAssetId,
        versionId: fromCanvasVersionId,
      });
    }
    if (topic || sourceContent) {
      if (topic) setFaqTopic(topic);
      if (sourceContent) {
        setContent(sourceContent);
        setVagueStatements((current) => current || sourceContent);
      }
      setSchemaValues((current) => ({
        ...current,
        ...(topic ? { topic, subjectName: current.subjectName || topic } : {}),
        ...(sourceContent
          ? {
              sourceContent,
              subjectContent: current.subjectContent || sourceContent,
              visibleContent: current.visibleContent || sourceContent,
            }
          : {}),
      }));
    }

    if (fromArtifact && fromRunId) {
      void (async () => {
        try {
          const response = await fetch(
            `/api/gcc-v2/task-agents/runs/${encodeURIComponent(fromRunId)}/result`,
            { cache: "no-store" },
          );
          if (!response.ok) return;
          const parentResult = await response.json() as ResultShellModel & {
            taskInputs?: unknown;
          };
          const found = findArtifactVersionPayload(parentResult, fromArtifact);
          if (!found) return;
          const merged = mergeParentArtifactIntoForm(
            capabilityId,
            found.artifactType,
            found.payload,
            found.taskInputs ?? parentResult.taskInputs,
          );
          if (!merged) return;
          setHandoffNotice(merged.notice);
          if (merged.values.topic) setFaqTopic(merged.values.topic);
          if (merged.values.sourceContent) {
            setContent(merged.values.sourceContent);
            setVagueStatements((current) => current || merged.values.sourceContent!);
          }
          if (merged.values.visibleContent) {
            setContent((current) => current || merged.values.visibleContent!);
          }
          setSchemaValues((current) => ({
            ...current,
            ...Object.fromEntries(
              Object.entries(merged.values).filter(([, value]) => value.length > 0),
            ),
          }));
        } catch {
          /* handoff is best-effort; lineage still recorded */
        }
      })();
    }

    const gscStatus = params.get("gsc")?.trim() ?? "";
    if (gscStatus === "connected") {
      const connectionId = params.get("connectionId")?.trim() ?? "";
      const siteUrl = params.get("siteUrl")?.trim() ?? "";
      if (connectionId) {
        setSchemaValues((current) => ({
          ...current,
          gscConnectionId: connectionId,
          ...(siteUrl ? { gscSiteUrl: siteUrl } : {}),
        }));
        setGscNotice(
          siteUrl
            ? `Connected GSC property ${siteUrl}.`
            : "Connected Google Search Console property.",
        );
      }
      params.delete("gsc");
      params.delete("connectionId");
      params.delete("siteUrl");
      params.delete("message");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    } else if (gscStatus === "error") {
      const message = params.get("message")?.trim() || "Google Search Console connection failed.";
      setError(message);
      params.delete("gsc");
      params.delete("message");
      params.delete("connectionId");
      params.delete("siteUrl");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }

    const savedConfigId = params.get("savedConfigId")?.trim() ?? "";
    if (!savedConfigId) return;
    void fetchLibraryState()
      .then((state) => {
        const match = state.savedConfigs.find((entry) => entry.id === savedConfigId);
        if (!match || match.capabilityId !== capabilityId) {
          setConfigNotice("Saved configuration was not found for this agent.");
          return;
        }
        setSchemaValues((current) => ({ ...current, ...match.values }));
        setConfigName(match.name);
        setConfigNotice(`Restored “${match.name}”.`);
      })
      .catch((cause) => {
        setConfigNotice(cause instanceof Error ? cause.message : "Could not restore saved configuration.");
      });
  }, [capabilityId]);

  useEffect(() => {
    if (!run || ["succeeded", "failed", "cancelled"].includes(run.status)) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      void fetch(`/api/gcc-v2/task-agents/runs/${run.id}`, {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Run status failed (HTTP ${response.status}).`);
        const next = await response.json() as TaskRun;
        if (next.status === "succeeded") {
          const resultResponse = await fetch(`/api/gcc-v2/task-agents/runs/${run.id}/result`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!resultResponse.ok) throw new Error(`Result failed (HTTP ${resultResponse.status}).`);
          setResult(await resultResponse.json() as ResultShellModel);
        } else if (next.status === "failed") {
          setError(next.terminalError || "The task agent failed.");
        }
        setRun((previous) => ({
          ...next,
          sharedContext: next.sharedContext ?? previous?.sharedContext ?? null,
        }));
      }).catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not refresh the task run.");
        }
      });
    }, 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [run]);

  async function loadObservedQueries() {
    const gscConnectionId = (schemaValues.gscConnectionId ?? "").trim();
    if (!gscConnectionId) {
      setError("Enter a Content Creator GSC connection ID first.");
      return;
    }
    setGscLoadBusy(true);
    setGscNotice(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/gcc-v2/task-agents/query-planner/observed-queries?connectionId=${encodeURIComponent(gscConnectionId)}&rowLimit=100`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || `GSC load failed (HTTP ${response.status}).`);
      }
      const queries = Array.isArray(body?.queries)
        ? body.queries
          .map((entry: { query?: string }) => (typeof entry?.query === "string" ? entry.query.trim() : ""))
          .filter(Boolean)
        : [];
      setSchemaValues((current) => ({
        ...current,
        observedQueries: queries.join("\n"),
        gscSourceId: typeof body?.source?.sourceId === "string" ? body.source.sourceId : "",
        gscSiteUrl: typeof body?.siteUrl === "string" ? body.siteUrl : "",
        gscFetchedAtUtc: typeof body?.fetchedAtUtc === "string" ? body.fetchedAtUtc : "",
        gscConnectionId: typeof body?.connectionId === "string"
          ? body.connectionId
          : current.gscConnectionId,
      }));
      setGscNotice(
        queries.length
          ? `Loaded ${queries.length} observed GSC quer${queries.length === 1 ? "y" : "ies"} from ${body?.siteUrl || "Search Console"}. Metrics are not used for planning scores.`
          : "No observed queries were returned for this GSC connection and date range.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load GSC observed queries.");
    } finally {
      setGscLoadBusy(false);
    }
  }

  async function hydrateFromSourceUrl() {
    const url = (useSchemaDrivenForm
      ? (schemaValues.sourceUrl ?? "")
      : sourceUrl).trim();
    if (!url) {
      setError("Enter a Source URL before fetching the page.");
      return;
    }
    setFetchPageBusy(true);
    setFetchPageNotice(null);
    setError(null);
    try {
      const result = await fetchTaskAgentPage(url);
      if (useSchemaDrivenForm) {
        setSchemaValues((current) => applyPageHydrateToSchemaValues(current, result));
      } else {
        setSourceUrl(result.finalUrl || url);
        setContent(result.visibleContent);
      }
      setFetchPageNotice(
        `Fetched ${result.finalUrl || url} (${result.statusCode}, ${result.loadTimeMs} ms, ${result.contentCompleteness}).`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fetch the page.");
    } finally {
      setFetchPageBusy(false);
    }
  }

  async function connectGscProperty() {
    setGscLoadBusy(true);
    setGscNotice(null);
    setError(null);
    try {
      const preferredSite = (schemaValues.gscSiteUrl ?? "").trim();
      const connectUrlParams = new URLSearchParams({
        returnPath: `/task-agents/${capabilityId}`,
      });
      if (preferredSite) connectUrlParams.set("siteUrl", preferredSite);
      const oauthResponse = await fetch(
        `/api/gcc-v2/gsc/oauth/connect-url?${connectUrlParams.toString()}`,
        { cache: "no-store" },
      );
      const oauthBody = await oauthResponse.json().catch(() => null);
      if (oauthResponse.ok && typeof oauthBody?.url === "string" && oauthBody.url) {
        window.location.assign(oauthBody.url);
        return;
      }
      if (oauthResponse.status !== 503 && oauthResponse.status !== 404) {
        throw new Error(oauthBody?.error || `GSC OAuth start failed (HTTP ${oauthResponse.status}).`);
      }

      // Local/e2e fallback when Google OAuth env is unset: register a CC-owned stub connection.
      const response = await fetch("/api/gcc-v2/gsc/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteUrl: preferredSite || "sc-domain:example.test" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || `GSC connect failed (HTTP ${response.status}).`);
      }
      const connectionId = body?.connection?.id;
      if (typeof connectionId !== "string" || !connectionId) {
        throw new Error("GSC connect did not return a connection id.");
      }
      setSchemaValues((current) => ({
        ...current,
        gscConnectionId: connectionId,
        gscSiteUrl: typeof body?.connection?.siteUrl === "string"
          ? body.connection.siteUrl
          : current.gscSiteUrl,
      }));
      setGscNotice(`Connected GSC property ${body?.connection?.siteUrl || "sc-domain:example.test"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect GSC.");
    } finally {
      setGscLoadBusy(false);
    }
  }

  function canStart() {
    if (useSchemaDrivenForm) {
      return schemaFormCanStart(capabilityId, schemaFields, schemaValues);
    }
    if (isQueryPlanner) {
      return hypothesisTopics.trim().length > 0 || importedQueries.trim().length > 0;
    }
    if (isFaqGenerator) {
      return faqTopic.trim().length > 0 && (content.trim().length > 0 || importedQueries.trim().length > 0);
    }
    if (isPillarOutline) {
      return faqTopic.trim().length > 0;
    }
    if (isCitableClaims) {
      return content.trim().length > 0;
    }
    if (isComparisonBrief) {
      return subjectName.trim().length > 0
        && competitorName.trim().length > 0
        && content.trim().length > 0
        && competitorContent.trim().length > 0;
    }
    if (isCompetitorPage) {
      return content.trim().length > 0 && competitorName.trim().length > 0;
    }
    if (isPairCompare) {
      return content.trim().length > 0 && competitorContent.trim().length > 0;
    }
    return content.trim().length > 0;
  }

  function buildCompetitorPage(visibleContent: string) {
    const competitorId = competitorSlug(competitorName);
    return {
      ...pageSnapshot(
        `competitor:${competitorId}`,
        "",
        competitorName.trim() || "Competitor page",
        visibleContent,
      ),
      competitorId,
      competitorName: competitorName.trim() || "Competitor",
    };
  }

  function buildInput(): Record<string, unknown> {
    if (useSchemaDrivenForm) {
      const adapted = adaptTaskAgentInput(capabilityId, schemaValues, detail.contractVersion);
      if (!adapted) throw new Error("Complete the required inputs before running.");
      return adapted;
    }
    const contractVersion = contractVersions[capabilityId] ?? detail.contractVersion;
    if (isQueryPlanner) {
      const topics = hypothesisTopics.split("\n").map((value) => value.trim()).filter(Boolean);
      const queries = importedQueries.split("\n").map((value) => value.trim()).filter(Boolean).map((query) => ({
        query,
        origin: "imported",
        sourceReference: "manual-import",
      }));
      return {
        contractVersion,
        queries,
        hypothesisTopics: topics,
        sources: [],
        maxGeneratedQueries: 20,
      };
    }
    if (isFaqGenerator) {
      const queries = importedQueries.split("\n").map((value) => value.trim()).filter(Boolean).map((query) => ({
        query,
        origin: "imported",
        sourceReference: "manual-import",
      }));
      const input: Record<string, unknown> = {
        contractVersion,
        topic: faqTopic.trim(),
        queries,
        hypothesisTopics: [],
        maxPairs: 8,
      };
      if (content.trim()) {
        input.sourceDocument = {
          source: {
            sourceId: sourceUrl.trim() || `faq-source:${crypto.randomUUID()}`,
            url: sourceUrl.trim() || undefined,
            title: faqTopic.trim() || "FAQ source",
          },
          visibleContent: content.trim(),
          mediaType: "text/markdown",
          contentCompleteness: "full",
          queries: [],
          evidence: [],
        };
      }
      return input;
    }
    if (isCitableClaims) {
      return {
        contractVersion,
        sourceDocument: {
          source: {
            sourceId: sourceUrl.trim() || `claims-source:${crypto.randomUUID()}`,
            url: sourceUrl.trim() || undefined,
            title: "Claims source",
          },
          visibleContent: content.trim(),
          mediaType: "text/markdown",
          contentCompleteness: "full",
          queries: [],
          evidence: [],
        },
        targetStatements: vagueStatements.split("\n").map((value) => value.trim()).filter(Boolean),
        maxClaims: 20,
        insertionTarget: null,
      };
    }
    if (isPillarOutline) {
      const queries = importedQueries.split("\n").map((value) => value.trim()).filter(Boolean).map((query) => ({
        query,
        origin: "imported",
        sourceReference: "manual-import",
      }));
      const input: Record<string, unknown> = {
        contractVersion,
        topic: faqTopic.trim(),
        queries,
        supportingContentHints: hypothesisTopics.split("\n").map((value) => value.trim()).filter(Boolean),
      };
      if (content.trim()) {
        input.sourceDocument = {
          source: {
            sourceId: sourceUrl.trim() || `pillar-source:${crypto.randomUUID()}`,
            url: sourceUrl.trim() || undefined,
            title: faqTopic.trim() || "Pillar source",
          },
          visibleContent: content.trim(),
          mediaType: "text/markdown",
          contentCompleteness: "full",
          queries: [],
          evidence: [],
        };
      }
      return input;
    }
    if (isCompetitorPage) {
      const competitorId = competitorSlug(competitorName);
      return {
        contractVersion,
        page: {
          ...pageSnapshot(
            sourceUrl.trim() || `competitor:${competitorId}`,
            sourceUrl.trim(),
            competitorName.trim() || "Competitor page",
            content.trim(),
          ),
          competitorId,
          competitorName: competitorName.trim() || "Competitor",
        },
      };
    }
    if (capabilityId === "ai-readiness-comparison") {
      return {
        contractVersion,
        subjectPage: pageSnapshot(
          sourceUrl.trim() || `subject:${crypto.randomUUID()}`,
          sourceUrl.trim(),
          "Subject page",
          content.trim(),
        ),
        competitorPages: [buildCompetitorPage(competitorContent.trim())],
      };
    }
    if (capabilityId === "competitor-positioning") {
      const page = buildCompetitorPage(competitorContent.trim());
      const subjectMentionedRaw = (schemaValues.aiObservationSubjectMentioned
        ?? "").trim().toLowerCase();
      const observations = (() => {
        const model = (schemaValues.aiObservationModel ?? "").trim();
        const query = (schemaValues.aiObservationQuery ?? "").trim();
        const rawResponse = (schemaValues.aiObservationRawResponse ?? "").trim();
        const observedAtUtc = (schemaValues.aiObservationObservedAtUtc ?? "").trim();
        if (!model || !query || !rawResponse || !observedAtUtc) return [];
        return [{
          observationId: `obs:${crypto.randomUUID()}`,
          modelOrEngine: model,
          query,
          rawResponse,
          observedAtUtc,
          subjectMentioned: subjectMentionedRaw === "yes"
            ? true
            : subjectMentionedRaw === "no"
              ? false
              : null,
          competitorIdsMentioned:
            (schemaValues.aiObservationCompetitorMentioned ?? "").trim().toLowerCase() === "yes"
              ? [page.competitorId]
              : [],
        }];
      })();
      return {
        contractVersion,
        brandPages: [
          pageSnapshot(
            sourceUrl.trim() || `brand:${crypto.randomUUID()}`,
            sourceUrl.trim(),
            "Brand page",
            content.trim(),
          ),
        ],
        competitorPages: [page],
        aiAnswerObservations: observations,
      };
    }
    if (isComparisonBrief) {
      return {
        contractVersion,
        subjectName: subjectName.trim() || "Our brand",
        competitorName: competitorName.trim() || "Competitor",
        subjectPages: [
          pageSnapshot(
            sourceUrl.trim() || `subject:${crypto.randomUUID()}`,
            sourceUrl.trim(),
            subjectName.trim() || "Subject page",
            content.trim(),
          ),
        ],
        competitorPages: [buildCompetitorPage(competitorContent.trim())],
        decisionCriteria: [],
      };
    }
    if (isCompetitiveResponse) {
      return {
        contractVersion,
        brandPages: [
          pageSnapshot(
            sourceUrl.trim() || `brand:${crypto.randomUUID()}`,
            sourceUrl.trim(),
            subjectName.trim() || "Brand page",
            content.trim(),
          ),
        ],
        competitorPages: [buildCompetitorPage(competitorContent.trim())],
        responseMode: "auto",
        focusQuery: importedQueries.trim() || null,
      };
    }
    if (isPairCompare) {
      return {
        contractVersion,
        subjectPages: [
          pageSnapshot(
            sourceUrl.trim() || `subject:${crypto.randomUUID()}`,
            sourceUrl.trim(),
            "Subject page",
            content.trim(),
          ),
        ],
        competitorPages: [buildCompetitorPage(competitorContent.trim())],
      };
    }
    const input: Record<string, unknown> = {
      contractVersion,
      document: {
        source: {
          sourceId: sourceUrl.trim() || `manual:${crypto.randomUUID()}`,
          url: sourceUrl.trim() || undefined,
          title: sourceUrl.trim() || "Pasted content",
        },
        visibleContent: content,
        mediaType: "text/markdown",
        contentCompleteness: schemaValues.contentCompleteness === "partial" ? "partial" : "full",
        queries: [],
        evidence: [],
      },
    };
    if (isEntityMapper) {
      input.seeds = entitySeeds.split(",").map((value) => value.trim()).filter(Boolean).map((value) => ({
        canonicalName: value,
        entityType: "concept",
        aliases: [],
      }));
    }
    if (isSchemaMarkup) input.requestedTypes = ["Article", "FAQPage"];
    return input;
  }

  async function startRun(options?: {
    retryOfRunId?: string;
    parentArtifactVersionIds?: string[];
    lineageRelationship?: string;
  }) {
    if (!canStart()) return;
    if ((contextPreview?.blockingFindings.length ?? 0) > 0) return;
    setError(null);
    setResult(null);
    setRun(null);
    try {
      const parents = options?.parentArtifactVersionIds?.length
        ? options.parentArtifactVersionIds
        : lineageParents;
      const relationship = options?.lineageRelationship
        ?? (options?.retryOfRunId ? "retry-of" : lineageRelationship);
      const response = await fetch(`/api/gcc-v2/task-agents/${encodeURIComponent(detail.agent.id)}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: buildInput(),
          versionId: detail.agent.versionId,
          retryOfRunId: options?.retryOfRunId,
          ...(selectionHasPins(contextSelection) ? { contextSelection } : {}),
          ...(parents.length
            ? {
              parentArtifactVersionIds: parents,
              lineageRelationship: relationship || "derived-from",
            }
            : {}),
        }),
      });
      const body = await response.json().catch(() => null) as
        | (TaskRun & { error?: string; blockingFindings?: unknown })
        | null;
      if (!response.ok || !body) {
        const blockers = Array.isArray(body?.blockingFindings)
          ? body.blockingFindings.map((finding) => (
            typeof finding === "string"
              ? finding
              : (finding && typeof finding === "object" && "message" in finding
                ? String((finding as { message: unknown }).message)
                : null)
          )).filter(Boolean)
          : [];
        throw new Error(
          blockers.length
            ? blockers.join(" ")
            : (body?.error || `Run failed (HTTP ${response.status}).`),
        );
      }
      setRun(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the task agent.");
    }
  }

  async function saveConfiguration() {
    const name = configName.trim();
    if (!name || !useSchemaDrivenForm) return;
    setConfigBusy(true);
    setConfigNotice(null);
    setError(null);
    try {
      const state = await fetchLibraryState();
      const existing = state.savedConfigs.find(
        (entry) => entry.capabilityId === capabilityId && entry.name === name,
      );
      const nextEntry: LibrarySavedConfig = {
        id: existing?.id ?? crypto.randomUUID(),
        capabilityId,
        name,
        values: { ...schemaValues },
        updatedAtUtc: new Date().toISOString(),
      };
      const savedConfigs = [
        nextEntry,
        ...state.savedConfigs.filter((entry) => entry.id !== nextEntry.id),
      ];
      await putLibraryState({ favorites: state.favorites, savedConfigs });
      setConfigNotice(`Saved “${name}” to Agent Library.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save configuration.");
    } finally {
      setConfigBusy(false);
    }
  }

  async function cancelRun() {
    if (!run || ["succeeded", "failed", "cancelled"].includes(run.status)) return;
    setCancelBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/gcc-v2/task-agents/runs/${run.id}/cancel`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null) as (TaskRun & { error?: string }) | null;
      if (!response.ok || !body) {
        throw new Error(body?.error || `Cancel failed (HTTP ${response.status}).`);
      }
      setRun(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel the task run.");
    } finally {
      setCancelBusy(false);
    }
  }

  const running = run !== null && !["succeeded", "failed", "cancelled"].includes(run.status);
  const contextBlocked = (contextPreview?.blockingFindings.length ?? 0) > 0;
  const pinnedContext = result?.sharedContext ?? run?.sharedContext ?? null;
  const pageHydrateControls = (
    <div className="mt-4 rounded-lg border border-[var(--cc-line)] bg-[var(--cc-paper)] p-3">
      <p className="text-xs text-[var(--cc-muted)]">
        Fetch public page HTML over HTTP (SSRF-gated). Fills visible content from the Source URL.
        JavaScript-rendered pages may be incomplete.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={running || fetchPageBusy}
          onClick={() => void hydrateFromSourceUrl()}
          className="rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {fetchPageBusy ? "Fetching page…" : "Fetch page"}
        </button>
      </div>
      {fetchPageNotice ? (
        <p role="status" className="mt-2 text-xs text-[var(--cc-muted)]">{fetchPageNotice}</p>
      ) : null}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/task-agents" className="text-sm font-semibold text-[var(--cc-accent)] underline">← Task Agents</Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">
        {isContent ? "Runnable content" : isIntelligence ? "Runnable intelligence" : "Runnable diagnostic"}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--cc-ink)]">{detail.agent.displayName}</h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--cc-muted)]">{detail.agent.description}</p>

      <section className="mt-6 rounded-xl border border-[var(--cc-line)] bg-white p-5">
        {useSchemaDrivenForm ? (
          <>
            <SchemaForm
              fields={schemaFields}
              values={schemaValues}
              onChange={setSchemaValues}
              disabled={running}
            />
            {showPageHydrate ? pageHydrateControls : null}
            {isQueryPlanner ? (
              <div className="mt-4 rounded-lg border border-[var(--cc-line)] bg-[var(--cc-paper)] p-3">
                <p className="text-xs text-[var(--cc-muted)]">
                  Connect a Content Creator–owned Google Search Console property, then load queries as{" "}
                  <span className="font-semibold text-[var(--cc-ink)]">observed</span> provenance.
                  This path does not call Geek SEO.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={running || gscLoadBusy}
                    onClick={() => void connectGscProperty()}
                    className="rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Connect GSC property
                  </button>
                  <button
                    type="button"
                    disabled={running || gscLoadBusy}
                    onClick={() => void loadObservedQueries()}
                    className="rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {gscLoadBusy ? "Loading GSC…" : "Load GSC observed queries"}
                  </button>
                </div>
                {gscNotice ? (
                  <p role="status" className="mt-2 text-xs text-[var(--cc-muted)]">{gscNotice}</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : isQueryPlanner ? (
          <>
            <label className="block text-sm font-semibold" htmlFor="hypothesisTopics">
              Hypothesis topics <span className="font-normal text-[var(--cc-muted)]">(one per line)</span>
            </label>
            <textarea
              id="hypothesisTopics"
              value={hypothesisTopics}
              onChange={(event) => setHypothesisTopics(event.target.value)}
              rows={5}
              placeholder={"AI content readiness\nCompetitor comparison queries"}
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="importedQueries">
              Imported queries <span className="font-normal text-[var(--cc-muted)]">(optional, one per line)</span>
            </label>
            <textarea
              id="importedQueries"
              value={importedQueries}
              onChange={(event) => setImportedQueries(event.target.value)}
              rows={5}
              placeholder="how to measure AI readiness"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <p className="mt-3 text-xs text-[var(--cc-muted)]">
              Generated planner output is labeled as hypotheses, not measured demand.
            </p>
          </>
        ) : isFaqGenerator ? (
          <>
            <label className="block text-sm font-semibold" htmlFor="faqTopic">Topic</label>
            <input
              id="faqTopic"
              value={faqTopic}
              onChange={(event) => setFaqTopic(event.target.value)}
              placeholder="AI content readiness"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="importedQueries">
              FAQ questions <span className="font-normal text-[var(--cc-muted)]">(one per line)</span>
            </label>
            <textarea
              id="importedQueries"
              value={importedQueries}
              onChange={(event) => setImportedQueries(event.target.value)}
              rows={4}
              placeholder={"What is AI content readiness?\nCan I measure readiness?"}
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="taskSourceUrl">
              Source URL <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
            </label>
            <input
              id="taskSourceUrl"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.com/page"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
            />
            {pageHydrateControls}
            <label className="mt-5 block text-sm font-semibold" htmlFor="taskContent">
              Source content <span className="font-normal text-[var(--cc-muted)]">(ground answers in visible copy)</span>
            </label>
            <textarea
              id="taskContent"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={12}
              placeholder="Paste page copy with headings and answers…"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <p className="mt-3 text-xs text-[var(--cc-muted)]">
              Answers include evidence spans when source content supports them. Downstream: Schema Markup for FAQPage JSON-LD.
            </p>
          </>
        ) : isCitableClaims ? (
          <>
            <label className="block text-sm font-semibold" htmlFor="taskSourceUrl">
              Source URL <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
            </label>
            <input
              id="taskSourceUrl"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.com/page"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
            />
            {pageHydrateControls}
            <label className="mt-5 block text-sm font-semibold" htmlFor="taskContent">Source content</label>
            <textarea
              id="taskContent"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={12}
              placeholder="Paste source material with specific facts…"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="vagueStatements">
              Vague statements to rewrite <span className="font-normal text-[var(--cc-muted)]">(optional, one per line)</span>
            </label>
            <textarea
              id="vagueStatements"
              value={vagueStatements}
              onChange={(event) => setVagueStatements(event.target.value)}
              rows={4}
              placeholder="Our product is trusted by many teams"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <p className="mt-3 text-xs text-[var(--cc-muted)]">
              Claims never invent statistics. Unsupported rewrites stay labeled unsupported.
            </p>
          </>
        ) : isPillarOutline ? (
          <>
            <label className="block text-sm font-semibold" htmlFor="faqTopic">Topic</label>
            <input
              id="faqTopic"
              value={faqTopic}
              onChange={(event) => setFaqTopic(event.target.value)}
              placeholder="AI content operations"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="importedQueries">
              Related queries <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
            </label>
            <textarea
              id="importedQueries"
              value={importedQueries}
              onChange={(event) => setImportedQueries(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="hypothesisTopics">
              Supporting content hints <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
            </label>
            <textarea
              id="hypothesisTopics"
              value={hypothesisTopics}
              onChange={(event) => setHypothesisTopics(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="taskContent">
              Source content <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
            </label>
            <textarea
              id="taskContent"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            <p className="mt-3 text-xs text-[var(--cc-muted)]">
              This produces a topic-cluster outline, not a full drafted article.
            </p>
          </>
        ) : (
          <>
            {!isCompetitorPage ? (
              <>
                <label className="block text-sm font-semibold" htmlFor="taskSourceUrl">
                  Source URL <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
                </label>
                <input
                  id="taskSourceUrl"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://example.com/page"
                  className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                />
                {!isPairCompare ? pageHydrateControls : null}
              </>
            ) : null}
            {(isCompetitorPage || isPairCompare) ? (
              <>
                {(isComparisonBrief || isCompetitiveResponse) ? (
                  <>
                    <label className={`${isCompetitorPage ? "block" : "mt-5 block"} text-sm font-semibold`} htmlFor="subjectName">
                      {isCompetitiveResponse ? "Brand name" : "Subject name"}
                    </label>
                    <input
                      id="subjectName"
                      value={subjectName}
                      onChange={(event) => setSubjectName(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                    />
                  </>
                ) : null}
                <label className="mt-5 block text-sm font-semibold" htmlFor="competitorName">
                  Competitor name
                </label>
                <input
                  id="competitorName"
                  value={competitorName}
                  onChange={(event) => setCompetitorName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                />
              </>
            ) : null}
            {isCompetitorPage ? (
              <>
                <label className="mt-5 block text-sm font-semibold" htmlFor="taskSourceUrl">
                  Competitor URL <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
                </label>
                <input
                  id="taskSourceUrl"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://competitor.example/page"
                  className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                />
                {pageHydrateControls}
              </>
            ) : null}
            <label className="mt-5 block text-sm font-semibold" htmlFor="taskContent">
              {isPairCompare
                ? (isCompetitiveResponse || capabilityId === "competitor-positioning" ? "Brand page content" : "Subject page content")
                : isCompetitorPage ? "Competitor page content" : "Visible page content"}
            </label>
            <textarea
              id="taskContent"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={isPairCompare ? 8 : 14}
              placeholder="Paste the complete visible page copy or Markdown…"
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
            />
            {isPairCompare ? (
              <>
                <label className="mt-5 block text-sm font-semibold" htmlFor="competitorContent">Competitor page content</label>
                <textarea
                  id="competitorContent"
                  value={competitorContent}
                  onChange={(event) => setCompetitorContent(event.target.value)}
                  rows={8}
                  placeholder="Paste competitor visible copy…"
                  className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
                />
                {capabilityId === "competitor-positioning" ? (
                  <p className="mt-3 text-xs text-[var(--cc-muted)]">
                    Messaging hypotheses are labeled generated, not measured market perception. Optional AI-answer observations can be attached later with model, query, raw response, and date.
                  </p>
                ) : null}
                {isCompetitiveResponse ? (
                  <>
                    <label className="mt-5 block text-sm font-semibold" htmlFor="importedQueries">
                      Focus query <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
                    </label>
                    <input
                      id="importedQueries"
                      value={importedQueries}
                      onChange={(event) => setImportedQueries(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                    />
                    <p className="mt-3 text-xs text-[var(--cc-muted)]">
                      Response angles are hypotheses. This agent does not copy competitor prose.
                    </p>
                  </>
                ) : null}
                {isComparisonBrief ? (
                  <p className="mt-3 text-xs text-[var(--cc-muted)]">
                    Verdict framing is a heuristic from supplied page signals, not a measured ranking.
                  </p>
                ) : null}
              </>
            ) : null}
            {isEntityMapper ? (
              <>
                <label className="mt-5 block text-sm font-semibold" htmlFor="entitySeeds">
                  Entity seeds <span className="font-normal text-[var(--cc-muted)]">(comma-separated)</span>
                </label>
                <input
                  id="entitySeeds"
                  value={entitySeeds}
                  onChange={(event) => setEntitySeeds(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                />
              </>
            ) : null}
          </>
        )}
        <ContextSelector
          value={contextSelection}
          selectedAgentIds={[detail.agent.id]}
          onChange={setContextSelection}
          onPreviewChange={setContextPreview}
          onProcessingChange={setContextUploadProcessing}
          resolvePath="/api/gcc-v2/context/resolve-task-agent"
          allowAttachments={false}
          checkLabel="Check Geek IQ"
        />
        {useSchemaDrivenForm ? (
          <div className="mt-5 rounded-lg border border-[var(--cc-line)] bg-[var(--cc-paper)] p-3" data-testid="save-agent-config">
            <label className="block text-sm font-semibold text-[var(--cc-ink)]">
              Save configuration name
              <input
                value={configName}
                onChange={(event) => setConfigName(event.target.value)}
                disabled={running || configBusy}
                placeholder="Partial readiness check"
                className="mt-2 w-full rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <button
              type="button"
              disabled={running || configBusy || !configName.trim() || !canStart()}
              onClick={() => void saveConfiguration()}
              className="mt-3 rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {configBusy ? "Saving…" : "Save configuration"}
            </button>
            {configNotice ? (
              <p role="status" className="mt-2 text-xs text-[var(--cc-muted)]">{configNotice}</p>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={!canStart() || running || contextBlocked || contextUploadProcessing}
          onClick={() => void startRun()}
          className="mt-5 rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {running ? "Running…" : `Run ${detail.agent.displayName}`}
        </button>
      </section>

      {lineageParents.length ? (
        <p role="status" className="mt-5 rounded-lg border border-teal-200 bg-teal-50/50 px-4 py-3 text-sm text-teal-950">
          This run will derive from artifact <span className="font-mono text-xs">{lineageParents[0]}</span>
          {lineageRelationship ? ` (${lineageRelationship})` : ""}.
        </p>
      ) : null}

      {handoffNotice ? (
        <p
          role="status"
          data-testid="artifact-handoff-notice"
          className="mt-3 rounded-lg border border-[var(--cc-line)] bg-[var(--cc-paper)] px-4 py-3 text-sm text-[var(--cc-ink)]"
        >
          {handoffNotice}
        </p>
      ) : null}

      {canvasHandoff ? (
        <p role="status" className="mt-5 rounded-lg border border-teal-200 bg-teal-50/50 px-4 py-3 text-sm text-teal-950">
          Prefills arrived from Canvas asset{" "}
          <span className="font-mono text-xs">{canvasHandoff.assetId}</span>
          {" · "}
          <Link
            href={`/projects/${encodeURIComponent(canvasHandoff.projectId)}`}
            className="font-semibold underline"
          >
            Back to project
          </Link>
        </p>
      ) : null}

      {run ? (
        <section aria-live="polite" className="mt-5 rounded-xl border border-[var(--cc-line)] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Run status</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{run.status}</span>
              {running ? (
                <button
                  type="button"
                  disabled={cancelBusy}
                  onClick={() => void cancelRun()}
                  className="rounded-lg border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {cancelBusy ? "Cancelling…" : "Cancel run"}
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-sm text-[var(--cc-muted)]">{run.phase} · {run.progressPercent}%</p>
          {pinnedContext?.contextManifestDigest ? (
            <p className="mt-2 font-mono text-xs text-[var(--cc-muted)]" data-testid="shared-context-digest">
              Geek IQ digest · {pinnedContext.contextManifestDigest}
            </p>
          ) : null}
        </section>
      ) : null}
      {error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}

      {result ? (
        <TaskAgentResultShell
          result={result}
          rendererKind={detail.resultRenderer.kind}
          rendererArtifactType={detail.resultRenderer.artifactType}
          onRerun={() => void startRun({
            retryOfRunId: result.rerun.retryOfRunId,
            parentArtifactVersionIds: result.rerun.parentArtifactVersionIds,
            lineageRelationship: "retry-of",
          })}
        />
      ) : null}
    </main>
  );
}

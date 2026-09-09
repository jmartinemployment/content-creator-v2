"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StudioFormField } from "@/app/studio/studio-types";
import {
  adaptTaskAgentInput,
  resolveTaskAgentUiFields,
  schemaFormCanStart,
} from "@/app/task-agents/input-adapters";
import { SchemaForm } from "@/app/task-agents/schema-form";
import { TaskAgentResultRenderer } from "@/app/task-agents/result-renderers";

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

type TaskRun = {
  id: string;
  status: string;
  phase: string;
  progressPercent: number;
  terminalError?: string | null;
};

type ResultShell = {
  contractVersion: string;
  identity: { displayName: string; objective: string };
  progress: { status: string; phase: string; progressPercent: number };
  artifacts: Array<{
    id: string;
    artifactType: string;
    versions: Array<{
      id: string;
      payloadJson: string;
      evidenceJson: string;
      citationsJson: string;
      digest: string;
      validationState: string;
    }>;
  }>;
  rerun: { capabilityId: string; versionId: string; retryOfRunId: string };
};

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

function pageSnapshot(sourceId: string, url: string, title: string, visibleContent: string) {
  return {
    source: {
      sourceId,
      url: url || undefined,
      title,
    },
    visibleContent,
    mediaType: "text/markdown",
    contentCompleteness: "full",
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
  const [run, setRun] = useState<TaskRun | null>(null);
  const [result, setResult] = useState<ResultShell | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          setResult(await resultResponse.json() as ResultShell);
        } else if (next.status === "failed") {
          setError(next.terminalError || "The task agent failed.");
        }
        setRun(next);
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
        competitorPages: [buildCompetitorPage(competitorContent.trim())],
        aiAnswerObservations: [],
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
        contentCompleteness: "full",
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

  async function startRun(retryOfRunId?: string) {
    if (!canStart()) return;
    setError(null);
    setResult(null);
    setRun(null);
    try {
      const response = await fetch(`/api/gcc-v2/task-agents/${encodeURIComponent(detail.agent.id)}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: buildInput(),
          versionId: detail.agent.versionId,
          retryOfRunId,
        }),
      });
      const body = await response.json().catch(() => null) as (TaskRun & { error?: string }) | null;
      if (!response.ok || !body) throw new Error(body?.error || `Run failed (HTTP ${response.status}).`);
      setRun(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the task agent.");
    }
  }

  const artifactVersion = result?.artifacts[0]?.versions.at(-1);
  const artifactPayload = artifactVersion ? JSON.parse(artifactVersion.payloadJson) as Record<string, unknown> : null;
  const running = run !== null && !["succeeded", "failed", "cancelled"].includes(run.status);

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
          <SchemaForm
            fields={schemaFields}
            values={schemaValues}
            onChange={setSchemaValues}
            disabled={running}
          />
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
        <button
          type="button"
          disabled={!canStart() || running}
          onClick={() => void startRun()}
          className="mt-5 rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {running ? "Running…" : `Run ${detail.agent.displayName}`}
        </button>
      </section>

      {run ? (
        <section aria-live="polite" className="mt-5 rounded-xl border border-[var(--cc-line)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">Run status</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{run.status}</span>
          </div>
          <p className="mt-2 text-sm text-[var(--cc-muted)]">{run.phase} · {run.progressPercent}%</p>
        </section>
      ) : null}
      {error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}

      {result && artifactPayload && artifactVersion ? (
        <section className="mt-5 rounded-xl border border-[var(--cc-line)] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Result</h2>
            </div>
            <button type="button" onClick={() => void startRun(result.rerun.retryOfRunId)} className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold">Run again</button>
          </div>
          <div className="mt-4">
            <TaskAgentResultRenderer
              kind={detail.resultRenderer.kind}
              artifactType={detail.resultRenderer.artifactType}
              payload={artifactPayload}
              digest={artifactVersion.digest}
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}

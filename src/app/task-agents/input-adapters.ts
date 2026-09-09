import type { StudioFormField } from "@/app/studio/studio-types";

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

function lines(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

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

/** Default Studio-compatible uiSchema for first-party seeded agents. */
export const DEFAULT_TASK_AGENT_UI_SCHEMAS: Record<string, StudioFormField[]> = {
  "ai-readiness": [
    {
      id: "sourceUrl",
      label: "Source URL",
      type: "shortText",
      required: false,
      placeholder: "https://example.com/page",
    },
    {
      id: "visibleContent",
      label: "Visible page content",
      type: "longText",
      required: true,
      placeholder: "Paste the complete visible page copy or Markdown…",
    },
  ],
  "query-planner": [
    {
      id: "hypothesisTopics",
      label: "Hypothesis topics",
      type: "longText",
      required: false,
      placeholder: "One topic per line",
    },
    {
      id: "importedQueries",
      label: "Imported queries",
      type: "longText",
      required: false,
      placeholder: "One query per line",
    },
  ],
  "faq-generator": [
    {
      id: "topic",
      label: "Topic",
      type: "shortText",
      required: true,
      placeholder: "AI content readiness",
    },
    {
      id: "faqQuestions",
      label: "FAQ questions",
      type: "longText",
      required: false,
      placeholder: "One question per line",
    },
    {
      id: "sourceContent",
      label: "Source content",
      type: "longText",
      required: false,
      placeholder: "Paste answer-bearing source Markdown…",
    },
    {
      id: "sourceUrl",
      label: "Source URL",
      type: "shortText",
      required: false,
    },
  ],
  "citable-claims": [
    {
      id: "sourceContent",
      label: "Source content",
      type: "longText",
      required: true,
      placeholder: "Paste source material with specific facts…",
    },
    {
      id: "vagueStatements",
      label: "Vague statements to rewrite",
      type: "longText",
      required: false,
      placeholder: "Our product is trusted by many teams",
    },
  ],
};

export function resolveTaskAgentUiFields(
  capabilityId: string,
  workflow: { uiSchema?: { fields?: StudioFormField[] } } | null | undefined,
): StudioFormField[] {
  const fromWorkflow = workflow?.uiSchema?.fields;
  if (Array.isArray(fromWorkflow) && fromWorkflow.length > 0) return fromWorkflow;
  return DEFAULT_TASK_AGENT_UI_SCHEMAS[capabilityId] ?? [];
}

export function adaptTaskAgentInput(
  capabilityId: string,
  values: Record<string, string>,
  fallbackContractVersion: string,
): Record<string, unknown> | null {
  const contractVersion = contractVersions[capabilityId] ?? fallbackContractVersion;
  if (capabilityId === "ai-readiness"
    || capabilityId === "fact-density"
    || capabilityId === "entity-mapper"
    || capabilityId === "schema-markup") {
    const visibleContent = (values.visibleContent ?? "").trim();
    if (!visibleContent) return null;
    const sourceUrl = (values.sourceUrl ?? "").trim();
    return {
      contractVersion,
      document: {
        ...pageSnapshot(
          sourceUrl || `document:${crypto.randomUUID()}`,
          sourceUrl,
          "Source page",
          visibleContent,
        ),
        queries: [],
      },
    };
  }
  if (capabilityId === "query-planner") {
    const topics = lines(values.hypothesisTopics);
    const queries = lines(values.importedQueries).map((query) => ({
      query,
      origin: "imported",
      sourceReference: "manual-import",
    }));
    if (topics.length === 0 && queries.length === 0) return null;
    return {
      contractVersion,
      queries,
      hypothesisTopics: topics,
      sources: [],
      maxGeneratedQueries: 20,
    };
  }
  if (capabilityId === "faq-generator") {
    const topic = (values.topic ?? "").trim();
    const sourceContent = (values.sourceContent ?? "").trim();
    const questions = lines(values.faqQuestions);
    if (!topic || (!sourceContent && questions.length === 0)) return null;
    const input: Record<string, unknown> = {
      contractVersion,
      topic,
      queries: questions.map((query) => ({
        query,
        origin: "imported",
        sourceReference: "manual-import",
      })),
      hypothesisTopics: [],
      maxPairs: 8,
    };
    if (sourceContent) {
      const sourceUrl = (values.sourceUrl ?? "").trim();
      input.sourceDocument = {
        source: {
          sourceId: sourceUrl || `faq-source:${crypto.randomUUID()}`,
          url: sourceUrl || undefined,
          title: topic || "FAQ source",
        },
        visibleContent: sourceContent,
        mediaType: "text/markdown",
        contentCompleteness: "full",
        queries: [],
        evidence: [],
      };
    }
    return input;
  }
  if (capabilityId === "citable-claims") {
    const sourceContent = (values.sourceContent ?? "").trim();
    if (!sourceContent) return null;
    return {
      contractVersion,
      document: {
        ...pageSnapshot(
          `claims-source:${crypto.randomUUID()}`,
          "",
          "Claims source",
          sourceContent,
        ),
        queries: [],
      },
      vagueStatements: lines(values.vagueStatements),
    };
  }
  return null;
}

export function schemaFormCanStart(
  capabilityId: string,
  fields: StudioFormField[],
  values: Record<string, string>,
): boolean {
  if (capabilityId === "query-planner") {
    return lines(values.hypothesisTopics).length > 0 || lines(values.importedQueries).length > 0;
  }
  if (capabilityId === "faq-generator") {
    const topic = (values.topic ?? "").trim();
    return topic.length > 0
      && ((values.sourceContent ?? "").trim().length > 0 || lines(values.faqQuestions).length > 0);
  }
  return fields.every((field) => !field.required || (values[field.id] ?? "").trim().length > 0);
}

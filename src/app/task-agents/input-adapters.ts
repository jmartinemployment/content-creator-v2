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
  "pillar-article": "pillarArticleInput.v1",
  "competitive-response": "competitiveResponseInput.v1",
};

function lines(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeContentCompleteness(value: string | undefined): "full" | "partial" {
  return value?.trim().toLowerCase() === "partial" ? "partial" : "full";
}

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

const DIAGNOSTIC_COMPLETENESS_FIELD: StudioFormField = {
  id: "contentCompleteness",
  label: "Source completeness",
  type: "select",
  required: false,
  options: ["full", "partial"],
  placeholder: "full",
};

const DOCUMENT_DIAGNOSTIC_IDS = new Set([
  "ai-readiness",
  "fact-density",
  "entity-mapper",
  "schema-markup",
  "citable-claims",
]);

const PAIR_COMPARE_IDS = new Set([
  "content-gap",
  "ai-readiness-comparison",
  "competitor-audit",
  "competitor-positioning",
  "comparison-brief",
  "competitive-response",
]);

const PAIR_COMPLETENESS_FIELDS: StudioFormField[] = [
  {
    id: "subjectCompleteness",
    label: "Subject source completeness",
    type: "select",
    required: false,
    options: ["full", "partial"],
    placeholder: "full",
  },
  {
    id: "competitorCompleteness",
    label: "Competitor source completeness",
    type: "select",
    required: false,
    options: ["full", "partial"],
    placeholder: "full",
  },
];

function competitorSlug(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "competitor";
}

function competitorPage(
  competitorName: string,
  visibleContent: string,
  sourceUrl = "",
  contentCompleteness: "full" | "partial" = "full",
) {
  const name = competitorName.trim() || "Competitor";
  const competitorId = competitorSlug(name);
  return {
    ...pageSnapshot(
      `competitor:${competitorId}`,
      sourceUrl,
      name,
      visibleContent,
      contentCompleteness,
    ),
    competitorId,
    competitorName: name,
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
    DIAGNOSTIC_COMPLETENESS_FIELD,
  ],
  "fact-density": [
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
    DIAGNOSTIC_COMPLETENESS_FIELD,
  ],
  "entity-mapper": [
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
    {
      id: "entitySeeds",
      label: "Entity seeds",
      type: "shortText",
      required: false,
      placeholder: "Comma-separated entity names",
    },
    DIAGNOSTIC_COMPLETENESS_FIELD,
  ],
  "schema-markup": [
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
    DIAGNOSTIC_COMPLETENESS_FIELD,
  ],
  "query-planner": [
    {
      id: "seoProjectId",
      label: "SEO project ID (GSC)",
      type: "shortText",
      required: false,
      placeholder: "Guid of a Geek SEO project with GSC connected",
    },
    {
      id: "observedQueries",
      label: "Observed GSC queries",
      type: "longText",
      required: false,
      placeholder: "Loaded from Google Search Console (one per line)",
    },
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
  "comparison-brief": [
    {
      id: "subjectName",
      label: "Subject name",
      type: "shortText",
      required: true,
    },
    {
      id: "competitorName",
      label: "Competitor name",
      type: "shortText",
      required: true,
    },
    {
      id: "subjectContent",
      label: "Subject page content",
      type: "longText",
      required: true,
      placeholder: "Paste the complete visible page copy or Markdown…",
    },
    {
      id: "competitorContent",
      label: "Competitor page content",
      type: "longText",
      required: true,
      placeholder: "Paste competitor visible copy…",
    },
    {
      id: "sourceUrl",
      label: "Subject URL",
      type: "shortText",
      required: false,
    },
  ],
  "ai-readiness-comparison": [
    {
      id: "sourceUrl",
      label: "Subject URL",
      type: "shortText",
      required: false,
    },
    {
      id: "subjectContent",
      label: "Subject page content",
      type: "longText",
      required: true,
    },
    {
      id: "competitorContent",
      label: "Competitor page content",
      type: "longText",
      required: true,
    },
  ],
  "content-gap": [
    {
      id: "sourceUrl",
      label: "Subject URL",
      type: "shortText",
      required: false,
    },
    {
      id: "subjectContent",
      label: "Subject page content",
      type: "longText",
      required: true,
    },
    {
      id: "competitorContent",
      label: "Competitor page content",
      type: "longText",
      required: true,
    },
  ],
  "competitor-audit": [
    {
      id: "sourceUrl",
      label: "Subject URL",
      type: "shortText",
      required: false,
    },
    {
      id: "subjectContent",
      label: "Subject page content",
      type: "longText",
      required: true,
    },
    {
      id: "competitorContent",
      label: "Competitor page content",
      type: "longText",
      required: true,
    },
  ],
  "competitor-positioning": [
    {
      id: "sourceUrl",
      label: "Brand URL",
      type: "shortText",
      required: false,
    },
    {
      id: "subjectContent",
      label: "Brand page content",
      type: "longText",
      required: true,
    },
    {
      id: "competitorContent",
      label: "Competitor page content",
      type: "longText",
      required: true,
    },
  ],
  "pillar-outline": [
    {
      id: "topic",
      label: "Topic",
      type: "shortText",
      required: true,
      placeholder: "AI content operations",
    },
    {
      id: "relatedQueries",
      label: "Related queries",
      type: "longText",
      required: false,
      placeholder: "One query per line",
    },
    {
      id: "supportingContentHints",
      label: "Supporting content hints",
      type: "longText",
      required: false,
      placeholder: "One hint per line",
    },
    {
      id: "sourceContent",
      label: "Source content",
      type: "longText",
      required: false,
      placeholder: "Optional source Markdown…",
    },
    {
      id: "sourceUrl",
      label: "Source URL",
      type: "shortText",
      required: false,
    },
  ],
  "pillar-article": [
    {
      id: "topic",
      label: "Topic",
      type: "shortText",
      required: true,
      placeholder: "AI content operations",
    },
    {
      id: "relatedQueries",
      label: "Related queries",
      type: "longText",
      required: false,
      placeholder: "One query per line",
    },
    {
      id: "supportingContentHints",
      label: "Supporting content hints",
      type: "longText",
      required: false,
      placeholder: "One hint per line",
    },
    {
      id: "sourceContent",
      label: "Source content",
      type: "longText",
      required: true,
      placeholder: "Paste source Markdown to ground the pillar draft…",
    },
    {
      id: "sourceUrl",
      label: "Source URL",
      type: "shortText",
      required: false,
    },
  ],
  "competitive-response": [
    {
      id: "brandName",
      label: "Brand name",
      type: "shortText",
      required: true,
    },
    {
      id: "competitorName",
      label: "Competitor name",
      type: "shortText",
      required: true,
    },
    {
      id: "brandContent",
      label: "Brand page content",
      type: "longText",
      required: true,
      placeholder: "Paste brand visible copy…",
    },
    {
      id: "competitorContent",
      label: "Competitor page content",
      type: "longText",
      required: true,
      placeholder: "Paste competitor visible copy…",
    },
    {
      id: "focusQuery",
      label: "Focus query",
      type: "shortText",
      required: false,
    },
    {
      id: "sourceUrl",
      label: "Brand URL",
      type: "shortText",
      required: false,
    },
  ],
};

export function resolveTaskAgentUiFields(
  capabilityId: string,
  workflow: { uiSchema?: { fields?: StudioFormField[] } } | null | undefined,
): StudioFormField[] {
  const fromWorkflow = workflow?.uiSchema?.fields;
  const base = Array.isArray(fromWorkflow) && fromWorkflow.length > 0
    ? fromWorkflow
    : (DEFAULT_TASK_AGENT_UI_SCHEMAS[capabilityId] ?? []);
  let fields = base;
  if (DOCUMENT_DIAGNOSTIC_IDS.has(capabilityId)
    && !fields.some((field) => field.id === "contentCompleteness")) {
    fields = [...fields, DIAGNOSTIC_COMPLETENESS_FIELD];
  }
  if (PAIR_COMPARE_IDS.has(capabilityId) && fields.length > 0) {
    const missing = PAIR_COMPLETENESS_FIELDS.filter(
      (field) => !fields.some((existing) => existing.id === field.id),
    );
    if (missing.length) fields = [...fields, ...missing];
  }
  return fields;
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
    const completeness = normalizeContentCompleteness(values.contentCompleteness);
    const input: Record<string, unknown> = {
      contractVersion,
      document: {
        ...pageSnapshot(
          sourceUrl || `document:${crypto.randomUUID()}`,
          sourceUrl,
          "Source page",
          visibleContent,
          completeness,
        ),
        queries: [],
      },
    };
    if (capabilityId === "entity-mapper") {
      input.seeds = (values.entitySeeds ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => ({
          canonicalName: value,
          entityType: "concept",
          aliases: [],
        }));
    }
    if (capabilityId === "schema-markup") input.requestedTypes = ["Article", "FAQPage"];
    return input;
  }
  if (capabilityId === "query-planner") {
    const topics = lines(values.hypothesisTopics);
    const sourceId = (values.gscSourceId ?? "").trim() || "gsc:manual";
    const observed = lines(values.observedQueries).map((query) => ({
      query,
      origin: "observed",
      sourceId,
      observedAtUtc: (values.gscFetchedAtUtc ?? "").trim() || undefined,
    }));
    const imported = lines(values.importedQueries).map((query) => ({
      query,
      origin: "imported",
      sourceReference: "manual-import",
    }));
    const queries = [...observed, ...imported];
    if (topics.length === 0 && queries.length === 0) return null;
    const sources = observed.length
      ? [{
        sourceId,
        url: (values.gscSiteUrl ?? "").trim() || undefined,
        title: "Google Search Console",
        retrievedAtUtc: (values.gscFetchedAtUtc ?? "").trim() || undefined,
      }]
      : [];
    return {
      contractVersion,
      queries,
      hypothesisTopics: topics,
      sources,
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
    const sourceUrl = (values.sourceUrl ?? "").trim();
    const completeness = normalizeContentCompleteness(values.contentCompleteness);
    return {
      contractVersion,
      sourceDocument: {
        ...pageSnapshot(
          sourceUrl || `claims-source:${crypto.randomUUID()}`,
          sourceUrl,
          "Claims source",
          sourceContent,
          completeness,
        ),
        queries: [],
      },
      targetStatements: lines(values.vagueStatements),
      maxClaims: 20,
      insertionTarget: null,
    };
  }
  if (capabilityId === "comparison-brief") {
    const subjectName = (values.subjectName ?? "").trim();
    const competitorName = (values.competitorName ?? "").trim();
    const subjectContent = (values.subjectContent ?? "").trim();
    const competitorContent = (values.competitorContent ?? "").trim();
    if (!subjectName || !competitorName || !subjectContent || !competitorContent) return null;
    const sourceUrl = (values.sourceUrl ?? "").trim();
    const subjectCompleteness = normalizeContentCompleteness(values.subjectCompleteness);
    const competitorCompleteness = normalizeContentCompleteness(values.competitorCompleteness);
    return {
      contractVersion,
      subjectName,
      competitorName,
      subjectPages: [
        pageSnapshot(
          sourceUrl || `subject:${crypto.randomUUID()}`,
          sourceUrl,
          subjectName,
          subjectContent,
          subjectCompleteness,
        ),
      ],
      competitorPages: [
        competitorPage(competitorName, competitorContent, "", competitorCompleteness),
      ],
      decisionCriteria: [],
    };
  }
  if (
    capabilityId === "content-gap"
    || capabilityId === "competitor-audit"
    || capabilityId === "ai-readiness-comparison"
    || capabilityId === "competitor-positioning"
  ) {
    const subjectContent = (values.subjectContent ?? "").trim();
    const competitorContent = (values.competitorContent ?? "").trim();
    if (!subjectContent || !competitorContent) return null;
    const sourceUrl = (values.sourceUrl ?? "").trim();
    const subjectCompleteness = normalizeContentCompleteness(values.subjectCompleteness);
    const competitorCompleteness = normalizeContentCompleteness(values.competitorCompleteness);
    const subject = pageSnapshot(
      sourceUrl || `subject:${crypto.randomUUID()}`,
      sourceUrl,
      "Subject page",
      subjectContent,
      subjectCompleteness,
    );
    const competitor = competitorPage("Competitor", competitorContent, "", competitorCompleteness);
    if (capabilityId === "ai-readiness-comparison") {
      return {
        contractVersion,
        subjectPage: subject,
        competitorPages: [competitor],
      };
    }
    if (capabilityId === "competitor-positioning") {
      return {
        contractVersion,
        brandPages: [subject],
        competitorPages: [competitor],
        aiAnswerObservations: [],
      };
    }
    return {
      contractVersion,
      subjectPages: [subject],
      competitorPages: [competitor],
    };
  }
  if (capabilityId === "pillar-outline" || capabilityId === "pillar-article") {
    const topic = (values.topic ?? "").trim();
    if (!topic) return null;
    const sourceContent = (values.sourceContent ?? "").trim();
    if (capabilityId === "pillar-article" && !sourceContent) return null;
    const sourceUrl = (values.sourceUrl ?? "").trim();
    const input: Record<string, unknown> = {
      contractVersion,
      topic,
      queries: lines(values.relatedQueries).map((query) => ({
        query,
        origin: "imported",
        sourceReference: "manual-import",
      })),
      supportingContentHints: lines(values.supportingContentHints),
    };
    if (sourceContent) {
      input.sourceDocument = {
        ...pageSnapshot(
          sourceUrl || `pillar-source:${crypto.randomUUID()}`,
          sourceUrl,
          topic,
          sourceContent,
        ),
        queries: [],
      };
    }
    return input;
  }
  if (capabilityId === "competitive-response") {
    const brandName = (values.brandName ?? "").trim();
    const competitorName = (values.competitorName ?? "").trim();
    const brandContent = (values.brandContent ?? "").trim();
    const competitorContent = (values.competitorContent ?? "").trim();
    if (!brandName || !competitorName || !brandContent || !competitorContent) return null;
    const sourceUrl = (values.sourceUrl ?? "").trim();
    const focusQuery = (values.focusQuery ?? "").trim();
    const subjectCompleteness = normalizeContentCompleteness(values.subjectCompleteness);
    const competitorCompleteness = normalizeContentCompleteness(values.competitorCompleteness);
    return {
      contractVersion,
      brandPages: [
        pageSnapshot(
          sourceUrl || `brand:${crypto.randomUUID()}`,
          sourceUrl,
          brandName,
          brandContent,
          subjectCompleteness,
        ),
      ],
      competitorPages: [
        competitorPage(competitorName, competitorContent, "", competitorCompleteness),
      ],
      responseMode: "auto",
      focusQuery: focusQuery || null,
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
    return lines(values.hypothesisTopics).length > 0
      || lines(values.importedQueries).length > 0
      || lines(values.observedQueries).length > 0;
  }
  if (capabilityId === "faq-generator") {
    const topic = (values.topic ?? "").trim();
    return topic.length > 0
      && ((values.sourceContent ?? "").trim().length > 0 || lines(values.faqQuestions).length > 0);
  }
  if (capabilityId === "comparison-brief") {
    return (values.subjectName ?? "").trim().length > 0
      && (values.competitorName ?? "").trim().length > 0
      && (values.subjectContent ?? "").trim().length > 0
      && (values.competitorContent ?? "").trim().length > 0;
  }
  if (capabilityId === "competitive-response") {
    return (values.brandName ?? "").trim().length > 0
      && (values.competitorName ?? "").trim().length > 0
      && (values.brandContent ?? "").trim().length > 0
      && (values.competitorContent ?? "").trim().length > 0;
  }
  if (capabilityId === "pillar-outline") {
    return (values.topic ?? "").trim().length > 0;
  }
  if (capabilityId === "pillar-article") {
    return (values.topic ?? "").trim().length > 0
      && (values.sourceContent ?? "").trim().length > 0;
  }
  return fields.every((field) => !field.required || (values[field.id] ?? "").trim().length > 0);
}

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
  "roi-business-calculator": "roiBusinessCalculatorInput.v1",
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

const OPTIONAL_COMPETITOR_FIELDS: StudioFormField[] = [
  {
    id: "competitorName",
    label: "Competitor 1 name",
    type: "shortText",
    required: false,
    placeholder: "Rival Co",
  },
  {
    id: "competitorContent",
    label: "Competitor 1 page content",
    type: "longText",
    required: true,
  },
  {
    id: "competitor2Name",
    label: "Competitor 2 name",
    type: "shortText",
    required: false,
    placeholder: "Optional second rival",
  },
  {
    id: "competitor2Content",
    label: "Competitor 2 page content",
    type: "longText",
    required: false,
    placeholder: "Optional — up to four competitors",
  },
  {
    id: "competitor3Name",
    label: "Competitor 3 name",
    type: "shortText",
    required: false,
  },
  {
    id: "competitor3Content",
    label: "Competitor 3 page content",
    type: "longText",
    required: false,
  },
  {
    id: "competitor4Name",
    label: "Competitor 4 name",
    type: "shortText",
    required: false,
  },
  {
    id: "competitor4Content",
    label: "Competitor 4 page content",
    type: "longText",
    required: false,
  },
];

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

function collectCompetitorPages(
  values: Record<string, string>,
  defaultCompleteness: "full" | "partial",
): Array<ReturnType<typeof competitorPage>> {
  const pages: Array<ReturnType<typeof competitorPage>> = [];
  const firstContent = (values.competitorContent ?? "").trim();
  if (firstContent) {
    pages.push(competitorPage(
      (values.competitorName ?? "").trim() || "Competitor 1",
      firstContent,
      "",
      defaultCompleteness,
    ));
  }
  for (let index = 2; index <= 4; index += 1) {
    const content = (values[`competitor${index}Content`] ?? "").trim();
    if (!content) continue;
    const completeness = normalizeContentCompleteness(
      values[`competitor${index}Completeness`] ?? values.competitorCompleteness,
    );
    pages.push(competitorPage(
      (values[`competitor${index}Name`] ?? "").trim() || `Competitor ${index}`,
      content,
      "",
      completeness,
    ));
  }
  return pages.slice(0, 4);
}

function parseAiAnswerObservations(
  values: Record<string, string>,
  competitorId: string,
): Array<Record<string, unknown>> {
  const model = (values.aiObservationModel ?? "").trim();
  const query = (values.aiObservationQuery ?? "").trim();
  const rawResponse = (values.aiObservationRawResponse ?? "").trim();
  const observedAtUtc = (values.aiObservationObservedAtUtc ?? "").trim();
  if (!model || !query || !rawResponse || !observedAtUtc) return [];
  const subjectRaw = (values.aiObservationSubjectMentioned ?? "").trim().toLowerCase();
  const subjectMentioned = subjectRaw === "yes"
    ? true
    : subjectRaw === "no"
      ? false
      : null;
  const competitorMentioned = (values.aiObservationCompetitorMentioned ?? "")
    .trim()
    .toLowerCase() === "yes";
  return [{
    observationId: `obs:${crypto.randomUUID()}`,
    modelOrEngine: model,
    query,
    rawResponse,
    observedAtUtc,
    subjectMentioned,
    competitorIdsMentioned: competitorMentioned && competitorId ? [competitorId] : [],
  }];
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
    {
      id: "technicalCrawlable",
      label: "Page crawlable",
      type: "select",
      required: false,
      options: ["yes", "no"],
      placeholder: "yes",
    },
    {
      id: "technicalStatusCode",
      label: "HTTP status code",
      type: "shortText",
      required: false,
      placeholder: "200",
    },
    {
      id: "technicalLoadTimeMs",
      label: "Load time (ms)",
      type: "shortText",
      required: false,
      placeholder: "1800",
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
    {
      id: "competitorUrl",
      label: "Competitor page URL",
      type: "shortText",
      required: false,
      placeholder: "https://competitor.example.com/page",
    },
    {
      id: "competitorContent",
      label: "Competitor page content",
      type: "longText",
      required: false,
      placeholder: "Optional: paste competitor visible copy for coverage comparison…",
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
      id: "gscConnectionId",
      label: "GSC connection ID",
      type: "shortText",
      required: false,
      placeholder: "Content Creator GSC connection Guid",
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
      id: "subjectContent",
      label: "Subject page content",
      type: "longText",
      required: true,
      placeholder: "Paste the complete visible page copy or Markdown…",
    },
    ...OPTIONAL_COMPETITOR_FIELDS,
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
    ...OPTIONAL_COMPETITOR_FIELDS,
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
    ...OPTIONAL_COMPETITOR_FIELDS,
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
    ...OPTIONAL_COMPETITOR_FIELDS,
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
    ...OPTIONAL_COMPETITOR_FIELDS,
    {
      id: "aiObservationModel",
      label: "AI answer model / engine",
      type: "shortText",
      required: false,
      placeholder: "example-engine/v1",
    },
    {
      id: "aiObservationQuery",
      label: "AI answer query",
      type: "shortText",
      required: false,
      placeholder: "best document analyzer",
    },
    {
      id: "aiObservationRawResponse",
      label: "AI answer raw response",
      type: "longText",
      required: false,
      placeholder: "Paste the model’s raw answer text…",
    },
    {
      id: "aiObservationObservedAtUtc",
      label: "AI answer observed at (UTC)",
      type: "shortText",
      required: false,
      placeholder: "2026-09-01T12:00:00Z",
    },
    {
      id: "aiObservationSubjectMentioned",
      label: "Subject mentioned in AI answer",
      type: "select",
      required: false,
      options: ["yes", "no", "unknown"],
      placeholder: "unknown",
    },
    {
      id: "aiObservationCompetitorMentioned",
      label: "Competitor mentioned in AI answer",
      type: "select",
      required: false,
      options: ["yes", "no"],
      placeholder: "no",
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
      id: "brandContent",
      label: "Brand page content",
      type: "longText",
      required: true,
      placeholder: "Paste brand visible copy…",
    },
    ...OPTIONAL_COMPETITOR_FIELDS,
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
  "roi-business-calculator": [
    {
      id: "lookbackDays",
      label: "Telemetry lookback (days)",
      type: "select",
      required: false,
      options: ["30", "90", "180", "365"],
      placeholder: "90",
    },
    {
      id: "workflowVolume",
      label: "Annual workflow volume",
      type: "shortText",
      required: true,
      placeholder: "120",
    },
    {
      id: "baselineMinutes",
      label: "Baseline minutes per item",
      type: "shortText",
      required: true,
      placeholder: "90",
    },
    {
      id: "assistedMinutes",
      label: "Assisted minutes per item",
      type: "shortText",
      required: true,
      placeholder: "25",
    },
    {
      id: "adoptionRate",
      label: "Adoption rate (0-1)",
      type: "shortText",
      required: true,
      placeholder: "0.7",
    },
    {
      id: "successfulUseRate",
      label: "Successful use rate (0-1)",
      type: "shortText",
      required: true,
      placeholder: "0.85",
    },
    {
      id: "loadedHourlyCost",
      label: "Loaded hourly cost (USD)",
      type: "shortText",
      required: true,
      placeholder: "85",
    },
    {
      id: "redeploymentFactor",
      label: "Redeployment factor (0-1)",
      type: "shortText",
      required: true,
      placeholder: "0.6",
    },
    {
      id: "externalSpend",
      label: "Annual external / agency spend (USD)",
      type: "shortText",
      required: true,
      placeholder: "48000",
    },
    {
      id: "replaceableShare",
      label: "Replaceable share of external spend (0-1)",
      type: "shortText",
      required: true,
      placeholder: "0.35",
    },
    {
      id: "totalCostOfOwnership",
      label: "Total cost of ownership (USD)",
      type: "shortText",
      required: true,
      placeholder: "36000",
    },
    {
      id: "attributableGrossMargin",
      label: "Attributable gross margin (0-1)",
      type: "shortText",
      required: false,
      placeholder: "0.55",
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
    const document: Record<string, unknown> = {
      ...pageSnapshot(
        sourceUrl || `document:${crypto.randomUUID()}`,
        sourceUrl,
        "Source page",
        visibleContent,
        completeness,
      ),
      queries: [],
    };
    if (capabilityId === "ai-readiness") {
      const crawlableRaw = (values.technicalCrawlable ?? "").trim().toLowerCase();
      const statusRaw = (values.technicalStatusCode ?? "").trim();
      const loadRaw = (values.technicalLoadTimeMs ?? "").trim();
      if (crawlableRaw || statusRaw || loadRaw) {
        const statusCode = Number(statusRaw);
        const loadTimeMs = Number(loadRaw);
        document.technical = {
          crawlable: crawlableRaw === "no" ? false : true,
          statusCode: Number.isFinite(statusCode) && statusCode > 0 ? statusCode : 200,
          loadTimeMs: Number.isFinite(loadTimeMs) && loadTimeMs >= 0 ? loadTimeMs : 1800,
        };
      }
    }
    const input: Record<string, unknown> = {
      contractVersion,
      document,
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
      const competitorContent = (values.competitorContent ?? "").trim();
      if (competitorContent) {
        const competitorUrl = (values.competitorUrl ?? "").trim();
        input.competitorDocument = {
          ...pageSnapshot(
            competitorUrl || `competitor:${crypto.randomUUID()}`,
            competitorUrl,
            "Competitor page",
            competitorContent,
            normalizeContentCompleteness(values.contentCompleteness),
          ),
          queries: [],
        };
      }
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
    const subjectContent = (values.subjectContent ?? "").trim();
    if (!subjectName || !subjectContent) return null;
    const sourceUrl = (values.sourceUrl ?? "").trim();
    const subjectCompleteness = normalizeContentCompleteness(values.subjectCompleteness);
    const competitorCompleteness = normalizeContentCompleteness(values.competitorCompleteness);
    const competitors = collectCompetitorPages(values, competitorCompleteness);
    if (competitors.length === 0) return null;
    const competitorName = competitors
      .map((page) => {
        const source = page.source as { title?: string };
        return typeof source.title === "string" ? source.title.trim() : "";
      })
      .filter(Boolean)
      .join(" · ") || "Competitor";
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
      competitorPages: competitors,
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
    const competitors = collectCompetitorPages(values, competitorCompleteness);
    if (competitors.length === 0) return null;
    if (capabilityId === "ai-readiness-comparison") {
      return {
        contractVersion,
        subjectPage: subject,
        competitorPages: competitors,
      };
    }
    if (capabilityId === "competitor-positioning") {
      const primaryCompetitor = competitors[0]!;
      return {
        contractVersion,
        brandPages: [subject],
        competitorPages: competitors,
        aiAnswerObservations: parseAiAnswerObservations(
          values,
          primaryCompetitor.competitorId,
        ),
      };
    }
    return {
      contractVersion,
      subjectPages: [subject],
      competitorPages: competitors,
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
    const brandContent = (values.brandContent ?? "").trim();
    if (!brandName || !brandContent) return null;
    const sourceUrl = (values.sourceUrl ?? "").trim();
    const focusQuery = (values.focusQuery ?? "").trim();
    const subjectCompleteness = normalizeContentCompleteness(values.subjectCompleteness);
    const competitorCompleteness = normalizeContentCompleteness(values.competitorCompleteness);
    const competitors = collectCompetitorPages(values, competitorCompleteness);
    if (competitors.length === 0) return null;
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
      competitorPages: competitors,
      responseMode: "auto",
      focusQuery: focusQuery || null,
    };
  }
  if (capabilityId === "roi-business-calculator") {
    const numberOr = (raw: string | undefined, fallback: number) => {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const lookbackRaw = Number(values.lookbackDays ?? "90");
    const lookbackDays = [30, 90, 180, 365].includes(lookbackRaw) ? lookbackRaw : 90;
    return {
      contractVersion,
      lookbackDays,
      assumptions: {
        workflowVolume: numberOr(values.workflowVolume, 120),
        baselineMinutes: numberOr(values.baselineMinutes, 90),
        assistedMinutes: numberOr(values.assistedMinutes, 25),
        adoptionRate: numberOr(values.adoptionRate, 0.7),
        successfulUseRate: numberOr(values.successfulUseRate, 0.85),
        loadedHourlyCost: numberOr(values.loadedHourlyCost, 85),
        redeploymentFactor: numberOr(values.redeploymentFactor, 0.6),
        externalSpend: numberOr(values.externalSpend, 48000),
        replaceableShare: numberOr(values.replaceableShare, 0.35),
        totalCostOfOwnership: numberOr(values.totalCostOfOwnership, 36000),
        attributableGrossMargin: numberOr(values.attributableGrossMargin, 0.55),
      },
      observedTelemetry: {
        generatedCount: 48,
        acceptedCount: 31,
        publishedCount: 22,
        rejectedCount: 9,
        cancelledCount: 0,
        reviewMinutes: 410,
        periodLabel: `Last ${lookbackDays} days (stub)`,
        source: "telemetry",
        lookbackDays,
        notes: ["Counts are workflow outcomes, not cash ROI."],
      },
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
      && (values.subjectContent ?? "").trim().length > 0
      && (values.competitorContent ?? "").trim().length > 0;
  }
  if (capabilityId === "competitive-response") {
    return (values.brandName ?? "").trim().length > 0
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
  if (capabilityId === "roi-business-calculator") {
    return true;
  }
  return fields.every((field) => !field.required || (values[field.id] ?? "").trim().length > 0);
}

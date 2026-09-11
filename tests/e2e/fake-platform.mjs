import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";

const port = Number(process.argv[process.argv.indexOf("--port") + 1] || 4310);
const recordSeparator = "\x1e";
const fixtureQuote =
  "Deterministic content systems pair human approval gates with exact source attribution.";
const fixtureMarkdown = `# Reliable content operations\n\n${fixtureQuote}\n\nRetries remain bounded and observable.`;
const skillVersionIds = {
  citation: "11111111-1111-1111-1111-111111111111",
  technical: "22222222-2222-2222-2222-222222222222",
};
const agentIds = {
  producer: "33333333-3333-3333-3333-333333333333",
  marketing: "44444444-4444-4444-4444-444444444444",
  seo: "55555555-5555-5555-5555-555555555555",
  aeo: "66666666-6666-6666-6666-666666666666",
};
const agentVersionIds = {
  producer: "77777777-7777-7777-7777-777777777777",
  marketing: "88888888-8888-8888-8888-888888888888",
  seo: "99999999-9999-9999-9999-999999999999",
  aeo: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
};

let scenario;
let requests;
let sectionAttempts;
let sequence;
let job;
let sockets;
let history;
let adminSkill;
let adminAgent;
let adminAgentHistory;
let agentTestRuns;
let agentTestTimers;
let contextCatalogs;
let ingestionEvents;
let studioAgents = new Map();
let canvasProjects = new Map();
let grids = new Map();
let pipelines = new Map();
let contextUploads;
let manifests;
let taskRuns;
let libraryPrefs;
let gscConnections;
let customerOutcomes;

function reset() {
  scenario = { ragAvailable: true };
  requests = [];
  sectionAttempts = new Map();
  sequence = 0;
  history = [];
  for (const timer of agentTestTimers || []) clearTimeout(timer);
  agentTestTimers = [];
  agentTestRuns = new Map();
  adminAgentHistory = [];
  contextUploads = new Map();
  taskRuns = new Map();
  gscConnections = new Map();
  customerOutcomes = new Map();
  libraryPrefs = {
    favorites: [],
    savedConfigs: [],
  };
  ingestionEvents = [{
    id: "ingestion-event-1",
    jobId: "ingestion-1",
    seq: 1,
    state: "ready",
    message: "Editorial handbook indexed",
    progressPercent: 100,
    createdAtUtc: "2026-09-09T10:00:00Z",
    assetId: "knowledge-1",
  }];
  const audit = [{ id: "audit-context-1", action: "approved", actor: "owner@example.test", atUtc: "2026-09-09T09:00:00Z" }];
  const provenance = {
    sourceLabel: "Editorial handbook.txt",
    sourceTimestampUtc: "2026-09-08T15:00:00Z",
    parser: "plain-text",
    parserVersion: "1.0.0",
    contentDigest: `sha256:${"a".repeat(64)}`,
  };
  const item = (id, kind, name, versionId, extra = {}) => ({
    id, kind, name, description: `${name} governed context`, tags: [kind],
    currentVersionId: versionId,
    versions: [{
      id: versionId, versionNumber: 1, lifecycle: "approved",
      digest: `sha256:${id.at(-1).repeat(64)}`, createdAtUtc: "2026-09-09T09:00:00Z",
      freshness: "fresh", ingestionState: kind === "knowledge" ? "ready" : null,
      extractionState: kind === "knowledge" ? "verified" : null,
      indexState: kind === "knowledge" ? "ready" : null,
      provenance: kind === "knowledge" ? provenance : { sourceLabel: "Owner authored" },
      findings: [], audit, ...extra,
    }],
  });
  contextCatalogs = {
    knowledge: [item("knowledge-1", "knowledge", "Editorial Handbook", "knowledge-version-1")],
    "brand-kits": [item("brand-1", "brand-kit", "Example Systems", "brand-version-1")],
    audiences: [item("audience-1", "audience", "Technical Leaders", "audience-version-1", {
      definitionJson: {
        schemaVersion: 1,
        summary: "Technical buyers evaluating evidence systems.",
        locale: "en",
        industries: ["software"],
        roles: ["VP Engineering", "Staff Engineer"],
        pains: ["ungrounded AI claims"],
        goals: ["citeable drafts"],
        buyingTriggers: ["audit pressure"],
        useCases: ["content ops"],
        readingLevel: "professional",
        preferredLanguage: ["specific", "operational"],
        bannedTopics: ["hype"],
        avoidPhrases: ["synergy"],
        positioningStatement: "Evidence first.",
        valuePropositions: [{ title: "Proof", description: "Every claim cites a source." }],
        objectionResponses: [{ objection: "Too slow", response: "Review gates are bounded." }],
        additionalCharacteristics: [{ key: "region", value: "NA" }],
        customInstructions: "Prefer concrete systems over slogans.",
      },
    })],
    "style-guides": [item("style-1", "style-guide", "Clear Technical Style", "style-version-1", {
      policyJson: {
        schemaVersion: 1,
        grammar: { oxfordComma: true, preferActiveVoice: true, allowEmDash: false, sentenceCaseHeadings: true },
        termRules: [
          { id: "no-synergy", kind: "prohibit", match: "synergy", caseSensitive: false },
          { id: "customers", kind: "replace", match: "users", replacement: "customers" },
        ],
        prohibitedPhrases: ["best-in-class"],
        requiredPhrases: ["security review"],
        customInstructions: "Prefer concrete operational outcomes.",
      },
    })],
    "visual-guidelines": [item("visual-1", "visual-guideline", "Product Visual System", "visual-version-1", {
      policyJson: {
        schemaVersion: 1,
        palette: { primary: "#0F172A", secondary: "#334155", accent: "#0F766E", background: "#F8FAFC", text: "#0F172A" },
        typography: { displayFont: "Source Serif 4", bodyFont: "IBM Plex Sans", minBodySizePx: 16 },
        logoUsage: { clearSpaceRatio: 0.5, allowedBackgrounds: ["light", "photo"], prohibitedTreatments: ["stretch", "recolor"] },
        layout: { maxContentWidthPx: 1200, preferFullBleedHero: true, cornerRadiusPx: 8 },
        imagery: { styleNotes: "Natural light, documentary product shots.", prohibitedMotifs: ["stock handshake"] },
        customInstructions: "Prefer full-bleed photography over inset cards.",
      },
    })],
    "product-schemas": [item("schema-1", "product-schema", "Core Product Schema", "schema-version-1", {
      fieldsJson: {
        schemaVersion: 1,
        fields: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            key: "pricing",
            label: "Pricing",
            required: true,
            valueType: "string",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            key: "differentiator",
            label: "Differentiator",
            required: false,
            valueType: "text",
          },
        ],
      },
    })],
    products: [item("product-1", "product", "Evidence Engine", "product-version-1", {
      productSchemaVersionId: "schema-version-1",
      fieldValuesJson: {
        "11111111-1111-4111-8111-111111111111": "Contact sales",
        "22222222-2222-4222-8222-222222222222": "Citeable evidence graph",
      },
      approvedClaimsJson: ["Evidence Engine cites every claim"],
      prohibitedClaimsJson: ["guarantees perfect accuracy"],
      mandatoryDisclaimersJson: ["Results depend on source coverage."],
    }), item("product-2", "product", "Incomplete Claims Catalog", "product-version-2", {
      productSchemaVersionId: "schema-version-1",
      fieldValuesJson: {
        "11111111-1111-4111-8111-111111111111": "TBD",
        "22222222-2222-4222-8222-222222222222": "Unset differentiator",
      },
      approvedClaimsJson: [],
      prohibitedClaimsJson: [],
      mandatoryDisclaimersJson: [],
    })],
  };
  manifests = new Map();
  studioAgents = new Map();
  canvasProjects = new Map();
  grids = new Map();
  pipelines = new Map();
  adminSkill = {
    id: "community-style",
    versionId: "skill-version-1",
    name: "Community Style",
    version: "1.0.0",
    contribution: "Apply reviewed style guidance without changing evidence policy.",
    source: {
      repositoryUrl: "https://github.com/example/agent-skills",
      commit: "0123456789abcdef0123456789abcdef01234567",
      path: "skills/community-style",
      discoveryUrl: "https://agenticskills.example/community-style",
    },
    packageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    manifestDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    license: "Apache-2.0",
    compatibility: "gcc-skill-envelope.v2",
    reviewStatus: "quarantined",
    reviewer: null,
    supportedStages: ["outline", "section"],
    supportedContentTypes: ["pillar", "blog"],
    requestedTools: ["get_brief_context"],
    origin: "community",
    findings: [{
      id: "finding-1", severity: "medium", scanner: "instruction-policy", rule: "instruction-override",
      filePath: "SKILL.md", line: 8, message: "Review wording that could be interpreted as overriding workflow policy.",
      disposition: "open", reviewerRationale: null,
    }],
    files: [{
      path: "SKILL.md", mediaType: "text/markdown", byteCount: 128,
      digest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      executable: false, content: "---\nname: community-style\ndescription: Reviewed style guidance\n---\nUse concise, evidence-grounded prose.",
    }],
    audit: [{
      id: "audit-1", actor: "admin@example.test", action: "imported", atUtc: "2026-09-08T20:00:00Z",
      beforeStatus: null, afterStatus: "quarantined", detail: "Immutable commit imported into quarantine.",
    }],
  };
  adminAgent = {
    id: "marketing-strategist",
    agentId: agentIds.marketing,
    versionId: agentVersionIds.marketing,
    name: "Marketing Strategist",
    description: "Connect audience intent to a focused content angle.",
    objective: "Improve audience fit without weakening evidence requirements.",
    version: "2.0.0",
    digest: "sha256:4444444444444444444444444444444444444444444444444444444444444444",
    role: "contributor",
    specialty: "marketing",
    status: "draft",
    supportedContentTypes: ["pillar", "blog"],
    supportedStages: ["outline", "validation"],
    skillIds: ["technical-depth"],
    skills: [{
      id: "technical-depth", name: "Technical Depth", version: "2.1.0",
      versionId: skillVersionIds.technical,
      digest: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    }],
    participation: [
      { stage: "outline", role: "contributor", order: 20 },
      { stage: "validation", role: "reviewer", order: 30 },
    ],
    instructions: "Contribute a marketing angle without overriding evidence policy.",
    tools: ["get_brief_context", "submit_contribution", "submit_review"],
    models: ["o3"],
    modelPolicy: { version: "content-model-policy.v1", allowedModels: ["o3"] },
    modelPolicyVersion: "content-model-policy.v1",
    tests: [],
    findings: [{
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      severity: "high",
      scanner: "agent-policy-v1",
      rule: "broad-objective",
      message: "Confirm that the objective remains subordinate to evidence policy.",
      blocking: true,
      disposition: "open",
      reviewerRationale: null,
    }],
    audit: [{ id: "agent-audit-1", action: "created", actor: "admin@example.test", atUtc: "2026-09-08T20:00:00Z" }],
  };
  job = {
    id: "job-1",
    status: "awaiting_brandkit_approval",
    stage: "BRANDKIT",
    contentType: "pillar",
    tabLabel: "Pillar",
    resultJson: null,
    contextManifestId: "manifest-1",
    contextManifestDigest: `sha256:${"f".repeat(64)}`,
  };
  manifests.set("job-1", {
    manifestId: "manifest-1",
    digest: `sha256:${"f".repeat(64)}`,
    schemaVersion: "run-context-manifest.v1",
    signingKeyId: "context-key-2026-09",
    resolvedAtUtc: "2026-09-09T10:05:00Z",
    entries: [
      {
        kind: "knowledge", stableId: "knowledge-1", versionId: "knowledge-version-1",
        name: "Editorial Handbook", versionNumber: 1, lifecycle: "approved",
        digest: `sha256:${"a".repeat(64)}`, freshness: "fresh", extractionState: "verified",
        indexState: "ready", temporary: false, provenance,
      },
    ],
    warnings: [],
    validationFindings: [],
  });
  sockets = sockets || new Set();
}
reset();

function cors(headers = {}) {
  return {
    "access-control-allow-origin": "http://127.0.0.1:3004",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type,x-requested-with,x-signalr-user-agent,x-upload-token",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    ...headers,
  };
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, cors({
    "content-type": typeof body === "string" ? "text/plain" : "application/json",
    "content-length": Buffer.byteLength(payload),
    ...headers,
  }));
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function pushStudioAudit(draft, action, detail, versionMeta = null) {
  if (!Array.isArray(draft.audit)) draft.audit = [];
  const version = versionMeta?.version || draft.summary.version;
  const versionId = versionMeta?.versionId || draft.summary.versionId;
  draft.audit.unshift({
    id: `${versionId}:${action}:${crypto.randomUUID().slice(0, 8)}`,
    action,
    actor: "owner",
    atUtc: new Date().toISOString(),
    detail,
    versionId,
    version,
  });
}

function studioDetail(draft) {
  const minTestCases = Number.isFinite(draft.minTestCases) ? Math.max(1, Math.min(20, draft.minTestCases)) : 1;
  const publishedVersion = draft.publishedVersion && draft.publishedVersion.state === "published"
    ? draft.publishedVersion
    : null;
  const lifecycleVersion = draft.publishedVersion
    && (draft.publishedVersion.state === "published" || draft.publishedVersion.state === "deprecated")
    ? draft.publishedVersion
    : null;
  return {
    contractVersion: "gcc-studio-agent.v1",
    agent: draft.summary,
    workflow: {
      engine: "studio",
      mode: "instruction-template",
      artifactType: "customAgentOutput.v1",
      instructionsTemplate: draft.instructionsTemplate,
      exampleOutput: draft.exampleOutput,
      temperature: draft.temperature,
      evaluationPrompt: draft.evaluationPrompt || "",
      contextKnowledgeIds: Array.isArray(draft.contextKnowledgeIds) ? draft.contextKnowledgeIds : [],
      testCases: Array.isArray(draft.testCases) ? draft.testCases : [],
      minTestCases,
      uiSchema: { fields: draft.fields },
    },
    allowedModels: [draft.allowedModel],
    evaluationThresholds: {
      requiresExampleOutput: true,
      dryRunRequired: true,
      minTestCases,
    },
    publishedVersion,
    lifecycleVersion,
    audit: Array.isArray(draft.audit) ? draft.audit : [],
  };
}

function normalizeStudioTestCases(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id : `case-${index + 1}`;
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name : `Case ${index + 1}`;
    const input = {};
    if (entry.input && typeof entry.input === "object" && !Array.isArray(entry.input)) {
      for (const [key, raw] of Object.entries(entry.input)) {
        if (typeof raw === "string") input[key] = raw;
        else if (raw != null) input[key] = String(raw);
      }
    }
    return [{ id, name, input }];
  }).slice(0, 20);
}

function evaluateStudioCase(draft, testCase) {
  const input = testCase.input || {};
  const missing = (draft.fields || [])
    .filter((field) => field.required && !String(input[field.id] || "").trim())
    .map((field) => field.label);
  let rendered = String(draft.instructionsTemplate || "")
    .replaceAll("{{outcome}}", draft.summary.description)
    .replaceAll("{{agent.name}}", draft.summary.displayName);
  for (const field of draft.fields || []) {
    rendered = rendered.replaceAll(`{{inputs.${field.id}}}`, input[field.id] || "");
  }
  const unresolved = [...rendered.matchAll(/\{\{[^}]+\}\}/g)].map((item) => item[0]);
  const missingEvaluation = !String(draft.evaluationPrompt || "").trim();
  const missingExample = !String(draft.exampleOutput || "").trim();
  const valid = missing.length === 0
    && unresolved.length === 0
    && !missingExample
    && !missingEvaluation;
  const message = valid
    ? `Case '${testCase.name}' passed.`
    : missing.length
      ? `Case '${testCase.name}' failed schema: Missing required fields: ${missing.join(", ")}.`
      : unresolved.length
        ? `Case '${testCase.name}' has unresolved tokens: ${unresolved.join(", ")}.`
        : missingExample
          ? `Case '${testCase.name}' blocked: example output is required.`
          : `Case '${testCase.name}' blocked: evaluation prompt is required.`;
  return {
    id: testCase.id,
    name: testCase.name,
    valid,
    validationErrors: missing.map((label) => `$.${label} is required.`),
    missingTokens: unresolved,
    message,
  };
}

function evaluateStudioSuite(draft) {
  const minTestCases = Number.isFinite(draft.minTestCases) ? Math.max(1, Math.min(20, draft.minTestCases)) : 1;
  const cases = normalizeStudioTestCases(draft.testCases).map((item) => evaluateStudioCase(draft, item));
  const passedCount = cases.filter((item) => item.valid).length;
  const enough = cases.length >= minTestCases;
  const valid = enough && cases.length > 0 && passedCount === cases.length;
  const message = valid
    ? `Test suite passed (${passedCount}/${cases.length} cases; min ${minTestCases}).`
    : !enough
      ? `Test suite needs at least ${minTestCases} case(s); found ${cases.length}.`
      : cases.length === 0
        ? `Add at least ${minTestCases} test case(s) before publish.`
        : `Test suite failed (${passedCount}/${cases.length} passed).`;
  return { valid, minTestCases, caseCount: cases.length, passedCount, cases, message };
}

function seedCanvasProject() {
  const briefId = crypto.randomUUID();
  const articleId = crypto.randomUUID();
  const socialId = crypto.randomUUID();
  const emailId = crypto.randomUUID();
  const project = {
    id: crypto.randomUUID(),
    name: "Evidence Engine launch",
    description: "A coordinated launch package built from one approved strategy brief.",
    status: "review",
    updatedAt: "2026-09-08T18:42:00.000Z",
    owner: "owner",
    collaborators: [],
    persistence: "server",
    activity: [
      { id: "activity-1", kind: "created", actor: "Jeff Martin", occurredAt: "2026-09-03T14:00:00.000Z", message: "Created the project and strategy brief" },
      { id: "activity-2", kind: "versioned", actor: "Maya Chen", occurredAt: "2026-09-05T16:20:00.000Z", message: "Created Launch strategy brief v2" },
    ],
    assets: [
      {
        id: briefId,
        title: "Launch strategy brief",
        kind: "brief",
        parentAssetIds: [],
        versions: [
          {
            id: crypto.randomUUID(), version: 1, createdAt: "2026-09-03T14:00:00.000Z", createdBy: "Jeff Martin",
            status: "draft", summary: "Initial positioning, audience, and launch outcomes.",
            evidence: [], provenance: { origin: "human", note: "Authored from stakeholder workshop notes." },
          },
          {
            id: crypto.randomUUID(), version: 2, createdAt: "2026-09-05T16:20:00.000Z", createdBy: "Maya Chen",
            status: "approved", summary: "Approved positioning with proof points and channel handoffs.",
            evidence: [], provenance: { origin: "mixed", note: "Human-edited strategy suggestions." },
          },
        ],
      },
      {
        id: articleId,
        title: "Reliable content operations",
        kind: "article",
        parentAssetIds: [briefId],
        versions: [{
          id: crypto.randomUUID(), version: 1, createdAt: "2026-09-07T11:00:00.000Z", createdBy: "Content Producer",
          status: "in-review", summary: "Long-form launch narrative with evidence-backed operational guidance.",
          evidence: [], provenance: { origin: "agent", note: "Generated from launch brief v2; citations verified." },
        }],
      },
      {
        id: socialId,
        title: "Launch carousel",
        kind: "social",
        parentAssetIds: [articleId],
        versions: [{
          id: crypto.randomUUID(), version: 1, createdAt: "2026-09-07T12:00:00.000Z", createdBy: "Maya Chen",
          status: "draft", summary: "Six-slide narrative adapted from the pillar article.",
          evidence: [], provenance: { origin: "mixed", note: "Adapted from article v1." },
        }],
      },
      {
        id: emailId,
        title: "Customer launch email",
        kind: "email",
        parentAssetIds: [briefId, articleId],
        versions: [{
          id: crypto.randomUUID(), version: 1, createdAt: "2026-09-08T09:00:00.000Z", createdBy: "Content Producer",
          status: "in-review", summary: "Concise customer announcement with article handoff.",
          evidence: [], provenance: { origin: "agent", note: "Generated from approved brief and article draft." },
        }],
      },
    ],
  };
  canvasProjects.set(project.id, project);
  return project;
}

const DEMO_FAQ_TOPICS = [
  "What is Evidence Engine?",
  "How does RAG grounding work?",
  "Who owns brand voice approvals?",
  "How do credit budgets apply to batch runs?",
  "Can agents cite source library assets?",
  "What happens on a failed row?",
  "How do sample runs differ from full runs?",
  "Where do FAQ outputs publish?",
  "How is owner isolation enforced?",
  "What is a TaskRun fan-out?",
  "Can grids reuse canvas assets?",
  "How do I preview estimated credits?",
];

const DEMO_PILLAR_TOPICS = [
  "Evidence Engine",
  "RAG grounding",
  "Brand voice approvals",
  "Credit budgets for batch runs",
  "Source library citations",
  "Failed row recovery",
  "Sample versus full runs",
  "FAQ output publishing",
  "Owner isolation",
  "TaskRun fan-out",
  "Canvas asset reuse",
  "Estimated credit previews",
];

function defaultGridConfig(capability = "faq-generator") {
  const isPillar = capability === "pillar-outline";
  return {
    columns: [
      { key: "topic", kind: "input", label: "Topic" },
      {
        key: "agent",
        kind: "agent",
        label: isPillar ? "Pillar Article Outline" : "FAQ Generator",
        capability: isPillar ? "pillar-outline" : "faq-generator",
      },
      { key: "output", kind: "output", label: "Result" },
    ],
    creditsPerRow: 1,
    executionNote: "Sample/full runs create one durable TaskRun per selected row and complete in-process.",
  };
}

function seedGrid(capability = "faq-generator") {
  const isPillar = capability === "pillar-outline";
  const topics = isPillar ? DEMO_PILLAR_TOPICS : DEMO_FAQ_TOPICS;
  const now = new Date().toISOString();
  const grid = {
    id: crypto.randomUUID(),
    name: isPillar ? "Pillar launch batch" : "FAQ launch batch",
    description: isPillar
      ? "Twelve pillar topics ready for a sample stub run."
      : "Twelve FAQ topics ready for a sample stub run.",
    status: "ready",
    updatedAt: now,
    owner: "owner",
    persistence: "server",
    config: defaultGridConfig(capability),
    rows: topics.map((topic, rowIndex) => ({
      id: crypto.randomUUID(),
      rowIndex,
      input: { topic },
      output: null,
      status: "pending",
      error: "",
      updatedAt: now,
    })),
    runs: [],
  };
  grids.set(grid.id, grid);
  return grid;
}

function summarizeGridSchedule(grid) {
  const schedule = grid.config?.schedule;
  if (!schedule || !schedule.enabled || schedule.cadence === "none") {
    return {
      cadence: schedule?.cadence || "none",
      enabled: false,
      mode: schedule?.mode || "sample",
      sampleSize: schedule?.sampleSize || 10,
      nextRunAt: schedule?.nextRunAt || null,
      lastRunAt: schedule?.lastRunAt || null,
      due: false,
    };
  }
  const dueAt = schedule.nextRunAt ? Date.parse(schedule.nextRunAt) : NaN;
  return {
    cadence: schedule.cadence,
    enabled: true,
    mode: schedule.mode === "full" ? "full" : "sample",
    sampleSize: schedule.sampleSize || 10,
    nextRunAt: schedule.nextRunAt || null,
    lastRunAt: schedule.lastRunAt || null,
    due: Number.isFinite(dueAt) && dueAt <= Date.now(),
  };
}

function executeGridRun(grid, mode, sampleSize = 10, actor = "owner") {
  const started = new Date();
  const ordered = [...grid.rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const selected = mode === "full" ? ordered : ordered.slice(0, sampleSize);
  const capability = grid.config.columns.find((column) => column.kind === "agent")?.capability ?? "faq-generator";
  const isPillar = capability === "pillar-outline";
  const creditsPerRow = grid.config.creditsPerRow ?? 1;

  for (const row of selected) {
    const topic = typeof row.input.topic === "string" ? row.input.topic : "(empty input)";
    row.status = "succeeded";
    row.error = "";
    row.output = isPillar
      ? {
        result: `Pillar outline for: ${topic}`,
        mode: "task-run",
        capability: "pillar-outline",
        endpoint: "pillar-outline",
        taskRunId: crypto.randomUUID(),
        artifactType: "pillarOutline.v1",
        artifact: {
          artifactType: "pillarOutline.v1",
          methodology: "grid-sync.v1",
          topic,
          sections: [{
            sectionId: "sec-1",
            heading: `What is ${topic}?`,
            objective: `Define ${topic} in answer-first language.`,
          }],
        },
      }
      : {
        result: `FAQ draft for: ${topic}`,
        mode: "task-run",
        capability,
        endpoint: capability === "faq-generator" ? "faq-set" : capability,
        taskRunId: crypto.randomUUID(),
        artifactType: "faqSet.v1",
        artifact: {
          artifactType: "faqSet.v1",
          methodology: "grid-sync.v1",
          pairs: [{ question: topic, answer: `Grounded FAQ draft for “${topic}”.` }],
        },
      };
    row.updatedAt = new Date().toISOString();
  }

  const completed = new Date();
  const estimatedCredits = creditsPerRow * selected.length;
  const run = {
    id: crypto.randomUUID(),
    mode,
    sampleSize: mode === "sample" ? sampleSize : null,
    status: "succeeded",
    actor,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    outputCount: selected.length,
    budgetPreview: {
      creditsPerRow,
      rowCount: selected.length,
      estimatedCredits,
      note: grid.config.executionNote,
      succeededCount: selected.length,
      capability,
      execution: "task-run",
    },
    history: [{
      actor,
      mode,
      status: "succeeded",
      startedAt: started.toISOString(),
      durationMs: Math.max(1, completed.getTime() - started.getTime()),
      outputCount: selected.length,
      estimatedCredits,
      capability,
    }],
  };
  grid.runs = [run, ...grid.runs];
  grid.status = mode === "full" || selected.length >= grid.rows.length ? "complete" : "ready";
  grid.updatedAt = completed.toISOString();
  return grid;
}

function event(type, payload, seq = ++sequence) {
  const value = {
    id: `event-${seq}`,
    jobId: job.id,
    seq,
    type,
    payloadJson: JSON.stringify(payload),
    createdAtUtc: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
  };
  history.push(value);
  return value;
}

function hubMessage(message) {
  return JSON.stringify(message) + recordSeparator;
}

function broadcast(evt) {
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(hubMessage({ type: 1, target: "JobEvent", arguments: [evt] }));
    }
  }
}

function agentTestEvent(run, message) {
  return {
    contractVersion: "gcc-agent-test-event.v1",
    testRunId: run.id,
    agentVersionId: run.agentVersionId,
    versionDigest: run.versionDigest,
    status: run.status,
    progressPercent: run.progressPercent,
    phase: run.phase,
    message,
    attemptCount: run.attemptCount,
    queuedAtUtc: run.queuedAtUtc,
    startedAtUtc: run.startedAtUtc,
    completedAtUtc: run.completedAtUtc,
    resultJson: run.resultJson,
    error: run.error,
  };
}

function sendAgentTest(socket, run, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(hubMessage({ type: 1, target: "AgentTestEvent", arguments: [agentTestEvent(run, message)] }));
  }
}

function storeAgentTestRun(run) {
  agentTestRuns.set(run.id, run);
  const agent = [adminAgent, ...adminAgentHistory].find((item) => item.versionId === run.agentVersionId);
  if (agent) agent.tests = [run, ...(agent.tests || []).filter((item) => item.id !== run.id)];
}

function brandKitEvent() {
  return event("BrandKitReady", {
    companyName: "Example Systems",
    companyDescription: "Reliable content operations for technical teams.",
    positioningOneLiner: "Publish grounded content with confidence.",
    tagline: "Evidence into action.",
    website: "https://example.test",
    voiceSampleCount: 1,
    voiceSamplePreviews: [fixtureQuote],
  });
}

function outlinePayload() {
  return {
    sections: [
      { key: "problem", heading: "Why reliability matters", job: "problem", hierarchyChildHeadings: [] },
      { key: "advance", heading: "Build a deterministic workflow", job: "advance", hierarchyChildHeadings: [] },
    ],
    hierarchyChildHeadings: [],
    provenance: {
      stage: "PLAN",
      attemptId: "attempt-plan-1",
      modelUsed: "o1-pro",
      agentExecution: { ...agentExecution(), stage: "PLAN", agentId: "OutlineAgent", attemptId: "attempt-plan-1" },
    },
  };
}

function sectionPayload() {
  return {
    sectionKey: "problem",
    heading: "Why reliability matters",
    job: "problem",
    wordCount: 12,
    usedFallbackStub: false,
    citations: [ragCitation()],
    provenance: {
      stage: "WRITE",
      modelUsed: "o3",
      effectiveModel: "o3",
      modelPolicyVersion: "content-model-policy.v1",
      promptVersion: "write/v2",
      retrievalStrategy: "hybrid",
      evidenceIds: ["page-1"],
      agentExecution: agentExecution(),
    },
    agentExecution: agentExecution(),
    documentJson: JSON.stringify({
      tag: "h2",
      heading: "Why reliability matters",
      paragraphs: [{ type: "text", runs: [{ text: fixtureQuote }] }],
      children: [],
    }),
  };
}

function ragCitation() {
  return {
    pageId: "page-1",
    url: "https://example.test/reliable-content",
    title: "Reliable content operations",
    sectionTitle: "Approval gates",
    crawlType: "project",
    quote: fixtureQuote,
  };
}

function publishedSkills() {
  return [
    {
      id: "citation-discipline",
      versionId: skillVersionIds.citation,
      name: "Citation Discipline",
      version: "2.0.0",
      contribution: "Return verbatim quote citations for factual claims.",
      source: {
        repositoryUrl: "https://github.com/geek/content-skills",
        commit: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
        path: "skills/citation-discipline",
      },
      packageDigest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      manifestDigest: "sha256:1212121212121212121212121212121212121212121212121212121212121212",
      license: "Proprietary",
      compatibility: "gcc-skill-envelope.v2 / rag-generate.v3",
      reviewStatus: "published",
      reviewer: "Content Platform",
      reviewedAtUtc: "2026-09-08T18:00:00Z",
      publishedAtUtc: "2026-09-08T19:00:00Z",
      supportedStages: ["researchPlanning", "outline", "section", "validation", "repair"],
      supportedContentTypes: ["pillar", "blog"],
      requestedTools: ["search_corpus", "load_evidence_page"],
      activationMode: "automatic",
      assignedAgentIds: ["content-producer", "aeo-contributor"],
      origin: "first-party",
    },
    {
      id: "technical-depth",
      versionId: skillVersionIds.technical,
      name: "Technical Depth",
      version: "2.1.0",
      contribution: "Include supported constraints, tradeoffs, and implementation decisions.",
      source: {
        repositoryUrl: "https://github.com/geek/content-skills",
        commit: "1234567890abcdef1234567890abcdef12345678",
        path: "skills/technical-depth",
      },
      packageDigest: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      manifestDigest: "sha256:2323232323232323232323232323232323232323232323232323232323232323",
      license: "Proprietary",
      compatibility: "gcc-skill-envelope.v2 / rag-generate.v3",
      reviewStatus: "published",
      reviewer: "Content Platform",
      reviewedAtUtc: "2026-09-08T18:05:00Z",
      publishedAtUtc: "2026-09-08T19:05:00Z",
      supportedStages: ["outline", "section", "validation", "repair"],
      supportedContentTypes: ["pillar", "tech-article"],
      requestedTools: ["get_brief_context", "load_evidence_page"],
      activationMode: "automatic",
      assignedAgentIds: ["marketing-strategist", "seo-reviewer"],
      origin: "first-party",
    },
  ];
}

function publishedAgents() {
  return [
    {
      id: "content-producer",
      agentId: agentIds.producer,
      versionId: agentVersionIds.producer,
      name: "Content Producer",
      description: "Owns the final evidence-grounded draft.",
      version: "3.0.0",
      digest: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      role: "producer",
      specialty: "content",
      status: "published",
      supportedContentTypes: ["pillar", "blog"],
      supportedStages: ["researchPlanning", "outline", "section", "repair", "validation", "finalSynthesis", "complete"],
      skillIds: ["citation-discipline"],
      skills: [{
        id: "citation-discipline", name: "Citation Discipline", version: "2.0.0",
        versionId: skillVersionIds.citation,
        digest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      }],
      participation: ["researchPlanning", "outline", "section", "repair", "validation", "finalSynthesis", "complete"]
        .map((stage, order) => ({ stage, role: "producer", order })),
      tools: ["search_corpus", "load_evidence_page", "get_brief_context", "activate_skill", "read_skill_resource", "submit_section"],
      models: ["o3", "o1-pro"],
      modelPolicy: { version: "content-model-policy.v1", allowedModels: ["o3", "o1-pro"] },
    },
    {
      ...adminAgent,
      status: "published",
      participation: [
        { stage: "outline", role: "contributor", order: 20 },
        { stage: "validation", role: "reviewer", order: 30 },
      ],
      supportedStages: ["outline", "validation"],
    },
    {
      id: "seo-reviewer",
      agentId: agentIds.seo,
      versionId: agentVersionIds.seo,
      name: "SEO Reviewer",
      description: "Reviews discoverability and search intent coverage.",
      version: "1.0.0",
      digest: "sha256:5555555555555555555555555555555555555555555555555555555555555555",
      role: "reviewer",
      specialty: "seo",
      status: "published",
      supportedContentTypes: ["pillar", "blog"],
      supportedStages: ["VALIDATE"],
      skillIds: ["technical-depth"],
      skills: [{
        id: "technical-depth", name: "Technical Depth", version: "2.1.0",
        versionId: skillVersionIds.technical,
        digest: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      }],
      participation: [{ stage: "validation", role: "reviewer", order: 40 }],
      tools: ["get_brief_context", "submit_review"],
      models: ["o3"],
      modelPolicy: { version: "content-model-policy.v1", allowedModels: ["o3"] },
    },
    {
      id: "aeo-contributor",
      agentId: agentIds.aeo,
      versionId: agentVersionIds.aeo,
      name: "AEO Contributor",
      description: "Shapes concise answers for answer engines.",
      version: "1.0.0",
      digest: "sha256:6666666666666666666666666666666666666666666666666666666666666666",
      role: "contributor",
      specialty: "aeo",
      status: "published",
      supportedContentTypes: ["pillar"],
      supportedStages: ["PLAN"],
      skillIds: ["citation-discipline"],
      skills: [{
        id: "citation-discipline", name: "Citation Discipline", version: "2.0.0",
        versionId: skillVersionIds.citation,
        digest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      }],
      participation: [{ stage: "outline", role: "contributor", order: 10 }],
      tools: ["get_brief_context", "submit_contribution"],
      models: ["o3"],
      modelPolicy: { version: "content-model-policy.v1", allowedModels: ["o3"] },
    },
  ];
}

function agentExecution(status = "completed") {
  return {
    protocolVersion: "rag-generate.v3",
    traceVersion: "agent-trace.v1",
    stage: "WRITE",
    agentId: "SectionWriterAgent",
    agentVersion: "1.0.0",
    catalogAgentId: "content-producer",
    agentVersionId: agentVersionIds.producer,
    agentDigest: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
    stageExecutionId: "execution-write-1",
    workflowVersion: "llama-workflow.v1",
    promptVersion: "write/v3",
    status,
    attemptId: "attempt-write-1",
    replacedAttemptId: null,
    snapshotDigest: "sha256:snapshotfixture",
    activatedSkills: [{
      skillId: "citation-discipline", versionId: skillVersionIds.citation, name: "Citation Discipline",
      version: "2.0.0", packageDigest: publishedSkills()[0].packageDigest,
      resourcesRead: [{ path: "SKILL.md", digest: "sha256:resource", byteCount: 128 }],
    }],
    tools: [{ toolId: "search_corpus", version: "1.0.0", callCount: 2, successCount: 2, errorCount: 0, durationMs: 21, resultCount: 4 }],
    budget: { maxTurns: 8, turnsUsed: 3, maxToolCalls: 10, toolCallsUsed: 2, maxTokens: 12000, tokensUsed: 2400, exhausted: null },
    stopReason: status === "completed" ? "completed" : null,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (url.pathname === "/__reset" && req.method === "POST") {
    reset();
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__scenario" && req.method === "POST") {
    const update = JSON.parse((await readBody(req)) || "{}");
    scenario = { ...scenario, ...update };
    if (typeof update.adminAgentStatus === "string") adminAgent.status = update.adminAgentStatus;
    if (typeof update.jobStatus === "string") job.status = update.jobStatus;
    return send(res, 200, scenario);
  }
  if (url.pathname === "/__requests") return send(res, 200, requests);
  if (url.pathname === "/__fixture") {
    return send(res, 200, { markdown: fixtureMarkdown, quote: fixtureQuote });
  }

  if (url.pathname === "/connect/authorize") {
    const redirect = new URL(url.searchParams.get("redirect_uri"));
    redirect.searchParams.set("code", "fake-auth-code");
    redirect.searchParams.set("state", url.searchParams.get("state") || "");
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams) });
    res.writeHead(302, cors({ location: redirect.toString() }));
    return res.end();
  }
  if (url.pathname === "/connect/logout") {
    res.writeHead(302, cors({ location: url.searchParams.get("post_logout_redirect_uri") || "/" }));
    return res.end();
  }
  if (url.pathname === "/connect/token" && req.method === "POST") {
    const raw = await readBody(req);
    const form = Object.fromEntries(new URLSearchParams(raw));
    requests.push({ method: req.method, path: url.pathname, form });
    if (form.refresh_token === "dead-refresh") return send(res, 400, "invalid_grant");
    if (form.grant_type === "authorization_code" && (!form.code_verifier || form.code !== "fake-auth-code")) {
      return send(res, 400, "invalid_grant");
    }
    return send(res, 200, {
      access_token: form.grant_type === "refresh_token" ? "refreshed-access" : "oauth-access",
      refresh_token: "valid-refresh",
      expires_in: 600,
      token_type: "Bearer",
    });
  }

  if (url.pathname.endsWith("/negotiate") && req.method === "POST") {
    return send(res, 200, {
      negotiateVersion: 1,
      connectionId: crypto.randomUUID(),
      connectionToken: crypto.randomUUID(),
      availableTransports: [{ transport: "WebSockets", transferFormats: ["Text", "Binary"] }],
    });
  }

  const rawBody = await readBody(req);
  const authorization = req.headers.authorization || null;
  if (url.pathname.startsWith("/api/")) {
    requests.push({
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      authorization,
      body: rawBody,
    });
    if (authorization !== "Bearer e2e-access" && authorization !== "Bearer viewer-access" && authorization !== "Bearer refreshed-access" && authorization !== "Bearer oauth-access") {
      return send(res, 401, { error: "fake platform requires bearer" });
    }
  }

  if (url.pathname === "/api/geek-content-creator-v2/non-json") {
    return send(res, 502, "upstream exploded", { "x-fake-upstream": "preserved" });
  }
  if (url.pathname === "/api/geek-content-creator-v2/echo") {
    return send(res, 200, { query: Object.fromEntries(url.searchParams), body: rawBody, authorization });
  }
  const catalogName = url.pathname.match(/^\/api\/geek-content-creator-v2\/(knowledge|brand-kits|audiences|style-guides|visual-guidelines|product-schemas|products)$/)?.[1];
  if (catalogName && req.method === "GET") {
    return send(res, 200, { items: contextCatalogs[catalogName] });
  }
  if (catalogName && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const stableId = `${catalogName}-${contextCatalogs[catalogName].length + 1}`;
    const versionId = `${stableId}-version-1`;
    contextCatalogs[catalogName].push({
      id: stableId,
      kind: catalogName,
      name: body.name,
      description: body.description,
      currentVersionId: versionId,
      versions: [{
        id: versionId,
        versionNumber: 1,
        lifecycle: "draft",
        digest: `sha256:${"d".repeat(64)}`,
        createdAtUtc: new Date().toISOString(),
        findings: [],
        audit: [],
        policyJson: (catalogName === "style-guides" || catalogName === "visual-guidelines") ? (body.payload || body.data || {}) : undefined,
        definitionJson: catalogName === "audiences" ? (body.payload || body.data || {}) : undefined,
        fieldsJson: catalogName === "product-schemas" ? (body.payload || body.data || {}) : undefined,
      }],
    });
    return send(res, 201, { id: stableId, versionId });
  }
  const catalogVersionCreate = url.pathname.match(/^\/api\/geek-content-creator-v2\/(style-guides|visual-guidelines|audiences|product-schemas|products)\/([^/]+)\/versions$/);
  if (catalogVersionCreate && req.method === "POST") {
    const [, collection, catalogId] = catalogVersionCreate;
    const target = contextCatalogs[collection].find((entry) => entry.id === catalogId);
    if (!target) return send(res, 404, { error: "Context record not found" });
    const body = JSON.parse(rawBody || "{}");
    if (collection === "style-guides") {
      const payload = body.payload || {};
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const prohibited = new Set([
          ...(Array.isArray(payload.prohibitedPhrases) ? payload.prohibitedPhrases : []),
          ...((Array.isArray(payload.termRules) ? payload.termRules : [])
            .filter((rule) => rule?.kind === "prohibit")
            .map((rule) => rule.match)),
        ].filter(Boolean).map((value) => String(value).toLowerCase()));
        for (const phrase of Array.isArray(payload.requiredPhrases) ? payload.requiredPhrases : []) {
          if (prohibited.has(String(phrase).toLowerCase())) {
            return send(res, 400, { error: "A Style Guide phrase cannot be both prohibited and required." });
          }
        }
      } else {
        return send(res, 400, { error: "Style Guide policy must be a JSON object." });
      }
    }
    if (collection === "visual-guidelines") {
      const payload = body.payload || {};
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return send(res, 400, { error: "Visual Guidelines policy must be a JSON object." });
      }
      const minSize = payload.typography?.minBodySizePx;
      if (minSize != null && (typeof minSize !== "number" || minSize < 8 || minSize > 72)) {
        return send(res, 400, { error: "Visual Guidelines typography.minBodySizePx must be between 8 and 72." });
      }
    }
    if (collection === "audiences") {
      const payload = body.payload || {};
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return send(res, 400, { error: "Audience policy must be a JSON object." });
      }
      const allowedLevels = new Set(["general", "professional", "expert", "executive"]);
      if (payload.readingLevel != null
        && (typeof payload.readingLevel !== "string" || !allowedLevels.has(payload.readingLevel))) {
        return send(res, 400, {
          error: "Audience readingLevel must be general, professional, expert, or executive.",
        });
      }
      if (Array.isArray(payload.bannedTopics)) {
        const seen = new Set();
        for (const topic of payload.bannedTopics) {
          const key = String(topic).trim().toLowerCase();
          if (!key) continue;
          if (seen.has(key)) {
            return send(res, 400, { error: "Audience bannedTopics must be unique." });
          }
          seen.add(key);
        }
      }
      for (const entry of Array.isArray(payload.valuePropositions) ? payload.valuePropositions : []) {
        if (!entry?.title?.trim()) {
          return send(res, 400, { error: "Each Audience valuePropositions entry needs a non-empty title." });
        }
      }
    }
    if (collection === "product-schemas") {
      const payload = body.payload || {};
      const fields = Array.isArray(payload.fields) ? payload.fields : [];
      if (!fields.length) return send(res, 400, { error: "Product Schema must define at least one field." });
    }
    if (collection === "products") {
      if (!body.productSchemaVersionId) {
        return send(res, 400, { error: "productSchemaVersionId is required" });
      }
      const schema = contextCatalogs["product-schemas"]
        .flatMap((entry) => entry.versions)
        .find((version) => version.id === body.productSchemaVersionId);
      if (!schema || schema.lifecycle !== "approved") {
        return send(res, 409, { error: "Product Schema must be owner-accessible and approved." });
      }
      const approved = Array.isArray(body.approvedClaims)
        ? body.approvedClaims.filter((value) => typeof value === "string" && value.trim())
        : [];
      const mandatory = Array.isArray(body.mandatoryDisclaimers)
        ? body.mandatoryDisclaimers.filter((value) => typeof value === "string" && value.trim())
        : [];
      const prohibited = Array.isArray(body.prohibitedClaims)
        ? body.prohibitedClaims.filter((value) => typeof value === "string" && value.trim())
        : [];
      if (!approved.length) {
        return send(res, 400, { error: "Add at least one approved Product claim." });
      }
      if (!mandatory.length) {
        return send(res, 400, { error: "Add at least one mandatory Product disclaimer." });
      }
      const approvedFolded = new Set(approved.map((value) => value.trim().toLowerCase()));
      if (prohibited.some((value) => approvedFolded.has(value.trim().toLowerCase()))) {
        return send(res, 400, { error: "A Product claim cannot be both approved and prohibited." });
      }
    }
    const versionId = `${catalogId}-version-${target.versions.length + 1}`;
    const version = {
      id: versionId,
      versionNumber: target.versions.length + 1,
      lifecycle: "draft",
      digest: `sha256:${"e".repeat(64)}`,
      createdAtUtc: new Date().toISOString(),
      findings: [],
      audit: [],
      policyJson: (collection === "style-guides" || collection === "visual-guidelines") ? (body.payload || {}) : undefined,
      definitionJson: collection === "audiences" ? (body.payload || {}) : undefined,
      fieldsJson: collection === "product-schemas" ? (body.payload || {}) : undefined,
      fieldValuesJson: collection === "products" ? (body.payload || {}) : undefined,
      productSchemaVersionId: body.productSchemaVersionId,
      approvedClaimsJson: body.approvedClaims || [],
      prohibitedClaimsJson: body.prohibitedClaims || [],
      mandatoryDisclaimersJson: body.mandatoryDisclaimers || [],
    };
    target.versions.push(version);
    target.currentVersionId = versionId;
    return send(res, 200, version);
  }
  const catalogAction = url.pathname.match(/^\/api\/geek-content-creator-v2\/(knowledge|brand-kits|audiences|style-guides|visual-guidelines|product-schemas|products)\/(?:versions\/)?([^/]+)\/(review|approve|deprecate|revoke|refresh)$/);
  if (catalogAction && req.method === "POST") {
    const [, collection, stableOrVersionId, action] = catalogAction;
    const target = contextCatalogs[collection].find((entry) =>
      entry.id === stableOrVersionId || entry.versions.some((version) => version.id === stableOrVersionId),
    );
    if (!target) return send(res, 404, { error: "Context record not found" });
    const body = JSON.parse(rawBody || "{}");
    const version = target.versions.find((entry) => entry.id === body.versionId) || target.versions[0];
    const next = { review: "in_review", approve: "approved", deprecate: "deprecated", revoke: "revoked", refresh: version.lifecycle }[action];
    version.lifecycle = next;
    version.audit.push({ id: crypto.randomUUID(), action, actor: "owner@example.test", atUtc: new Date().toISOString() });
    return send(res, 200, { versionId: version.id, lifecycle: next });
  }
  if (url.pathname === "/api/geek-content-creator-v2/context/ingestion/events" && req.method === "GET") {
    return send(res, 200, { events: ingestionEvents });
  }
  if (url.pathname === "/api/geek-content-creator-v2/context/resolve" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const selection = body.selection || {};
    const condition = scenario.contextCondition || "ready";
    const warnings = condition === "stale" ? [{ id: "warning-stale", severity: "warning", code: "stale", message: "Editorial Handbook is stale; verify before use." }] : [];
    const blockingFindings = [
      ...(condition === "revoked"
        ? [{ id: "blocked-revoked", severity: "blocking", code: "revoked", message: "Editorial Handbook version is revoked." }]
        : condition === "permission"
          ? [{ id: "blocked-permission", severity: "blocking", code: "permission_denied", message: "You no longer have access to the selected Audience." }]
          : condition === "processing"
            ? [{ id: "blocked-processing", severity: "blocking", code: "not_ready", message: "A selected attachment is still processing." }]
            : []),
      ...productClaimFindings(selection),
    ];
    const selectedEntries = [
      ...(selection.knowledgeAssetVersionIds || []).map(() => ({
        kind: "knowledge", stableId: "knowledge-1", versionId: "knowledge-version-1",
        name: "Editorial Handbook", versionNumber: 1, lifecycle: condition === "revoked" ? "revoked" : "approved",
        digest: `sha256:${"a".repeat(64)}`, freshness: condition === "stale" ? "stale" : "fresh",
        extractionState: "verified", indexState: "ready", temporary: false,
      })),
      ...(selection.runAttachmentIds || []).map((versionId) => ({
        kind: "run-attachment", versionId, name: "Run attachment", versionNumber: 1,
        lifecycle: "finalized", freshness: "fresh", temporary: true,
      })),
      ...productEntries(selection),
    ];
    return send(res, 200, {
      effectiveEntries: selectedEntries,
      inheritedEntries: [{
        kind: "brand-kit", stableId: "brand-1", versionId: selection.brandKitVersionId || "brand-version-1",
        name: "Example Systems", versionNumber: 1, lifecycle: "approved", inherited: !selection.brandKitVersionId,
      }],
      warnings,
      blockingFindings,
      freshness: selectedEntries.map((entry) => ({ versionId: entry.versionId, status: entry.freshness })),
      estimatedContextSize: 4280,
      agentCompatibility: (body.selectedAgentIds || []).map((agentId) => ({ agentId, compatible: condition !== "permission" })),
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/context/resolve-task-agent" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const selection = body.selection || {};
    if ((selection.runAttachmentIds || []).length > 0) {
      return send(res, 200, {
        preview: {
          effectiveEntries: [],
          inheritedEntries: [],
          warnings: [],
          blockingFindings: [{
            id: "blocked-attachment",
            severity: "blocking",
            code: "run_attachment:task_agent:not_supported",
            message: "run_attachment:task_agent:not_supported",
          }],
          freshness: [],
          estimatedContextSize: 0,
          agentCompatibility: (body.selectedAgentIds || []).map((agentId) => ({
            agentId,
            compatible: true,
            message: "Task-agent run can pin the selected governed context kinds.",
          })),
        },
        envelope: null,
      });
    }
    const condition = scenario.contextCondition || "ready";
    const productBlocks = productClaimFindings(selection);
    const blockingFindings = [
      ...(condition === "revoked"
        ? [{ id: "blocked-revoked", severity: "blocking", code: "revoked", message: "Editorial Handbook version is revoked." }]
        : condition === "permission"
          ? [{ id: "blocked-permission", severity: "blocking", code: "permission_denied", message: "You no longer have access to the selected Audience." }]
          : []),
      ...productBlocks,
    ];
    const effectiveEntries = [
      ...(selection.knowledgeAssetVersionIds || []).map(() => ({
        kind: "knowledge", stableId: "knowledge-1", versionId: "knowledge-version-1",
        name: "Editorial Handbook", versionNumber: 1,
        lifecycle: condition === "revoked" ? "revoked" : "approved",
        digest: `sha256:${"a".repeat(64)}`, freshness: "fresh", temporary: false,
      })),
      ...(selection.brandKitVersionId ? [{
        kind: "brand-kit", stableId: "brand-1", versionId: selection.brandKitVersionId,
        name: "Example Systems", versionNumber: 1, lifecycle: "approved",
        digest: `sha256:${"b".repeat(64)}`, freshness: "fresh", temporary: false,
      }] : []),
      ...(selection.audienceVersionId ? [{
        kind: "audience", stableId: "audience-1", versionId: selection.audienceVersionId,
        name: "Technical Leaders", versionNumber: 1, lifecycle: "approved",
        digest: `sha256:${"u".repeat(64)}`, freshness: "fresh", temporary: false,
      }] : []),
      ...(selection.styleGuideVersionId ? [{
        kind: "style-guide", stableId: "style-1", versionId: selection.styleGuideVersionId,
        name: "Clear Technical Style", versionNumber: 1, lifecycle: "approved",
        digest: `sha256:${"s".repeat(64)}`, freshness: "fresh", temporary: false,
      }] : []),
      ...(selection.visualGuidelineVersionId ? [{
        kind: "visual-guideline", stableId: "visual-1", versionId: selection.visualGuidelineVersionId,
        name: "Product Visual System", versionNumber: 1, lifecycle: "approved",
        digest: `sha256:${"v".repeat(64)}`, freshness: "fresh", temporary: false,
      }] : []),
      ...(productBlocks.length ? [] : productEntries(selection)),
    ];
    const digest = "c".repeat(64);
    return send(res, 200, {
      preview: {
        effectiveEntries,
        inheritedEntries: [],
        warnings: [],
        blockingFindings,
        freshness: effectiveEntries.map((entry) => ({ versionId: entry.versionId, status: entry.freshness })),
        estimatedContextSize: effectiveEntries.length * 512,
        agentCompatibility: (body.selectedAgentIds || []).map((agentId) => ({
          agentId,
          compatible: true,
          message: "Task-agent run can pin the selected governed context kinds.",
        })),
      },
      envelope: blockingFindings.length
        ? null
        : {
          manifestId: "task-manifest-1",
          digest,
          signature: "sig-task-1",
          signingKeyId: "test-key",
          resolvedAtUtc: "2026-09-09T12:00:00Z",
          canonicalJson: JSON.stringify({ schemaVersion: 1, scope: "task-agent", digest }),
        },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/knowledge/uploads" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const uploadId = `upload-${contextUploads.size + 1}`;
    contextUploads.set(uploadId, { scope: "knowledge", metadata: body, bytes: null });
    return send(res, 200, {
      uploadId,
      uploadUrl: `http://127.0.0.1:${port}/storage/${uploadId}`,
      method: "PUT",
      headers: { "x-upload-token": uploadId },
      expiresAtUtc: "2026-09-09T11:00:00Z",
      maxBytes: 10_000_000,
    });
  }
  const attachmentIssue = url.pathname.match(/^\/api\/geek-content-creator-v2\/creates\/([^/]+)\/attachments\/uploads$/);
  if (attachmentIssue && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const uploadId = `attachment-upload-${contextUploads.size + 1}`;
    contextUploads.set(uploadId, { scope: "attachment", createId: attachmentIssue[1], metadata: body, bytes: null });
    return send(res, 200, {
      uploadId,
      uploadUrl: `http://127.0.0.1:${port}/storage/${uploadId}`,
      method: "PUT",
      headers: { "x-upload-token": uploadId },
      expiresAtUtc: "2026-09-09T11:00:00Z",
      maxBytes: 10_000_000,
    });
  }
  const completeUpload = url.pathname.match(/^\/api\/geek-content-creator-v2\/(knowledge\/uploads|creates\/[^/]+\/attachments\/uploads)\/([^/]+)\/complete$/);
  if (completeUpload && req.method === "POST") {
    const upload = contextUploads.get(completeUpload[2]);
    if (!upload?.bytes) return send(res, 409, { error: "Object bytes were not uploaded directly." });
    const isAttachment = upload.scope === "attachment";
    ingestionEvents.push({
      id: crypto.randomUUID(), jobId: `ingestion-${ingestionEvents.length + 1}`,
      seq: ingestionEvents.length + 1, state: "queued", message: `${upload.metadata.fileName} queued`,
      progressPercent: 0, createdAtUtc: new Date().toISOString(),
    });
    return send(res, 202, {
      uploadId: completeUpload[2],
      attachmentId: isAttachment ? `attachment-${contextUploads.size}` : null,
      assetId: isAttachment ? null : `knowledge-${contextCatalogs.knowledge.length + 1}`,
      versionId: isAttachment ? null : `knowledge-version-${contextCatalogs.knowledge.length + 1}`,
      ingestionJobId: ingestionEvents.at(-1).jobId,
      state: scenario.contextCondition === "processing" ? "extracting" : "queued",
    });
  }
  const directStorage = url.pathname.match(/^\/storage\/([^/]+)$/);
  if (directStorage && req.method === "PUT") {
    const upload = contextUploads.get(directStorage[1]);
    if (!upload || req.headers["x-upload-token"] !== directStorage[1]) return send(res, 403, "invalid upload grant");
    upload.bytes = Buffer.from(rawBody);
    requests.push({ method: req.method, path: url.pathname, directStorage: true, byteLength: upload.bytes.length });
    return send(res, 200, "", { etag: `"${directStorage[1]}"` });
  }
  if (url.pathname === "/api/rag/echo") {
    return send(res, 200, { query: Object.fromEntries(url.searchParams), body: rawBody, authorization });
  }
  if (url.pathname === "/api/geek-content-creator-v2/agents" && req.method === "GET") {
    return send(res, 200, { catalogVersion: "agent-catalog.2026-09-08", agents: publishedAgents() });
  }
  if (url.pathname === "/api/geek-content-creator-v2/agents/resolve" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const agents = publishedAgents().filter((agent) => body.selectedAgentIds?.includes(agent.id));
    if (agents.filter((agent) => agent.role === "producer").length !== 1) {
      return send(res, 422, { error: "Exactly one producer is required" });
    }
    return send(res, 200, {
      snapshotVersion: "agent-team.v1",
      catalogVersion: "agent-catalog.2026-09-08",
      snapshotDigest: "sha256:teamfixture",
      selectedAgentIds: agents.map((agent) => agent.id),
      agents: agents.map((agent) => ({
        ...agent,
        pinnedSkills: agent.skills,
      })),
      skills: [...new Map(agents.flatMap((agent) => agent.skills).map((skill) => [skill.versionId, skill])).values()],
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/agents/admin" && req.method === "GET") {
    if (authorization === "Bearer viewer-access") return send(res, 403, { error: "Administrator role required" });
    return send(res, 200, { authorized: true, agents: [...adminAgentHistory, adminAgent] });
  }
  if (url.pathname === "/api/geek-content-creator-v2/agents/admin" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const selectedSkills = publishedSkills().filter((skill) => body.skillVersionIds?.includes(skill.versionId));
    adminAgentHistory.push(structuredClone(adminAgent));
    adminAgent = {
      ...adminAgent,
      id: body.slug || String(body.displayName || "specialist").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      agentId: crypto.randomUUID(),
      versionId: crypto.randomUUID(),
      name: body.displayName,
      description: body.description,
      objective: body.objective,
      version: body.semanticVersion,
      digest: `sha256:${"9".repeat(64)}`,
      role: body.stageParticipation?.some((row) => row.role === "producer") ? "producer" : body.stageParticipation?.[0]?.role || "contributor",
      specialty: body.slug || "specialist",
      instructions: body.instructions,
      skillIds: selectedSkills.map((skill) => skill.id),
      skills: selectedSkills.map((skill) => ({ id: skill.id, name: skill.name, version: skill.version, versionId: skill.versionId, digest: skill.packageDigest })),
      participation: body.stageParticipation,
      supportedStages: body.stageParticipation.map((row) => row.stage),
      supportedContentTypes: body.contentTypes,
      tools: body.allowedTools,
      models: body.allowedModels,
      modelPolicy: body.modelPolicy,
      modelPolicyVersion: body.modelPolicyVersion,
      tests: [],
      findings: [],
      audit: [],
      status: "draft",
    };
    return send(res, 200, { versionId: adminAgent.versionId });
  }
  const createAgentVersion = url.pathname.match(/^\/api\/geek-content-creator-v2\/agents\/admin\/([^/]+)\/versions$/);
  if (createAgentVersion && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const selectedSkills = publishedSkills().filter((skill) => body.skillVersionIds?.includes(skill.versionId));
    const predecessor = [adminAgent, ...adminAgentHistory].find((agent) => agent.agentId === createAgentVersion[1]);
    if (!predecessor) return send(res, 404, { error: "Agent not found" });
    adminAgentHistory.push(structuredClone(predecessor));
    adminAgent = {
      ...predecessor,
      versionId: crypto.randomUUID(),
      version: body.semanticVersion,
      digest: `sha256:${"8".repeat(64)}`,
      objective: body.objective,
      instructions: body.instructions,
      skillIds: selectedSkills.map((skill) => skill.id),
      skills: selectedSkills.map((skill) => ({ id: skill.id, name: skill.name, version: skill.version, versionId: skill.versionId, digest: skill.packageDigest })),
      participation: body.stageParticipation,
      supportedStages: body.stageParticipation.map((row) => row.stage),
      supportedContentTypes: body.contentTypes,
      tools: body.allowedTools,
      models: body.allowedModels,
      modelPolicy: { version: "content-model-policy.v1", allowedModels: body.allowedModels },
      modelPolicyVersion: body.modelPolicyVersion,
      tests: [],
      findings: [],
      audit: [],
      status: "draft",
    };
    return send(res, 200, { versionId: adminAgent.versionId });
  }
  const agentTestHistory = url.pathname.match(/^\/api\/geek-content-creator-v2\/agents\/admin\/([^/]+)\/tests$/);
  if (agentTestHistory && req.method === "GET") {
    return send(res, 200, [...agentTestRuns.values()]
      .filter((run) => run.agentVersionId === agentTestHistory[1])
      .sort((a, b) => b.queuedAtUtc.localeCompare(a.queuedAtUtc)));
  }
  const cancelAgentTest = url.pathname.match(/^\/api\/geek-content-creator-v2\/agents\/admin\/test-runs\/([^/]+)\/cancel$/);
  if (cancelAgentTest && req.method === "POST") {
    const run = agentTestRuns.get(cancelAgentTest[1]);
    if (!run) return send(res, 404, { error: "Test run not found" });
    const cancelled = {
      ...run,
      status: "cancelled",
      phase: "cancelled",
      progressPercent: 100,
      cancellationRequestedAtUtc: new Date().toISOString(),
      completedAtUtc: new Date().toISOString(),
    };
    storeAgentTestRun(cancelled);
    return send(res, 202, cancelled);
  }
  const agentFinding = url.pathname.match(/^\/api\/geek-content-creator-v2\/agents\/admin\/([^/]+)\/findings\/([^/]+)$/);
  if (agentFinding && req.method === "PATCH") {
    const target = [adminAgent, ...adminAgentHistory].find((agent) => agent.versionId === agentFinding[1]);
    if (!target) return send(res, 404, { error: "Agent version not found" });
    const body = JSON.parse(rawBody || "{}");
    target.findings = target.findings.map((finding) => finding.id === agentFinding[2]
      ? { ...finding, disposition: body.disposition, reviewerRationale: body.reviewerRationale }
      : finding);
    return send(res, 200, target.findings.find((finding) => finding.id === agentFinding[2]));
  }
  const agentAdminAction = url.pathname.match(/^\/api\/geek-content-creator-v2\/agents\/admin\/([^/]+)\/(test|review|publish|deprecate|revoke)$/);
  if (agentAdminAction && req.method === "POST") {
    const action = agentAdminAction[2];
    const body = JSON.parse(rawBody || "{}");
    const target = [adminAgent, ...adminAgentHistory].find((agent) => agent.versionId === agentAdminAction[1]);
    if (!target) return send(res, 404, { error: "Agent version not found" });
    if (action === "test") {
      if (target.status !== "approved") return send(res, 409, { error: "Version must be approved before testing." });
      const run = {
        id: crypto.randomUUID(),
        agentVersionId: target.versionId,
        versionDigest: target.digest,
        scenario: body.scenario || "contract",
        status: "queued",
        progressPercent: 0,
        phase: "queued",
        resultJson: null,
        error: null,
        attemptCount: 0,
        queuedAtUtc: new Date().toISOString(),
        startedAtUtc: null,
        completedAtUtc: null,
        cancellationRequestedAtUtc: null,
      };
      storeAgentTestRun(run);
      return send(res, 202, { runId: run.id, status: run.status, testRun: run });
    } else if (action === "review") {
      if (target.findings.some((finding) => finding.blocking && finding.disposition === "open")) {
        return send(res, 409, { error: "Blocking findings must be dispositioned." });
      }
      target.status = body.decision === "approve" ? "approved" : "draft";
    } else if (action === "publish" && target.status === "approved"
      && [...agentTestRuns.values()].filter((run) => run.agentVersionId === target.versionId)
        .sort((a, b) => b.queuedAtUtc.localeCompare(a.queuedAtUtc))[0]?.status === "passed") {
      target.status = "published";
    } else if (action === "deprecate" && target.status === "published") {
      target.status = "deprecated";
    } else if (action === "revoke") {
      target.status = "revoked";
    } else {
      return send(res, 409, { error: "Invalid lifecycle transition" });
    }
    target.audit = [...(target.audit || []), { id: `agent-audit-${Date.now()}`, action, actor: "admin@example.test", atUtc: "2026-09-08T20:30:00Z", detail: body.notes || body.reason || null }];
    return send(res, 200, { versionId: target.versionId });
  }
  const agentDetail = url.pathname.match(/^\/api\/geek-content-creator-v2\/agents\/([^/]+)$/);
  if (agentDetail && req.method === "GET") {
    const found = publishedAgents().find((agent) => agent.id === decodeURIComponent(agentDetail[1]));
    return found ? send(res, 200, found) : send(res, 404, { error: "Agent not found" });
  }
  if (url.pathname === "/api/geek-content-creator-v2/skills") {
    return send(res, 200, {
      catalogVersion: "gcc-safe-skills.2026-09-08",
      envelopeVersion: "gcc-skill-envelope.v2",
      selectionMode: "automatic-read-only",
      customizationAvailable: false,
      activeSkillIds: [],
      skills: publishedSkills(),
      recommendedBundles: [
        {
          id: "technical-authority",
          name: "Technical authority",
          goal: "Explain implementation decisions, constraints, and tradeoffs precisely.",
          skillIds: ["citation-discipline", "technical-depth"],
        },
      ],
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/skills/resolve") {
    return send(res, 200, {
      snapshotVersion: "gcc-skill-envelope.v2",
      catalogVersion: "gcc-safe-skills.2026-09-08",
      snapshotDigest: "sha256:snapshotfixture",
      resolvedAtUtc: "2026-09-08T20:10:00Z",
      signatureKeyId: "skills-key-2026-09",
      skills: publishedSkills(),
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/skills/admin" && req.method === "GET") {
    if (authorization === "Bearer viewer-access") {
      return send(res, 403, { error: "Administrator role required" });
    }
    return send(res, 200, { authorized: true, skills: [adminSkill] });
  }
  if (url.pathname === "/api/geek-content-creator-v2/skills/admin/import" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    if (/llama[\s_-]*(parse|cloud)|@llamaindex\/cloud/i.test(JSON.stringify(body))) {
      return send(res, 422, { error: "Hosted parser dependency is prohibited" });
    }
    adminSkill = {
      ...adminSkill,
      source: { repositoryUrl: body.repositoryUrl, commit: body.immutableRef, path: body.skillPath },
      reviewStatus: "quarantined",
      audit: [...adminSkill.audit, {
        id: `audit-${adminSkill.audit.length + 1}`, actor: "admin@example.test", action: "imported",
        atUtc: "2026-09-08T20:11:00Z", beforeStatus: null, afterStatus: "quarantined",
      }],
    };
    return send(res, 200, { versionId: adminSkill.versionId });
  }
  if (url.pathname === "/api/geek-content-creator-v2/skills/admin/import-agentic-skill" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    adminSkill = {
      ...adminSkill,
      source: {
        repositoryUrl: "https://github.com/vercel-labs/skills",
        commit: "0123456789abcdef0123456789abcdef01234567",
        path: "skills/find-skills",
      },
      reviewStatus: "quarantined",
      audit: [...adminSkill.audit, {
        id: `audit-${adminSkill.audit.length + 1}`, actor: "admin@example.test", action: "imported-agentic-skill",
        atUtc: "2026-09-09T15:20:00Z", beforeStatus: null, afterStatus: "quarantined",
        detail: body.listingUrl,
      }],
    };
    return send(res, 200, {
      listingUrl: body.listingUrl,
      packageSpecifier: "vercel-labs/skills@find-skills",
      immutableRef: adminSkill.source.commit,
      package: { versionId: adminSkill.versionId },
    });
  }
  const findingMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/skills\/admin\/([^/]+)\/findings\/([^/]+)$/);
  if (findingMatch && req.method === "PATCH") {
    const body = JSON.parse(rawBody || "{}");
    adminSkill.findings = adminSkill.findings.map((finding) =>
      finding.id === findingMatch[2] ? { ...finding, disposition: body.disposition, reviewerRationale: body.reviewerRationale } : finding
    );
    return send(res, 200, { ok: true });
  }
  const adminActionMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/skills\/admin\/([^/]+)\/(review|publish|deprecate)$/);
  if (adminActionMatch && req.method === "POST") {
    const action = adminActionMatch[2];
    const body = JSON.parse(rawBody || "{}");
    const before = adminSkill.reviewStatus;
    if (action === "review") {
      adminSkill.reviewStatus = body.decision === "approve" ? "approved" : "rejected";
      adminSkill.reviewer = "admin@example.test";
    } else if (action === "publish" && adminSkill.reviewStatus === "approved") {
      adminSkill.reviewStatus = "published";
      adminSkill.publishedAtUtc = "2026-09-08T20:13:00Z";
    } else if (action === "deprecate" && adminSkill.reviewStatus === "published") {
      adminSkill.reviewStatus = "deprecated";
      adminSkill.deprecatedAtUtc = "2026-09-08T20:14:00Z";
    } else {
      return send(res, 409, { error: "Invalid lifecycle transition" });
    }
    adminSkill.audit = [...adminSkill.audit, {
      id: `audit-${adminSkill.audit.length + 1}`, actor: "admin@example.test", action,
      atUtc: `2026-09-08T20:${12 + adminSkill.audit.length}:00Z`,
      beforeStatus: before, afterStatus: adminSkill.reviewStatus, detail: body.notes || body.reason || null,
    }];
    return send(res, 200, { versionId: adminSkill.versionId });
  }

  if (url.pathname === "/api/geek-content-creator-v2/project-site/runs") {
    return send(res, 200, [{
      runId: "crawl-1",
      siteUrl: "https://example.test",
      status: "complete",
      completedAtUtc: "2026-09-08T20:00:00Z",
    }]);
  }
  if (url.pathname === "/api/geek-content-creator-v2/project-site/runs/latest") {
    return send(res, 200, { runId: "crawl-1", status: "complete" });
  }
  if (url.pathname === "/api/geek-content-creator-v2/project-site/runs/crawl-1") {
    return send(res, 200, { runId: "crawl-1", status: "complete" });
  }
  if (url.pathname === "/api/geek-content-creator-v2/project-site/runs/crawl-1/pages") {
    return send(res, 200, {
      pages: [{ id: "page-1", url: "https://example.test/reliable-content", title: "Reliable content operations", markdown: fixtureMarkdown }],
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/project-site/runs/crawl-1/site-hierarchy") {
    return send(res, 200, { siteHierarchy: { headings: [{ text: "Solutions", children: [{ text: "Content operations" }] }] } });
  }
  if (url.pathname === "/api/geek-content-creator-v2/project-site/runs/crawl-1/promote-to-source" && req.method === "POST") {
    return send(res, 200, {
      assetId: "knowledge-website",
      versionId: "knowledge-website-v1",
      resourceId: "knowledge-website-resource",
      pageCount: 1,
      lifecycleState: "approved",
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/projects" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-canvas-project.v1",
      projects: [...canvasProjects.values()].map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        updatedAt: project.updatedAt,
        owner: project.owner,
        collaborators: project.collaborators,
        persistence: "server",
        assetCount: project.assets.length,
      })),
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/projects" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const project = body.seedDemo
      ? seedCanvasProject()
      : {
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description || "",
        status: body.status || "planning",
        updatedAt: new Date().toISOString(),
        owner: "owner",
        collaborators: [],
        persistence: "server",
        activity: [],
        assets: [],
      };
    if (!body.seedDemo) canvasProjects.set(project.id, project);
    return send(res, 201, { contractVersion: "gcc-canvas-project.v1", project });
  }
  {
    const toAgentMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/projects\/([^/]+)\/assets\/([^/]+)\/to-agent$/);
    if (toAgentMatch && req.method === "POST") {
      const projectId = decodeURIComponent(toAgentMatch[1]);
      const assetId = decodeURIComponent(toAgentMatch[2]);
      const project = canvasProjects.get(projectId);
      if (!project) return send(res, 404, { error: "Project not found." });
      const asset = project.assets.find((item) => item.id === assetId);
      if (!asset) return send(res, 404, { error: "Asset not found." });
      const latest = [...asset.versions].sort((a, b) => b.version - a.version)[0];
      if (!latest) return send(res, 409, { error: "Asset has no versions to send." });
      const body = JSON.parse(rawBody || "{}");
      let capabilityId = body.capabilityId;
      if (!capabilityId) {
        capabilityId = asset.kind === "article" || asset.kind === "brief" ? "pillar-outline" : "faq-generator";
      }
      if (!["faq-generator", "pillar-outline", "citable-claims"].includes(capabilityId)) {
        return send(res, 400, { error: "capabilityId must be faq-generator, pillar-outline, or citable-claims." });
      }
      const agentLabel = capabilityId === "pillar-outline"
        ? "Pillar Article Outline"
        : capabilityId === "citable-claims"
          ? "Citable Claims"
          : "FAQ Generator";
      const actor = body.createdBy || "You";
      project.activity = [
        {
          id: crypto.randomUUID(),
          kind: "handoff",
          actor,
          occurredAt: new Date().toISOString(),
          message: `Sent ${asset.title} to ${agentLabel}`,
        },
        ...project.activity,
      ];
      project.updatedAt = new Date().toISOString();
      const query = new URLSearchParams({
        fromCanvasProjectId: project.id,
        fromCanvasAssetId: asset.id,
        fromCanvasVersionId: latest.id,
        topic: asset.title,
      });
      if (latest.summary) query.set("sourceContent", latest.summary);
      return send(res, 200, {
        contractVersion: "gcc-canvas-project.v1",
        project,
        capabilityId,
        agentLabel,
        redirectPath: `/task-agents/${encodeURIComponent(capabilityId)}?${query.toString()}`,
      });
    }
    const toGridMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/projects\/([^/]+)\/assets\/([^/]+)\/to-grid$/);
    if (toGridMatch && req.method === "POST") {
      const projectId = decodeURIComponent(toGridMatch[1]);
      const assetId = decodeURIComponent(toGridMatch[2]);
      const project = canvasProjects.get(projectId);
      if (!project) return send(res, 404, { error: "Project not found." });
      const asset = project.assets.find((item) => item.id === assetId);
      if (!asset) return send(res, 404, { error: "Asset not found." });
      const latest = [...asset.versions].sort((a, b) => b.version - a.version)[0];
      if (!latest) return send(res, 409, { error: "Asset has no versions to convert." });
      const body = JSON.parse(rawBody || "{}");
      let capability = body.capability;
      if (!capability) {
        capability = asset.kind === "article" || asset.kind === "brief" ? "pillar-outline" : "faq-generator";
      }
      if (capability !== "faq-generator" && capability !== "pillar-outline") {
        return send(res, 400, { error: "capability must be faq-generator or pillar-outline." });
      }
      const gridName = `${asset.title} batch`;
      const grid = {
        id: crypto.randomUUID(),
        name: gridName,
        description: `Batch converted from Canvas asset “${asset.title}” (v${latest.version}) in project “${project.name}”.`,
        status: "ready",
        updatedAt: new Date().toISOString(),
        owner: "owner",
        persistence: "server",
        config: defaultGridConfig(capability),
        rows: [{
          id: crypto.randomUUID(),
          rowIndex: 0,
          input: {
            topic: asset.title,
            sourceSummary: latest.summary,
            sourceProjectId: project.id,
            sourceAssetId: asset.id,
            sourceVersionId: latest.id,
            sourceVersionNumber: latest.version,
          },
          output: null,
          status: "pending",
          error: "",
          updatedAt: new Date().toISOString(),
        }],
        runs: [],
      };
      grids.set(grid.id, grid);
      const actor = body.createdBy || "You";
      project.activity = [
        {
          id: crypto.randomUUID(),
          kind: "handoff",
          actor,
          occurredAt: new Date().toISOString(),
          message: `Converted ${asset.title} to batch grid ${gridName}`,
        },
        ...project.activity,
      ];
      project.updatedAt = new Date().toISOString();
      return send(res, 200, {
        contractVersion: "gcc-canvas-project.v1",
        project,
        gridId: grid.id,
        gridName,
        capability,
        rowCount: grid.rows.length,
      });
    }
    const commentMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/projects\/([^/]+)\/assets\/([^/]+)\/comments$/);
    if (commentMatch && req.method === "POST") {
      const projectId = decodeURIComponent(commentMatch[1]);
      const assetId = decodeURIComponent(commentMatch[2]);
      const project = canvasProjects.get(projectId);
      if (!project) return send(res, 404, { error: "Project not found." });
      const asset = project.assets.find((item) => item.id === assetId);
      if (!asset) return send(res, 404, { error: "Asset not found." });
      const body = JSON.parse(rawBody || "{}");
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) return send(res, 400, { error: "message is required." });
      if (message.length > 500) return send(res, 400, { error: "message must be 500 characters or fewer." });
      const actor = body.createdBy || "You";
      project.activity = [
        {
          id: crypto.randomUUID(),
          kind: "comment",
          actor,
          occurredAt: new Date().toISOString(),
          message: `Commented on ${asset.title}: ${message}`,
        },
        ...project.activity,
      ];
      project.updatedAt = new Date().toISOString();
      return send(res, 200, { contractVersion: "gcc-canvas-project.v1", project });
    }
    const attachMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/projects\/([^/]+)\/assets\/from-task-artifact$/);
    if (attachMatch && req.method === "POST") {
      const projectId = decodeURIComponent(attachMatch[1]);
      const project = canvasProjects.get(projectId);
      if (!project) return send(res, 404, { error: "Project not found." });
      const body = JSON.parse(rawBody || "{}");
      if (!body.runId || !body.artifactVersionId) {
        return send(res, 400, { error: "runId and artifactVersionId are required." });
      }
      const title = body.title || `Task report · ${body.artifactVersionId}`;
      const assetId = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      project.assets = [
        ...project.assets,
        {
          id: assetId,
          title,
          kind: body.kind || "report",
          parentAssetIds: [],
          versions: [{
            id: versionId,
            version: 1,
            createdAt: new Date().toISOString(),
            createdBy: "You",
            status: "draft",
            summary: `Attached from task run ${body.runId}.`,
            evidence: [],
            provenance: {
              origin: "agent",
              note: `Attached from task run ${body.runId}.`,
              sourceRunId: body.runId,
              sourceArtifactVersionId: body.artifactVersionId,
              artifactType: body.artifactType || "task-artifact",
              digest: body.digest || "",
            },
          }],
        },
      ];
      project.activity = [
        {
          id: crypto.randomUUID(),
          kind: "handoff",
          actor: "You",
          occurredAt: new Date().toISOString(),
          message: `Attached ${title} from task artifact`,
        },
        ...project.activity,
      ];
      project.updatedAt = new Date().toISOString();
      return send(res, 200, {
        contractVersion: "gcc-canvas-project.v1",
        project,
        assetId,
      });
    }
    const attachGridMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/projects\/([^/]+)\/assets\/from-grid$/);
    if (attachGridMatch && req.method === "POST") {
      const projectId = decodeURIComponent(attachGridMatch[1]);
      const project = canvasProjects.get(projectId);
      if (!project) return send(res, 404, { error: "Project not found." });
      const body = JSON.parse(rawBody || "{}");
      const grid = grids.get(body.gridId);
      if (!grid) return send(res, 404, { error: "Grid not found." });
      const selected = new Set(Array.isArray(body.rowIds) ? body.rowIds : []);
      const rows = grid.rows
        .filter((row) => row.status === "succeeded")
        .filter((row) => selected.size === 0 || selected.has(row.id));
      if (rows.length === 0) {
        return send(res, 409, { error: "No succeeded grid rows were available to attach." });
      }
      const attached = [];
      for (const row of rows) {
        const topic = typeof row.input?.topic === "string" ? row.input.topic : "Untitled topic";
        const preview = typeof row.output?.result === "string" ? row.output.result : `Grid output for ${topic}.`;
        const title = body.titlePrefix ? `${body.titlePrefix} · ${topic}` : `${grid.name} · ${topic}`;
        const assetId = crypto.randomUUID();
        project.assets = [
          ...project.assets,
          {
            id: assetId,
            title,
            kind: body.kind || "report",
            parentAssetIds: [],
            versions: [{
              id: crypto.randomUUID(),
              version: 1,
              createdAt: new Date().toISOString(),
              createdBy: "You",
              status: "draft",
              summary: preview,
              evidence: [],
              provenance: {
                origin: "agent",
                note: `Attached from grid ${grid.name} row ${row.rowIndex + 1}.`,
                sourceGridId: grid.id,
                sourceGridRowId: row.id,
                sourceRunId: typeof row.output?.taskRunId === "string" ? row.output.taskRunId : undefined,
                artifactType: typeof row.output?.artifactType === "string" ? row.output.artifactType : undefined,
              },
            }],
          },
        ];
        project.activity = [
          {
            id: crypto.randomUUID(),
            kind: "handoff",
            actor: "You",
            occurredAt: new Date().toISOString(),
            message: `Attached ${title} from grid ${grid.name}`,
          },
          ...project.activity,
        ];
        attached.push({ assetId, title, rowId: row.id });
      }
      project.updatedAt = new Date().toISOString();
      return send(res, 200, {
        contractVersion: "gcc-canvas-project.v1",
        project,
        attachedCount: attached.length,
        attached,
      });
    }
  }
  {
    const match = url.pathname.match(/^\/api\/geek-content-creator-v2\/projects\/([^/]+)(?:\/assets(?:\/([^/]+)\/versions)?)?$/);
    if (match) {
      const projectId = decodeURIComponent(match[1]);
      const assetId = match[2] ? decodeURIComponent(match[2]) : null;
      const project = canvasProjects.get(projectId);
      if (!project) return send(res, 404, { error: "Project not found." });
      if (!assetId && req.method === "GET") {
        return send(res, 200, { contractVersion: "gcc-canvas-project.v1", project });
      }
      if (!assetId && req.method === "POST" && url.pathname.endsWith("/assets")) {
        const body = JSON.parse(rawBody || "{}");
        const nextAssetId = crypto.randomUUID();
        project.assets = [
          ...project.assets,
          {
            id: nextAssetId,
            title: body.title || "Untitled asset",
            kind: body.kind || "brief",
            parentAssetIds: body.parentAssetIds || [],
            versions: [],
          },
        ];
        project.updatedAt = new Date().toISOString();
        return send(res, 200, { contractVersion: "gcc-canvas-project.v1", project });
      }
      if (assetId && url.pathname.endsWith("/versions") && req.method === "POST") {
        const body = JSON.parse(rawBody || "{}");
        const asset = project.assets.find((item) => item.id === assetId);
        if (!asset) return send(res, 404, { error: "Asset not found." });
        const nextVersion = Math.max(0, ...asset.versions.map((item) => item.version)) + 1;
        const status = body.status || "draft";
        const actor = body.createdBy || "You";
        asset.versions = [...asset.versions, {
          id: crypto.randomUUID(),
          version: nextVersion,
          createdAt: body.createdAt || new Date().toISOString(),
          createdBy: actor,
          status,
          summary: body.summary || `Successor draft based on v${nextVersion - 1}.`,
          evidence: body.evidence || [],
          provenance: body.provenance || { origin: "human", note: "" },
        }];
        const activity = [
          {
            id: crypto.randomUUID(),
            kind: "versioned",
            actor,
            occurredAt: new Date().toISOString(),
            message: `Created ${asset.title} v${nextVersion}`,
          },
        ];
        if (status === "in-review") {
          activity.unshift({
            id: crypto.randomUUID(),
            kind: "review",
            actor,
            occurredAt: new Date().toISOString(),
            message: `Requested review for ${asset.title}`,
          });
        } else if (status === "approved") {
          activity.unshift({
            id: crypto.randomUUID(),
            kind: "approval",
            actor,
            occurredAt: new Date().toISOString(),
            message: `Approved ${asset.title}`,
          });
        } else if (status === "published") {
          activity.unshift({
            id: crypto.randomUUID(),
            kind: "publish",
            actor,
            occurredAt: new Date().toISOString(),
            message: `Published ${asset.title}`,
          });
        }
        project.activity = [...activity, ...project.activity];
        project.updatedAt = new Date().toISOString();
        return send(res, 200, { contractVersion: "gcc-canvas-project.v1", project });
      }
    }
  }
  if (url.pathname === "/api/geek-content-creator-v2/roi/observed" && req.method === "GET") {
    const lookbackDays = Math.min(365, Math.max(1, Number(url.searchParams.get("lookbackDays") || 90)));
    const since = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    let publishedCount = 0;
    for (const project of canvasProjects.values()) {
      for (const asset of project.assets || []) {
        const latest = [...(asset.versions || [])].sort((a, b) => (b.version || 0) - (a.version || 0))[0];
        if (!latest || latest.status !== "published") continue;
        const created = Date.parse(latest.createdAt || latest.createdAtUtc || "");
        if (Number.isFinite(created) && created >= since) publishedCount += 1;
      }
    }
    return send(res, 200, {
      contractVersion: "gcc-roi-observed.v4",
      observed: {
        generatedCount: 48,
        acceptedCount: 31,
        publishedCount,
        rejectedCount: 9,
        cancelledCount: 2,
        reviewMinutes: 410,
        lookbackDays,
        periodLabel: `Last ${lookbackDays} days (TaskRuns + Canvas publishes)`,
        source: "telemetry",
        groundednessRate: 0.72,
        groundedHits: 36,
        groundedTotal: 50,
        schemaValidityRate: 0.9,
        schemaValidHits: 18,
        schemaValidTotal: 20,
        qualityRunsSampled: 12,
        meanEditDistance: 0.18,
        editDistanceSamples: 8,
        notes: [
          "Counts are owner-scoped workflow outcomes, not cash ROI.",
          "generated/accepted/rejected come from TaskRuns in the lookback window.",
          "publishedCount counts Canvas asset versions whose latest status is published in the window.",
          "reviewMinutes approximates wall-clock TaskRun duration for terminal runs.",
          "groundednessRate uses sections.grounded and claim/FAQ verificationStatus=supported.",
          "schemaValidityRate uses artifact validationState plus schemaMarkup validation[].valid.",
          "meanEditDistance compares first vs latest Canvas asset Summary text when both exist.",
          "Rates are workflow quality outcomes from TaskRun artifacts — not cash ROI.",
          "meanEditDistance is normalized rewrite effort (0 identical → 1 fully rewritten), not cash ROI.",
        ],
      },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/roi/outcomes" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-roi-outcomes.v1",
      outcomes: [...customerOutcomes.values()].sort((a, b) => String(b.periodEnd).localeCompare(String(a.periodEnd))),
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/roi/outcomes" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const allowed = new Set([
      "customer-reported",
      "telemetry-measured",
      "modeled",
      "experimental",
      "independently-audited",
    ]);
    if (!body.title || !body.metricDefinition || !body.source || !body.periodStart || !body.periodEnd) {
      return send(res, 400, { error: "title, metricDefinition, source, periodStart, and periodEnd are required." });
    }
    const evidenceStatus = String(body.evidenceStatus || "customer-reported").toLowerCase();
    if (!allowed.has(evidenceStatus)) {
      return send(res, 400, { error: "Invalid evidenceStatus." });
    }
    const now = new Date().toISOString();
    const outcome = {
      id: `outcome-${crypto.randomUUID()}`,
      title: String(body.title).trim(),
      metricDefinition: String(body.metricDefinition).trim(),
      periodStart: String(body.periodStart),
      periodEnd: String(body.periodEnd),
      baseline: body.baseline ? String(body.baseline) : null,
      denominator: body.denominator ? String(body.denominator) : null,
      observedValue: body.observedValue ? String(body.observedValue) : null,
      source: String(body.source).trim(),
      evidenceStatus,
      attributionMethod: body.attributionMethod ? String(body.attributionMethod) : null,
      attributionConfidence: Number.isFinite(Number(body.attributionConfidence))
        ? Number(body.attributionConfidence)
        : null,
      workflowVersionsJson: body.workflowVersionsJson ? String(body.workflowVersionsJson) : "[]",
      generatedCount: body.generatedCount == null ? null : Number(body.generatedCount),
      acceptedCount: body.acceptedCount == null ? null : Number(body.acceptedCount),
      publishedCount: body.publishedCount == null ? null : Number(body.publishedCount),
      rejectedCount: body.rejectedCount == null ? null : Number(body.rejectedCount),
      reviewMinutes: body.reviewMinutes == null ? null : Number(body.reviewMinutes),
      notes: body.notes ? String(body.notes) : null,
      createdAtUtc: now,
      updatedAtUtc: now,
    };
    customerOutcomes.set(outcome.id, outcome);
    return send(res, 200, { contractVersion: "gcc-roi-outcomes.v1", outcome });
  }
  const outcomeDelete = url.pathname.match(/^\/api\/geek-content-creator-v2\/roi\/outcomes\/([^/]+)$/);
  if (outcomeDelete && req.method === "DELETE") {
    if (!customerOutcomes.has(outcomeDelete[1])) return send(res, 404, { error: "Not found" });
    customerOutcomes.delete(outcomeDelete[1]);
    return send(res, 204, "");
  }
  if (url.pathname === "/api/geek-content-creator-v2/grids" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-grid.v1",
      grids: [...grids.values()].map((grid) => ({
        id: grid.id,
        name: grid.name,
        description: grid.description,
        status: grid.status,
        updatedAt: grid.updatedAt,
        owner: grid.owner,
        rowCount: grid.rows.length,
        lastRunStatus: grid.runs[0]?.status ?? null,
        persistence: "server",
        schedule: summarizeGridSchedule(grid),
      })),
    });
  }
  const aeoPipelineStages = [
    { key: "plan-queries", lifecycle: "plan", kind: "task-agent", capabilityId: "query-planner", displayName: "Query Planner", dependsOn: [] },
    { key: "create-faq", lifecycle: "create", kind: "task-agent", capabilityId: "faq-generator", displayName: "FAQ Generator", dependsOn: ["plan-queries"] },
    { key: "adapt-canvas", lifecycle: "adapt", kind: "handoff", handoff: "canvas", displayName: "Canvas adapt", dependsOn: ["create-faq"] },
    { key: "activate-publish", lifecycle: "activate", kind: "handoff", handoff: "publish", displayName: "Publish handoff", dependsOn: ["adapt-canvas"] },
    { key: "optimize-readiness", lifecycle: "optimize", kind: "task-agent", capabilityId: "ai-readiness", displayName: "AI Readiness Score", dependsOn: ["activate-publish"] },
    { key: "optimize-roi", lifecycle: "optimize", kind: "task-agent", capabilityId: "roi-business-calculator", displayName: "ROI Business Calculator", dependsOn: ["optimize-readiness"] },
  ];
  function pipelineDetail(pipeline) {
    return {
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description,
      status: pipeline.status,
      versionNumber: pipeline.versionNumber,
      digest: pipeline.digest,
      stages: pipeline.stages,
      policyJson: pipeline.policyJson,
      createdAtUtc: pipeline.createdAtUtc,
      updatedAtUtc: pipeline.updatedAtUtc,
      runs: pipeline.runs,
    };
  }
  function executePipelineRun(pipeline, failStageKey = null, workItemInputs = null) {
    const now = new Date().toISOString();
    const inputs = Array.isArray(workItemInputs) && workItemInputs.length > 0
      ? workItemInputs
      : [{}];
    const history = [];
    const workItems = [];
    let anyFailed = false;
    for (let index = 0; index < inputs.length; index += 1) {
      let failed = false;
      const stageAttempts = [];
      for (const stage of pipeline.stages) {
      let status = "succeeded";
      let error = null;
      let output;
      if (stage.capabilityId === "roi-business-calculator") {
        output = {
          artifactType: "roiProjection.v1",
          formulaVersion: "gcc-roi-formulas.v1",
          contractVersion: "roiBusinessCalculatorInput.v1",
          capabilityId: "roi-business-calculator",
          lifecycle: stage.lifecycle,
          workItemIndex: index,
          summary: "Directional ROI projection from pipeline Optimize stage.",
          scenarios: [
            { scenario: "conservative", label: "Conservative", roiPercent: 30 },
            { scenario: "expected", label: "Expected", roiPercent: 48 },
            { scenario: "upside", label: "Upside", roiPercent: 70 },
          ],
          warnings: ["Directional model only — not a quote, guarantee, or audited finance result."],
        };
      } else if (stage.kind === "task-agent") {
        output = {
          artifactType: `${stage.capabilityId}.stub.v1`,
          capabilityId: stage.capabilityId,
          summary: `Stub artifact from ${stage.displayName}.`,
          lifecycle: stage.lifecycle,
          workItemIndex: index,
        };
      } else {
        output = {
          handoff: stage.handoff,
          summary: `Completed ${stage.displayName} handoff.`,
          lifecycle: stage.lifecycle,
          workItemIndex: index,
        };
      }
      if (failed) {
        status = "skipped";
        error = "Skipped after earlier stage failure.";
        output = null;
      } else if (failStageKey && failStageKey === stage.key && index === 0) {
        status = "failed";
        error = `Injected isolation failure at stage '${stage.key}'.`;
        output = null;
        failed = true;
      }
        stageAttempts.push({
          id: crypto.randomUUID(),
          stageKey: stage.key,
          lifecycleStage: stage.lifecycle,
          kind: stage.kind,
          displayName: stage.displayName,
          capabilityId: stage.capabilityId || null,
          handoff: stage.handoff || null,
          attemptNumber: 1,
          status,
          output,
          error,
          startedAtUtc: now,
          completedAtUtc: now,
        });
        history.push({
          atUtc: now,
          workItemIndex: index,
          stageKey: stage.key,
          lifecycle: stage.lifecycle,
          status,
        });
      }
      workItems.push({
        id: crypto.randomUUID(),
        workItemIndex: index,
        input: inputs[index],
        status: failed ? "failed" : "succeeded",
        error: failed ? `Work item failed at stage '${failStageKey}'.` : null,
        updatedAtUtc: now,
        stageAttempts,
      });
      anyFailed = anyFailed || failed;
    }
    const run = {
      id: `pipeline-run-${pipeline.runs.length + 1}`,
      definitionVersionNumber: pipeline.versionNumber,
      definitionDigest: pipeline.digest,
      status: anyFailed ? "failed" : "succeeded",
      actorUserId: "e2e-user",
      startedAtUtc: now,
      completedAtUtc: now,
      pausedAtUtc: null,
      error: anyFailed ? "One or more work items failed; later stages on failed items were skipped." : null,
      history,
      workItems,
    };
    pipeline.runs = [run, ...pipeline.runs];
    pipeline.updatedAtUtc = now;
    return run;
  }
  if (url.pathname === "/api/geek-content-creator-v2/pipelines" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-content-pipelines.v1",
      lifecycleStages: ["plan", "create", "adapt", "activate", "optimize"],
      pipelines: [...pipelines.values()].map((pipeline) => ({
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        status: pipeline.status,
        versionNumber: pipeline.versionNumber,
        digest: pipeline.digest,
        updatedAtUtc: pipeline.updatedAtUtc,
        runCount: pipeline.runs.length,
      })),
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/pipelines" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const id = `pipeline-${pipelines.size + 1}`;
    const now = new Date().toISOString();
    const pipeline = {
      id,
      name: body.name || "AEO content pipeline",
      description: body.description
        || "Plan → Create → Adapt → Activate → Optimize using Query Planner, FAQ Generator, Canvas, publish, and AI Readiness.",
      status: body.publish === false ? "draft" : "published",
      versionNumber: 1,
      digest: "p".repeat(64),
      stages: aeoPipelineStages,
      policyJson: body.policyJson || "{}",
      createdAtUtc: now,
      updatedAtUtc: now,
      runs: [],
    };
    pipelines.set(id, pipeline);
    return send(res, 200, {
      contractVersion: "gcc-content-pipelines.v1",
      pipeline: pipelineDetail(pipeline),
    });
  }
  const pipelineMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/pipelines\/([^/]+)(?:\/(runs|publish))?$/);
  if (pipelineMatch) {
    const pipelineId = pipelineMatch[1];
    const action = pipelineMatch[2] || null;
    const pipeline = pipelines.get(pipelineId);
    if (!pipeline) return send(res, 404, { error: "Pipeline not found." });
    if (!action && req.method === "GET") {
      return send(res, 200, {
        contractVersion: "gcc-content-pipelines.v1",
        lifecycleStages: ["plan", "create", "adapt", "activate", "optimize"],
        pipeline: pipelineDetail(pipeline),
      });
    }
    if (action === "publish" && req.method === "POST") {
      pipeline.status = "published";
      pipeline.updatedAtUtc = new Date().toISOString();
      return send(res, 200, { contractVersion: "gcc-content-pipelines.v1", pipeline: pipelineDetail(pipeline) });
    }
    if (action === "runs" && req.method === "POST") {
      if (pipeline.status !== "published") {
        return send(res, 409, { error: "Only published pipelines can be run." });
      }
      const body = JSON.parse(rawBody || "{}");
      executePipelineRun(pipeline, body.failStageKey || null, body.workItems || null);
      return send(res, 200, { contractVersion: "gcc-content-pipelines.v1", pipeline: pipelineDetail(pipeline) });
    }
  }
  const pipelineRunMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/pipelines\/runs\/([^/]+)\/(pause|resume|cancel)$/);
  if (pipelineRunMatch && req.method === "POST") {
    const runId = pipelineRunMatch[1];
    const action = pipelineRunMatch[2];
    for (const pipeline of pipelines.values()) {
      const run = pipeline.runs.find((entry) => entry.id === runId);
      if (!run) continue;
      if (action === "cancel") {
        if (["succeeded", "failed", "cancelled"].includes(run.status)) {
          return send(res, 409, { error: "Run is already terminal." });
        }
        run.status = "cancelled";
        run.completedAtUtc = new Date().toISOString();
        run.error = "Cancelled by operator.";
      } else if (action === "pause") {
        run.status = "paused";
        run.pausedAtUtc = new Date().toISOString();
      } else if (action === "resume") {
        run.status = "running";
        run.pausedAtUtc = null;
      }
      pipeline.updatedAtUtc = new Date().toISOString();
      return send(res, 200, { contractVersion: "gcc-content-pipelines.v1", pipeline: pipelineDetail(pipeline) });
    }
    return send(res, 404, { error: "Pipeline run not found." });
  }
  if (url.pathname === "/api/geek-content-creator-v2/grids/schedules/run-due" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const force = body.force === true;
    const results = [];
    let ranCount = 0;
    let skippedCount = 0;
    for (const grid of grids.values()) {
      const schedule = grid.config.schedule;
      if (!schedule?.enabled || schedule.cadence === "none") {
        skippedCount += 1;
        results.push({ gridId: grid.id, name: grid.name, ran: false, reason: "not-enabled" });
        continue;
      }
      const dueAt = schedule.nextRunAt ? Date.parse(schedule.nextRunAt) : NaN;
      const due = Number.isFinite(dueAt) && dueAt <= Date.now();
      if (!force && !due) {
        skippedCount += 1;
        results.push({ gridId: grid.id, name: grid.name, ran: false, reason: "not-due" });
        continue;
      }
      const mode = schedule.mode === "full" ? "full" : "sample";
      const sampleSize = schedule.sampleSize || 10;
      let reason = force ? "forced" : "due";
      if (grid.config.pipelineDefinitionId) {
        const pipeline = pipelines.get(grid.config.pipelineDefinitionId);
        if (!pipeline) {
          skippedCount += 1;
          results.push({ gridId: grid.id, name: grid.name, ran: false, reason: "pipeline-missing" });
          continue;
        }
        const selected = mode === "full" ? grid.rows : grid.rows.slice(0, sampleSize);
        const run = executePipelineRun(
          pipeline,
          null,
          selected.map((row) => row.input || {}),
        );
        grid.config = {
          ...grid.config,
          lastPipelineRunId: run.id,
        };
        reason = force ? "forced-pipeline" : "due-pipeline";
      } else {
        executeGridRun(grid, mode, sampleSize, "schedule");
      }
      const completed = new Date();
      const next = new Date(completed.getTime());
      if (schedule.cadence === "daily") next.setUTCDate(next.getUTCDate() + 1);
      else if (schedule.cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
      else next.setUTCMonth(next.getUTCMonth() + 1);
      grid.config = {
        ...grid.config,
        schedule: {
          ...schedule,
          lastRunAt: completed.toISOString(),
          nextRunAt: next.toISOString(),
        },
      };
      ranCount += 1;
      results.push({
        gridId: grid.id,
        name: grid.name,
        ran: true,
        reason,
        lastRunStatus: grid.runs[0]?.status ?? null,
      });
    }
    return send(res, 200, {
      contractVersion: "gcc-grid.v1",
      ranCount,
      skippedCount,
      results,
      grids: [...grids.values()].map((grid) => ({
        id: grid.id,
        name: grid.name,
        description: grid.description,
        status: grid.status,
        updatedAt: grid.updatedAt,
        owner: grid.owner,
        rowCount: grid.rows.length,
        lastRunStatus: grid.runs[0]?.status ?? null,
        persistence: "server",
        schedule: summarizeGridSchedule(grid),
      })),
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/grids" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const capability = body.capability === "pillar-outline" ? "pillar-outline" : "faq-generator";
    if (body.capability && body.capability !== "faq-generator" && body.capability !== "pillar-outline") {
      return send(res, 400, { error: "capability must be faq-generator or pillar-outline." });
    }
    const grid = body.seedDemo
      ? seedGrid(capability)
      : {
        id: crypto.randomUUID(),
        name: body.name || "Untitled grid",
        description: body.description || "",
        status: "draft",
        updatedAt: new Date().toISOString(),
        owner: "owner",
        persistence: "server",
        config: defaultGridConfig(capability),
        rows: [],
        runs: [],
      };
    if (!body.seedDemo) grids.set(grid.id, grid);
    return send(res, 201, { contractVersion: "gcc-grid.v1", grid });
  }
  {
    const importMatch = url.pathname.match(
      /^\/api\/geek-content-creator-v2\/grids\/([^/]+)\/rows\/import$/,
    );
    if (importMatch && req.method === "POST") {
      const gridId = decodeURIComponent(importMatch[1]);
      const grid = grids.get(gridId);
      if (!grid) return send(res, 404, { error: "Grid not found." });
      const body = JSON.parse(rawBody || "{}");
      const topics = [];
      const seen = new Set();
      const pushTopic = (raw) => {
        if (typeof raw !== "string") return;
        const topic = raw.trim().replace(/^\uFEFF/, "");
        if (!topic) return;
        const key = topic.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        topics.push(topic);
      };
      if (Array.isArray(body.topics)) body.topics.forEach(pushTopic);
      if (typeof body.text === "string") {
        for (const line of body.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith("\"")) {
            const end = trimmed.indexOf("\"", 1);
            pushTopic(end > 0 ? trimmed.slice(1, end).replace(/\"\"/g, "\"") : trimmed.slice(1));
          } else {
            const comma = trimmed.indexOf(",");
            pushTopic(comma < 0 ? trimmed : trimmed.slice(0, comma).trim());
          }
        }
      }
      if (topics.length === 0) {
        return send(res, 400, {
          error: "No topics found. Paste one topic per line (CSV first column) or supply topics[].",
        });
      }
      if (topics.length > 100) {
        return send(res, 400, { error: "Import is limited to 100 topics per request." });
      }
      if (grid.rows.length + topics.length > 500) {
        return send(res, 400, { error: "Grid would exceed 500 rows." });
      }
      const now = new Date().toISOString();
      for (const topic of topics) {
        grid.rows.push({
          id: crypto.randomUUID(),
          rowIndex: grid.rows.length,
          input: { topic },
          output: null,
          status: "pending",
          error: "",
          updatedAt: now,
        });
      }
      grid.updatedAt = now;
      return send(res, 200, {
        contractVersion: "gcc-grid.v1",
        importedCount: topics.length,
        grid,
      });
    }
  }
  {
    const exportMatch = url.pathname.match(
      /^\/api\/geek-content-creator-v2\/grids\/([^/]+)\/export\.csv$/,
    );
    if (exportMatch && req.method === "GET") {
      const gridId = decodeURIComponent(exportMatch[1]);
      const grid = grids.get(gridId);
      if (!grid) return send(res, 404, { error: "Grid not found." });
      const escape = (value) => {
        const text = String(value ?? "");
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };
      const lines = ["topic,status,rowIndex,result,error,updatedAt"];
      for (const row of [...grid.rows].sort((a, b) => a.rowIndex - b.rowIndex)) {
        const topic = typeof row.input?.topic === "string" ? row.input.topic : "";
        const result = typeof row.output?.result === "string" ? row.output.result : "";
        lines.push([
          escape(topic),
          escape(row.status),
          String(row.rowIndex),
          escape(result),
          escape(row.error || ""),
          escape(row.updatedAt || ""),
        ].join(","));
      }
      const csv = `${lines.join("\n")}\n`;
      res.writeHead(200, cors({
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${(grid.name || "grid").replace(/[^\w.-]+/g, "-")}.csv"`,
      }));
      return res.end(csv);
    }
  }
  {
    const match = url.pathname.match(
      /^\/api\/geek-content-creator-v2\/grids\/([^/]+)(?:\/(rows|runs|pipeline-runs|pipeline|roi-projection|schedule(?:\/run-due)?))?$/,
    );
    if (match) {
      const gridId = decodeURIComponent(match[1]);
      const action = match[2] || null;
      const grid = grids.get(gridId);
      if (!grid) return send(res, 404, { error: "Grid not found." });
      if (!action && req.method === "GET") {
        return send(res, 200, { contractVersion: "gcc-grid.v1", grid });
      }
      if (action === "runs" && req.method === "POST") {
        const body = JSON.parse(rawBody || "{}");
        const mode = body.mode === "full" ? "full" : "sample";
        const sampleSize = Number.isFinite(body.sampleSize) ? body.sampleSize : 10;
        executeGridRun(grid, mode, sampleSize);
        return send(res, 200, { contractVersion: "gcc-grid.v1", grid });
      }
      if (action === "rows" && req.method === "POST") {
        const body = JSON.parse(rawBody || "{}");
        const now = new Date().toISOString();
        grid.rows = [...grid.rows, {
          id: crypto.randomUUID(),
          rowIndex: grid.rows.length,
          input: body.input || {},
          output: null,
          status: "pending",
          error: "",
          updatedAt: now,
        }];
        grid.updatedAt = now;
        return send(res, 200, { contractVersion: "gcc-grid.v1", grid });
      }
      if (action === "pipeline" && req.method === "PUT") {
        const body = JSON.parse(rawBody || "{}");
        const pipelineDefinitionId = typeof body.pipelineDefinitionId === "string"
          && body.pipelineDefinitionId.trim()
          ? body.pipelineDefinitionId.trim()
          : null;
        if (pipelineDefinitionId) {
          const pipeline = pipelines.get(pipelineDefinitionId);
          if (!pipeline) return send(res, 404, { error: "Pipeline not found." });
          if (pipeline.status !== "published") {
            return send(res, 409, { error: "Only published pipelines can be attached to a grid." });
          }
        }
        grid.config = {
          ...grid.config,
          pipelineDefinitionId,
          lastPipelineRunId: pipelineDefinitionId ? grid.config.lastPipelineRunId || null : null,
        };
        grid.updatedAt = new Date().toISOString();
        return send(res, 200, { contractVersion: "gcc-grid.v1", grid });
      }
      if (action === "roi-projection" && req.method === "PUT") {
        const body = JSON.parse(rawBody || "{}");
        if (body.clear === true) {
          const { roiProjection: _removed, ...rest } = grid.config;
          grid.config = rest;
          grid.updatedAt = new Date().toISOString();
          return send(res, 200, { contractVersion: "gcc-grid.v1", grid });
        }
        const runId = typeof body.runId === "string" ? body.runId : null;
        const artifactVersionId = typeof body.artifactVersionId === "string" ? body.artifactVersionId : null;
        if (!runId || !artifactVersionId) {
          return send(res, 400, { error: "runId and artifactVersionId are required." });
        }
        const run = taskRuns.get(runId);
        if (!run) return send(res, 404, { error: "Task run not found." });
        if (run.status !== "succeeded") {
          return send(res, 409, { error: "Only succeeded task runs can pin an ROI projection on a grid." });
        }
        let artifactType = "roiProjection.v1";
        let expectedRoiPercent = null;
        let found = false;
        for (const artifact of run.artifacts || []) {
          for (const version of artifact.versions || []) {
            if (version.id !== artifactVersionId) continue;
            found = true;
            artifactType = artifact.artifactType || artifactType;
            try {
              const payload = typeof version.payloadJson === "string"
                ? JSON.parse(version.payloadJson)
                : version.payloadJson;
              const expected = (payload?.scenarios || []).find((item) => item.scenario === "expected");
              if (expected && Number.isFinite(expected.roiPercent)) expectedRoiPercent = expected.roiPercent;
            } catch {
              // ignore
            }
          }
        }
        if (!found) return send(res, 404, { error: "Artifact version was not found on the owned task run." });
        if (artifactType !== "roiProjection.v1") {
          return send(res, 400, { error: "Only roiProjection.v1 artifacts can be pinned to a grid." });
        }
        grid.config = {
          ...grid.config,
          roiProjection: {
            runId,
            artifactVersionId,
            artifactType,
            expectedRoiPercent,
            attachedAtUtc: new Date().toISOString(),
          },
        };
        grid.updatedAt = new Date().toISOString();
        return send(res, 200, {
          contractVersion: "gcc-grid.v1",
          grid,
          roiProjection: grid.config.roiProjection,
        });
      }
      if (action === "pipeline-runs" && req.method === "POST") {
        const body = JSON.parse(rawBody || "{}");
        const pipelineDefinitionId = (typeof body.pipelineDefinitionId === "string" && body.pipelineDefinitionId.trim())
          || grid.config.pipelineDefinitionId
          || null;
        if (!pipelineDefinitionId) {
          return send(res, 400, { error: "Attach a published pipeline before projecting rows." });
        }
        const pipeline = pipelines.get(pipelineDefinitionId);
        if (!pipeline) return send(res, 404, { error: "Pipeline not found." });
        if (pipeline.status !== "published") {
          return send(res, 409, { error: "Only published pipelines can be run." });
        }
        const mode = body.mode === "full" ? "full" : "sample";
        const sampleSize = Number.isFinite(body.sampleSize) && body.sampleSize > 0 ? body.sampleSize : 10;
        const selected = mode === "full" ? grid.rows : grid.rows.slice(0, sampleSize);
        if (selected.length === 0) {
          return send(res, 400, { error: "Grid has no rows to project into the pipeline." });
        }
        const run = executePipelineRun(
          pipeline,
          null,
          selected.map((row) => row.input || {}),
        );
        grid.config = {
          ...grid.config,
          pipelineDefinitionId,
          lastPipelineRunId: run.id,
        };
        grid.updatedAt = new Date().toISOString();
        return send(res, 200, {
          contractVersion: "gcc-grid.v1",
          grid,
          pipelineRunId: run.id,
          workItemCount: run.workItems.length,
          pipeline: { id: pipeline.id, name: pipeline.name, status: pipeline.status },
        });
      }
      if (action === "schedule" && req.method === "PUT") {
        const body = JSON.parse(rawBody || "{}");
        const cadence = ["daily", "weekly", "monthly"].includes(body.cadence) ? body.cadence : "none";
        const mode = body.mode === "full" ? "full" : "sample";
        const sampleSize = Number.isFinite(body.sampleSize) && body.sampleSize > 0 ? body.sampleSize : 10;
        const enabled = body.enabled === true && cadence !== "none";
        const previous = grid.config.schedule || {};
        const now = new Date().toISOString();
        let nextRunAt = null;
        if (enabled) {
          nextRunAt = previous.enabled && previous.nextRunAt && previous.cadence === cadence
            ? previous.nextRunAt
            : now;
        }
        grid.config = {
          ...grid.config,
          schedule: {
            cadence,
            enabled,
            mode,
            sampleSize,
            nextRunAt,
            lastRunAt: previous.lastRunAt || null,
          },
        };
        grid.updatedAt = now;
        return send(res, 200, { contractVersion: "gcc-grid.v1", grid });
      }
      if (action === "schedule/run-due" && req.method === "POST") {
        const body = JSON.parse(rawBody || "{}");
        const schedule = grid.config.schedule;
        if (!schedule?.enabled || schedule.cadence === "none") {
          return send(res, 400, { error: "Grid schedule is not enabled." });
        }
        const force = body.force === true;
        const dueAt = schedule.nextRunAt ? Date.parse(schedule.nextRunAt) : NaN;
        const due = Number.isFinite(dueAt) && dueAt <= Date.now();
        if (!force && !due) {
          return send(res, 200, {
            contractVersion: "gcc-grid.v1",
            ran: false,
            reason: "not-due",
            grid,
          });
        }
        const mode = schedule.mode === "full" ? "full" : "sample";
        const sampleSize = schedule.sampleSize || 10;
        let reason = force ? "forced" : "due";
        if (grid.config.pipelineDefinitionId) {
          const pipeline = pipelines.get(grid.config.pipelineDefinitionId);
          if (!pipeline) return send(res, 404, { error: "Pipeline not found." });
          const selected = mode === "full" ? grid.rows : grid.rows.slice(0, sampleSize);
          const run = executePipelineRun(
            pipeline,
            null,
            selected.map((row) => row.input || {}),
          );
          grid.config = {
            ...grid.config,
            lastPipelineRunId: run.id,
          };
          reason = force ? "forced-pipeline" : "due-pipeline";
        } else {
          executeGridRun(grid, mode, sampleSize, "schedule");
        }
        const completed = new Date();
        const next = new Date(completed.getTime());
        if (schedule.cadence === "daily") next.setUTCDate(next.getUTCDate() + 1);
        else if (schedule.cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
        else next.setUTCMonth(next.getUTCMonth() + 1);
        grid.config = {
          ...grid.config,
          schedule: {
            ...schedule,
            lastRunAt: completed.toISOString(),
            nextRunAt: next.toISOString(),
          },
        };
        return send(res, 200, {
          contractVersion: "gcc-grid.v1",
          ran: true,
          reason,
          grid,
        });
      }
    }
  }
  if (url.pathname === "/api/geek-content-creator-v2/studio/agents" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-studio-catalog.v1",
      agents: [...studioAgents.values()].map((item) => item.summary),
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/studio/agents" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const id = `studio-${crypto.randomBytes(6).toString("hex")}`;
    const draft = {
      summary: {
        id,
        definitionId: crypto.randomUUID(),
        displayName: body.name,
        description: body.outcome,
        versionId: crypto.randomUUID(),
        version: "0.1.0",
        state: "draft",
        digest: crypto.createHash("sha256").update(id).digest("hex"),
        visibility: body.visibility || "private",
        ownerUserId: "owner",
      },
      fields: [],
      instructionsTemplate: "You are a brand-safe marketing assistant.\nOutcome: {{outcome}}\nUse only attached approved context.",
      exampleOutput: "{\n  \"summary\": \"…\",\n  \"sections\": []\n}",
      allowedModel: "gpt-5.4",
      temperature: 0.2,
      evaluationPrompt: "Output must be valid JSON matching the example shape.",
      contextKnowledgeIds: [],
      testCases: [],
      minTestCases: 1,
      publishedVersion: null,
      audit: [],
    };
    pushStudioAudit(draft, "created", `Draft ${draft.summary.version} created.`);
    studioAgents.set(id, draft);
    return send(res, 201, studioDetail(draft));
  }
  {
    const match = url.pathname.match(/^\/api\/geek-content-creator-v2\/studio\/agents\/([^/]+)(?:\/(draft|dry-run|evaluate|publish|deprecate|revoke))?$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const action = match[2] || null;
      const draft = studioAgents.get(id);
      if (!draft) return send(res, 404, { error: "Studio agent not found." });
      if (!action && req.method === "GET") return send(res, 200, studioDetail(draft));
      if (action === "draft" && req.method === "PUT") {
        const body = JSON.parse(rawBody || "{}");
        draft.summary.displayName = body.name || draft.summary.displayName;
        draft.summary.description = body.outcome || draft.summary.description;
        draft.summary.visibility = body.visibility || draft.summary.visibility;
        draft.fields = body.fields || [];
        draft.instructionsTemplate = body.instructionsTemplate;
        draft.exampleOutput = body.exampleOutput;
        draft.allowedModel = body.allowedModel;
        draft.temperature = body.temperature;
        draft.evaluationPrompt = typeof body.evaluationPrompt === "string" ? body.evaluationPrompt : "";
        draft.contextKnowledgeIds = Array.isArray(body.contextKnowledgeIds)
          ? body.contextKnowledgeIds.filter((id) => typeof id === "string" && id.trim()).slice(0, 10)
          : [];
        draft.testCases = normalizeStudioTestCases(body.testCases);
        draft.minTestCases = Number.isFinite(body.minTestCases)
          ? Math.max(1, Math.min(20, Number(body.minTestCases)))
          : 1;
        const versionParts = draft.summary.version.split(".").map(Number);
        versionParts[1] += 1;
        draft.summary.version = versionParts.join(".");
        draft.summary.versionId = crypto.randomUUID();
        draft.summary.state = "draft";
        draft.summary.digest = crypto.createHash("sha256").update(`${id}:${draft.summary.version}`).digest("hex");
        return send(res, 200, studioDetail(draft));
      }
      if (action === "dry-run" && req.method === "POST") {
        const body = JSON.parse(rawBody || "{}");
        const input = body.input || {};
        const missing = draft.fields
          .filter((field) => field.required && !String(input[field.id] || "").trim())
          .map((field) => field.label);
        let rendered = draft.instructionsTemplate
          .replaceAll("{{outcome}}", draft.summary.description)
          .replaceAll("{{agent.name}}", draft.summary.displayName);
        for (const field of draft.fields) {
          rendered = rendered.replaceAll(`{{inputs.${field.id}}}`, input[field.id] || "");
        }
        const unresolved = [...rendered.matchAll(/\{\{[^}]+\}\}/g)].map((item) => item[0]);
        const missingEvaluation = !String(draft.evaluationPrompt || "").trim();
        const knowledgeCount = Array.isArray(draft.contextKnowledgeIds) ? draft.contextKnowledgeIds.length : 0;
        const valid = missing.length === 0
          && unresolved.length === 0
          && Boolean(draft.exampleOutput?.trim())
          && !missingEvaluation;
        return send(res, 200, {
          valid,
          renderedInstructions: rendered,
          missingTokens: unresolved,
          validationErrors: missing.map((label) => `$.${label} is required.`),
          evaluationPrompt: draft.evaluationPrompt || "",
          knowledgeAttachmentCount: knowledgeCount,
          message: valid
            ? knowledgeCount > 0
              ? `Dry-run passed. Evaluation criteria on file. ${knowledgeCount} knowledge attachment(s).`
              : "Dry-run passed. Evaluation criteria on file."
            : missing.length
              ? `Missing required fields: ${missing.join(", ")}.`
              : unresolved.length
                ? `Unresolved template tokens: ${unresolved.join(", ")}.`
                : missingEvaluation
                  ? "Evaluation prompt is required before the dry-run can pass."
                  : "Example output is required before the dry-run can pass.",
        });
      }
      if (action === "evaluate" && req.method === "POST") {
        const suite = evaluateStudioSuite(draft);
        return send(res, 200, {
          contractVersion: "gcc-studio-evaluate.v1",
          ...suite,
        });
      }
      if (action === "publish" && req.method === "POST") {
        const suite = evaluateStudioSuite(draft);
        if (!suite.valid) {
          return send(res, 409, {
            error: suite.message,
            minTestCases: suite.minTestCases,
            caseCount: suite.caseCount,
            passedCount: suite.passedCount,
            cases: suite.cases.map((item) => ({
              id: item.id,
              name: item.name,
              valid: item.valid,
              message: item.message,
            })),
          });
        }
        const publishedVersion = {
          versionId: draft.summary.versionId,
          version: draft.summary.version,
          digest: crypto.createHash("sha256").update(`${id}:published:${draft.summary.version}`).digest("hex"),
          state: "published",
        };
        pushStudioAudit(
          draft,
          "published",
          `Published ${publishedVersion.version}.`,
          publishedVersion,
        );
        draft.publishedVersion = publishedVersion;
        const versionParts = String(publishedVersion.version).split(".").map(Number);
        while (versionParts.length < 3) versionParts.push(0);
        versionParts[1] = (versionParts[1] || 0) + 1;
        versionParts[2] = 0;
        draft.summary.version = versionParts.join(".");
        draft.summary.versionId = crypto.randomUUID();
        draft.summary.state = "draft";
        draft.summary.digest = crypto.createHash("sha256").update(`${id}:${draft.summary.version}`).digest("hex");
        pushStudioAudit(draft, "created", `Draft ${draft.summary.version} created.`);
        return send(res, 200, {
          ...studioDetail(draft),
          message: `Published ${publishedVersion.version}. Successor draft ${draft.summary.version} is ready.`,
        });
      }
      if (action === "deprecate" && req.method === "POST") {
        if (!draft.publishedVersion || draft.publishedVersion.state !== "published") {
          return send(res, 409, { error: "No Studio version is eligible for deprecate." });
        }
        draft.publishedVersion = { ...draft.publishedVersion, state: "deprecated" };
        pushStudioAudit(
          draft,
          "deprecated",
          `Deprecated ${draft.publishedVersion.version}.`,
          draft.publishedVersion,
        );
        return send(res, 200, studioDetail(draft));
      }
      if (action === "revoke" && req.method === "POST") {
        if (!draft.publishedVersion || !["published", "deprecated"].includes(draft.publishedVersion.state)) {
          return send(res, 409, { error: "No Studio version is eligible for revoke." });
        }
        const revoked = { ...draft.publishedVersion, state: "revoked" };
        pushStudioAudit(draft, "revoked", `Revoked ${revoked.version}.`, revoked);
        draft.publishedVersion = revoked;
        return send(res, 200, studioDetail(draft));
      }
    }
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/library" && req.method === "GET") {
    const recentByCapability = new Map();
    for (const run of taskRuns.values()) {
      const capabilityId = typeof run.capabilityId === "string" ? run.capabilityId : "";
      if (!capabilityId) continue;
      const stamp = run.updatedAtUtc || run.createdAtUtc || new Date().toISOString();
      const prior = recentByCapability.get(capabilityId);
      if (!prior || String(stamp) > String(prior)) recentByCapability.set(capabilityId, stamp);
    }
    const recent = [...recentByCapability.entries()]
      .sort((a, b) => String(b[1]).localeCompare(String(a[1])))
      .slice(0, 12)
      .map(([capabilityId, lastRunAtUtc]) => ({ capabilityId, lastRunAtUtc }));
    return send(res, 200, {
      contractVersion: "gcc-task-agent-library.v1",
      favorites: libraryPrefs.favorites,
      recent,
      savedConfigs: libraryPrefs.savedConfigs,
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/library" && req.method === "PUT") {
    const body = JSON.parse(rawBody || "{}");
    const favorites = Array.isArray(body.favorites)
      ? body.favorites.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    const savedConfigs = Array.isArray(body.savedConfigs)
      ? body.savedConfigs.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const capabilityId = typeof entry.capabilityId === "string" ? entry.capabilityId.trim() : "";
        const name = typeof entry.name === "string" ? entry.name.trim() : "";
        const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : crypto.randomUUID();
        if (!capabilityId || !name) return [];
        const values = entry.values && typeof entry.values === "object" && !Array.isArray(entry.values)
          ? Object.fromEntries(
            Object.entries(entry.values).filter(([, value]) => typeof value === "string"),
          )
          : {};
        return [{
          id,
          capabilityId,
          name,
          values,
          updatedAtUtc: typeof entry.updatedAtUtc === "string"
            ? entry.updatedAtUtc
            : new Date().toISOString(),
        }];
      })
      : [];
    libraryPrefs = { favorites: [...new Set(favorites)], savedConfigs };
    const recentByCapability = new Map();
    for (const run of taskRuns.values()) {
      const capabilityId = typeof run.capabilityId === "string" ? run.capabilityId : "";
      if (!capabilityId) continue;
      const stamp = run.updatedAtUtc || run.createdAtUtc || new Date().toISOString();
      const prior = recentByCapability.get(capabilityId);
      if (!prior || String(stamp) > String(prior)) recentByCapability.set(capabilityId, stamp);
    }
    const recent = [...recentByCapability.entries()]
      .sort((a, b) => String(b[1]).localeCompare(String(a[1])))
      .slice(0, 12)
      .map(([capabilityId, lastRunAtUtc]) => ({ capabilityId, lastRunAtUtc }));
    return send(res, 200, {
      contractVersion: "gcc-task-agent-library.v1",
      favorites: libraryPrefs.favorites,
      recent,
      savedConfigs: libraryPrefs.savedConfigs,
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-catalog.v1",
      agents: [
        {
          id: "ai-readiness",
          definitionId: "task-agent-1",
          displayName: "AI Readiness Score",
          description: "Score a page across seven explicit AI-answer readiness dimensions.",
          versionId: "task-agent-version-1",
          version: "1.0.0",
          digest: "a".repeat(64),
          workflowGroup: "diagnostic",
          visibilityScope: "public",
          facets: { workflow: "optimize", marketingFunction: ["aeo", "seo"], contentType: ["page", "article"], funnelStage: ["awareness", "consideration"], process: ["audit", "score"] },
        },
        {
          id: "fact-density",
          definitionId: "task-agent-10",
          displayName: "Fact Density Audit",
          description: "Find specific claims, measure support density, and identify unsupported statements.",
          versionId: "task-agent-version-10",
          version: "1.0.0",
          digest: "n".repeat(64),
          workflowGroup: "diagnostic",
          facets: { workflow: "optimize", marketingFunction: ["aeo", "content"], contentType: ["page", "article"], funnelStage: ["awareness", "consideration"], process: ["audit"] },
        },
        {
          id: "entity-mapper",
          definitionId: "task-agent-11",
          displayName: "Entity Mapper",
          description: "Build an evidence-linked map of canonical entities and co-occurrence relationships.",
          versionId: "task-agent-version-11",
          version: "1.0.0",
          digest: "o".repeat(64),
          workflowGroup: "diagnostic",
          facets: { workflow: "optimize", marketingFunction: ["aeo", "seo"], contentType: ["page", "topic"], funnelStage: ["awareness"], process: ["audit", "map"] },
        },
        {
          id: "schema-markup",
          definitionId: "task-agent-12",
          displayName: "Schema Markup Generator",
          description: "Generate and validate JSON-LD from visible page content only.",
          versionId: "task-agent-version-12",
          version: "1.0.0",
          digest: "p".repeat(64),
          workflowGroup: "diagnostic",
          facets: { workflow: "optimize", marketingFunction: ["seo", "aeo"], contentType: ["page", "article", "faq"], funnelStage: ["awareness", "consideration"], process: ["markup", "publish-prep"] },
        },
        {
          id: "query-planner",
          definitionId: "task-agent-2",
          displayName: "Query Planner",
          description: "Prioritize observed, imported, and generated queries without treating hypotheses as demand.",
          versionId: "task-agent-version-2",
          version: "1.0.0",
          digest: "c".repeat(64),
          workflowGroup: "intelligence",
          facets: { workflow: "originate", marketingFunction: ["seo", "aeo", "content"], contentType: ["query", "brief"], funnelStage: ["awareness", "consideration"], process: ["plan"] },
        },
        {
          id: "ai-readiness-comparison",
          definitionId: "task-agent-5",
          displayName: "AI Readiness Comparison",
          description: "Compare one owned page with up to four competitor pages under one AEO/GEO rubric.",
          versionId: "task-agent-version-5",
          version: "1.0.0",
          digest: "g".repeat(64),
          workflowGroup: "intelligence",
          facets: { workflow: "optimize", marketingFunction: ["aeo", "competitive"], contentType: ["page", "comparison"], funnelStage: ["consideration"], process: ["compare", "audit"] },
        },
        {
          id: "content-gap",
          definitionId: "task-agent-4",
          displayName: "Content Gap Finder",
          description: "Find evidence-linked content gaps between subject and competitor pages.",
          versionId: "task-agent-version-4",
          version: "1.0.0",
          digest: "e".repeat(64),
          workflowGroup: "intelligence",
          facets: { workflow: "outrank", marketingFunction: ["aeo", "competitive", "content"], contentType: ["page", "gap-report"], funnelStage: ["consideration"], process: ["gap-find", "audit"] },
        },
        {
          id: "competitor-audit",
          definitionId: "task-agent-6",
          displayName: "Competitor Audit",
          description: "Explain competitor strengths from supplied pages with evidence-linked prioritized actions.",
          versionId: "task-agent-version-6",
          version: "1.0.0",
          digest: "h".repeat(64),
          workflowGroup: "intelligence",
          facets: { workflow: "outrank", marketingFunction: ["competitive", "aeo"], contentType: ["audit", "page"], funnelStage: ["consideration", "decision"], process: ["audit"] },
        },
        {
          id: "competitor-positioning",
          definitionId: "task-agent-7",
          displayName: "Competitor Positioning",
          description: "Map brand-versus-competitor narrative attributes without treating generated opinions as market perception.",
          versionId: "task-agent-version-7",
          version: "1.0.0",
          digest: "i".repeat(64),
          workflowGroup: "intelligence",
          facets: { workflow: "outrank", marketingFunction: ["competitive", "brand"], contentType: ["positioning", "narrative"], funnelStage: ["consideration", "decision"], process: ["position"] },
        },
        {
          id: "competitor-page",
          definitionId: "task-agent-3",
          displayName: "Competitor Page Analysis",
          description: "Analyze a competitor page from supplied visible content and evidence only.",
          versionId: "task-agent-version-3",
          version: "1.0.0",
          digest: "d".repeat(64),
          workflowGroup: "intelligence",
          facets: { workflow: "outrank", marketingFunction: ["competitive", "aeo"], contentType: ["page", "audit"], funnelStage: ["consideration"], process: ["audit"] },
        },
        {
          id: "faq-generator",
          definitionId: "task-agent-8",
          displayName: "FAQ Generator",
          description: "Generate answer-first FAQ pairs grounded in supplied queries and visible source content.",
          versionId: "task-agent-version-8",
          version: "1.0.0",
          digest: "j".repeat(64),
          workflowGroup: "originate",
          facets: { workflow: "originate", marketingFunction: ["content", "aeo", "seo"], contentType: ["faq"], funnelStage: ["awareness", "consideration"], process: ["originate"] },
        },
        {
          id: "citable-claims",
          definitionId: "task-agent-9",
          displayName: "Citable Claims",
          description: "Convert source material into precise attributable claims without inventing statistics.",
          versionId: "task-agent-version-9",
          version: "1.0.0",
          digest: "l".repeat(64),
          workflowGroup: "originate",
          facets: { workflow: "originate", marketingFunction: ["content", "aeo"], contentType: ["claims", "article"], funnelStage: ["awareness", "consideration"], process: ["originate", "optimize"] },
        },
        {
          id: "comparison-brief",
          definitionId: "task-agent-13",
          displayName: "Comparison Brief",
          description: "Structure subject-versus-competitor page signals into a brief with labeled hypotheses.",
          versionId: "task-agent-version-13",
          version: "1.0.0",
          digest: "q".repeat(64),
          workflowGroup: "originate",
          facets: { workflow: "originate", marketingFunction: ["competitive", "content"], contentType: ["brief", "comparison"], funnelStage: ["consideration", "decision"], process: ["originate", "brief"] },
        },
        {
          id: "pillar-outline",
          definitionId: "task-agent-14",
          displayName: "Pillar Article Outline",
          description: "Produce a topic-cluster pillar outline and supporting-content plan from supplied inputs.",
          versionId: "task-agent-version-14",
          version: "1.0.0",
          digest: "r".repeat(64),
          workflowGroup: "originate",
          facets: { workflow: "originate", marketingFunction: ["content", "seo", "aeo"], contentType: ["pillar", "outline"], funnelStage: ["awareness"], process: ["originate", "plan"] },
        },
        {
          id: "pillar-article",
          definitionId: "task-agent-16",
          displayName: "Pillar Article",
          description: "Produce a grounded topic-cluster pillar Markdown draft with supporting-content plan.",
          versionId: "task-agent-version-16",
          version: "1.1.0",
          digest: "q".repeat(64),
          workflowGroup: "originate",
          facets: { workflow: "originate", marketingFunction: ["content", "seo", "aeo"], contentType: ["pillar", "article"], funnelStage: ["awareness"], process: ["originate", "draft"] },
        },
        {
          id: "competitive-response",
          definitionId: "task-agent-15",
          displayName: "Competitive Response",
          description: "Choose a response mode and emit brand-aligned angles, proof points, and outline sections.",
          versionId: "task-agent-version-15",
          version: "1.0.0",
          digest: "s".repeat(64),
          workflowGroup: "outrank",
          facets: { workflow: "outrank", marketingFunction: ["competitive", "content"], contentType: ["response", "article"], funnelStage: ["consideration", "decision"], process: ["respond", "originate"] },
        },
        {
          id: "roi-business-calculator",
          definitionId: "task-agent-17",
          displayName: "AI-Based ROI Business Calculator",
          description: "Project directional ROI from editable assumptions and reconcile against observed workflow telemetry.",
          versionId: "task-agent-version-17",
          version: "1.0.0",
          digest: "t".repeat(64),
          workflowGroup: "business",
          visibilityScope: "public",
          facets: { workflow: "optimize", marketingFunction: ["ops", "content"], contentType: ["business-case"], funnelStage: ["decision"], process: ["measure", "forecast"] },
        },
      ],
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/ai-readiness" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "ai-readiness",
        displayName: "AI Readiness Score",
        description: "Score a page across seven explicit AI-answer readiness dimensions.",
        versionId: "task-agent-version-1",
        version: "1.0.0",
        digest: "a".repeat(64),
      },
      workflow: {
        endpoint: "readiness-score",
        artifactType: "readinessScore.v1",
        uiSchema: {
          fields: [
            { id: "sourceUrl", label: "Source URL", type: "shortText", required: false },
            { id: "visibleContent", label: "Visible page content", type: "longText", required: true },
            {
              id: "technicalCrawlable",
              label: "Page crawlable",
              type: "select",
              required: false,
              options: ["yes", "no"],
              placeholder: "yes",
            },
            { id: "technicalStatusCode", label: "HTTP status code", type: "shortText", required: false, placeholder: "200" },
            { id: "technicalLoadTimeMs", label: "Load time (ms)", type: "shortText", required: false, placeholder: "1800" },
            {
              id: "contentCompleteness",
              label: "Source completeness",
              type: "select",
              required: false,
              options: ["full", "partial"],
              placeholder: "full",
            },
          ],
        },
      },
      resultRenderer: { kind: "scorecard", artifactType: "readinessScore.v1" },
    });
  }
  const documentDiagnosticUi = {
    fields: [
      { id: "sourceUrl", label: "Source URL", type: "shortText", required: false },
      { id: "visibleContent", label: "Visible page content", type: "longText", required: true },
      {
        id: "contentCompleteness",
        label: "Source completeness",
        type: "select",
        required: false,
        options: ["full", "partial"],
        placeholder: "full",
      },
    ],
  };
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/fact-density" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "fact-density",
        displayName: "Fact Density Audit",
        description: "Find specific claims, measure support density, and identify unsupported statements.",
        versionId: "task-agent-version-10",
        version: "1.0.0",
        digest: "n".repeat(64),
      },
      workflow: {
        endpoint: "fact-density",
        artifactType: "factDensityReport.v1",
        uiSchema: documentDiagnosticUi,
      },
      resultRenderer: { kind: "claim-audit", artifactType: "factDensityReport.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/entity-mapper" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "entity-mapper",
        displayName: "Entity Mapper",
        description: "Build an evidence-linked map of canonical entities and co-occurrence relationships.",
        versionId: "task-agent-version-11",
        version: "1.0.0",
        digest: "o".repeat(64),
      },
      workflow: {
        endpoint: "entity-map",
        artifactType: "entityMap.v1",
        uiSchema: {
          fields: [
            { id: "sourceUrl", label: "Source URL", type: "shortText", required: false },
            { id: "visibleContent", label: "Visible page content", type: "longText", required: true },
            { id: "entitySeeds", label: "Entity seeds", type: "shortText", required: false, placeholder: "Comma-separated entity names" },
            { id: "competitorUrl", label: "Competitor page URL", type: "shortText", required: false },
            { id: "competitorContent", label: "Competitor page content", type: "longText", required: false },
            {
              id: "contentCompleteness",
              label: "Source completeness",
              type: "select",
              required: false,
              options: ["full", "partial"],
              placeholder: "full",
            },
          ],
        },
      },
      resultRenderer: { kind: "entity-graph", artifactType: "entityMap.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/schema-markup" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "schema-markup",
        displayName: "Schema Markup Generator",
        description: "Generate and validate JSON-LD from visible page content only.",
        versionId: "task-agent-version-12",
        version: "1.0.0",
        digest: "p".repeat(64),
      },
      workflow: {
        endpoint: "schema-markup",
        artifactType: "schemaMarkup.v1",
        uiSchema: documentDiagnosticUi,
      },
      resultRenderer: { kind: "json-ld", artifactType: "schemaMarkup.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/query-planner" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "query-planner",
        displayName: "Query Planner",
        description: "Prioritize observed, imported, and generated queries without treating hypotheses as demand.",
        versionId: "task-agent-version-2",
        version: "1.0.0",
        digest: "c".repeat(64),
      },
      workflow: {
        endpoint: "query-plan",
        artifactType: "queryPlan.v1",
        uiSchema: {
          fields: [
            { id: "gscConnectionId", label: "GSC connection ID", type: "shortText", required: false },
            { id: "observedQueries", label: "Observed GSC queries", type: "longText", required: false },
            { id: "hypothesisTopics", label: "Hypothesis topics", type: "longText", required: false },
            { id: "importedQueries", label: "Imported queries", type: "longText", required: false },
          ],
        },
      },
      resultRenderer: { kind: "query-plan", artifactType: "queryPlan.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/gsc/oauth/connect-url" && req.method === "GET") {
    return send(res, 503, {
      error: "GSC Google OAuth is not configured in the fake platform.",
      mode: "stub",
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/gsc/connections" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-gsc-connections.v1",
      connections: [...gscConnections.values()],
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/gsc/connections" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const siteUrl = typeof body.siteUrl === "string" && body.siteUrl.trim()
      ? body.siteUrl.trim()
      : "sc-domain:example.test";
    const connection = {
      id: "11111111-1111-4111-8111-111111111111",
      siteUrl,
      status: "stub",
      connectedAtUtc: "2026-09-09T12:00:00.000Z",
    };
    gscConnections.set(connection.id, connection);
    return send(res, 200, { contractVersion: "gcc-gsc-connections.v1", connection });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/fetch-page" && req.method === "POST") {
    const body = JSON.parse(rawBody || "{}");
    const urlValue = typeof body.url === "string" ? body.url.trim() : "";
    if (!urlValue) {
      return send(res, 400, {
        contractVersion: "gcc-task-agent-page-hydrate.v1",
        error: "URL is required.",
        errorCode: "ssrf",
      });
    }
    if (/localhost|127\.0\.0\.1|169\.254\.|10\.|192\.168\.|metadata/i.test(urlValue)) {
      return send(res, 400, {
        contractVersion: "gcc-task-agent-page-hydrate.v1",
        error: "Host is not allowed.",
        errorCode: "ssrf",
      });
    }
    return send(res, 200, {
      contractVersion: "gcc-task-agent-page-hydrate.v1",
      finalUrl: urlValue,
      title: "Fetched readiness page",
      visibleContent:
        "# Fetched readiness page\n\n"
        + "This content was hydrated from the Source URL without pasting. "
        + "It includes concrete evidence for AI readiness scoring and schema coverage checks.\n\n"
        + "## Checklist\n\n"
        + "Operators verify crawlability, factual density, and answer clarity on public pages.",
      statusCode: 200,
      loadTimeMs: 42,
      contentCompleteness: "full",
      crawlable: "yes",
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/query-planner/observed-queries" && req.method === "GET") {
    const connectionId = url.searchParams.get("connectionId") || "11111111-1111-4111-8111-111111111111";
    const connection = gscConnections.get(connectionId) || {
      id: connectionId,
      siteUrl: "sc-domain:example.test",
      status: "stub",
    };
    const sourceId = `gsc:${connectionId}:2026-06-01:2026-09-01`;
    return send(res, 200, {
      contractVersion: "gcc-query-planner-observed.v1",
      connectionId,
      siteUrl: connection.siteUrl,
      startDate: "2026-06-01",
      endDate: "2026-09-01",
      fetchedAtUtc: "2026-09-09T12:00:00.000Z",
      source: {
        sourceId,
        kind: "google-search-console",
        label: connection.siteUrl,
        siteUrl: connection.siteUrl,
        connectionId,
      },
      demandDisclaimer: "Observed GSC queries are first-party search analytics, not traffic, volume, ranking, or demand scores for planning heuristics.",
      queries: [
        {
          query: "AI content readiness checklist",
          origin: "observed",
          sourceId,
          observedAtUtc: "2026-09-09T12:00:00.000Z",
        },
        {
          query: "how to measure AI readiness",
          origin: "observed",
          sourceId,
          observedAtUtc: "2026-09-09T12:00:00.000Z",
        },
      ],
      queryCount: 2,
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/faq-generator" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "faq-generator",
        displayName: "FAQ Generator",
        description: "Generate answer-first FAQ pairs grounded in supplied queries and visible source content.",
        versionId: "task-agent-version-8",
        version: "1.0.0",
        digest: "j".repeat(64),
      },
      workflow: {
        endpoint: "faq-set",
        artifactType: "faqSet.v1",
        uiSchema: {
          fields: [
            { id: "topic", label: "Topic", type: "shortText", required: true },
            { id: "faqQuestions", label: "FAQ questions", type: "longText", required: false },
            { id: "sourceContent", label: "Source content", type: "longText", required: false },
          ],
        },
      },
      resultRenderer: { kind: "faq-list", artifactType: "faqSet.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/citable-claims" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "citable-claims",
        displayName: "Citable Claims",
        description: "Convert source material into precise attributable claims without inventing statistics.",
        versionId: "task-agent-version-9",
        version: "1.1.0",
        digest: "l".repeat(64),
      },
      workflow: {
        endpoint: "citable-claims",
        artifactType: "claimLedger.v1",
        uiSchema: {
          fields: [
            { id: "sourceContent", label: "Source content", type: "longText", required: true },
            { id: "vagueStatements", label: "Vague statements to rewrite", type: "longText", required: false },
            {
              id: "contentCompleteness",
              label: "Source completeness",
              type: "select",
              required: false,
              options: ["full", "partial"],
              placeholder: "full",
            },
          ],
        },
      },
      resultRenderer: { kind: "claim-ledger", artifactType: "claimLedger.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/ai-readiness-comparison" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "ai-readiness-comparison",
        displayName: "AI Readiness Comparison",
        description: "Compare one owned page with up to four competitor pages under one AEO/GEO rubric.",
        versionId: "task-agent-version-5",
        version: "1.1.0",
        digest: "g".repeat(64),
      },
      workflow: {
        endpoint: "readiness-comparison",
        artifactType: "readinessComparison.v1",
        uiSchema: {
          fields: [
            { id: "sourceUrl", label: "Subject URL", type: "shortText", required: false },
            { id: "subjectContent", label: "Subject page content", type: "longText", required: true },
            { id: "competitorName", label: "Competitor 1 name", type: "shortText", required: false },
            { id: "competitorContent", label: "Competitor 1 page content", type: "longText", required: true },
            { id: "competitor2Name", label: "Competitor 2 name", type: "shortText", required: false },
            { id: "competitor2Content", label: "Competitor 2 page content", type: "longText", required: false },
            { id: "competitor3Name", label: "Competitor 3 name", type: "shortText", required: false },
            { id: "competitor3Content", label: "Competitor 3 page content", type: "longText", required: false },
            { id: "competitor4Name", label: "Competitor 4 name", type: "shortText", required: false },
            { id: "competitor4Content", label: "Competitor 4 page content", type: "longText", required: false },
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
          ],
        },
      },
      resultRenderer: { kind: "score-matrix", artifactType: "readinessComparison.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/content-gap" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "content-gap",
        displayName: "Content Gap Finder",
        description: "Find evidence-linked content gaps between subject and competitor pages.",
        versionId: "task-agent-version-4",
        version: "1.1.0",
        digest: "e".repeat(64),
      },
      workflow: {
        endpoint: "content-gap",
        artifactType: "contentGapAnalysis.v1",
        uiSchema: {
          fields: [
            { id: "sourceUrl", label: "Subject URL", type: "shortText", required: false },
            { id: "subjectContent", label: "Subject page content", type: "longText", required: true },
            { id: "competitorName", label: "Competitor 1 name", type: "shortText", required: false },
            { id: "competitorContent", label: "Competitor 1 page content", type: "longText", required: true },
            { id: "competitor2Name", label: "Competitor 2 name", type: "shortText", required: false },
            { id: "competitor2Content", label: "Competitor 2 page content", type: "longText", required: false },
            { id: "competitor3Name", label: "Competitor 3 name", type: "shortText", required: false },
            { id: "competitor3Content", label: "Competitor 3 page content", type: "longText", required: false },
            { id: "competitor4Name", label: "Competitor 4 name", type: "shortText", required: false },
            { id: "competitor4Content", label: "Competitor 4 page content", type: "longText", required: false },
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
          ],
        },
      },
      resultRenderer: { kind: "gap-report", artifactType: "contentGapAnalysis.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/competitor-audit" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "competitor-audit",
        displayName: "Competitor Audit",
        description: "Explain competitor strengths from supplied pages with evidence-linked prioritized actions.",
        versionId: "task-agent-version-6",
        version: "1.1.0",
        digest: "h".repeat(64),
      },
      workflow: {
        endpoint: "competitor-audit",
        artifactType: "competitorAudit.v1",
        uiSchema: {
          fields: [
            { id: "sourceUrl", label: "Subject URL", type: "shortText", required: false },
            { id: "subjectContent", label: "Subject page content", type: "longText", required: true },
            { id: "competitorName", label: "Competitor 1 name", type: "shortText", required: false },
            { id: "competitorContent", label: "Competitor 1 page content", type: "longText", required: true },
            { id: "competitor2Name", label: "Competitor 2 name", type: "shortText", required: false },
            { id: "competitor2Content", label: "Competitor 2 page content", type: "longText", required: false },
            { id: "competitor3Name", label: "Competitor 3 name", type: "shortText", required: false },
            { id: "competitor3Content", label: "Competitor 3 page content", type: "longText", required: false },
            { id: "competitor4Name", label: "Competitor 4 name", type: "shortText", required: false },
            { id: "competitor4Content", label: "Competitor 4 page content", type: "longText", required: false },
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
          ],
        },
      },
      resultRenderer: { kind: "audit-report", artifactType: "competitorAudit.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/competitor-positioning" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "competitor-positioning",
        displayName: "Competitor Positioning",
        description: "Map brand-versus-competitor narrative attributes without treating generated opinions as market perception.",
        versionId: "task-agent-version-7",
        version: "1.1.0",
        digest: "i".repeat(64),
      },
      workflow: {
        endpoint: "competitor-positioning",
        artifactType: "competitorPositioning.v1",
        uiSchema: {
          fields: [
            { id: "sourceUrl", label: "Brand URL", type: "shortText", required: false },
            { id: "subjectContent", label: "Brand page content", type: "longText", required: true },
            { id: "competitorName", label: "Competitor 1 name", type: "shortText", required: false },
            { id: "competitorContent", label: "Competitor 1 page content", type: "longText", required: true },
            { id: "competitor2Name", label: "Competitor 2 name", type: "shortText", required: false },
            { id: "competitor2Content", label: "Competitor 2 page content", type: "longText", required: false },
            { id: "competitor3Name", label: "Competitor 3 name", type: "shortText", required: false },
            { id: "competitor3Content", label: "Competitor 3 page content", type: "longText", required: false },
            { id: "competitor4Name", label: "Competitor 4 name", type: "shortText", required: false },
            { id: "competitor4Content", label: "Competitor 4 page content", type: "longText", required: false },
            { id: "aiObservationModel", label: "AI answer model / engine", type: "shortText", required: false },
            { id: "aiObservationQuery", label: "AI answer query", type: "shortText", required: false },
            { id: "aiObservationRawResponse", label: "AI answer raw response", type: "longText", required: false },
            { id: "aiObservationObservedAtUtc", label: "AI answer observed at (UTC)", type: "shortText", required: false },
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
          ],
        },
      },
      resultRenderer: { kind: "positioning-map", artifactType: "competitorPositioning.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/competitor-page" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "competitor-page",
        displayName: "Competitor Page Analysis",
        description: "Analyze a competitor page from supplied visible content and evidence only.",
        versionId: "task-agent-version-3",
        version: "1.0.0",
        digest: "d".repeat(64),
      },
      workflow: { endpoint: "competitor-page", artifactType: "competitorPageAnalysis.v1" },
      resultRenderer: { kind: "competitor-report", artifactType: "competitorPageAnalysis.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/comparison-brief" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "comparison-brief",
        displayName: "Comparison Brief",
        description: "Structure subject-versus-competitor page signals into a brief with labeled hypotheses.",
        versionId: "task-agent-version-13",
        version: "1.1.0",
        digest: "q".repeat(64),
      },
      workflow: {
        endpoint: "comparison-brief",
        artifactType: "comparisonBrief.v1",
        uiSchema: {
          fields: [
            { id: "subjectName", label: "Subject name", type: "shortText", required: true },
            { id: "subjectContent", label: "Subject page content", type: "longText", required: true },
            { id: "competitorName", label: "Competitor 1 name", type: "shortText", required: false },
            { id: "competitorContent", label: "Competitor 1 page content", type: "longText", required: true },
            { id: "competitor2Name", label: "Competitor 2 name", type: "shortText", required: false },
            { id: "competitor2Content", label: "Competitor 2 page content", type: "longText", required: false },
            { id: "competitor3Name", label: "Competitor 3 name", type: "shortText", required: false },
            { id: "competitor3Content", label: "Competitor 3 page content", type: "longText", required: false },
            { id: "competitor4Name", label: "Competitor 4 name", type: "shortText", required: false },
            { id: "competitor4Content", label: "Competitor 4 page content", type: "longText", required: false },
            { id: "sourceUrl", label: "Subject URL", type: "shortText", required: false },
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
          ],
        },
      },
      resultRenderer: { kind: "comparison-brief", artifactType: "comparisonBrief.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/pillar-outline" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "pillar-outline",
        displayName: "Pillar Article Outline",
        description: "Produce a topic-cluster pillar outline and supporting-content plan from supplied inputs.",
        versionId: "task-agent-version-14",
        version: "1.0.0",
        digest: "r".repeat(64),
      },
      workflow: {
        endpoint: "pillar-outline",
        artifactType: "pillarOutline.v1",
        uiSchema: {
          fields: [
            { id: "topic", label: "Topic", type: "shortText", required: true },
            { id: "relatedQueries", label: "Related queries", type: "longText", required: false },
            { id: "supportingContentHints", label: "Supporting content hints", type: "longText", required: false },
            { id: "sourceContent", label: "Source content", type: "longText", required: false },
            { id: "sourceUrl", label: "Source URL", type: "shortText", required: false },
          ],
        },
      },
      resultRenderer: { kind: "outline", artifactType: "pillarOutline.v1" },
    });
  }
  
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/pillar-article" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "pillar-article",
        displayName: "Pillar Article",
        description: "Produce a grounded topic-cluster pillar Markdown draft with supporting-content plan.",
        versionId: "task-agent-version-16",
        version: "1.1.0",
        digest: "q".repeat(64),
      },
      workflow: {
        endpoint: "pillar-article",
        artifactType: "pillarArticle.v1",
        uiSchema: {
          fields: [
            { id: "topic", label: "Topic", type: "shortText", required: true },
            { id: "relatedQueries", label: "Related queries", type: "longText", required: false },
            { id: "supportingContentHints", label: "Supporting content hints", type: "longText", required: false },
            { id: "sourceContent", label: "Source content", type: "longText", required: true },
            { id: "sourceUrl", label: "Source URL", type: "shortText", required: false },
          ],
        },
      },
      resultRenderer: { kind: "pillar-article", artifactType: "pillarArticle.v1" },
    });
  }
if (url.pathname === "/api/geek-content-creator-v2/task-agents/competitive-response" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "competitive-response",
        displayName: "Competitive Response",
        description: "Choose a response mode and emit brand-aligned angles, proof points, and outline sections.",
        versionId: "task-agent-version-15",
        version: "1.1.0",
        digest: "s".repeat(64),
      },
      workflow: {
        endpoint: "competitive-response",
        artifactType: "competitiveResponse.v1",
        uiSchema: {
          fields: [
            { id: "brandName", label: "Brand name", type: "shortText", required: true },
            { id: "brandContent", label: "Brand page content", type: "longText", required: true },
            { id: "competitorName", label: "Competitor 1 name", type: "shortText", required: false },
            { id: "competitorContent", label: "Competitor 1 page content", type: "longText", required: true },
            { id: "competitor2Name", label: "Competitor 2 name", type: "shortText", required: false },
            { id: "competitor2Content", label: "Competitor 2 page content", type: "longText", required: false },
            { id: "competitor3Name", label: "Competitor 3 name", type: "shortText", required: false },
            { id: "competitor3Content", label: "Competitor 3 page content", type: "longText", required: false },
            { id: "competitor4Name", label: "Competitor 4 name", type: "shortText", required: false },
            { id: "competitor4Content", label: "Competitor 4 page content", type: "longText", required: false },
            { id: "focusQuery", label: "Focus query", type: "shortText", required: false },
            { id: "sourceUrl", label: "Brand URL", type: "shortText", required: false },
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
          ],
        },
      },
      resultRenderer: { kind: "response-plan", artifactType: "competitiveResponse.v1" },
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/roi-business-calculator" && req.method === "GET") {
    return send(res, 200, {
      contractVersion: "gcc-task-agent-detail.v1",
      agent: {
        id: "roi-business-calculator",
        displayName: "AI-Based ROI Business Calculator",
        description: "Project directional ROI from editable assumptions and reconcile against observed workflow telemetry.",
        versionId: "task-agent-version-17",
        version: "1.0.0",
        digest: "t".repeat(64),
      },
      workflow: {
        engine: "roi-projection",
        artifactType: "roiProjection.v1",
        formulaVersion: "gcc-roi-formulas.v1",
        uiSchema: {
          fields: [
            { id: "lookbackDays", label: "Telemetry lookback (days)", type: "select", required: false, options: ["30", "90", "180", "365"], placeholder: "90" },
            { id: "workflowVolume", label: "Annual workflow volume", type: "shortText", required: true, placeholder: "120" },
            { id: "baselineMinutes", label: "Baseline minutes per item", type: "shortText", required: true, placeholder: "90" },
            { id: "assistedMinutes", label: "Assisted minutes per item", type: "shortText", required: true, placeholder: "25" },
            { id: "adoptionRate", label: "Adoption rate (0-1)", type: "shortText", required: true, placeholder: "0.7" },
            { id: "successfulUseRate", label: "Successful use rate (0-1)", type: "shortText", required: true, placeholder: "0.85" },
            { id: "loadedHourlyCost", label: "Loaded hourly cost (USD)", type: "shortText", required: true, placeholder: "85" },
            { id: "redeploymentFactor", label: "Redeployment factor (0-1)", type: "shortText", required: true, placeholder: "0.6" },
            { id: "externalSpend", label: "Annual external / agency spend (USD)", type: "shortText", required: true, placeholder: "48000" },
            { id: "replaceableShare", label: "Replaceable share of external spend (0-1)", type: "shortText", required: true, placeholder: "0.35" },
            { id: "totalCostOfOwnership", label: "Total cost of ownership (USD)", type: "shortText", required: true, placeholder: "36000" },
            { id: "attributableGrossMargin", label: "Attributable gross margin (0-1)", type: "shortText", required: false, placeholder: "0.55" },
          ],
        },
      },
      resultRenderer: { kind: "roi-projection", artifactType: "roiProjection.v1" },
    });
  }
  function productVersionById(versionId) {
    for (const product of contextCatalogs.products || []) {
      const version = (product.versions || []).find((entry) => entry.id === versionId);
      if (version) return { product, version };
    }
    return null;
  }

  function productClaimFindings(selection) {
    const findings = [];
    for (const selected of selection.productSelections || []) {
      const versionId = selected.productVersionId;
      const match = productVersionById(versionId);
      if (!match) {
        findings.push({
          id: `product-missing-${versionId}`,
          severity: "blocking",
          code: `product:${versionId}:not_owned_or_missing`,
          message: `product:${versionId}:not_owned_or_missing`,
        });
        continue;
      }
      const approved = Array.isArray(match.version.approvedClaimsJson)
        ? match.version.approvedClaimsJson.filter((value) => typeof value === "string" && value.trim())
        : [];
      const mandatory = Array.isArray(match.version.mandatoryDisclaimersJson)
        ? match.version.mandatoryDisclaimersJson.filter((value) => typeof value === "string" && value.trim())
        : [];
      const prohibited = Array.isArray(match.version.prohibitedClaimsJson)
        ? match.version.prohibitedClaimsJson.filter((value) => typeof value === "string" && value.trim())
        : [];
      if (!approved.length) {
        findings.push({
          id: `product-claims-${versionId}`,
          severity: "blocking",
          code: `product:${versionId}:approved_claims_required`,
          message: `product:${versionId}:approved_claims_required`,
        });
      }
      if (!mandatory.length) {
        findings.push({
          id: `product-disclaimers-${versionId}`,
          severity: "blocking",
          code: `product:${versionId}:mandatory_disclaimers_required`,
          message: `product:${versionId}:mandatory_disclaimers_required`,
        });
      }
      const approvedFolded = new Set(approved.map((value) => value.trim().toLowerCase()));
      if (approved.length && prohibited.some((value) => approvedFolded.has(value.trim().toLowerCase()))) {
        findings.push({
          id: `product-conflict-${versionId}`,
          severity: "blocking",
          code: `product:${versionId}:claim_policy_conflict`,
          message: `product:${versionId}:claim_policy_conflict`,
        });
      }
    }
    return findings;
  }

  function productEntries(selection) {
    return (selection.productSelections || []).flatMap((selected) => {
      const match = productVersionById(selected.productVersionId);
      if (!match) return [];
      return [{
        kind: "product",
        stableId: match.product.id,
        versionId: match.version.id,
        name: match.product.name,
        versionNumber: match.version.versionNumber,
        lifecycle: match.version.lifecycle,
        digest: match.version.digest,
        freshness: match.version.freshness || "fresh",
        temporary: false,
      }];
    });
  }

  function createTaskRun(capabilityId, runId, body) {
    const selection = body?.contextSelection;
    const hasPins = selection && (
      (selection.knowledgeAssetVersionIds || []).length > 0
      || selection.audienceVersionId
      || selection.styleGuideVersionId
      || selection.visualGuidelineVersionId
      || (selection.productSelections || []).length > 0
      || selection.brandKitVersionId
    );
    if (hasPins && scenario.contextCondition === "revoked") {
      return {
        conflict: true,
        payload: {
          error: "Governed context is not eligible for this task-agent run.",
          blockingFindings: ["Editorial Handbook version is revoked."],
        },
      };
    }
    if (hasPins && (selection.runAttachmentIds || []).length > 0) {
      return {
        conflict: true,
        payload: {
          error: "Governed context is not eligible for this task-agent run.",
          blockingFindings: ["run_attachment:task_agent:not_supported"],
        },
      };
    }
    const productBlocks = hasPins ? productClaimFindings(selection) : [];
    if (productBlocks.length > 0) {
      return {
        conflict: true,
        payload: {
          error: "Governed context is not eligible for this task-agent run.",
          blockingFindings: productBlocks.map((finding) => finding.message),
        },
      };
    }
    const sharedContext = hasPins
      ? { contextManifestId: "task-manifest-1", contextManifestDigest: "c".repeat(64) }
      : { contextManifestId: null, contextManifestDigest: null };
    const hold = scenario.taskRunHold === true;
    const parentArtifactVersionIds = Array.isArray(body?.parentArtifactVersionIds)
      ? body.parentArtifactVersionIds.filter((id) => typeof id === "string")
      : [];
    const lineageRelationship = typeof body?.lineageRelationship === "string"
      ? body.lineageRelationship
      : (body?.retryOfRunId ? "retry-of" : (parentArtifactVersionIds.length ? "derived-from" : null));
    const run = {
      id: runId,
      status: hold ? "running" : "queued",
      phase: hold ? "executing" : "queued",
      progressPercent: hold ? 40 : 0,
      capabilityId,
      sharedContext,
      parentArtifactVersionIds,
      lineageRelationship,
      input: body?.input ?? null,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    };
    taskRuns.set(runId, run);
    return { conflict: false, payload: run };
  }

  function taskResultShell(runId, existing, base) {
    const parents = (existing?.parentArtifactVersionIds || []).map((parentArtifactVersionId) => ({
      parentArtifactVersionId,
      relationship: existing?.lineageRelationship || "derived-from",
      createdAtUtc: "2026-09-09T12:00:00Z",
    }));
    const artifactVersionId = base.artifacts[0].versions[0].id;
    return {
      ...base,
      taskInputs: existing?.input ?? base.taskInputs ?? null,
      sharedContext: existing?.sharedContext
        ?? { contextManifestId: null, contextManifestDigest: null },
      lineage: [{
        artifactVersionId,
        versionNumber: 1,
        digest: base.artifacts[0].versions[0].digest,
        parents,
        children: [],
      }],
      nextActions: base.nextActions || [],
      rerun: {
        ...base.rerun,
        parentArtifactVersionIds: [artifactVersionId],
      },
      snapshot: {
        taskAgentVersionDigest: "d".repeat(64),
        inputDigest: "e".repeat(64),
        sourceSnapshotDigest: "f".repeat(64),
        rootRunId: runId,
        retryOfRunId: existing?.lineageRelationship === "retry-of" ? "task-run-prior" : null,
      },
    };
  }

  if (url.pathname === "/api/geek-content-creator-v2/task-agents/ai-readiness/runs" && req.method === "POST") {
    const created = createTaskRun("ai-readiness", "task-run-1", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/fact-density/runs" && req.method === "POST") {
    const created = createTaskRun("fact-density", "task-run-10", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/entity-mapper/runs" && req.method === "POST") {
    const created = createTaskRun("entity-mapper", "task-run-11", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/schema-markup/runs" && req.method === "POST") {
    const created = createTaskRun("schema-markup", "task-run-12", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/query-planner/runs" && req.method === "POST") {
    const created = createTaskRun("query-planner", "task-run-2", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/faq-generator/runs" && req.method === "POST") {
    const created = createTaskRun("faq-generator", "task-run-3", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/citable-claims/runs" && req.method === "POST") {
    const created = createTaskRun("citable-claims", "task-run-4", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/ai-readiness-comparison/runs" && req.method === "POST") {
    const created = createTaskRun("ai-readiness-comparison", "task-run-5", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/content-gap/runs" && req.method === "POST") {
    const created = createTaskRun("content-gap", "task-run-6", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/competitor-audit/runs" && req.method === "POST") {
    const created = createTaskRun("competitor-audit", "task-run-7", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/competitor-positioning/runs" && req.method === "POST") {
    const created = createTaskRun("competitor-positioning", "task-run-8", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/competitor-page/runs" && req.method === "POST") {
    const created = createTaskRun("competitor-page", "task-run-9", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/comparison-brief/runs" && req.method === "POST") {
    const created = createTaskRun("comparison-brief", "task-run-13", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/pillar-outline/runs" && req.method === "POST") {
    const created = createTaskRun("pillar-outline", "task-run-14", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/pillar-article/runs" && req.method === "POST") {
    const created = createTaskRun("pillar-article", "task-run-16", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/competitive-response/runs" && req.method === "POST") {
    const created = createTaskRun("competitive-response", "task-run-15", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  if (url.pathname === "/api/geek-content-creator-v2/task-agents/roi-business-calculator/runs" && req.method === "POST") {
    const created = createTaskRun("roi-business-calculator", "task-run-17", JSON.parse(rawBody || "{}"));
    return send(res, created.conflict ? 409 : 202, created.payload);
  }
  const taskRunMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/task-agents\/runs\/([^/]+)(?:\/(result|cancel))?$/);
  if (taskRunMatch) {
    const runId = taskRunMatch[1];
    const action = taskRunMatch[2] || null;
    const existing = taskRuns.get(runId);
    if (action === "cancel" && req.method === "POST") {
      if (!existing) return send(res, 404, { error: "Task run not found." });
      if (["succeeded", "failed", "cancelled"].includes(existing.status)) {
        return send(res, 409, { error: "Task run is already terminal." });
      }
      const cancelled = {
        ...existing,
        status: "cancelled",
        phase: "cancelled",
        progressPercent: 100,
      };
      taskRuns.set(runId, cancelled);
      return send(res, 200, cancelled);
    }
    if (action === "result" && req.method === "GET") {
      if (runId === "task-run-1") {
        const completeness = existing?.input?.document?.contentCompleteness;
        const isPartial = completeness === "partial";
        const technical = existing?.input?.document?.technical;
        const hasTechnical = technical
          && technical.crawlable != null
          && technical.statusCode != null
          && technical.loadTimeMs != null;
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "ai-readiness", displayName: "AI Readiness Score", objective: "Score visible content." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-1",
            artifactType: "readinessScore.v1",
            versions: [{
              id: "artifact-version-1",
              payloadJson: JSON.stringify(isPartial
                ? {
                  artifactType: "readinessScore.v1",
                  overallScore: null,
                  dimensions: [
                    {
                      dimension: "headingHierarchy",
                      score: null,
                      explanation: "Partial input does not establish whether headings are absent.",
                    },
                  ],
                  prioritizedFixes: [],
                  warnings: [
                    "Input is marked partial; absence-based findings are omitted where completeness is required.",
                  ],
                }
                : {
                  artifactType: "readinessScore.v1",
                  overallScore: hasTechnical ? 84 : 82,
                  dimensions: [
                    ...(hasTechnical
                      ? [{
                        dimension: "technicalCrawlabilityPerformance",
                        score: 100,
                        explanation: `crawlable=${technical.crawlable}, status=${technical.statusCode}, loadTimeMs=${technical.loadTimeMs}.`,
                      }]
                      : [{
                        dimension: "technicalCrawlabilityPerformance",
                        score: null,
                        explanation: "crawlable, statusCode, and loadTimeMs are all required for this dimension.",
                      }]),
                  ],
                  prioritizedFixes: [],
                  warnings: [
                    ...(scenario.evidenceCondition === "stale"
                      ? ["Supplied evidence is stale relative to visible content."]
                      : []),
                    "Scores and classifications are deterministic heuristics, not measured search-engine or AI-citation outcomes.",
                  ],
                }),
              evidenceJson: scenario.evidenceCondition === "stale"
                ? JSON.stringify([{
                  evidenceId: "ev-stale",
                  sourceId: "page-1",
                  quote: "Outdated crawl excerpt",
                  freshness: "stale",
                }])
                : "[]",
              citationsJson: "[]",
              digest: "b".repeat(64),
              validationState: "valid",
              parents: (existing?.parentArtifactVersionIds || []).map((parentArtifactVersionId) => ({
                parentArtifactVersionId,
                relationship: existing?.lineageRelationship || "derived-from",
              })),
            }],
          }],
          nextActions: [
            { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
            { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
            { capabilityId: "citable-claims", label: "Citable Claims", artifactType: "claimLedger.v1" },
          ],
          rerun: { capabilityId: "ai-readiness", versionId: "task-agent-version-1", retryOfRunId: "task-run-1" },
          changeOverTime: isPartial
            ? { available: false, message: "No prior succeeded run for this subject." }
            : {
              available: true,
              priorRunId: "task-run-prior-readiness",
              priorCompletedAtUtc: "2026-09-10T12:00:00Z",
              subjectKey: "body:demo",
              currentOverall: hasTechnical ? 84 : 82,
              priorOverall: 78,
              overallDelta: hasTechnical ? 6 : 4,
              dimensions: [
                {
                  dimension: "technicalCrawlabilityPerformance",
                  current: hasTechnical ? 100 : null,
                  prior: 70,
                  delta: hasTechnical ? 30 : null,
                },
              ],
              message: hasTechnical
                ? "Overall score up +6 since last run."
                : "Overall score up +4 since last run.",
            },
        }));
      }
      if (runId === "task-run-10") {
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "fact-density", displayName: "Fact Density Audit", objective: "Measure claim support density." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-10",
            artifactType: "factDensityReport.v1",
            versions: [{
              id: "artifact-version-10",
              payloadJson: JSON.stringify({
                artifactType: "factDensityReport.v1",
                overallScore: 64,
                sections: [{
                  sectionId: "sec-1",
                  heading: "Proof",
                  sentenceCount: 2,
                  specificFactCount: 1,
                  supportedFactCount: 0,
                  score: 50,
                }],
                claims: [{
                  claimId: "sec-1-claim-1",
                  sectionId: "sec-1",
                  text: "Trusted by 500 customer teams worldwide.",
                  classification: "specificFact",
                  verificationStatus: "unsupported",
                }],
                unsupportedClaimIds: ["sec-1-claim-1"],
                warnings: ["Specific claims without verified supplied evidence are marked unsupported."],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "q".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "citable-claims", label: "Citable Claims", artifactType: "claimLedger.v1" },
          ],
          rerun: { capabilityId: "fact-density", versionId: "task-agent-version-10", retryOfRunId: "task-run-10" },
        }));
      }
      if (runId === "task-run-11") {
        const taskInputs = existing?.input && typeof existing.input === "object"
          ? existing.input
          : {};
        const hasCompetitor = Boolean(
          taskInputs.competitorDocument
          && typeof taskInputs.competitorDocument === "object",
        );
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "entity-mapper", displayName: "Entity Mapper", objective: "Map canonical entities." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-11",
            artifactType: "entityMap.v1",
            versions: [{
              id: "artifact-version-11",
              payloadJson: JSON.stringify({
                artifactType: "entityMap.v1",
                entities: [
                  {
                    entityId: "entity-acme",
                    canonicalName: "Acme Cloud",
                    entityType: "brand",
                    aliases: ["Acme"],
                    confidence: 0.9,
                    evidenceIds: ["ev-1"],
                  },
                  {
                    entityId: "entity-evidence",
                    canonicalName: "Evidence Engine",
                    entityType: "product",
                    aliases: [],
                    confidence: 0.85,
                    evidenceIds: ["ev-2"],
                  },
                ],
                relationships: [{
                  relationshipId: "rel-1",
                  sourceEntityId: "entity-acme",
                  targetEntityId: "entity-evidence",
                  relation: "coOccursWith",
                  confidence: 0.75,
                  evidenceIds: ["ev-3"],
                }],
                coverageComparisons: hasCompetitor
                  ? [
                    {
                      entityId: "entity-acme",
                      canonicalName: "Acme Cloud",
                      onSubject: true,
                      onCompetitor: true,
                      status: "presentBoth",
                    },
                    {
                      entityId: "entity-rival-trust",
                      canonicalName: "Trust Layer",
                      onSubject: false,
                      onCompetitor: true,
                      status: "competitorOnly",
                    },
                  ]
                  : [],
                recommendations: hasCompetitor
                  ? [{
                    recommendationId: "rec-trust",
                    relatedEntityId: "entity-rival-trust",
                    action: "Add verified owned coverage for Trust Layer; competitor content mentions it and the subject page does not.",
                    evidenceIds: ["ev-comp-1"],
                  }]
                  : [],
                warnings: [],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "r".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
          ],
          rerun: { capabilityId: "entity-mapper", versionId: "task-agent-version-11", retryOfRunId: "task-run-11" },
        }));
      }
      if (runId === "task-run-12") {
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "schema-markup", displayName: "Schema Markup Generator", objective: "Generate JSON-LD." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-12",
            artifactType: "schemaMarkup.v1",
            versions: [{
              id: "artifact-version-12",
              payloadJson: JSON.stringify({
                artifactType: "schemaMarkup.v1",
                jsonLd: [{
                  "@context": "https://schema.org",
                  "@type": "Article",
                  headline: "Reliable AI content",
                  name: "Reliable AI content",
                }],
                validation: [{
                  code: "article.ok",
                  schemaType: "Article",
                  valid: true,
                  detail: "Article has a headline from visible content.",
                }],
                warnings: [],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "s".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
          ],
          rerun: { capabilityId: "schema-markup", versionId: "task-agent-version-12", retryOfRunId: "task-run-12" },
        }));
      }
      if (runId === "task-run-2") {
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "query-planner", displayName: "Query Planner", objective: "Plan queries with provenance." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-2",
            artifactType: "queryPlan.v1",
            versions: [{
              id: "artifact-version-2",
              payloadJson: JSON.stringify({
                artifactType: "queryPlan.v1",
                methodology: {
                  demandDisclaimer: "Scores are deterministic planning heuristics, not traffic, volume, ranking, or demand measurements.",
                },
                queries: [{ query: "AI content readiness checklist", priorityTier: "high" }],
                clusterCount: 1,
                warnings: [],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "f".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
            { capabilityId: "pillar-outline", label: "Pillar Article Outline", artifactType: "pillarOutline.v1" },
          ],
          rerun: { capabilityId: "query-planner", versionId: "task-agent-version-2", retryOfRunId: "task-run-2" },
        }));
      }
      if (runId === "task-run-3") {
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "faq-generator", displayName: "FAQ Generator", objective: "Generate grounded FAQ pairs." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-3",
            artifactType: "faqSet.v1",
            versions: [{
              id: "artifact-version-3",
              payloadJson: JSON.stringify({
                artifactType: "faqSet.v1",
                topic: "AI content readiness",
                pairs: [{
                  pairId: "faq-1",
                  question: "What is AI content readiness?",
                  answer: "AI content readiness means pages provide answer-first structure, evidence, and schema that systems can cite.",
                  verificationStatus: "supported",
                  citations: [{
                    evidenceId: "ev-faq-1",
                    sourceId: "source-1",
                    quote: "AI content readiness means pages provide answer-first structure, evidence, and schema that systems can cite.",
                    url: "https://example.test/readiness",
                  }],
                }],
                warnings: ["FAQ answers are generated from supplied content and queries only."],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "k".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
          ],
          rerun: { capabilityId: "faq-generator", versionId: "task-agent-version-8", retryOfRunId: "task-run-3" },
        }));
      }
      if (runId === "task-run-4") {
        const completeness = existing?.input?.sourceDocument?.contentCompleteness;
        const isPartial = completeness === "partial";
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "citable-claims", displayName: "Citable Claims", objective: "Extract attributable claims." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-4",
            artifactType: "claimLedger.v1",
            versions: [{
              id: "artifact-version-4",
              payloadJson: JSON.stringify({
                artifactType: "claimLedger.v1",
                claims: [
                  {
                    claimId: "claim-500",
                    claimText: "Trusted by 500 customer teams.",
                    claimType: "quantifiableFact",
                    verificationStatus: isPartial ? "unverifiable" : "supported",
                    confidence: isPartial ? "unknown" : "high",
                    contradictionState: isPartial ? "unknown" : "possible",
                    attribution: "Source page proof section",
                    evidenceIds: ["ev-500"],
                  },
                  {
                    claimId: "claim-50",
                    claimText: "Trusted by 50 customer teams.",
                    claimType: "quantifiableFact",
                    verificationStatus: isPartial ? "unverifiable" : "supported",
                    confidence: isPartial ? "unknown" : "high",
                    contradictionState: isPartial ? "unknown" : "possible",
                    attribution: "Source page proof section",
                    evidenceIds: ["ev-50"],
                  },
                ],
                contradictionPairs: isPartial
                  ? []
                  : [{
                    leftClaimId: "claim-500",
                    rightClaimId: "claim-50",
                    reason: "conflictingQuantities",
                  }],
                warnings: isPartial
                  ? [
                    "Source document is partial; confidence is unknown and verification stays unverifiable.",
                    "Claims never invent statistics.",
                  ]
                  : [
                    "Claims never invent statistics.",
                    "Possible contradiction (conflicting quantities) between claims claim-500 and claim-50.",
                  ],
                provenance: {
                  engineVersion: "deterministic-content.v1",
                  queries: [],
                  evidenceIds: ["ev-500", "ev-50"],
                  evidence: [
                    {
                      evidenceId: "ev-500",
                      sourceId: "source-1",
                      quote: "Trusted by 500 customer teams across regulated industries.",
                    },
                    {
                      evidenceId: "ev-50",
                      sourceId: "source-1",
                      quote: "Trusted by 50 customer teams across regulated industries.",
                    },
                  ],
                },
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "m".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
          ],
          rerun: { capabilityId: "citable-claims", versionId: "task-agent-version-9", retryOfRunId: "task-run-4" },
        }));
      }
      if (runId === "task-run-5") {
        const subjectCompleteness = existing?.input?.subjectPage?.contentCompleteness;
        const isPartial = subjectCompleteness === "partial";
        const competitorPages = Array.isArray(existing?.input?.competitorPages)
          ? existing.input.competitorPages
          : [];
        const competitors = (competitorPages.length ? competitorPages : [{
          competitorId: "rival",
          competitorName: "Rival Co",
        }]).slice(0, 4).map((page, index) => ({
          role: "competitor",
          sourceId: page?.source?.sourceId || `competitor-${index + 1}`,
          competitorId: page?.competitorId || `competitor-${index + 1}`,
          competitorName: page?.competitorName || `Competitor ${index + 1}`,
          overallScore: 80 + index * 3,
          dimensions: [],
          prioritizedFixes: [],
          warnings: [],
          evidenceIds: [],
        }));
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "ai-readiness-comparison", displayName: "AI Readiness Comparison", objective: "Compare readiness scores." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-5",
            artifactType: "readinessComparison.v1",
            versions: [{
              id: "artifact-version-5",
              payloadJson: JSON.stringify({
                artifactType: "readinessComparison.v1",
                subject: {
                  role: "subject",
                  sourceId: "subject-1",
                  overallScore: isPartial ? null : 78,
                  dimensions: [],
                  prioritizedFixes: [],
                  warnings: [],
                  evidenceIds: [],
                },
                competitors,
                dimensionDeltas: [{
                  dimension: "factDensity",
                  subjectScore: isPartial ? null : 70,
                  competitorScores: competitors.map((row) => ({
                    sourceId: row.sourceId,
                    competitorId: row.competitorId,
                    score: row.overallScore,
                  })),
                  bestCompetitorScore: Math.max(...competitors.map((row) => row.overallScore)),
                  deltaVsBestCompetitor: isPartial ? null : -18,
                  summary: isPartial
                    ? "Subject score unknown because the subject page is partial."
                    : "Competitor cites more specific evidence.",
                }],
                prioritizedFixes: isPartial
                  ? []
                  : ["Add supported quantitative claims to the subject page."],
                warnings: isPartial
                  ? [
                    "Subject page is marked partial; scores that depend on absences stay unknown.",
                  ]
                  : [],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "t".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "content-gap", label: "Content Gap Finder", artifactType: "contentGapAnalysis.v1" },
          ],
          rerun: { capabilityId: "ai-readiness-comparison", versionId: "task-agent-version-5", retryOfRunId: "task-run-5" },
        }));
      }
      if (runId === "task-run-6") {
        const subjectCompleteness = existing?.input?.subjectPages?.[0]?.contentCompleteness;
        const isPartial = subjectCompleteness === "partial";
        const competitorPages = Array.isArray(existing?.input?.competitorPages)
          ? existing.input.competitorPages
          : [];
        const competitorPageCount = Math.max(1, competitorPages.length);
        const competitorSourceIds = competitorPages
          .map((page) => page?.source?.sourceId)
          .filter((id) => typeof id === "string" && id);
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "content-gap", displayName: "Content Gap Finder", objective: "Find comparative gaps." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-6",
            artifactType: "contentGapAnalysis.v1",
            versions: [{
              id: "artifact-version-6",
              payloadJson: JSON.stringify({
                artifactType: "contentGapAnalysis.v1",
                dimensions: [{
                  dimension: "proof",
                  subjectCoverage: isPartial ? null : false,
                  competitorCoverageCount: competitorPageCount,
                  competitorPageCount,
                  subjectEvidenceIds: [],
                  competitorEvidenceIds: ["ev-1"],
                  summary: isPartial
                    ? "Subject coverage is unknown due to partial input."
                    : `Competitor proof signals appear on ${competitorPageCount} supplied page(s).`,
                }],
                gaps: [{
                  gapId: "gap-proof-1",
                  dimension: "proof",
                  signal: "customer count",
                  status: isPartial ? "coverageUnknown" : "supportedGap",
                  opportunity: isPartial
                    ? "Re-run with fuller subject content before asserting a gap."
                    : "Publish a citeable customer-count proof block.",
                  competitorSourceIds: competitorSourceIds.length
                    ? competitorSourceIds
                    : ["competitor-1"],
                  evidenceIds: ["ev-1"],
                  confidence: isPartial ? "unknown" : "high",
                }],
                warnings: isPartial
                  ? [
                    "At least one subject page is partial; uncovered subject dimensions are coverageUnknown rather than asserted gaps.",
                  ]
                  : [],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "u".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "competitor-audit", label: "Competitor Audit", artifactType: "competitorAudit.v1" },
          ],
          rerun: { capabilityId: "content-gap", versionId: "task-agent-version-4", retryOfRunId: "task-run-6" },
        }));
      }
      if (runId === "task-run-7") {
        const subjectCompleteness = existing?.input?.subjectPages?.[0]?.contentCompleteness;
        const isPartial = subjectCompleteness === "partial";
        const competitorPages = Array.isArray(existing?.input?.competitorPages)
          ? existing.input.competitorPages
          : [];
        const pageAnalyses = (competitorPages.length ? competitorPages : [{ competitorId: "rival" }]).map((page, index) => ({
          artifactType: "competitorPageAnalysis.v1",
          competitorId: page?.competitorId || `rival-${index + 1}`,
          dimensions: [],
          opportunities: ["Add FAQ answers"],
          warnings: [],
        }));
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "competitor-audit", displayName: "Competitor Audit", objective: "Prioritize remediation actions." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-7",
            artifactType: "competitorAudit.v1",
            versions: [{
              id: "artifact-version-7",
              payloadJson: JSON.stringify({
                artifactType: "competitorAudit.v1",
                pageAnalyses,
                contentGap: {
                  gaps: [{
                    gapId: "gap-1",
                    status: isPartial ? "coverageUnknown" : "supportedGap",
                  }],
                },
                prioritizedActions: [{
                  actionId: "action-1",
                  priority: "high",
                  dimension: "proof",
                  action: "Add a verified customer-count claim with source evidence.",
                  rationale: isPartial
                    ? "Subject coverage is unknown because at least one subject page is partial."
                    : `Competitor proof signals are present across ${pageAnalyses.length} page(s) while subject coverage is absent.`,
                  evidenceIds: ["ev-1"],
                  origin: isPartial ? "coverageUnknown" : "supportedGap",
                }],
                warnings: isPartial
                  ? [
                    "At least one subject page is partial; uncovered subject dimensions are coverageUnknown rather than asserted gaps.",
                  ]
                  : [],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "v".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [],
          rerun: { capabilityId: "competitor-audit", versionId: "task-agent-version-6", retryOfRunId: "task-run-7" },
          changeOverTime: isPartial
            ? { available: false, message: "No prior succeeded run for this subject." }
            : {
              available: true,
              priorRunId: "task-run-prior-audit",
              priorCompletedAtUtc: "2026-09-10T12:00:00Z",
              subjectKey: "body:competitor-audit-demo",
              currentOverall: null,
              priorOverall: null,
              overallDelta: null,
              dimensions: [],
              findings: [
                {
                  key: "action:action-new",
                  change: "added",
                  currentPriority: "high",
                  priorPriority: null,
                  summary: "Clarify pricing against competitor plans.",
                },
                {
                  key: "action:action-old",
                  change: "removed",
                  currentPriority: null,
                  priorPriority: "medium",
                  summary: "Old FAQ remediation.",
                },
                {
                  key: "action:action-1",
                  change: "priorityChanged",
                  currentPriority: "high",
                  priorPriority: "medium",
                  summary: "Add a verified customer-count claim with source evidence.",
                },
              ],
              message: "1 finding added, 1 removed, 1 priority shifted since last audit.",
            },
        }));
      }
      if (runId === "task-run-8") {
        const brandCompleteness = existing?.input?.brandPages?.[0]?.contentCompleteness;
        const isPartial = brandCompleteness === "partial";
        const competitorPageCount = Array.isArray(existing?.input?.competitorPages)
          ? existing.input.competitorPages.length
          : 1;
        const observations = Array.isArray(existing?.input?.aiAnswerObservations)
          ? existing.input.aiAnswerObservations
          : [];
        const observationGaps = observations
          .filter((obs) =>
            Array.isArray(obs?.competitorIdsMentioned)
            && obs.competitorIdsMentioned.length > 0
            && obs.subjectMentioned !== true
          )
          .map((obs) => ({
            gapId: `obs-gap-${obs.observationId || "1"}`,
            attribute: `AI-answer mention for query: ${obs.query || ""}`,
            status: "observationOnly",
            summary: "Supplied AI-answer observation mentions competitor(s) without confirmed subject mention. This is an observation record, not measured market perception.",
            evidenceIds: [],
            observationIds: [obs.observationId].filter(Boolean),
            competitorIds: obs.competitorIdsMentioned,
          }));
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "competitor-positioning", displayName: "Competitor Positioning", objective: "Map narrative attributes." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-8",
            artifactType: "competitorPositioning.v1",
            versions: [{
              id: "artifact-version-8",
              payloadJson: JSON.stringify({
                artifactType: "competitorPositioning.v1",
                attributeMap: [{
                  attributeId: "attr-1",
                  attribute: "Evidence-first drafting",
                  party: "brand",
                  signals: ["citeable drafts"],
                  evidenceIds: ["ev-1"],
                  sourceIds: ["brand-1"],
                }],
                perceptionGaps: [
                  {
                    gapId: "pg-1",
                    attribute: "Speed claims",
                    status: isPartial ? "coverageUnknown" : "supportedGap",
                    summary: isPartial
                      ? "Brand coverage is unknown because at least one brand page is partial."
                      : "Competitor emphasizes speed; brand does not.",
                    evidenceIds: ["ev-2"],
                    competitorIds: ["rival"],
                  },
                  ...observationGaps,
                ],
                messagingHypotheses: [{
                  hypothesisId: "hyp-1",
                  origin: "generatedHypothesis",
                  message: "Lead with bounded review gates instead of speed slogans.",
                  targetQuery: "fastest AI writing tool",
                  relatedAttribute: "Speed claims",
                  evidenceIds: ["ev-2"],
                  disclaimer: "Generated only — not measured market perception.",
                }],
                observations,
                warnings: [
                  ...(competitorPageCount > 1
                    ? [`Positioning map considers ${competitorPageCount} competitor pages.`]
                    : []),
                  ...(isPartial
                    ? [
                      "At least one brand page is partial; missing brand attributes are coverageUnknown rather than asserted absences.",
                    ]
                    : []),
                ],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "w".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [],
          rerun: { capabilityId: "competitor-positioning", versionId: "task-agent-version-7", retryOfRunId: "task-run-8" },
        }));
      }
      if (runId === "task-run-9") {
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: { capabilityId: "competitor-page", displayName: "Competitor Page Analysis", objective: "Analyze competitor signals." },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-9",
            artifactType: "competitorPageAnalysis.v1",
            versions: [{
              id: "artifact-version-9",
              payloadJson: JSON.stringify({
                artifactType: "competitorPageAnalysis.v1",
                competitorId: "rival",
                dimensions: [{
                  dimension: "proof",
                  present: true,
                  summary: "Page cites customer counts and named systems.",
                  signals: ["500 teams"],
                  evidenceIds: ["ev-1"],
                }],
                opportunities: ["Mirror proof density with verified owned evidence."],
                warnings: [],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "x".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "content-gap", label: "Content Gap Finder", artifactType: "contentGapAnalysis.v1" },
          ],
          rerun: { capabilityId: "competitor-page", versionId: "task-agent-version-3", retryOfRunId: "task-run-9" },
        }));
      }
      if (runId === "task-run-13") {
        const subjectCompleteness = existing?.input?.subjectPages?.[0]?.contentCompleteness;
        const isPartial = subjectCompleteness === "partial";
        const competitorPages = Array.isArray(existing?.input?.competitorPages)
          ? existing.input.competitorPages
          : [];
        const competitorPageCount = Math.max(1, competitorPages.length);
        const competitorName = existing?.input?.competitorName
          || competitorPages
            .map((page) => page?.source?.title)
            .filter((title) => typeof title === "string" && title)
            .join(" · ")
          || "Competitor Inc.";
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: {
            capabilityId: "comparison-brief",
            displayName: "Comparison Brief",
            objective: "Structure a subject-versus-competitor brief.",
          },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-13",
            artifactType: "comparisonBrief.v1",
            versions: [{
              id: "artifact-version-13",
              payloadJson: JSON.stringify({
                artifactType: "comparisonBrief.v1",
                subjectName: existing?.input?.subjectName || "Subject Analyzer",
                competitorName,
                criteria: [{
                  criterion: "pricing",
                  subjectSignals: isPartial ? [] : ["Plans start at $15 per month."],
                  competitorSignals: ["Plans start at $20 per month."],
                  evidenceIds: ["ev-1"],
                  summary: isPartial
                    ? "pricing: subject coverage unknown due to partial input; competitor coverage present."
                    : "pricing: subject coverage present; competitor coverage present.",
                }],
                differentiators: [{
                  origin: "generatedHypothesis",
                  text: "Lead with transparent mid-market pricing.",
                  disclaimer: "generatedHypothesis only; not measured demand, ranking, or market perception.",
                }],
                proofRequirements: [{
                  origin: "generatedHypothesis",
                  text: "Cite a concrete plan price on the subject page.",
                }],
                positioningAngles: [{
                  origin: "generatedHypothesis",
                  text: "Frame as evidence-linked analysis at a clearer price.",
                }],
                recommendedVerdict: {
                  framing: isPartial
                    ? "Verdict unknown while subject input remains partial."
                    : "Choose Subject Analyzer when buyers need evidence-linked analysis at a lower entry price.",
                  disclaimer: "Heuristic recommendation from supplied page signals only; not a measured ranking, win rate, or market outcome.",
                },
                warnings: [
                  ...(competitorPageCount > 1
                    ? [`Compared against ${competitorPageCount} competitor pages.`]
                    : []),
                  ...(isPartial
                    ? [
                      "Subject coverage is unknown due to partial input.",
                      "Differentiators are labeled generatedHypothesis.",
                    ]
                    : ["Differentiators are labeled generatedHypothesis."]),
                ],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "t".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "competitive-response", label: "Competitive Response", artifactType: "competitiveResponse.v1" },
            { capabilityId: "citable-claims", label: "Citable Claims", artifactType: "claimLedger.v1" },
          ],
          rerun: { capabilityId: "comparison-brief", versionId: "task-agent-version-13", retryOfRunId: "task-run-13" },
        }));
      }
      if (runId === "task-run-14") {
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: {
            capabilityId: "pillar-outline",
            displayName: "Pillar Article Outline",
            objective: "Produce a topic-cluster outline.",
          },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-14",
            artifactType: "pillarOutline.v1",
            versions: [{
              id: "artifact-version-14",
              payloadJson: JSON.stringify({
                artifactType: "pillarOutline.v1",
                topic: "AI content readiness",
                sections: [{
                  sectionId: "sec-1",
                  heading: "What is AI content readiness?",
                  objective: "Define readiness in answer-first language.",
                  answerFirstPrompt: "AI content readiness means pages provide answer-first structure, evidence, and schema that systems can cite.",
                  relatedQueries: ["What is AI content readiness?"],
                  evidenceIds: [],
                }],
                supportingContentPlan: [{
                  contentType: "faq",
                  title: "AI content readiness FAQ",
                  rationale: "Capture definitional queries as reusable FAQ pairs.",
                  origin: "generatedHypothesis",
                  disclaimer: "generatedHypothesis only; not measured demand or cluster coverage.",
                }],
                warnings: ["Supporting content plans are labeled generatedHypothesis."],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "u".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "pillar-article", label: "Pillar Article", artifactType: "pillarArticle.v1" },
            { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
            { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
          ],
          rerun: { capabilityId: "pillar-outline", versionId: "task-agent-version-14", retryOfRunId: "task-run-14" },
        }));
      }
      if (runId === "task-run-16") {
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: {
            capabilityId: "pillar-article",
            displayName: "Pillar Article",
            objective: "Draft a grounded pillar article.",
          },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-16",
            artifactType: "pillarArticle.v1",
            versions: [{
              id: "artifact-version-16",
              payloadJson: JSON.stringify({
                artifactType: "pillarArticle.v1",
                topic: "AI content readiness",
                title: "AI content readiness",
                markdown: "# AI content readiness\n\n## What is AI content readiness?\n\nAI content readiness means pages answer questions with evidence.\n",
                sections: [{
                  sectionId: "sec-1",
                  heading: "What is AI content readiness?",
                  bodyMarkdown: "AI content readiness means pages answer questions with evidence.\n\nTeams use readiness before publishing.",
                  evidenceIds: ["ev-1", "ev-2"],
                  grounded: true,
                }, {
                  sectionId: "sec-2",
                  heading: "AI content readiness compared to alternatives",
                  bodyMarkdown: "Lead with the key takeaway for 'AI content readiness compared to alternatives', then expand. [Scaffold — no supplied source span grounded this section.]",
                  evidenceIds: [],
                  grounded: false,
                }],
                supportingContentPlan: [{
                  contentType: "faq",
                  title: "AI content readiness FAQ",
                  rationale: "Capture questions as pairs.",
                  origin: "generatedHypothesis",
                  disclaimer: "generatedHypothesis only",
                }],
                warnings: [
                  "Pillar article bodies prefer multi-paragraph source spans under matching headings; ungrounded sections stay scaffolds and must not be treated as verified claims.",
                ],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "r".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
            { capabilityId: "comparison-brief", label: "Comparison Brief", artifactType: "comparisonBrief.v1" },
            { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
          ],
          rerun: { capabilityId: "pillar-article", versionId: "task-agent-version-16", retryOfRunId: "task-run-16" },
        }));
      }
      if (runId === "task-run-15") {
        const brandCompleteness = existing?.input?.brandPages?.[0]?.contentCompleteness;
        const isPartial = brandCompleteness === "partial";
        const competitorPages = Array.isArray(existing?.input?.competitorPages)
          ? existing.input.competitorPages
          : [];
        const competitorPageCount = Math.max(1, competitorPages.length);
        return send(res, 200, taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: {
            capabilityId: "competitive-response",
            displayName: "Competitive Response",
            objective: "Plan a brand-aligned competitive response.",
          },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-15",
            artifactType: "competitiveResponse.v1",
            versions: [{
              id: "artifact-version-15",
              payloadJson: JSON.stringify({
                artifactType: "competitiveResponse.v1",
                selectedMode: "counterNarrative",
                rationale: isPartial
                  ? "Brand coverage is unknown because at least one brand page is partial."
                  : "Competitor cites social proof that the brand page does not answer directly.",
                contentAngles: [{
                  origin: "generatedHypothesis",
                  text: "Answer why buyers should choose the brand with concrete capability proof.",
                  disclaimer: "generatedHypothesis only; not measured demand, ranking, or market perception.",
                }],
                requiredProofPoints: [{
                  proofId: "proof-1",
                  statement: "Document Markdown analysis support with a visible capability claim.",
                  evidenceIds: [],
                  origin: "suppliedEvidence",
                }],
                outlineSections: [{
                  heading: "Answer: Why choose Brand Analyzer?",
                  objective: "Lead with a direct brand answer, then required proof.",
                  evidenceIds: [],
                }],
                warnings: [
                  ...(competitorPageCount > 1
                    ? [`Response plan considers ${competitorPageCount} competitor pages.`]
                    : []),
                  ...(isPartial
                    ? [
                      "At least one brand page is partial; missing brand signals stay unknown.",
                      "Does not copy competitor prose into draft body.",
                    ]
                    : ["Does not copy competitor prose into draft body."]),
                ],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "v".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "citable-claims", label: "Citable Claims", artifactType: "claimLedger.v1" },
            { capabilityId: "comparison-brief", label: "Comparison Brief", artifactType: "comparisonBrief.v1" },
          ],
          rerun: { capabilityId: "competitive-response", versionId: "task-agent-version-15", retryOfRunId: "task-run-15" },
        }));
      }
      if (runId === "task-run-17") {
        const assumptions = existing?.input?.assumptions || {};
        const volume = Number(assumptions.workflowVolume ?? 120);
        const baseline = Number(assumptions.baselineMinutes ?? 90);
        const assisted = Number(assumptions.assistedMinutes ?? 25);
        const adoption = Number(assumptions.adoptionRate ?? 0.7);
        const success = Number(assumptions.successfulUseRate ?? 0.85);
        const hourly = Number(assumptions.loadedHourlyCost ?? 85);
        const redeploy = Number(assumptions.redeploymentFactor ?? 0.6);
        const externalSpend = Number(assumptions.externalSpend ?? 48000);
        const replaceable = Number(assumptions.replaceableShare ?? 0.35);
        const tco = Number(assumptions.totalCostOfOwnership ?? 36000);
        const minutesSaved = Math.max(0, baseline - assisted);
        const savedHours = volume * minutesSaved / 60 * adoption * success;
        const productivity = savedHours * hourly * redeploy;
        const external = externalSpend * replaceable * adoption;
        const gross = productivity + external;
        const net = gross - tco;
        const roiPercent = tco > 0 ? (net / tco) * 100 : null;
        const shell = taskResultShell(runId, existing, {
          contractVersion: "gcc-task-result-shell.v1",
          identity: {
            capabilityId: "roi-business-calculator",
            displayName: "AI-Based ROI Business Calculator",
            objective: "Project directional ROI and reconcile to observed capacity.",
          },
          progress: { status: "succeeded", phase: "complete", progressPercent: 100 },
          artifacts: [{
            id: "artifact-17",
            artifactType: "roiProjection.v1",
            versions: [{
              id: "artifact-version-17",
              payloadJson: JSON.stringify({
                artifactType: "roiProjection.v1",
                formulaVersion: "gcc-roi-formulas.v1",
                contractVersion: "roiBusinessCalculatorInput.v1",
                assumptions,
                lookbackDays: existing?.input?.lookbackDays ?? 90,
                scenarios: [
                  { scenario: "conservative", label: "Conservative", savedHours: savedHours * 0.75, netBenefit: net * 0.75, roiPercent: roiPercent == null ? null : roiPercent * 0.75 },
                  { scenario: "expected", label: "Expected", savedHours, productivityValue: productivity, externalCostAvoided: external, grossBenefit: gross, netBenefit: net, roiPercent },
                  { scenario: "upside", label: "Upside", savedHours: savedHours * 1.25, netBenefit: net * 1.25, roiPercent: roiPercent == null ? null : roiPercent * 1.25 },
                ],
                reconciliation: {
                  assumedSuccessRate: success,
                  observedAcceptanceRate: 31 / 48,
                  notes: [
                    "Reconciliation compares modeled assumptions to observed workflow capacity — not cash claims.",
                    "Observed acceptance is above the assumed success rate.",
                  ],
                },
                evidenceLabels: {
                  projections: "modeled",
                  reconciliation: "telemetry-measured",
                  cashClaims: "not-asserted",
                },
                warnings: [
                  "Directional model only — not a quote, guarantee, or audited finance result.",
                  "Capacity created is not cash saved. Revenue contribution requires attributable gross margin.",
                ],
              }),
              evidenceJson: "[]",
              citationsJson: "[]",
              digest: "t".repeat(64),
              validationState: "valid",
            }],
          }],
          nextActions: [
            { capabilityId: "ai-readiness", label: "AI Readiness Score", artifactType: "readinessScore.v1" },
          ],
          rerun: { capabilityId: "roi-business-calculator", versionId: "task-agent-version-17", retryOfRunId: "task-run-17" },
        });
        if (existing) {
          taskRuns.set(runId, {
            ...existing,
            status: "succeeded",
            phase: "complete",
            progressPercent: 100,
            artifacts: shell.artifacts,
          });
        }
        return send(res, 200, shell);
      }
      return send(res, 404, { error: "Result not found." });
    }
    if (!action && req.method === "GET") {
      if (existing) {
        if (existing.status === "queued" || (existing.status === "running" && !scenario.taskRunHold)) {
          const succeeded = {
            ...existing,
            status: "succeeded",
            phase: "complete",
            progressPercent: 100,
          };
          taskRuns.set(runId, succeeded);
          return send(res, 200, succeeded);
        }
        return send(res, 200, existing);
      }
      if (runId === "task-run-1") {
        return send(res, 200, { id: "task-run-1", status: "succeeded", phase: "complete", progressPercent: 100 });
      }
      if (runId === "task-run-2") {
        return send(res, 200, { id: "task-run-2", status: "succeeded", phase: "complete", progressPercent: 100 });
      }
      if (runId === "task-run-3") {
        return send(res, 200, { id: "task-run-3", status: "succeeded", phase: "complete", progressPercent: 100 });
      }
      if (runId === "task-run-4") {
        return send(res, 200, { id: "task-run-4", status: "succeeded", phase: "complete", progressPercent: 100 });
      }
      return send(res, 404, { error: "Task run not found." });
    }
  }
  if (url.pathname === "/api/geek-content-creator-v2/creates" && req.method === "POST") {
    return send(res, 200, { id: "create-1" });
  }
  if (url.pathname === "/api/geek-content-creator-v2/creates/create-1/partner-tools/preflight") {
    return send(res, 200, {
      createId: "create-1",
      toolCount: 1,
      toolsFound: true,
      tools: [{ name: "Evidence Engine", url: "https://example.test/tool", source: "crawl" }],
      message: "Found 1 partner tool.",
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/creates/create-1/generate") {
    job.status = "awaiting_brandkit_approval";
    return send(res, 200, { jobId: job.id });
  }
  if (url.pathname === "/api/geek-content-creator-v2/creates/create-1") {
    return send(res, 200, { id: "create-1", title: "Reliable Content Operations", contentType: "pillar", siteUrl: "https://example.test" });
  }
  if (url.pathname === "/api/geek-content-creator-v2/creates/create-1/jobs") return send(res, 200, [job]);
  if (url.pathname === `/api/geek-content-creator-v2/jobs/${job.id}` && req.method === "GET") return send(res, 200, job);
  const manifestMatch = url.pathname.match(/^\/api\/geek-content-creator-v2\/jobs\/([^/]+)\/context-manifest$/);
  if (manifestMatch && req.method === "GET") {
    const manifest = manifests.get(manifestMatch[1]);
    return manifest ? send(res, 200, manifest) : send(res, 404, { error: "Context manifest not found" });
  }
  const retryContext = url.pathname.match(/^\/api\/geek-content-creator-v2\/jobs\/([^/]+)\/retry$/);
  if (retryContext && req.method === "POST") {
    const manifest = manifests.get(retryContext[1]);
    if (!manifest) return send(res, 404, { error: "Context manifest not found" });
    const nextId = "job-retry-1";
    manifests.set(nextId, { ...structuredClone(manifest), originalJobId: retryContext[1] });
    job = { ...job, id: nextId, status: "pending", retryOfJobId: retryContext[1], contextManifestId: manifest.manifestId };
    return send(res, 202, { jobId: nextId, contextManifestId: manifest.manifestId });
  }
  const refreshContext = url.pathname.match(/^\/api\/geek-content-creator-v2\/jobs\/([^/]+)\/refresh-context-and-rerun$/);
  if (refreshContext && req.method === "POST") {
    const prior = manifests.get(refreshContext[1]);
    if (!prior) return send(res, 404, { error: "Context manifest not found" });
    const nextId = "job-refresh-1";
    const nextManifest = {
      ...structuredClone(prior),
      manifestId: "manifest-2",
      digest: `sha256:${"e".repeat(64)}`,
      resolvedAtUtc: "2026-09-09T10:10:00Z",
      replacesJobId: refreshContext[1],
    };
    manifests.set(nextId, nextManifest);
    job = {
      ...job, id: nextId, status: "pending", refreshedFromJobId: refreshContext[1],
      contextManifestId: nextManifest.manifestId, contextManifestDigest: nextManifest.digest,
    };
    return send(res, 202, { jobId: nextId, contextManifestId: nextManifest.manifestId });
  }
  if (url.pathname === "/api/geek-content-creator-v2/creates/create-1/ai-visibility") {
    return send(res, 200, { ready: false, createId: "create-1", message: "Complete the draft first." });
  }
  if (url.pathname === "/api/geek-content-creator-v2/jobs/job-1/accept-brandkit") {
    job.status = "awaiting_outline_approval";
    broadcast(event("BrandKitAccepted", {}));
    broadcast(event("OutlineReady", outlinePayload()));
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/api/geek-content-creator-v2/jobs/job-1/outline" && req.method === "PUT") {
    return send(res, 200, JSON.parse(rawBody));
  }
  if (url.pathname === "/api/geek-content-creator-v2/jobs/job-1/approve-outline") {
    job.status = "ready";
    job.stage = "COMPLETE";
    job.resultJson = JSON.stringify({
      toolPageKind: "partner",
      sourceAttributionHtml: '<a href="https://example.test/reliable-content">Reliable content operations</a>',
      citations: [ragCitation()],
      sectionCitations: { problem: [ragCitation()] },
      modelPolicy: { version: "content-model-policy.v1", preset: "best-quality" },
      provenance: {
        stage: "COMPLETE",
        effectiveModel: "o1-pro",
        modelPolicyVersion: "content-model-policy.v1",
        promptVersion: "synthesis/v1",
        retrievalStrategy: "hybrid",
        attemptId: "attempt-write-1",
        agentExecution: agentExecution(),
      },
      agentExecutions: [
        { ...agentExecution(), stage: "PLAN", agentId: "OutlineAgent", attemptId: "attempt-plan-1" },
        agentExecution(),
      ],
      agentTeam: {
        snapshotVersion: "agent-team.v1",
        catalogVersion: "agent-catalog.2026-09-08",
        snapshotDigest: "sha256:teamfixture",
        members: publishedAgents().slice(0, 2).map((agent) => ({
          catalogAgentId: agent.id,
          agentVersionId: agent.versionId,
          name: agent.name,
          version: agent.version,
          digest: agent.digest,
          role: agent.role,
          specialty: agent.specialty,
          activatedSkills: agentExecution().activatedSkills.filter((skill) => agent.skillIds.includes(skill.skillId)),
        })),
      },
      handoffs: [{
        id: "handoff-1",
        fromCatalogAgentId: "marketing-strategist",
        toCatalogAgentId: "content-producer",
        kind: "contribution",
        status: "accepted",
        summary: "Audience angle incorporated into the producer draft.",
        stageExecutionId: "execution-write-1",
      }],
      evidenceManifest: {
        ready: true,
        sources: [{ pageId: "page-1", url: ragCitation().url, title: ragCitation().title, crawlType: "project" }],
        warnings: [],
      },
      approvedStageModels: { WRITE: ["o3"], COMPLETE: ["o1-pro", "o3"] },
    });
    broadcast(event("OutlineApproved", {}));
    broadcast(event("AgentStageStarted", { execution: agentExecution("running") }));
    broadcast(event("SkillActivated", { execution: agentExecution("running") }));
    broadcast(event("AgentToolCompleted", { execution: agentExecution("running") }));
    const drafted = event("SectionDrafted", sectionPayload());
    broadcast(drafted);
    broadcast(drafted);
    broadcast(event("AgentStageCompleted", { execution: agentExecution() }));
    broadcast(event("ValidationReport", {
      shipReady: true, outstandingIssues: false, reviewVerdict: "pass", reviewNotes: "Deterministic fixture",
      seoScore: 95, polishScore: 96, polishShipReady: true, geoScore: 94, seoChecks: [], geoChecks: [], overlapHits: [],
    }));
    broadcast(event("JobCompleted", { status: "ready" }));
    return send(res, 200, { ok: true });
  }
  if (
    url.pathname === "/api/geek-content-creator-v2/creates/create-1/canvas/section"
    && req.method === "PUT"
  ) {
    const body = JSON.parse(rawBody || "{}");
    if (!body.exactContent?.trim()) return send(res, 400, { error: "exactContent is required" });
    const current = sectionPayload();
    const edited = {
      ...current,
      documentJson: JSON.stringify({
        ...JSON.parse(current.documentJson),
        paragraphs: [{ type: "text", runs: [{ text: body.exactContent.trim() }] }],
      }),
      wordCount: body.exactContent.trim().split(/\s+/).length,
      usedFallbackStub: false,
      editKind: "operator-exact-replacement",
      aiGenerated: false,
      validationInvalidated: true,
    };
    broadcast(event("SectionEdited", edited));
    broadcast(event("ValidationInvalidated", {
      reason: "operator-section-edit",
      sectionKey: body.sectionKey,
      requiresRevalidation: true,
    }));
    return send(res, 200, {
      ...edited,
      section: JSON.parse(edited.documentJson),
      validationInvalidated: true,
    });
  }
  if (url.pathname === "/api/geek-content-creator-v2/creates/create-1/ai-visibility/refresh") {
    return send(res, 200, { ready: true, createId: "create-1", score: 94, report: { seoScore: 95, geoScore: 94, geoChecks: [], publishedUrls: [] } });
  }
  if ([
    "/api/geek-content-creator-v2/creates/create-1/transform/pdf",
    "/api/geek-content-creator-v2/creates/create-1/transform/linkedin-carousel",
  ].includes(url.pathname)) {
    const artifact = {
      slug: "reliable-content-operations",
      generatedAtUtc: new Date().toISOString(),
      caption: "A reliable content workflow keeps evidence, approvals, and publishing connected.",
      hashtags: ["#ContentOperations"],
      suggestedFilename: "Reliable_Content_Operations",
      slides: [
        { index: 0, role: "hook", title: "Reliable content operations", bullets: [] },
        { index: 1, role: "teach", title: "Keep evidence connected", bullets: ["Verify every claim"] },
      ],
    };
    const parsed = JSON.parse(job.resultJson || "{}");
    const pdfBase64 = Buffer.from("%PDF-1.4 fake").toString("base64");
    job.resultJson = JSON.stringify({
      ...parsed,
      linkedInCarousel: { ...artifact, pdfBase64 },
    });
    return send(res, 200, {
      slug: artifact.slug,
      slideCount: artifact.slides.length,
      caption: artifact.caption,
      suggestedFilename: artifact.suggestedFilename,
      pdfBase64,
      slides: artifact.slides,
    });
  }

  if (url.pathname === "/api/rag/status") {
    return send(res, 200, scenario.ragAvailable
      ? {
          available: true,
          citeableGenerateAvailable: true,
          graphRetrievalAvailable: true,
          adTemplateIndexAvailable: true,
          entitySeeds: ["Evidence Engine"],
          longFormModel: "o1-pro",
          shortFormModel: "o3",
          modelPolicyVersion: "content-model-policy.v1",
          approvedStageModels: { PLAN: ["o1-pro", "o3"], WRITE: ["o3"], VALIDATE: ["o3"] },
        }
      : { available: false, reason: "Deterministic RAG outage." });
  }
  if (url.pathname === "/api/rag/templates") return send(res, 200, { upserted: 1 });
  if (url.pathname === "/api/rag/generate") {
    const body = JSON.parse(rawBody || "{}");
    if (body.generationStage === "outline") {
      return send(res, 200, {
        intent: body.writingIntent,
        outline: [
          { key: "section-1", heading: "Evidence-led planning", brief: "Explain approval gates." },
          { key: "section-2", heading: "Verified publishing", brief: "Explain source verification." },
        ],
        sources: [],
      });
    }
    if (body.generationStage === "section") {
      const attempts = (sectionAttempts.get(body.sectionKey) || 0) + 1;
      sectionAttempts.set(body.sectionKey, attempts);
      if (body.sectionKey === "section-1" && attempts === 1) return send(res, 503, { error: "Transient deterministic section failure" });
      return send(res, 200, {
        intent: body.writingIntent,
        content: `${body.sectionHeading}: ${fixtureQuote}`,
        citations: [ragCitation()],
        sources: [{ kind: "crawl", crawlType: "project", url: ragCitation().url, title: ragCitation().title }],
      });
    }
    return send(res, 200, {
      intent: body.writingIntent,
      modelUsed: "fake-model",
      retrievalMode: "hybrid",
      content: `One-shot draft: ${fixtureQuote}`,
      variations: body.writingIntent === "Social Ad" ? ["Reliable evidence. Better publishing.", "Ship grounded content with confidence."] : undefined,
      appliedTemplates: body.adTemplates || [],
      citations: [ragCitation()],
      sources: [{ kind: "crawl", crawlType: "project", url: ragCitation().url, title: ragCitation().title }],
    });
  }

  send(res, 404, { error: `No fake route for ${req.method} ${url.pathname}` });
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname !== "/hubs/gcc-v2-realtime") return socket.destroy();
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws));
});

wss.on("connection", (socket) => {
  sockets.add(socket);
  let buffer = "";
  socket.on("close", () => sockets.delete(socket));
  socket.on("message", (chunk) => {
    buffer += chunk.toString();
    const frames = buffer.split(recordSeparator);
    buffer = frames.pop() || "";
    for (const frame of frames) {
      if (!frame) continue;
      const message = JSON.parse(frame);
      if (message.protocol) {
        socket.send(hubMessage({}));
      } else if (message.type === 1 && message.target === "JoinJob") {
        if (job.status === "awaiting_brandkit_approval" && history.length === 0) brandKitEvent();
        const lastSeq = Number(message.arguments?.[1] || 0);
        for (const evt of history.filter((item) => item.seq > lastSeq)) {
          socket.send(hubMessage({ type: 1, target: "JobEvent", arguments: [evt] }));
        }
        socket.send(hubMessage({ type: 3, invocationId: message.invocationId, result: null }));
      } else if (message.type === 1 && message.target === "JoinContextIngestion") {
        const lastSeq = Number(message.arguments?.[0] || 0);
        for (const ingestionEvent of ingestionEvents.filter((item) => item.seq > lastSeq)) {
          socket.send(hubMessage({ type: 1, target: "ContextIngestionEvent", arguments: [ingestionEvent] }));
        }
        socket.send(hubMessage({ type: 3, invocationId: message.invocationId, result: null }));
      } else if (message.type === 1 && message.target === "JoinAgentTest") {
        const runId = message.arguments?.[0];
        const run = agentTestRuns.get(runId);
        if (!run) {
          socket.send(hubMessage({ type: 3, invocationId: message.invocationId, error: "Agent test run not found" }));
          continue;
        }
        sendAgentTest(socket, run, "Snapshot");
        socket.send(hubMessage({ type: 3, invocationId: message.invocationId, result: null }));
        const runningTimer = setTimeout(() => {
          const current = agentTestRuns.get(runId);
          if (!current || current.status !== "queued") return;
          const running = { ...current, status: "running", progressPercent: 45, phase: "rag-smoke", attemptCount: 1, startedAtUtc: new Date().toISOString() };
          storeAgentTestRun(running);
          sendAgentTest(socket, running, "Executing governed specialist scenario.");
        }, 40);
        const passedTimer = setTimeout(() => {
          const current = agentTestRuns.get(runId);
          if (!current || current.status !== "running") return;
          const passed = { ...current, status: "passed", progressPercent: 100, phase: "passed", resultJson: JSON.stringify({ passed: true, scenario: current.scenario }), completedAtUtc: new Date().toISOString() };
          storeAgentTestRun(passed);
          sendAgentTest(socket, passed, "Exact-version test passed.");
        }, run.scenario === "rag-smoke" ? 1200 : 600);
        agentTestTimers.push(runningTimer, passedTimer);
      } else if (message.type === 1 && message.target === "LeaveAgentTest") {
        socket.send(hubMessage({ type: 3, invocationId: message.invocationId, result: null }));
      } else if (message.type === 6) {
        socket.send(hubMessage({ type: 6 }));
      }
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`fake platform listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

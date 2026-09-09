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
let contextUploads;
let manifests;

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
    audiences: [item("audience-1", "audience", "Technical Leaders", "audience-version-1")],
    "style-guides": [item("style-1", "style-guide", "Clear Technical Style", "style-version-1")],
    products: [item("product-1", "product", "Evidence Engine", "product-version-1")],
  };
  manifests = new Map();
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
  const catalogName = url.pathname.match(/^\/api\/geek-content-creator-v2\/(knowledge|brand-kits|audiences|style-guides|products)$/)?.[1];
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
      }],
    });
    return send(res, 201, { id: stableId, versionId });
  }
  const catalogAction = url.pathname.match(/^\/api\/geek-content-creator-v2\/(knowledge|brand-kits|audiences|style-guides|products)\/(?:versions\/)?([^/]+)\/(review|approve|deprecate|revoke|refresh)$/);
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
    const blockingFindings = condition === "revoked"
      ? [{ id: "blocked-revoked", severity: "blocking", code: "revoked", message: "Editorial Handbook version is revoked." }]
      : condition === "permission"
        ? [{ id: "blocked-permission", severity: "blocking", code: "permission_denied", message: "You no longer have access to the selected Audience." }]
        : condition === "processing"
          ? [{ id: "blocked-processing", severity: "blocking", code: "not_ready", message: "A selected attachment is still processing." }]
          : [];
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

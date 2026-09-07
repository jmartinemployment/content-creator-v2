import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";

const port = Number(process.argv[process.argv.indexOf("--port") + 1] || 4310);
const recordSeparator = "\x1e";
const fixtureQuote =
  "Deterministic content systems pair human approval gates with exact source attribution.";
const fixtureMarkdown = `# Reliable content operations\n\n${fixtureQuote}\n\nRetries remain bounded and observable.`;

let scenario;
let requests;
let sectionAttempts;
let sequence;
let job;
let sockets;
let history;

function reset() {
  scenario = { ragAvailable: true };
  requests = [];
  sectionAttempts = new Map();
  sequence = 0;
  history = [];
  job = {
    id: "job-1",
    status: "awaiting_brandkit_approval",
    stage: "BRANDKIT",
    contentType: "pillar",
    tabLabel: "Pillar",
    resultJson: null,
  };
  sockets = sockets || new Set();
}
reset();

function cors(headers = {}) {
  return {
    "access-control-allow-origin": "http://127.0.0.1:3004",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type,x-requested-with,x-signalr-user-agent",
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
  };
}

function sectionPayload() {
  return {
    sectionKey: "problem",
    heading: "Why reliability matters",
    job: "problem",
    wordCount: 12,
    usedFallbackStub: false,
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (url.pathname === "/__reset" && req.method === "POST") {
    reset();
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__scenario" && req.method === "POST") {
    scenario = { ...scenario, ...JSON.parse((await readBody(req)) || "{}") };
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
    if (authorization !== "Bearer e2e-access" && authorization !== "Bearer refreshed-access" && authorization !== "Bearer oauth-access") {
      return send(res, 401, { error: "fake platform requires bearer" });
    }
  }

  if (url.pathname === "/api/geek-content-creator-v2/non-json") {
    return send(res, 502, "upstream exploded", { "x-fake-upstream": "preserved" });
  }
  if (url.pathname === "/api/geek-content-creator-v2/echo") {
    return send(res, 200, { query: Object.fromEntries(url.searchParams), body: rawBody, authorization });
  }
  if (url.pathname === "/api/rag/echo") {
    return send(res, 200, { query: Object.fromEntries(url.searchParams), body: rawBody, authorization });
  }

  if (url.pathname === "/api/geek-content-creator-v2/project-site/runs/latest") {
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
  if (url.pathname === "/api/geek-content-creator-v2/jobs/job-1" && req.method === "GET") return send(res, 200, job);
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
    });
    broadcast(event("OutlineApproved", {}));
    const drafted = event("SectionDrafted", sectionPayload());
    broadcast(drafted);
    broadcast(drafted);
    broadcast(event("ValidationReport", {
      shipReady: true, outstandingIssues: false, reviewVerdict: "pass", reviewNotes: "Deterministic fixture",
      seoScore: 95, polishScore: 96, polishShipReady: true, geoScore: 94, seoChecks: [], geoChecks: [], overlapHits: [],
    }));
    broadcast(event("JobCompleted", { status: "ready" }));
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/api/geek-content-creator-v2/creates/create-1/ai-visibility/refresh") {
    return send(res, 200, { ready: true, createId: "create-1", score: 94, report: { seoScore: 95, geoScore: 94, geoChecks: [], publishedUrls: [] } });
  }

  if (url.pathname === "/api/rag/status") {
    return send(res, 200, scenario.ragAvailable
      ? { available: true, citeableGenerateAvailable: true, graphRetrievalAvailable: true, adTemplateIndexAvailable: true, entitySeeds: ["Evidence Engine"], longFormModel: "fake-o3", shortFormModel: "fake-4o" }
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

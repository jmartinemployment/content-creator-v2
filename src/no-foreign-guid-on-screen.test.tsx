import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import ProjectContentWorkspace from "@/components/content-creator/ProjectContentWorkspace";
import ProjectForm from "@/components/content-writer/ProjectForm";
import { findGuids } from "@/lib/guid";
import type { GccArtifact, GccArtifactVersion, GccGenerateJobEvent, GccProjectRun } from "@/services/gcc-api";
import type { GccProject } from "@/services/gcc-projects-api";

/**
 * No rendered page contains a GUID other than the project id and the labelled Run ID
 * (plans/fix-project-persistence.md, GF6, second test). The pages are rendered against a GeekAPI
 * answered from fixtures that carry every identifier the real one does -- client, create, job, brief
 * revision, artifacts, versions -- so anything that put one of them on the screen is caught here.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "44444444-4444-4444-8444-444444444444";
const PILLAR_ID = "55555555-5555-4555-8555-555555555555";
const TOOL_ID = "66666666-6666-4666-8666-666666666666";
const PILLAR_VERSION_ID = "77777777-7777-4777-8777-777777777777";
const TOOL_VERSION_ID = "88888888-8888-4888-8888-888888888888";
const CREATE_ID = "99999999-9999-4999-8999-999999999999";
const REVISION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const WRITTEN_AT = "2026-10-07T18:32:07Z";

const project: GccProject = {
  id: PROJECT_ID,
  clientId: CLIENT_ID,
  name: "Accounts Payable: Automated Approval Workflows",
  code: null,
  description: null,
  status: "active",
  siteUrl: "https://www.example.com/accounts-payable",
  projectSiteRunId: RUN_ID,
  department: null,
  partnerUrls: ["https://ramp.com", "https://www.bill.com"],
  competitorUrls: ["https://competitor.example"],
  startDate: "2026-10-01",
  dueDate: null,
  finishedDate: null,
  estimatedHours: null,
  budget: null,
  budgetCurrency: null,
  createdAtUtc: "2026-10-01T09:00:00Z",
  updatedAtUtc: WRITTEN_AT,
  briefJson: null,
  topic: "Accounts Payable: Automated Approval Workflows",
  researchJson: null,
  siteSectionJson: null,
  version: 3,
  briefSavedAtUtc: "2026-10-07T12:00:00Z",
};

const artifacts: GccArtifact[] = [
  {
    id: PILLAR_ID,
    createId: CREATE_ID,
    type: "pillar",
    name: "Accounts Payable: Automated Approval Workflows",
    status: "draft",
    createdAtUtc: "2026-10-05T10:46:32Z",
    updatedAtUtc: WRITTEN_AT,
    latestVersionNumber: 2,
    latestVersionAtUtc: WRITTEN_AT,
  },
  {
    // Nameless on purpose: the list once fell back to the first eight characters of the id.
    id: TOOL_ID,
    createId: CREATE_ID,
    type: "tool",
    name: "",
    status: "draft",
    createdAtUtc: WRITTEN_AT,
    updatedAtUtc: WRITTEN_AT,
    latestVersionNumber: 1,
    latestVersionAtUtc: WRITTEN_AT,
  },
];

function body(title: string): string {
  return JSON.stringify({
    title,
    summary: "Approval workflows that route invoices by rule rather than by inbox.",
    body: {
      lede: { paragraphs: [{ runs: [{ text: "Most approval delays are routing delays." }] }] },
      sections: [
        {
          heading: "Where approvals stall",
          paragraphs: [{ runs: [{ text: "An invoice waits on whoever is out of office." }] }],
        },
      ],
    },
  });
}

const versions: GccArtifactVersion[] = [
  {
    id: PILLAR_VERSION_ID,
    artifactId: PILLAR_ID,
    versionNumber: 2,
    bodyDocumentJson: body("Accounts Payable: Automated Approval Workflows"),
    metadataJson: JSON.stringify({
      generatedByProvider: "Anthropic",
      briefRevisionId: REVISION_ID,
      briefRevisionSavedAtUtc: "2026-10-07T12:00:00Z",
    }),
    createdAtUtc: WRITTEN_AT,
  },
  {
    id: TOOL_VERSION_ID,
    artifactId: TOOL_ID,
    versionNumber: 1,
    bodyDocumentJson: body("Ramp for Accounts Payable"),
    metadataJson: JSON.stringify({ generatedByProvider: "Anthropic", briefRevisionId: REVISION_ID }),
    createdAtUtc: WRITTEN_AT,
  },
];

// The record as GeekAPI stores it: PascalCase inside, the way run-display.ts reads it.
const latestRun: GccProjectRun = {
  jobId: JOB_ID,
  status: "ready",
  requestedTypes: ["pillar", "blog", "tool"],
  provider: "Anthropic",
  startedAtUtc: "2026-10-07T18:20:00Z",
  finishedAtUtc: WRITTEN_AT,
  briefRevisionSavedAtUtc: "2026-10-07T12:00:00Z",
  resultJson: JSON.stringify({
    Created: [
      { Artifact: { Id: PILLAR_ID, CreateId: CREATE_ID, Type: "pillar" }, Version: { Id: PILLAR_VERSION_ID, VersionNumber: 2 } },
      { Artifact: { Id: TOOL_ID, CreateId: CREATE_ID, Type: "tool" }, Version: { Id: TOOL_VERSION_ID, VersionNumber: 1 } },
    ],
    Refusals: ["blog: Anthropic response contained no text content block"],
    Warnings: ["pillar: never named Bill", "grounding: the Ramp crawl is 40 days old"],
    Preflight: [
      {
        ProductName: "Ramp",
        Host: "ramp.com",
        Ready: true,
        Coverage: "12 of 20 categories",
        PagesAttempted: 8,
        PagesFailed: 0,
        PopulatedCategories: 12,
        TotalCategories: 20,
        HasCapabilitySignal: true,
      },
      {
        ProductName: "Bill",
        Host: "www.bill.com",
        Ready: false,
        Coverage: "0 of 20 categories, no capability signal",
        PagesAttempted: 6,
        PagesFailed: 0,
        PopulatedCategories: 0,
        TotalCategories: 20,
        HasCapabilitySignal: false,
      },
    ],
  }),
  error: null,
};

const events: GccGenerateJobEvent[] = [
  {
    id: 1,
    jobId: JOB_ID,
    seq: 1,
    atUtc: "2026-10-07T18:20:00Z",
    kind: "started",
    piece: null,
    payloadJson: JSON.stringify({
      projectId: PROJECT_ID,
      createId: CREATE_ID,
      provider: "Anthropic",
      requestedTypes: ["pillar", "blog", "tool"],
      briefRevisionId: REVISION_ID,
      topic: project.topic,
    }),
  },
  {
    id: 2,
    jobId: JOB_ID,
    seq: 2,
    atUtc: "2026-10-07T18:21:00Z",
    kind: "call",
    piece: "blog",
    payloadJson: JSON.stringify({ model: "claude-sonnet-5", maxTokens: 4096, prompt: "Write the blog opening.", artifactId: PILLAR_ID }),
  },
  {
    id: 3,
    jobId: JOB_ID,
    seq: 3,
    atUtc: "2026-10-07T18:22:00Z",
    kind: "failure",
    piece: "blog",
    payloadJson: JSON.stringify({
      error: `Anthropic response contained no text content block (version ${TOOL_VERSION_ID})`,
    }),
  },
];

const seoReport = {
  targetKeyword: project.topic,
  score: 72,
  wordCount: 1800,
  sectionCount: 6,
  keywordDensityPercent: 1.2,
  checks: [{ id: "title", label: "Keyword in the title", passed: true, detail: "Present." }],
  applyFeedback: "",
};

const polishReport = {
  score: 80,
  shipReady: true,
  wordCount: 1800,
  sentenceCount: 90,
  avgSentenceWords: 20,
  checks: [{ id: "filler", label: "No filler", passed: true, detail: "None found." }],
  applyFeedback: "",
};

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** GeekAPI, answered from the fixtures. A path nothing here answers is remembered and fails the test. */
function installGeekApi(): { unanswered: string[] } {
  const unanswered: string[] = [];
  const base = `/api/cw/api/geek-content-creator`;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    if (path === `${base}/projects/${PROJECT_ID}`) return json(project);
    if (path === `${base}/projects/${PROJECT_ID}/artifacts`) return json(artifacts);
    if (path === `${base}/projects/${PROJECT_ID}/generate/latest`) return json({ run: latestRun });
    if (path === `${base}/projects/${PROJECT_ID}/generate/${JOB_ID}/events`) {
      return json({ jobId: JOB_ID, status: "ready", error: null, events });
    }
    if (path.startsWith(`${base}/versions?artifactId=`)) {
      const artifactId = decodeURIComponent(path.slice(`${base}/versions?artifactId=`.length));
      return json(versions.filter((v) => v.artifactId === artifactId));
    }
    if (/\/versions\/[^/]+\/seo\?/.test(path)) return json(seoReport);
    if (/\/versions\/[^/]+\/polish$/.test(path)) return json(polishReport);
    if (path === "/api/cw/api/rag/hosts-indexed") {
      const { urls } = JSON.parse(String(init?.body)) as { urls: string[] };
      return json({
        results: urls.map((u) => ({
          url: u,
          host: new URL(u).host,
          indexed: true,
          runId: RUN_ID,
          usable: true,
          reason: null,
          pages: 120,
          chunks: 900,
        })),
      });
    }
    unanswered.push(path);
    return new Response("not answered by the test", { status: 500 });
  };
  return { unanswered };
}

/** Every GUID in the rendered page, text and attributes alike. */
function guidsOnScreen(): string[] {
  return findGuids(document.body.innerHTML);
}

/**
 * Where the Run ID appears, it is labelled: the text around it begins "Run". Returns the labels that
 * do not, so the failure says what was printed.
 */
function unlabelledRunIds(): string[] {
  const offenders: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.toLowerCase().includes(RUN_ID)) continue;
    const around = node.parentElement?.parentElement?.textContent ?? "";
    if (!/^\s*Run\b/.test(around)) offenders.push(around.slice(0, 120));
  }
  return offenders;
}

test("Brief & Generate shows no GUID but the project's: drafts, the last run, its refusals and its record", async (t) => {
  t.after(cleanup);
  const api = installGeekApi();

  render(<ProjectContentWorkspace project={project} />);

  // The drafts, the run's report and the run's record have all loaded before the page is judged.
  await waitFor(() => assert.ok(screen.getByText(/Not written/)));
  await waitFor(() => assert.ok(screen.getByText(/Grounding \(1\)/)));
  await waitFor(() => assert.ok(screen.getByText(/3\. failure/)));
  await waitFor(() => assert.ok(screen.getByText(/Provided by Anthropic/)));

  assert.deepEqual(api.unanswered, [], "every request the page made was answered by the fixtures");

  const foreign = guidsOnScreen().filter((g) => g !== PROJECT_ID && g !== RUN_ID);
  assert.deepEqual(foreign, [], "a GUID other than the project's or the Run ID is on the page");
  assert.deepEqual(unlabelledRunIds(), []);

  // The record is on the page with its identifiers left out, and the grounding warning sits in its own
  // block rather than under "Written with a gap".
  assert.ok(screen.getByText(/"provider": "Anthropic"/));
  assert.ok(screen.getByText(/no text content block \(version \(id\)\)/));
  assert.ok(screen.getByText(/the Ramp crawl is 40 days old/));
  assert.ok(screen.getByText(/Written with a gap \(1\)/));
});

test("Profile shows the Run ID labelled, and no other GUID but the project's", async (t) => {
  t.after(cleanup);
  const api = installGeekApi();

  render(<ProjectForm clientId={CLIENT_ID} project={project} onCreated={() => undefined} />);

  await waitFor(() => assert.ok(screen.getByText(RUN_ID)));

  assert.deepEqual(api.unanswered, []);
  const foreign = guidsOnScreen().filter((g) => g !== PROJECT_ID && g !== RUN_ID);
  assert.deepEqual(foreign, [], "a GUID other than the project's or the Run ID is on the page");
  assert.deepEqual(unlabelledRunIds(), []);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ProjectContentWorkspace from "@/components/content-creator/ProjectContentWorkspace";
import {
  AUDIENCE_SEGMENTS,
  BUYING_STAGES,
  CONTENT_ANGLES,
  PRIMARY_INTENTS,
  TONES_OF_VOICE,
} from "@/lib/content-creator/brief-catalog";
import { findGuids } from "@/lib/guid";
import type { GccArtifact, GccArtifactVersion, GccGenerateJobEvent, GccProjectRun } from "@/services/gcc-api";
import type { GccProject } from "@/services/gcc-projects-api";

/**
 * Repurpose on the page (GeekBackend plans/use-everything.md, step 5). An email, a social post and an
 * ad are written from an approved pillar, blog or tool page and by nothing else, so: Generate's list
 * does not offer them, an approved page does, a page that is not approved says why not, a piece says
 * which page it came from, and Generate says what a ticked page takes with it.
 *
 * The page is rendered against a GeekAPI answered from fixtures, as in
 * no-foreign-guid-on-screen.test.tsx. Nothing here follows a run on the hub: the Repurpose that is
 * pressed is refused by the server, which is the one outcome that needs no connection.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const REPURPOSE_JOB_ID = "44444444-4444-4444-8444-444444444444";
const PILLAR_ID = "55555555-5555-4555-8555-555555555555";
const BLOG_ID = "66666666-6666-4666-8666-666666666666";
const TOOL_ID = "77777777-7777-4777-8777-777777777777";
const PILLAR_EMAIL_ID = "88888888-8888-4888-8888-888888888888";
const TOOL_EMAIL_ID = "99999999-9999-4999-8999-999999999999";
const CREATE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_JOB_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const KEYWORD = "Accounts Payable: Automated Approval Workflows";
const WRITTEN_AT = "2026-10-12T18:32:07Z";

const brief = {
  primaryIntent: PRIMARY_INTENTS[0].value,
  buyingStage: BUYING_STAGES[0].value,
  audienceSegment: AUDIENCE_SEGMENTS[0].value,
  audienceNotes: "Controllers at companies of 50 to 500 people.",
  angle: CONTENT_ANGLES[0].value,
  toneOfVoice: TONES_OF_VOICE[0].value,
};

const project: GccProject = {
  id: PROJECT_ID,
  clientId: CLIENT_ID,
  name: KEYWORD,
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
  briefJson: JSON.stringify(brief),
  topic: KEYWORD,
  researchJson: null,
  siteSectionJson: null,
  version: 3,
  briefSavedAtUtc: "2026-10-12T12:00:00Z",
};

function page(id: string, type: string, name: string, status: string, parentArtifactId: string | null = null): GccArtifact {
  return {
    id,
    createId: CREATE_ID,
    parentArtifactId,
    type,
    name,
    status,
    createdAtUtc: WRITTEN_AT,
    updatedAtUtc: WRITTEN_AT,
    latestVersionNumber: 1,
    latestVersionAtUtc: WRITTEN_AT,
  };
}

// The pillar and the tool page are approved; the blog is not. A piece carries its page's name.
const artifacts: GccArtifact[] = [
  page(PILLAR_ID, "pillar", KEYWORD, "approved"),
  page(BLOG_ID, "blog", KEYWORD, "draft"),
  page(TOOL_ID, "tool", "Ramp", "approved"),
  page(PILLAR_EMAIL_ID, "email-cold-outreach", KEYWORD, "draft", PILLAR_ID),
  page(TOOL_EMAIL_ID, "email-cold-outreach", "Ramp", "draft", TOOL_ID),
];

function pageBody(title: string): string {
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

function emailBody(subject: string): string {
  return JSON.stringify({
    subject,
    body: "Most approval delays are routing delays.\n\nHere is what routing by rule changes.",
    ctaLabel: "Book a consultation",
    imagePrompt: { prompt: "A finance team at a shared desk, late afternoon light." },
  });
}

const bodies: Record<string, string> = {
  [PILLAR_ID]: pageBody(KEYWORD),
  [BLOG_ID]: pageBody(KEYWORD),
  [TOOL_ID]: pageBody(`Ramp: ${KEYWORD}`),
  [PILLAR_EMAIL_ID]: emailBody("Your approvals are waiting on one inbox"),
  [TOOL_EMAIL_ID]: emailBody("What Ramp routes by rule"),
};

function versionsOf(artifactId: string): GccArtifactVersion[] {
  if (!bodies[artifactId]) return [];
  return [
    {
      // A version id is the artifact's, reversed in its last block: distinct, and never on screen.
      id: artifactId.replace(/.{12}$/, "cccccccccccc"),
      artifactId,
      versionNumber: 1,
      bodyDocumentJson: bodies[artifactId],
      metadataJson: JSON.stringify({ generatedByProvider: "OpenAi", briefRevisionSavedAtUtc: "2026-10-12T12:00:00Z" }),
      createdAtUtc: WRITTEN_AT,
    },
  ];
}

// The pillar's last Repurpose, as GeekAPI stores its record: it saved the email and refused the post.
const SOCIAL_REFUSAL =
  "social: Refused: the social post states a figure the page it was written from does not: 75%. Nothing was saved for it.";
const pillarRepurpose: GccProjectRun = {
  jobId: REPURPOSE_JOB_ID,
  status: "ready",
  requestedTypes: ["email-cold-outreach", "social"],
  provider: "OpenAi",
  startedAtUtc: "2026-10-12T18:31:00Z",
  finishedAtUtc: WRITTEN_AT,
  briefRevisionSavedAtUtc: "2026-10-12T12:00:00Z",
  resultJson: JSON.stringify({
    created: [{ artifact: { Id: PILLAR_EMAIL_ID, CreateId: CREATE_ID, Type: "email-cold-outreach" } }],
    refusals: [SOCIAL_REFUSAL],
    warnings: [],
  }),
  error: null,
  sourcePageId: PILLAR_ID,
};

const events: GccGenerateJobEvent[] = [
  {
    id: 1,
    jobId: REPURPOSE_JOB_ID,
    seq: 1,
    atUtc: "2026-10-12T18:31:00Z",
    kind: "outcome",
    piece: "social",
    payloadJson: JSON.stringify({ type: "social", error: SOCIAL_REFUSAL, artifactId: PILLAR_ID }),
  },
];

const seoReport = {
  targetKeyword: KEYWORD,
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

/** What the server says to a second run while one is going: it names that run by its id. */
const ALREADY_RUNNING =
  `A Generate is already running on this project (job ${OTHER_JOB_ID}, started 2026-10-12 18:40:00Z for pillar). ` +
  "Nothing was started -- wait for it to finish.";

/**
 * GeekAPI, answered from the fixtures. A path nothing here answers is remembered and fails the test;
 * every Repurpose asked for is remembered with what was sent, and refused as a second run is.
 */
function installGeekApi(): { unanswered: string[]; repurposes: { path: string; body: unknown }[] } {
  const unanswered: string[] = [];
  const repurposes: { path: string; body: unknown }[] = [];
  const base = `/api/cw/api/geek-content-creator`;
  const projectBase = `${base}/projects/${PROJECT_ID}`;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "POST" && /\/pages\/[^/]+\/repurpose$/.test(path)) {
      repurposes.push({ path, body: JSON.parse(String(init?.body)) });
      return new Response(ALREADY_RUNNING, { status: 409 });
    }
    if (path === projectBase) return json(project);
    if (path === `${projectBase}/artifacts`) return json(artifacts);
    if (path === `${projectBase}/generate/latest`) return json({ run: null });
    if (path === `${projectBase}/pages/${PILLAR_ID}/repurpose/latest`) return json({ run: pillarRepurpose });
    if (path === `${projectBase}/pages/${TOOL_ID}/repurpose/latest`) return json({ run: null });
    if (path === `${projectBase}/generate/${REPURPOSE_JOB_ID}/events`) {
      return json({ jobId: REPURPOSE_JOB_ID, status: "ready", error: null, events });
    }
    if (path.startsWith(`${base}/versions?artifactId=`)) {
      return json(versionsOf(decodeURIComponent(path.slice(`${base}/versions?artifactId=`.length))));
    }
    if (/\/versions\/[^/]+\/seo\?/.test(path)) return json(seoReport);
    if (/\/versions\/[^/]+\/polish$/.test(path)) return json(polishReport);
    unanswered.push(`${method} ${path}`);
    return new Response("not answered by the test", { status: 500 });
  };
  return { unanswered, repurposes };
}

const heading = (name: string | RegExp) => screen.getByRole("heading", { level: 3, name });
const tab = (name: RegExp) => screen.getByRole("tab", { name });

/** The page as it opens: on the pillar, with the pillar's last Repurpose read back. */
async function openOnThePillar() {
  const api = installGeekApi();
  render(<ProjectContentWorkspace project={project} view="generate" />);
  await waitFor(() => assert.ok(heading("Repurpose")));
  await waitFor(() => assert.ok(screen.getByText(/The last Repurpose of this page finished/)));
  return api;
}

test("Generate's list does not offer an email, a social post or an ad, and says where they are written", async (t) => {
  t.after(cleanup);
  const api = await openOnThePillar();

  const list = within(screen.getByRole("group", { name: "Content type" }));
  for (const offered of ["Pillar", "Blog", "Tool page", "Image prompt"]) {
    assert.ok(list.getByRole("checkbox", { name: offered }), `${offered} is on Generate's list`);
  }
  for (const piece of ["Email — cold outreach", "Social", "Ads"]) {
    assert.equal(list.queryByRole("checkbox", { name: piece }), null, `${piece} is not on Generate's list`);
  }
  assert.ok(
    list.getByText(/Email — cold outreach, Social, Ads are not written by Generate\./),
    "the list says the three are written elsewhere, and where",
  );

  // Their tabs stay: what was written from a page is read there.
  assert.ok(tab(/^Email — cold outreach \(2\)$/));
  assert.ok(tab(/^Social$/));
  assert.ok(tab(/^Ads$/));

  assert.deepEqual(api.unanswered, [], "every request the page made was answered by the fixtures");
});

test("an approved page offers Repurpose, lists its pieces and shows what its last Repurpose said", async (t) => {
  t.after(cleanup);
  const api = await openOnThePillar();

  const offered = within(screen.getByRole("group", { name: "Write from this page" }));
  assert.equal(offered.getAllByRole("checkbox").length, 3);
  // The pillar already has an email: ticking it replaces that one, and the page says so.
  assert.ok(offered.getByRole("checkbox", { name: /^Email — cold outreach\s*— replaces the one written/ }));
  assert.ok(offered.getByRole("checkbox", { name: "Social" }));
  assert.ok(offered.getByRole("checkbox", { name: "Ads" }));

  // The last Repurpose of this page, read back: when, what it left, what it refused, and its record.
  assert.ok(screen.getByText(/It saved 1 piece, listed below\./));
  assert.ok(screen.getByText(/Not written \(1\)/));
  assert.ok(screen.getByText(SOCIAL_REFUSAL));
  await waitFor(() => assert.ok(screen.getByText(/1\. outcome · social/)));

  // The piece it left is a click away, named for what it is.
  const written = screen.getByText("Written from this page").parentElement as HTMLElement;
  const email = within(written).getByRole("button", { name: /^Email — cold outreach/ });

  // Nothing ticked: nothing to press.
  const press = screen.getByRole("button", { name: "Repurpose" }) as HTMLButtonElement;
  assert.equal(press.disabled, true);
  assert.ok(screen.getByText("Choose at least one piece to write."));

  fireEvent.click(offered.getByRole("checkbox", { name: "Ads" }));
  fireEvent.click(offered.getByRole("checkbox", { name: "Social" }));
  assert.equal(press.disabled, false);
  fireEvent.click(press);

  // Asked of the page on screen, with the ticked pieces in the order they are offered. The server
  // refuses a second run by naming the first with its id; the page says so without the id.
  await waitFor(() => assert.ok(screen.getByText(/A Generate is already running on this project \(job \(id\)/)));
  assert.deepEqual(api.repurposes, [
    {
      path: `/api/cw/api/geek-content-creator/projects/${PROJECT_ID}/pages/${PILLAR_ID}/repurpose`,
      body: { provider: "OpenAi", outputTypes: ["social", "ads"] },
    },
  ]);
  // Refused before anything started: nothing is running, and the button can be pressed again.
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal((screen.getByRole("button", { name: "Repurpose" }) as HTMLButtonElement).disabled, false);

  const foreign = findGuids(document.body.innerHTML).filter((g) => g !== PROJECT_ID && g !== RUN_ID);
  assert.deepEqual(foreign, [], "a GUID other than the project's or the Run ID is on the page");

  // The piece opens from the page it was written from, and says which page that is.
  fireEvent.click(email);
  await waitFor(() => assert.ok(screen.getByText("Your approvals are waiting on one inbox")));
  assert.ok(screen.getByText("Subject:"));
  assert.ok(screen.getByText("Button text:"));
  assert.ok(screen.getByText(/Written from/));
  // A piece is not a page to write from.
  assert.equal(screen.queryByRole("heading", { level: 3, name: "Repurpose" }), null);

  // And the way back to its page is on it.
  fireEvent.click(screen.getByRole("button", { name: "the Pillar" }));
  await waitFor(() => assert.ok(heading("Repurpose")));

  assert.deepEqual(api.unanswered, [], "every request the page made was answered by the fixtures");
});

test("a page that is not approved says to approve it first, and offers nothing to press", async (t) => {
  t.after(cleanup);
  const api = await openOnThePillar();

  fireEvent.click(tab(/^Blog$/));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "Approve content" })));

  assert.ok(heading("Repurpose"));
  assert.ok(screen.getByText(/Approve this page first\. A piece is written from a page that has been approved\./));
  assert.equal(screen.queryByRole("button", { name: "Repurpose" }), null);
  assert.equal(screen.queryByRole("group", { name: "Write from this page" }), null);
  // The pillar's report is the pillar's: it is not shown under the blog.
  assert.equal(screen.queryByText(/The last Repurpose of this page finished/), null);

  // No Repurpose is read for a page that cannot have one.
  assert.deepEqual(api.unanswered, []);
});

test("each piece in a tab is named for the page it was written from", async (t) => {
  t.after(cleanup);
  const api = await openOnThePillar();

  // Two emails, one from the pillar and one from a tool page. The pillar's carries the keyword as
  // its name, as the blog's would: the buttons say the page.
  fireEvent.click(tab(/^Email — cold outreach \(2\)$/));
  const pieces = within(screen.getByRole("tablist", { name: "Email — cold outreach pages" }));
  assert.ok(pieces.getByRole("tab", { name: /^From the Pillar/ }));
  assert.ok(pieces.getByRole("tab", { name: /^From the Tool page “Ramp”/ }));

  fireEvent.click(pieces.getByRole("tab", { name: /^From the Tool page “Ramp”/ }));
  await waitFor(() => assert.ok(screen.getByText("What Ramp routes by rule")));
  assert.ok(screen.getByRole("button", { name: "the Tool page “Ramp”" }));

  // A tab with nothing in it says how its pieces are made, not to tick it on Generate.
  fireEvent.click(tab(/^Social$/));
  await waitFor(() =>
    assert.ok(screen.getByText(/No Social yet for this project\. It is written from an approved Pillar, Blog or Tool page/)),
  );

  assert.deepEqual(api.unanswered, []);
});

test("Generate says how many pieces a ticked page takes with it", async (t) => {
  t.after(cleanup);
  const api = await openOnThePillar();
  const list = within(screen.getByRole("group", { name: "Content type" }));
  const deleted = () => screen.queryByText(/deletes the \d+ pieces? Repurpose wrote/);

  assert.equal(deleted(), null, "nothing ticked: nothing is said");

  fireEvent.click(list.getByRole("checkbox", { name: "Blog" }));
  assert.equal(deleted(), null, "a page with no pieces: nothing is said");

  fireEvent.click(list.getByRole("checkbox", { name: "Pillar" }));
  assert.ok(screen.getByText("Writing the Pillar again deletes the 1 piece Repurpose wrote from it."));

  fireEvent.click(list.getByRole("checkbox", { name: "Tool page" }));
  assert.ok(
    screen.getByText(
      "Writing these pages again deletes the 2 pieces Repurpose wrote from them: 1 from the Pillar, 1 from the Tool page “Ramp”.",
    ),
  );

  assert.deepEqual(api.unanswered, []);
});

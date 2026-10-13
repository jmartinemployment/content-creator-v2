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
import { ALWAYS_SHOWN_TYPES } from "@/lib/content-creator/generated-content-set";
import { isContentTypeDisabled, isDeckType } from "@/lib/content-types";
import { findGuids } from "@/lib/guid";
import type { GccArtifact, GccArtifactVersion } from "@/services/gcc-api";
import type { GccProject } from "@/services/gcc-projects-api";

/**
 * A "PDF / LinkedIn document" on the page (GeekBackend plans/enable-pdf.md, step 5). It can be ticked
 * on Generate's list like "Pillar"; its tab shows the slides, the post under them and the first
 * comment under the post; it is downloaded as a PDF and not as an HTML page; and it is not scored for
 * search, so the page asks the server for no score of it.
 *
 * The page is rendered against a GeekAPI answered from fixtures, as in repurpose-on-screen.test.tsx.
 * A request nothing here answers fails the test, which is how "asks for no score" is held.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const PILLAR_ID = "55555555-5555-4555-8555-555555555555";
const DECK_ID = "66666666-6666-4666-8666-666666666666";
const CREATE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const KEYWORD = "Accounts Payable: Automated Approval Workflows";
const WRITTEN_AT = "2026-10-13T18:32:07Z";
const DECK_TITLE = "The close that runs on one spreadsheet";

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
  competitorUrls: [],
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
  briefSavedAtUtc: "2026-10-13T12:00:00Z",
};

function page(id: string, type: string, status: string): GccArtifact {
  return {
    id,
    createId: CREATE_ID,
    parentArtifactId: null,
    type,
    name: KEYWORD,
    status,
    createdAtUtc: WRITTEN_AT,
    updatedAtUtc: WRITTEN_AT,
    latestVersionNumber: 1,
    latestVersionAtUtc: WRITTEN_AT,
  };
}

const pillar = page(PILLAR_ID, "pillar", "approved");
const deck = page(DECK_ID, "linkedin-document", "draft");

const pillarBody = JSON.stringify({
  title: KEYWORD,
  summary: "Approval workflows that route invoices by rule rather than by inbox.",
  body: {
    lede: { paragraphs: [{ runs: [{ text: "Most approval delays are routing delays." }] }] },
    sections: [{ heading: "Where approvals stall", paragraphs: [{ runs: [{ text: "An invoice waits on whoever is out." }] }] }],
  },
});

/** The deck as GeekAPI saves it: the cover is the document's opening and each slide a section. */
const deckBody = JSON.stringify({
  title: DECK_TITLE,
  caption: "Most controllers lose the first week of the month to the close.\n\nThe slides walk through where the hours go.",
  firstComment:
    "Book your free consultation: https://geekatyourspot.com/#consultationAppointment2xl\n\nRamp: https://geekatyourspot.com/tools/accounting/ramp\nBill: https://geekatyourspot.com/tools/accounting/bill",
  links: [],
  slides: [
    { kind: "cover", partner: null },
    { kind: "problem", partner: null },
    { kind: "partner", partner: "Ramp" },
    { kind: "partner", partner: "Bill" },
    { kind: "approach", partner: null },
    { kind: "next", partner: null },
  ],
  warnings: ["Slide 3 (\"Ramp\") does not name Ramp."],
  body: {
    lede: { heading: DECK_TITLE, paragraphs: [{ type: "text", runs: [{ text: "Where the first week of the month goes." }] }] },
    sections: [
      { heading: "The close waits on one file", paragraphs: [{ type: "list", items: [[{ text: "One person holds the file." }]] }] },
      { heading: "Approvals that route themselves", paragraphs: [{ type: "list", items: [[{ text: "Each bill is routed by rule." }]] }] },
      { heading: "Bills paid from one queue", paragraphs: [{ type: "list", items: [[{ text: "Bill pays each approved bill." }]] }] },
      { heading: "How the work is done", paragraphs: [{ type: "list", items: [[{ text: "Map the close, then automate it." }]] }] },
      {
        heading: "Answer these questions when booking your free consultation",
        paragraphs: [
          { type: "list", items: [[{ text: "How many accounts are reconciled by hand?" }]] },
          { type: "text", runs: [{ text: "geekatyourspot.com" }] },
        ],
      },
    ],
  },
});

const bodies: Record<string, string> = { [PILLAR_ID]: pillarBody, [DECK_ID]: deckBody };

/** A version's id is its page's with another last block: distinct, and never on screen. */
const versionIdOf = (artifactId: string) => artifactId.replace(/.{12}$/, "cccccccccccc");

function versionsOf(artifactId: string): GccArtifactVersion[] {
  if (!bodies[artifactId]) return [];
  return [
    {
      id: versionIdOf(artifactId),
      artifactId,
      versionNumber: 1,
      bodyDocumentJson: bodies[artifactId],
      metadataJson: JSON.stringify({ generatedByProvider: "OpenAi", briefRevisionSavedAtUtc: "2026-10-13T12:00:00Z" }),
      createdAtUtc: WRITTEN_AT,
    },
  ];
}

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

/**
 * GeekAPI, answered from the fixtures. A score is answered for the pillar and for nothing else, so
 * a score asked of the deck is a request nothing answers and fails the test.
 */
function installGeekApi(held: GccArtifact[]): { unanswered: string[]; pdfs: string[] } {
  const unanswered: string[] = [];
  const pdfs: string[] = [];
  const base = `/api/cw/api/geek-content-creator`;
  const projectBase = `${base}/projects/${PROJECT_ID}`;
  const pillarVersion = `${base}/versions/${versionIdOf(PILLAR_ID)}`;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const method = (init?.method ?? "GET").toUpperCase();

    if (path === projectBase) return json(project);
    if (path === `${projectBase}/artifacts`) return json(held);
    if (path === `${projectBase}/generate/latest`) return json({ run: null });
    if (path === `${projectBase}/pages/${PILLAR_ID}/repurpose/latest`) return json({ run: null });
    if (path.startsWith(`${base}/versions?artifactId=`)) {
      return json(versionsOf(decodeURIComponent(path.slice(`${base}/versions?artifactId=`.length))));
    }
    if (path.startsWith(`${pillarVersion}/seo?`)) return json(seoReport);
    if (path === `${pillarVersion}/polish`) return json(polishReport);
    if (path === `${base}/versions/${versionIdOf(DECK_ID)}/pdf`) {
      pdfs.push(path);
      return new Response("%PDF-1.7 a deck", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="the-close-that-runs-on-one-spreadsheet.pdf"',
        },
      });
    }
    unanswered.push(`${method} ${path}`);
    return new Response("not answered by the test", { status: 500 });
  };
  return { unanswered, pdfs };
}

/** What a download handed the browser: the name of each file saved by a link the page pressed. */
function catchDownloads(t: { after: (fn: () => void) => void }): string[] {
  const saved: string[] = [];
  const press = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    saved.push(this.download);
  };
  t.after(() => {
    HTMLAnchorElement.prototype.click = press;
  });
  return saved;
}

const heading = (name: string | RegExp) => screen.queryByRole("heading", { level: 3, name });
const tab = (name: RegExp) => screen.getByRole("tab", { name });

test("the PDF / LinkedIn document is a type of its own and is no longer disabled", () => {
  assert.equal(isContentTypeDisabled("linkedin-document"), false);
  assert.ok(ALWAYS_SHOWN_TYPES.includes("linkedin-document"), "it has a tab whether or not the project has a deck");
  assert.equal(isDeckType("linkedin-document"), true);
  assert.equal(isDeckType("linkedinDocument"), true);
  assert.equal(isDeckType("linkedin"), false);
  assert.equal(isDeckType("pillar"), false);
  assert.equal(isDeckType(null), false);
  // The twelve with no writer are still held.
  assert.equal(isContentTypeDisabled("whitepaper"), true);
});

test("Generate's list offers the PDF / LinkedIn document, and a project with none has an empty tab for it", async (t) => {
  t.after(cleanup);
  const api = installGeekApi([pillar]);
  render(<ProjectContentWorkspace project={project} view="generate" />);
  await waitFor(() => assert.ok(heading("Approve & export")));

  const list = within(screen.getByRole("group", { name: "Content type" }));
  const box = list.getByRole("checkbox", { name: "PDF / LinkedIn document" }) as HTMLInputElement;
  assert.equal(box.disabled, false, "it can be ticked");
  assert.equal(box.checked, false, "and is not ticked until it is asked for");
  fireEvent.click(box);
  assert.equal(box.checked, true);

  fireEvent.click(tab(/^PDF \/ LinkedIn document$/));
  await waitFor(() =>
    assert.ok(screen.getByText("No PDF / LinkedIn document yet for this project. Pick it as an output type, then Generate above.")),
  );

  assert.deepEqual(api.unanswered, [], "every request the page made was answered by the fixtures");
});

test("a deck's tab shows its slides, its post and its first comment, and asks for no score", async (t) => {
  t.after(cleanup);
  const api = installGeekApi([pillar, deck]);
  render(<ProjectContentWorkspace project={project} view="generate" />);
  await waitFor(() => assert.ok(heading("Approve & export")));

  fireEvent.click(tab(/^PDF \/ LinkedIn document$/));
  await waitFor(() => assert.ok(screen.getByText("The LinkedIn post")));

  // Every slide, numbered, with what it is: the cover, the problem, a slide for each partner, the
  // approach, what to do next.
  for (const [n, what] of [[1, "Cover"], [2, "The problem"], [3, "Ramp"], [4, "Bill"], [5, "The approach"], [6, "What to do next"]]) {
    const numbered = screen.getByText(`Slide ${n} of 6`).parentElement as HTMLElement;
    assert.match(numbered.textContent ?? "", new RegExp(`^Slide ${n} of 6 · ${what}$`));
  }
  assert.ok(screen.getByRole("heading", { level: 3, name: DECK_TITLE }));
  assert.ok(screen.getByText("Each bill is routed by rule."));
  assert.ok(screen.getByText("Answer these questions when booking your free consultation"));

  // The post under the slides, and the first comment under the post, in that order.
  const drawn = document.body.textContent ?? "";
  const last = drawn.indexOf("How many accounts are reconciled by hand?");
  const post = drawn.indexOf("The LinkedIn post");
  const comment = drawn.indexOf("The first comment");
  assert.ok(last >= 0 && post > last && comment > post, "the slides, then the post, then the first comment");
  assert.ok(screen.getByText("Most controllers lose the first week of the month to the close."));
  assert.ok(screen.getByText("Paste this as the first comment under the post. The post itself carries no link."));
  assert.ok(screen.getByText(/Ramp: https:\/\/geekatyourspot\.com\/tools\/accounting\/ramp/));

  // What the deck is, stated and not judged: no word target, as a page has.
  assert.ok(screen.getByText("6 slides. The post is 20 words, 108 characters."));
  assert.equal(screen.queryByText(/^Target:/), null);

  // What it was saved with is still said.
  assert.ok(screen.getByText("Written with a gap (1)"));
  assert.ok(screen.getByText('Slide 3 ("Ramp") does not name Ramp.'));

  // A deck is not scored for search and no piece is written from one.
  assert.equal(heading("On-page SEO & polish"), null);
  assert.equal(heading("Repurpose"), null);

  const foreign = findGuids(document.body.innerHTML).filter((g) => g !== PROJECT_ID && g !== RUN_ID);
  assert.deepEqual(foreign, [], "a GUID other than the project's or the Run ID is on the page");
  assert.deepEqual(api.unanswered, [], "the page asked for nothing the fixtures do not answer: no score of the deck");
});

test("a deck is downloaded as its PDF, by the name the server gives it", async (t) => {
  t.after(cleanup);
  const saved = catchDownloads(t);
  const api = installGeekApi([pillar, deck]);
  render(<ProjectContentWorkspace project={project} view="generate" />);
  await waitFor(() => assert.ok(heading("Approve & export")));
  fireEvent.click(tab(/^PDF \/ LinkedIn document$/));
  await waitFor(() => assert.ok(screen.getByText("The LinkedIn post")));

  assert.ok(
    screen.getByText(
      /Approve marks this deck approved on the server\. Download PDF downloads the slides as the PDF you post, one slide a page; Export HTML downloads every page as a zip, with this deck.s PDF, its post and its first comment in it\./,
    ),
  );
  assert.equal(screen.queryByRole("button", { name: "Export this page (.html)" }), null, "a deck is not a page of the site");
  assert.ok(screen.getByRole("button", { name: "Export HTML (.zip)" }));

  fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
  await waitFor(() => assert.ok(screen.getByText("PDF downloaded.")));

  assert.equal(api.pdfs.length, 1, "the PDF was asked for once, by the deck's version");
  assert.deepEqual(saved, ["the-close-that-runs-on-one-spreadsheet.pdf"]);
  assert.deepEqual(api.unanswered, []);
});

test("a page keeps its own export and its scores beside a deck", async (t) => {
  t.after(cleanup);
  const api = installGeekApi([pillar, deck]);
  render(<ProjectContentWorkspace project={project} view="generate" />);

  // The page opens on the pillar.
  await waitFor(() => assert.ok(heading("On-page SEO & polish")));
  await waitFor(() => assert.ok(screen.getByText(/SEO score 72/)));
  assert.ok(screen.getByRole("button", { name: "Export this page (.html)" }));
  assert.equal(screen.queryByRole("button", { name: "Download PDF" }), null);
  assert.equal(screen.queryByText("The LinkedIn post"), null);

  // To the deck and back: the scores are the pillar's again, and never the deck's.
  fireEvent.click(tab(/^PDF \/ LinkedIn document$/));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "Download PDF" })));
  assert.equal(screen.queryByText(/SEO score/), null);
  fireEvent.click(tab(/^Pillar/));
  await waitFor(() => assert.ok(screen.getByText(/SEO score 72/)));

  assert.deepEqual(api.unanswered, []);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ContentBriefPanel from "@/components/content-creator/ContentBriefPanel";
import type { SavedSerpParseResult } from "@/lib/content-creator/serp-lens";
import type { GccProject } from "@/services/gcc-projects-api";

/**
 * The brief's three FAQ boxes on the page (2026-10-13): "People Also Ask (direct entry, optional)",
 * "Blog FAQ (optional)" and each tool's "Tool page FAQ" are rows of a question and the operator's
 * own answer. Rendered against a GeekAPI answered from fixtures: a project whose brief was saved
 * before then, with questions alone, is opened, answered and saved, and what the Save sends is read.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const KEYWORD = "ai implementation";

const PAA = "People Also Ask (direct entry, optional)";
const BLOG = "Blog FAQ (optional)";
const TOOL = "Tool page FAQ";
const NO_ANSWER = "No answer entered. This question is left off the page until it has one.";

/** A brief as it was saved before 2026-10-13: lines in two boxes, an array of questions in the third. */
const savedBefore = {
  primaryIntent: "informational",
  buyingStage: "awareness",
  audienceSegment: "in_market",
  audienceNotes: "Operations leads at 50 to 500 person firms.",
  angle: "problem_solution",
  toneOfVoice: "consultant_professional",
  paaQuestions: "What is AI implementation?\nHow long does AI implementation take?",
  blogFaqQuestions: ["What does it cost to run?"],
  nicheFraming: {
    coreProblem: "Pilots never reach production.",
    perTool: {
      "ramp.com": { faqQuestions: "Does it sync with QuickBooks Online?\n" },
    },
  },
};

function project(brief: unknown): GccProject {
  return {
    id: PROJECT_ID,
    clientId: CLIENT_ID,
    name: KEYWORD,
    code: null,
    description: null,
    status: "active",
    siteUrl: "https://www.example.com/ai",
    projectSiteRunId: null,
    department: null,
    partnerUrls: ["https://ramp.com"],
    competitorUrls: [],
    startDate: "2026-10-01",
    dueDate: null,
    finishedDate: null,
    estimatedHours: null,
    budget: null,
    budgetCurrency: null,
    createdAtUtc: "2026-10-01T09:00:00Z",
    updatedAtUtc: "2026-10-12T12:00:00Z",
    briefJson: JSON.stringify(brief),
    topic: KEYWORD,
    researchJson: null,
    siteSectionJson: null,
    version: 3,
    briefSavedAtUtc: "2026-10-12T12:00:00Z",
  };
}

/** What a results page parses to: one question the brief already asks, and one it does not. */
const parsedSerp: SavedSerpParseResult = {
  organics: [],
  peopleAlsoAsk: [
    { question: "What is AI implementation?", likelyRelevant: true },
    { question: "How much does AI implementation cost?", likelyRelevant: true },
  ],
  relatedSearches: [],
  shape: {
    dominantFormats: [],
    titlePatterns: [],
    guidance: "",
    hasPeopleAlsoAsk: true,
    organicCount: 0,
    pageHint: null,
  },
  missingPaaLikelyPage2: false,
  parseWarning: null,
};

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

/**
 * GeekAPI, answered from the fixtures. Every Save is remembered with the brief it sent; a path
 * nothing here answers is remembered and fails the test.
 */
function installGeekApi(brief: unknown): { saves: Record<string, unknown>[]; unanswered: string[] } {
  const saves: Record<string, unknown>[] = [];
  const unanswered: string[] = [];
  const base = "/api/cw/api/geek-content-creator";
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "GET" && path === `${base}/projects/${PROJECT_ID}`) return json(project(brief));
    if (method === "PATCH" && path === `${base}/projects/${PROJECT_ID}/brief`) {
      const sent = JSON.parse(String(init?.body)) as { briefJson: string };
      saves.push(JSON.parse(sent.briefJson) as Record<string, unknown>);
      return json({ version: 4, revisionId: "rev", savedAtUtc: "2026-10-13T09:30:00Z", topic: KEYWORD });
    }
    if (method === "POST" && path === `${base}/serp/parse`) return json(parsedSerp);
    unanswered.push(`${method} ${path}`);
    return new Response("not answered by the test", { status: 500 });
  };
  return { saves, unanswered };
}

async function openBrief(brief: unknown) {
  const api = installGeekApi(brief);
  render(<ContentBriefPanel projectId={PROJECT_ID} provider="OpenAi" onBriefSaved={() => {}} />);
  await waitFor(() => assert.ok(screen.getByRole("group", { name: PAA })));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: /Ramp/ })));
  return api;
}

const box = (name: string) => within(screen.getByRole("group", { name }));
const questionsIn = (name: string) =>
  (box(name).queryAllByLabelText("Question") as HTMLInputElement[]).map((el) => el.value);
const answersIn = (name: string) =>
  (box(name).queryAllByLabelText("Answer") as HTMLTextAreaElement[]).map((el) => el.value);

test("a brief saved with questions alone opens as rows with no answer, in all three boxes, and says what a row is for", async (t) => {
  t.after(cleanup);
  const api = await openBrief(savedBefore);

  assert.deepEqual(questionsIn(PAA), ["What is AI implementation?", "How long does AI implementation take?"]);
  assert.deepEqual(answersIn(PAA), ["", ""]);
  assert.deepEqual(questionsIn(BLOG), ["What does it cost to run?"]);
  assert.deepEqual(answersIn(BLOG), [""]);
  // Every question is waiting for its answer, and says so.
  assert.equal(box(PAA).getAllByText(NO_ANSWER).length, 2);
  assert.equal(box(BLOG).getAllByText(NO_ANSWER).length, 1);

  assert.match(screen.getByRole("button", { name: /Ramp/ }).textContent ?? "", / · FAQ \(1 with no answer\) · /);
  fireEvent.click(screen.getByRole("button", { name: /Ramp/ }));
  assert.deepEqual(questionsIn(TOOL), ["Does it sync with QuickBooks Online?"]);
  assert.deepEqual(answersIn(TOOL), [""]);

  // The three boxes keep their names, and each says what is done with an answer.
  assert.ok(screen.getByText(PAA));
  assert.ok(screen.getByText(BLOG));
  assert.ok(screen.getByText(TOOL));
  assert.ok(
    screen.getByText(
      "Each question with your answer. The pillar's People Also Ask section says your answer in the Brief's voice. Nothing is searched for it. A question with no answer is left off the page and reported.",
    ),
  );
  assert.ok(
    screen.getByText(
      "Each question with your answer. Written at the end of the blog from your answer, in the Brief's voice. Nothing is searched for it. A question with no answer is left off the page and reported.",
    ),
  );
  assert.ok(
    screen.getByText(
      "Each question with your answer. Written on Ramp's page from your answer, in the Brief's voice. Nothing is searched for it. A question with no answer is left off the page and reported.",
    ),
  );
  assert.equal(screen.queryByText(/One question per line\. Answered/), null);
  assert.equal(screen.queryByText(/calls of eight/), null);

  // Opening it is not a change: nothing is unsaved, and nothing was sent.
  assert.doesNotMatch(screen.getByRole("status").textContent ?? "", /Unsaved changes/);
  assert.deepEqual(api.saves, []);
  assert.deepEqual(api.unanswered, []);
});

test("a Save sends each box as an array of a question and its answer, and only when Save is clicked", async (t) => {
  t.after(cleanup);
  const api = await openBrief(savedBefore);

  fireEvent.change(box(PAA).getAllByLabelText("Answer")[0], {
    target: { value: "  Putting a model to work on one process, with an owner.  " },
  });
  fireEvent.click(box(BLOG).getByRole("button", { name: "Add a question" }));
  fireEvent.change(box(BLOG).getAllByLabelText("Question")[1], { target: { value: " Who should own it? " } });
  fireEvent.change(box(BLOG).getAllByLabelText("Answer")[1], { target: { value: "The operations lead.\n" } });
  // Added and never typed in: not saved.
  fireEvent.click(box(BLOG).getByRole("button", { name: "Add a question" }));
  fireEvent.click(screen.getByRole("button", { name: /Ramp/ }));
  fireEvent.change(box(TOOL).getByLabelText("Answer"), {
    target: { value: "Yes. Payments sync to QuickBooks Online within the hour." },
  });

  // Typing saves nothing.
  assert.match(screen.getByRole("status").textContent ?? "", /Unsaved changes/);
  assert.deepEqual(api.saves, []);

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => assert.equal(api.saves.length, 1));
  await waitFor(() => assert.match(screen.getByRole("status").textContent ?? "", /Saved to the server at/));

  const saved = api.saves[0] as {
    paaQuestions: unknown;
    blogFaqQuestions: unknown;
    nicheFraming: { perTool: Record<string, { faqQuestions: unknown }> };
  };
  assert.deepEqual(saved.paaQuestions, [
    { question: "What is AI implementation?", answer: "Putting a model to work on one process, with an owner." },
    // A question with no answer is saved: it is the operator's, and GeekAPI reports it.
    { question: "How long does AI implementation take?", answer: "" },
  ]);
  assert.deepEqual(saved.blogFaqQuestions, [
    { question: "What does it cost to run?", answer: "" },
    { question: "Who should own it?", answer: "The operations lead." },
  ]);
  assert.deepEqual(saved.nicheFraming.perTool["ramp.com"].faqQuestions, [
    { question: "Does it sync with QuickBooks Online?", answer: "Yes. Payments sync to QuickBooks Online within the hour." },
  ]);
  // What is typed stays on the page as typed.
  assert.deepEqual(answersIn(PAA), ["  Putting a model to work on one process, with an owner.  ", ""]);
  assert.deepEqual(api.unanswered, []);
});

test("questions from a results page fill an empty box as rows with no answer", async (t) => {
  t.after(cleanup);
  await openBrief({ ...savedBefore, paaQuestions: "" });
  assert.deepEqual(questionsIn(PAA), []);

  fireEvent.change(screen.getByPlaceholderText("Or paste saved Google results HTML / text here"), {
    target: { value: "a saved results page" },
  });
  fireEvent.click(screen.getByText("Parse pasted HTML"));
  await waitFor(() => assert.ok(screen.getByText("Confirm questions for this brief")));
  fireEvent.click(screen.getByText("Confirm questions for this brief"));

  assert.deepEqual(questionsIn(PAA), ["What is AI implementation?", "How much does AI implementation cost?"]);
  assert.deepEqual(answersIn(PAA), ["", ""]);
  assert.equal(box(PAA).getAllByText(NO_ANSWER).length, 2);
  assert.equal(screen.queryByRole("button", { name: "Use SERP value" }), null);
});

test("questions from a results page replace typed rows only when asked, and a question in both keeps its answer", async (t) => {
  t.after(cleanup);
  await openBrief({
    ...savedBefore,
    paaQuestions: [
      { question: "What is AI implementation?", answer: "Putting a model to work on one process." },
      { question: "How long does AI implementation take?", answer: "Six to ten weeks." },
    ],
  });

  fireEvent.change(screen.getByPlaceholderText("Or paste saved Google results HTML / text here"), {
    target: { value: "a saved results page" },
  });
  fireEvent.click(screen.getByText("Parse pasted HTML"));
  await waitFor(() => assert.ok(screen.getByText("Confirm questions for this brief")));
  fireEvent.click(screen.getByText("Confirm questions for this brief"));

  // The box had rows, so nothing typed is touched and the offer is put to the operator.
  assert.deepEqual(questionsIn(PAA), ["What is AI implementation?", "How long does AI implementation take?"]);
  assert.deepEqual(answersIn(PAA), ["Putting a model to work on one process.", "Six to ten weeks."]);

  fireEvent.click(screen.getByRole("button", { name: "Use SERP value" }));

  assert.deepEqual(questionsIn(PAA), ["What is AI implementation?", "How much does AI implementation cost?"]);
  assert.deepEqual(answersIn(PAA), ["Putting a model to work on one process.", ""]);
  assert.equal(screen.queryByRole("button", { name: "Use SERP value" }), null);
});

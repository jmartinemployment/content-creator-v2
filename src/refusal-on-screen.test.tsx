import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import ProjectForm from "@/components/content-writer/ProjectForm";
import { refusalText } from "@/services/gcc-api";
import type { GccProject } from "@/services/gcc-projects-api";

/**
 * A refused request is shown as the sentence it carries, never as its JSON. GeekAPI refuses with
 * `{ "error": "..." }`, or with a document carrying a `title` when no route handled the failure, and
 * the form printed either as it came: on 2026-10-14 the Profile of "Cash Flow Forecasting: Automated
 * Enterprise Resource Planning" showed the whole document, trace id and exception type included,
 * under "Site URL". The tests until then answered every refusal in plain text, which GeekAPI's
 * routes do not send, so none of them saw it.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const SITE = "https://www.example.com/cash-flow-forecasting";

/** The body GeekAPI answered at 09:50:15 UTC on 2026-10-14, as it came. */
const UNHANDLED_502 = JSON.stringify({
  type: "https://geekatyourspot.com/errors/unhandled",
  title: "A service this request depends on could not be reached.",
  status: 502,
  traceId: "0HNP9HGFGHT1O:00000001",
  exceptionType: "System.Net.Http.HttpRequestException",
  detail: null,
});

/** What GeekAPI answers for the same failure since the check stopped throwing on it. */
const NOT_CHECKED = JSON.stringify({
  error: `The crawl of ${SITE} could not be read from GeekRepository, so the declared URLs could not be checked.`,
});

const project: GccProject = {
  id: PROJECT_ID,
  clientId: CLIENT_ID,
  name: "Cash Flow Forecasting: Automated Enterprise Resource Planning",
  code: null,
  description: null,
  status: "active",
  siteUrl: SITE,
  projectSiteRunId: null,
  department: null,
  partnerUrls: ["https://partner.example"],
  competitorUrls: ["https://competitor.example"],
  startDate: "2026-10-01",
  dueDate: null,
  finishedDate: null,
  estimatedHours: null,
  budget: null,
  budgetCurrency: null,
  createdAtUtc: "2026-10-01T09:00:00Z",
  updatedAtUtc: "2026-10-14T09:00:00Z",
  briefJson: null,
  topic: null,
  researchJson: null,
  siteSectionJson: null,
  version: 1,
  briefSavedAtUtc: null,
};

/** The index check refuses the site's list with `siteRefusal`; the other two lists are usable. */
function installGeekApi(siteRefusal: string): { unanswered: string[] } {
  const unanswered: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    if (path === "/api/cw/api/rag/hosts-indexed") {
      const { urls, crawlType } = JSON.parse(String(init?.body)) as { urls: string[]; crawlType: string };
      if (crawlType === "project-site") {
        return new Response(siteRefusal, { status: 502, headers: { "Content-Type": "application/json" } });
      }
      return new Response(
        JSON.stringify({
          results: urls.map((u) => ({
            url: u,
            host: new URL(u).host,
            indexed: true,
            runId: null,
            usable: true,
            reason: null,
            pages: 120,
            chunks: 900,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    unanswered.push(path);
    return new Response("not answered by the test", { status: 500 });
  };
  return { unanswered };
}

/** The text under "Site URL": everything its label holds, the input's own value aside. */
function siteFieldText(): string {
  const input = screen.getByDisplayValue(SITE);
  return input.closest("label")?.textContent ?? "";
}

for (const [name, body, sentence] of [
  ["the 502 of 2026-10-14", UNHANDLED_502, "A service this request depends on could not be reached."],
  ["the check's own refusal", NOT_CHECKED, JSON.parse(NOT_CHECKED).error as string],
] as const) {
  test(`Profile shows ${name} under "Site URL" as its sentence, with Re-check offered`, async (t) => {
    t.after(cleanup);
    const api = installGeekApi(body);

    render(<ProjectForm clientId={CLIENT_ID} project={project} onCreated={() => undefined} />);

    await waitFor(() => assert.ok(siteFieldText().includes(sentence)));
    const shown = siteFieldText();
    assert.ok(!shown.includes("{"), `JSON on the page: ${shown}`);
    assert.ok(!shown.includes("traceId") && !shown.includes("0HNP9HGFGHT1O"), `a trace id on the page: ${shown}`);
    assert.ok(!shown.includes("HttpRequestException"), `an exception type on the page: ${shown}`);
    // The site is left unanswered, not called unusable, and the one action for it is offered.
    await waitFor(() => assert.ok(screen.getByRole("button", { name: "Re-check the index" })));
    assert.deepEqual(api.unanswered, []);
  });
}

test("a route's refusal is its error field", () => {
  assert.equal(refusalText(JSON.stringify({ error: " Nothing was started. " })), "Nothing was started.");
});

test("a failure no route handled is its title, and its detail when it carries one", () => {
  assert.equal(refusalText(UNHANDLED_502), "A service this request depends on could not be reached.");
  assert.equal(
    refusalText(JSON.stringify({ title: "Export failed", detail: "The page has no body.", status: 400 })),
    "Export failed The page has no body.",
  );
});

test("a body ASP.NET could not read names each field it refused", () => {
  assert.equal(
    refusalText(
      JSON.stringify({
        title: "One or more validation errors occurred.",
        status: 400,
        errors: { urls: ["The urls field is required."] },
      }),
    ),
    "One or more validation errors occurred. The urls field is required.",
  );
});

test("a body that is not GeekAPI's JSON is shown as it came", () => {
  assert.equal(refusalText("Could not reach GeekAPI: fetch failed"), "Could not reach GeekAPI: fetch failed");
  assert.equal(refusalText(JSON.stringify("A Generate is already running.")), "A Generate is already running.");
  assert.equal(refusalText(JSON.stringify({ results: [] })), JSON.stringify({ results: [] }));
  assert.equal(refusalText("[1,2]"), "[1,2]");
});

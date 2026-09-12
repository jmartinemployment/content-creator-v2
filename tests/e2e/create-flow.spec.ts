import { expect, test } from "@playwright/test";
import { openAuthenticated, platformOrigin, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("skills area explains approved automatic skills and goal bundles", async ({ page }) => {
  await openAuthenticated(page, "/skills");

  await expect(page.getByRole("heading", { name: "Skills", exact: true })).toBeVisible();
  await expect(page.getByText("Automatic and read-only")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Technical authority" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Citation Discipline" })).toBeVisible();
  await expect(page.getByText("Catalog gcc-safe-skills.2026-09-08")).toBeVisible();
  await expect(page.getByText(/^sha256:11111…11111111$/)).toBeVisible();
  await expect(page.getByText("First party").first()).toBeVisible();
  await expect(page.getByText("search_corpus, load_evidence_page")).toBeVisible();
  await expect(page.getByRole("link", { name: "content-producer" })).toBeVisible();
});

test("agent library links immutable specialist details and assigned skills", async ({ page }) => {
  await openAuthenticated(page, "/agents");
  await expect(page.getByRole("heading", { name: "Agent Library" })).toBeVisible();
  await expect(page.getByText("Catalog agent-catalog.2026-09-08")).toBeVisible();
  await page.getByRole("link", { name: "Content Producer", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Content Producer" })).toBeVisible();
  await expect(page.getByText("77777777-7777-7777-7777-777777777777")).toBeVisible();
  await expect(page.getByText(/outline · producer/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Citation Discipline 2.0.0/ })).toBeVisible();
});

test("agent admin submits exact skill versions and governed version configuration", async ({ page, request }) => {
  await openAuthenticated(page, "/agents/admin");
  await expect(page.getByRole("heading", { name: "Agent administration" })).toBeVisible();
  await page.getByLabel("Agent name").fill("Audience Specialist");
  await page.getByLabel("Agent slug").fill("audience-specialist");
  await page.getByLabel("Agent description").fill("Contributes and reviews audience fit.");
  await page.getByLabel("Semantic version").fill("1.2.3");
  await page.getByLabel("Agent objective").fill("Improve audience fit using governed evidence.");
  await page.getByLabel("Agent instructions").fill("Contribute audience guidance using pinned evidence.");
  await page.getByLabel("Technical Depth 2.1.0").check();
  await page.getByLabel("outline enabled").check();
  await page.getByLabel("outline role").selectOption("reviewer");
  await page.getByLabel("outline order").fill("20");
  await page.getByLabel("pillar content type").check();
  await page.getByLabel("submit_review tool").check();
  await page.getByLabel("o1-pro model").check();
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("status")).toHaveText("Agent draft created");

  const platformRequests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const createAgentRequest = platformRequests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/agents/admin",
  );
  const body = JSON.parse(createAgentRequest.body);
  expect(body.semanticVersion).toBe("1.2.3");
  expect(body.objective).toBe("Improve audience fit using governed evidence.");
  expect(body.skillVersionIds).toEqual(["22222222-2222-2222-2222-222222222222"]);
  expect(body.stageParticipation).toEqual([
    { stage: "researchPlanning", role: "contributor", order: 0 },
    { stage: "outline", role: "reviewer", order: 20 },
  ]);
  expect(body.contentTypes).toEqual(["blog", "pillar"]);
  expect(body.allowedTools).toContain("submit_review");
  expect(body.allowedModels).toEqual(["o3", "o1-pro"]);
  expect(body.modelPolicy).toEqual({
    version: "content-model-policy.v1",
    allowedModels: ["o3", "o1-pro"],
  });
  await expect(page.getByRole("heading", { name: "Exact pinned skills" })).toBeVisible();
  await expect(page.getByText(/Technical Depth 2.1.0/).last()).toBeVisible();
  await expect(page.getByText(/outline · reviewer/i)).toBeVisible();
});

test("agent admin streams durable tests, cancels, and enforces exact-version publish gate", async ({ page }) => {
  await openAuthenticated(page, "/agents/admin");
  const publish = page.getByRole("button", { name: "Publish version" });
  const approve = page.getByRole("button", { name: "Approve review" });
  await expect(publish).toBeDisabled();
  await expect(approve).toBeDisabled();
  page.once("dialog", (dialog) => dialog.accept("Objective is bounded by evidence policy."));
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText(/Rationale: Objective is bounded by evidence policy/)).toBeVisible();
  await expect(approve).toBeEnabled();
  await page.getByLabel("Agent review notes").fill("Assignments and bounded tools reviewed.");
  await page.getByRole("button", { name: "Approve review" }).click();
  await expect(publish).toBeDisabled();

  await page.getByLabel("Agent test scenario").selectOption("rag-smoke");
  await page.getByRole("button", { name: "Run durable test" }).click();
  await expect(page.getByRole("status")).toHaveText("Agent test queued");
  await expect(page.getByLabel("Active agent test")).toContainText("running");
  await expect(page.getByLabel("Agent test progress")).toHaveAttribute("value", "45");
  await page.getByRole("button", { name: "Cancel test" }).click();
  await expect(page.getByLabel("Active agent test")).toContainText("cancelled");
  await expect(publish).toBeDisabled();

  await page.getByLabel("Agent test scenario").selectOption("contract");
  await page.getByRole("button", { name: "Run durable test" }).click();
  await expect(page.getByLabel("Active agent test")).toContainText("rag-smoke");
  await expect(page.getByLabel("Active agent test")).toContainText("passed");
  await expect(page.getByLabel("Active agent test")).toContainText(/"passed":true/);
  await expect(publish).toBeEnabled();
  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(page.getByText("Agent published")).toBeVisible();
  await page.getByRole("button", { name: "Deprecate" }).click();
  await expect(page.getByText("Agent deprecated")).toBeVisible();
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Agent revoked")).toBeVisible();
});

test("published agent successor preserves immutable predecessor and reloads exact settings", async ({ page, request }) => {
  await request.post(`${platformOrigin}/__scenario`, { data: { adminAgentStatus: "published" } });
  await openAuthenticated(page, "/agents/admin");
  await expect(page.getByText("Improve audience fit without weakening evidence requirements.")).toBeVisible();
  await page.getByRole("button", { name: "Create successor draft" }).click();
  await expect(page.getByRole("heading", { name: "Create successor draft for Marketing Strategist" })).toBeVisible();
  await expect(page.getByLabel("Semantic version")).toHaveValue("2.0.1");
  await expect(page.getByLabel("Agent objective")).toHaveValue("Improve audience fit without weakening evidence requirements.");
  await expect(page.getByLabel("Technical Depth 2.1.0")).toBeChecked();
  await expect(page.getByLabel("outline role")).toHaveValue("contributor");
  await expect(page.getByLabel("validation role")).toHaveValue("reviewer");
  await page.getByLabel("Semantic version").fill("3.0.0");
  await page.getByLabel("Agent objective").fill("Successor objective with narrower measurable outcomes.");
  await page.getByRole("button", { name: "Save successor draft" }).click();
  await expect(page.getByRole("status")).toHaveText("Successor draft created");
  await expect(page.getByRole("button", { name: "Marketing Strategist 2.0.0" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marketing Strategist 3.0.0" })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Marketing Strategist 3.0.0" }).click();
  await expect(page.getByText("Successor objective with narrower measurable outcomes.")).toBeVisible();
  await expect(page.getByText(/validation · reviewer/i)).toBeVisible();
  await expect(page.getByText(/Technical Depth 2.1.0/).last()).toBeVisible();
  await page.getByRole("button", { name: "Marketing Strategist 2.0.0" }).click();
  await expect(page.getByText("Improve audience fit without weakening evidence requirements.")).toBeVisible();
  await expect(page.getByText("Successor objective with narrower measurable outcomes.")).toHaveCount(0);

  const platformRequests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const successorRequest = platformRequests.find((entry: { method: string; path: string }) =>
    entry.method === "POST"
      && entry.path === "/api/geek-content-creator-v2/agents/admin/44444444-4444-4444-4444-444444444444/versions",
  );
  expect(successorRequest).toBeTruthy();
  expect(JSON.parse(successorRequest.body).objective).toBe("Successor objective with narrower measurable outcomes.");
});

test("skill admin is denied by backend authorization for non-admin users", async ({ page }) => {
  await openAuthenticated(page, "/skills/admin");
  await page.context().clearCookies();
  await page.context().addCookies([{
    name: "gcc_v2_access",
    value: "viewer-access",
    url: "http://127.0.0.1:3004",
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await page.goto("/skills/admin");
  await expect(page.getByRole("heading", { name: "Administrator access required" })).toBeVisible();
  await expect(page.getByText(/GeekAPI denied this account/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Import safely" })).toHaveCount(0);
});

test("skill admin validates prohibited parser imports and completes lifecycle with audit", async ({ page }) => {
  await openAuthenticated(page, "/skills/admin");
  await expect(page.getByRole("heading", { name: "Skill administration" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Community Style 1.0.0" })).toBeVisible();
  await page.getByLabel("Source repository").fill("https://github.com/example/llama-parse-plugin");
  await page.getByLabel("Immutable commit").fill("0123456789abcdef0123456789abcdef01234567");
  await page.getByLabel("Skill path").fill("skills/parser");
  await page.getByRole("button", { name: "Import safely" }).click();
  await expect(page.getByText(/Hosted parsing services and parser plugins/)).toBeVisible();

  await page.getByLabel("Source repository").fill("https://github.com/example/safe-skills");
  await page.getByLabel("Skill path").fill("skills/safe-style");
  await page.getByRole("button", { name: "Import safely" }).click();
  await expect(page.getByText("Import completed")).toBeVisible();
  await page.getByText(/SKILL\.md · 128 bytes/).click();
  await expect(page.getByText("Use concise, evidence-grounded prose.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("Workflow authority remains with GeekAPI."));
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText(/Rationale: Workflow authority remains with GeekAPI/)).toBeVisible();
  await page.getByLabel("Review notes").fill("All files inspected; license and tool request accepted.");
  await page.getByRole("button", { name: "Approve review" }).click();
  await expect(page.getByText("Review approved")).toBeVisible();
  await page.getByRole("button", { name: "Publish immutable version" }).click();
  await expect(page.getByText("Skill published")).toBeVisible();
  await page.getByRole("button", { name: "Deprecate" }).click();
  await expect(page.getByText("Skill deprecated")).toBeVisible();
  await expect(page.getByText(/quarantined → approved/)).toBeVisible();
  await expect(page.getByText(/published → deprecated/)).toBeVisible();
});

test("skill admin downloads Agentic Skills listings into quarantine", async ({ page, request }) => {
  await openAuthenticated(page, "/skills/admin");
  await page.getByLabel("Agentic Skills URL").fill(
    "https://agenticskills.io/skills/find-skills",
  );
  await page.getByRole("button", { name: "Download to quarantine" }).click();
  await expect(page.getByText("Agentic Skill imported to quarantine")).toBeVisible();
  await expect(page.getByText(/https:\/\/github\.com\/vercel-labs\/skills/)).toBeVisible();

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const imported = requests.find((entry: { path: string }) =>
    entry.path === "/api/geek-content-creator-v2/skills/admin/import-agentic-skill"
  );
  expect(JSON.parse(imported.body)).toEqual({
    listingUrl: "https://agenticskills.io/skills/find-skills",
  });
});

test("guided create flow reaches approved, validated canvas with citations and provenance", async ({ page, request }) => {
  await openAuthenticated(page, "/creates/new");

  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to create?" })).toBeVisible();

  await page.getByLabel("Working title").fill("Reliable Content Operations");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Key concepts to emphasize").fill("Evidence Engine");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("Research readiness")).toContainText("Research is ready");
  await page.getByLabel("Primary search phrase").fill("deterministic content workflow");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("radio", { name: "Content Producer producer" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Marketing Strategist contributor" }).check();
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByLabel("Resolved specialist team")).toContainText("Content Producer 3.0.0");
  await expect(page.getByLabel("Resolved specialist team")).toContainText("Marketing Strategist 2.0.0");
  await expect(page.getByText("Approved skills are selected automatically.")).toBeVisible();
  await expect(page.getByLabel("Immutable resolved skill bundle")).toContainText("Snapshot sha256:snaps");
  await expect(page.getByLabel("Immutable resolved skill bundle")).toContainText("Citation Discipline 2.0.0");
  await page.getByText(/Advanced run settings/).click();
  await expect(page.getByRole("radio", { name: /Best available/ })).toBeChecked();
  await page.getByRole("button", { name: "Create content" }).click();
  await expect(page.getByRole("heading", { name: "Confirm the partners we found" })).toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Confirm the partners we found" }) })
      .getByRole("listitem")
      .filter({ hasText: "Evidence Engine" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm partners & create" }).click();

  await expect(page).toHaveURL(/\/creates\/create-1\?jobId=job-1/);
  const platformRequests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const generateRequest = platformRequests.find(
    (entry: { path: string }) =>
      entry.path === "/api/geek-content-creator-v2/creates/create-1/generate",
  );
  const generateBody = JSON.parse(generateRequest.body);
  expect(generateBody.modelPolicy).toEqual({
    version: "content-model-policy.v1",
    preset: "best-quality",
  });
  expect(generateBody.brief.targetEntities).toEqual(["Evidence Engine"]);
  expect(generateBody.selectedAgentIds).toEqual(["content-producer", "marketing-strategist"]);
  await expect(page.getByRole("heading", { name: "Brand kit awaiting approval" })).toBeVisible();
  await expect(page.getByLabel("Company")).toHaveValue("Example Systems");
  await page.getByRole("button", { name: "Accept brand kit" }).click();

  await expect(page.getByRole("heading", { name: "Outline awaiting approval" })).toBeVisible();
  const researchPlan = page.getByRole("region", { name: "Research plan" });
  await expect(researchPlan).toBeVisible();
  await expect(researchPlan.getByText("partner", { exact: true })).toBeVisible();
  await expect(researchPlan.getByText("competitors", { exact: true })).toBeVisible();
  await expect(researchPlan.locator("li").first()).toContainText("partner-run-1");
  await expect(page.getByLabel("Outline section 1 purpose")).toContainText("Opening context");
  await expect(page.getByLabel("Outline section 2 purpose")).toContainText("Core section");
  await page.getByLabel("Outline section 1 heading").fill("Why deterministic reliability matters");
  await page.getByRole("button", { name: "Save & approve" }).click();

  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.getByRole("heading", { name: "Why reliability matters" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.getByLabel("Job citations")).toBeVisible();
  await expect(page.getByLabel("Job citations").getByLabel("Verified citations")).toContainText("verified");
  const technicalDetails = page.getByLabel("Technical details");
  await technicalDetails.locator(":scope > summary").click();
  await expect(technicalDetails).toContainText("Status: ready");
  await expect(technicalDetails).toContainText("Model: o1-pro");
  await expect(technicalDetails).toContainText("Retrieval: hybrid");
  await expect(technicalDetails).toContainText("Agent: content-producer");
  await expect(technicalDetails).toContainText("Stage execution execution-write-1");
  await expect(technicalDetails).toContainText("Specialist team (2)");
  await expect(technicalDetails).toContainText("contribution: marketing-strategist → content-producer");
  await expect(technicalDetails).toContainText("Activated skills: Citation Discipline 2.0.0");
  await expect(technicalDetails).toContainText("Tools: search_corpus ×2");
  await expect(technicalDetails).toContainText("Stop reason: completed");
  await expect(technicalDetails).toContainText("Immutable attempt lineage (2)");
  await expect(page.getByRole("link", { name: "Reliable content operations" }).first()).toHaveAttribute(
    "href",
    "https://example.test/reliable-content",
  );

  await page.getByText(/^Event log/).click();
  await expect(page.locator("text=SectionDrafted")).toHaveCount(1);
  await expect(page.locator("text=SkillActivated")).toHaveCount(1);

  await page.getByRole("button", { name: "Edit content" }).click();
  const exactContent = page.getByLabel("Exact content for Why reliability matters");
  await exactContent.fill("This canceled edit must not be saved.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("This canceled edit must not be saved.")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit content" }).click();
  await page.getByLabel("Exact content for Why reliability matters").fill(
    "Operator-authored exact content survives reload without an AI rewrite.",
  );
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByRole("paragraph").filter({
    hasText: "Operator-authored exact content survives reload without an AI rewrite.",
  })).toBeVisible();

  await page.getByRole("tab", { name: /Assets/ }).click();
  await expect(page.getByRole("heading", { name: "Drafts and generated outputs" })).toBeVisible();
  await page.getByRole("button", { name: "Generate carousel PDF" }).click();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy caption" })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /Assets/ }).click();
  await expect(page.getByText("2 slides · Reliable_Content_Operations.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy caption" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(download).resolves.toBeTruthy();
  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.getByRole("heading", { name: "Why reliability matters" })).toBeVisible();
  await expect(page.getByText(
    "Operator-authored exact content survives reload without an AI rewrite.",
    { exact: true },
  )).toBeVisible();
});

test("create continues when specialist catalog is unavailable", async ({ page, request }) => {
  await page.addInitScript(() => {
    sessionStorage.clear();
  });
  await page.route("**/api/gcc-v2/agents", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "specialists temporarily unavailable" }),
      });
      return;
    }
    await route.continue();
  });

  await openAuthenticated(page, "/creates/new");

  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Working title").fill("Catalog Outage Continue");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Primary search phrase").fill("deterministic content workflow");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(/Specialists unavailable/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Review" })).toBeEnabled();
  await page.getByRole("button", { name: "Review" }).click();

  await expect(page.getByLabel("Resolved specialist team")).toContainText(
    "backend's default published team",
  );
  await page.getByRole("button", { name: "Create content", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirm the partners we found" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm partners & create" }).click();
  await expect(page).toHaveURL(/\/creates\/create-1\?jobId=job-1/);

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const createRequest = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/creates",
  );
  expect(createRequest).toBeTruthy();
  expect(JSON.parse(createRequest.body).selectedAgentIds).toBeUndefined();

  const generateRequest = requests.find((entry: { path: string }) =>
    entry.path === "/api/geek-content-creator-v2/creates/create-1/generate",
  );
  expect(generateRequest).toBeTruthy();
  expect(JSON.parse(generateRequest.body).selectedAgentIds).toBeUndefined();

  await expect(page.getByRole("heading", { name: "Brand kit awaiting approval" })).toBeVisible();
});

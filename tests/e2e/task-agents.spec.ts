import { expect, test } from "@playwright/test";
import { openAuthenticated, platformOrigin, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("task agent run pins Geek IQ Brand Voice and Style Guide versions", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await expect(page.getByRole("heading", { name: "AI Readiness Score" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Geek IQ" })).toBeVisible();
  await page.getByLabel("Brand Voice").selectOption("brand-version-1");
  await page.getByLabel("Style Guide").selectOption("style-version-1");
  await page.getByLabel("Visual Guidelines").selectOption("visual-version-1");
  await page.getByRole("button", { name: "Check Geek IQ" }).click();
  await expect(page.getByLabel("Effective context preflight")).toBeVisible();
  await expect(page.getByLabel("Effective context preflight")).toContainText("Example Systems");
  await expect(page.getByLabel("Effective context preflight")).toContainText("Clear Technical Style");
  await expect(page.getByLabel("Effective context preflight")).toContainText("Product Visual System");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("shared-context-digest")).toContainText("Geek IQ digest");

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const runCreate = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/task-agents/ai-readiness/runs");
  expect(runCreate).toBeTruthy();
  const body = JSON.parse(runCreate.body);
  expect(body.contextSelection).toEqual(expect.objectContaining({
    brandKitVersionId: "brand-version-1",
    styleGuideVersionId: "style-version-1",
    visualGuidelineVersionId: "visual-version-1",
  }));
});

test("Product IQ blocks incomplete claim policy and accepts complete products", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await expect(page.getByRole("region", { name: "Geek IQ" })).toBeVisible();

  await page.getByLabel("Incomplete Claims Catalog product version 1").check();
  await page.getByRole("button", { name: "Check Geek IQ" }).click();
  await expect(page.getByLabel("Effective context preflight")).toContainText(
    "product:product-version-2:approved_claims_required",
  );
  await expect(page.getByLabel("Effective context preflight")).toContainText(
    "product:product-version-2:mandatory_disclaimers_required",
  );
  await expect(page.getByLabel("Effective context preflight")).toContainText("Generation blocked");
  await expect(page.getByRole("button", { name: "Run AI Readiness Score" })).toBeDisabled();

  await page.getByLabel("Incomplete Claims Catalog product version 1").uncheck();
  await page.getByLabel("Evidence Engine product version 1").check();
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Check Geek IQ" }).click();
  await expect(page.getByLabel("Effective context preflight")).toContainText("Evidence Engine");
  await expect(page.getByLabel("Effective context preflight")).toContainText(
    "Context is eligible for manifest resolution.",
  );
  await expect(page.getByRole("button", { name: "Run AI Readiness Score" })).toBeEnabled();
});

test("ROI business calculator task agent projects scenarios and reconciles telemetry", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/roi-business-calculator");
  await expect(page.getByRole("heading", { level: 1, name: "AI-Based ROI Business Calculator" })).toBeVisible();
  await page.getByLabel("Annual workflow volume").fill("120");
  await page.getByLabel("Baseline minutes per item").fill("90");
  await page.getByLabel("Assisted minutes per item").fill("25");
  await page.getByLabel("Adoption rate (0-1)").fill("0.7");
  await page.getByLabel("Successful use rate (0-1)").fill("0.85");
  await page.getByLabel("Loaded hourly cost (USD)").fill("85");
  await page.getByLabel("Redeployment factor (0-1)").fill("0.6");
  await page.getByLabel("Annual external / agency spend (USD)").fill("48000");
  await page.getByLabel("Replaceable share of external spend (0-1)").fill("0.35");
  await page.getByLabel("Total cost of ownership (USD)").fill("36000");
  await page.getByRole("button", { name: /Run / }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("roi-projection-result")).toBeVisible();
  await expect(page.getByTestId("roi-scenario-expected")).toContainText("Expected");
  await expect(page.getByTestId("roi-reconciliation")).toContainText("not cash");
  await expect(page.getByTestId("roi-projection-result")).toContainText("Directional model only");
});

test("roiProjection.v1 can attach to Canvas and pin on Grid", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await expect(page.getByRole("link", { name: "Evidence Engine launch" })).toBeVisible();

  await openAuthenticated(page, "/grid");
  await page.getByRole("button", { name: "New FAQ demo" }).click();
  await expect(page.getByRole("link", { name: "FAQ launch batch" })).toBeVisible();

  await openAuthenticated(page, "/task-agents/roi-business-calculator");
  await page.getByRole("button", { name: /Run / }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("attach-to-project")).toBeVisible();
  await page.getByLabel("Attach to project").selectOption({ label: "Evidence Engine launch" });
  await page.getByRole("button", { name: "Attach artifact" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Attached" })).toBeVisible();

  await expect(page.getByTestId("attach-to-grid")).toBeVisible();
  await page.getByLabel("Attach ROI to grid").selectOption({ label: "FAQ launch batch" });
  await page.getByRole("button", { name: "Pin ROI projection" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ROI projection pinned" })).toBeVisible();

  await page.getByRole("link", { name: "Open grid" }).click();
  await expect(page.getByRole("heading", { name: "FAQ launch batch" })).toBeVisible();
  await expect(page.getByTestId("grid-roi-projection")).toContainText("roiProjection.v1");
  await expect(page.getByTestId("grid-roi-projection")).toContainText("not cash");

  await openAuthenticated(page, "/projects");
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();
  await expect(page.getByRole("heading", { name: "Evidence Engine launch" })).toBeVisible();
  await expect(page.getByText(/roiProjection\.v1|AI-Based ROI Business Calculator/).first()).toBeVisible();
});

test("task-agent catalog filters by Jasper workflow and opens a diagnostic", async ({ page }) => {
  await openAuthenticated(page, "/task-agents");
  await expect(page.getByRole("heading", { name: "Task Agents" })).toBeVisible();
  await expect(page.getByLabel("Agent discovery filters")).toBeVisible();
  await expect(page.getByTestId("agent-library-count")).toContainText("agent");
  await page.getByLabel("Workflow").selectOption("optimize");
  await expect(page.getByRole("heading", { name: "Optimize" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Originate" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open agent" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Open agent" }).first().click();
  await expect(page.getByLabel("Task agent input form")).toBeVisible();
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: /Run / }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
});

test("agent library can favorite, save config, and restore it", async ({ page }) => {
  await openAuthenticated(page, "/task-agents");
  await expect(page.getByRole("heading", { name: "Task Agents" })).toBeVisible();
  await expect(page.getByLabel("Visibility")).toBeVisible();
  await page.getByLabel("Visibility").selectOption("public");
  await expect(page.getByTestId("agent-library-count")).toContainText("agent");

  const readinessRow = page.locator("li").filter({ hasText: "AI Readiness Score" }).first();
  await readinessRow.getByRole("button", { name: /Favorite AI Readiness Score/ }).click();
  await expect(page.getByTestId("agent-library-favorites")).toContainText("AI Readiness Score");

  await readinessRow.getByRole("link", { name: "Open agent" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "AI Readiness Score" })).toBeVisible();
  await page.getByLabel("Visible page content").fill("# Partial page\n\nFragment for library config.");
  await page.getByLabel("Source completeness").selectOption("partial");
  await page.getByLabel("Save configuration name").fill("Partial readiness preset");
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(page.getByText(/Saved “Partial readiness preset”/)).toBeVisible();

  await page.getByRole("link", { name: "← Task Agents" }).click();
  await expect(page.getByTestId("agent-library-saved-configs")).toContainText("Partial readiness preset");
  await page.getByRole("link", { name: "Restore" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "AI Readiness Score" })).toBeVisible();
  await expect(page.getByLabel("Visible page content")).toHaveValue(/Fragment for library config/);
  await expect(page.getByLabel("Source completeness")).toHaveValue("partial");
  await expect(page.getByText(/Restored “Partial readiness preset”/)).toBeVisible();
});

test("query planner intelligence agent keeps demand as heuristic", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/query-planner");
  await expect(page.getByRole("heading", { name: "Query Planner" })).toBeVisible();
  await expect(page.getByText("Runnable intelligence")).toBeVisible();
  await expect(page.getByLabel("Task agent input form")).toBeVisible();
  await page.getByLabel("Hypothesis topics").fill("AI content readiness");
  await page.getByRole("button", { name: "Run Query Planner" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="query-plan"]')).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: /not traffic, volume, ranking, or demand measurements/ })).toBeVisible();
  await expect(page.getByText(/queryPlan\.v1 · valid/)).toBeVisible();
});

test("query planner loads observed GSC queries with provenance", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/query-planner");
  await expect(page.getByRole("heading", { name: "Query Planner" })).toBeVisible();
  await page.getByRole("button", { name: "Connect GSC property" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Connected GSC property/ })).toBeVisible();
  await expect(page.getByLabel("GSC connection ID")).not.toHaveValue("");
  await page.getByRole("button", { name: "Load GSC observed queries" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Loaded 2 observed GSC/ })).toBeVisible();
  await expect(page.getByLabel("Observed GSC queries")).toHaveValue(
    "AI content readiness checklist\nhow to measure AI readiness",
  );
  await page.getByRole("button", { name: "Run Query Planner" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="query-plan"]')).toBeVisible();

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const runCreate = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/task-agents/query-planner/runs");
  expect(runCreate).toBeTruthy();
  const body = JSON.parse(runCreate.body);
  expect(body.input.queries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      query: "AI content readiness checklist",
      origin: "observed",
    }),
  ]));
  expect(body.input.sources).toEqual(expect.arrayContaining([
    expect.objectContaining({
      title: "Google Search Console",
      url: "sc-domain:example.test",
    }),
  ]));
});

test("faq generator content agent renders grounded FAQ pairs", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/faq-generator");
  await expect(page.getByRole("heading", { name: "FAQ Generator" })).toBeVisible();
  await expect(page.getByText("Runnable content")).toBeVisible();
  await expect(page.getByLabel("Task agent input form")).toBeVisible();
  await page.getByLabel("Topic").fill("AI content readiness");
  await page.getByLabel("FAQ questions").fill("What is AI content readiness?");
  await page.getByLabel("Source content").fill(
    "## What is AI content readiness?\n\nAI content readiness means pages provide answer-first structure, evidence, and schema that systems can cite.",
  );
  await page.getByRole("button", { name: "Run FAQ Generator" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="faq-list"]')).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "What is AI content readiness?" })).toBeVisible();
  await expect(page.getByTestId("faq-citations")).toContainText(
    "AI content readiness means pages provide answer-first structure",
  );
  await expect(page.getByText(/faqSet\.v1 · valid/)).toBeVisible();
});

test("citable claims content agent never invents unsupported statistics", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/citable-claims");
  await expect(page.getByRole("heading", { name: "Citable Claims" })).toBeVisible();
  await expect(page.getByLabel("Task agent input form")).toBeVisible();
  await page.getByLabel("Source content").fill(
    "# Proof\n\nTrusted by 500 customer teams across regulated industries.\n\nTrusted by 50 customer teams across regulated industries.",
  );
  await page.getByLabel("Vague statements to rewrite").fill("Our product is trusted by many teams");
  await page.getByRole("button", { name: "Run Citable Claims" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="claim-ledger"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Citable claims" })).toContainText("Trusted by 500 customer teams.");
  await expect(page.getByTestId("contradiction-summary")).toContainText("Possible contradictions");
  await expect(page.getByTestId("contradiction-pairs")).toContainText("conflictingQuantities");
  await expect(page.locator('[data-contradiction="possible"]').first()).toBeVisible();
  await expect(page.getByTestId("claim-attribution").first()).toContainText("Source page proof section");
  await expect(page.getByTestId("claim-evidence").first()).toContainText(
    "Trusted by 500 customer teams across regulated industries.",
  );
  await expect(page.getByText(/claimLedger\.v1 · valid/)).toBeVisible();
});

test("fact density diagnostic renders claim-audit unsupported claims", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/fact-density");
  await expect(page.getByRole("heading", { name: "Fact Density Audit" })).toBeVisible();
  await page.getByLabel("Visible page content").fill(
    "# Proof\n\nTrusted by 500 customer teams worldwide.",
  );
  await page.getByRole("button", { name: "Run Fact Density Audit" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="claim-audit"]')).toBeVisible();
  await expect(page.getByTestId("unsupported-claims")).toContainText("Trusted by 500 customer teams worldwide.");
  await expect(page.getByText(/factDensityReport\.v1 · valid/)).toBeVisible();
});

test("entity mapper diagnostic renders entity-graph relationships", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/entity-mapper");
  await expect(page.getByRole("heading", { name: "Entity Mapper" })).toBeVisible();
  await page.getByLabel("Visible page content").fill(
    "# Acme Cloud\n\nAcme Cloud ships Evidence Engine for citeable drafts.",
  );
  await page.getByRole("button", { name: "Run Entity Mapper" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="entity-graph"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Canonical entities" })).toContainText("Acme Cloud");
  await expect(page.getByRole("list", { name: "Entity relationships" })).toContainText("coOccursWith");
  await expect(page.getByText(/entityMap\.v1 · valid/)).toBeVisible();
});

test("entity mapper coverage comparison renders competitor deltas", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/entity-mapper");
  await expect(page.getByRole("heading", { name: "Entity Mapper" })).toBeVisible();
  await page.getByLabel("Visible page content").fill(
    "# Acme Cloud\n\nAcme Cloud ships Evidence Engine for citeable drafts.",
  );
  await page.getByLabel("Competitor page content").fill(
    "# Rival Cloud\n\nRival Cloud ships Trust Layer and Acme Cloud comparisons.",
  );
  await page.getByRole("button", { name: "Run Entity Mapper" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Entity coverage comparisons" })).toContainText("Trust Layer");
  await expect(page.getByRole("list", { name: "Entity coverage comparisons" })).toContainText("competitorOnly");
  await expect(page.getByRole("list", { name: "Entity coverage recommendations" })).toContainText(
    "Add verified owned coverage for Trust Layer",
  );
});

test("schema markup diagnostic renders json-ld nodes", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/schema-markup");
  await expect(page.getByRole("heading", { name: "Schema Markup Generator" })).toBeVisible();
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers.",
  );
  await page.getByRole("button", { name: "Run Schema Markup Generator" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="json-ld"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Generated JSON-LD" })).toContainText("Article");
  await expect(page.getByText(/schemaMarkup\.v1 · valid/)).toBeVisible();
});

test("ai readiness comparison renders score-matrix deltas", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness-comparison");
  await expect(page.getByRole("heading", { name: "AI Readiness Comparison" })).toBeVisible();
  await page.getByLabel("Subject page content").fill("# Our page\n\nEvidence-backed answers.");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run AI Readiness Comparison" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="score-matrix"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Dimension deltas" })).toContainText("factDensity");
  await expect(page.getByText(/readinessComparison\.v1 · valid/)).toBeVisible();
});

test("ai readiness comparison accepts a two-competitor cohort", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness-comparison");
  await page.getByLabel("Subject page content").fill("# Ours\n\nTrusted by teams with proof.");
  await page.getByLabel("Competitor 1 name").fill("Rival Co");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByLabel("Competitor 2 name").fill("Alt Co");
  await page.getByLabel("Competitor 2 page content").fill("# Alt\n\nTrusted by 200 teams.");
  await page.getByRole("button", { name: "Run AI Readiness Comparison" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByLabel("Competitor readiness scores")).toContainText("Rival Co");
  await expect(page.getByLabel("Competitor readiness scores")).toContainText("Alt Co");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST"
    && entry.path === "/api/geek-content-creator-v2/task-agents/ai-readiness-comparison/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const body = JSON.parse(runPost!.body!) as {
    input?: { competitorPages?: unknown[] };
  };
  expect(body.input?.competitorPages?.length).toBe(2);
});

test("content gap finder renders gap-report opportunities", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/content-gap");
  await expect(page.getByRole("heading", { name: "Content Gap Finder" })).toBeVisible();
  await page.getByLabel("Subject page content").fill("# Ours\n\nGeneral overview.");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run Content Gap Finder" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="gap-report"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Content gaps" })).toContainText("supportedGap");
  await expect(page.getByText(/contentGapAnalysis\.v1 · valid/)).toBeVisible();
});

test("competitor audit renders prioritized audit-report actions", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/competitor-audit");
  await expect(page.getByRole("heading", { name: "Competitor Audit" })).toBeVisible();
  await page.getByLabel("Subject page content").fill("# Ours\n\nGeneral overview.");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run Competitor Audit" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="audit-report"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Prioritized actions" })).toContainText("customer-count");
  await expect(page.getByText(/competitorAudit\.v1 · valid/)).toBeVisible();
});

test("content gap finder accepts a two-competitor cohort", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/content-gap");
  await page.getByLabel("Subject page content").fill("# Ours\n\nGeneral overview.");
  await page.getByLabel("Competitor 1 name").fill("Rival Co");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByLabel("Competitor 2 name").fill("Alt Co");
  await page.getByLabel("Competitor 2 page content").fill("# Alt\n\nTrusted by 200 teams.");
  await page.getByRole("button", { name: "Run Content Gap Finder" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Coverage by dimension" })).toContainText("competitors 2/2");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST"
    && entry.path === "/api/geek-content-creator-v2/task-agents/content-gap/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const body = JSON.parse(runPost!.body!) as {
    input?: { competitorPages?: unknown[] };
  };
  expect(body.input?.competitorPages?.length).toBe(2);
});

test("competitor audit analyzes multiple competitor pages", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/competitor-audit");
  await page.getByLabel("Subject page content").fill("# Ours\n\nGeneral overview.");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByLabel("Competitor 2 name").fill("Alt Co");
  await page.getByLabel("Competitor 2 page content").fill("# Alt\n\nTrusted by 200 teams.");
  await page.getByRole("button", { name: "Run Competitor Audit" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByText("2 competitor pages analyzed")).toBeVisible();
});

test("competitor positioning renders positioning-map hypotheses", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/competitor-positioning");
  await expect(page.getByRole("heading", { name: "Competitor Positioning" })).toBeVisible();
  await page.getByLabel("Brand page content").fill("# Brand\n\nEvidence-first drafting.");
  await page.getByLabel("Competitor page content").fill("# Rival\n\nThe fastest AI writing tool.");
  await page.getByRole("button", { name: "Run Competitor Positioning" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="positioning-map"]')).toBeVisible();
  await expect(page.getByTestId("messaging-hypotheses")).toContainText("Generated only");
  await expect(page.getByText(/competitorPositioning\.v1 · valid/)).toBeVisible();
});

test("competitor positioning preserves AI-answer observations", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/competitor-positioning");
  await page.getByLabel("Brand page content").fill("# Brand\n\nEvidence-first drafting.");
  await page.getByLabel("Competitor name").fill("Rival Co");
  await page.getByLabel("Competitor page content").fill("# Rival\n\nThe fastest AI writing tool.");
  await page.getByLabel("AI answer model / engine").fill("example-engine/v1");
  await page.getByLabel("AI answer query").fill("best document analyzer");
  await page.getByLabel("AI answer raw response").fill("Competitor Inc. leads on speed for document analysis.");
  await page.getByLabel("AI answer observed at (UTC)").fill("2026-09-01T12:00:00Z");
  await page.getByLabel("Subject mentioned in AI answer").selectOption("no");
  await page.getByLabel("Competitor mentioned in AI answer").selectOption("yes");
  await page.getByRole("button", { name: "Run Competitor Positioning" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("positioning-observations")).toContainText("example-engine/v1");
  await expect(page.getByTestId("positioning-observations")).toContainText("best document analyzer");
  await expect(page.getByTestId("positioning-perception-gaps")).toContainText("observationOnly");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST"
    && entry.path === "/api/geek-content-creator-v2/task-agents/competitor-positioning/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const body = JSON.parse(runPost!.body!) as {
    input?: { aiAnswerObservations?: Array<{ modelOrEngine?: string; competitorIdsMentioned?: string[] }> };
  };
  expect(body.input?.aiAnswerObservations?.length).toBe(1);
  expect(body.input?.aiAnswerObservations?.[0]?.modelOrEngine).toBe("example-engine/v1");
  expect(body.input?.aiAnswerObservations?.[0]?.competitorIdsMentioned).toEqual(["rival-co"]);
});

test("competitor page analysis renders competitor-report dimensions", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/competitor-page");
  await expect(page.getByRole("heading", { name: "Competitor Page Analysis" })).toBeVisible();
  await page.getByLabel("Competitor name").fill("Rival Co");
  await page.getByLabel("Competitor page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run Competitor Page Analysis" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="competitor-report"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Competitor dimensions" })).toContainText("proof");
  await expect(page.getByText(/competitorPageAnalysis\.v1 · valid/)).toBeVisible();
});

test("comparison brief content agent renders criteria and verdict", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/comparison-brief");
  await expect(page.getByRole("heading", { name: "Comparison Brief" })).toBeVisible();
  await page.getByLabel("Subject name").fill("Subject Analyzer");
  await page.getByLabel("Competitor 1 name").fill("Competitor Inc.");
  await page.getByLabel("Subject page content").fill("# Subject\n\nPlans start at $15 per month.");
  await page.getByLabel("Competitor 1 page content").fill("# Competitor\n\nPlans start at $20 per month.");
  await page.getByRole("button", { name: "Run Comparison Brief" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="comparison-brief"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Comparison criteria" })).toContainText("pricing");
  await expect(page.getByTestId("brief-verdict")).toContainText("Subject Analyzer");
  await expect(page.getByText(/comparisonBrief\.v1 · valid/)).toBeVisible();
});

test("comparison brief accepts a two-competitor cohort", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/comparison-brief");
  await page.getByLabel("Subject name").fill("Subject Analyzer");
  await page.getByLabel("Subject page content").fill("# Subject\n\nPlans start at $15 per month.");
  await page.getByLabel("Competitor 1 name").fill("Competitor Inc.");
  await page.getByLabel("Competitor 1 page content").fill("# Competitor\n\nPlans start at $20 per month.");
  await page.getByLabel("Competitor 2 name").fill("Alt Co");
  await page.getByLabel("Competitor 2 page content").fill("# Alt\n\nPlans start at $25 per month.");
  await page.getByRole("button", { name: "Run Comparison Brief" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("comparison-brief-parties")).toContainText("Competitor Inc. · Alt Co");
  await expect(page.getByTestId("comparison-brief-parties")).toContainText("Compared against 2 competitor pages.");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST"
    && entry.path === "/api/geek-content-creator-v2/task-agents/comparison-brief/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const body = JSON.parse(runPost!.body!) as {
    input?: { competitorPages?: unknown[]; competitorName?: string };
  };
  expect(body.input?.competitorPages?.length).toBe(2);
  expect(body.input?.competitorName).toContain("Alt Co");
});

test("pillar outline content agent renders supporting content plan", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/pillar-outline");
  await expect(page.getByRole("heading", { name: "Pillar Article Outline" })).toBeVisible();
  await page.getByLabel("Topic").fill("AI content readiness");
  await page.getByLabel("Source content").fill(
    "# AI Content Readiness Guide\n\n## What is AI content readiness?\n\nAnswer-first structure with evidence.",
  );
  await page.getByRole("button", { name: "Run Pillar Article Outline" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="outline"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Pillar outline sections" })).toContainText("What is AI content readiness?");
  await expect(page.getByTestId("supporting-content-plan")).toContainText("AI content readiness FAQ");
  await expect(page.getByText(/pillarOutline\.v1 · valid/)).toBeVisible();
});

test("Pillar Outline follow-on hydrates Pillar Article inputs", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/pillar-outline");
  await page.getByLabel("Topic").fill("AI content readiness");
  await page.getByLabel("Source content").fill(
    "# AI Content Readiness Guide\n\n## What is AI content readiness?\n\nAnswer-first structure with evidence.",
  );
  await page.getByRole("button", { name: "Run Pillar Article Outline" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await page.getByTestId("next-actions").getByRole("link", { name: "Pillar Article" }).click();
  await expect(page).toHaveURL(/fromArtifactVersionId=artifact-version-14/);
  await expect(page.getByRole("heading", { name: "Pillar Article" })).toBeVisible();
  await expect(page.getByTestId("artifact-handoff-notice")).toContainText("Imported Pillar Outline");
  await expect(page.getByLabel("Topic", { exact: true })).toHaveValue("AI content readiness");
  await expect(page.getByLabel("Source content")).toHaveValue(/What is AI content readiness/);
  await expect(page.getByLabel("Related queries")).toHaveValue(/What is AI content readiness/);
});

test("competitive response content agent renders response-plan mode", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/competitive-response");
  await expect(page.getByRole("heading", { name: "Competitive Response" })).toBeVisible();
  await page.getByLabel("Brand name").fill("Brand Analyzer");
  await page.getByLabel("Competitor 1 name").fill("Competitor Inc.");
  await page.getByLabel("Brand page content").fill("# Brand Analyzer\n\nSupports Markdown analysis.");
  await page.getByLabel("Competitor 1 page content").fill("# Competitor\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run Competitive Response" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="response-plan"]')).toBeVisible();
  await expect(page.getByTestId("response-mode")).toHaveText("counterNarrative");
  await expect(page.getByRole("list", { name: "Response outline" })).toContainText("Why choose Brand Analyzer?");
  await expect(page.getByText(/competitiveResponse\.v1 · valid/)).toBeVisible();
});

test("competitive response considers multiple competitor pages", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/competitive-response");
  await page.getByLabel("Brand name").fill("Brand Analyzer");
  await page.getByLabel("Brand page content").fill("# Brand Analyzer\n\nSupports Markdown analysis.");
  await page.getByLabel("Competitor 1 page content").fill("# Competitor\n\nTrusted by 500 teams.");
  await page.getByLabel("Competitor 2 name").fill("Alt Co");
  await page.getByLabel("Competitor 2 page content").fill("# Alt\n\nTrusted by 200 teams.");
  await page.getByRole("button", { name: "Run Competitive Response" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("response-competitor-cohort")).toContainText(
    "Response plan considers 2 competitor pages.",
  );
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST"
    && entry.path === "/api/geek-content-creator-v2/task-agents/competitive-response/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const body = JSON.parse(runPost!.body!) as {
    input?: { competitorPages?: unknown[] };
  };
  expect(body.input?.competitorPages?.length).toBe(2);
});

test("task agent pins governed context digest on the result shell", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await expect(page.getByRole("region", { name: "Run context" })).toBeVisible();
  await expect(page.getByText("Task-agent runs pin approved catalog context only")).toBeVisible();
  await page.getByLabel("Editorial Handbook version 1").check();
  await page.getByRole("button", { name: "Check governed context" }).click();
  await expect(page.getByLabel("Effective context preflight")).toContainText("eligible for manifest resolution");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByTestId("result-context-digest")).toContainText("c".repeat(64));
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
});

test("task agent result shell shows lineage spine and follow-on actions", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("artifact-lineage")).toContainText("Origin");
  await expect(page.getByTestId("next-actions").getByRole("link", { name: "Schema Markup" })).toBeVisible();
  await expect(page.getByText("Inspect payload JSON")).toBeVisible();
  await page.getByTestId("next-actions").getByRole("link", { name: "FAQ Generator" }).click();
  await expect(page).toHaveURL(/fromArtifactVersionId=artifact-version-1/);
  await expect(page).toHaveURL(/fromRunId=task-run-1/);
  await expect(page.getByRole("heading", { name: "FAQ Generator" })).toBeVisible();
  await expect(page.getByText(/This run will derive from artifact/)).toBeVisible();
  await expect(page.getByTestId("artifact-handoff-notice")).toContainText("Imported parent run page content");
  await expect(page.getByLabel("Source content")).toHaveValue(/Reliable AI content/);
});

test("Query Planner follow-on hydrates FAQ questions from planned queries", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/query-planner");
  await page.getByLabel("Hypothesis topics").fill("AI content readiness");
  await page.getByRole("button", { name: "Run Query Planner" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await page.getByTestId("next-actions").getByRole("link", { name: "FAQ Generator" }).click();
  await expect(page).toHaveURL(/fromArtifactVersionId=artifact-version-2/);
  await expect(page.getByTestId("artifact-handoff-notice")).toContainText("Imported");
  await expect(page.getByLabel("FAQ questions")).toHaveValue(/AI content readiness checklist/);
  await expect(page.getByLabel("Topic", { exact: true })).toHaveValue(/AI content readiness checklist/);
});

test("FAQ follow-on hydrates Schema Markup visible content from pairs", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/faq-generator");
  await page.getByLabel("Topic", { exact: true }).fill("AI content readiness");
  await page.getByLabel("FAQ questions").fill("What is AI content readiness?");
  await page.getByLabel("Source content").fill(
    "AI content readiness means pages provide answer-first structure, evidence, and schema that systems can cite.",
  );
  await page.getByRole("button", { name: "Run FAQ Generator" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await page.getByTestId("next-actions").getByRole("link", { name: "Schema Markup" }).click();
  await expect(page).toHaveURL(/fromArtifactVersionId=artifact-version-3/);
  await expect(page.getByTestId("artifact-handoff-notice")).toContainText("Imported FAQ pairs");
  await expect(page.getByLabel("Visible page content")).toHaveValue(/What is AI content readiness/);
});

test("task agent result can attach artifact to a canvas project", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await expect(page.getByRole("link", { name: "Evidence Engine launch" })).toBeVisible();

  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("attach-to-project")).toBeVisible();
  await page.getByLabel("Attach to project").selectOption({ label: "Evidence Engine launch" });
  await page.getByRole("button", { name: "Attach artifact" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Attached" })).toBeVisible();
  await page.getByRole("link", { name: "Open project" }).click();
  await expect(page.getByRole("heading", { name: "Evidence Engine launch" })).toBeVisible();
  await expect(page.getByText(/AI Readiness Score · readinessScore\.v1/).first()).toBeVisible();
  await page.getByRole("button", { name: /Select AI Readiness Score/ }).click();
  await expect(page.getByTestId("attached-artifact-ref")).toContainText("artifact-version-1");
});

test("task agent cancel stops a held run", async ({ page, request }) => {
  await request.post(`${platformOrigin}/__scenario`, { data: { taskRunHold: true } });
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByText("running", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel run" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Task result" })).toHaveCount(0);
});

test("Pillar Article drafts grounded markdown from source content", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/pillar-article");
  await page.getByLabel("Topic", { exact: true }).fill("AI content readiness");
  await page.getByLabel("Source content").fill(
    "# AI content readiness\n\nAI content readiness means pages answer questions with evidence.\n\n## How it works\n\nTeams ground answers in owned source material before publishing.",
  );
  await page.getByRole("button", { name: "Run Pillar Article" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("pillar-article-markdown")).toContainText("AI content readiness");
  await expect(page.getByTestId("pillar-grounded-count")).toContainText("grounded");
  await expect(page.getByText(/pillarArticle\.v1 · valid/)).toBeVisible();
});

test("AI Readiness partial source completeness omits overall score", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await expect(page.getByLabel("Source completeness")).toBeVisible();
  await page.getByLabel("Source completeness").selectOption("partial");
  await page.getByLabel("Visible page content").fill(
    "Fragment of a page without a complete heading structure.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("readiness-overall-score")).toHaveText("—");
  await expect(page.getByTestId("readiness-partial-overall")).toBeVisible();
  await expect(page.getByTestId("readiness-warnings")).toContainText("marked partial");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/task-agents/ai-readiness/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const payload = JSON.parse(runPost!.body!) as {
    input?: { document?: { contentCompleteness?: string } };
  };
  expect(payload.input?.document?.contentCompleteness).toBe("partial");
});

test("AI Readiness technical signals populate the seventh dimension", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByLabel("Page crawlable").selectOption("yes");
  await page.getByLabel("HTTP status code").fill("200");
  await page.getByLabel("Load time (ms)").fill("1200");
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("readiness-overall-score")).not.toHaveText("—");
  await expect(
    page.locator('[data-result-renderer="scorecard"]').getByText("technicalCrawlabilityPerformance", { exact: true }),
  ).toBeVisible();
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/task-agents/ai-readiness/runs"
  );
  expect(runPost?.body).toBeTruthy();
  expect(runPost!.body!).toContain('"technical"');
  expect(runPost!.body!).toContain('"loadTimeMs":1200');
});

test("content gap partial subject yields coverageUnknown warnings", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/content-gap");
  await expect(page.getByLabel("Subject source completeness")).toBeVisible();
  await page.getByLabel("Subject source completeness").selectOption("partial");
  await page.getByLabel("Subject page content").fill("# Ours\n\nFragment without full proof section.");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run Content Gap Finder" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="gap-report"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Content gaps" })).toContainText("coverageUnknown");
  await expect(page.getByTestId("gap-report-warnings")).toContainText("coverageUnknown");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/task-agents/content-gap/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const payload = JSON.parse(runPost!.body!) as {
    input?: { subjectPages?: Array<{ contentCompleteness?: string }> };
  };
  expect(payload.input?.subjectPages?.[0]?.contentCompleteness).toBe("partial");
});

test("AI readiness comparison partial subject keeps unknown score", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness-comparison");
  await expect(page.getByLabel("Subject source completeness")).toBeVisible();
  await page.getByLabel("Subject source completeness").selectOption("partial");
  await page.getByLabel("Subject page content").fill("# Our page\n\nFragment.");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run AI Readiness Comparison" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("score-matrix-subject-score")).toHaveText("—");
  await expect(page.getByTestId("score-matrix-warnings")).toContainText("partial");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST"
    && entry.path === "/api/geek-content-creator-v2/task-agents/ai-readiness-comparison/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const payload = JSON.parse(runPost!.body!) as {
    input?: { subjectPage?: { contentCompleteness?: string } };
  };
  expect(payload.input?.subjectPage?.contentCompleteness).toBe("partial");
});

test("competitor audit partial subject keeps coverageUnknown origin", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/competitor-audit");
  await expect(page.getByLabel("Subject source completeness")).toBeVisible();
  await page.getByLabel("Subject source completeness").selectOption("partial");
  await page.getByLabel("Subject page content").fill("# Ours\n\nFragment.");
  await page.getByLabel("Competitor 1 page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run Competitor Audit" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Prioritized actions" })).toContainText("coverageUnknown");
  await expect(page.getByTestId("audit-report-warnings")).toContainText("coverageUnknown");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/task-agents/competitor-audit/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const payload = JSON.parse(runPost!.body!) as {
    input?: { subjectPages?: Array<{ contentCompleteness?: string }> };
  };
  expect(payload.input?.subjectPages?.[0]?.contentCompleteness).toBe("partial");
});

test("competitor positioning partial brand yields coverageUnknown gaps", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/competitor-positioning");
  await expect(page.getByLabel("Subject source completeness")).toBeVisible();
  await page.getByLabel("Subject source completeness").selectOption("partial");
  await page.getByLabel("Brand page content").fill("# Brand\n\nFragment.");
  await page.getByLabel("Competitor page content").fill("# Rival\n\nThe fastest AI writing tool.");
  await page.getByRole("button", { name: "Run Competitor Positioning" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Perception gaps" })).toContainText("coverageUnknown");
  await expect(page.getByTestId("positioning-warnings")).toContainText("coverageUnknown");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST"
    && entry.path === "/api/geek-content-creator-v2/task-agents/competitor-positioning/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const payload = JSON.parse(runPost!.body!) as {
    input?: { brandPages?: Array<{ contentCompleteness?: string }> };
  };
  expect(payload.input?.brandPages?.[0]?.contentCompleteness).toBe("partial");
});

test("citable claims partial source marks confidence unknown", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/citable-claims");
  await expect(page.getByLabel("Source completeness")).toBeVisible();
  await page.getByLabel("Source completeness").selectOption("partial");
  await page.getByLabel("Source content").fill(
    "Trusted by 500 customer teams across regulated industries.",
  );
  await page.getByRole("button", { name: "Run Citable Claims" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("claim-ledger-warnings")).toContainText("partial");
  await expect(page.locator('[data-contradiction="unknown"]').first()).toBeVisible();
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/task-agents/citable-claims/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const payload = JSON.parse(runPost!.body!) as {
    input?: { sourceDocument?: { contentCompleteness?: string } };
  };
  expect(payload.input?.sourceDocument?.contentCompleteness).toBe("partial");
});

test("comparison brief partial subject keeps unknown coverage", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/comparison-brief");
  await expect(page.getByLabel("Subject source completeness")).toBeVisible();
  await page.getByLabel("Subject source completeness").selectOption("partial");
  await page.getByLabel("Subject name").fill("Subject Analyzer");
  await page.getByLabel("Competitor 1 name").fill("Competitor Inc.");
  await page.getByLabel("Subject page content").fill("# Subject\n\nPartial fragment.");
  await page.getByLabel("Competitor 1 page content").fill("# Competitor\n\nPlans start at $20 per month.");
  await page.getByRole("button", { name: "Run Comparison Brief" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.getByTestId("comparison-brief-warnings")).toContainText("partial");
  await expect(page.getByTestId("brief-verdict")).toContainText("unknown");
  const requests = await (await request.get(`${platformOrigin}/__requests`)).json() as Array<{
    path?: string;
    method?: string;
    body?: string;
  }>;
  const runPost = [...requests].reverse().find((entry) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/task-agents/comparison-brief/runs"
  );
  expect(runPost?.body).toBeTruthy();
  const payload = JSON.parse(runPost!.body!) as {
    input?: { subjectPages?: Array<{ contentCompleteness?: string }> };
  };
  expect(payload.input?.subjectPages?.[0]?.contentCompleteness).toBe("partial");
});

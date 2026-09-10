import { expect, test } from "@playwright/test";
import { openAuthenticated, platformOrigin, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("task-agent catalog runs a diagnostic and renders its durable result", async ({ page }) => {
  await openAuthenticated(page, "/task-agents");
  await expect(page.getByRole("heading", { name: "Task Agents" })).toBeVisible();
  await page.getByRole("link", { name: "Open agent" }).first().click();
  await expect(page.getByLabel("Task agent input form")).toBeVisible();
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();

  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="scorecard"]')).toBeVisible();
  await expect(page.getByText("82", { exact: true })).toBeVisible();
  await expect(page.getByText(/readinessScore\.v1 · valid/)).toBeVisible();
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
  await page.getByLabel("SEO project ID (GSC)").fill("11111111-1111-4111-8111-111111111111");
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
  await expect(page.getByRole("listitem").filter({ hasText: "Trusted by 500 customer teams." })).toBeVisible();
  await expect(page.getByTestId("contradiction-summary")).toContainText("Possible contradictions");
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
  await page.getByLabel("Competitor page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run AI Readiness Comparison" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="score-matrix"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Dimension deltas" })).toContainText("factDensity");
  await expect(page.getByText(/readinessComparison\.v1 · valid/)).toBeVisible();
});

test("content gap finder renders gap-report opportunities", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/content-gap");
  await expect(page.getByRole("heading", { name: "Content Gap Finder" })).toBeVisible();
  await page.getByLabel("Subject page content").fill("# Ours\n\nGeneral overview.");
  await page.getByLabel("Competitor page content").fill("# Rival\n\nTrusted by 500 teams.");
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
  await page.getByLabel("Competitor page content").fill("# Rival\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run Competitor Audit" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="audit-report"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Prioritized actions" })).toContainText("customer-count");
  await expect(page.getByText(/competitorAudit\.v1 · valid/)).toBeVisible();
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
  await page.getByLabel("Competitor name").fill("Competitor Inc.");
  await page.getByLabel("Subject page content").fill("# Subject\n\nPlans start at $15 per month.");
  await page.getByLabel("Competitor page content").fill("# Competitor\n\nPlans start at $20 per month.");
  await page.getByRole("button", { name: "Run Comparison Brief" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="comparison-brief"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Comparison criteria" })).toContainText("pricing");
  await expect(page.getByTestId("brief-verdict")).toContainText("Subject Analyzer");
  await expect(page.getByText(/comparisonBrief\.v1 · valid/)).toBeVisible();
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

test("competitive response content agent renders response-plan mode", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/competitive-response");
  await expect(page.getByRole("heading", { name: "Competitive Response" })).toBeVisible();
  await page.getByLabel("Brand name").fill("Brand Analyzer");
  await page.getByLabel("Competitor name").fill("Competitor Inc.");
  await page.getByLabel("Brand page content").fill("# Brand Analyzer\n\nSupports Markdown analysis.");
  await page.getByLabel("Competitor page content").fill("# Competitor\n\nTrusted by 500 teams.");
  await page.getByRole("button", { name: "Run Competitive Response" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  await expect(page.locator('[data-result-renderer="response-plan"]')).toBeVisible();
  await expect(page.getByTestId("response-mode")).toHaveText("counterNarrative");
  await expect(page.getByRole("list", { name: "Response outline" })).toContainText("Why choose Brand Analyzer?");
  await expect(page.getByText(/competitiveResponse\.v1 · valid/)).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "FAQ Generator" })).toBeVisible();
  await expect(page.getByText(/This run will derive from artifact/)).toBeVisible();
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

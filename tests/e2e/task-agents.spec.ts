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

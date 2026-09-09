import { expect, test } from "@playwright/test";
import { openAuthenticated, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("task-agent catalog runs a diagnostic and renders its durable result", async ({ page }) => {
  await openAuthenticated(page, "/task-agents");
  await expect(page.getByRole("heading", { name: "Task Agents" })).toBeVisible();
  await page.getByRole("link", { name: "Open agent" }).first().click();
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();

  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible();
  await expect(page.getByText("82", { exact: true })).toBeVisible();
  await expect(page.getByText(/readinessScore\.v1 · valid/)).toBeVisible();
});

test("query planner intelligence agent keeps demand as heuristic", async ({ page }) => {
  await openAuthenticated(page, "/task-agents");
  await page.getByRole("link", { name: "Open agent" }).nth(1).click();
  await expect(page.getByRole("heading", { name: "Query Planner" })).toBeVisible();
  await expect(page.getByText("Runnable intelligence")).toBeVisible();
  await page.getByLabel("Hypothesis topics").fill("AI content readiness");
  await page.getByRole("button", { name: "Run Query Planner" }).click();
  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: /not traffic, volume, ranking, or demand measurements/ })).toBeVisible();
  await expect(page.getByText(/queryPlan\.v1 · valid/)).toBeVisible();
});

test("faq generator content agent renders grounded FAQ pairs", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/faq-generator");
  await expect(page.getByRole("heading", { name: "FAQ Generator" })).toBeVisible();
  await expect(page.getByText("Runnable content")).toBeVisible();
  await page.getByLabel("Topic").fill("AI content readiness");
  await page.getByLabel("FAQ questions").fill("What is AI content readiness?");
  await page.getByLabel("Source content").fill(
    "## What is AI content readiness?\n\nAI content readiness means pages provide answer-first structure, evidence, and schema that systems can cite.",
  );
  await page.getByRole("button", { name: "Run FAQ Generator" }).click();
  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "What is AI content readiness?" })).toBeVisible();
  await expect(page.getByText(/faqSet\.v1 · valid/)).toBeVisible();
});

test("citable claims content agent never invents unsupported statistics", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/citable-claims");
  await expect(page.getByRole("heading", { name: "Citable Claims" })).toBeVisible();
  await page.getByLabel("Source content").fill(
    "# Proof\n\nTrusted by 500 customer teams across regulated industries.",
  );
  await page.getByLabel("Vague statements to rewrite").fill("Our product is trusted by many teams");
  await page.getByRole("button", { name: "Run Citable Claims" }).click();
  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Trusted by 500 customer teams." })).toBeVisible();
  await expect(page.getByText(/claimLedger\.v1 · valid/)).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { openAuthenticated, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("Geek Content Pipelines create AEO template, run stages, and isolate Create failure", async ({ page }) => {
  await openAuthenticated(page, "/pipelines");
  await expect(page.getByRole("heading", { name: "Compose agent stages into durable runs" })).toBeVisible();
  await expect(page.getByLabel("Lifecycle stages")).toContainText("plan");
  await expect(page.getByLabel("Lifecycle stages")).toContainText("optimize");

  await page.getByRole("button", { name: "Create AEO pipeline template" }).click();
  await expect(page.getByRole("heading", { name: "AEO content pipeline" })).toBeVisible();
  await expect(page.getByLabel("Pipeline stages")).toContainText("Query Planner");
  await expect(page.getByLabel("Pipeline stages")).toContainText("FAQ Generator");
  await expect(page.getByLabel("Pipeline stages")).toContainText("Canvas adapt");
  await expect(page.getByLabel("Pipeline stages")).toContainText("Publish handoff");
  await expect(page.getByLabel("Pipeline stages")).toContainText("AI Readiness Score");
  await expect(page.getByLabel("Pipeline stages")).toContainText("ROI Business Calculator");

  await page.getByRole("button", { name: "Run pipeline" }).click();
  await expect(page.getByLabel("Latest pipeline run")).toContainText("succeeded");
  await expect(page.getByTestId("pipeline-stage-plan-queries")).toContainText("succeeded");
  await expect(page.getByTestId("pipeline-stage-optimize-readiness")).toContainText("succeeded");
  await expect(page.getByTestId("pipeline-stage-optimize-roi")).toContainText("succeeded");
  await expect(page.getByTestId("pipeline-stage-optimize-roi")).toContainText("roiProjection.v1");

  await page.getByRole("button", { name: "Run with Create-stage failure" }).click();
  await expect(page.getByLabel("Latest pipeline run")).toContainText("failed");
  await expect(page.getByTestId("pipeline-stage-create-faq")).toContainText("failed");
  await expect(page.getByTestId("pipeline-stage-adapt-canvas")).toContainText("skipped");
  await expect(page.getByTestId("pipeline-stage-optimize-readiness")).toContainText("skipped");
  await expect(page.getByTestId("pipeline-stage-optimize-roi")).toContainText("skipped");
});

import { expect, test } from "@playwright/test";
import { openAuthenticated, skipIfNoE2eAuth } from "./helpers";

test.beforeEach(({}, testInfo) => {
  skipIfNoE2eAuth(testInfo);
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
  await expect(page.getByLabel("Pipeline stages")).toContainText("Approve for publish");
  await expect(page.getByLabel("Pipeline stages")).toContainText("Publish handoff");
  await expect(page.getByLabel("Pipeline stages")).toContainText("AI Readiness Score");
  await expect(page.getByLabel("Pipeline stages")).toContainText("ROI Business Calculator");

  await page.getByRole("button", { name: "Run pipeline" }).click();
  await expect(page.getByLabel("Latest pipeline run")).toContainText("awaiting-approval");
  await expect(page.getByTestId("pipeline-stage-plan-queries")).toContainText("succeeded");
  await expect(page.getByTestId("pipeline-stage-plan-queries")).toContainText("queryPlan.v1");
  await expect(page.getByTestId("pipeline-task-run-plan-queries")).toContainText("TaskRun");
  await expect(page.getByTestId("pipeline-stage-create-faq")).toContainText("faqSet.v1");
  await expect(page.getByTestId("pipeline-task-run-create-faq")).toContainText("TaskRun");
  await expect(page.getByTestId("pipeline-canvas-adapt-canvas")).toContainText("Canvas");
  await expect(page.getByTestId("pipeline-approval-approve-publish")).toContainText("Awaiting operator approval");
  await expect(page.getByTestId("pipeline-publish-activate-publish")).toHaveCount(0);

  await page.getByRole("button", { name: "Approve & continue" }).click();
  await expect(page.getByLabel("Latest pipeline run")).toContainText("succeeded");
  await expect(page.getByTestId("pipeline-approved-approve-publish")).toContainText("Approved");
  await expect(page.getByTestId("pipeline-publish-activate-publish")).toContainText("Ready to publish");
  await expect(page.getByTestId("pipeline-stage-optimize-readiness")).toContainText("succeeded");
  await expect(page.getByTestId("pipeline-stage-optimize-readiness")).toContainText("readinessScore.v1");
  await expect(page.getByTestId("pipeline-task-run-optimize-readiness")).toContainText("TaskRun");
  await expect(page.getByTestId("pipeline-stage-optimize-roi")).toContainText("succeeded");
  await expect(page.getByTestId("pipeline-stage-optimize-roi")).toContainText("roiProjection.v1");
  await expect(page.getByTestId("pipeline-task-run-optimize-roi")).toHaveCount(0);

  await page.getByRole("button", { name: "Run with Create-stage failure" }).click();
  await expect(page.getByLabel("Latest pipeline run")).toContainText("failed");
  await expect(page.getByTestId("pipeline-stage-create-faq")).toContainText("failed");
  await expect(page.getByTestId("pipeline-stage-adapt-canvas")).toContainText("skipped");
  await expect(page.getByTestId("pipeline-stage-approve-publish")).toContainText("skipped");
  await expect(page.getByTestId("pipeline-stage-optimize-readiness")).toContainText("skipped");
  await expect(page.getByTestId("pipeline-stage-optimize-roi")).toContainText("skipped");
});

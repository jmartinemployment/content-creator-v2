import { expect, test } from "@playwright/test";
import { openAuthenticated, skipIfNoE2eAuth, getGccV2RequestLog, skipIfScenarioInjectionRequired } from "./helpers";

test.beforeEach(({}, testInfo) => {
  skipIfNoE2eAuth(testInfo);
});

test("task agent run hub completes without status GET polling", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  const requests = getGccV2RequestLog(page) as Array<{
    method?: string;
    path?: string;
  }>;
  const statusGets = requests.filter((entry) =>
    entry.method === "GET"
    && typeof entry.path === "string"
    && /\/task-agents\/runs\/[^/]+$/.test(entry.path));
  expect(statusGets.length).toBe(0);
});

test("unauthorized task agent run join surfaces an error", async ({ page }, testInfo) => {
  skipIfScenarioInjectionRequired(testInfo);
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByText(/Could not join task run updates|Unauthorized task agent run join/i)).toBeVisible();
});

test("task agent run shows progress then result from hub events", async ({ page }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByText(/queued|running|succeeded/i).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
});

test("task agent cancel is confirmed by hub cancelled state", async ({ page }, testInfo) => {
  skipIfScenarioInjectionRequired(testInfo);
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByText("running", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel run" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
});

test("terminal success fetches result once", async ({ page, request }) => {
  await openAuthenticated(page, "/task-agents/ai-readiness");
  await page.getByLabel("Visible page content").fill(
    "# Reliable AI content\n\nThis page provides specific evidence and clear answers for readers.",
  );
  await page.getByRole("button", { name: "Run AI Readiness Score" }).click();
  await expect(page.getByRole("region", { name: "Task result" })).toBeVisible();
  const requests = getGccV2RequestLog(page) as Array<{
    method?: string;
    path?: string;
  }>;
  const resultGets = requests.filter((entry) =>
    entry.method === "GET"
    && typeof entry.path === "string"
    && /\/task-agents\/runs\/[^/]+\/result$/.test(entry.path));
  expect(resultGets.length).toBe(1);
});

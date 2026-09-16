import { expect, test } from "@playwright/test";
import { openAuthenticated, skipIfNoE2eAuth, skipIfScenarioInjectionRequired,
  fillRequiredPartnerTool,
} from "./helpers";

test.beforeEach(({}, testInfo) => {
  skipIfNoE2eAuth(testInfo);
});

test("legacy /rag is 404 — Create is the only authoring path", async ({ page }) => {
  await openAuthenticated(page, "/rag?topic=hello-world&writingIntent=blog");
  await expect(page.getByText(/404|not found|this page could not be found/i)).toBeVisible();
  await expect(page).not.toHaveURL(/\/creates\/new/);
});

test("canonical Create offers all 17 content types and relevant RAG capabilities", async ({ page }) => {
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await fillRequiredPartnerTool(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Main format").locator("option")).toHaveCount(17);
  await page.getByLabel("Main format").selectOption("ads");
  await expect(page.getByText(/Short-form drafting with verified evidence/)).toBeVisible();
  await page.getByLabel("Main format").selectOption("linkedin-document");
  await expect(page.getByText(/slide-oriented PDF with connected strategy themes/i)).toBeVisible();
});

test("o3-only policy requires explicit quality-tradeoff confirmation", async ({ page }) => {
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await fillRequiredPartnerTool(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Working title").fill("Explicit model policy");
  await fillRequiredPartnerTool(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillRequiredPartnerTool(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillRequiredPartnerTool(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByText(/Advanced run settings/).click();
  await page.getByRole("radio", { name: /Faster run/ }).check();
  await expect(page.getByText("I understand the quality tradeoff.")).toBeVisible();
  await page.getByText("I understand the quality tradeoff.").click();
  await expect(page.getByRole("checkbox", { name: "I understand the quality tradeoff." })).toBeChecked();
  await expect(page.getByText("Advanced run settings · Quality: Custom")).toBeVisible();
});

test("RAG unavailable state is an inline canonical quality gate", async ({ page }, testInfo) => {
  skipIfScenarioInjectionRequired(testInfo);
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await fillRequiredPartnerTool(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Working title").fill("Unavailable research");
  await fillRequiredPartnerTool(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillRequiredPartnerTool(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Research readiness")).toContainText("Research is temporarily unavailable");
  await expect(page.getByText("Deterministic RAG outage.")).toBeVisible();
});

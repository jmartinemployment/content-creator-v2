import { expect, test } from "@playwright/test";
import { openAuthenticated, platformOrigin, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("legacy RAG URL redirects to canonical Create and migrates topic and intent", async ({ page }) => {
  await openAuthenticated(
    page,
    "/rag?topic=Reliable%20content%20operations&intent=Technical%20Article",
  );
  await expect(page).toHaveURL(
    /\/creates\/new\?topic=Reliable\+content\+operations&intent=Technical\+Article/,
  );
  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Working title")).toHaveValue("Reliable content operations");
  await expect(page.getByLabel("Main format")).toHaveValue("tech-article");
});

test("canonical Create offers all 17 content types and relevant RAG capabilities", async ({ page }) => {
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Main format").locator("option")).toHaveCount(17);
  await page.getByLabel("Main format").selectOption("ads");
  await expect(page.getByText(/Short-form drafting with verified evidence/)).toBeVisible();
  await page.getByLabel("Main format").selectOption("linkedin-document");
  await expect(page.getByText(/Slide-oriented drafting with connected strategy themes/)).toBeVisible();
});

test("o3-only policy requires explicit quality-tradeoff confirmation", async ({ page }) => {
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Working title").fill("Explicit model policy");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByText(/Advanced run settings/).click();
  await page.getByRole("radio", { name: /Faster run/ }).check();
  await expect(page.getByText("I understand the quality tradeoff.")).toBeVisible();
  await page.getByText("I understand the quality tradeoff.").click();
  await expect(page.getByRole("checkbox", { name: "I understand the quality tradeoff." })).toBeChecked();
  await expect(page.getByText("Advanced run settings · Quality: Custom")).toBeVisible();
});

test("RAG unavailable state is an inline canonical quality gate", async ({ page, request }) => {
  await request.post(`${platformOrigin}/__scenario`, { data: { ragAvailable: false } });
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Working title").fill("Unavailable research");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Research readiness")).toContainText("Research is temporarily unavailable");
  await expect(page.getByText("Deterministic RAG outage.")).toBeVisible();
});

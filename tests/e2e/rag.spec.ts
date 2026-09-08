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
  await expect(page.getByLabel("Title")).toHaveValue("Reliable content operations");
  await expect(page.getByLabel("Primary draft")).toHaveValue("tech-article");
});

test("canonical Create offers all 17 content types and relevant RAG capabilities", async ({ page }) => {
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Primary draft").locator("option")).toHaveCount(17);
  await page.getByLabel("Primary draft").selectOption("ads");
  await expect(page.getByText("Short-form template variations")).toBeVisible();
  await expect(page.getByText("Short-form evidence templates")).toBeVisible();
  await page.getByLabel("Primary draft").selectOption("comparison");
  await expect(page.getByText("Partner / competitor battlecard")).toBeVisible();
  await page.getByLabel("Primary draft").selectOption("linkedin-document");
  await expect(page.getByText("Slide preview")).toBeVisible();
  await expect(page.getByText("GraphRAG strategy themes")).toBeVisible();
});

test("o3-only policy requires explicit quality-tradeoff confirmation", async ({ page }) => {
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Title").fill("Explicit model policy");
  await page.getByText(/Advanced model policy/).click();
  await page.getByRole("radio", { name: /o3 only/ }).check();
  await page.getByRole("button", { name: "Find partner tools" }).click();
  await expect(page.getByText("Confirm the model-policy quality tradeoff")).toBeVisible();
  await page.getByLabel("I understand and accept the quality tradeoff.").check();
  await page.getByRole("button", { name: "Find partner tools" }).click();
  await expect(page.getByRole("heading", { name: "Confirm partner tools" })).toBeVisible();
});

test("RAG unavailable state is an inline canonical quality gate", async ({ page, request }) => {
  await request.post(`${platformOrigin}/__scenario`, { data: { ragAvailable: false } });
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Research and evidence readiness")).toContainText("Blocked");
  await expect(page.getByText("Deterministic RAG outage.")).toBeVisible();
});

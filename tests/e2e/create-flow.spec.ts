import { expect, test } from "@playwright/test";
import { openAuthenticated, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("critical create flow reaches approved, validated canvas with replay-safe attribution", async ({ page }) => {
  await openAuthenticated(page, "/creates/new");

  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Writing for:")).toBeVisible();

  await page.getByLabel("Title").fill("Reliable Content Operations");
  await page.getByLabel("Target keyword").fill("deterministic content workflow");
  await page.getByRole("button", { name: "Find partner tools" }).click();
  await expect(page.getByRole("heading", { name: "Confirm partner tools" })).toBeVisible();
  await expect(page.getByText("Evidence Engine")).toBeVisible();
  await page.getByRole("button", { name: "Confirm tools & generate" }).click();

  await expect(page).toHaveURL(/\/creates\/create-1\?jobId=job-1/);
  await expect(page.getByRole("heading", { name: "Brand kit awaiting approval" })).toBeVisible();
  await expect(page.getByLabel("Company")).toHaveValue("Example Systems");
  await page.getByRole("button", { name: "Accept brand kit" }).click();

  await expect(page.getByRole("heading", { name: "Outline awaiting approval" })).toBeVisible();
  await page.getByLabel("Outline section 1 heading").fill("Why deterministic reliability matters");
  await page.getByRole("button", { name: "Save & approve outline" }).click();

  await expect(page.getByRole("heading", { name: "Why reliability matters" })).toBeVisible();
  await expect(page.getByText("Ship ready:")).toBeVisible();
  await expect(page.getByText("status: ready")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reliable content operations" })).toHaveAttribute(
    "href",
    "https://example.test/reliable-content",
  );

  await page.getByText(/^Event log/).click();
  await expect(page.locator("text=SectionDrafted")).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Why reliability matters" })).toBeVisible();
  await expect(page.getByText("status: ready")).toBeVisible();
});

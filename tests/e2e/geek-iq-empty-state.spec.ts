import { expect, test } from "@playwright/test";
import { openAuthenticated, skipIfNoE2eAuth } from "./helpers";

test.beforeEach(({}, testInfo) => {
  skipIfNoE2eAuth(testInfo);
});

const EMPTY_CATALOG = { items: [] };

async function stubEmptyGeekIqCatalogs(page: import("@playwright/test").Page) {
  const emptyPaths = [
    "**/api/gcc-v2/knowledge",
    "**/api/gcc-v2/brand-kits",
    "**/api/gcc-v2/audiences",
    "**/api/gcc-v2/style-guides",
    "**/api/gcc-v2/visual-guidelines",
    "**/api/gcc-v2/products",
    "**/api/gcc-v2/product-schemas",
  ];
  for (const path of emptyPaths) {
    await page.route(path, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(EMPTY_CATALOG),
      });
    });
  }
}

async function reachReviewWithEmptyGeekIq(page: import("@playwright/test").Page) {
  await stubEmptyGeekIqCatalogs(page);
  await openAuthenticated(page, "/creates/new");
  const siteUrl = page.getByLabel("Project site URL");
  if (!(await siteUrl.inputValue())) {
    await siteUrl.fill("example.test");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  const title = page.getByLabel("Working title");
  if (!(await title.inputValue())) {
    await title.fill("Geek IQ empty state");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const searchPhrase = page.getByLabel("Primary search phrase");
  if (!(await searchPhrase.inputValue())) {
    await searchPhrase.fill("empty geek iq");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByRole("heading", { name: "Ready to create" })).toBeVisible();
}

test("Geek IQ shows one empty state instead of disabled selects", async ({ page }) => {
  await reachReviewWithEmptyGeekIq(page);
  const geekIq = page.getByRole("region", { name: "Geek IQ" });
  await expect(geekIq.getByTestId("geek-iq-empty-state")).toBeVisible();
  await expect(geekIq.getByRole("link", { name: "Set up Geek IQ" }).first()).toBeVisible();
  await expect(geekIq.getByTestId("geek-iq-catalog-fields")).toHaveCount(0);
  await expect(geekIq.getByLabel("Audience")).toHaveCount(0);
  await expect(geekIq.getByLabel("Style Guide")).toHaveCount(0);
  await expect(geekIq.locator("select:disabled")).toHaveCount(0);
  await expect(geekIq.getByLabel("Context locale")).toBeEnabled();
  await expect(geekIq.getByRole("button", { name: /Check/ })).toBeVisible();
});

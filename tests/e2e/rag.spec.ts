import { expect, test } from "@playwright/test";
import { openAuthenticated, platformOrigin, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("one-shot RAG displays intent result and exact verified citation", async ({ page, request }) => {
  await openAuthenticated(page, "/rag");
  await expect(page.getByText(/Citeable workflow on/)).toBeVisible();
  await page.getByLabel("Topic").fill("Reliable content operations");
  await page.getByRole("button", { name: "Generate from RAG" }).click();

  await expect(page.getByRole("heading", { name: "Draft" })).toBeVisible();
  const fixture = await (await request.get(`${platformOrigin}/__fixture`)).json();
  await expect(page.getByText(`“${fixture.quote}”`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Reliable content operations" }).first()).toHaveAttribute(
    "href",
    "https://example.test/reliable-content",
  );
});

test("ad templates persist and are applied to short-form generation", async ({ page }) => {
  await openAuthenticated(page, "/rag");
  await page.getByLabel("Writing intent").selectOption("Social Ad");
  await page.getByPlaceholder("Template name").fill("E2E PAS");
  await page.getByPlaceholder("Paste exemplar copy").fill("Problem. Agitate the risk. Solve with verified evidence.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("E2E PAS")).toBeVisible();

  await page.reload();
  await page.getByLabel("Writing intent").selectOption("Social Ad");
  await expect(page.getByText("E2E PAS")).toBeVisible();
  await page.getByText("E2E PAS").click();
  await page.getByLabel("Topic").fill("Grounded publishing");
  await page.getByRole("button", { name: "Generate from RAG" }).click();
  await expect(page.getByRole("heading", { name: "Templates applied" })).toBeVisible();
  await expect(page.getByText("Reliable evidence. Better publishing.")).toBeVisible();
});

test("guided writer supports outline edits, section retry, write-all, citations, and Markdown assembly", async ({ page }) => {
  await openAuthenticated(page, "/rag");
  await page.getByLabel("Topic").fill("Reliable content operations");
  await page.getByRole("checkbox", { name: /Guided outline/ }).check();
  await page.getByRole("button", { name: "Generate outline" }).click();

  const firstHeading = page.getByLabel("Section 1 heading");
  await expect(firstHeading).toHaveValue("Evidence-led planning");
  await firstHeading.fill("Approval-led planning");
  await page.getByRole("button", { name: "Write section" }).first().click();
  await expect(page.getByText("Transient deterministic section failure")).toBeVisible();
  await page.getByRole("button", { name: "Write section" }).first().click();
  await expect(page.getByRole("article").first().locator("pre")).toContainText("Approval-led planning:");

  await page.getByRole("button", { name: "Write all remaining" }).click();
  await expect(page.getByRole("article").nth(1).locator("pre")).toContainText("Verified publishing:");
  await expect(page.getByRole("article").first().getByText("Verified citations", { exact: true })).toBeVisible();
  await expect(page.getByRole("article").nth(1).getByText("Verified citations", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assembled draft" })).toBeVisible();
  await expect(page.getByText(/## Approval-led planning/)).toBeVisible();
});

test("RAG unavailable state disables generation with a useful reason", async ({ page, request }) => {
  await request.post(`${platformOrigin}/__scenario`, { data: { ragAvailable: false } });
  await openAuthenticated(page, "/rag");
  await expect(page.getByText("RAG generate unavailable")).toBeVisible();
  await expect(page.getByText("Deterministic RAG outage.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate from RAG" })).toBeDisabled();
});

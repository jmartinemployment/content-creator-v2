import { expect, test } from "@playwright/test";
import { openAuthenticated, platformOrigin, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("skills area explains approved automatic skills and goal bundles", async ({ page }) => {
  await openAuthenticated(page, "/skills");

  await expect(page.getByRole("heading", { name: "Skills", exact: true })).toBeVisible();
  await expect(page.getByText("Automatic and read-only")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Technical authority" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Citation Discipline" })).toBeVisible();
  await expect(page.getByText("Catalog gcc-safe-skills.2026-09-08")).toBeVisible();
});

test("guided create flow reaches approved, validated canvas with citations and provenance", async ({ page, request }) => {
  await openAuthenticated(page, "/creates/new");

  await page.getByLabel("Project site URL").fill("example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to create?" })).toBeVisible();

  await page.getByLabel("Working title").fill("Reliable Content Operations");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "+ Evidence Engine" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("Research readiness")).toContainText("Research is ready");
  await page.getByLabel("Primary search phrase").fill("deterministic content workflow");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("Approved skills are selected automatically.")).toBeVisible();
  await page.getByText(/Advanced run settings/).click();
  await expect(page.getByRole("radio", { name: /Best available/ })).toBeChecked();
  await page.getByRole("button", { name: "Create content" }).click();
  await expect(page.getByRole("heading", { name: "Confirm the partners we found" })).toBeVisible();
  await expect(page.getByText("Evidence Engine")).toBeVisible();
  await page.getByRole("button", { name: "Confirm partners & create" }).click();

  await expect(page).toHaveURL(/\/creates\/create-1\?jobId=job-1/);
  const platformRequests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const generateRequest = platformRequests.find(
    (entry: { path: string }) =>
      entry.path === "/api/geek-content-creator-v2/creates/create-1/generate",
  );
  const generateBody = JSON.parse(generateRequest.body);
  expect(generateBody.modelPolicy).toEqual({
    version: "content-model-policy.v1",
    preset: "best-quality",
  });
  expect(generateBody.brief.targetEntities).toEqual(["Evidence Engine"]);
  await expect(page.getByRole("heading", { name: "Brand kit awaiting approval" })).toBeVisible();
  await expect(page.getByLabel("Company")).toHaveValue("Example Systems");
  await page.getByRole("button", { name: "Accept brand kit" }).click();

  await expect(page.getByRole("heading", { name: "Outline awaiting approval" })).toBeVisible();
  await expect(page.getByLabel("Outline section 1 purpose")).toContainText("Opening context");
  await expect(page.getByLabel("Outline section 2 purpose")).toContainText("Core section");
  await page.getByLabel("Outline section 1 heading").fill("Why deterministic reliability matters");
  await page.getByRole("button", { name: "Save & approve" }).click();

  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.getByRole("heading", { name: "Why reliability matters" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.getByText("Verified citations", { exact: true }).first()).toBeVisible();
  await page.getByText("Technical details", { exact: true }).click();
  await expect(page.getByText("Status: ready")).toBeVisible();
  await expect(page.getByText("Model: o1-pro")).toBeVisible();
  await expect(page.getByText("Retrieval: hybrid", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reliable content operations" }).first()).toHaveAttribute(
    "href",
    "https://example.test/reliable-content",
  );

  await page.getByText(/^Event log/).click();
  await expect(page.locator("text=SectionDrafted")).toHaveCount(1);

  await page.getByRole("button", { name: "Edit content" }).click();
  const exactContent = page.getByLabel("Exact content for Why reliability matters");
  await exactContent.fill("This canceled edit must not be saved.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("This canceled edit must not be saved.")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit content" }).click();
  await page.getByLabel("Exact content for Why reliability matters").fill(
    "Operator-authored exact content survives reload without an AI rewrite.",
  );
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByRole("paragraph").filter({
    hasText: "Operator-authored exact content survives reload without an AI rewrite.",
  })).toBeVisible();

  await page.getByRole("tab", { name: /Assets/ }).click();
  await expect(page.getByRole("heading", { name: "Drafts and generated outputs" })).toBeVisible();
  await page.getByRole("button", { name: "Generate carousel PDF" }).click();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy caption" })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /Assets/ }).click();
  await expect(page.getByText("2 slides · Reliable_Content_Operations.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy caption" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(download).resolves.toBeTruthy();
  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.getByRole("heading", { name: "Why reliability matters" })).toBeVisible();
  await expect(page.getByText(
    "Operator-authored exact content survives reload without an AI rewrite.",
    { exact: true },
  )).toBeVisible();
});

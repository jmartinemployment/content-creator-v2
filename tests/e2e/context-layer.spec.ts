import { expect, test, type Page } from "@playwright/test";
import { openAuthenticated, platformOrigin, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

async function reachContextReview(page: Page, open = true) {
  if (open) {
    await openAuthenticated(page, "/creates/new");
  }
  const siteUrl = page.getByLabel("Project site URL");
  if (!open) {
    await expect(siteUrl).toHaveValue("example.test");
  } else if (!(await siteUrl.inputValue())) {
    await siteUrl.fill("example.test");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  const title = page.getByLabel("Working title");
  if (!(await title.inputValue())) {
    await title.fill("Governed Context Content");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  const addEvidenceEngine = page.getByRole("button", { name: "+ Evidence Engine" });
  if (await addEvidenceEngine.isVisible()) {
    await addEvidenceEngine.click();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  const searchPhrase = page.getByLabel("Primary search phrase");
  if (!(await searchPhrase.inputValue())) {
    await searchPhrase.fill("governed context");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByRole("heading", { name: "Ready to create" })).toBeVisible();
}

test("Brand and source catalogs expose lifecycle, provenance, and ingestion activity", async ({ page }) => {
  await openAuthenticated(page, "/brand-sources");
  await expect(page.getByRole("heading", { name: "Brand & Source Library" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brand & Sources" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Editorial Handbook" })).toBeVisible();
  await expect(page.getByText("plain-text 1.0.0")).toBeVisible();
  await page.getByRole("tab", { name: "Audiences" }).click();
  await expect(page.getByRole("heading", { name: "Technical Leaders" })).toBeVisible();
  await page.getByRole("button", { name: "revoke" }).click();
  await expect(page.getByText("Technical Leaders revoked.")).toBeVisible();
  await page.getByRole("button", { name: "Connections & activity" }).click();
  await expect(page.getByRole("heading", { name: "Ingestion activity" })).toBeVisible();
  await expect(page.getByText("Editorial handbook indexed")).toBeVisible();
});

test("approved source upload sends bytes directly to issued storage URL and finalizes with JSON", async ({ page, request }) => {
  await openAuthenticated(page, "/brand-sources");
  await page.getByLabel("Upload additional reference").setInputFiles({
    name: "source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Private governed source"),
  });
  await expect(page.getByRole("status")).toContainText("Upload verified");

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const storage = requests.find((entry: { path: string }) => entry.path === "/storage/upload-1");
  expect(storage).toMatchObject({ method: "PUT", directStorage: true, byteLength: 23 });
  const bffUploadCalls = requests.filter((entry: { path: string }) =>
    entry.path.includes("/knowledge/uploads"),
  );
  expect(bffUploadCalls.map((entry: { path: string }) => entry.path)).toEqual([
    "/api/geek-content-creator-v2/knowledge/uploads",
    "/api/geek-content-creator-v2/knowledge/uploads/upload-1/complete",
  ]);
  expect(JSON.parse(bffUploadCalls[0].body)).toMatchObject({ fileName: "source.txt", byteSize: 23 });
  expect(JSON.parse(bffUploadCalls[0].body).sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.parse(bffUploadCalls[1].body).sha256).toMatch(/^[a-f0-9]{64}$/);
});

test("completed website research can be reused and promoted to the source library", async ({ page }) => {
  await openAuthenticated(page, "/creates/new");
  await page.getByLabel("Previously analyzed sites").selectOption("https://example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Using 1 page from")).toBeVisible();

  await page.getByRole("button", { name: "Add website to Source Library" }).click();
  await expect(page.getByRole("button", { name: "Added to Source Library · processing" })).toBeDisabled();
});

test("context selector restores stable IDs and shows warning versus blocking preflight", async ({ page, request }) => {
  await request.post(`${platformOrigin}/__scenario`, { data: { contextCondition: "stale" } });
  await reachContextReview(page);
  await page.getByRole("button", { name: "Create content" }).click();
  await expect(page.getByRole("heading", { name: "Confirm the partners we found" })).toBeVisible();
  await page.getByLabel("Editorial Handbook version 1").check();
  await page.getByLabel("Audience").selectOption("audience-version-1");
  await page.getByLabel("Style Guide").selectOption("style-version-1");
  await page.getByLabel("Evidence Engine product version 1").check();
  await page.getByRole("button", { name: "Check context" }).click();
  await expect(page.getByLabel("Effective context preflight")).toContainText("Editorial Handbook is stale");
  await expect(page.getByRole("button", { name: "Confirm partners & create" })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => {
    const raw = sessionStorage.getItem("gcc-v2-new-create-draft");
    return raw ? JSON.parse(raw).contextSelection?.knowledgeAssetVersionIds : null;
  })).toEqual(["knowledge-version-1"]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Confirm the partners we found" })).toBeVisible();
  await expect(page.getByLabel("Editorial Handbook version 1")).toBeChecked();
  await expect(page.getByLabel("Audience")).toHaveValue("audience-version-1");

  await request.post(`${platformOrigin}/__scenario`, { data: { contextCondition: "permission" } });
  await page.getByRole("button", { name: "Check context" }).click();
  await expect(page.getByLabel("Effective context preflight")).toContainText("You no longer have access");
  await expect(page.getByRole("button", { name: "Confirm partners & create" })).toBeDisabled();
});

test("manifest details distinguish original-context retry from refresh lineage", async ({ page, request }) => {
  await request.post(`${platformOrigin}/__scenario`, { data: { jobStatus: "failed" } });
  await openAuthenticated(page, "/creates/create-1?jobId=job-1");
  await page.getByText("Technical details", { exact: true }).click();
  await expect(page.getByLabel("Context manifest")).toContainText("manifest-1");
  await expect(page.getByLabel("Context manifest")).toContainText("run-context-manifest.v1");
  await expect(page.getByLabel("Context manifest")).toContainText("Editorial Handbook");

  await page.getByRole("button", { name: "Retry with original context" }).click();
  await expect(page).toHaveURL(/jobId=job-retry-1/);
  await page.reload();
  await page.getByText("Technical details", { exact: true }).click();
  await expect(page.getByLabel("Context manifest")).toContainText("same manifest");

  await page.getByRole("button", { name: "Refresh context & rerun" }).click();
  await expect(page).toHaveURL(/jobId=job-refresh-1/);
  await page.reload();
  await page.getByText("Technical details", { exact: true }).click();
  await expect(page.getByLabel("Context manifest")).toContainText("manifest-2");
  await expect(page.getByLabel("Context manifest")).toContainText("new manifest");
});

test("BFF rejects object bytes on upload control routes before forwarding", async ({ request }) => {
  const response = await request.post("http://127.0.0.1:3004/api/gcc-v2/knowledge/uploads", {
    headers: {
      cookie: "gcc_v2_access=e2e-access",
      "content-type": "application/octet-stream",
    },
    data: Buffer.alloc(32, 1),
  });
  expect(response.status()).toBe(415);
  await expect(response.json()).resolves.toEqual({
    error: "File bytes must be uploaded directly to the issued storage URL.",
  });
});

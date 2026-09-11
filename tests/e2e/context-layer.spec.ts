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

test("Geek IQ catalogs expose lifecycle, provenance, and ingestion activity", async ({ page }) => {
  await openAuthenticated(page, "/brand-sources");
  await expect(page.getByRole("heading", { name: "Geek IQ" })).toBeVisible();
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

test("Knowledge Add URL creates a version with source URL provenance", async ({ page, request }) => {
  await openAuthenticated(page, "/brand-sources");
  await expect(page.getByRole("tab", { name: "Knowledge Base" })).toBeVisible();
  await page.getByLabel("Knowledge source URL").fill("https://example.com/docs/readiness");
  await page.getByRole("button", { name: "Add URL to Knowledge" }).click();
  await expect(page.getByRole("status")).toContainText("Fetched https://example.com/docs/readiness");
  await expect(page.getByRole("heading", { name: "Fetched readiness page" })).toBeVisible();
  await expect(page.getByLabel("Exact version")).toContainText("Version 1");
  await expect(page.getByRole("link", { name: /Fetched readiness page|example\.com\/docs\/readiness/ })).toHaveAttribute(
    "href",
    "https://example.com/docs/readiness",
  );

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const fromUrl = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/knowledge/from-url");
  expect(fromUrl).toBeTruthy();
  expect(JSON.parse(fromUrl.body)).toMatchObject({
    url: "https://example.com/docs/readiness",
  });
});

test("Brand Voice policy editor saves an immutable typed version", async ({ page, request }) => {
  await openAuthenticated(page, "/brand-sources");
  await page.getByRole("tab", { name: "Brand Voice" }).click();
  await expect(page.getByRole("heading", { name: "Example Systems" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Brand Voice policy" })).toBeVisible();
  await page.getByLabel("Brand Voice avoid phrases").fill("synergy\ngame-changer");
  await page.getByLabel("Brand Voice banned claims").fill("guaranteed ROI");
  await page.getByLabel("Brand Voice custom instructions").fill("Sound like a careful operator.");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Saved Example Systems as a new Brand Voice version")).toBeVisible();
  await expect(page.getByLabel("Exact version")).toContainText("Version 2");

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const versionCreate = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/brand-kits/brand-1/versions");
  expect(versionCreate).toBeTruthy();
  expect(JSON.parse(versionCreate.body)).toMatchObject({
    voicePolicy: {
      schemaVersion: 1,
      avoidPhrases: ["synergy", "game-changer"],
      bannedClaims: ["guaranteed ROI"],
      customInstructions: "Sound like a careful operator.",
    },
  });
});

test("Visual Guidelines policy editor saves an immutable typed version", async ({ page, request }) => {
  await openAuthenticated(page, "/brand-sources");
  await page.getByRole("tab", { name: "Visual Guidelines" }).click();
  await expect(page.getByRole("heading", { name: "Product Visual System" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Visual Guidelines policy" })).toBeVisible();
  await expect(page.getByLabel("Palette primary")).toHaveValue("#0F172A");
  await page.getByLabel("Palette accent").fill("#115E59");
  await page.getByLabel("Imagery style notes").fill("Natural light product photography only.");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Saved Product Visual System as a new Visual Guidelines version")).toBeVisible();
  await expect(page.getByLabel("Exact version")).toContainText("Version 2");

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const versionCreate = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/visual-guidelines/visual-1/versions");
  expect(versionCreate).toBeTruthy();
  const body = JSON.parse(versionCreate.body);
  expect(body.payload.palette.accent).toBe("#115E59");
  expect(body.payload.imagery.styleNotes).toContain("Natural light");
});

test("Style Guide policy editor saves an immutable typed version", async ({ page, request }) => {
  await openAuthenticated(page, "/brand-sources");
  await page.getByRole("tab", { name: "Style Guides" }).click();
  await expect(page.getByRole("heading", { name: "Clear Technical Style" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Style Guide policy" })).toBeVisible();
  await expect(page.getByLabel("Term rule 1 match")).toHaveValue("synergy");
  await page.getByRole("button", { name: "Add rule" }).click();
  await page.getByLabel("Term rule 3 kind").selectOption("capitalize");
  await page.getByLabel("Term rule 3 match").fill("Acme Cloud");
  await page.getByLabel("Custom instructions").fill("Prefer concrete operational outcomes and named systems.");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Saved Clear Technical Style as a new Style Guide version")).toBeVisible();
  await expect(page.getByLabel("Exact version")).toContainText("Version 2");

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const versionCreate = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/style-guides/style-1/versions");
  expect(versionCreate).toBeTruthy();
  expect(JSON.parse(versionCreate.body)).toMatchObject({
    schemaVersion: 1,
    payload: {
      schemaVersion: 1,
      customInstructions: "Prefer concrete operational outcomes and named systems.",
    },
  });
});

test("Audience policy editor saves an immutable typed version", async ({ page, request }) => {
  await openAuthenticated(page, "/brand-sources");
  await page.getByRole("tab", { name: "Audiences" }).click();
  await expect(page.getByRole("heading", { name: "Technical Leaders" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Audience policy" })).toBeVisible();
  await expect(page.getByLabel("Audience summary")).toHaveValue(
    "Technical buyers evaluating evidence systems.",
  );
  await expect(page.getByLabel("Audience roles")).toHaveValue("VP Engineering\nStaff Engineer");
  await page.getByLabel("Audience banned topics").fill("hype\nunverified claims");
  await page.getByLabel("Audience custom instructions").fill(
    "Prefer concrete systems and citeable outcomes.",
  );
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Saved Technical Leaders as a new Audience version")).toBeVisible();
  await expect(page.getByLabel("Exact version")).toContainText("Version 2");

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const versionCreate = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/audiences/audience-1/versions");
  expect(versionCreate).toBeTruthy();
  expect(JSON.parse(versionCreate.body)).toMatchObject({
    schemaVersion: 1,
    locale: "en",
    payload: {
      schemaVersion: 1,
      bannedTopics: ["hype", "unverified claims"],
      customInstructions: "Prefer concrete systems and citeable outcomes.",
    },
  });
});

test("Product Schema and Product IQ editors save typed versions with claims", async ({ page, request }) => {
  await openAuthenticated(page, "/brand-sources");
  await page.getByRole("tab", { name: "Product Schemas" }).click();
  await expect(page.getByRole("heading", { name: "Core Product Schema" })).toBeVisible();
  await expect(page.getByLabel("Schema field 1 label")).toHaveValue("Pricing");
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByLabel("Schema field 3 label").fill("Compatibility");
  await page.getByLabel("Schema field 3 key").fill("compatibility");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Saved Core Product Schema as a new Product Schema version")).toBeVisible();

  await page.getByRole("tab", { name: "Products" }).click();
  await expect(page.getByRole("heading", { name: "Evidence Engine" })).toBeVisible();
  await expect(page.getByLabel("Product field Pricing")).toHaveValue("Contact sales");
  await page.getByLabel("Approved claims").fill("Evidence Engine cites every claim\nSOC2 ready");
  await page.getByLabel("Mandatory disclaimers").fill("Results depend on source coverage.");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Saved Evidence Engine as a new Product version")).toBeVisible();

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const productCreate = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST" && entry.path === "/api/geek-content-creator-v2/products/product-1/versions");
  expect(JSON.parse(productCreate.body)).toMatchObject({
    productSchemaVersionId: "schema-version-1",
    approvedClaims: ["Evidence Engine cites every claim", "SOC2 ready"],
    mandatoryDisclaimers: ["Results depend on source coverage."],
  });
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

test("context selector can attach a public URL to the run", async ({ page, request }) => {
  await reachContextReview(page);
  await page.getByRole("button", { name: "Create content" }).click();
  await expect(page.getByRole("heading", { name: "Confirm the partners we found" })).toBeVisible();
  await page.getByLabel("Attachment URL").fill("https://example.com/run-brief");
  await page.getByRole("button", { name: "Add URL to this run" }).click();
  await expect(page.getByRole("status")).toContainText("Fetched attachment page");
  await expect(page.getByText("attachment-url-1")).toBeVisible();

  const requests = await (await request.get(`${platformOrigin}/__requests`)).json();
  const fromUrl = requests.find((entry: { method: string; path: string }) =>
    entry.method === "POST"
    && entry.path === "/api/geek-content-creator-v2/creates/create-1/attachments/from-url");
  expect(fromUrl).toBeTruthy();
  expect(JSON.parse(fromUrl.body)).toMatchObject({
    url: "https://example.com/run-brief",
  });
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
  await expect(page.getByLabel("Evidence Engine field Pricing")).toBeChecked();
  await page.getByLabel("Evidence Engine field Differentiator").uncheck();
  await page.getByRole("button", { name: "Check context" }).click();
  await expect(page.getByLabel("Effective context preflight")).toContainText("Editorial Handbook is stale");
  await expect(page.getByRole("button", { name: "Confirm partners & create" })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => {
    const raw = sessionStorage.getItem("gcc-v2-new-create-draft");
    return raw ? JSON.parse(raw).contextSelection?.productSelections : null;
  })).toEqual([{
    productVersionId: "product-version-1",
    selectedFieldIds: ["11111111-1111-4111-8111-111111111111"],
  }]);
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

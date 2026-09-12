import { expect, test } from "@playwright/test";
import { cloneProjectFixtures } from "../../src/app/projects/project-fixtures";
import {
  appendAssetVersion,
  getAssetLineage,
  latestVersion,
} from "../../src/app/projects/project-model";
import { openAuthenticated, skipIfNoE2eAuth } from "./helpers";

test.beforeEach(({}, testInfo) => {
  skipIfNoE2eAuth(testInfo);
});

test("appending an asset version preserves the project and prior versions", () => {
  const original = cloneProjectFixtures()[0]!;
  const originalAsset = original.assets[0]!;
  const priorVersions = originalAsset.versions;

  const updated = appendAssetVersion(original, originalAsset.id, {
    createdAt: "2026-09-09T12:00:00.000Z",
    createdBy: "Test editor",
    status: "draft",
    summary: "A successor draft.",
    evidence: [],
    provenance: { origin: "human", note: "Test successor." },
  });

  expect(updated).not.toBe(original);
  expect(updated.assets[0]).not.toBe(originalAsset);
  expect(originalAsset.versions).toBe(priorVersions);
  expect(originalAsset.versions).toHaveLength(2);
  expect(updated.assets[0]!.versions).toHaveLength(3);
  expect(latestVersion(updated.assets[0]!).id).toBe("launch-brief-v3");
  expect(updated.assets[1]).toBe(original.assets[1]);
});

test("lineage resolves direct parent and child artifact handoffs", () => {
  const project = cloneProjectFixtures()[0]!;
  const article = getAssetLineage(project, "pillar-article");
  const email = getAssetLineage(project, "launch-email");

  expect(article?.parents.map((asset) => asset.id)).toEqual(["launch-brief"]);
  expect(article?.children.map((asset) => asset.id)).toEqual([
    "social-carousel",
    "launch-email",
  ]);
  expect(email?.parents.map((asset) => asset.id)).toEqual([
    "launch-brief",
    "pillar-article",
  ]);
});

test("projects pages expose server persistence, canvas lineage, and honest review placeholders", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await page.getByRole("button", { name: "New demo project" }).click();
  await expect(page.getByRole("link", { name: "Evidence Engine launch" })).toBeVisible();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();

  await expect(page.getByRole("heading", { name: "Evidence Engine launch" })).toBeVisible();
  await expect(page.getByText("Server-backed")).toBeVisible();
  await expect(page.getByRole("list", { name: "Project asset canvas" })).toBeVisible();
  await expect(page.getByText("Launch strategy brief").first()).toBeVisible();
  await expect(page.getByText("Reliable content operations").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add comment" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Asset comment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request approval" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled();

  await page.getByRole("button", { name: "Select Reliable content operations" }).click();
  await expect(page.getByText("1 parent artifact · 2 child artifacts")).toBeVisible();
  await expect(page.getByText(/Generated from launch brief v2/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
});

test("a new immutable version survives reload from the server", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();

  const history = page.getByRole("list", { name: "Launch strategy brief version history" });
  await expect(history.getByText("Version 2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create next version" }).click();
  await expect(history.getByText("Version 3", { exact: true })).toBeVisible();
  await expect(history.getByText("Version 2", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("list", { name: "Launch strategy brief version history" }).getByText("Version 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Created Launch strategy brief v3")).toBeVisible();
});

test("request approval moves a draft asset into in-review with activity", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();

  await page.getByRole("button", { name: "Select Launch carousel" }).click();
  const history = page.getByRole("list", { name: "Launch carousel version history" });
  await expect(history.getByText("draft").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Request approval" })).toBeEnabled();

  await page.getByRole("button", { name: "Request approval" }).click();
  await expect(history.getByText("in-review").first()).toBeVisible();
  await expect(page.getByText("Requested review for Launch carousel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request approval" })).toBeDisabled();

  await page.reload();
  await page.getByRole("button", { name: "Select Launch carousel" }).click();
  await expect(page.getByRole("list", { name: "Launch carousel version history" }).getByText("in-review").first()).toBeVisible();
  await expect(page.getByText("Requested review for Launch carousel")).toBeVisible();
});

test("approve and publish advance editorial status with activity", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();

  await page.getByRole("button", { name: "Select Reliable content operations" }).click();
  const articleHistory = page.getByRole("list", { name: "Reliable content operations version history" });
  await expect(articleHistory.getByText("in-review").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(articleHistory.getByText("approved").first()).toBeVisible();
  await expect(page.getByText("Approved Reliable content operations")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(articleHistory.getByText("published").first()).toBeVisible();
  await expect(page.getByText("Published Reliable content operations")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();

  await page.reload();
  await page.getByRole("button", { name: "Select Reliable content operations" }).click();
  await expect(
    page.getByRole("list", { name: "Reliable content operations version history" }).getByText("published").first(),
  ).toBeVisible();
  await expect(page.getByText("Published Reliable content operations")).toBeVisible();
});

test("asset comments append durable activity and survive reload", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();

  await page.getByRole("button", { name: "Select Launch carousel" }).click();
  await page.getByRole("textbox", { name: "Asset comment" }).fill("Tighten slide 3 proof points.");
  await expect(page.getByRole("button", { name: "Add comment" })).toBeEnabled();
  await page.getByRole("button", { name: "Add comment" }).click();

  await expect(page.getByText("Commented on Launch carousel: Tighten slide 3 proof points.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Asset comment" })).toHaveValue("");

  await page.reload();
  await page.getByRole("button", { name: "Select Launch carousel" }).click();
  await expect(page.getByText("Commented on Launch carousel: Tighten slide 3 proof points.")).toBeVisible();
});

test("convert to batch opens a Grid seeded from the Canvas asset", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();

  await page.getByRole("button", { name: "Select Reliable content operations" }).click();
  await page.getByRole("button", { name: "Convert to batch" }).click();

  await expect(page).toHaveURL(/\/grid\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Reliable content operations batch" })).toBeVisible();
  await expect(page.getByText("Reliable content operations").first()).toBeVisible();
  await expect(page.getByText("(pillar-outline)")).toBeVisible();

  await openAuthenticated(page, "/projects");
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();
  await expect(page.getByText("Converted Reliable content operations to batch grid Reliable content operations batch")).toBeVisible();
});

test("add to existing batch appends a Canvas asset row without creating a new grid", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();

  await page.getByRole("button", { name: "Select Reliable content operations" }).click();
  await page.getByRole("button", { name: "Convert to batch" }).click();
  await expect(page).toHaveURL(/\/grid\/([^/]+)$/);
  const gridUrl = page.url();
  const gridId = gridUrl.match(/\/grid\/([^/]+)$/)?.[1];
  expect(gridId).toBeTruthy();

  await openAuthenticated(page, `/projects`);
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();
  await page.getByRole("button", { name: "Select Launch carousel" }).click();
  await expect(page.getByTestId("append-to-existing-batch")).toBeVisible();
  await page.getByLabel("Existing batch grid").selectOption({ label: "Reliable content operations batch" });
  await page.getByRole("button", { name: "Add to existing batch" }).click();

  await expect(page).toHaveURL(new RegExp(`/grid/${gridId}$`));
  await expect(page.getByRole("heading", { name: "Reliable content operations batch" })).toBeVisible();
  await expect(page.getByText("Launch carousel").first()).toBeVisible();
  await expect(page.getByText("Reliable content operations").first()).toBeVisible();

  await openAuthenticated(page, "/projects");
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();
  await expect(page.getByText("Appended Launch carousel to batch grid Reliable content operations batch")).toBeVisible();
});

test("send to agent opens a task agent with Canvas prefills", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();

  await page.getByRole("button", { name: "Select Reliable content operations" }).click();
  await expect(page.getByRole("combobox", { name: "Send to agent" })).toHaveValue("pillar-outline");
  await page.getByRole("button", { name: "Send to agent" }).click();

  await expect(page).toHaveURL(/\/task-agents\/pillar-outline\?/);
  await expect(page.getByRole("heading", { name: "Pillar Article Outline" })).toBeVisible();
  await expect(page.getByLabel("Topic")).toHaveValue("Reliable content operations");
  await expect(page.getByText(/Prefills arrived from Canvas asset/)).toBeVisible();

  await page.getByRole("link", { name: "Back to project" }).click();
  await expect(page.getByText("Sent Reliable content operations to Pillar Article Outline")).toBeVisible();
});

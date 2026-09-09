import { expect, test } from "@playwright/test";
import { cloneProjectFixtures } from "../../src/app/projects/project-fixtures";
import {
  appendAssetVersion,
  getAssetLineage,
  latestVersion,
} from "../../src/app/projects/project-model";
import { openAuthenticated, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
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
  await expect(page.getByRole("button", { name: "Add comment · Coming soon" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Request approval · Coming soon" })).toBeDisabled();

  await page.getByRole("button", { name: "Select Reliable content operations" }).click();
  await expect(page.getByText("1 parent artifact · 2 child artifacts")).toBeVisible();
  await expect(page.getByText(/Generated from launch brief v2/)).toBeVisible();
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

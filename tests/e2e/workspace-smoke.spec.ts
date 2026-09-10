import { expect, test } from "@playwright/test";
import { openAuthenticated, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("workspace smoke: dashboard hub → Canvas publish → Grid due schedules → ROI reconciliation", async ({
  page,
}) => {
  await openAuthenticated(page, "/");
  await expect(page.getByRole("heading", { name: "What will you create today?" })).toBeVisible();
  const hub = page.getByLabel("Workspace surfaces");
  await expect(hub.getByRole("link", { name: /^Projects/ })).toBeVisible();
  await expect(hub.getByRole("link", { name: /^Grid/ })).toBeVisible();
  await expect(hub.getByRole("link", { name: /^ROI/ })).toBeVisible();

  await hub.getByRole("link", { name: /^Projects/ }).click();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await page.getByRole("button", { name: "New demo project" }).click();
  await page.getByRole("link", { name: "Evidence Engine launch" }).click();
  await expect(page.getByRole("heading", { name: "Evidence Engine launch" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published Launch strategy brief")).toBeVisible();

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Grid" }).click();
  await expect(page.getByRole("heading", { name: "Grid" })).toBeVisible();
  await page.getByRole("button", { name: "New FAQ demo" }).click();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();
  await page.getByLabel("Grid schedule cadence").selectOption("daily");
  await page.getByLabel("Enable grid schedule").check();
  await page.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByText(/Schedule saved: daily/)).toBeVisible();

  await page.getByRole("link", { name: "← Grid" }).click();
  await expect(page.getByText(/Due · daily/)).toBeVisible();
  await page.getByRole("button", { name: /Run due schedules \(1\)/ }).click();
  await expect(page.getByText(/Ran 1 due schedule/)).toBeVisible();

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "ROI" }).click();
  await expect(page.getByRole("heading", { name: "ROI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projected vs observed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observed telemetry" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Payback" })).toBeVisible();
  await expect(page.getByText("Canvas asset versions whose latest status is published")).toBeVisible();
  await expect(page.getByText("Success delta")).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { openAuthenticated, skipIfNoE2eAuth } from "./helpers";

test.beforeEach(({}, testInfo) => {
  skipIfNoE2eAuth(testInfo);
});

test("workspace smoke: dashboard hub → Canvas publish → Grid due schedules → Studio successor → ROI", async ({
  page,
}) => {
  await openAuthenticated(page, "/");
  await expect(page.getByRole("heading", { name: "What will you create today?" })).toBeVisible();
  const ops = page.getByLabel("Workspace operations");
  await expect(ops).toBeVisible();
  await expect(ops.getByText("Due schedules", { exact: true })).toBeVisible();
  await expect(ops.getByText("Accepted (90d)")).toBeVisible();
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

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Dashboard" }).click();
  const opsAfter = page.getByLabel("Workspace operations");
  await expect(opsAfter.getByText("Due schedules", { exact: true })).toBeVisible();
  await expect(opsAfter.getByRole("button", { name: "No due schedules" })).toBeDisabled();

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Grid" }).click();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();
  await expect(page.getByText("Actor")).toBeVisible();
  await expect(page.getByText("schedule", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Grid run history" }).getByText(/schedule/)).toBeVisible();

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Studio" }).click();
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible();
  await page.getByRole("button", { name: "New custom agent" }).click();
  await page.getByLabel("Agent name").fill("Smoke successor agent");
  await page.getByLabel("Instructions template").fill(
    "Write a brief for {{inputs.audience}}. Outcome: {{outcome}}",
  );
  await page.getByLabel("Evaluation prompt").fill(
    "Response must include audience and a short summary.",
  );
  await page.getByLabel("New field label").fill("Audience");
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByLabel("Audience").fill("Operators");
  await page.getByRole("button", { name: "Run dry-run" }).click();
  await expect(page.getByTestId("studio-dry-run-status")).toContainText("dry-run passed");
  await page.getByRole("button", { name: "Add sample as test case" }).click();
  await page.getByRole("button", { name: "Run test suite" }).click();
  await expect(page.getByTestId("studio-dry-run-status")).toContainText("Test suite passed");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByTestId("studio-dry-run-status")).toContainText("Successor draft");

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "ROI" }).click();
  await expect(page.getByRole("heading", { name: "ROI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projected vs observed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observed telemetry" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Payback" })).toBeVisible();
  await expect(page.getByText("Canvas asset versions whose latest status is published")).toBeVisible();
  await expect(page.getByText("Success delta")).toBeVisible();
});

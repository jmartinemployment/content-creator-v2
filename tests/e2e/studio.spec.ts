import { expect, test } from "@playwright/test";
import {
  buildInputSchema,
  createEmptyStudioDraft,
  dryRunStudioDraft,
  upsertField,
} from "../../src/app/studio/studio-model";
import { openAuthenticated, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("studio dry-run validates required inputs and template tokens", () => {
  let draft = createEmptyStudioDraft("2026-09-09T12:00:00.000Z");
  draft = upsertField(draft, {
    id: "audience",
    label: "Audience",
    type: "shortText",
    required: true,
  });
  draft = {
    ...draft,
    instructionsTemplate: "Write for {{inputs.topic}} aimed at {{inputs.audience}}. Outcome: {{outcome}}",
  };

  const failed = dryRunStudioDraft(draft, { topic: "AI readiness" });
  expect(failed.valid).toBe(false);
  expect(failed.missingFields).toContain("Audience");

  const passed = dryRunStudioDraft(draft, { topic: "AI readiness", audience: "CMOs" });
  expect(passed.valid).toBe(true);
  expect(passed.renderedInstructions).toContain("aimed at CMOs");
  expect(buildInputSchema(draft).required).toEqual(["topic", "audience"]);
});

test("studio pages create, save, dry-run, and publish a durable agent", async ({ page }) => {
  await openAuthenticated(page, "/studio");
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible();
  await page.getByRole("button", { name: "New custom agent" }).click();

  await expect(page.getByLabel("Agent name")).toBeVisible();
  await page.getByLabel("Agent name").fill("Launch brief helper");
  await page.getByLabel("Instructions template").fill(
    "Write a launch brief for {{inputs.audience}}. Outcome: {{outcome}}",
  );
  await page.getByLabel("New field label").fill("Audience");
  await page.getByRole("button", { name: "Add field" }).click();
  await expect(page.getByText("shortText · required · {{inputs.audience}}")).toBeVisible();

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("studio-dry-run-status")).toContainText("Draft saved");

  await page.getByLabel("Audience").fill("Product marketers");
  await page.getByRole("button", { name: "Run dry-run" }).click();
  await expect(page.getByTestId("studio-dry-run-status")).toContainText("passed");

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("studio-dry-run-status")).toContainText("Published");
  await expect(page.getByRole("button", { name: "Published" })).toBeDisabled();
});

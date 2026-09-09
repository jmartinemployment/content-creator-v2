import { expect, test } from "@playwright/test";
import {
  estimateBudget,
  selectRowsForRun,
} from "../../src/app/grid/grid-model";
import type { GridConfig, GridRow } from "../../src/app/grid/grid-types";
import { openAuthenticated, resetPlatform } from "./helpers";

const config: GridConfig = {
  columns: [
    { key: "topic", kind: "input", label: "Topic" },
    { key: "agent", kind: "agent", label: "FAQ stub", capability: "faq-set" },
    { key: "output", kind: "output", label: "Result" },
  ],
  creditsPerRow: 1,
  executionNote: "Sample/full runs create one durable TaskRun per selected row and complete in-process.",
};

function rows(count: number): GridRow[] {
  return Array.from({ length: count }, (_, rowIndex) => ({
    id: `row-${rowIndex}`,
    rowIndex,
    input: { topic: `Topic ${rowIndex + 1}` },
    output: null,
    status: "pending",
    error: "",
    updatedAt: "2026-09-09T12:00:00.000Z",
  }));
}

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("sample selection and budget preview stay transparent", () => {
  const all = rows(12);
  const sample = selectRowsForRun(all, "sample", 10);
  expect(sample).toHaveLength(10);
  expect(selectRowsForRun(all, "full")).toHaveLength(12);
  expect(estimateBudget(config, sample.length)).toEqual({
    creditsPerRow: 1,
    rowCount: 10,
    estimatedCredits: 10,
    note: config.executionNote,
  });
});

test("grid pages expose TaskRun execution, sample run, and history", async ({ page }) => {
  await openAuthenticated(page, "/grid");
  await expect(page.getByRole("heading", { name: "Grid" })).toBeVisible();
  await page.getByRole("button", { name: "New demo grid" }).click();
  await expect(page.getByRole("link", { name: "FAQ launch batch" })).toBeVisible();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();

  await expect(page.getByRole("heading", { name: "FAQ launch batch" })).toBeVisible();
  await expect(page.getByText("TaskRun execution")).toBeVisible();
  await expect(page.getByText("Sample budget preview: 10 credits")).toBeVisible();
  await expect(page.getByText("What is Evidence Engine?")).toBeVisible();
  await expect(page.getByText("How do I preview estimated credits?")).toBeVisible();

  await page.getByRole("button", { name: "Run sample (10)" }).click();
  await expect(page.getByText("FAQ draft for: What is Evidence Engine?")).toBeVisible();
  await expect(page.getByText("sample · 10 outputs · 10 credits")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("list", { name: "Grid run history" }).getByText("sample · 10 outputs · 10 credits")).toBeVisible();
  await expect(page.getByText("FAQ draft for: What is Evidence Engine?")).toBeVisible();
});

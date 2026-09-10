import { expect, test } from "@playwright/test";
import {
  advanceScheduleNextRunAt,
  estimateBudget,
  normalizeGridSchedule,
  scheduleIsDue,
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

test("schedule helpers normalize, due-check, and advance cadences", () => {
  const schedule = normalizeGridSchedule({
    cadence: "weekly",
    enabled: true,
    mode: "full",
    sampleSize: 5,
    nextRunAt: "2026-01-01T00:00:00.000Z",
  });
  expect(schedule).toMatchObject({
    cadence: "weekly",
    enabled: true,
    mode: "full",
    sampleSize: 5,
  });
  expect(scheduleIsDue(schedule, new Date("2026-01-02T00:00:00.000Z"))).toBe(true);
  expect(scheduleIsDue(schedule, new Date("2025-12-31T00:00:00.000Z"))).toBe(false);
  expect(advanceScheduleNextRunAt(new Date("2026-01-01T00:00:00.000Z"), "daily")?.toISOString())
    .toBe("2026-01-02T00:00:00.000Z");
  expect(advanceScheduleNextRunAt(new Date("2026-01-01T00:00:00.000Z"), "weekly")?.toISOString())
    .toBe("2026-01-08T00:00:00.000Z");
});

test("grid pages expose TaskRun execution, sample run, and history", async ({ page }) => {
  await openAuthenticated(page, "/grid");
  await expect(page.getByRole("heading", { name: "Grid" })).toBeVisible();
  await page.getByRole("button", { name: "New FAQ demo" }).click();
  await expect(page.getByRole("link", { name: "FAQ launch batch" })).toBeVisible();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();

  await expect(page.getByRole("heading", { name: "FAQ launch batch" })).toBeVisible();
  await expect(page.getByText("TaskRun execution")).toBeVisible();
  await expect(page.getByText("Sample budget preview: 10 credits")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run sample (10)" })).toBeVisible();
  await expect(page.getByText("What is Evidence Engine?")).toBeVisible();
  await expect(page.getByText("How do I preview estimated credits?")).toBeVisible();

  await page.getByRole("button", { name: "Run sample (10)" }).click();
  await expect(page.getByText("FAQ draft for: What is Evidence Engine?")).toBeVisible();
  await expect(page.getByText("sample · 10 outputs · 10 credits")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("list", { name: "Grid run history" }).getByText("sample · 10 outputs · 10 credits")).toBeVisible();
  await expect(page.getByText("FAQ draft for: What is Evidence Engine?")).toBeVisible();
});

test("pillar demo grid runs topic rows with outline previews", async ({ page }) => {
  await openAuthenticated(page, "/grid");
  await page.getByRole("button", { name: "New pillar demo" }).click();
  await expect(page.getByRole("link", { name: "Pillar launch batch" })).toBeVisible();
  await page.getByRole("link", { name: "Pillar launch batch" }).click();

  await expect(page.getByRole("heading", { name: "Pillar launch batch" })).toBeVisible();
  await expect(page.getByText("Evidence Engine")).toBeVisible();
  await expect(page.getByText("(pillar-outline)")).toBeVisible();

  await page.getByRole("button", { name: "Run sample (10)" }).click();
  await expect(page.getByText("Pillar outline for: Evidence Engine")).toBeVisible();
  await expect(page.getByText("sample · 10 outputs · 10 credits")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Pillar outline for: Evidence Engine")).toBeVisible();
});

test("grid detail can append a topic row and run it", async ({ page }) => {
  await openAuthenticated(page, "/grid");
  await page.getByRole("button", { name: "New FAQ demo" }).click();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();

  await expect(page.getByText("12 rows")).toBeVisible();
  await page.getByRole("textbox", { name: "New grid topic" }).fill("Owner isolation follow-up");
  await page.getByRole("button", { name: "Add row" }).click();
  await expect(page.getByText("13 rows")).toBeVisible();
  await expect(page.getByText("Owner isolation follow-up")).toBeVisible();

  await page.reload();
  await expect(page.getByText("13 rows")).toBeVisible();
  await expect(page.getByText("Owner isolation follow-up")).toBeVisible();
});

test("succeeded grid rows can attach into a Canvas project", async ({ page }) => {
  await openAuthenticated(page, "/projects");
  await page.getByRole("button", { name: "New demo project" }).click();
  await expect(page.getByRole("link", { name: "Evidence Engine launch" })).toBeVisible();

  await openAuthenticated(page, "/grid");
  await page.getByRole("button", { name: "New FAQ demo" }).click();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();
  await page.getByRole("button", { name: "Run sample (10)" }).click();
  await expect(page.getByText("FAQ draft for: What is Evidence Engine?")).toBeVisible();

  await expect(page.getByRole("button", { name: "Attach succeeded (10)" })).toBeEnabled();
  await page.getByLabel("Attach grid rows to project").selectOption({ label: "Evidence Engine launch" });
  await page.getByRole("button", { name: "Attach succeeded (10)" }).click();
  await expect(page.getByText("Attached 10 rows to the project.")).toBeVisible();

  await page.getByRole("link", { name: "Open project" }).click();
  await expect(page.getByRole("heading", { name: "Evidence Engine launch" })).toBeVisible();
  await expect(page.getByText("FAQ launch batch · What is Evidence Engine?").first()).toBeVisible();
  await expect(page.getByText(/Attached FAQ launch batch · What is Evidence Engine\? from grid FAQ launch batch/)).toBeVisible();
});

test("grid schedule can be saved and fired when due", async ({ page }) => {
  await openAuthenticated(page, "/grid");
  await page.getByRole("button", { name: "New FAQ demo" }).click();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();

  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await page.getByLabel("Grid schedule cadence").selectOption("daily");
  await page.getByLabel("Grid schedule run mode").selectOption("sample");
  await page.getByLabel("Enable grid schedule").check();
  await page.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByText(/Schedule saved: daily · sample \(10\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run due now" })).toBeEnabled();

  await page.getByRole("button", { name: "Run due now" }).click();
  await expect(page.getByText(/Scheduled sample run completed/)).toBeVisible();
  await expect(page.getByText("FAQ draft for: What is Evidence Engine?")).toBeVisible();
  await expect(page.getByRole("list", { name: "Grid run history" }).getByText(/schedule/)).toBeVisible();
  await expect(page.getByText("Actor")).toBeVisible();
});

test("grid list can run all due schedules in one action", async ({ page }) => {
  await openAuthenticated(page, "/grid");
  await page.getByRole("button", { name: "New FAQ demo" }).click();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();

  await page.getByLabel("Grid schedule cadence").selectOption("daily");
  await page.getByLabel("Enable grid schedule").check();
  await page.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByText(/Schedule saved: daily/)).toBeVisible();

  await page.getByRole("link", { name: "← Grid" }).click();
  await expect(page.getByRole("heading", { name: "Grid" })).toBeVisible();
  await expect(page.getByText(/Due · daily/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Run due schedules \(1\)/ })).toBeEnabled();

  await page.getByRole("button", { name: /Run due schedules \(1\)/ }).click();
  await expect(page.getByText(/Ran 1 due schedule/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run due schedules" })).toBeDisabled();
});

test("grid can attach a pipeline and project sample rows as work items", async ({ page }) => {
  await openAuthenticated(page, "/pipelines");
  await page.getByRole("button", { name: "Create AEO pipeline template" }).click();
  await expect(page.getByRole("heading", { name: "AEO content pipeline" })).toBeVisible();

  await openAuthenticated(page, "/grid");
  await page.getByRole("button", { name: "New FAQ demo" }).click();
  await page.getByRole("link", { name: "FAQ launch batch" }).click();

  await expect(page.getByRole("heading", { name: "Pipeline projection" })).toBeVisible();
  await page.getByLabel("Attach pipeline to grid").selectOption({ label: "AEO content pipeline" });
  await page.getByRole("button", { name: "Save pipeline attachment" }).click();
  await expect(page.getByText(/Pipeline attached/)).toBeVisible();
  await expect(page.getByText(/Attached: AEO content pipeline/)).toBeVisible();

  await page.getByRole("button", { name: "Project sample as work items" }).click();
  await expect(page.getByText(/Projected 10 work items into pipeline run/)).toBeVisible();
  await expect(page.getByText(/last run pipeline-run-/)).toBeVisible();

  await page.getByLabel("Grid schedule cadence").selectOption("daily");
  await page.getByLabel("Enable grid schedule").check();
  await page.getByRole("button", { name: "Save schedule" }).click();
  await page.getByRole("button", { name: "Run due now" }).click();
  await expect(page.getByText(/Scheduled pipeline projection completed/)).toBeVisible();

  await page.getByRole("link", { name: "Open pipeline" }).click();
  await expect(page.getByRole("heading", { name: "AEO content pipeline" })).toBeVisible();
  await expect(page.getByLabel("Latest pipeline run")).toContainText("succeeded");
});

import { expect, test } from "@playwright/test";
import {
  defaultAssumptions,
  observedAcceptanceRate,
  projectScenario,
  reconcileProjectedVsObserved,
  scenarioFactors,
} from "../../src/app/roi/roi-model";
import { openAuthenticated, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("expected scenario uses the published transparent formulas", () => {
  const expected = scenarioFactors.find((item) => item.id === "expected")!;
  const projection = projectScenario(defaultAssumptions, expected);

  const minutesSaved = defaultAssumptions.baselineMinutes - defaultAssumptions.assistedMinutes;
  const savedHours =
    (defaultAssumptions.workflowVolume * minutesSaved) /
    60 *
    defaultAssumptions.adoptionRate *
    defaultAssumptions.successfulUseRate;
  const productivity =
    savedHours * defaultAssumptions.loadedHourlyCost * defaultAssumptions.redeploymentFactor;
  const external =
    defaultAssumptions.externalSpend *
    defaultAssumptions.replaceableShare *
    defaultAssumptions.adoptionRate;
  const gross = productivity + external;
  const net = gross - defaultAssumptions.totalCostOfOwnership;

  expect(projection.savedHours).toBeCloseTo(savedHours, 5);
  expect(projection.productivityValue).toBeCloseTo(productivity, 5);
  expect(projection.externalCostAvoided).toBeCloseTo(external, 5);
  expect(projection.netBenefit).toBeCloseTo(net, 5);
  expect(projection.roiPercent).toBeCloseTo((net / defaultAssumptions.totalCostOfOwnership) * 100, 5);
  expect(projection.paybackMonths).toBeCloseTo(
    (defaultAssumptions.totalCostOfOwnership / gross) * 12,
    5,
  );
  expect(projection.timeToValueMonths).toBeCloseTo(
    (defaultAssumptions.totalCostOfOwnership / productivity) * 12,
    5,
  );
});

test("observed acceptance stays a rate, not a dollar claim", () => {
  expect(observedAcceptanceRate({
    generatedCount: 48,
    acceptedCount: 31,
    publishedCount: 22,
    rejectedCount: 9,
    reviewMinutes: 410,
    periodLabel: "demo",
    source: "demo",
  })).toBeCloseTo(31 / 48, 5);
});

test("reconciliation compares assumed success to observed acceptance without inventing cash", () => {
  const reconciliation = reconcileProjectedVsObserved(defaultAssumptions, {
    generatedCount: 48,
    acceptedCount: 31,
    publishedCount: 22,
    rejectedCount: 9,
    reviewMinutes: 410,
    periodLabel: "demo",
    source: "telemetry",
    lookbackDays: 90,
  });
  expect(reconciliation.assumedSuccessRate).toBeCloseTo(defaultAssumptions.successfulUseRate, 5);
  expect(reconciliation.observedAcceptanceRate).toBeCloseTo(31 / 48, 5);
  expect(reconciliation.successRateDeltaPp).not.toBeNull();
  expect(reconciliation.observedAnnualizedAccepted).toBeCloseTo(31 * (365 / 90), 5);
  expect(reconciliation.notes.some((note) => note.includes("not cash"))).toBe(true);
});

test("ROI page keeps projections editable and separates observed capacity", async ({ page }) => {
  await openAuthenticated(page, "/roi");
  await expect(page.getByRole("heading", { name: "ROI" })).toBeVisible();
  await expect(page.getByText("Transparent directional projections")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projected scenarios" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projected vs observed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observed telemetry" })).toBeVisible();
  await expect(page.getByText("Live TaskRuns")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Payback" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Time to value" })).toBeVisible();
  await expect(page.getByText("Canvas asset versions whose latest status is published")).toBeVisible();

  const volume = page.getByLabel("Workflow volume / year");
  await volume.fill("240");
  await expect(page.getByRole("cell", { name: "Expected" })).toBeVisible();
  await expect(page.getByText("Acceptance / publish")).toBeVisible();
  await expect(page.getByText("Success delta")).toBeVisible();

  await page.getByLabel("Observed lookback days").selectOption("30");
  await expect(page.getByText("Last 30 days (TaskRuns + Canvas publishes)")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Workflow volume / year")).toHaveValue("240");
  await expect(page.getByLabel("Observed lookback days")).toHaveValue("30");
  await page.getByRole("button", { name: "Reset defaults" }).click();
  await expect(page.getByLabel("Workflow volume / year")).toHaveValue(String(defaultAssumptions.workflowVolume));
});

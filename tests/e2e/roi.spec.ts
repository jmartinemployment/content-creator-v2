import { expect, test } from "@playwright/test";
import {
  defaultAssumptions,
  observedAcceptanceRate,
  projectScenario,
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
  const net = productivity + external - defaultAssumptions.totalCostOfOwnership;

  expect(projection.savedHours).toBeCloseTo(savedHours, 5);
  expect(projection.productivityValue).toBeCloseTo(productivity, 5);
  expect(projection.externalCostAvoided).toBeCloseTo(external, 5);
  expect(projection.netBenefit).toBeCloseTo(net, 5);
  expect(projection.roiPercent).toBeCloseTo((net / defaultAssumptions.totalCostOfOwnership) * 100, 5);
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

test("ROI page keeps projections editable and separates observed capacity", async ({ page }) => {
  await openAuthenticated(page, "/roi");
  await expect(page.getByRole("heading", { name: "ROI" })).toBeVisible();
  await expect(page.getByText("Transparent directional projections")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projected scenarios" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observed telemetry" })).toBeVisible();
  await expect(page.getByText("Live TaskRuns")).toBeVisible();

  const volume = page.getByLabel("Workflow volume / year");
  await volume.fill("240");
  await expect(page.getByRole("cell", { name: "Expected" })).toBeVisible();
  await expect(page.getByText("Acceptance / publish")).toBeVisible();
  await expect(page.getByText("Counts are owner-scoped TaskRun outcomes")).toBeVisible();
});

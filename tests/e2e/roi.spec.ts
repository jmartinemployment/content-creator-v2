import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  defaultAssumptions,
  observedAcceptanceRate,
  projectAllScenarios,
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

test("roiProjection.v1 golden matches FE formulas and Phase 7 evidence labels", () => {
  const golden = JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/roiProjection.v1.golden.json"), "utf8"),
  );
  expect(golden.artifactType).toBe("roiProjection.v1");
  expect(golden.formulaVersion).toBe("gcc-roi-formulas.v1");
  expect(golden.evidenceLabels.projections).toBe("modeled");
  expect(golden.evidenceLabels.reconciliation).toBe("telemetry-measured");
  expect(golden.evidenceLabels.cashClaims).toBe("not-asserted");
  expect(golden.warnings.some((w: string) => /directional model/i.test(w))).toBe(true);

  const projections = projectAllScenarios(defaultAssumptions);
  for (const scenario of golden.scenarios) {
    const local = projections.find((item) => item.scenario === scenario.scenario);
    expect(local).toBeTruthy();
    expect(local!.savedHours).toBeCloseTo(scenario.savedHours, 5);
    expect(local!.productivityValue).toBeCloseTo(scenario.productivityValue, 5);
    expect(local!.externalCostAvoided).toBeCloseTo(scenario.externalCostAvoided, 5);
    expect(local!.netBenefit).toBeCloseTo(scenario.netBenefit, 5);
    expect(local!.roiPercent).toBeCloseTo(scenario.roiPercent, 5);
  }

  const reconciliation = reconcileProjectedVsObserved(defaultAssumptions, {
    generatedCount: 48,
    acceptedCount: 31,
    publishedCount: 22,
    rejectedCount: 9,
    cancelledCount: 0,
    reviewMinutes: 410,
    periodLabel: "golden",
    source: "telemetry",
    lookbackDays: 90,
  });
  expect(reconciliation.observedAcceptanceRate).toBeCloseTo(
    golden.reconciliation.observedAcceptanceRate,
    5,
  );
  expect(reconciliation.successRateDeltaPp).toBeCloseTo(
    golden.reconciliation.successRateDeltaPp,
    5,
  );
  expect(reconciliation.notes.some((note) => note.includes("not cash"))).toBe(true);
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
  await expect(page.getByTestId("roi-groundedness-rate")).toContainText("72");
  await expect(page.getByTestId("roi-schema-validity-rate")).toContainText("90");
  await expect(page.getByTestId("roi-mean-edit-distance")).toContainText("0.18");
  await expect(page.getByText("groundednessRate uses sections.grounded")).toBeVisible();
  await expect(page.getByText("meanEditDistance compares first vs latest")).toBeVisible();

  await page.getByLabel("Observed lookback days").selectOption("30");
  await expect(page.getByText("Last 30 days (TaskRuns + Canvas publishes)")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Workflow volume / year")).toHaveValue("240");
  await expect(page.getByLabel("Observed lookback days")).toHaveValue("30");
  await page.getByRole("button", { name: "Reset defaults" }).click();
  await expect(page.getByLabel("Workflow volume / year")).toHaveValue(String(defaultAssumptions.workflowVolume));
});

test("customer outcome records capture evidence fields without inventing cash ROI", async ({ page }) => {
  await openAuthenticated(page, "/roi");
  await expect(page.getByTestId("roi-customer-outcomes")).toBeVisible();
  await expect(page.getByText("Evidence-aware outcomes")).toBeVisible();
  await expect(page.getByTestId("roi-customer-outcomes-list")).toContainText("No customer outcome records yet");

  await page.getByLabel("Outcome title").fill("Q3 review-response hours");
  await page.getByLabel("Outcome metric definition").fill(
    "Median hours from RFP intake to first draft, human-approved.",
  );
  await page.getByLabel("Outcome period start").fill("2026-07-01");
  await page.getByLabel("Outcome period end").fill("2026-09-30");
  await page.getByLabel("Outcome baseline").fill("12 hours");
  await page.getByLabel("Outcome denominator").fill("per quarterly RFP");
  await page.getByLabel("Outcome observed value").fill("1.8 hours");
  await page.getByLabel("Outcome source").fill("Ops time-tracking + TaskRun telemetry");
  await page.getByLabel("Outcome evidence status").selectOption("telemetry-measured");
  await page.getByLabel("Outcome attribution method").fill("before/after with same reviewer cohort");
  await page.getByLabel("Outcome attribution confidence").fill("0.7");
  await page.getByLabel("Outcome workflow versions JSON").fill(
    '["faq-generator@2","ai-readiness@1"]',
  );
  await page.getByLabel("Outcome generated count").fill("40");
  await page.getByLabel("Outcome accepted count").fill("28");
  await page.getByLabel("Outcome published count").fill("18");
  await page.getByLabel("Outcome rejected count").fill("5");
  await page.getByLabel("Outcome review minutes").fill("220");
  await page.getByLabel("Outcome notes").fill("Not a cash ROI claim.");
  await page.getByRole("button", { name: "Save outcome record" }).click();

  const row = page.getByTestId("roi-customer-outcome-row").first();
  await expect(row).toContainText("Q3 review-response hours");
  await expect(row).toContainText("telemetry-measured");
  await expect(row).toContainText("1.8 hours");
  await expect(row).toContainText("12 hours");
  await expect(row).not.toContainText("cash ROI coefficients");

  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("roi-customer-outcomes-list")).toContainText(
    "No customer outcome records yet",
  );
});

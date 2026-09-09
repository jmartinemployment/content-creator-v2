export type RoiAssumptions = Readonly<{
  workflowVolume: number;
  baselineMinutes: number;
  assistedMinutes: number;
  adoptionRate: number;
  successfulUseRate: number;
  loadedHourlyCost: number;
  redeploymentFactor: number;
  externalSpend: number;
  replaceableShare: number;
  totalCostOfOwnership: number;
  attributableGrossMargin: number;
}>;

export type RoiScenarioId = "conservative" | "expected" | "upside";

export type RoiScenarioFactors = Readonly<{
  id: RoiScenarioId;
  label: string;
  volumeFactor: number;
  adoptionFactor: number;
  successFactor: number;
}>;

export type RoiProjection = Readonly<{
  scenario: RoiScenarioId;
  label: string;
  savedHours: number;
  productivityValue: number;
  externalCostAvoided: number;
  grossBenefit: number;
  netBenefit: number;
  roiPercent: number | null;
}>;

export type ObservedTelemetry = Readonly<{
  generatedCount: number;
  acceptedCount: number;
  publishedCount: number;
  rejectedCount: number;
  reviewMinutes: number;
  periodLabel: string;
  source: "demo" | "telemetry" | "empty";
  notes?: readonly string[];
  cancelledCount?: number;
}>;

export const defaultAssumptions: RoiAssumptions = {
  workflowVolume: 120,
  baselineMinutes: 90,
  assistedMinutes: 25,
  adoptionRate: 0.7,
  successfulUseRate: 0.85,
  loadedHourlyCost: 85,
  redeploymentFactor: 0.6,
  externalSpend: 48000,
  replaceableShare: 0.35,
  totalCostOfOwnership: 36000,
  attributableGrossMargin: 0.55,
};

export const scenarioFactors: readonly RoiScenarioFactors[] = [
  { id: "conservative", label: "Conservative", volumeFactor: 0.75, adoptionFactor: 0.85, successFactor: 0.9 },
  { id: "expected", label: "Expected", volumeFactor: 1, adoptionFactor: 1, successFactor: 1 },
  { id: "upside", label: "Upside", volumeFactor: 1.25, adoptionFactor: 1.1, successFactor: 1.05 },
];

export const demoObservedTelemetry: ObservedTelemetry = {
  generatedCount: 48,
  acceptedCount: 31,
  publishedCount: 22,
  rejectedCount: 9,
  reviewMinutes: 410,
  periodLabel: "Last 90 days (demo)",
  source: "demo",
};

export function clampRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function savedHours(assumptions: RoiAssumptions, factors: RoiScenarioFactors) {
  const volume = assumptions.workflowVolume * factors.volumeFactor;
  const minutesSaved = Math.max(0, assumptions.baselineMinutes - assumptions.assistedMinutes);
  const adoption = clampRate(assumptions.adoptionRate * factors.adoptionFactor);
  const success = clampRate(assumptions.successfulUseRate * factors.successFactor);
  return (volume * minutesSaved) / 60 * adoption * success;
}

export function projectScenario(
  assumptions: RoiAssumptions,
  factors: RoiScenarioFactors,
): RoiProjection {
  const hours = savedHours(assumptions, factors);
  const productivityValue =
    hours * assumptions.loadedHourlyCost * assumptions.redeploymentFactor;
  const adoption = clampRate(assumptions.adoptionRate * factors.adoptionFactor);
  const externalCostAvoided =
    assumptions.externalSpend * assumptions.replaceableShare * adoption;
  const grossBenefit = productivityValue + externalCostAvoided;
  const netBenefit = grossBenefit - assumptions.totalCostOfOwnership;
  const roiPercent =
    assumptions.totalCostOfOwnership > 0
      ? (netBenefit / assumptions.totalCostOfOwnership) * 100
      : null;

  return {
    scenario: factors.id,
    label: factors.label,
    savedHours: hours,
    productivityValue,
    externalCostAvoided,
    grossBenefit,
    netBenefit,
    roiPercent,
  };
}

export function projectAllScenarios(assumptions: RoiAssumptions) {
  return scenarioFactors.map((factors) => projectScenario(assumptions, factors));
}

/** Observed capacity created — kept separate from cash saved. */
export function observedAcceptanceRate(telemetry: ObservedTelemetry) {
  if (telemetry.generatedCount <= 0) return null;
  return telemetry.acceptedCount / telemetry.generatedCount;
}

export function observedPublishRate(telemetry: ObservedTelemetry) {
  if (telemetry.acceptedCount <= 0) return null;
  return telemetry.publishedCount / telemetry.acceptedCount;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function formatHours(value: number) {
  return `${value.toFixed(1)} h`;
}

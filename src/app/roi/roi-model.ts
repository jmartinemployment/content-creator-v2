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
  /** Months for TCO to be repaid from gross annual benefit (directional). */
  paybackMonths: number | null;
  /** Months until productivity value alone covers TCO (capacity path, no agency savings). */
  timeToValueMonths: number | null;
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
  /** Lookback window used by the observed feed (days). */
  lookbackDays?: number;
}>;

export type RoiReconciliation = Readonly<{
  assumedSuccessRate: number;
  observedAcceptanceRate: number | null;
  successRateDeltaPp: number | null;
  assumedAssistedMinutes: number;
  observedAvgReviewMinutes: number | null;
  assistedMinutesDelta: number | null;
  projectedAnnualAccepted: number;
  observedAnnualizedAccepted: number | null;
  projectedAnnualPublished: number;
  observedAnnualizedPublished: number | null;
  notes: readonly string[];
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
  lookbackDays: 90,
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
  const paybackMonths =
    grossBenefit > 0 ? (assumptions.totalCostOfOwnership / grossBenefit) * 12 : null;
  const timeToValueMonths =
    productivityValue > 0
      ? (assumptions.totalCostOfOwnership / productivityValue) * 12
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
    paybackMonths,
    timeToValueMonths,
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

export function observedAvgReviewMinutes(telemetry: ObservedTelemetry) {
  const terminal = telemetry.acceptedCount + telemetry.rejectedCount + (telemetry.cancelledCount ?? 0);
  if (terminal <= 0) return null;
  return telemetry.reviewMinutes / terminal;
}

/**
 * Compare editable assumptions to observed TaskRun/Canvas outcomes.
 * Deltas are diagnostic only — never rewritten into dollar ROI automatically.
 */
export function reconcileProjectedVsObserved(
  assumptions: RoiAssumptions,
  telemetry: ObservedTelemetry,
  factors: RoiScenarioFactors = scenarioFactors.find((item) => item.id === "expected")!,
): RoiReconciliation {
  const assumedSuccessRate = clampRate(assumptions.successfulUseRate * factors.successFactor);
  const observedAcceptance = observedAcceptanceRate(telemetry);
  const successRateDeltaPp =
    observedAcceptance == null ? null : (observedAcceptance - assumedSuccessRate) * 100;

  const assumedAssistedMinutes = assumptions.assistedMinutes;
  const observedAvg = observedAvgReviewMinutes(telemetry);
  const assistedMinutesDelta =
    observedAvg == null ? null : observedAvg - assumedAssistedMinutes;

  const volume = assumptions.workflowVolume * factors.volumeFactor;
  const adoption = clampRate(assumptions.adoptionRate * factors.adoptionFactor);
  const projectedAnnualAccepted = volume * adoption * assumedSuccessRate;
  const projectedAnnualPublished =
    projectedAnnualAccepted * (observedPublishRate(telemetry) ?? assumedSuccessRate);

  const lookbackDays = telemetry.lookbackDays && telemetry.lookbackDays > 0
    ? telemetry.lookbackDays
    : 90;
  const annualize = 365 / lookbackDays;
  const observedAnnualizedAccepted =
    telemetry.source === "empty" ? null : telemetry.acceptedCount * annualize;
  const observedAnnualizedPublished =
    telemetry.source === "empty" ? null : telemetry.publishedCount * annualize;

  const notes: string[] = [
    "Reconciliation compares modeled assumptions to observed workflow capacity — not cash claims.",
  ];
  if (successRateDeltaPp != null) {
    notes.push(
      successRateDeltaPp >= 0
        ? `Observed acceptance is ${successRateDeltaPp.toFixed(1)} pp above the assumed success rate.`
        : `Observed acceptance is ${Math.abs(successRateDeltaPp).toFixed(1)} pp below the assumed success rate.`,
    );
  }
  if (assistedMinutesDelta != null) {
    notes.push(
      assistedMinutesDelta >= 0
        ? `Observed average review minutes are ${assistedMinutesDelta.toFixed(1)} above assisted minutes.`
        : `Observed average review minutes are ${Math.abs(assistedMinutesDelta).toFixed(1)} below assisted minutes.`,
    );
  }

  return {
    assumedSuccessRate,
    observedAcceptanceRate: observedAcceptance,
    successRateDeltaPp,
    assumedAssistedMinutes,
    observedAvgReviewMinutes: observedAvg,
    assistedMinutesDelta,
    projectedAnnualAccepted,
    observedAnnualizedAccepted,
    projectedAnnualPublished,
    observedAnnualizedPublished,
    notes,
  };
}

export const lookbackDayOptions = [30, 90, 180, 365] as const;
export type RoiLookbackDays = (typeof lookbackDayOptions)[number];

export const ROI_ASSUMPTIONS_STORAGE_KEY = "gcc-v2-roi-assumptions.v1";
export const ROI_LOOKBACK_STORAGE_KEY = "gcc-v2-roi-lookback.v1";

export function normalizeLookbackDays(value: unknown): RoiLookbackDays {
  const parsed = Number(value);
  return (lookbackDayOptions as readonly number[]).includes(parsed)
    ? (parsed as RoiLookbackDays)
    : 90;
}

export function readStoredAssumptions(): RoiAssumptions {
  if (typeof window === "undefined") return defaultAssumptions;
  try {
    const raw = window.localStorage.getItem(ROI_ASSUMPTIONS_STORAGE_KEY);
    if (!raw) return defaultAssumptions;
    const parsed = JSON.parse(raw) as Partial<RoiAssumptions>;
    return {
      ...defaultAssumptions,
      ...Object.fromEntries(
        (Object.keys(defaultAssumptions) as Array<keyof RoiAssumptions>).map((key) => {
          const value = Number(parsed[key]);
          return [key, Number.isFinite(value) ? value : defaultAssumptions[key]];
        }),
      ),
    } as RoiAssumptions;
  } catch {
    return defaultAssumptions;
  }
}

export function writeStoredAssumptions(assumptions: RoiAssumptions) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROI_ASSUMPTIONS_STORAGE_KEY, JSON.stringify(assumptions));
  } catch {
    // Ignore quota / private-mode failures; projections still work in-memory.
  }
}

export function readStoredLookbackDays(): RoiLookbackDays {
  if (typeof window === "undefined") return 90;
  try {
    return normalizeLookbackDays(window.localStorage.getItem(ROI_LOOKBACK_STORAGE_KEY));
  } catch {
    return 90;
  }
}

export function writeStoredLookbackDays(days: RoiLookbackDays) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROI_LOOKBACK_STORAGE_KEY, String(days));
  } catch {
    // Ignore persistence failures.
  }
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

export function formatMonths(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} mo`;
}

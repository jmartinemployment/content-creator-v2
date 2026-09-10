import type { ObservedTelemetry } from "@/app/roi/roi-model";

export async function fetchObservedTelemetry(lookbackDays = 90): Promise<ObservedTelemetry> {
  const response = await fetch(`/api/gcc-v2/roi/observed?lookbackDays=${lookbackDays}`, {
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : null) || `ROI observed request failed (HTTP ${response.status}).`,
    );
  }
  const observed = body?.observed;
  if (!observed || typeof observed !== "object") {
    throw new Error("ROI observed payload was malformed.");
  }
  return {
    generatedCount: Number(observed.generatedCount) || 0,
    acceptedCount: Number(observed.acceptedCount) || 0,
    publishedCount: Number(observed.publishedCount) || 0,
    rejectedCount: Number(observed.rejectedCount) || 0,
    cancelledCount: Number(observed.cancelledCount) || 0,
    reviewMinutes: Number(observed.reviewMinutes) || 0,
    periodLabel: typeof observed.periodLabel === "string" ? observed.periodLabel : "Observed period",
    source: observed.source === "telemetry" || observed.source === "empty" ? observed.source : "demo",
    lookbackDays: Number.isFinite(Number(observed.lookbackDays)) && Number(observed.lookbackDays) > 0
      ? Number(observed.lookbackDays)
      : lookbackDays,
    notes: Array.isArray(observed.notes)
      ? observed.notes.filter((note: unknown): note is string => typeof note === "string")
      : undefined,
  };
}

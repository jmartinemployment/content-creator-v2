import type {
  CreateCustomerOutcomeInput,
  CustomerOutcomeEvidenceStatus,
  CustomerOutcomeRecord,
  ObservedTelemetry,
} from "@/app/roi/roi-model";
import { customerOutcomeEvidenceStatuses } from "@/app/roi/roi-model";

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
    groundednessRate: optionalRate(observed.groundednessRate),
    groundedHits: optionalCount(observed.groundedHits),
    groundedTotal: optionalCount(observed.groundedTotal),
    schemaValidityRate: optionalRate(observed.schemaValidityRate),
    schemaValidHits: optionalCount(observed.schemaValidHits),
    schemaValidTotal: optionalCount(observed.schemaValidTotal),
    qualityRunsSampled: optionalCount(observed.qualityRunsSampled),
    meanEditDistance: optionalRate(observed.meanEditDistance),
    editDistanceSamples: optionalCount(observed.editDistanceSamples),
    notes: Array.isArray(observed.notes)
      ? observed.notes.filter((note: unknown): note is string => typeof note === "string")
      : undefined,
  };
}

export async function fetchCustomerOutcomes(): Promise<CustomerOutcomeRecord[]> {
  const response = await fetch("/api/gcc-v2/roi/outcomes", { cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : null) || `Customer outcomes request failed (HTTP ${response.status}).`,
    );
  }
  const rows: unknown[] = Array.isArray(body?.outcomes) ? body.outcomes : [];
  return rows.map(parseOutcome).filter((row): row is CustomerOutcomeRecord => row !== null);
}

export async function createCustomerOutcome(
  input: CreateCustomerOutcomeInput,
): Promise<CustomerOutcomeRecord> {
  const response = await fetch("/api/gcc-v2/roi/outcomes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : null) || `Create outcome failed (HTTP ${response.status}).`,
    );
  }
  const parsed = parseOutcome(body?.outcome);
  if (!parsed) throw new Error("Create outcome response was malformed.");
  return parsed;
}

export async function deleteCustomerOutcome(id: string): Promise<void> {
  const response = await fetch(`/api/gcc-v2/roi/outcomes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(
      (body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : null) || `Delete outcome failed (HTTP ${response.status}).`,
    );
  }
}

function parseOutcome(raw: unknown): CustomerOutcomeRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.title !== "string") return null;
  if (typeof row.metricDefinition !== "string" || typeof row.source !== "string") return null;
  if (typeof row.periodStart !== "string" || typeof row.periodEnd !== "string") return null;
  return {
    id: row.id,
    title: row.title,
    metricDefinition: row.metricDefinition,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    baseline: optionalString(row.baseline),
    denominator: optionalString(row.denominator),
    observedValue: optionalString(row.observedValue),
    source: row.source,
    evidenceStatus: parseEvidenceStatus(row.evidenceStatus),
    attributionMethod: optionalString(row.attributionMethod),
    attributionConfidence: optionalRate(row.attributionConfidence) ?? null,
    workflowVersionsJson:
      typeof row.workflowVersionsJson === "string" ? row.workflowVersionsJson : "[]",
    generatedCount: optionalNullableCount(row.generatedCount),
    acceptedCount: optionalNullableCount(row.acceptedCount),
    publishedCount: optionalNullableCount(row.publishedCount),
    rejectedCount: optionalNullableCount(row.rejectedCount),
    reviewMinutes: optionalNullableCount(row.reviewMinutes),
    notes: optionalString(row.notes),
    createdAtUtc: typeof row.createdAtUtc === "string" ? row.createdAtUtc : "",
    updatedAtUtc: typeof row.updatedAtUtc === "string" ? row.updatedAtUtc : "",
  };
}

function parseEvidenceStatus(value: unknown): CustomerOutcomeEvidenceStatus {
  if (typeof value === "string" && (customerOutcomeEvidenceStatuses as readonly string[]).includes(value)) {
    return value as CustomerOutcomeEvidenceStatus;
  }
  return "customer-reported";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalRate(value: unknown): number | null | undefined {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalCount(value: unknown): number | undefined {
  if (value == null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function optionalNullableCount(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

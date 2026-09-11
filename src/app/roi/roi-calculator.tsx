"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createCustomerOutcome,
  deleteCustomerOutcome,
  fetchCustomerOutcomes,
  fetchObservedTelemetry,
} from "@/app/roi/roi-api";
import {
  customerOutcomeEvidenceStatuses,
  defaultAssumptions,
  demoObservedTelemetry,
  formatCurrency,
  formatHours,
  formatMonths,
  formatPercent,
  lookbackDayOptions,
  normalizeLookbackDays,
  observedAcceptanceRate,
  observedPublishRate,
  projectAllScenarios,
  readStoredAssumptions,
  readStoredLookbackDays,
  reconcileProjectedVsObserved,
  writeStoredAssumptions,
  writeStoredLookbackDays,
  type CustomerOutcomeEvidenceStatus,
  type CustomerOutcomeRecord,
  type ObservedTelemetry,
  type RoiAssumptions,
  type RoiLookbackDays,
} from "@/app/roi/roi-model";

type AssumptionField = {
  key: keyof RoiAssumptions;
  label: string;
  hint: string;
  step?: number;
  isRate?: boolean;
};

const fields: readonly AssumptionField[] = [
  { key: "workflowVolume", label: "Workflow volume / year", hint: "Jobs or assets in scope", step: 1 },
  { key: "baselineMinutes", label: "Baseline minutes / job", hint: "Unaided effort", step: 1 },
  { key: "assistedMinutes", label: "Assisted minutes / job", hint: "With Content Creator", step: 1 },
  { key: "adoptionRate", label: "Adoption rate", hint: "Share of volume using the workflow", step: 0.01, isRate: true },
  { key: "successfulUseRate", label: "Successful use rate", hint: "Runs that clear review", step: 0.01, isRate: true },
  { key: "loadedHourlyCost", label: "Loaded hourly cost", hint: "Fully loaded labor cost", step: 1 },
  { key: "redeploymentFactor", label: "Redeployment factor", hint: "Share of saved hours reused productively", step: 0.01, isRate: true },
  { key: "externalSpend", label: "External annual spend", hint: "Agency / contractor budget in scope", step: 100 },
  { key: "replaceableShare", label: "Replaceable share", hint: "Portion of spend that can shift in-house", step: 0.01, isRate: true },
  { key: "totalCostOfOwnership", label: "Total cost of ownership", hint: "Platform + enablement for the period", step: 100 },
  { key: "attributableGrossMargin", label: "Attributable gross margin", hint: "Reserved for revenue→GP conversion (not applied to cash ROI)", step: 0.01, isRate: true },
];

type OutcomeDraft = {
  title: string;
  metricDefinition: string;
  periodStart: string;
  periodEnd: string;
  baseline: string;
  denominator: string;
  observedValue: string;
  source: string;
  evidenceStatus: CustomerOutcomeEvidenceStatus;
  attributionMethod: string;
  attributionConfidence: string;
  workflowVersionsJson: string;
  generatedCount: string;
  acceptedCount: string;
  publishedCount: string;
  rejectedCount: string;
  reviewMinutes: string;
  notes: string;
};

function emptyOutcomeDraft(): OutcomeDraft {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 90);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    title: "",
    metricDefinition: "",
    periodStart: iso(start),
    periodEnd: iso(end),
    baseline: "",
    denominator: "",
    observedValue: "",
    source: "",
    evidenceStatus: "customer-reported",
    attributionMethod: "",
    attributionConfidence: "",
    workflowVersionsJson: "[]",
    generatedCount: "",
    acceptedCount: "",
    publishedCount: "",
    rejectedCount: "",
    reviewMinutes: "",
    notes: "",
  };
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

export function RoiCalculator() {
  const [assumptions, setAssumptions] = useState<RoiAssumptions>(defaultAssumptions);
  const [lookbackDays, setLookbackDays] = useState<RoiLookbackDays>(90);
  const [hydrated, setHydrated] = useState(false);
  const projections = useMemo(() => projectAllScenarios(assumptions), [assumptions]);
  const [observed, setObserved] = useState<ObservedTelemetry>(demoObservedTelemetry);
  const [observedError, setObservedError] = useState<string | null>(null);
  const [observedLoading, setObservedLoading] = useState(false);
  const [outcomes, setOutcomes] = useState<CustomerOutcomeRecord[]>([]);
  const [outcomesError, setOutcomesError] = useState<string | null>(null);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [outcomeDraft, setOutcomeDraft] = useState<OutcomeDraft>(emptyOutcomeDraft);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [outcomeFormError, setOutcomeFormError] = useState<string | null>(null);
  const acceptance = observedAcceptanceRate(observed);
  const publish = observedPublishRate(observed);
  const reconciliation = useMemo(
    () => reconcileProjectedVsObserved(assumptions, observed),
    [assumptions, observed],
  );

  useEffect(() => {
    setAssumptions(readStoredAssumptions());
    setLookbackDays(readStoredLookbackDays());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredAssumptions(assumptions);
  }, [assumptions, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredLookbackDays(lookbackDays);
  }, [lookbackDays, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setObservedLoading(true);
    void fetchObservedTelemetry(lookbackDays)
      .then((next) => {
        if (cancelled) return;
        setObserved(next);
        setObservedError(null);
      })
      .catch((cause) => {
        if (cancelled) return;
        setObserved({ ...demoObservedTelemetry, lookbackDays });
        setObservedError(cause instanceof Error ? cause.message : "Could not load observed telemetry.");
      })
      .finally(() => {
        if (!cancelled) setObservedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, lookbackDays]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setOutcomesLoading(true);
    void fetchCustomerOutcomes()
      .then((rows) => {
        if (cancelled) return;
        setOutcomes(rows);
        setOutcomesError(null);
      })
      .catch((cause) => {
        if (cancelled) return;
        setOutcomes([]);
        setOutcomesError(cause instanceof Error ? cause.message : "Could not load customer outcomes.");
      })
      .finally(() => {
        if (!cancelled) setOutcomesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  function updateField(key: keyof RoiAssumptions, raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setAssumptions((current) => ({ ...current, [key]: parsed }));
  }

  function resetAssumptions() {
    setAssumptions(defaultAssumptions);
  }

  async function submitOutcome(event: FormEvent) {
    event.preventDefault();
    setOutcomeFormError(null);
    setOutcomeSaving(true);
    try {
      const confidenceRaw = outcomeDraft.attributionConfidence.trim();
      const confidence = confidenceRaw === "" ? null : Number(confidenceRaw);
      if (confidenceRaw !== "" && (!Number.isFinite(confidence) || confidence! < 0 || confidence! > 1)) {
        throw new Error("Attribution confidence must be between 0 and 1.");
      }
      const created = await createCustomerOutcome({
        title: outcomeDraft.title.trim(),
        metricDefinition: outcomeDraft.metricDefinition.trim(),
        periodStart: outcomeDraft.periodStart,
        periodEnd: outcomeDraft.periodEnd,
        baseline: outcomeDraft.baseline.trim() || undefined,
        denominator: outcomeDraft.denominator.trim() || undefined,
        observedValue: outcomeDraft.observedValue.trim() || undefined,
        source: outcomeDraft.source.trim(),
        evidenceStatus: outcomeDraft.evidenceStatus,
        attributionMethod: outcomeDraft.attributionMethod.trim() || undefined,
        attributionConfidence: confidence,
        workflowVersionsJson: outcomeDraft.workflowVersionsJson.trim() || "[]",
        generatedCount: parseOptionalInt(outcomeDraft.generatedCount),
        acceptedCount: parseOptionalInt(outcomeDraft.acceptedCount),
        publishedCount: parseOptionalInt(outcomeDraft.publishedCount),
        rejectedCount: parseOptionalInt(outcomeDraft.rejectedCount),
        reviewMinutes: parseOptionalInt(outcomeDraft.reviewMinutes),
        notes: outcomeDraft.notes.trim() || undefined,
      });
      setOutcomes((current) => [created, ...current]);
      setOutcomeDraft(emptyOutcomeDraft());
    } catch (cause) {
      setOutcomeFormError(cause instanceof Error ? cause.message : "Could not save outcome.");
    } finally {
      setOutcomeSaving(false);
    }
  }

  async function removeOutcome(id: string) {
    setOutcomeFormError(null);
    try {
      await deleteCustomerOutcome(id);
      setOutcomes((current) => current.filter((row) => row.id !== id));
    } catch (cause) {
      setOutcomeFormError(cause instanceof Error ? cause.message : "Could not delete outcome.");
    }
  }

  const sourceBadge =
    observed.source === "telemetry"
      ? { label: "Live TaskRuns", className: "border-emerald-200 bg-emerald-50 text-emerald-800" }
      : observed.source === "empty"
        ? { label: "No runs yet", className: "border-slate-200 bg-slate-50 text-slate-700" }
        : { label: "Demo feed", className: "border-amber-200 bg-amber-50 text-amber-800" };

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--cc-accent)]">Measurement</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">ROI</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cc-muted)]">
            Transparent directional projections. Every coefficient is editable. Capacity created stays
            separate from cash saved; this is not a quote or guarantee.
          </p>
        </div>
        <label className="block text-sm font-medium text-[var(--cc-ink)]">
          Observed lookback
          <select
            aria-label="Observed lookback days"
            className="mt-1 block min-w-[10rem] rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
            value={lookbackDays}
            onChange={(event) => setLookbackDays(normalizeLookbackDays(event.target.value))}
          >
            {lookbackDayOptions.map((days) => (
              <option key={days} value={days}>
                Last {days} days
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--cc-ink)]">Assumptions</h2>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                Formulas: savedHours = volume × (baseline − assisted) / 60 × adoption × success
              </p>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                Saved in this browser so edits survive reload.
              </p>
            </div>
            <button
              type="button"
              onClick={resetAssumptions}
              className="rounded-md border border-[var(--cc-line)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-ink)]"
            >
              Reset defaults
            </button>
          </div>
          <ul className="mt-5 space-y-4">
            {fields.map((field) => (
              <li key={field.key}>
                <label className="block text-sm font-medium text-[var(--cc-ink)]" htmlFor={field.key}>
                  {field.label}
                </label>
                <p className="mt-0.5 text-xs text-[var(--cc-muted)]">{field.hint}</p>
                <input
                  id={field.key}
                  type="number"
                  step={field.step ?? 1}
                  value={assumptions[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">Projected scenarios</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f7f6] text-xs uppercase tracking-wide text-[var(--cc-muted)]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Scenario</th>
                    <th className="px-3 py-3 font-semibold">Saved hours</th>
                    <th className="px-3 py-3 font-semibold">Productivity</th>
                    <th className="px-3 py-3 font-semibold">External avoided</th>
                    <th className="px-3 py-3 font-semibold">Net benefit</th>
                    <th className="px-3 py-3 font-semibold">ROI</th>
                    <th className="px-3 py-3 font-semibold">Payback</th>
                    <th className="px-3 py-3 font-semibold">Time to value</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((row) => (
                    <tr key={row.scenario} className="border-t border-[var(--cc-line)]">
                      <td className="px-3 py-3 font-medium">{row.label}</td>
                      <td className="px-3 py-3">{formatHours(row.savedHours)}</td>
                      <td className="px-3 py-3">{formatCurrency(row.productivityValue)}</td>
                      <td className="px-3 py-3">{formatCurrency(row.externalCostAvoided)}</td>
                      <td className="px-3 py-3">{formatCurrency(row.netBenefit)}</td>
                      <td className="px-3 py-3">{formatPercent(row.roiPercent)}</td>
                      <td className="px-3 py-3">{formatMonths(row.paybackMonths)}</td>
                      <td className="px-3 py-3">{formatMonths(row.timeToValueMonths)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--cc-muted)]">
              grossBenefit = productivityValue + externalCostAvoided · netBenefit = grossBenefit − TCO ·
              roiPercent = netBenefit / TCO × 100 · paybackMonths = TCO / (grossBenefit/12) ·
              timeToValueMonths = TCO / (productivityValue/12). Attributable gross margin is reserved for
              revenue→GP conversion and is not mixed into cash ROI.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm" aria-label="Projected versus observed">
            <h2 className="font-semibold text-[var(--cc-ink)]">Projected vs observed</h2>
            <p className="mt-1 text-xs text-[var(--cc-muted)]">
              Expected-scenario assumptions compared to live TaskRun acceptance and Canvas publishes.
            </p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Assumed success rate</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatPercent(reconciliation.assumedSuccessRate * 100)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Observed acceptance</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatPercent(
                    reconciliation.observedAcceptanceRate == null
                      ? null
                      : reconciliation.observedAcceptanceRate * 100,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Success delta</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {reconciliation.successRateDeltaPp == null
                    ? "—"
                    : `${reconciliation.successRateDeltaPp >= 0 ? "+" : ""}${reconciliation.successRateDeltaPp.toFixed(1)} pp`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Assumed assisted minutes</dt>
                <dd className="mt-1 text-lg font-semibold">{reconciliation.assumedAssistedMinutes}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Observed avg review minutes</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {reconciliation.observedAvgReviewMinutes == null
                    ? "—"
                    : reconciliation.observedAvgReviewMinutes.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Annualized accepted (proj / obs)</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {reconciliation.projectedAnnualAccepted.toFixed(0)}
                  {" / "}
                  {reconciliation.observedAnnualizedAccepted == null
                    ? "—"
                    : reconciliation.observedAnnualizedAccepted.toFixed(0)}
                </dd>
              </div>
            </dl>
            <ul className="mt-4 list-disc space-y-1 pl-4 text-xs text-[var(--cc-muted)]">
              {reconciliation.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-[var(--cc-ink)]">Observed telemetry</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sourceBadge.className}`}>
                {sourceBadge.label}
              </span>
              {observedLoading ? (
                <span className="text-xs text-[var(--cc-muted)]">Refreshing…</span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[var(--cc-muted)]">
              {observed.periodLabel}. Acceptance and publish rates are workflow outcomes, not dollar ROI.
            </p>
            {observedError ? (
              <p role="alert" className="mt-3 text-xs text-amber-800">
                Live feed unavailable ({observedError}). Showing demo numbers.
              </p>
            ) : null}
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Generated</dt>
                <dd className="mt-1 text-lg font-semibold">{observed.generatedCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Accepted</dt>
                <dd className="mt-1 text-lg font-semibold">{observed.acceptedCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Published</dt>
                <dd className="mt-1 text-lg font-semibold">{observed.publishedCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Rejected</dt>
                <dd className="mt-1 text-lg font-semibold">{observed.rejectedCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Cancelled</dt>
                <dd className="mt-1 text-lg font-semibold">{observed.cancelledCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Review minutes</dt>
                <dd className="mt-1 text-lg font-semibold">{observed.reviewMinutes}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Acceptance / publish</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatPercent(acceptance == null ? null : acceptance * 100)} /{" "}
                  {formatPercent(publish == null ? null : publish * 100)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Groundedness</dt>
                <dd className="mt-1 text-lg font-semibold" data-testid="roi-groundedness-rate">
                  {formatPercent(
                    observed.groundednessRate == null ? null : observed.groundednessRate * 100,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Schema validity</dt>
                <dd className="mt-1 text-lg font-semibold" data-testid="roi-schema-validity-rate">
                  {formatPercent(
                    observed.schemaValidityRate == null ? null : observed.schemaValidityRate * 100,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Edit distance</dt>
                <dd className="mt-1 text-lg font-semibold" data-testid="roi-mean-edit-distance">
                  {observed.meanEditDistance == null
                    ? "—"
                    : observed.meanEditDistance.toFixed(2)}
                </dd>
              </div>
            </dl>
            {observed.notes && observed.notes.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1 pl-4 text-xs text-[var(--cc-muted)]">
                {observed.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section
            className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm"
            data-testid="roi-customer-outcomes"
          >
            <h2 className="font-semibold text-[var(--cc-ink)]">Customer outcome records</h2>
            <p className="mt-1 text-xs text-[var(--cc-muted)]">
              Evidence-aware outcomes with metric definition, period, baseline, denominator, source,
              workflow versions, and evidence status — not vendor marketing claims or cash ROI
              coefficients.
            </p>
            {outcomesError ? (
              <p role="alert" className="mt-3 text-xs text-amber-800">
                Outcomes feed unavailable ({outcomesError}).
              </p>
            ) : null}
            {outcomeFormError ? (
              <p role="alert" className="mt-3 text-xs text-amber-800">
                {outcomeFormError}
              </p>
            ) : null}

            <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submitOutcome}>
              <label className="block text-sm font-medium text-[var(--cc-ink)] sm:col-span-2">
                Title
                <input
                  required
                  aria-label="Outcome title"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.title}
                  onChange={(event) => setOutcomeDraft((d) => ({ ...d, title: event.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)] sm:col-span-2">
                Metric definition
                <textarea
                  required
                  aria-label="Outcome metric definition"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.metricDefinition}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, metricDefinition: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Period start
                <input
                  required
                  type="date"
                  aria-label="Outcome period start"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.periodStart}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, periodStart: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Period end
                <input
                  required
                  type="date"
                  aria-label="Outcome period end"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.periodEnd}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, periodEnd: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Baseline
                <input
                  aria-label="Outcome baseline"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.baseline}
                  onChange={(event) => setOutcomeDraft((d) => ({ ...d, baseline: event.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Denominator
                <input
                  aria-label="Outcome denominator"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.denominator}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, denominator: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Observed value
                <input
                  aria-label="Outcome observed value"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.observedValue}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, observedValue: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Source
                <input
                  required
                  aria-label="Outcome source"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.source}
                  onChange={(event) => setOutcomeDraft((d) => ({ ...d, source: event.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Evidence status
                <select
                  aria-label="Outcome evidence status"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.evidenceStatus}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({
                      ...d,
                      evidenceStatus: event.target.value as CustomerOutcomeEvidenceStatus,
                    }))
                  }
                >
                  {customerOutcomeEvidenceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Attribution method
                <input
                  aria-label="Outcome attribution method"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.attributionMethod}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, attributionMethod: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Attribution confidence (0–1)
                <input
                  aria-label="Outcome attribution confidence"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.attributionConfidence}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, attributionConfidence: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)] sm:col-span-2">
                Workflow / feature versions (JSON)
                <input
                  aria-label="Outcome workflow versions JSON"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
                  value={outcomeDraft.workflowVersionsJson}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, workflowVersionsJson: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Generated
                <input
                  aria-label="Outcome generated count"
                  type="number"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.generatedCount}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, generatedCount: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Accepted
                <input
                  aria-label="Outcome accepted count"
                  type="number"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.acceptedCount}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, acceptedCount: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Published
                <input
                  aria-label="Outcome published count"
                  type="number"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.publishedCount}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, publishedCount: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Rejected
                <input
                  aria-label="Outcome rejected count"
                  type="number"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.rejectedCount}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, rejectedCount: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)]">
                Review minutes
                <input
                  aria-label="Outcome review minutes"
                  type="number"
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.reviewMinutes}
                  onChange={(event) =>
                    setOutcomeDraft((d) => ({ ...d, reviewMinutes: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[var(--cc-ink)] sm:col-span-2">
                Notes
                <textarea
                  aria-label="Outcome notes"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
                  value={outcomeDraft.notes}
                  onChange={(event) => setOutcomeDraft((d) => ({ ...d, notes: event.target.value }))}
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={outcomeSaving}
                  className="rounded-md border border-[var(--cc-line)] bg-[var(--cc-ink)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {outcomeSaving ? "Saving…" : "Save outcome record"}
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-3" data-testid="roi-customer-outcomes-list">
              {outcomesLoading ? (
                <p className="text-xs text-[var(--cc-muted)]">Loading outcomes…</p>
              ) : null}
              {!outcomesLoading && outcomes.length === 0 ? (
                <p className="text-xs text-[var(--cc-muted)]">No customer outcome records yet.</p>
              ) : null}
              {outcomes.map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl border border-[var(--cc-line)] px-4 py-3"
                  data-testid="roi-customer-outcome-row"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[var(--cc-ink)]">{row.title}</h3>
                      <p className="mt-1 text-xs text-[var(--cc-muted)]">
                        {row.periodStart} → {row.periodEnd} · {row.evidenceStatus}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs font-semibold text-[var(--cc-ink)]"
                      onClick={() => void removeOutcome(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-[var(--cc-ink)]">{row.metricDefinition}</p>
                  <dl className="mt-3 grid gap-2 text-xs text-[var(--cc-muted)] sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-[var(--cc-ink)]">Source</dt>
                      <dd>{row.source}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[var(--cc-ink)]">Observed</dt>
                      <dd>{row.observedValue ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[var(--cc-ink)]">Baseline / denom</dt>
                      <dd>
                        {row.baseline ?? "—"} / {row.denominator ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[var(--cc-ink)]">Counts</dt>
                      <dd>
                        g {row.generatedCount ?? "—"} · a {row.acceptedCount ?? "—"} · p{" "}
                        {row.publishedCount ?? "—"} · r {row.rejectedCount ?? "—"} · review{" "}
                        {row.reviewMinutes ?? "—"}m
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

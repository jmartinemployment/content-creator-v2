"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchObservedTelemetry } from "@/app/roi/roi-api";
import {
  defaultAssumptions,
  demoObservedTelemetry,
  formatCurrency,
  formatHours,
  formatPercent,
  observedAcceptanceRate,
  observedPublishRate,
  projectAllScenarios,
  type ObservedTelemetry,
  type RoiAssumptions,
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

export function RoiCalculator() {
  const [assumptions, setAssumptions] = useState<RoiAssumptions>(defaultAssumptions);
  const projections = useMemo(() => projectAllScenarios(assumptions), [assumptions]);
  const [observed, setObserved] = useState<ObservedTelemetry>(demoObservedTelemetry);
  const [observedError, setObservedError] = useState<string | null>(null);
  const acceptance = observedAcceptanceRate(observed);
  const publish = observedPublishRate(observed);

  useEffect(() => {
    void fetchObservedTelemetry()
      .then((next) => {
        setObserved(next);
        setObservedError(null);
      })
      .catch((cause) => {
        setObserved(demoObservedTelemetry);
        setObservedError(cause instanceof Error ? cause.message : "Could not load observed telemetry.");
      });
  }, []);

  function updateField(key: keyof RoiAssumptions, raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setAssumptions((current) => ({ ...current, [key]: parsed }));
  }

  const sourceBadge =
    observed.source === "telemetry"
      ? { label: "Live TaskRuns", className: "border-emerald-200 bg-emerald-50 text-emerald-800" }
      : observed.source === "empty"
        ? { label: "No runs yet", className: "border-slate-200 bg-slate-50 text-slate-700" }
        : { label: "Demo feed", className: "border-amber-200 bg-amber-50 text-amber-800" };

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <div>
        <p className="text-sm font-semibold text-[var(--cc-accent)]">Measurement</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">ROI</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cc-muted)]">
          Transparent directional projections. Every coefficient is editable. Capacity created stays
          separate from cash saved; this is not a quote or guarantee.
        </p>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-[var(--cc-ink)]">Assumptions</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Formulas: savedHours = volume × (baseline − assisted) / 60 × adoption × success
          </p>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--cc-muted)]">
              grossBenefit = productivityValue + externalCostAvoided · netBenefit = grossBenefit − TCO ·
              roiPercent = netBenefit / TCO × 100. Attributable gross margin is shown for future revenue
              conversion and is not mixed into cash ROI.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-[var(--cc-ink)]">Observed telemetry</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sourceBadge.className}`}>
                {sourceBadge.label}
              </span>
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
            </dl>
            {observed.notes && observed.notes.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1 pl-4 text-xs text-[var(--cc-muted)]">
                {observed.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

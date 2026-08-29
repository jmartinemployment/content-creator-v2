import type { ValidationReportView } from "@/app/creates/canvas-types";

/** Human-readable reasons `shipReady` is still false or Fix readiness left work undone. */
export function listOutstandingBlockers(report: ValidationReportView): string[] {
  const items: string[] = [];
  if (report.overlapHits.length > 0) {
    items.push(
      `${report.overlapHits.length} overlap hit${report.overlapHits.length === 1 ? "" : "s"} — duplicate problem/solution across H2s`,
    );
  }
  if (!report.polishShipReady) {
    items.push("Polish not ship-ready (placeholder or prohibited phrasing)");
  }
  if ((report.guardrailRestructureCount ?? 0) > 0) {
    items.push(
      `${report.guardrailRestructureCount} guardrail restructure flag${report.guardrailRestructureCount === 1 ? "" : "s"}`,
    );
  }
  const seoFails = report.seoChecks?.filter((c) => !c.passed).length ?? 0;
  if (seoFails > 0) {
    items.push(`${seoFails} SEO check${seoFails === 1 ? "" : "s"} still failing`);
  }
  const geoFails = report.geoChecks?.filter((c) => !c.passed).length ?? 0;
  if (geoFails > 0) {
    items.push(`${geoFails} GEO check${geoFails === 1 ? "" : "s"} still failing`);
  }
  return items;
}

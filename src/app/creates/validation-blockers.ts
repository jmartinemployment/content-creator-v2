import type { ValidationReportView } from "@/app/creates/canvas-types";
import type { RagCitation } from "@/app/creates/rag-contract";
import { sourceRightsBlocksShip, sourceRightsGapLabel } from "@/app/creates/source-rights";

export type OutstandingBlockerOptions = {
  /** Displayed citations to check for sourceRights ship blocks (P1.5). */
  citations?: RagCitation[];
};

/** Human-readable reasons `shipReady` is still false or Fix readiness left work undone. */
export function listOutstandingBlockers(
  report: ValidationReportView,
  options?: OutstandingBlockerOptions,
): string[] {
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
  // GEO checks are advisory only — never list as ship blockers (master-plan / architecture).

  const ragIssues = report.validation?.issues ?? [];
  for (const issue of ragIssues.slice(0, 8)) {
    const section = issue.sectionTitle?.trim() || "Document";
    const detail = issue.detail?.trim() || issue.repairInstruction?.trim();
    if (detail) {
      items.push(`RAG / reviewer · ${section}: ${detail}`);
    }
  }
  if (ragIssues.length > 8) {
    items.push(`${ragIssues.length - 8} more RAG / reviewer issue${ragIssues.length - 8 === 1 ? "" : "s"}`);
  }

  const citationGaps = (report.citationEvidenceGaps ?? [])
    .map((gap) => gap.trim())
    .filter(Boolean);
  for (const gap of citationGaps.slice(0, 8)) {
    items.push(`Citation evidence · ${gap}`);
  }
  if (citationGaps.length > 8) {
    items.push(
      `${citationGaps.length - 8} more citation evidence gap${citationGaps.length - 8 === 1 ? "" : "s"}`,
    );
  }

  const rightsSeen = new Set<string>();
  for (const citation of options?.citations ?? []) {
    if (!sourceRightsBlocksShip(citation.sourceRights)) continue;
    const label = sourceRightsGapLabel(citation);
    if (rightsSeen.has(label)) continue;
    rightsSeen.add(label);
    items.push(label);
  }

  if (
    items.length === 0
    && report.reviewNotes?.trim()
    && (report.reviewVerdict !== "approved" || report.outstandingIssues)
  ) {
    for (const line of report.reviewNotes.split("\n").map((entry) => entry.trim()).filter(Boolean).slice(0, 5)) {
      items.push(line);
    }
  }

  if (items.length === 0 && report.outstandingIssues && report.reviewVerdict !== "approved") {
    items.push(`Editorial verdict is "${report.reviewVerdict}"`);
  }

  return items;
}

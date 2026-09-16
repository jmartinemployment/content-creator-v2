import type { RagCitation } from "@/app/creates/rag-contract";

export type SourceRights = "consented" | "licensed" | "unknown" | "prohibited";

/** Missing field ≡ unknown (master-plan P1.5). */
export function normalizeSourceRights(value: string | null | undefined): SourceRights {
  if (value === "consented" || value === "licensed" || value === "prohibited" || value === "unknown") {
    return value;
  }
  return "unknown";
}

export function sourceRightsBlocksShip(value: string | null | undefined): boolean {
  const rights = normalizeSourceRights(value);
  return rights === "unknown" || rights === "prohibited";
}

export function sourceRightsGapLabel(citation: RagCitation): string {
  const value = normalizeSourceRights(citation.sourceRights);
  const sectionKey = citation.sectionKey?.trim() || "unknown";
  return `sourceRights '${value}' on citation for section '${sectionKey}'`;
}

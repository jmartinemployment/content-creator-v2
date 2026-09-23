import { CONTENT_TYPES } from "@/lib/content-types";
import type { GccArtifact } from "@/services/gcc-api";

/**
 * Everything generated for one create, as a set — v1's `GeneratedContentSet`, kept by name because
 * it names the concept plainly.
 *
 * v1 declared it as fixed fields (`article`, `blog`, `toolPosts[]`, `imagePrompts`,
 * `coldOutreachEmail`), which meant adding a content type meant editing the type, the view and the
 * tab list. This derives the same thing from the artifacts a create actually has, so a new content
 * type changes nothing here.
 *
 * One field of v1's was already a list — `toolPosts[]`, "one page per unique crawl tool ... no cap
 * of 5" — so several artifacts under one type is v1 behaviour, not a new requirement.
 */
export interface GeneratedContentGroup {
  /** The artifact's own `type` string, as generated. */
  type: string;
  /** Operator-facing label from CONTENT_TYPES; falls back to the raw type. */
  label: string;
  artifacts: GccArtifact[];
}

export type GeneratedContentSet = GeneratedContentGroup[];

/**
 * Groups a create's artifacts by content type, ordered by CONTENT_TYPES so the tab order is the
 * same one the pickers use rather than generation order. Types the create has no artifacts for do
 * not appear.
 */
export function toGeneratedContentSet(artifacts: GccArtifact[]): GeneratedContentSet {
  const byType = new Map<string, GccArtifact[]>();
  for (const artifact of artifacts) {
    const key = artifact.type ?? "";
    const existing = byType.get(key);
    if (existing) existing.push(artifact);
    else byType.set(key, [artifact]);
  }

  // Keyed by the raw artifact type string: an artifact carries whatever type it was
  // generated as, which need not still be in CONTENT_TYPES.
  const order = new Map<string, number>(CONTENT_TYPES.map((t, i) => [t.value as string, i]));
  const labels = new Map<string, string>(CONTENT_TYPES.map((t) => [t.value as string, t.label]));

  return [...byType.entries()]
    .map(([type, group]) => ({
      type,
      label: labels.get(type) ?? type,
      artifacts: group,
    }))
    .sort((a, b) => (order.get(a.type) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.type) ?? Number.MAX_SAFE_INTEGER));
}

import { CONTENT_TYPES } from "@/lib/content-types";
import type { GccArtifact } from "@/services/gcc-api";

/**
 * Everything generated for one create, as a set — v1's `GeneratedContentSet`, kept by name because
 * it names the concept plainly.
 *
 * v1 declared it as fixed fields (`article`, `blog`, `toolPosts[]`, `imagePrompts`,
 * `coldOutreachEmail`), which meant adding a content type meant editing the type, the view and the
 * tab list. This derives the groups from the artifacts a create actually has, so a new content type
 * changes nothing here.
 *
 * One field of v1's was already a list — `toolPosts[]`, "one page per unique crawl tool ... no cap
 * of 5" — so several artifacts under one type is v1 behaviour, not a new requirement.
 *
 * What v1's fixed fields did get right is that the tab was there whether or not the field was
 * filled: an empty Pillar tab says the pillar was not generated, where a missing one says nothing at
 * all and reads as though the type does not exist. So the three long-form types always appear, with
 * no artifacts when the create has none, and every other type appears only once it has produced
 * something (Jeff, 2026-09-27: "Add tabs for Image-prompts, Blog, Pillar, Tools"). Image prompts are
 * the fourth tab and are not a content type at all — they live on the documents, so the workspace
 * adds that one itself.
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
 * The long-form types that always get a tab, in the order they are shown. These are the three types
 * with a live prompt set behind them (`ContentTypePromptRegistry`: Pillar, Blog, Tool), so they are
 * the three a create can actually be asked to produce.
 */
export const ALWAYS_SHOWN_TYPES = ["pillar", "blog", "tool"] as const;

/**
 * Groups a create's artifacts by content type, ordered by CONTENT_TYPES so the tab order is the
 * same one the pickers use rather than generation order. The three long-form types appear whether
 * or not the create produced one; any other type appears once it has an artifact.
 */
export function toGeneratedContentSet(artifacts: GccArtifact[]): GeneratedContentSet {
  const byType = new Map<string, GccArtifact[]>();
  for (const type of ALWAYS_SHOWN_TYPES) byType.set(type, []);
  for (const artifact of artifacts) {
    const key = artifact.type ?? "";
    const existing = byType.get(key);
    if (existing) existing.push(artifact);
    else byType.set(key, [artifact]);
  }

  // An artifact whose type is empty would otherwise group under "", which is a tab with no name.
  for (const [type, group] of [...byType.entries()]) {
    if (type.length === 0 && group.length === 0) byType.delete(type);
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

import { CONTENT_TYPES, isContentTypeDisabled } from "@/lib/content-types";
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
 * all and reads as though the type does not exist. So every type that can be asked for always
 * appears, with no artifacts when the project has none; a type that is disabled appears only if a
 * page of it exists from before. Until 2026-10-06 only Pillar, Blog and Tool were always shown
 * (Jeff, 2026-09-27: "Add tabs for Image-prompts, Blog, Pillar, Tools" -- the three live types of
 * that day), and when seven types became live the other four had no tab until they produced
 * something; Jeff, on a project with none: "Email & social have no tabs to display their data, is
 * there data?" Image prompts are not a content type at all -- they live on the documents, so the
 * workspace adds that tab itself and `image-prompt` is left out here.
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
 * The types that always get a tab: every type the Generate picker offers enabled, in the picker's
 * order, less `image-prompt`, which has the workspace's own tab. Derived from the same registry the
 * picker reads, so enabling a type gives it a tab in the same change.
 */
export const ALWAYS_SHOWN_TYPES: readonly string[] = CONTENT_TYPES.filter(
  (t) => !isContentTypeDisabled(t.value) && t.value !== "image-prompt",
).map((t) => t.value as string);

/**
 * Groups a project's artifacts by content type, ordered by CONTENT_TYPES so the tab order is the
 * same one the pickers use rather than generation order. Every enabled type appears whether or not
 * the project has a page of it; any other type appears once it has an artifact.
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

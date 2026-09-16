/** Generate jobs that can be Re-Purposed into channel packs (Canvas active tab). */
export const REPURPOSE_SOURCE_TYPES = [
  "pillar",
  "blog",
  "tool",
  "comparison",
  "case-study",
  "guide",
  "alternatives",
  "tech-article",
  "listicle",
  "service",
  "local",
  "whitepaper",
  "email",
  "social",
  "ads",
] as const;

export type RepurposeSourceType = (typeof REPURPOSE_SOURCE_TYPES)[number];

/** Default channel mix — same for every source type (see plan § Re-Purpose). */
export const REPURPOSE_CHANNELS = [
  "linkedin",
  "x",
  "email",
  "blog",
  "meta_ad",
  "google_ad",
] as const;

export function canRepurposeContentType(contentType: string): boolean {
  return (REPURPOSE_SOURCE_TYPES as readonly string[]).includes(contentType.trim().toLowerCase());
}

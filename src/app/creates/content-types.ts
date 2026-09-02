/**
 * Content Creator v2's own content-type list — distinct from v1's
 * `STARTING_CONTENT_TYPES` (GeekContentCreator `src/lib/config.ts`), which this app never
 * imports. Matches `GccV2Create.ContentType` / `GccV2Job.ContentType` on the backend (free-form
 * strings there; this is the fixed set the v2 UI offers).
 */
export const CONTENT_TYPES = [
  { value: "blog", label: "Blog" },
  { value: "pillar", label: "Pillar" },
  { value: "tool", label: "Tool page" },
  { value: "comparison", label: "Comparison" },
  { value: "case-study", label: "Case study" },
  { value: "guide", label: "Guide / How-to" },
  { value: "alternatives", label: "Alternatives" },
  { value: "tech-article", label: "Tech article" },
  { value: "listicle", label: "Listicle" },
  { value: "service", label: "Service page" },
  { value: "local", label: "Local landing" },
  { value: "whitepaper", label: "Whitepaper" },
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "image-prompt", label: "Image prompt" },
  { value: "ads", label: "Ads" },
  { value: "linkedin-document", label: "LinkedIn document" },
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number]["value"];

/** Long-form Primary draft options — default Pillar. */
export const PRIMARY_DRAFT_TYPES = [
  { value: "pillar", label: "Pillar" },
  { value: "blog", label: "Blog" },
  { value: "tool", label: "Tool pages" },
  { value: "comparison", label: "Comparison" },
  { value: "case-study", label: "Case study" },
  { value: "guide", label: "Guide / How-to" },
  { value: "alternatives", label: "Alternatives" },
  { value: "tech-article", label: "Tech article" },
  { value: "listicle", label: "Listicle" },
  { value: "service", label: "Service page" },
  { value: "local", label: "Local landing" },
  { value: "whitepaper", label: "Whitepaper" },
] as const satisfies ReadonlyArray<{ value: ContentType; label: string }>;

export type PrimaryDraftType = (typeof PRIMARY_DRAFT_TYPES)[number]["value"];

const LONG_FORM_TYPES = new Set<string>(PRIMARY_DRAFT_TYPES.map((t) => t.value));

export function isLongFormContentType(value: string): boolean {
  return LONG_FORM_TYPES.has(value.trim().toLowerCase());
}

/** Short-form Also draft types (excludes tool — tool is primary long-form or Also with pillar/blog). */
export const ALSO_DRAFT_SHORT_TYPES = [
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "ads", label: "Ads" },
  { value: "linkedin-document", label: "LinkedIn document" },
] as const satisfies ReadonlyArray<{ value: ContentType; label: string }>;

const OTHER_LONG_FORM: ReadonlyArray<{ value: ContentType; label: string }> = [
  { value: "pillar", label: "Pillar" },
  { value: "blog", label: "Blog" },
  { value: "tool", label: "Tool page" },
  { value: "comparison", label: "Comparison" },
  { value: "case-study", label: "Case study" },
  { value: "guide", label: "Guide / How-to" },
  { value: "alternatives", label: "Alternatives" },
  { value: "tech-article", label: "Tech article" },
  { value: "listicle", label: "Listicle" },
  { value: "service", label: "Service page" },
  { value: "local", label: "Local landing" },
  { value: "whitepaper", label: "Whitepaper" },
];

/** Also draft options for the current Primary — other long-form + short types. */
export function alsoDraftOptionsFor(
  primary: PrimaryDraftType,
): ReadonlyArray<{ value: ContentType; label: string }> {
  const otherLong = OTHER_LONG_FORM.filter((o) => o.value !== primary);
  return [...otherLong, ...ALSO_DRAFT_SHORT_TYPES];
}

export function labelForContentType(value: string): string {
  const hit = CONTENT_TYPES.find((o) => o.value === value);
  return hit?.label ?? value;
}

/** CMS upsert types — long-form web pages (§5.6). Whitepaper is export-only. */
export const CMS_PUBLISH_TYPES = [
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
] as const;

export function isCmsPublishType(value: string): boolean {
  return (CMS_PUBLISH_TYPES as readonly string[]).includes(value.trim().toLowerCase());
}

export function isExportOnlyType(value: string): boolean {
  const t = value.trim().toLowerCase();
  return t === "email" || t === "social" || t === "ads" || t === "image-prompt" || t === "whitepaper" || t === "linkedin-document";
}

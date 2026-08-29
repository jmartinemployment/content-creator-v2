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
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "image-prompt", label: "Image prompt" },
  { value: "ads", label: "Ads" },
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number]["value"];

/** Long-form Primary draft options — default Pillar. Tool = keyword overview + partner pages. */
export const PRIMARY_DRAFT_TYPES = [
  { value: "pillar", label: "Pillar" },
  { value: "blog", label: "Blog" },
  { value: "tool", label: "Tool pages" },
] as const satisfies ReadonlyArray<{ value: ContentType; label: string }>;

export type PrimaryDraftType = (typeof PRIMARY_DRAFT_TYPES)[number]["value"];

/** Short-form Also draft types (excludes tool — tool is primary long-form or Also with pillar/blog). */
export const ALSO_DRAFT_SHORT_TYPES = [
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "ads", label: "Ads" },
] as const satisfies ReadonlyArray<{ value: ContentType; label: string }>;

/** Also draft options for the current Primary — other long-form + short types. */
export function alsoDraftOptionsFor(
  primary: PrimaryDraftType,
): ReadonlyArray<{ value: ContentType; label: string }> {
  if (primary === "tool") {
    return [
      { value: "pillar", label: "Pillar" },
      { value: "blog", label: "Blog" },
      ...ALSO_DRAFT_SHORT_TYPES,
    ];
  }

  const otherLong: { value: ContentType; label: string } =
    primary === "pillar"
      ? { value: "blog", label: "Blog" }
      : { value: "pillar", label: "Pillar" };
  return [otherLong, { value: "tool", label: "Tool page" }, ...ALSO_DRAFT_SHORT_TYPES];
}

export function labelForContentType(value: string): string {
  const hit = CONTENT_TYPES.find((o) => o.value === value);
  return hit?.label ?? value;
}

/** CMS upsert types — pillar, blog, tool only (§5.6). */
export const CMS_PUBLISH_TYPES = ["pillar", "blog", "tool"] as const;

export function isCmsPublishType(value: string): boolean {
  return (CMS_PUBLISH_TYPES as readonly string[]).includes(value.trim().toLowerCase());
}

export function isExportOnlyType(value: string): boolean {
  const t = value.trim().toLowerCase();
  return t === "email" || t === "social" || t === "ads" || t === "image-prompt";
}

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

/** Long-form Primary draft options — default Pillar. */
export const PRIMARY_DRAFT_TYPES = [
  { value: "pillar", label: "Pillar" },
  { value: "blog", label: "Blog" },
] as const satisfies ReadonlyArray<{ value: ContentType; label: string }>;

export type PrimaryDraftType = (typeof PRIMARY_DRAFT_TYPES)[number]["value"];

/** Optional extra WRITE jobs alongside the Primary draft. */
export const ALSO_DRAFT_TYPES = [
  { value: "tool", label: "Tool page" },
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "image-prompt", label: "Image prompt" },
  { value: "ads", label: "Ads" },
] as const satisfies ReadonlyArray<{ value: ContentType; label: string }>;

export type AlsoDraftType = (typeof ALSO_DRAFT_TYPES)[number]["value"];

export function labelForContentType(value: string): string {
  const hit = CONTENT_TYPES.find((o) => o.value === value);
  return hit?.label ?? value;
}

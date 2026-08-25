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

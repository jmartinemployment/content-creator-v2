/**
 * The content types a create can start as.
 *
 * Derived from two real sources rather than invented: the sixteen non-email types the Create form
 * offered, plus v1's four distinct email types from GeneratedContentType (EmailColdOutreach,
 * EmailNewsletter, EmailStoryNurture, EmailTransactional), which had been collapsed into a single
 * "email" entry. Sixteen plus four is the twenty.
 *
 * `value` is what goes to the API as startingContentType.
 */
export const CONTENT_TYPES = [
  { value: "pillar", label: "Pillar" },
  { value: "blog", label: "Blog" },
  { value: "tech-article", label: "Tech article" },
  { value: "tool", label: "Tool page" },
  { value: "comparison", label: "Comparison" },
  { value: "alternatives", label: "Alternatives" },
  { value: "case-study", label: "Case study" },
  { value: "guide", label: "Guide / How-to" },
  { value: "listicle", label: "Listicle" },
  { value: "service", label: "Service page" },
  { value: "local", label: "Local landing" },
  { value: "whitepaper", label: "Whitepaper" },
  { value: "email-cold-outreach", label: "Email — cold outreach" },
  { value: "email-newsletter", label: "Email — newsletter" },
  { value: "email-story-nurture", label: "Email — story nurture" },
  { value: "email-transactional", label: "Email — transactional" },
  { value: "social", label: "Social" },
  { value: "image-prompt", label: "Image prompt" },
  { value: "ads", label: "Ads" },
  { value: "linkedin-document", label: "PDF / LinkedIn document" },
] as const;

export type ContentTypeValue = (typeof CONTENT_TYPES)[number]["value"];

export const DEFAULT_CONTENT_TYPE: ContentTypeValue = "pillar";

export function contentTypeLabel(value: string | null | undefined): string {
  if (!value) return "no type yet";
  return CONTENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

/**
 * Content types disabled 2026-09-22 (Jeff) pending a written, approved resolve plan -- see
 * plans/content-type-dispatch-and-richness.md. Mirrors GccGenerateService.DisabledContentTypes
 * (GeekBackend), the real, enforced gate; this list is what makes that same state visible before
 * Generate is even clicked. Revised same day: Pillar and Blog re-enabled -- they have real,
 * independent dedicated generators and only break in one specific combination (multi-select
 * alongside a sibling long-form type), tracked as its own bug fix, not a reason to disable a type
 * that mostly works. Tool remains excluded outright -- it meets the bar these others don't.
 * Everything still here has no real, correctly-routed implementation: the generic-fallback
 * long-form types, LinkedInDocument (zero content-type-specific treatment), and
 * EmailNewsletter/EmailStoryNurture/EmailTransactional (all three currently produce
 * cold-outreach-shaped content regardless of which is picked -- the wrong thing, not a thin
 * version of the right thing). Email-cold-outreach, Social, Ads, and Image prompt are not
 * disabled -- cold outreach is the one email variant genuinely implemented, and Social/Ads/Image
 * prompt were never flagged as broken.
 * Normalized the same way as the backend: strip non-letters, lowercase, so "tech-article" and
 * "techArticle", or "linkedin-document" and "PDF / LinkedIn document", each match one entry.
 */
const DISABLED_CONTENT_TYPES = new Set([
  "techarticle",
  "comparison",
  "alternatives",
  "casestudy",
  "guide",
  "listicle",
  "service",
  "local",
  "whitepaper",
  "linkedindocument",
  "emailnewsletter",
  "emailstorynurture",
  "emailtransactional",
]);

export function isContentTypeDisabled(value: string): boolean {
  const normalized = value.replace(/[^a-zA-Z]/g, "").toLowerCase();
  return DISABLED_CONTENT_TYPES.has(normalized);
}

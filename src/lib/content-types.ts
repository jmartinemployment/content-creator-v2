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

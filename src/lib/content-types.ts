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

export function contentTypeLabel(value: string | null | undefined): string {
  if (!value) return "no type yet";
  return CONTENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

/**
 * Content types disabled 2026-09-22 (Jeff) pending a written, approved resolve plan. One has had
 * one: the PDF / LinkedIn document, enabled 2026-10-13 by GeekBackend plans/enable-pdf.md, which gave
 * it a writer, checks and a PDF of its own. None for the other twelve: the scoping note of 2026-09-22
 * was retired by plans/fix-overview.md (Appendix A) and is in git history only. Mirrors
 * GccGenerateService.DisabledContentTypes (GeekBackend), the real, enforced gate; this list is what
 * makes that same state visible before Generate is even clicked. Change the two together, GeekBackend
 * first: the other order offers a type the server refuses.
 *
 * Everything still here has no real, correctly-routed implementation: the generic-fallback
 * long-form types, and EmailNewsletter/EmailStoryNurture/EmailTransactional (all three currently
 * produce cold-outreach-shaped content regardless of which is picked -- the wrong thing, not a thin
 * version of the right thing).
 *
 * Email-cold-outreach, Social and Ads are short pieces: each is written from a page, never from the
 * brief alone (src/lib/content-creator/repurpose.ts). Since 2026-10-13 they are on Generate's list
 * again and Generate writes each from the project's Pillar; Repurpose, on an approved page, writes
 * one again from that page. From 2026-10-12 to 2026-10-13 Generate's picker left them out.
 * Normalized the same way as the backend: strip non-letters, lowercase, so "tech-article" and
 * "techArticle" match one entry.
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
  "emailnewsletter",
  "emailstorynurture",
  "emailtransactional",
]);

export function isContentTypeDisabled(value: string): boolean {
  const normalized = value.replace(/[^a-zA-Z]/g, "").toLowerCase();
  return DISABLED_CONTENT_TYPES.has(normalized);
}

/**
 * Whether a type is the PDF / LinkedIn document, however it is spelled: a deck of slides and the
 * LinkedIn post that carries it. It is not a page of the site, so it is drawn as slides, downloaded
 * as a PDF, and not scored for search.
 */
export function isDeckType(value: string | null | undefined): boolean {
  return (value ?? "").replace(/[^a-zA-Z]/g, "").toLowerCase() === "linkedindocument";
}

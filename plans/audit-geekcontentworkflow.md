# GeekContentWorkflow — Code Audit

**Date:** 2026-10-09

## Scope and method

A live, deployed, adjacent app (69 tracked `.ts`/`.tsx` files, ~11,500 lines) — "Geek Content Workflow," a separate content-marketing-workflow product built on GeekOAuth + GeekAPI's Content Writer v2 surface, confirmed live by its registered OAuth client (`geek-content-workflow`, with production and Vercel-preview redirect URIs) found while auditing GeekOAuth. Not part of the five-repo Content Creator v2 pipeline this audit otherwise covers in depth, so it received a proportionate rather than exhaustive pass: whole-repo greps for every hard rule, plus full reads of the files those greps or the file list flagged as worth checking (`content-document.ts`, several of the larger `/app/app/*` feature pages, `ContentDocumentPreview.tsx`).

## What this is

A marketing site plus an authenticated `/app` shell covering strategy, research, drafting, scheduling/publishing (via a "CWV2 HTML commit path"), and performance tracking. Pages cover analytics, assets, brand-core, calendar, drafting, insights, media, pain-points, publications, reconciliation, repurpose, research, reviews, strategy-briefs, strategy-map, and video-seo — a broader feature surface than content-creator-v2's single workflow.

## Findings

**Positive — no second HTML renderer.** `ContentDocumentPreview.tsx` (194 lines) renders the shared `ContentDocument` wire shape (`lede`/`sections`/`paragraphs`/`runs`) as JSX directly — confirmed by grep, zero `dangerouslySetInnerHTML` calls in the file. This is a cleaner pattern than content-creator-v2's own `gcc-api.ts`, which builds HTML by string concatenation for the same purpose (flagged as a High finding in that report) — worth content-creator-v2 adopting this repo's approach instead of the reverse.

**Positive — `content-document.ts`'s `flattenDocumentText` is plain-text extraction, not a markup producer.** It walks the same document shape to a copy-paste-friendly string (bullets as `• text`, blank-line-separated paragraphs) for clipboard/display use, never constructing tags. Not a violation of the single-renderer rule.

**No stub/placeholder logic found** in the three larger feature pages checked in full for this pattern (`reconciliation`, `pain-points`, `video-seo`) — the only `placeholder` hits are HTML input placeholder text (form field hints), not logic stand-ins. These read as genuinely implemented, not scaffolded-and-abandoned screens, contrary to what their number and variety might suggest at a glance.

No Markdown, Postgres, or `localStorage`/`sessionStorage` references found anywhere in the tracked source tree by grep.

## Not checked in this pass

The full bodies of `src/lib/geek-api.ts` (1,259 lines, the GeekAPI client) and `src/lib/calendar-channel.ts`; the remaining ~18 `/app/app/*` feature pages beyond the five sampled; and whether this repo's GeekAPI contract (Content Writer v2 routes) has drifted from what GeekAPI's `ContentWriterV3`/`ContentWriterV4` controllers currently serve — worth checking given the GeekAPI report's finding that `ContentWriterV3`'s `NotificationService.cs` carries unimplemented TODOs, which could mean a feature this app's UI offers (e.g., a notification or analytics feature) has no working backend.

## Recommended action

1. No urgent action from what was checked — this repo's handling of the shared document model is actually a better example than content-creator-v2's own.
2. A deeper pass should check `geek-api.ts`'s contract against GeekAPI's actual `ContentWriterV3`/`V4` controllers for drift, and specifically whether any UI feature here depends on the `NotificationService.cs` TODOs flagged in the GeekAPI report (SendGrid email, GA4 integration, WordPress sync) — if so, those UI features may be non-functional today the same way Geek-Crawler v1's "Start a crawl" button is.

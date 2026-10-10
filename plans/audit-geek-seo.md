# Geek-SEO — Code Audit

**Date:** 2026-10-09

## Scope and method

Large repo (~189k tracked lines across `GeekSeoBackend`, `GeekSeo.Application`, `GeekSeo.Persistence`, plus a nested sub-product `content-writer-v3/`). Given its size and its disconnect from the live pipeline (see below), this got a targeted rather than line-by-line pass: whole-repo greps for every hard rule (Markdown, Postgres-in-crawl, TODO/FIXME, stubs), every hit read in context, plus a check of whether GeekBackend has any live dependency on this repo at all. Not read in full: the bulk of `GeekSeoBackend`'s and `GeekSeo.Application`'s business logic outside the files the greps surfaced.

## What this is

Two things live in one repo:

1. **Geek-SEO proper** (`GeekSeoBackend`, `GeekSeo.Application`, `GeekSeo.Persistence`) — an SEO site-analysis service (site crawling/scoring, topical maps, content briefs, content scoring/refresh) with its own Postgres-backed persistence layer. README describes it as containing "retired SA2 tables" and referencing other "retired standalone services." Last commit 2026-08-26.
2. **`content-writer-v3/`** — a separate, nested content-generation sub-app (~4,378 lines, its own `ContentWriterV3.Api`/`.Infrastructure` projects, described by its own README as "a self-improving content generation system" with a Research → Strategy → Writing → Review → Publish → Measure → Learn loop). Last commit in this subtree 2026-08-26 as well.

## Is any of this live?

**No confirmed live coupling to GeekBackend.** `grep -rl "GeekSeo\." --include="*.cs"` across `GeekAPI`/`GeekApplication`/`GeekRepository` returns exactly one hit: `GeekAPI/Services/Workflow/Services/TopicClusteringService.cs`, and its only "GeekSeo" reference is a provenance comment — `// Extracted from Geek-SEO/GeekSeo.Application/Services/TopicClusteringService.cs — only the` — meaning the logic was copied out, not that GeekAPI calls into this repo. No `.csproj` anywhere in GeekBackend references a Geek-SEO project. This repo is not wired into the five-repo Content Creator v2 pipeline.

**`content-writer-v3` has a registered OAuth client but no deployment artifact.** GeekOAuth's `OidcPublicClientSeeds.cs` (read in full while auditing that repo) registers a `content-writer-v3` client, meaning at some point this sub-app was intended to authenticate against the shared identity provider. But `content-writer-v3/` has no `Dockerfile` anywhere in its tree (checked by `find`), unlike Geek-SEO proper, which has both `Dockerfile` and `Dockerfile.geekseo`. This reads as work that reached the "needs its own auth client" stage of setup but was not taken to deployment — the same shape as the "GCC V2 never shipped" pattern already on record for a different repo in this system.

## Findings

**High, but scoped to a repo with no confirmed live path — `content-writer-v3`'s core generation step is a hardcoded stub, not a bug in an otherwise-working feature.** `ExtractInsightsHandler.cs`'s `InsightExtractor.ExtractAsync` has a `// TODO: Call LLM with prompt: ...` comment laying out the real prompt, followed by `// For now, return mock insights` and a hand-written `List<ResearchInsight>` with fixed placeholder content (a plumbing-services example — "Emergency Response Window is Hours, Not Days," "$500 inspection prevents $5000+ in water damage"). This is exactly the "No Auto-Repair/Defaults: never substitute mocked data... if an operation fails" violation the project's hard rules name — except here there's no failure being masked, the real call was never implemented. Severity is High *as code*, but the deployment check above means there's no evidence an operator or caller ever received this fabricated content as if it were real, which is why this isn't reported as a live incident.

**Medium — two `Guid.Empty` TODOs in `content-writer-v3` would silently misattribute actions if this were live.** `V3ResearchController.cs` lines 107 and 123 (`ApproveProposal`/`DismissProposal`) both do `var userId = Guid.Empty; // TODO: Get from user context` before persisting the approval/dismissal. If this endpoint were ever exposed, every proposal approval or dismissal would be recorded as done by a null user, with no way to audit who actually acted — same "no live caller confirmed" caveat as above.

**Medium, and this one is a genuine Markdown-corpus producer, not a benign prompt instruction.** Of the 10 files flagging "markdown" in Geek-SEO proper, 9 are benign LLM-prompt instructions telling a model *not* to emit Markdown (`"Return valid JSON only — no markdown fences"`, `"Return improved HTML only... No markdown fences"` in `TopicalMapService.cs`, `ContentGuardService.cs`, `ContentScoringService.cs`) — compliant with this project's ban, not a violation of it. The exception is `PageContextBuilder.cs`: `FromSections` walks an extracted heading tree and writes it into a `StringBuilder` as literal Markdown syntax, assigning the result to `PageContext.MainContentMarkdown`. Its own doc comment says this is "Serializes the extracted heading tree to flat PageContext (headings + Markdown)," and `SiteAnalyzerController.cs:389` documents that `PageContext` (including this `markdown` field) is returned "for Content Creator" — naming this project's own frontend as the intended consumer. Scoped precisely: this is **Geek-SEO producing a Markdown field for a Content Creator integration that has no confirmed live caller today** (no GeekBackend code path calls into Geek-SEO, per the check above) — so it is a corpus-format violation in a dormant integration, not an active one. If this integration is ever wired up, this field would need to stop being Markdown before it reached the live system.

No Postgres-in-crawling issue — Geek-SEO's Postgres usage is this repo's own site-analysis data, not the crawl path this project's hard rule targets (that rule is about `Geek-Crawler-v2`/`GeekRepository`'s crawl store, confirmed Mongo-only elsewhere in this audit). No RAG-generate violation — this repo has no relationship to Geek-Crawler-Rag.

## Project-rule compliance

| Rule | Status |
|---|---|
| RAG Library-only, never generates | N/A — no relationship to RAG |
| Markdown forbidden as corpus format | **Violated in one place** (`PageContextBuilder.cs`'s `MainContentMarkdown`), but in a dormant Content-Creator integration with no confirmed live caller |
| Postgres never in crawling | Not applicable — this repo's Postgres use is site-analysis data, not the crawl store |
| Silent-failure / no stubs / no mocked data | **Violated** in `content-writer-v3`'s `InsightExtractor` (hardcoded mock insights in place of the real LLM call) and the two `Guid.Empty` TODOs, both in a sub-app with no deployment artifact |

## Recommended action

1. If `content-writer-v3` is still an active initiative, finish `InsightExtractor.ExtractAsync`'s real LLM call before any deployment, and resolve the two `Guid.Empty` TODOs by threading real user context through `V3ResearchController`'s approve/dismiss actions. If it's abandoned, say so explicitly somewhere discoverable (a README note, like `GeekContentCreator`'s retirement note) rather than leaving a half-built generation system with a live-looking OAuth client registration and no code pointing at why it stopped.
2. Decide whether `PageContext.MainContentMarkdown` is ever going to be wired into content-creator-v2. If yes, it needs to carry `blocks`/`contentHtml` instead before that integration is built, per this project's corpus-format rule. If no, consider whether the field and its "for Content Creator" doc comment should be removed so a future reader doesn't take it as a live contract the way `Geek-Crawler (v1)`'s stale `architecture.md` was nearly taken at face value elsewhere in this audit.
3. No urgent action on Geek-SEO proper's core SEO-analysis logic from what was checked — the markdown-ban prompt instructions, Postgres usage, and absence of any GeekBackend dependency are all consistent with a self-contained, currently-dormant service.

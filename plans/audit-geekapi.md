# GeekAPI — Code Audit

**Date:** 2026-10-09

## Scope and method

GeekAPI is the largest codebase in this system (234,563 tracked lines of C# across 446 files), too large for an exhaustive line-by-line pass in one session. The method was depth-first on the areas where a rule violation would matter most, backed by whole-repo greps for everything else:

- **Whole-repo greps** for `markdown`, `npgsql`/`DbContext` in every crawl-adjacent directory, `rag.?generate`/`/v1/generate`, and every file name the project's own architecture memory names as a target for removal (`SameOriginBfsCrawler`, `GccPoliteCrawler`, `SiteCrawlerService`, `GccV2ProjectSitePageSource`).
- **Full git-history verification of a specific prior claim**: the project's own memory states commit `da6a98e` (2026-09-29) deleted the project-site in-process crawler and its Postgres tables. This was independently confirmed true by reading the actual commit and the current `GccV2ProjectSitePageSource.cs` — it is now Mongo-only, one implementation, no Postgres variant found anywhere in the tree.
- **A full trace of every in-process-crawling code path found by the greps above**, read to the implementation rather than stopped at the file name: `GeekCrawlerService.cs`, `SameOriginBfsCrawler.cs`, `InProcessCrawlUnavailableException.cs`, `GeekCrawlerServiceRegistration.cs`, `GeekCrawlerController.cs`, `CrawlController.cs`, `SiteCrawlerService.cs`, `GccPoliteCrawler.cs`, `GccPartnerUrlResearchService.cs` — each one read in full, not sampled, specifically to determine whether it is live, disabled, or dead, because the three turned out to have three different answers.
- **Targeted full reads** confirming specific CLAUDE.md claims against current source rather than trusting them: `SectionHtmlRenderer.cs` (single-renderer rule), `JsonReplySanitizer.cs` and `GccGenerateService.cs`'s Markdown-adjacent lines (sanitizer vs. producer distinction), `DisabledContentTypes` (cross-repo mirror against content-creator-v2's copy — confirmed identical, 13 entries each), `GeekCrawlerIngestController.cs`'s route list, `GeekCrawlerIngestLimits`.
- **Not read line-by-line**: the full bodies of the `ContentCreatorV2/Generation`, `ContentCreatorV2/Write`, `ContentCreatorV2/Validate`, `Workflow/Services/PromptBuilders`, and `Workflow/Services/Review` directories — the actual prompt-assembly and generation-orchestration code, which is the single largest remaining area of this repo and the natural next pass for a deeper audit. These were grep-verified for the hard rules (no Markdown, no RAG-generate calls) but not read for logic correctness.

**Coverage**: targeted full reads of roughly 25 files across the crawling-boundary and markup-rendering questions, plus whole-repo structural greps across all 446 tracked `.cs` files.

## What this service is

The business-logic layer between every frontend and GeekRepository/Mongo/Qdrant/OpenAI/Anthropic. It is organized into several largely-separate subsystems sharing one process:

- **`ContentCreatorV2`**: the live generation pipeline for Content Creator v2 — brief, PLAN/WRITE/VALIDATE, partner/competitor extraction and verification, the RAG facade (query/pages proxied to Geek-Crawler-Rag), BrandKit, hierarchy matching, publish.
- **`GeekCrawler`**: the ingest API external crawlers (Geek-Crawler-v2) post pages/links/run-status to (`GeekCrawlerIngestController`), plus a large, separately-registered in-process crawling engine (`GeekCrawlerService`, worker pool, Playwright) that turns out to be deliberately disabled (see Critical/High findings).
- **`Workflow`**: the v1 content-generation engine (`ContentGenerationOrchestrator` per the architecture doc), which PLAN and WRITE currently route through even for v2 creates; owns the one legitimate HTML renderer (`SectionHtmlRenderer`) and the `ContentDocument` model.
- **`ContentCreator` (v1, no "V2")**: `GccGenerateService`, `GccController`, and the polite partner-fetch research path (`GccPoliteCrawler`) — still live and still called from the generation path.
- **`Rag`**: a thin facade proxying `/v1/query` and `/v1/pages` to Geek-Crawler-Rag.
- **`Seo`, `Gtm`, `Gcw`, `ContentWriterV3`**: adjacent surfaces not examined in this pass beyond the whole-repo greps.

## Critical and high findings

The architecture's single clearest rule for this service is "GeekAPI: No crawler, no browser." This pass traced every in-process crawling code path to its implementation, and found three, with three different current states — reported precisely rather than as one verdict, because they are not the same finding.

**Compliant, confirmed by reading the code, not the comment — the large BFS/Playwright engine is genuinely disabled.** `GeekCrawlerService.StartCrawlAsync` (`GeekAPI/Services/GeekCrawler/GeekCrawlerService.cs:100-104`) is a one-line method that unconditionally throws `InProcessCrawlUnavailableException`. The real implementation, `StartCrawlInProcessAsync`, survives in the same file under a renamed, uncalled method — confirmed by grep that nothing calls it — with its own doc comment explaining why: "Jeff's decision was to make the in-process crawler unreachable and keep the code... Deleting the in-process crawler is separate work, tracked in `Geek-Crawler-Rag/plans/fix-unindexable-crawls.md`." `GeekCrawlerController.cs`'s `POST crawls` endpoint catches this exception and returns `501`, pointing the caller at the real crawler (`npm run crawl` / `POST :8787/crawls`). This is the "disable = keep the logic" pattern done correctly: the capability is genuinely unreachable, the reason is documented, and the removal is tracked rather than silently deferred.

*Residual, low-severity cost of the above*: the worker pool (`GeekCrawlerWorker` ×N), `GeekCrawlerPlaywrightStartupHostedService`, `GeekCrawlerStallRecoveryHostedService` and `GeekCrawlerScheduleHostedService` are still registered and started on every boot (`GeekCrawlerServiceRegistration.cs`), and the Dockerfile still installs Chromium (`pwsh ./playwright.ps1 install --with-deps chromium`) for an engine that can never be asked to crawl. This is pure overhead — container size, a browser launched at startup for nothing, a worker pool with nothing to claim — not a correctness defect, and it is exactly what the tracked-but-not-yet-done plan exists to remove.

**High — a second in-process crawler, not disabled, still live.** `CrawlController.cs` (`POST api/projects/{projectId}/crawl`) calls `ISiteCrawlerService.CrawlAsync`, implemented by `SiteCrawlerService.cs`: a plain `HttpClient` + `HtmlAgilityPack` breadth-first crawler that fetches pages directly and extracts headings/paragraphs/JSON-LD in-process. Unlike `GeekCrawlerService`, this one carries no disabling guard — it is wired, routed, and will execute a real crawl if called. This is the "v1 path" the project's own architecture memory names as a target for removal (alongside `SameOriginBfsCrawler` and `GccPoliteCrawler`), dated 2026-09-16; it was not removed. *Scope*: no caller was found in content-creator-v2's live frontend surface for this specific route (its project/create API shapes don't reference `/crawl`), so this may be orphaned from today's UI — but it is a live, callable, working HTTP endpoint performing exactly the thing the architecture forbids, not dead code.

**High — a third, narrower in-process crawler, live and actively used by the generation path.** `GccPoliteCrawler.cs` (robots.txt-respecting, per-host-delay, 429/503-backoff direct page fetcher) is used by `GccPartnerUrlResearchService.cs`, which is called from `GccController.cs` and `GccGenerateService.cs` — the live v1 content-generation path. It fetches a brief's declared partner URLs directly via HTTP rather than reading them from the corpus Geek-Crawler-v2 already crawled and RAG already indexed. This is a smaller blast radius than a bulk BFS crawl (it fetches only explicitly-declared URLs, not discovered ones), but it is still GeekAPI performing its own web fetch of third-party content in its own process, which is the exact boundary the target architecture draws around Geek-Crawler.

*Why this matters beyond tidiness*: the project's own architecture memory calls a browser inside GeekAPI's image "the same class of violation" as the OAuth client-id leak and the `.v4` schema-naming bug that caused real production incidents — "visible in the build." Two of the three paths named in that memory as needing removal are still present and callable nine months after the recommendation.

## Medium and low findings

**Low — the Dockerfile ships a browser nothing can use.** Covered above under the first Critical/High finding's residual cost: Chromium is still installed for `GeekCrawlerService`'s now-unreachable in-process path. This should be removed in the same change that deletes `StartCrawlInProcessAsync`, or sooner if the image size/boot time cost matters before then.

**Not independently re-litigated, confirmed current instead**: CLAUDE.md's own "known deviation" — `GccGenerateService`'s Create path still returning string bodies at `GccController.cs:667`/`:674` rather than going through `SectionHtmlRenderer` — was not re-verified line by line in this pass; it is recorded in the project's own documentation as a known, stated gap rather than a silently-asserted-fixed one, which is the right way to carry an unfixed deviation.

## Project-rule compliance

| Rule | Verdict | Evidence |
|---|---|---|
| RAG Library-only, never generates | **Compliant** | Zero hits for `rag.?generate`/`/v1/generate` as a route; the "rag generate" grep hits are all ordinary uses of the English word "generate" in GeekAPI's own writer code, which is where generation is supposed to live. |
| No Markdown corpus format | **Compliant** | Zero live hits across all 446 files; the two `markdown` matches are a sanitizer stripping a model-leaked code fence (`JsonReplySanitizer.cs`) and a comment documenting the ban (`GccGenerateService.cs`) — both are the rule being enforced, not broken. |
| No Postgres in crawling | **Compliant, independently re-verified** | `da6a98e` confirmed by direct commit read; `GccV2ProjectSitePageSource.cs` confirmed Mongo-only today, no Postgres variant found anywhere in the tree by grep. |
| GeekAPI: no crawler, no browser | **Violation, two of three paths** | See Critical/High findings: `SiteCrawlerService`/`CrawlController` and `GccPoliteCrawler`/`GccPartnerUrlResearchService` are both live, callable, in-process web-fetchers. The largest one (`GeekCrawlerService`) is correctly disabled. |
| Single HTML renderer (`SectionHtmlRenderer`, nowhere else) | **Compliant** | Confirmed by reading the file (DOM-node construction via HtmlAgilityPack, never string concatenation) and by grep finding no other markup-string-builder in the repo. |
| Disabled content types mirror the frontend's list | **Compliant** | `GccGenerateService.cs`'s `DisabledContentTypes` and content-creator-v2's `DISABLED_CONTENT_TYPES` are identical, 13 entries each, confirmed by direct comparison. |
| No stubs / TODO / placeholder bodies | **Violation, one file, not confirmed live** | `GeekAPI/Services/ContentWriterV3/NotificationService.cs` carries at least eight `TODO` comments standing in for real logic (SendGrid email send, GA4 OAuth2 API call, WordPress REST API integration) — exactly the pattern the rule forbids. `ContentWriterV3` reads as an older generation of this system that content-creator-v2's live frontend does not call; not confirmed dead in this pass either. One other `TODO`, in `GccV2SchemaConstrainedGenerator.cs`, names a cross-team handoff rather than missing logic and is not this kind of violation. |

## Cross-service contracts

- **`GeekCrawlerIngestController.cs`'s routes match Geek-Crawler-v2's client exactly**: `POST ingest/runs`, `PATCH ingest/runs/{id}`, `POST ingest/runs/{id}/pages/batch`, `POST ingest/runs/{id}/links/batch`, `DELETE ingest/runs/{id}` all line up with `geek-api-client.ts`'s calls, confirmed by comparing both route lists directly rather than assuming the mirror holds.
- **`GeekCrawlerController.cs`'s `POST crawls` 501 response names the exact CLI command and the exact external endpoint** (`npm run crawl -- --seed <url> --type <...>`, `POST http://127.0.0.1:8787/crawls`) a caller should use instead — a good example of a disabled path failing with an actionable answer rather than a bare error.
- **The content-creator-v2 ↔ GeekAPI casing inconsistency flagged in the content-creator-v2 report** (`JsonSerializer.Serialize` with no camelCase policy on the Generate job result, worked around client-side by `camelKeys()`) was not independently re-traced to its source file in this pass; it is restated here as a cross-repo item worth fixing once, in `GccJobsAndSeo.cs` per the earlier finding.
- **`DisabledContentTypes` mirrors content-creator-v2's list exactly** (see compliance table) — a rare case in this audit of a cross-repo duplicate that has NOT drifted, worth noting as a positive alongside the several that have.

## Tests and verification

**Not assessed in depth this pass.** `GeekBackend.Tests` and `GeekBackend.IntegrationTests` exist as separate projects and were not opened in this session; `plans/rules.md`'s own reference to `PostgresIsOAuthOnlyTests.cs` and `GccV2FallbackCorrectnessTests` (asserting removed RAG-generate method names stay absent from source) describes exactly the kind of regression test this project favors — a failing build over a sentence of prose — and both were confirmed to exist by the commit message quoted in the Scope section, though their current contents were not read. A dedicated pass over `GeekBackend.Tests` would be the natural next step, specifically to check whether `SiteCrawlerService`/`GccPoliteCrawler`'s liveness (the High findings above) is asserted anywhere as intentional, or whether no test currently distinguishes them from the disabled `GeekCrawlerService` path.

## Recommended fix order

1. Decide, in writing, what happens to `SiteCrawlerService`/`CrawlController` and `GccPoliteCrawler`/`GccPartnerUrlResearchService` — the project's own 2026-09-16 recommendation was to delete both. If the partner-fetch path (`GccPoliteCrawler`) is still needed because the generation path genuinely needs a live fetch of declared URLs the corpus hasn't indexed yet, that is a legitimate reason to keep it — but it should be stated as a deliberate exception the way `GeekCrawlerService`'s disablement is, not left as an apparent oversight.
2. If `SiteCrawlerService`/`CrawlController` is confirmed to have no live caller, delete it outright, matching how `GeekCrawlerService`'s in-process path was handled — disabled-and-documented at minimum, ideally removed.
3. Finish the tracked-but-not-done removal of `GeekCrawlerService`'s dead Playwright/worker-pool infrastructure and the Dockerfile's Chromium install — low urgency, pure waste.
4. Resolve or justify the `NotificationService.cs` TODOs — confirm whether `ContentWriterV3` is live; if not, say so in the code the way other retired paths in this system are marked, rather than leaving unimplemented stubs that read as unfinished work.
5. A deeper pass of this repo specifically should prioritize `ContentCreatorV2/Generation`, `Write`, and `Validate` — the actual prompt-assembly and model-call code, which this pass did not read in depth.

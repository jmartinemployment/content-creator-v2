# Geek-Crawler-v2 — Code Audit

**Date:** 2026-10-09

## Scope and method

Read every tracked production source file: all of `src/crawl/*.ts` and `src/storage/*.ts` (non-test), `src/api/server.ts`, `src/cli.ts`, `src/bot/identity.ts`, the full `web/` Next.js operator UI (lib, services, API routes, middleware, every component and page), the standalone `my-crawler/` sub-package, `deploy/Dockerfile`, and the repo's own prior internal audit (`docs/audit-00-index.md`, `docs/audit-geek-crawler-v2.md`, dated 2026-09-28 with a 2026-10-04 status update) — each of that audit's five findings (F1–F5) was independently re-verified against the current code rather than taken on trust. `.cursor/rules/*.mdc` (the four always-applied project rules: no polling, one attempt per required operation, every error terminal, no retries/fallbacks) were read and checked against the implementation. Test files (`*.test.ts`, `tests/integration/*`, `web/e2e/*`) were not read line-by-line but their existence and coverage areas were confirmed by listing, and `tests/KNOWN_GAPS.md` (the project's own deferred-defect log) was read in full and cross-checked.

Three whole-repo case-insensitive greps closed the audit: `markdown` (zero hits in any `.ts`/`.tsx` file), `postgres|npgsql` (zero hits — the one `pg` match is an unrelated pagination query-param key), and `TODO|FIXME` (zero hits).

**Coverage: all production `.ts`/`.tsx` source in `src/`, `web/src/`, and `my-crawler/src/` read in full (169 tracked files total in the repo; the files not read were test files and the two already-read `.cursor/rules` / `docs` sets).**

## What this service is

A TypeScript/Node crawler (CheerioCrawler only, via `crawlee`) that fetches one seed URL per run, extracts deterministic typed `blocks` plus clean semantic `contentHtml` (`src/crawl/extract-content.ts`), and posts the corpus to GeekAPI over a REST ingest API (`src/storage/geek-api-client.ts`). It is the sole crawler for every type — `partner`, `competitors`, `local`, `project-site` — per the target architecture ("Geek-Crawler owns ALL crawling").

- **Entry points**: `src/cli.ts` (`crawl`, `serve`, `failures` commands) and `src/api/server.ts` (a loopback-only HTTP control surface on `:8787` for starting/cancelling/deleting runs locally).
- **Crawl pipeline** (`src/crawl/`): robots gate (fail-closed) → sitemap load (seeds, never bounds) → CheerioCrawler with `maxRequestRetries: 0` → per-page viability check, reject classification, section-quota/editorial-share admission, link-trap filtering for off-sitemap URLs → deterministic content extraction into typed blocks.
- **Persistence** (`src/storage/`): `persist.ts` serializes every GeekAPI write through one coordinator that latches the first failure; `geek-api-client.ts` makes exactly one attempt per operation with no retry, distinguishing "GeekAPI said no" from "GeekAPI was unreachable" by an allowlist on the response shape (never by matching error text) — a distinction introduced after three finished crawls were wrongly purged when a platform proxy's 404 was mistaken for GeekAPI's own.
- **Local state**: a run's `run.json` (status, counters, reject samples) and a diagnostics-only extract cache (`extract-cache.ts`) and failure archive (`failure-archive.ts`); explicitly never treated as crawl authority — GeekAPI is.
- **Orphan handling**: on `serve` startup, runs marked `running` with no live writer and stale beyond 15 minutes are deleted (pages, links, vectors and local scratch) after confirming with GeekAPI that the run isn't actually complete.
- **Operator UI** (`web/`): a separate Next.js app, OAuth-authenticated via GeekOAuth, that submits crawls, shows live status over a GeekAPI SignalR hub, and renders three reports (indexed-run status joined from GeekAPI, purged-run post-mortems, per-run seed/URL detail).

## Critical and high findings

None found at critical severity. This repo's own prior internal audit (2026-09-28, status-updated 2026-10-04) found five findings in itself; I independently re-verified all five against the current code (commit `efd0085`, 2026-10-09) rather than trusting the prior write-up:

| # | Finding | Status I verified |
|---|---|---|
| F1 | Two of three crawl-profile levers (page budget, depth) were inert on any site with a sitemap, because budget was `min(sitemapCount, profile.defaultMaxPages)` | **Confirmed resolved.** `cheerio-runner.ts:244-257` now sources the budget from `profile.defaultMaxPages` alone, never sitemap-sized; the comment there names exactly this fix. |
| F2 | Orphaned `running` run stubs were never reconciled after a process death | **Confirmed resolved.** `reconcile-orphans.ts` runs at `serve` startup, asks GeekAPI before deleting, and purges a genuine orphan end to end. |
| F3 | `MAX_PAGES_PER_BATCH = 100` is unreachable — the only caller sends a single-element array | **Still open, confirmed current.** `persist.ts:624` calls `client.createPagesBatch(runId, [{ ... }])` with one page every time; `ingest-limits.ts`'s comment on the constant still does not disclose that pages are submitted singly. Low severity (the cap simply never fires), but it has sat open since 2026-09-28 across at least two recent commits. |
| F4 | `pages.jsonl` / `links.jsonl` were created and left permanently empty, and an endpoint read one of them | **Confirmed resolved.** `server.ts`'s `GET /crawls/:runId/pages` now explicitly answers `410 PAGES_NOT_LOCAL` rather than a silently-empty 200. |
| F5 | `contentReadyAt` was sent to GeekAPI but never stored on the local run record | **Confirmed resolved.** `runs.ts`'s `markComplete` now persists it locally, matching what is sent. |

**New, high — the architecture-boundary violation is still live, confirmed by direct code read.** The repo's own plan (`plans/move-crawl-reads-to-geekapi.md`, last updated 2026-10-04: "partly done") states this crawler must expose no callable HTTP surface at all, with every read and write going through GeekAPI. As of this read, `web/src/app/api/crawls/route.ts` (create), `.../cancel/route.ts`, `.../delete/route.ts`, `.../failures/route.ts`, and `web/src/services/seed-report.ts`'s `loadLocalRun` still call this crawler's own unauthenticated `:8787` API directly (`crawleeApiUrl()`), not GeekAPI. This is exactly the "no local mirror / failed stub as authority" pattern the repo's own `.cursor/rules/no-retries-no-fallbacks.mdc` forbids, and the plan names it as open work (items 4, 6, 7), not a surprise. **One real improvement since the plan was written**: the server now binds `127.0.0.1` only (`server.ts:513`), closing the specific critical sub-issue the plan flagged ("listens on 0.0.0.0 while logging 127.0.0.1") — so the surface is unauthenticated but no longer reachable off-box.

## Medium and low findings

**Medium — stale operator-facing captions describe removed behavior, in two places.**
1. `web/src/components/submit-crawl-form.tsx:93-94`: "Request budget = sitemap URL count when a map exists (no manual max)." This describes the exact `min(sitemap, profile)` logic that F1's fix explicitly removed on 2026-10-04 — the budget is now always the profile's own cap, confirmed in `cheerio-runner.ts`.
2. `web/src/components/run-live-view.tsx:258-259`: "When a sitemap exists, the crawler treats it as the map (only those URLs)." This describes the sitemap-as-allowlist behavior that was deliberately removed the same day (2026-10-04) in favor of link-trap rules — `sitemap.ts`'s own comment calls the allowlist "lifted." Both captions are read by the operator at the exact moment they're trying to understand what the crawler will do, and both now say the opposite of the truth.

**Medium — locale-filtering logic is duplicated with real drift, one copy carrying a fixed bug.**
`src/crawl/locale-path.ts` was rewritten to parse a path segment as a proper BCP-47-shaped tag (language + region), explicitly to fix a measured bug: "`en-gb` read as 'English, therefore keep' and 264 GB-market pages entered a US crawl." `web/src/lib/locale-path.ts` is a separate, hand-copied implementation (comment: "Keep in sync with src/crawl/locale-path.ts") that still uses the OLD `primaryLang = seg.split('-')[0]` logic — the exact bug the crawler fixed. It feeds only `web/src/services/sitemap-count.ts`, an operator-facing "expected page total" estimate, so it does not affect what is actually crawled — but the estimate will be wrong in the same way the crawl once was, on any site using compound locale tags like `en-gb`.

**Low — three independent sitemap-reading implementations.** `src/crawl/sitemap.ts` (authoritative), `web/src/services/sitemap-count.ts` (a near-duplicate, report-only per its own comment), and conceptually a third surface in `web/src/services/seed-report.ts` that reconciles two upstream sources. None share code. The report-only copy is lower-stakes, but it is exactly the "two lists always drift" pattern the crawler's own `section-vocabulary.ts` comment names as the recurring defect class in this codebase.

**Low — `rawBodyStore` is entirely dead code.** `src/storage/raw-body.ts` defines `put`/`putContentHtml`, and `persist.ts` constructs it and exposes it on `CrawlPersist.rawBodyStore` — but nothing anywhere in `src/` or `tests/` ever calls either method. Confirmed by grep across the whole tree. Raw HTML bodies are never actually written to this store despite the machinery existing to do so.

**Low — a near-duplicate-rejected diagnostic file is named `.md` but holds plain prose, not Markdown.** `src/storage/page-dedup.ts:417` writes a local-only, write-never-read debug copy to `near-dup-rejected/<hash>.md`, using a variable named `md` that is just the page's extracted prose text. The content is not Markdown syntax and the file is never parsed back by anything (confirmed by grep), so this is not a corpus-format violation — but it is exactly the kind of surviving, misleading name the project's own CLAUDE.md warns gets grepped and misread later.

**Low — `my-crawler/` is unused Crawlee scaffold boilerplate that contradicts the hard CheerioCrawler-only rule by name.** `my-crawler/src/main.ts` is the unmodified `npx crawlee create` template: a `PlaywrightCrawler` that fetches `crawlee.dev`. It has its own `package.json`, `Dockerfile` and `README.md`, is not imported by anything in `src/` or `web/`, and is dead weight — but `.cursor/rules/no-retries-no-fallbacks.mdc` states "CheerioCrawler only... no Playwright product path" as a hard requirement, and a stray `PlaywrightCrawler` sitting in the repo under a name that reads as "a second, smaller crawler" is a risk the project's own rules exist to prevent, even though nothing currently wires it in.

**Low — self-documented and deliberately deferred (not a new finding, independently confirmed current):** `tests/KNOWN_GAPS.md` records three counters (`enqueueSuppressedQueue`, `browserRenders`, and `pagesWithoutContent` in `run.json`) that are declared and reported but nothing increments or ever passes a real value — `persist.ts` calls `recordAcceptedPage(runId, true)` with a literal `true`. I confirmed this literal is still present. Jeff's own decision, recorded 2026-10-06, was to defer the fix and track it here rather than block the active plan; none of the three is read by the web UI.

**Low — inert Dockerfile directive.** `deploy/Dockerfile` still `EXPOSE`s `8787` for a server now confirmed to bind `127.0.0.1` only — the exposed port cannot actually be reached from outside the container given that bind, so the directive is misleading rather than a live risk, and matches the plan's still-open item to delete this HTTP surface outright.

## Project-rule compliance

| Rule | Verdict | Evidence |
|---|---|---|
| Blocks-only corpus, no Markdown | **Compliant** | `extract-content.ts` emits typed `blocks` and `contentHtml` via one deterministic DOM walk; whole-repo case-insensitive grep for `markdown` across every `.ts`/`.tsx` file returns zero hits. |
| No Postgres in crawling | **Compliant** | Zero hits for `postgres`/`npgsql`. The crawl store is Mongo end-to-end via GeekAPI; this repo holds no database client at all. |
| No polling | **Compliant** | No `setInterval` or recurring `setTimeout`-driven fetch anywhere in `src/` or `web/`; live status is pushed over SignalR (`GeekCrawlerEvent`), and `crawl-hub.ts`'s own comment states "No timer polling" — confirmed true by grep. |
| One attempt, no retries, no fallbacks | **Compliant** | `CheerioCrawler` is configured with `maxRequestRetries: 0`; `geek-api-client.ts` makes exactly one request per operation and throws rather than retrying; `persist.ts`'s coordinator latches the first failure and refuses further writes. |
| Every unexpected error terminal, observable, owned | **Compliant** | A persistence failure stops the run (`throwIfPersistenceFailed`), is logged with a code, and triggers `archiveAndPurge` — post-mortem written before destruction, never the reverse. |
| Fail-closed robots handling | **Compliant** | `robots.ts`'s `requireOrigin`/`requireSeedAllowed` throw on any load failure; a site with unreadable robots.txt is never crawled. |
| No stubs / TODO / placeholder bodies | **Compliant** | Zero `TODO`/`FIXME` hits across the whole tree. |
| No resume of failed runs | **Compliant** | `server.ts`'s three resume routes all answer `409 RESUME_FORBIDDEN` unconditionally. |
| No local mirror as crawl authority | **Violation, scoped** | See the High finding above: `web/`'s BFF still reads/writes through this crawler's own private API for create/cancel/delete/failures, bypassing GeekAPI — already tracked as open work in the repo's own plan, not newly introduced. |
| CheerioCrawler only, no Playwright product path | **Compliant in the live path; one dead-code risk** | The real crawler (`cheerio-runner.ts`) uses CheerioCrawler exclusively; Playwright appears only in `link-harvest.ts`'s one-page, discovery-only pass (explicitly justified and scoped) and in the unused `my-crawler/` scaffold noted above. |

## Cross-service contracts

- **This crawler → GeekAPI (authoritative).** `POST /api/geek-crawler/ingest/runs`, `PATCH .../runs/{id}`, `POST .../pages/batch`, `POST .../links/batch`, `DELETE .../runs/{id}`. Every write asserts the server's acknowledgment matches what was sent (page count, link count) and throws on any mismatch — there is no silent partial-write path.
- **`MAX_LINKS_PER_BATCH` / `MAX_PAGES_PER_BATCH` must mirror `GeekCrawlerIngestLimits` in GeekBackend**, by the crawler's own comment, with nothing automated checking the two sides agree. This is the cross-repo finding (C4) the prior audit named; it is unchanged and worth a shared contract test.
- **content-creator-v2 → GeekAPI, not this crawler.** Per the architecture, Content Creator never talks to Geek-Crawler-v2 directly; it passes a Run ID to GeekAPI. This repo's own `plans/move-crawl-reads-to-geekapi.md` documents that content-creator-v2 asking GeekAPI for a site's structure is what originally surfaced the "this repo exposes reads it shouldn't" problem.
- **GeekAPI's heading-tree builder re-derives structure from raw HTML instead of reading this crawler's typed `blocks`.** The plan file quotes this directly: `GccV2HeadingTreeBuilder.Build(p.Html!)` re-infers headings and anchors from markup GeekAPI stores separately, rather than reading the `heading`(+level)/`anchors` this crawler already emits per block. This is the same "two implementations of one rule" drift class as the locale-path finding above, just spanning repos instead of files — worth flagging to the GeekAPI report too.
- **Web → this crawler's private `:8787` API**, for create/cancel/delete/failures (see High finding). Web → GeekAPI directly for run snapshot reads and page-urls, which is already correct.

## Tests and verification

**Well covered.** The prior audit recorded 160 unit tests and 4 integration tests passing at the commit it checked; listing confirms unit tests for essentially every pure module: `classify-path`, `crawl-limits`, `crawl-profile`, `dedup`, `discovery-ledger`, `early-abort`, `extract-content`, `link-harvest`, `link-trap`, `links-scope`, `locale-path`, `non-content-path`, `reject`, `robots`, `run-log`, `section-quota`, `section-vocabulary`, `sitemap`, `url-dedup`, `viability-reject` under `src/crawl/`, and `content-readiness`, `corpus-summary`, `crawl-report`, `errors`, `extract-cache`, `failure-archive`, `failures-report`, `geek-api-client`, `page-dedup`, `read-record`, `reconcile-orphans`, `unreachable-vs-refused` under `src/storage/`. Four integration tests cover the API server, the crawler end to end, early-abort behavior and purge-on-failure. `web/e2e/crawler-ui.spec.ts` exercises the operator UI against `web/e2e/fake-services.mjs`.

**Self-documented, deliberately deferred gap** (`tests/KNOWN_GAPS.md`, confirmed current): three counters that nothing increments, and crawl cancellation's end-to-end coverage, both tracked explicitly rather than silently absent — the project's own standard for this is met here (a known gap stated plainly beats an undocumented one).

**Not covered:** no test asserts that `web/src/lib/locale-path.ts` matches `src/crawl/locale-path.ts`'s behavior — which is exactly how the drift in the Medium findings above went unnoticed; no contract test ties `MAX_PAGES_PER_BATCH`/`MAX_LINKS_PER_BATCH` to GeekBackend's mirrored constants; no test catches a UI caption describing removed crawler behavior.

## Recommended fix order

1. Fix the two stale UI captions (`submit-crawl-form.tsx`, `run-live-view.tsx`) — trivial, and actively misleading an operator today.
2. Port the BCP-47-aware locale fix from `src/crawl/locale-path.ts` into `web/src/lib/locale-path.ts`, or better, delete the web copy and have `sitemap-count.ts` import the crawler's version directly — removes the drift at its source rather than re-syncing by hand again.
3. Either batch pages for real or change `ingest-limits.ts`'s comment to state plainly that pages are submitted singly (F3, open since 2026-09-28).
4. Finish the architecture-boundary migration already planned: move web's create/cancel/delete/failures reads off this crawler's private API and onto GeekAPI, then delete `src/api/server.ts`, `cli.ts serve`, and the Dockerfile's `EXPOSE 8787` entirely, per the repo's own plan.
5. Delete the unused `my-crawler/` scaffold, or rename it away from anything resembling "crawler" if it is being kept as a reference example.
6. Low priority: wire up or delete `rawBodyStore`; add a cross-repo contract test for the batch-size mirror with GeekAPI.

Everything else in this repo — the extraction pipeline, the persistence coordinator, the dedup/near-duplicate system, robots handling, the orphan reconciler — is in full compliance with every project rule and shows no defects found in this read.

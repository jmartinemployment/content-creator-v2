# Geek-Crawler (v1) — Code Audit

**Date:** 2026-10-09

## Scope and method

Small repo (2,036 tracked `.ts`/`.tsx` lines) — read close to end-to-end: every file under `src/app/crawl/`, `src/app/api/geek-crawler/[...path]/route.ts`, `src/app/runs/[runId]/run-status-client.tsx`, `src/app/crawl/schedule-panel.tsx`, `src/app/crawl/start-crawl-form.tsx`, and the full `architecture.md` (its own stated topology, read as a claim to verify against the rest of this audit's findings, not as fact). The auth/BFF plumbing (`src/app/auth/*`) was skimmed structurally but not read in full, since it closely mirrors the same pattern already read in full in the content-creator-v2 and Geek-Crawler-v2 reports.

## What this is

A standalone Next.js operator UI — this is **not** the externally-deployed Geek-Crawler-v2 Node/Cheerio crawler audited elsewhere in this set of reports. This is an older, separate product: a BFF-only frontend whose own `architecture.md` describes it as the UI for an **in-process crawl engine living inside GeekAPI** (`GeekCrawlerController`, `GeekCrawlerService`, a worker, Playwright BFS), persisting to a Postgres `geek_crawler` schema owned by GeekRepository.

## Critical finding

**The backend this entire app is built to drive has been deliberately disabled, and this app was not updated to reflect it.** This repo's own `architecture.md` states, as current fact: "Persistence | PostgreSQL schema `geek_crawler` — owned by GeekRepository only" and describes `POST /crawls` (`GeekCrawlerController`/`GeekCrawlerService` in GeekAPI) as the live way to start a crawl.

Both of those are now false, confirmed independently in this same audit pass, in two other repos:

1. **The Postgres `geek_crawler` schema is gone.** GeekRepository's own `AGENTS.md` (read in full while auditing that repo) states: "Mongo is the crawl store, end to end... `GeekCrawlerDbContext`, its design-time factory, `GeekCrawlerSeedKeyBackfill` and all of `Migrations/GeekCrawler` were deleted in `6662184`... Nothing creates or touches a `geek_crawler` schema." Confirmed independently by listing every `DbContext` in GeekRepository (12 total) and finding no `DbSet<>` for any crawl entity.
2. **`POST /crawls` is disabled.** GeekAPI's `GeekCrawlerService.StartCrawlAsync` (read in full while auditing that repo) is a one-line method that unconditionally throws `InProcessCrawlUnavailableException`, and `GeekCrawlerController`'s `POST crawls` endpoint catches it and returns `501`, pointing the caller at the *external* Geek-Crawler-v2 service instead (`POST http://127.0.0.1:8787/crawls`) — a completely different product from this one.

So `StartCrawlForm.tsx` in this repo — a form whose whole purpose is `POST /api/geek-crawler/crawls` via the BFF proxy (`src/app/api/geek-crawler/[...path]/route.ts`) straight through to that same disabled GeekAPI endpoint — will receive a `501` on every submission today. The same is true of `SchedulePanel`'s schedule-creation flow, which depends on the same engine.

**Evidence this is current, not a stale observation from months ago**: this repo's last commit is dated 2026-09-29 — the same day GeekRepository's `da6a98e` (project-site crawl-table removal) landed and the same general period the broader `geek_crawler` Postgres schema was removed. The frontend was not updated afterward to reflect the backend change.

## Scope of this finding — what still works

The **read** side of this app (`GET /crawls/{runId}`, run history, page/link listing, the SignalR live-progress client) depends on data that already exists in the backend's store and may still function for any runs that completed before the engine was disabled, or if GeekAPI serves these reads from a source this pass didn't re-check. This finding is specifically about the **write** path — starting a new crawl or schedule — which the backend audit confirms is a hard `501` today, not a guess.

## Other findings

**Low — architecture.md's own self-verification script would have caught this, had it been run.** The doc's own §12 "Verification" section includes `rg 'GeekCrawlerController|GeekCrawlerDbContext' /Users/jeffmartin/development/GeekBackend` as a check that the backend still exists as described — a good instinct, written into the doc itself, that was evidently not re-run after the backend changed.

No Markdown, Postgres-in-this-repo (it correctly has no direct database access, per its own hard rule 3), retry-loop, or stub/TODO issues found in the files read — the architecture rules this repo states for itself (BFF-only, no polling, no direct GeekRepository access) are honestly followed in the code; the problem is entirely that the thing it's a BFF *for* has moved out from under it.

## Recommended action

1. **Immediate**: confirm whether this app is still deployed/linked anywhere an operator could reach it. If so, either restore a working backend path or take the UI down/redirect it, since it currently offers a "Start a crawl" button that always fails.
2. Decide this repo's fate explicitly — retire it (matching how `GeekContentCreator` was retired with a note, per that repo's own history) or repoint its BFF at Geek-Crawler-v2's actual API shape, which is a different contract entirely (seed/crawlType body shape differs, and that service's job-based flow has no direct equivalent to this app's schedule panel).
3. Update or remove `architecture.md`'s now-false claims about the Postgres schema and the live backend, regardless of which direction is chosen — a stale architecture doc describing a removed system is exactly the "surviving name is a live claim" risk this whole project's rules exist to prevent, and it nearly produced a wrong read here (the doc was taken at face value until cross-checked against the other two repos' independently-confirmed findings).

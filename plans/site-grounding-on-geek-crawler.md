# Rebuild site grounding on Geek-Crawler-v2

> Restored 2026-09-17 after being overwritten. Previously lived outside git in
> `~/.claude/plans/`, which is why it could be lost. Keep it here.

## Why

`page_headings` was the last place the site's heading structure existed outside raw HTML. It is gone,
Site Analyzer's endpoints are retired, and GeekAPI's own project-site crawl capped at 50 pages into
Postgres. **There is currently no working path to site grounding.** Rebuilding it on Geek-Crawler-v2
is the critical path, not cleanup.

## What grounding needs

`GccV2HierarchyToolMatch` matches a keyword to a heading node and returns its child headings plus the
anchors beneath it. Heading *level* is semantic:

- **h6** carries partner/tool names; its child anchors are the links → `HarvestTools`
- **h5** is the keyword level a piece is about
- **h2** are standing message pillars

Derived from **raw HTML** by `GccV2SiteHierarchyFromCrawl.Build` → `GccV2HeadingTreeBuilder`. It cannot
come from RAG's text path: `Geek-Crawler-Rag/extract.py:44` is `body.get_text(...)`, which discards
every href, tag and heading marker.

Raw HTML is needed **at derivation time only**. Once `GccV2PageHierarchy` exists that HTML is dead
weight — which is what makes project-site crawls cheap to keep.

## Stage 0 — Replace-on-recrawl · DONE

Superseded by atomic publish (`GeekBackend 6c0ef9e`): a crawl always gets its own run, a slot resolves
to its newest `complete` run, the commit is a single status flip, the superseded run is retired after.

## Stage 1 / 1b — project-site crawl type and four profiles · DONE, MERGED

`Geek-Crawler-v2 fd66bc1`. Four profiles keyed per type with no shared fallback — an unknown type
fails to resolve rather than inheriting someone else's budget. Section quotas are **disabled** for
project-site: `DEFAULT_SECTION_QUOTAS` caps `tools: 10`, which is right for partner sites and fatal
here, because `GccV2SiteHierarchyFromCrawl` ranks `/tools` second only to the homepage.

## Stage 2 — GeekAPI reads project-site pages from Mongo · BLOCKED ON DATA

The seam is built and every consumer is repointed (`8390737`). `ContentCreatorV2:ProjectSitePageSource`
still defaults to `postgres` (`ServiceRegistration.cs:139`) and has never been flipped.

**Blocked, and not on code.** Verified 2026-09-17:

- `crawl_runs` holds **0** `project-site` runs
- Qdrant holds **0** project-site vectors (1,285,969 partner · 13,428 competitors)
- Postgres holds 1,050 pages across 19 runs

Flipping now points grounding at an empty store — emptying it rather than migrating it. The plan's own
verification (`GET runs/{mongoRunId}/site-hierarchy` returns a tree) cannot run without a Mongo run.

**Gate:** one project-site crawl must land in Mongo and be indexed. The run created from
`/app/create` sits at status `external` with 0 pages — GeekAPI creates it and will not crawl it, which
is Stage 3's architecture already in effect. It needs Geek-Crawler-v2 run locally against the seed.

## Stage 3 — Operator starts crawls; GeekAPI consumes a Run ID

Geek-Crawler-v2 is deliberately local-only (`README.md:232`: *"do not run crawls from Vercel — shared
cloud IPs are easy for bot managers to flag"*), so GeekAPI on Railway cannot call it. GeekAPI never
initiates a crawl; Content Creator accepts the run id.

**Deletion set — verified self-contained 2026-09-17.** Every reference is inside this machinery or in
`ServiceRegistration.cs`; nothing outside depends on it:

| Class | Referenced by |
|---|---|
| `GccV2ProjectSiteBfsCrawler` | ServiceRegistration, CrawlService |
| `GccV2ProjectSiteCrawlWake` | ServiceRegistration, CrawlService, Worker, StallRecovery |
| `GccV2ProjectSiteCrawlRunCoordinator` | ServiceRegistration, CrawlService, Worker |
| `GccV2ProjectSiteCrawlProgressNotifier` | ServiceRegistration, CrawlService |
| `GccV2ProjectSiteCrawlOptions` | ServiceRegistration, BfsCrawler |
| `GccV2ProjectSiteCrawlWorker` | ServiceRegistration |
| `GccV2ProjectSiteStallRecoveryHostedService` | ServiceRegistration |
| `GccV2ProjectSiteCrawlEventMapper` | CrawlService |

`GccV2ProjectSitePageSource` **stays** — it is the Stage 2 read seam.

The frontend never calls `api/geek-content-creator-v2/project-site/crawl`; it uses `startGeekCrawl` →
`/api/geek-crawler/crawls`. Removing that endpoint breaks nothing.

**Three things a naive delete breaks, not in the original plan:**

1. **`PromoteToKnowledgeAsync` loses its trigger.** The plan says knowledge promotion stays in GeekAPI,
   but it lives inside `CrawlService` and fires on crawl completion. Delete the crawler and nothing
   promotes — an unindexed corpus with no error. It needs a new trigger, most likely where the ingest
   commit flips a `project-site` run to `complete`. **This is the real design question in Stage 3.**
2. `NormalizeSiteUrl` — a static wrapper over `GeekCrawlerSeedNormalizer.TryNormalizeSeedUrl`, used by
   the controller. Needs a home or inlining.
3. `CancelRunAsync` and the cancel endpoint — crawls are cancelled in Geek-Crawler now, so it goes too.

Status vocabulary: in-flight is `external`, not `running`/`pending`. Review every status comparison
(`GccV2ProjectSiteCrawlService.cs:56-57,102-103,119`; `PromoteAsync`'s `complete` gate).

## Stage 4 — Delete

`ContentCreatorV2/ProjectSite/` + `GccV2PageFetcher`; the redundant crawlers (`SameOriginBfsCrawler`,
`GccPoliteCrawler`, `SiteCrawlerService` — grep callers first); the Postgres project-site tables,
entities, repo controllers and `HttpGccV2Repository.cs:194-268` via a forward-only drop migration; and
the Dockerfile's PowerShell + Chromium install, which exists solely for the crawl being removed.

**Ordering:** Stage 4's Postgres drop requires Stage 2 flipped and proven. Do not drop the tables while
reads still resolve to them.

## Risks

1. **Cheerio vs Playwright parity (highest).** The crawler runs Cheerio with no JS execution; GeekAPI
   used Playwright. On a client-rendered site the anchors under h6 may not exist in served HTML —
   silently fewer tool matches. Check the served HTML before relying on it; if it degrades, add a
   Playwright runner **in the crawler**, never back in GeekAPI.
2. Section quotas starving `/tools` — handled in Stage 1b, and unrecoverable silently since sa2 is gone.
3. Silent HTML omission over 14 MiB (`applyHtmlOmit`, `ingest-limits.ts:58-85`).
4. **`MarkdownReadyAt` is not a reliable "indexed" signal** — runs with it null held tens of thousands
   of vectors. Use Qdrant counts, never that field, for any deletion decision.

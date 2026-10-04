# Fix Content Creator — Geek-Crawler-v2

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for Geek-Crawler-v2: its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D2 | Links the sitemap omits: admit **every** same-origin link under the existing quotas, or only product/evidence-tier links. | Admit every link under the quotas, and raise the request budget off the sitemap size. The tier list is a priority order, not a whitelist. | C1 |
| D16 | Raw `Html` on crawl pages: keep storing it, or stop. Nothing live in GeekAPI reads it; RAG reads it only as a digest fallback when `contentHtml` is empty, which ingest already refuses. | Stop storing it on new crawls once R4 pins the digest to `contentHtml`. A storage decision over a live corpus, so Jeff's call. | C6 |

## Audit — Geek-Crawler-v2

| Id | Finding | Where |
|---|---|---|
| F-C1 | **A discovered link not in the sitemap is dropped, silently.** The test is exact string membership, so trailing-slash, case and www variants not literally in the map are dropped too. No counter is bumped. | `src/crawl/sitemap.ts:273`; intent at `:37-41`, `:250-253`; logged once at `cheerio-runner.ts:208-211` |
| F-C2 | **The request budget is clamped to the sitemap's size** when under 2,500, so admitting off-sitemap pages would only displace listed ones. | `cheerio-runner.ts:217-237` |
| F-C3 | **There is no link-trap defence** other than the sitemap allowlist. `maxDepth` is null for every profile, so the depth check is inert. URL dedup deliberately keeps `page`, `sort`, `variant`. | `cheerio-runner.ts:273-276`; `dedup.ts:9`, `:61-109` |
| F-C4 | **Most counters are never persisted.** `runs.recordRejectStats` has no caller, so `run.json` reject and dedup fields are never written. Off-sitemap drops, locale drops, depth suppression, per-section admitted/suppressed, sitemap truncation, and budget exhaustion are not counted anywhere. The one merged counter, `enqueueSuppressedSectionQuota`, is inflated by repeated refusals. | `runs.ts:248-296`; `section-quota.ts:350-355`; `cheerio-runner.ts:683-687` |
| F-C5 | **No sitemap test exists.** `filterEnqueueUrls`, `initialCrawlUrls`, `loadSiteMapForSeed` have no unit test. The integration fixture serves an off-sitemap link and asserts nothing about it. | `tests/integration/crawler.integration.test.ts:96-98`; `tests/fixtures/site.ts:100` |
| F-C6 | **Page-level near-duplicate detection compares whole pages** (64-bit simhash over 5-word shingles, Hamming ≤ 3). Block-level repetition, which is what floods retrieval, is invisible to it. | `dedup.ts:157-200`, `:219-227` |
| F-C7 | Classifier and quota tables drifted: `case-studies` is qualifier-prefixed in one and bare in the other; `archive` lacks `page` in one. | `section-quota.ts:111`, `:67` vs `classify-path.ts:147`, `:161-163` |
| F-C8 | **Content is stored three times** per page: raw `Html`, `contentHtml`, and `blocks` (each block carries `text` and `html`). `Html` is the bulk. | `GeekCrawlerPage.cs:5-36`; `ingest-limits.ts:51-56` |
| F-C9 | **A re-crawl gets a fresh run id**, issued by GeekAPI; the previously published run is purged at commit. AGENTS.md says the opposite ("the same run id refilled in place"). | `GeekCrawlerIngestController.cs:109-121`, `:236-244`, `:352-370` |

Confirmed sound: extraction emits eight typed block kinds with `text`, `html`, `anchors`; there is no
Markdown conversion anywhere; `ContentReadyAt` is set only when every saved page has content and is
cleared on cancel and supersede (`persist.ts:321-336`; `IngestController.cs:342-349`).

---

## The work — Geek-Crawler-v2

**C1 — Follow links the sitemap omits, and count them.** (F-C1, F-C2; D2)
- Change: remove the allowlist test at `sitemap.ts:273`. A same-origin link not in the sitemap goes
  through `admitBySection` like any other. The sitemap keeps its job of seeding in priority order.
  Size the request budget from the profile, not the sitemap. Count `offSitemapAdmitted` and
  `offSitemapSuppressed` in `CrawlReport`.
- Done when: a re-crawl of ramp.com fetches `/products`, `/bill-pay`, `/accounting-automation`; of
  bill.com `/pricing`; of lightyear.cloud `/features/*`; and each report states how many off-sitemap
  pages were admitted.
- Depends on: C2 lands in the same change.

**C2 — A link-trap defence that is not the allowlist.** (F-C3)
- Change: the allowlist was also the trap defence. Replace it with the minimum that the measured
  corpus needs: a path-pattern denylist (calendar, faceted and paginated listings), a per-directory
  admitted-page cap for `other`-tier directories, and `maxDepth` set per profile rather than null.
  Measured on ramp, bill, lightyear and the two sites with the most `other`-tier pages.
- Depends on: nothing; ships with C1.

**C3 — Counters are persisted.** (F-C4)
- Change: wire `recordRejectStats`; add per-section admitted/suppressed, depth suppression, sitemap
  truncation, budget exhaustion and the C1 counters to `CrawlReport`, which already persists to
  `CrawlReportJson`. Refusals are memoised so a re-offered URL is counted once.
- Done when: the crawl report for one run accounts for every discovered URL: fetched, suppressed by
  which rule, or left unfetched by budget.

**C4 — Classifier and quota tables agree.** (F-C7) One table, or a test that diffs them.

**C5 — Sitemap tests.** (F-C5) `sitemap.test.ts` for `filterEnqueueUrls`, `initialCrawlUrls`,
`loadSiteMapForSeed`; the integration fixture asserts the off-sitemap link is admitted.

**C6 — Raw HTML storage.** (F-C8; D16) After R4 pins the digest to `contentHtml`, new crawls stop
sending `Html`. Existing pages are Jeff's call. Ingest already refuses a page with blank `contentHtml`
or empty `blocks`, so nothing downstream loses a page it could have used.

---

## Verification

- **Geek-Crawler-v2:** `tsx --test` green including the new `sitemap.test.ts`; the three re-crawls in

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | C6 (after D16) | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

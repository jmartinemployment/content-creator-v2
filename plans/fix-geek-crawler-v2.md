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
| D16 | Raw `Html` on crawl pages: keep storing it, or stop. | **Withdrawn, Jeff 2026-10-04: raw HTML stays stored.** This project is HTML, never Markdown; `contentHtml` and every block's `html` are HTML too, and nothing here moves toward anything else. `GccV2SiteSection` reads `Html` on a live path, which settles it regardless. | — |

## Status, 2026-10-04 evening — reviewed against the commits, not the report

Commits `195e2df`, `4954d4d`, `d7e48c5`, `639c049`, `1f8d4be`, `f1356d9`, `c854667`, `106b8b9` on
`main`. Unit suite: 340 of 341 pass; the one failure (`failure-archive.test.ts`, "an unwritable
archive aborts before the purge") fails identically at `a08ac9e`, before any of this, and is an
environment artefact: the test makes a directory unwritable and the container runs as root, which
can write anywhere. Not this work's defect; it should skip or assert differently when euid is 0.

**C1 — done, and better than specified.** The allowlist at `sitemap.ts:273` is gone; membership is
by a normalised key, so trailing-slash, case and www variants of a listed URL no longer read as
off-sitemap (the exact-match flaw F-C1 noted); the budget comes from the profile, never the sitemap
(`cheerio-runner.ts:217-221`); off-sitemap admitted and suppressed are counted. Sitemap product and
evidence links go to the front of the queue. Accepted.

**C2 — done, with two departures that stand.** Trap rules are pagination, facet, search and calendar
(`link-trap.ts`), plus a cap of 50 pages per directory for `other`-tier pages, applied to links the
sitemap omits, or to every link when there is no sitemap. Sitemap entries are exempt because the site
chose to list them; that is the right line. (1) `maxDepth` stays null, because `03a53ce` removed depth
caps deliberately and the ledger counts depth refusals so a cap can be measured before it is set.
Accepted. (2) The patterns and the cap of 50 were chosen without the measurement the stage asked
for, because the session has no Mongo access. Accepted as a first value; **the first three re-crawls
(ramp, bill, a third declared partner) report `refused.directoryCap` and `refused.<trap>` per directory, and the
numbers decide whether 50 and the four rules stand.**

**C3 — done, placed differently, and the placement is right.** Counters live in a discovery ledger
(`discovery-ledger.ts`): discovered, enqueued by source, fetched, enqueued-not-fetched, budget and
whether it was exhausted, refused by rule, off-sitemap admitted and suppressed, per-section admitted
and suppressed, sitemap present/size/truncated. It is written to `hostProgressJson` (persisted by
GeekAPI as `HostProgressJson`), to the failure archive, to `run.json` (so `recordRejectStats` now has
a caller) and to a log line. Not to `CrawlReport`, because GeekAPI deserialises that into the typed
record `GeekCrawlerRunReport` and would drop unknown fields. Correct call. **Follow-up, GeekAPI
plan:** either type the discovery report onto `GeekCrawlerRunReport` or expose `HostProgressJson`
to the operator; today nothing in GeekAPI reads the ledger. Refusal counts are now distinct URLs,
which is what C3 asked. `enqueueSuppressedSectionQuota` is removed; nothing in GeekBackend read it.

**C4 — done, early.** One vocabulary (`section-vocabulary.ts`) read by both the classifier and the
quotas, which is the "one table" option. Behaviour changes are the drift fixes the stage named:
`customer-case-studies` is now capped at 250 like the others, singular `/calculator/` and
`/generator/` are capped, `/page/` is an archive, `rate-tables` narrowed to `local-` and `zip-`.
One edge: the quota scan stops at the leftmost named section, so `/faq/blog/x` is `faq` (evidence,
uncapped) rather than `blog`. Acceptable; evidence directories carry no cap by design. **Built in
Wave 1 against the plan's Wave 2 placement.** Recorded; the work itself is per plan.

**C5 — done.** `sitemap.test.ts` exists (321 lines in `195e2df`, extended since); the integration
fixture asserts the off-sitemap link is admitted.

**Outside the plan, accepted.**
- `639c049`: on a site with no sitemap, harvested links now pass the locale filter, the section
  quotas and the editorial share, in tier order. They were admitted ungated, so the share gate
  built for lightyear's 129-of-148 blog crawl never saw the URLs that pass contributed. Consistent
  with C1's principle. Expect the editorial share of no-sitemap crawls to fall; that is the gate
  working.
- `1f8d4be`, `106b8b9`: resume UI, routes, helpers, test and mocks deleted. The crawler refuses
  resume (`cheerio-runner.ts:100-110`), so the controls were dead surface.
- Locale filtering consolidated into `filterEnqueueUrls`; `run.json` now records
  `pagesRejectedRequiresJavascript`; a cancel integration test; `KNOWN_GAPS.md` rewritten;
  code-review fixes applied.
- `c854667`: README and audits updated; three completed plans deleted in this repo's `plans/`,
  with Jeff's approval.

**Not done here, by design.** Nothing re-crawled: the session has no crawl access. The three
re-crawls in C1's done-when (ramp, bill, a third declared partner; lightyear.cloud is no longer
offered and is not crawled) are Jeff's to start, one at a time, and their ledgers are the measurement
C2 still owes.

**Since the review (Geek-Crawler-v2 session).**
- `d8e4341`: `failure-archive.test.ts`, "an unwritable archive aborts before the purge", no longer
  depends on file permissions. It puts a regular file where `failures/` belongs, so the archive
  write fails with `EEXIST` for any user, root included (checked by calling `archiveRun` directly).
  The test is not skipped, so the ordering rule is still asserted in the root container.
  `failure-archive.ts` is unchanged. Unit 341 of 341, integration 11 of 11.
- Correction to C1 above: it is the off-sitemap product and evidence links that go to the front of
  the queue (`filterEnqueueUrls`, `forefront`). Sitemap URLs are queued as start URLs in tier order.
- Gap in the measurement C2 owes: the ledger counts `refused.directoryCap` and each
  `refused.<trap>` as run totals. It does not break them down by directory, so a re-crawl can report
  the totals but not which directories hit the cap of 50. Getting the per-directory breakdown means a
  change to `discovery-ledger.ts`. Per the instruction to stop, it is not made; it needs a decision.

**Re-crawl measurements, 2026-10-05.** Crawler process started 07:57 local, after `d8e4341`. Read from
each run's `hostProgressJson` discovery ledger. ramp.com (`4563f7ec`) still running when recorded.

| | lightyear.cloud `84f4f34f` | bill.com `e17ef3c0` |
|---|---|---|
| discovered | 322 | 2,115 |
| enqueued (seed / sitemap / link) | 134 (1 / 23 / 110) | 665 (1 / 396 / 268) |
| fetched / pages saved | 134 / 116 | 665 / 602 |
| enqueued, not fetched | 0 | 0 |
| budget exhausted | no (134 of 2,500) | no (665 of 2,500) |
| off-sitemap admitted / suppressed | 107 / 58 | 228 / 60 |
| refused: share | 184 | 1,428 |
| refused: directoryCap | 0 | 16 |
| refused: pagination / facet / search / calendar | 0 / 0 / 0 / 0 | 2 / 2 / 0 / 0 |
| refused: section | 0 | 2 |
| refused: locale / invalid / depth | 4 / 0 / 0 | 0 / 0 / 0 |
| section admitted | blog 5, resources 21 | case-studies 227, resource-center 35, blog 31, learn 6, guides 5, press 4, tools 2, templates 1, resources 1, articles 1 |
| section suppressed | none | webinars 1, events 1 |
| sitemap | 155 URLs, not truncated | 1,827 URLs, not truncated |

- C1 done-when, lightyear.cloud: met. 10 `/features/*` pages fetched.
- C1 done-when, bill.com: met, but the done-when names the wrong URL. bill.com has no `/pricing`; it
  301-redirects to `/product/pricing`, which the sitemap lists, the homepage links, and the crawl
  fetched. The done-when should read `/product/pricing`.
- The share gate is the dominant refusal on both runs. The trap rules refused 4 URLs in total and
  the cap of 50 refused 16, all on bill.com. Which directory hit the cap is not in the ledger (see
  the gap above); `/find-an-accountant/`, at 49 saved pages, is the likely one, inferred from the page
  list and not measured.
- Neither the cap of 50 nor the four rules changed. Undecided until ramp.com reports.

**ramp.com, 2026-10-05.** Run `4563f7ec` did not finish on its own. At 13:02 UTC one
`pages/batch` write hit undici's connect timeout (`UND_ERR_CONNECT_TIMEOUT`, 10 s, to
`api.geekatyourspot.com`). The coordinator latched it and ended the crawl, and the same latch
blocked the failed-status patch, so the run sat `external` on GeekAPI and `running` locally. Jeff
had it completed as it stood: a `complete` patch built from its post-mortem, carrying the real
report and discovery ledger, published 2,150 pages at 14:27:00 UTC and retired run `f8a3aa8c`
(2,025 pages). Its ledger, cut short by the failure, so partial:

| | ramp.com `4563f7ec` |
|---|---|
| discovered | 4,310 |
| enqueued (seed / sitemap / link) | 2,483 (1 / 2,158 / 324) |
| fetched / pages saved | 2,452 / 2,150 |
| enqueued, not fetched | 31 |
| budget exhausted | no |
| off-sitemap admitted / suppressed | 322 / 127 |
| refused: section | 1,810 (blog 1,408 over its 250 cap, archive 204, webinars 129, community 68) |
| refused: directoryCap / facet / locale / calendar / pagination | 6 / 4 / 4 / 2 / 1 |
| refused: share | 0 |
| section admitted | blog 250, customers 124, community 10, case-studies 5, tools 3, free-tools 2, learn 2, faq 1, press 1, news 1, resources 1, insights 1 |
| sitemap | 3,857 URLs, not truncated |

Across all three re-crawls the trap rules refused 11 URLs (pagination 3, facet 6, calendar 2; corrected 2026-10-06 from 14) and the cap of 50 refused 22 (16 on bill,
6 on ramp). Neither is binding. Both stand as they are unless the plan creator decides otherwise.

**`fabb42f` (Geek-Crawler-v2): an interrupted run is deleted, whatever interrupted it (Jeff,
2026-10-05).** This replaces "keep for re-post" (`archiveFailure`), which nothing could re-post:
there is no command and no retained payload.
- A run that fails on a GeekAPI write now purges, post-mortem first. Its `deleteRun` bypasses the
  latched coordinator, so it is still sent.
- A run whose process died is deleted by the startup orphan pass, through the same function as
  `DELETE /crawls/:runId`, where before it was only marked failed locally.
- Unit 341 of 341, integration 11 of 11.
- The wider durable-delivery redesign (outbox and SignalR ingest) was planned and then dropped by
  Jeff in favour of this smallest change.

**`15ab6d6` (Geek-Crawler-v2): the orphan pass asks GeekAPI before deleting a run (2026-10-06).**
`fabb42f` deleted every stale local run marked `running`. ramp.com `4563f7ec` was completed by hand
and GeekAPI holds it `complete`, but its `run.json` still says `running`, so a `serve` restart would
have purged the published corpus.
- `runPresence` now carries the status GeekAPI reports. A run GeekAPI shows `complete` is left
  alone. A run GeekAPI gave no usable answer about (transport failure, 5xx, proxy 404, no status in
  the body) is left alone too. Any other status, or a GeekAPI 404, is purged as before.
- Dry run on the data volume against live GeekAPI: 30 runs held as `external` would be purged,
  ramp.com left alone. A `serve` restart is now safe and will delete those 30.
- Unit 347 of 347, integration 11 of 11, typecheck clean, fail-closed check ok.

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
  bill.com `/pricing`; of a third declared partner its dropped product pages; and each report states how many off-sitemap
  pages were admitted.
- Depends on: C2 lands in the same change.

**C2 — A link-trap defence that is not the allowlist.** (F-C3)
- Change: the allowlist was also the trap defence. Replace it with the minimum that the measured
  corpus needs: a path-pattern denylist (calendar, faceted and paginated listings), a per-directory
  admitted-page cap for `other`-tier directories, and `maxDepth` set per profile rather than null.
  Measured on ramp, bill, a third declared partner and the two declared sites with the most `other`-tier pages.
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

**C6 — withdrawn.** Raw `Html` stays stored (Jeff, 2026-10-04: this project is HTML, never Markdown). `GccV2SiteSection` reads it on a live GeekAPI path. F-C8 stands as a measurement of storage, not as a task.

---

## Verification

- **Geek-Crawler-v2:** `tsx --test` green including the new `sitemap.test.ts`; the three re-crawls in
  C1 with their reports; no counter in the report that nothing increments.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / a third declared partner | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

# Enforce "one crawl Run ID = one URL"

Secondary — not blocking [project-url-run-id.md](./project-url-run-id.md).

## Context

Jeff instructed on 2026-09-17 that a crawl Run ID must cover exactly one URL, never a batch of seed
URLs, and that this be reflected in documentation across related repos. Verified two days later:

**Code — not enforced.** `GeekCrawlerService.StartCrawlAsync`
(`GeekBackend/GeekAPI/Services/GeekCrawler/GeekCrawlerService.cs:85-132`) still accepts up to
`GeekCrawlerCaps.MaxSeedsPerRequest = 25` seeds per request and computes **one**
`seedKey = ComputeSeedKey(seeds)` over the **whole list**, creating one run for the entire set.
`GeekCrawlerSeedNormalizer` (`GeekApplication/Models/GeekCrawler/GeekCrawlerSeedNormalizer.cs`) is
built list-first throughout: `SerializeSeeds`/`SeedUrlsMatch` compare set equality, not one URL.
`GetLatestRunContainingSeedAsync` exists specifically to resolve one seed against a run "crawled as
part of a larger multi-seed batch" — its own doc comment says so. Tests
(`MongoGeekCrawlerPartnerCompetitorReadTests.cs`, `GeekCrawlerTests.cs`) explicitly assert
multi-seed-per-run behavior as intended. No revert or half-done attempt exists in git history —
recent commits (`e6b64a1`, `c2471fe`, `d9564dc`) all *reinforce* multi-seed batching.

Note: the frontend's Partner/Competitor multi-URL textareas (`crawl-client.tsx`) never actually call
`startGeekCrawl` today (zero call sites, confirmed) — so this is currently a backend-contract issue
with no live frontend caller, not an active user-facing bug. It matters because it's the contract any
future caller (including a Partner/Competitor "crawl now" feature) would inherit as-is.

**Docs — only 1 of 5 relevant repos states the invariant**, audited directly:

| Repo | State |
|---|---|
| **Geek-Crawler-v2** | ✅ States it explicitly: `README.md:81` "One seed URL = one `runId`"; `README.md:279` "One seed URL = one `runId` going forward," with legacy multi-seed runs explicitly called out as matched-by-any-seed for compatibility. |
| **Geek-Crawler** (older repo) | ❌ Actively documents the *opposite* — `architecture.md:274` "One run row per user + crawl type + **seed set**"; `plans/replace-on-start.md` titles itself "one run per **seed slot**" and defines `SeedKey` as a hash of sorted **seeds** (plural). |
| **GeekBackend** | Silent — `AGENTS.md`/`CLAUDE.md` (root, `GeekAPI/`, `GeekRepository/`) have no seed-cardinality language at all. |
| **content-creator-v2** | Silent — `AGENTS.md`'s "Crawl types" and "Crawls are atomic" sections describe slot/publish atomicity but never seed count; uses singular `seedKey` without ever stating "one URL." |
| **Geek-Crawler-Rag** | Silent — no file ties run scope to seed count. |

(GeekContentCreator and Geek-SEO excluded: the former is a frozen historical snapshot used only as a
git-history source for the v1 restore, not a maintained doc target; the latter doesn't touch crawl-run
creation at all.)

## Approach

**Code fix** — move `StartCrawlAsync`'s contract from "one seed list → one run" to "one seed → one
run," while preserving `AdmitSeeds`' existing partial-success semantics per URL:

1. In `GeekCrawlerController.StartCrawl`, after `AdmitSeeds` produces the accepted list, loop and
   call `StartCrawlAsync` once **per seed** (each with a single-element list), collecting one
   `GeekCrawlerRunDto` per seed. Respect `MaxConcurrentCrawlsPerOwner` per attempt — a seed that
   can't start because the cap is already hit is reported back like a rejected seed, not silently
   dropped or made to fail the whole request (mirrors the existing "one bad URL doesn't spoil the
   batch" philosophy from `e6b64a1`, extended to "one capacity failure doesn't spoil the batch").
2. Response shape changes from `{ run, seedsAccepted, rejected }` (one run) to `{ runs: [...],
   rejected: [...] }` (one run per accepted seed, each tagged with its seed). This is a breaking
   change to `StartCrawlResult` — since `startGeekCrawl` currently has zero frontend call sites
   (confirmed), there is no live caller to migrate today, which makes this the right time to change
   the contract before one exists.
3. `ComputeSeedKey`/`SerializeSeeds`/`SeedUrlsMatch` collapse to the single-seed case structurally
   (a one-element list) rather than needing a parallel single-seed code path — minimal surface change.
4. Decide (flag for review, don't guess): whether `GetLatestRunContainingSeedAsync`'s multi-seed-batch
   fallback is kept permanently for resolving pre-existing legacy runs (mirroring Geek-Crawler-v2's own
   "legacy multi-seed runs matched by any seed" precedent) or scheduled for removal once no multi-seed
   runs remain in Mongo. Keeping it costs nothing and matches the precedent already set; removing it
   requires confirming zero legacy multi-seed runs remain.
5. Update the multi-seed-per-run tests in `MongoGeekCrawlerPartnerCompetitorReadTests.cs` and
   `GeekCrawlerTests.cs` to assert the new one-seed-per-run contract instead of the batch behavior,
   keeping a legacy-compatibility test for the containing-seed fallback per (4).

**Doc fix** — add the same explicit statement Geek-Crawler-v2 already uses ("one seed URL = one run
id") to: `content-creator-v2/AGENTS.md` (Crawl types / Crawls are atomic section), `GeekBackend/AGENTS.md`
and/or `GeekAPI/CLAUDE.md`, `Geek-Crawler-Rag/architecture.md`. Correct `Geek-Crawler/architecture.md`
and `Geek-Crawler/plans/replace-on-start.md` to mark the "one run per seed set" model as superseded,
pointing at Geek-Crawler-v2's model and the code fix above, rather than leaving it as live-contradicting
documentation.

## Verify

`dotnet test` (GeekBackend) covering the updated seed-normalizer and crawler-service tests; manually
start a crawl with 3 seeds and confirm 3 distinct `runId`s are returned, each independently
resolvable via `crawls/latest?seeds=<one>`. Grep all five repos afterward for the corrected phrase to
confirm no contradicting doc remains.

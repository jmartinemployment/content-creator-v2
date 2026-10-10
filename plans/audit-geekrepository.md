# GeekRepository — Code Audit

**Date:** 2026-10-09

## Scope and method

GeekRepository is 235,677 tracked lines across 1,081 C# files — similar scale to GeekAPI, and not read line-by-line in full. The method combined whole-repo greps for every hard rule with targeted full reads of the files those greps surfaced:

- **Whole-repo greps**: `markdown` (zero hits outside tests), `TODO`/`FIXME` (zero hits), `MarkdownReadyAt`/`MarkdownVerified`/`AssignmentMarkdown` (zero hits), `ContentReadyAt` (confirmed live in exactly the three files expected: the Mongo crawl-run entity, the Mongo service, and the ingest controller).
- **Full reads**: `GeekCrawlerRun.cs` (the crawl-run model), the opening of `MongoGeekCrawlerService.cs` (confirmed `MongoDB.Driver`, not EF), `PostgresIsOAuthOnlyTests.cs` in full, and the "What Postgres is for" section of `AGENTS.md` in full — this repo's own documentation of its Postgres boundary, read as a claim to verify rather than a fact to cite.
- **Structural verification**: every `DbContext` class in the repo was listed (12, covering ContentWriter v1–v4, ContentCreator v1–v2, and Gtm) and cross-checked against `GeekCrawlerRun`/`Page`/`Link`/`Schedule` to confirm none of the four crawl models has a `DbSet<>` anywhere — they are plain POCOs read and written only through the Mongo service.
- **Git history verification**: commit `da6a98e` (project-site crawl tables dropped) and the migration file `20260929130000_DropProjectSiteCrawlTables.cs` were both confirmed to exist, matching the claim.

**Not read line-by-line**: the bulk of `Controllers/` (the REST surface for every content-type variant, ContentWriter v1–4 and ContentCreator v1–2), `Repositories/`, and the Migrations themselves beyond the two named above. A deeper pass of this repo would prioritize the `ContentCreatorV2` controllers and repositories specifically, since that is the live surface.

## What this service is

The data-access layer behind GeekAPI: every controller here is called only from GeekAPI's `HttpClients`, never directly by a frontend. It owns Postgres (via EF Core, several DbContexts for different content-generation eras) and, separately, the crawl corpus in Mongo (via `MongoGeekCrawlerService`, plain `MongoDB.Driver`, no EF).

- **Crawl data** (`Controllers/GeekCrawler/*`, `Services/MongoGeekCrawlerService.cs`): runs, pages, links, schedules, all in Mongo, confirmed with no EF/Postgres path anywhere in this slice.
- **Content persistence** (`Controllers/ContentCreatorV2`, `ContentWriterV2`–`V4`, `ContentCreator`): one DbContext per generation of the content-writing product, each in Postgres — `ContentCreatorV2DbContext`, `ContentWriterV2DbContext` through `V4DbContext`, `ContentCreatorDbContext`, plus `GtmDbContext`. Seven non-auth EF contexts total.
- **Auth**: a separate, presumably-OAuth-scoped Postgres context not examined by name in this pass, which is the one use `AGENTS.md` says Railway Postgres is meant to be limited to.
- **The enforcement mechanism for the crawl/Postgres boundary**: `GeekBackend.Tests/PostgresIsOAuthOnlyTests.cs`, which sweeps every `.cs`/`.sql` file in the solution (not a fixed path list) for forbidden identifiers and forbidden project references, so the guard cannot be sidestepped by moving code to a new file.

## Critical and high findings

**None.** The rule most directly implicated by this repo — "Postgres is not to be used at all, in crawling" — is genuinely enforced, not just asserted: `GeekCrawlerRun`/`Page`/`Link`/`Schedule` have no `DbSet<>` anywhere (confirmed by checking all 12 DbContexts), `MongoGeekCrawlerService.cs` uses `MongoDB.Driver` exclusively, `GeekCrawlerDbContext` and its migrations do not exist in the current tree, and `da6a98e`'s claimed deletion of the project-site Postgres path was independently confirmed by reading the commit and the current `GccV2ProjectSitePageSource.cs` (Mongo-only, no Postgres variant anywhere).

**Worth stating plainly rather than treating as a finding**: this repo's own `PostgresIsOAuthOnlyTests.cs` discloses, in its own comment, that the broader rule — "Postgres on Railway is for OAuth use, period" — is **not yet enforced** for the seven non-auth EF contexts (`ContentWriterDbContext` through `V4`, `ContentCreatorDbContext`, `ContentCreatorV2DbContext`, `GtmDbContext`), which remain in active use. The test's own comment explains why: asserting a rule the code does not yet satisfy would itself be the defect the project's rules forbid ("never document a safety property that no check enforces"). This is the correct way to carry a known, intentional gap — stated where the next reader will find it, not hidden — and it is reported here as confirmed-current rather than as something newly discovered.

## Medium and low findings

None found in the files read. Given how much of this repo (`Controllers/`, `Repositories/` for the four ContentWriter generations) was not read in this pass, this should be taken as "nothing found in what was checked," not as a clean bill for the whole repo — see Scope for exactly what that excludes.

## Project-rule compliance

| Rule | Verdict | Evidence |
|---|---|---|
| No Postgres in crawling | **Compliant, enforced by a build-failing test, independently re-verified** | `PostgresIsOAuthOnlyTests.cs` sweeps every file for the removed surface; no `DbSet<>` exists for any of the four crawl entities; `MongoGeekCrawlerService.cs` uses `MongoDB.Driver` only. |
| Crawl store is Mongo end-to-end | **Compliant** | `GeekCrawlerRun`/`Page`/`Link`/`Schedule` are plain POCOs read/written only through the Mongo service, matching the architecture doc exactly. |
| No Markdown as corpus/readiness signal | **Compliant** | Zero hits for `markdown`, `MarkdownReadyAt`, `MarkdownVerified`, `AssignmentMarkdown` anywhere in the repo. `ContentReadyAt` is the live readiness field, confirmed in exactly the three files expected. |
| "Postgres on Railway is OAuth only" (broader rule) | **Not yet enforced — disclosed, not hidden** | Seven non-auth EF DbContexts remain; the repo's own test comment names this as outstanding work, not a silent gap. |
| No stubs / TODO / placeholder bodies | **Compliant in what was checked** | Zero `TODO`/`FIXME` hits in `GeekRepository` by grep (contrast with GeekAPI's `ContentWriterV3/NotificationService.cs`, which does have several). |

## Cross-service contracts

- **GeekAPI never holds a Postgres credential**, by design and by a compile-time guard: `GeekAPI.csproj` no longer references `Npgsql`/`Dapper`, so any reintroduced direct database call there fails to build rather than merely failing a review. All Postgres access is required to route GeekAPI → GeekRepository → Postgres, which this repo's controllers are the only implementation of.
- **`GeekCrawlerIngestController` (GeekAPI) → this repo's `Controllers/GeekCrawler/*` → Mongo** is the one path crawl data takes; nothing here gives GeekAPI a second, Postgres-backed route for the same data, matching the GeekAPI report's own confirmation of the ingest-controller route list.
- **GeekAPI's `GeekCrawlerService` and `GeekRepository`'s `GeekCrawlerRunsController`/`MongoGeekCrawlerService` agree on the crawl-run shape** (`ContentReadyAt`, `CrawlReportJson`, `HostProgressJson`) — confirmed by reading the entity and the ingest controller together, no drift found in the fields checked.

## Tests and verification

`PostgresIsOAuthOnlyTests.cs` is a strong, well-designed regression guard: it sweeps the whole solution by file content rather than a fixed path list (so moving forbidden code to a new file does not evade it), excludes only build output, migrations (which must name what they drop) and itself, and asserts both on source identifiers and on the project file's package references — the latter specifically so a capability ban can't be reintroduced by adding a new call site, only by re-adding the dependency, which the test also catches. This is a good pattern worth the other repos in this system adopting more broadly (the Geek-Crawler-v2 report recommends exactly this shape of test for its batch-size mirror with GeekAPI).

Not assessed in this pass: test coverage for the seven non-auth EF contexts' own data-correctness, or for the `ContentWriterV2`–`V4`/`ContentCreator` controllers generally.

## Recommended fix order

1. No urgent action — the rule this repo is most responsible for (crawl data never touches Postgres) is genuinely enforced, not just claimed.
2. When ready to act on the broader "Postgres is OAuth only" rule, migrate the seven non-auth EF contexts to GeekRepository's own stated target (Supabase/Postgres is fine for non-OAuth data per "Railway vs Supabase" in `AGENTS.md`; the rule is about Railway Postgres specifically, worth re-reading in full before treating this as "move everything off Postgres" rather than "move it to the right Postgres") and then extend `PostgresIsOAuthOnlyTests.cs` to cover them, exactly as its own comment says to.
3. A deeper pass of this repo should read `Controllers/ContentCreatorV2` and its repositories in full — the live persistence path — which this pass did not reach.

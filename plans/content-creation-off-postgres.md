# Content Creation off Postgres

**Priority: its own task. It does not take priority over producing content** (Jeff, 2026-10-02). Parked
until the content work — five tool pages, pillar, blog — is producing output.

**Decided, 2026-10-02: DELETE.** Jeff, verbatim: *"I SAID DELETE, USING RAILWAY POSTGRES WAS NEVER
AUTHORIZED DELETE"*, and earlier *"POSTGRES ON RAILWAY IS ONLY FOR OAUTH USE, PERIOD"* /
*"NO POSSIBLITY OF RAILWAY POSTGRES USE BEING RESTORED"*.

No rows survive. No data migration. Nothing to weigh — the use was never authorized, so the question is
only what replaces the store for the parts Content Creation needs to keep working.

**Scope correction: it is seven EF contexts, not two.** `AppDbContext`, `GtmDbContext`,
`ContentWriterDbContext`, `ContentWriterV3DbContext`, `ContentWriterV4DbContext`,
`ContentWriterV2DbContext`, `ContentCreatorDbContext`, `ContentCreatorV2DbContext` all share one
`DATABASE_URL` (`GeekRepository/Program.cs:31-96`). `PostgresIsOAuthOnlyTests` already records the
remaining work and says not to add its assertion *"until they are gone"*. My first draft scoped two of
them and called it the job.

**Repo:** `GeekBackend`. Claims cite `file:line`.

---

## Why

Jeff's standing rule: **Postgres is never used in Content Creation.** It is, today, and the service will
not start without it:

- `GeekRepository/Program.cs:83` registers `ContentCreatorDbContext` against Npgsql, schema
  `content_creator`; `:90` registers `ContentCreatorV2DbContext` for `content_creator_v2`.
- `Program.cs:231-245` runs `MigrateAsync()` on the `content_creator` schema on **every boot** and
  `logger.LogCritical(...); throw;` on failure — *"refusing to start"*. The V2 context's failure is logged
  and startup continues (`:247-258`).
- `GccArtifactRepository:11-13` is EF over that context. So creates, artifacts and versions — including
  everything today's test batches produced — are in Postgres.

This was carried in four successive plans as *"the Postgres migration — stated, not designed"*, which was
the wrong framing twice over: there is nothing to migrate **from** when the tables should not exist, and
filing a standing violation as future work gave it no owner. Jeff, 2026-10-02: *"Ever plan you develop you
insist on including something that could never occur, Postgres migration. These table should no longer
exist to be migrationed from?"*

## The twelve entity sets

`GeekRepository/Data/ContentCreatorDbContext.cs:13-24`.

### Need a Mongo collection — live, reachable from the UI

| Table | Evidence it is live |
|---|---|
| `gcc_creates` | the Create path's own record |
| `gcc_artifacts` | written by `GccGenerationCoordinator.PersistOneAsync` |
| `gcc_artifact_versions` | ditto, one per generate |
| `gcc_approval_events` | `approveGccVersion` (`src/services/gcc-api.ts:441`), called from `CreateDraftWorkspace.tsx` |
| `gcc_clients` | the client picker |
| `gcc_projects` | `partner_urls`, `competitor_urls`, `project_site_run_id`, `site_url` — the grounding inputs |

### Delete outright — never used (Jeff, 2026-10-02)

`gcc_tasks`, `gcc_time_entries`, `gcc_deliverables`, `gcc_project_log`, with their repositories
(`GccTaskRepository`, `GccDeliverableRepository`) and controllers (`GccTasksController`,
`GccDeliverablesController`).

**One discrepancy to resolve before deleting, not assumed away:** `src/components/content-writer/ProjectDeliverablesPanel.tsx`
exists and references deliverables. `AGENTS.md` records `/app/projects/[id]` and its eight panels as
sitting behind a collapsed `<details>` on a route with **no inbound link**, which would make the component
unreachable and consistent with "never used" — but that should be confirmed rather than inferred. `gcc-task`
and `site-analys` have **no** frontend references at all.

### Delete outright — the service is gone

`gcc_site_analyses`, `gcc_site_findings`, with `GccSiteAnalysisRepository` and `GccSiteAnalysesController`.
Site Analyzer was retired; `GccController` already has no call to it.

**So six of twelve are deletions and six need a collection.**

## Approach

The only Mongo service in `GeekRepository` is `MongoGeekCrawlerService` (`Services/MongoGeekCrawlerService.cs`),
registered with index creation at `Program.cs:112`/`:262-275` where failure is **best-effort and
non-fatal** — *"Indexes are best-effort: Hostinger Mongo can be briefly unreachable… everything else must
stay up."* That is the pattern to follow, including that posture.

### Stage 1 — delete the six dead sets

Entities, `DbSet`s, repositories, controllers, their interfaces and DI registrations, and their EF
migrations. No replacement, no Mongo collection. This is the cheapest third of the job and it shrinks
everything after it.

### Stage 2 — Mongo-backed repositories for the six live sets

One Mongo service in the shape of `MongoGeekCrawlerService`, behind the **existing** `IGcc*Repository`
interfaces so nothing above `GeekRepository` changes — `GeekAPI` talks to `HttpGccRepository` over HTTP
and must not notice.

Collections: `gcc_creates`, `gcc_artifacts`, `gcc_artifact_versions`, `gcc_approval_events`,
`gcc_clients`, `gcc_projects`. Registered through `BsonClassMap` the way the crawl models are.

Indexes to carry over from the EF model: `ix_gcc_creates_project_id` (`ContentCreatorDbContext:40`), the
non-unique index on `gcc_artifacts.CreateId`, and whatever `GccProjectRepository`'s idempotency key check
relies on — **read each `OnModelCreating` block before writing the collection**, because the indexes are
the part a store swap silently loses.

### Stage 3 — stop booting on Postgres

Remove the `ContentCreatorDbContext` registration (`Program.cs:83`) and
`ApplyContentCreatorMigrationsAsync` (`:231-245`), including the hard `throw`. Then drop the
`content_creator` schema and its `Migrations/` folder.

**Ordering matters and is not negotiable:** Stage 2 must be working and verified in a deployed environment
*before* Stage 3 removes the Postgres path. Boot currently hard-fails without the schema, so collapsing
both into one deploy means a bad Mongo config takes `GeekRepository` down with no fallback.

### Out of scope here

`ContentCreatorV2DbContext` / `content_creator_v2` (`Program.cs:90`, `:247-258`) is a second schema on the
dormant V2 path. It fails soft on boot, so it is not holding the service hostage. Named so it is not
forgotten; not addressed, because V2's fate is itself undecided
(`plans/grounding-resolved-once-per-generate.md`).

## Verification

1. Every deleted name returns zero hits across `.cs`, comments included.
2. The six `IGcc*Repository` interfaces are unchanged — their existing tests pass untouched, which is what
   proves `GeekAPI` cannot tell the difference.
3. Index parity: a test per collection asserting the indexes the EF model declared.
4. `GeekRepository` boots with **no** Postgres connection string present. That is the real test, and it
   cannot pass while `ApplyContentCreatorMigrationsAsync` exists.
5. End to end after Stage 2, before Stage 3: create a client, a project with five partner URLs, run a
   generate, approve a version — all against Mongo.
6. `grep -rn "content_creator" --include=*.cs` returns nothing but history.

## What I could not establish

- Whether `ProjectDeliverablesPanel.tsx` is reachable. Decides whether `gcc_deliverables` is a deletion or
  a sixth collection.
- Whether anything outside these two repos reads the `content_creator` schema directly — another service,
  a script, a BI tool. A dropped schema is not recoverable from code.
- Row counts. Irrelevant under "keep nothing", but worth one look before the drop in case the answer
  changes on seeing them.

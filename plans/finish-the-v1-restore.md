# Finish the v1 restore

v1 was restored but not integrated. It runs on V2's engine, alongside V2's product surface, against
a Postgres crawl store that holds nothing.

All work is in **GeekBackend**. `content-creator-v2` changes only at the last step.

## Where it actually stands

| | v1 | v2 |
|---|---|---|
| GeekAPI | `GccController` 1,747 lines / 30 routes + 7 services — **5,564 lines** | **204 files / 42,556 lines**, 21 controllers |
| GeekRepository | 6 controllers, 7 tables `gcc_*` | 98 files, 29 tables `gcc_v2_*` |
| Frontend calls | 26 endpoints, all live | one: `site-hierarchy` |

**v1 depends on v2 to compile.** `GccController` uses nine V2 types, and four more v1 services
reference the namespace:

```
GccV2GeekCrawlerResearchResolver   readiness probe        GccController:1092
GccV2SiteHierarchyFromCrawl        hierarchy-match        GccController:1163
GccV2HierarchyToolMatch            hierarchy-match        GccController:1164
GccV2HeadingTreeBuilder            called by the above
IGccV2ProjectSitePageSource        page loading           GccController:46
HttpGccV2Repository                run lookup             GccController:45
GccV2ProjectSiteCrawlPageDto       page shape
```

Also: `GccGenerateService`, `GccPartnerUrlResearchService`, `GccSavedSerpParser`,
`GccSiteSectionTypes`.

So the three v1 routes the frontend leans on — `readiness`, `hierarchy-match`, `site-hierarchy` —
all execute V2 code today. That is the unfinished half of the restore.

## The split

V2 is not one thing. It divides cleanly, and the division decides what is renamed versus removed.

**The shared engine** — what v1 calls. Engine code labelled v2 only by where it was written.
`GccController`'s own comment already says so: *"a shared engine, not a v2 dependency."*
**No name collisions** — `GccRepository`, `GccSiteHierarchyFromCrawl`, `GccHierarchyToolMatch`,
`GccHeadingTreeBuilder`, `GccGeekCrawlerResearchResolver`, `IGccProjectSitePageSource` do not exist
in v1.

**The v2 product surface** — the other ~20 controllers and the agents / skills / canvas / studio /
publish / context services, plus the 29 `gcc_v2_*` tables. The rolled-back shape. No v1 caller.

## Why a blanket rename fails

Three collisions, so `GccV2*` → `Gcc*` cannot be applied wholesale:

| Collision | Detail |
|---|---|
| Type | `GccController` exists in both. Only one holds the name |
| Route | `[Route("api/geek-content-creator")]` is v1's; dropping `-v2` puts two controllers on one prefix |
| Table | `gcc_creates` and `gcc_v2_creates` both exist — likewise clients, artifacts |

None of those three is in the engine set. Rename the engine; the collisions live entirely in the
product surface, which is being removed rather than renamed.

## Steps

### 1. Rename the engine into v1

Move `GeekAPI/Services/ContentCreatorV2/{Hierarchy,ProjectSite,GeekCrawler}` and
`HttpGccV2Repository` to `GeekAPI/Services/ContentCreator/…`, namespace `ContentCreatorV2` →
`ContentCreator`, type prefix `GccV2` → `Gcc`. Mechanical, no behaviour change, `dotnet build` is the
proof.

After this v1 compiles without the V2 namespace, and the "v1 depends on v2" problem is gone — it was
never real, only mislabelled.

### 2. Crawl data leaves Postgres

`ContentCreatorV2:ProjectSitePageSource` defaults to `"postgres"`
(`ServiceRegistration.cs:138`) — a store that holds no crawl data. Every project-site read falls into
that branch unless an env var nobody set says otherwise.

- Delete the flag and `GccV2PostgresProjectSitePageSource`; read Mongo unconditionally.
- Retire `GccV2ProjectSiteCrawlService` — GeekAPI's own in-process crawler, the only writer of
  `gcc_v2_project_site_crawl_*` and the reason Chromium is in the API image. Crawling is
  Geek-Crawler-v2's.
- Drop `gcc_v2_project_site_crawl_runs` / `_pages` / `_links`. Crawl data does not belong in the
  product database.

Postgres itself stays — it holds Content Creator's own data and always should.

### 3. Prove v1 standalone

All 26 frontend endpoints answer with the V2 namespace gone from v1's compile path. `dotnet test`.
This is the gate: nothing in step 4 starts until v1 runs on its own.

### 4. Remove the v2 product surface

~20 controllers, their services, the 29 `gcc_v2_*` tables. Remove behind a migration that drops the
tables, after confirming row counts — `gcc_v2_creates` and friends may hold real drafts, and "v2 was
rolled back" is not the same as "v2 produced nothing."

### 5. Content Creator

Point `getProjectSiteHierarchy` at whatever the route is called after step 1. Response models are
unchanged, so it is a URL edit.

## Open

- **Which `ContentWriter` context is live.** There are four (`ContentWriterDbContext` through `V4`),
  and `ProjectForm` reaches clients and projects through `content-writer-api`, not `gcc_*`. Not
  established — do not guess before step 4.
- **`gcc_site_analyses` / `gcc_site_findings`** are in v1's own shape, and Site Analyzer is obsolete
  as of 2026-09-20. They go with `plans/remove-site-analyzer.md`, not with this.
- **Structure from `blocks`.** Step 1 renames the HTML-parsing hierarchy builder rather than
  replacing it. Deriving structure from typed `blocks` is
  `Geek-Crawler-v2/plans/move-crawl-reads-to-geekapi.md`, and it supersedes the renamed code.

## Verify

1. `dotnet build` after step 1 — zero references to `ContentCreatorV2` from `Services/ContentCreator`
   or `Controllers/ContentCreator`.
2. All 26 frontend endpoints answer.
3. `grep -rn "ProjectSitePageSource" --include="*.cs"` finds no flag and no Postgres source.
4. `\d` shows no `gcc_v2_project_site_crawl_*`.
5. The Site structure panel on `/app/crawl` renders — no 500.
6. `dotnet test` in GeekBackend.

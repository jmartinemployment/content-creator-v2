# Crawl architecture — implementation plan

**Correctness over expediency.**

| Doc | Role |
|-----|------|
| [`crawl-architecture.md`](./crawl-architecture.md) | **What** — three crawl domains, boundaries, terminology |
| [`geek-crawler.md`](./geek-crawler.md) | Geek-Crawler ↔ gcc-v2 read contract |
| [`rules.md`](./rules.md) | Hard rules §5, §10 |
| **This file** | **How** — build order, files, verification |

**Scope:** GeekBackend + phi (this repo). No Geek-SEO edits. No Geek-Crawler UI in phi.

**Terminology:** **Project site** = URL bound to a create for grounding (`relatedPages`, BrandKit, `siteHierarchy`). Often a client property today — **not** assumed forever. Do not hard-code “client’s site” in APIs or tenancy.

---

## Target architecture

```mermaid
flowchart TB
  subgraph gc [GeekCrawler geek_crawler]
    Partner[crawlType partner]
    Competitors[crawlType competitors]
  end

  subgraph ps [gcc_v2 project site owned]
    PSCrawl[ProjectSiteCrawlService]
    PSStore[content_creator_v2 tables]
    SS[SiteSectionJson]
    BK[BrandKit]
  end

  subgraph gen [Generate path]
    Resolver[GccV2GeekCrawlerResearchResolver]
    Preflight[partner-tools preflight]
    Generate[POST generate]
  end

  Partner --> Resolver
  Competitors --> Resolver
  PSCrawl --> PSStore
  PSStore --> SS
  PSStore --> BK
  Resolver --> Preflight
  Resolver --> Generate
  SS --> Generate
  BK --> Generate
```

---

## Build order

| Order | Phase | Delivers |
|-------|-------|----------|
| 1 | **A** — Geek-Crawler read bridge | Partner/tools + competitor excerpts at generate from `geek_crawler`; drop CC duplicate tables |
| 2 | **B** — Owned project-site crawl | Replace Site Analyzer for `relatedPages`, BrandKit, BFS `siteHierarchy` |
| 3 | **C** — Phi cutover | Remove `site-analyzer` BFF + `pollUntilReady`; SignalR for project-site crawl |

Site Analyzer BFF remains **interim** until B + C ship ([`architecture.md`](../architecture.md)).

---

## Shipped status (Sep 2026 audit)

Commits referenced: GeekBackend `ffc13ee` (read bridge + by-seeds), `16fb679` (outline save), `48ab411` (notify-and-skip **regression**); phi `dcaa377` (warnings UI).

| Item | Status | Notes |
|------|--------|-------|
| **A1** `GccV2GeekCrawlerResearchResolver` | Shipped | Uses `ListPagesBySeedsAsync`; accepts partial/failed runs when seed HTML exists |
| **A2** Wire generate + preflight | Partial | Generate merges research; preflight returns `externalResearchNote`. **Generate fail-closed regressed** in `48ab411` |
| **A4** Resolver tests | Shipped | 11 tests; currently assert **throw** on missing external research (aligned with regression, not product spec) |
| **B2–B3** Project-site crawl | Shipped | `ContentCreatorV2/ProjectSite/*`, SignalR on gcc-v2 hub |
| **C2** Phi create flow cutover | Shipped | `new-create-form.tsx` — project-site crawl, no Site Analyzer poll |
| **Outline PUT** `jobs/{id}/outline` | Fixed (`16fb679`) | No `OutlineReady` replay on manual save; hub push failures logged, not fatal |
| **Notify-and-skip** | **Not shipped** | Restore warn-and-collect in resolver; see [`crawl-architecture.md`](./crawl-architecture.md) § implementation status |

**Open fix:** In `MergePartnerResearchAsync` / `MergeCompetitorResearchAsync`, replace `throw new InvalidOperationException(warning)` with `warnings.Add(warning)` and remove aggregate throws when all external seeds miss. Remove generate `catch (InvalidOperationException)` or limit it to non-recoverable cases.

---

## Phase A — Geek-Crawler read bridge (partner + competitors)

**Goal:** Populate WRITE research from `geek_crawler` without inline polite crawl or Content Creator HTML storage.

### A1. Research resolver (GeekBackend) — shipped, spec drift on skip policy

`GeekAPI/Services/ContentCreatorV2/GeekCrawler/GccV2GeekCrawlerResearchResolver.cs`:

- Inject `IGccV2GeekCrawlerReadRepository` (wraps `HttpGeekCrawlerRepository`).
- **Resolve run:** `GetLatestRunAsync` + `GetRunForSlotAsync` fallback — **any status** when seed HTML exists.
- **Load pages:** `ListPagesBySeedsAsync(runId, seedUrls)` — **never** paginate full runs at generate (OOM-safe).
- **Extract:** `GccV2ArticleHtmlExtractor.ExtractPartnerPage` → `GccQuoteablePage`.
- **Merge:** `GccV2PartnerUrlResearchService.MergePartnerResearchIntoBriefJson` / `MergeCompetitorResearchIntoBriefJson`.
- **Product policy:** notify-and-skip unavailable external seeds → `GccV2ExternalResearchMergeResult.PartnerResearchWarnings`. **Current code throws** (`48ab411`) — see [Shipped status](#shipped-status-sep-2026-audit).

~~**Gate:** `status == "complete"`; else fail closed.~~ **Superseded** by notify-and-skip policy in [`crawl-architecture.md`](./crawl-architecture.md).

Seed sources (existing static helpers on `GccV2PartnerUrlResearchService`):

- Partner (`crawlType: "partner"`): `CollectPartnerHrefs` + `CollectOperatorSeedUrls`
- Competitors: `CollectCompetitorHrefs`

Register in `GeekAPI/Services/ContentCreatorV2/ServiceRegistration.cs`.

### A2. Wire generate + preflight — shipped

In `GeekAPI/Controllers/ContentCreatorV2/GccV2Controller.cs`:

| Entry point | Shipped behavior |
|-------------|------------------|
| `PreflightPartnerTools` | Hierarchy merge only (no research merge). Returns `externalResearchNote` (notify-and-skip copy). |
| `Generate` | Merges partner + competitor + local research before `CreateBriefAsync`. Returns `partnerResearchWarnings[]` on skip paths; generate continues (`202`). |

Phi (`dcaa377`): stores `partnerResearchWarnings` in `sessionStorage`; amber banner in `create-detail-shell.tsx` and tools preflight step.

### A2b. Outline save (Canvas) — shipped (`16fb679`)

| Route | Behavior |
|-------|----------|
| `PUT jobs/{id}/outline` | Persists outline + patches `HierarchyChildHeadingsJson`. **Does not** append `OutlineReady` (avoids ~60s hub hang / BFF 500). |
| `POST jobs/{id}/regenerate-outline` | Still emits `OutlineReady` (server-driven replace). |
| `GccV2JobEventWriter.TryPushAsync` | Hub push failures log warning; persistence succeeds. |

Canvas uses PUT response body; `outlineDirtyRef` blocks hub `OutlineReady` while editing.

### A3. Delete Content Creator duplicate storage

| Artifact | Action |
|----------|--------|
| `gcc_v2_partner_research_records` | Migration `DropPartnerResearchRecords` |
| `GccV2PartnerResearchRecordsController` | Remove |
| `HttpGccV2Repository` `GetFreshPartnerResearchAsync` / `CreatePartnerResearchRecordAsync` | Remove |
| `GccPartnerUrlResearchService` (v1) | Keep only if v1 still references; zero V2 call sites |
| Brief `partnerResearch` / `competitorResearch` blobs | Not source of truth — derive at generate from Geek-Crawler (may persist merged slice on brief for child jobs) |

`gcc_v2_tool_source_crawl_*` — already dropped; do not revive.

### A4. Tests — shipped (assert fail-closed today)

- Resolver unit tests in `GeekBackend.Tests/ContentCreatorV2/GccV2GeekCrawlerResearchResolverTests.cs`.
- Covers: by-seeds call count, partial failed run with HTML, on-site project crawl merge, missing/incomplete external run **throws** (matches current code, not product spec).
- **When notify-and-skip is restored:** change `*_throws` tests back to `*_warns_and_skips`; assert non-empty `PartnerResearchWarnings`.

### Phase A — done when

- [x] Resolver + by-seeds reads (`ffc13ee`)
- [x] Generate merges research when runs/pages available
- [x] Phi warnings UI wired (`dcaa377`)
- [ ] Notify-and-skip on missing external research (regressed — restore)
- [ ] `partnerResearchWarnings` populated on skip paths
- [ ] `rg 'GetFreshPartnerResearchAsync|gcc_v2_partner_research'` on GeekBackend → empty after migration

---

## Phase B — Owned project-site crawl

**Goal:** Replace Site Analyzer as source for `relatedPages`, BrandKit, and full `siteHierarchy` (BFS). Copy Geek-Crawler mechanics; store in `content_creator_v2`.

**Not** a Geek-Crawler `crawlType`. Do not store project-site HTML in `geek_crawler`.

### B1. Schema (`content_creator_v2`)

New tables (mirror `geek_crawler` shape):

- `gcc_v2_project_site_crawl_runs` — `Id`, `OwnerUserId`, `SiteUrl`, `Status`, `SeedUrlsJson`, `HostProgressJson`, timestamps
- `gcc_v2_project_site_crawl_pages` — `RunId`, `Url`, `FinalUrl`, `Html`, `StatusCode`, `RobotsAllowed`, `CrawledAtUtc`
- `gcc_v2_project_site_crawl_links` — optional; BFS resume

Add on `GccV2Create`: `ProjectSiteCrawlRunId` (nullable during migration).

Replace `SiteAnalysisProfileId` on jobs/brief gate with `ProjectSiteCrawlRunId` when cutover complete.

### B2. Engine — copy from Geek-Crawler

New namespace `GeekAPI/Services/ContentCreatorV2/ProjectSite/`:

| Copy from | New owned type |
|-----------|----------------|
| `GeekAPI/Services/GeekCrawler/GeekCrawlerService.cs` BFS loop | `GccV2ProjectSiteCrawlService` |
| `GccV2PageFetcher` | Reuse or fold into project-site fetcher |
| `GccV2HeadingTreeBuilder` | `siteHierarchy` from crawled pages |
| Geek-Crawler worker/wake/recovery | `GccV2ProjectSiteCrawlWorker` + channel wake |

Single seed = normalized project site URL from create.

### B3. Public API (GeekAPI)

Base: `api/geek-content-creator-v2/project-site/`

| Route | Purpose |
|-------|---------|
| `POST /crawl` | Start crawl `{ siteUrl }` |
| `GET /runs/{runId}` | Run snapshot |
| `GET /runs/{runId}/pages` | Pages for section context |
| `GET /runs/latest?siteUrl=` | Reuse prior complete run |

Progress: SignalR on `/hubs/gcc-v2-realtime` (or dedicated event type). **No phi timer polling** ([`rules.md`](./rules.md) §4).

### B4. Section context + BrandKit

| Current | Replace with |
|---------|--------------|
| `GccV2SiteSection.TryBuildSectionContext` from Site Analyzer pages | `relatedPages` from project-site crawl + gap topic |
| `GccV2BrandKitBuilder` + `HttpGeekSeoSiteAnalyzerClient` | BrandKit from owned crawl pages / heading trees |
| `GccV2Controller` `site-analyzer/*` routes | Deprecate; remove after phi cutover |
| `siteAnalysisProfileId` | `ProjectSiteCrawlRunId` |

Merge interim `GccV2SiteHierarchyService` (homepage-only) into project-site BFS; remove standalone `POST site-hierarchy` after phi uses project-site run.

### B5. Generate gate

`GccV2SiteSection.ValidateSiteSectionGate` and `GccV2WriteService` — require `ProjectSiteCrawlRunId` + non-empty `SiteSectionJson.relatedPages` (fail closed).

### Phase B — done when

- [ ] `POST project-site/crawl` → run reaches `complete` or `failed` with SignalR progress.
- [ ] Create with run id → non-empty `relatedPages` on create; BrandKit builds without Site Analyzer.
- [ ] `rg 'HttpGeekSeoSiteAnalyzerClient' GeekBackend/GeekAPI/Services/ContentCreatorV2` → empty.

---

## Phase C — Phi cutover

**Depends on Phase B API.**

### C1. Remove Site Analyzer BFF

Remove `src/app/api/site-analyzer/*` (five routes). Use `src/app/api/gcc-v2/[...path]/route.ts` for `project-site/*`.

### C2. Rewrite create flow

`src/app/creates/new/new-create-form.tsx`:

| Remove | Add |
|--------|-----|
| `pollUntilReady`, `POLL_MS` | SignalR crawl events (pattern: `src/app/auth/job-hub.ts`) |
| `fetchProfilesByDomain`, analyze POST | `POST project-site/crawl` via gcc-v2 BFF |
| `siteAnalysisProfileId` | `projectSiteCrawlRunId` |
| `GET site-analyzer/{id}` | `GET project-site/runs/{runId}/pages` |

Update `src/app/creates/site-section.ts`: rename field; `siteSectionFromCrawlPages(runId, …)`.

Stop sending `siteAnalysisProfileId` on preflight/generate; use run id or persisted `SiteSectionJson` on create.

### C3. Copy cleanup

`src/app/creates/new/site-hierarchy-panel.tsx` — remove Site Analyzer references.

Legacy pages (`src/app/legacy/*`) — display-only; no migration unless needed.

### Phase C — done when

- [ ] `rg 'pollUntilReady|POLL_MS|site-analyzer' src/` → empty (except legacy if kept).
- [ ] New create flow: project-site crawl → brief → preflight → generate without Site Analyzer.

---

## Verification (all phases)

```bash
# Phase A
rg 'GetFreshPartnerResearchAsync|gcc_v2_partner_research' /Users/jeffmartin/development/GeekBackend

# Phase B/C
rg 'site-analyzer/analyze|pollUntilReady|siteAnalysisProfileId' /Users/jeffmartin/development/content-creator-v2/src
rg 'HttpGeekSeoSiteAnalyzerClient' /Users/jeffmartin/development/GeekBackend/GeekAPI/Services/ContentCreatorV2

# Rules
rg 'setInterval|POLL_MS' /Users/jeffmartin/development/content-creator-v2/src

# No Geek-Crawler UI in phi
rg -i 'geek-crawler|GeekCrawler' /Users/jeffmartin/development/content-creator-v2/src
```

**Manual E2E:** project-site crawl → create with `relatedPages`; Geek-Crawler `partner` + `competitors` runs complete → generate → tool blockquotes + competitor differentiation in WRITE.

---

## Out of scope

- Geek-Crawler UI (operator starts external crawls in `/Users/jeffmartin/development/Geek-Crawler`)
- `crawlType: local` (South Florida / regional product scope)
- v1 `GccPartnerUrlResearchService` deletion unless v1 fully retired
- Geek-SEO repo edits

---

## Task checklist

- [x] **A1** — `GccV2GeekCrawlerResearchResolver` + DI registration
- [x] **A2** — Wire preflight + generate in `GccV2Controller` (skip policy **open**)
- [ ] **A2-fix** — Restore notify-and-skip in resolver; align tests + phi copy
- [ ] **A3** — Drop `gcc_v2_partner_research_records` + repo/API surface
- [x] **A4** — Resolver unit tests
- [x] **B1** — Project-site schema + migration
- [x] **B2** — `ContentCreatorV2/ProjectSite/*` engine + worker
- [x] **B3** — `project-site/*` GeekAPI routes + SignalR
- [x] **B4** — `GccV2SiteSection` + BrandKit from owned crawl (Site Analyzer retired on path)
- [x] **B5** — `ProjectSiteCrawlRunId` gate on generate
- [x] **C1** — Remove phi site-analyzer BFF
- [x] **C2** — Rewrite `new-create-form` + project-site crawl
- [ ] **C3** — Copy cleanup (residual Site Analyzer refs if any)
- [x] **Outline** — Silent PUT save + `TryPushAsync` (`16fb679`)
- [ ] **Verify** — notify-and-skip E2E + rg checks

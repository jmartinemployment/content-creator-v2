# Geek-Crawler — Content Creator integration

Geek-Crawler is a **standalone crawl product**. This doc is the **Content Creator v2** view: what gcc-v2 reads, what it must not own, and how partner/tools and competitors connect to generate.

**Authoritative crawl split:** [`crawl-architecture.md`](./crawl-architecture.md)

**Implementation plan:** [`crawl-implementation.md`](./crawl-implementation.md) (Phase A: read bridge).

**Geek-Crawler product spec (UI repo):** `/Users/jeffmartin/development/Geek-Crawler/plans/geek-crawler.md`

**Corpus RAG (separate product):** `/Users/jeffmartin/development/Geek-Crawler-Rag` (`architecture.md`, `plans/geek-crawler-rag.md`). gcc-v2 **consumes** retrieval; does not own the indexer.

---

## Scope

Geek-Crawler crawls **external** sites:

| `crawlType` | Meaning |
|-------------|---------|
| `partner` | Partner tool / operator-supplied tool URLs (**Tools**) |
| `competitors` | Rival pages from brief `competitorUrls` |
| `local` | Local or South Florida business sites (future product scope) |

Geek-Crawler does **not** crawl the **project site** (the property bound to a create for `relatedPages` and BrandKit). That crawl is **gcc-v2 owned** — engine patterns copied from Geek-Crawler, storage in `content_creator_v2`. See [`crawl-architecture.md`](./crawl-architecture.md).

---

## gcc-v2 boundary

| gcc-v2 **does** | gcc-v2 **does not** |
|-----------------|---------------------|
| Query Geek-Crawler for `partner` and `competitors` runs; **prefer Geek-Crawler-Rag** chunks (topic-aware need) for WRITE grounding; fall back to seed-targeted pages | Start partner/competitor crawls inline or store raw HTML in `content_creator_v2` |
| Inject RAG chunks / extracted quoteable text into WRITE prompts (`GccQuoteablePage`) | Host Geek-Crawler or Geek-Crawler-Rag UI; own Qdrant/embed/index |
| **Notify and skip** when external research is missing — return `partnerResearchWarnings[]`; generate continues | Block generate, surface Geek-Crawler page-limit errors, or ask operators to change crawl config from Creator |
| Soft-warn when RAG index is still building; accept partial/failed runs when by-seeds lookup returns extractable seed HTML | Paginate entire runs (`ListPagesAsync`) for research merge; implement RAG inside phi |

Operator tool URLs stay on the brief (`operator-tools` / recommended tools). Crawl execution happens in **Geek-Crawler**; gcc-v2 **reads** results.

---

## API (read path for gcc-v2)

Public base: `api/geek-crawler` on GeekAPI (GeekOAuth bearer).

| Method | Route | Use |
|--------|-------|-----|
| GET | `/crawls/latest?crawlType=&seeds=` | Resolve latest run for seeds (any status) |
| GET | `/crawls/{runId}` | Run snapshot |
| GET | `/crawls/{runId}/pages/by-seeds?seeds=` | **Preferred** — HTML for specific seed URLs only |
| GET | `/crawls/{runId}/pages` | Paginated HTML — avoid at generate for large runs |

Crawl **start** is operator-driven in Geek-Crawler UI — not from Content Creator generate.

### Generate response (phi)

| Field | When populated |
|-------|----------------|
| `partnerResearchWarnings` | Per skipped external partner/competitor/local seed (notify-and-skip). Verified via resolver + Mongo smoke tests. |

Phi surfaces warnings via `sessionStorage` → amber banner on create detail (`create-detail-shell.tsx`). Preflight returns `externalResearchNote` explaining notify-and-skip — must stay aligned with backend behavior.

### Storage (Mongo)

| Item | Value |
|------|-------|
| Connection | `MONGO_CRAWLER_URL` (default `mongodb://localhost:27017`) |
| Database | `geek_crawler` |
| Collections | `crawl_runs`, `crawl_pages`, `crawl_links`, `crawl_schedules` |
| Partner vs competitors | Same collections; filter `CrawlType` = `"partner"` \| `"competitors"` |
| Service | `GeekRepository/Services/MongoGeekCrawlerService.cs` |

---

## Tables to remove from Content Creator (partner + competitors)

Single source of truth for external tool/competitor HTML: **Mongo `geek_crawler`**.

- `gcc_v2_tool_source_crawl_*` — already dropped; do not revive.
- `gcc_v2_partner_research_records` — remove after read path ships.
- Do not persist duplicate `partnerResearch` / `competitorResearch` HTML arrays on brief when Geek-Crawler pages exist.

---

## Naming

| Avoid | Use |
|-------|-----|
| vendor crawl | partner crawl, `crawlType: "partner"` |
| `ai-tools` | `partner` |
| client's site (as architecture term) | **project site** (URL bound to create; often a client property today, not assumed forever) |

---

## Related GeekBackend (engine lives here until fully extracted)

```
GeekBackend/
  GeekApplication/Models/GeekCrawler/CrawlTypes.cs
  GeekAPI/Services/GeekCrawler/
  GeekAPI/Controllers/GeekCrawler/
  GeekAPI/Services/ContentCreatorV2/GeekCrawler/GccV2GeekCrawlerResearchResolver.cs
  GeekRepository/Services/MongoGeekCrawlerService.cs
  GeekRepository/Data/Entities/GeekCrawler/
  GeekBackend.Tests/ContentCreatorV2/MongoGeekCrawlerPartnerCompetitorReadTests.cs
```

Wrong long-term placement for **product** UI: crawl start UI in content-creator-v2. Wrong duplicate: partner/competitor HTML in `content_creator_v2`.

---

## Verification (Sep 2026)

- Resolver unit tests: warn-and-skip for missing partner/competitor/local seeds; topic-aware `BuildRagNeed`; prefer RAG when index `complete`; soft-warn + seed HTML when index `pending`/`running`.
- Mongo smoke: `MongoGeekCrawlerPartnerCompetitorReadTests` — `GetLatestRunAsync` + `ListPagesBySeedsAsync` round-trip for `partner` and `competitors`; resolver merge populates `partnerResearch` / `competitorResearch`; missing competitor seed returns warning.
- Runtime path: GeekRepository crawl controllers use `IMongoGeekCrawlerService` (not EF) for reads.
- Partner research records table dropped; no `GetFreshPartnerResearchAsync`.
- Corpus RAG: `/Users/jeffmartin/development/Geek-Crawler-Rag` (separate product; not implemented in phi). GeekAPI consumes via `IGeekCrawlerRagClient` when `GEEK_CRAWLER_RAG_URL` is set.
- Operator path: Geek-Crawler run **complete** → RAG index **complete** (SignalR `GeekCrawlerRagIndexEvent`) → generate in content-creator-v2.

# Geek-Crawler — Content Creator integration

Geek-Crawler is a **standalone crawl product**. This doc is the **Content Creator v2** view: what gcc-v2 reads, what it must not own, and how partner/tools and competitors connect to generate.

**Authoritative crawl split:** [`crawl-architecture.md`](./crawl-architecture.md)

**Implementation plan:** [`crawl-implementation.md`](./crawl-implementation.md) (Phase A: read bridge).

**Geek-Crawler product spec (UI repo):** `/Users/jeffmartin/development/Geek-Crawler/plans/geek-crawler.md`

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
| Query Geek-Crawler for `partner` and `competitors` runs + **seed-targeted** pages at generate/preflight/tool spawn | Start partner/competitor crawls inline or store raw HTML in `content_creator_v2` |
| Extract quoteable text from stored `Html` into WRITE prompts | Host Geek-Crawler UI, BFF, or SignalR hub in phi |
| **Notify and skip** when external research is missing — return `partnerResearchWarnings[]`; generate continues | Block generate, surface Geek-Crawler page-limit errors, or ask operators to change crawl config from Creator |
| Accept partial/failed runs when by-seeds lookup returns extractable seed HTML | Paginate entire runs (`ListPagesAsync`) for research merge |

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
| `partnerResearchWarnings` | Per skipped external partner/competitor seed (intended). **Currently empty** when resolver throws before merge completes (`48ab411` regression). |

Phi surfaces warnings via `sessionStorage` → amber banner on create detail (`create-detail-shell.tsx`). Preflight returns `externalResearchNote` explaining notify-and-skip — must stay aligned with backend behavior.

---

## Tables to remove from Content Creator (partner + competitors)

Single source of truth for external tool/competitor HTML: **`geek_crawler`**.

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
  GeekRepository/Data/Entities/GeekCrawler/
```

Wrong long-term placement for **product** UI: crawl start UI in content-creator-v2. Wrong duplicate: partner/competitor HTML in `content_creator_v2`.

---

## Implementation gap (Sep 2026 audit)

Product spec = notify-and-skip (above). **Current GeekBackend** throws on missing external seeds → generate **400** (`48ab411` regression). Phi warnings UI is wired but inactive until restored. Details: [`crawl-architecture.md`](./crawl-architecture.md) § implementation status, [`crawl-implementation.md`](./crawl-implementation.md) § shipped status.

# Agent guidance — content-creator-v2

**Correctness over expediency. Always. No exceptions.**

| Authority | Path |
|-----------|------|
| Service boundaries + current state | this file |
| Architecture detail | [`architecture.md`](architecture.md) |
| Non-negotiables + honesty | [`.cursor/rules/`](.cursor/rules/) (alwaysApply) |

## Target architecture — one concern per service

| Service | Owns | Must not |
|---|---|---|
| **Geek-Crawler** | ALL crawling: `partner`, `competitors`, `geo`, `project-site`, future types | — |
| **Geek-Crawler-Rag** | Retrieval + verification over what was crawled | **Never generates** |
| **GeekAPI** | Service layer / BLL. Generation, grounded on verified Markdown | **No crawler, no browser** |
| **Geek-SEO** | Site + gap analysis (owns Site Analyzer) | — |
| **Content Creator** (this repo) | Passes a **Run ID** → GeekAPI → displays results | **No crawler, no browser** |

Do not re-expose Site Analyzer through Content Creator. Gap analysis is Geek-SEO's and reaches
Create via RAG. It was retired from the v2 path deliberately (`5072820`).

RAG is **Library-only — retrieval and verification**. `/v1/generate` and `rag-generate.*` were
removed and must never be revived. See `.cursor/rules/geek-crawler-rag.mdc`.

## Crawl types

`CrawlTypes` (`GeekApplication/Models/GeekCrawler/CrawlTypes.cs`):

- `partner`, `competitors` — third-party, feed RAG
- `local` — **means GEOGRAPHY (local SEO), not the own site.** `Geo` is the better name; the stored
  value stays `"local"` unless migrated. Never conflate it with the project site.
- **`project-site` does not exist yet.** It is a new type to be added, not a rename of `local`.

Sites exceeding 50,000 pages are normal. `SameOriginBfsCrawler` documents itself as "Unlimited
same-origin BFS per host"; that assumption is the reason the corpus reached ~223k pages / 93 GB with
the top 12 runs holding 75% of it. **Any new crawl type ships with a scope policy — depth, path
allow/deny, page budget — on day one.**

**Crawl types are not one size fits all.** Scope and *retention* are separate axes, because the types
feed different consumers:

| | Project site | Partner / competitor |
|---|---|---|
| Consumer | `GccV2SiteHierarchyFromCrawl.Build` → `GccV2HierarchyToolMatch` | RAG retrieval + quote verification |
| Must retain | **Raw HTML** — DOM tree, heading levels, anchors under a heading | Verbatim prose |
| Scale | Own site, bounded | 50,000+ pages, scope hard |
| Failure mode if wrong | Tools/partners silently stop being found — **no error, fewer matches** | Quote verification fails, loudly |

**Grounding cannot be derived from the RAG text path.** `Geek-Crawler-Rag/extract.py:44` does
`body.get_text(separator=" ", strip=True)` — text nodes only. Every href, every tag and every heading
marker is discarded. So h6→anchor tool links, "the keyword matched an h5", and h2 message pillars are
all unrecoverable from RAG's Markdown. `Build` filters on `p.Html` for exactly this reason.

Whichever crawler takes project-site **must persist raw HTML per page**, and hierarchy must be derived
from that, never from normalized text.

`crawl_pages.Html` is load-bearing: partner/competitor extraction reads it directly
(`GccV2GeekCrawlerResearchResolver.cs:372,583`) and it is ~98% of corpus size. Do not drop it for
space until extraction moves to Markdown.

## Fail closed. No middle states.

The system is binary by design: it either has real evidence and proceeds, or it refuses and says why.

- No fallback methods, no auto-repair, no default substitution (`.cursor/rules/no-fallbacks.mdc`)
- No stubs, no success-shaped empty results (`.cursor/rules/no-stubs.mdc`)
- Read env vars so `""` counts as absent — `??` passes an empty string through and has caused two
  production auth outages
- **Partial extraction is failure.** Catching a per-page error and logging "page skipped" is a middle
  state; it hid a total extraction outage behind thirteen drafts of filler

## Current state (2026-09-16)

- **Frontend is v1's** (`GeekContentCreator`), restored into this repo and in production. V2's
  frontend is gone.
- **PLAN and WRITE call v1's engine** — `ContentGenerationOrchestrator` via
  `ContentCreatorV2/V1Restore/`. VALIDATE/REPAIR/synthesis still run V2-side.
- **Drafting is OFF by default** — `ContentCreatorV2:DraftingEnabled=false` stops every create before
  the first paid model call, after the free evidence gates. Model default is `gpt-4o-mini`.
- **Known broken:** the restored frontend calls ~15 `api/geek-content-creator/*` endpoints that no
  longer exist (renamed to `-v2` in `582a171`, which also deleted `GccController.cs`, 1,486 lines —
  recoverable via `git show 582a171^:`). Only `/app/creates/new` avoids them.
- **Project-site crawling still runs inside GeekAPI**, which is why Chromium is installed into the
  API image (`Dockerfile:33`). That is the one live violation of the boundaries above.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

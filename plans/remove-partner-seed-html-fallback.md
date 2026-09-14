# Remove partner/competitor Mongo seed-HTML fallback

**Updated:** 2026-09-14  
**Accountable owner:** Jeff Martin  
**Release authority:** [master-plan.md](master-plan.md)  
**Honesty rule:** [`.cursor/rules/no-fallbacks.mdc`](../.cursor/rules/no-fallbacks.mdc)  
**Primary code:** `GeekBackend` → `GccV2GeekCrawlerResearchResolver.TryResolveExternalSeedAsync`

Status: **Implemented in GeekBackend** (2026-09-14) — partner/competitor external resolve is library-only; Mongo seed-HTML path retained only for external **local** seeds. Deploy + Jeff smoke still required.

---

## Problem

For each external partner/competitor seed URL, Create research currently:

1. Finds a Geek-Crawler run for the seed.
2. Prefers Geek-Crawler-Rag `/v1/query` chunks mapped to `GccQuoteablePage` (`retrievalMode: rag_chunk`).
3. **If RAG is disabled, index not ready, query empty, or host filter yields nothing → falls back to Mongo crawl HTML extract** (`ExtractQuoteableFromCrawlerPagesAsync`, `retrievalMode: seed_html`).

That step 3 is a **silent success-shaped fallback**. It violates the no-fallbacks non-negotiable: required library retrieval must fail closed, not substitute a secondary corpus path.

Secondary soft violations in the same method:

- When seed/host filter matches **zero** RAG pages, code replaces with **all** query pages (`filtered = rag.Pages`).
- Index `building` / `failed` / `skipped` still proceeds toward Mongo HTML instead of hard fail.
- Controller copy still tells operators generate “still runs” when index is building (`externalResearchNote`).

---

## What RAG chunks actually supply today (primary path)

`HttpGeekCrawlerRagClient.MapChunksToQuoteable` groups `/v1/query` hits by page URL and builds one `GccQuoteablePage` per URL:

| Field | Source |
|-------|--------|
| `url` | Chunk `finalUrl` or `url` |
| `title` | First non-empty chunk title (else URL) |
| `paragraphs[]` | Chunk **`text`** (truncated), up to `MaxParagraphsPerPage` |
| `pageId` | First chunk page id |
| `sectionTitle` | First chunk section title |
| `headings` | **Always empty** on this path |
| `retrievalMode` | `rag_chunk` |
| `runId` | Stamped from the crawler run |

So the library path is **retrieved chunk text**, not full-page Markdown and not heading trees. Full Markdown quote verify still happens later via `pageId` → `GET /v1/pages` when citeable gates run.

Mongo fallback instead extracts title/headings/paragraphs from crawl HTML (`seed_html`) — a different evidence shape presented as the same `partnerResearch` / `competitorResearch` array.

---

## Goal

External partner/competitor research for Create is **library-only**:

- Indexed RAG query must succeed with seed-relevant pages.
- No Mongo HTML substitute.
- No “use any pages from the run when host filter misses.”
- Fail closed with an explicit operator-visible error/warning that blocks fail-closed content types.

Project-site on-site tool pages (same-host as the Create site) are **out of scope** for this plan unless they share the same fallback helper — call that out in implementation and keep on-site path explicit.

---

## Target behavior

```text
seed URL
  → require partner/competitor crawl run
  → require RAG enabled
  → require index state queryable (complete / equivalent)
  → POST /v1/query (runId + host + need)
  → keep only pages matching seed URL or host
  → if zero pages: throw / return hard failure (no Mongo, no unfiltered Pages)
  → stamp rag_chunk + runId → merge into brief
```

Hard failures must surface as:

- Research merge warnings that **fail closed** when partner/competitor runs are required (comparison / alternatives / tool / partner-driven ads — existing gates).
- Prefer typed exception for “index not ready” / “RAG disabled” / “no library pages for seed” so jobs do not look successful with empty or HTML-only evidence.

---

## Implementation checklist

### GeekBackend

1. **`TryResolveExternalSeedAsync`**
   - Delete call to `ExtractQuoteableFromCrawlerPagesAsync` on the external partner/competitor path (or delete the method if unused).
   - Remove “filtered empty → all Pages” branch; empty filter = failure.
   - If `_rag.IsEnabled` is false → fail closed (do not soft-skip to Mongo).
   - If index state is building / failed / unknown → fail closed (do not softWarning + Mongo).
   - Keep successful `rag_chunk` stamp via `GccV2SeedHtmlProvenance.StampRagChunk` (rename provenance helper if needed so “SeedHtml” is not the only name).

2. **API / UX copy**
   - Update `GccV2Controller` `externalResearchNote` and any “generate still runs / seed pages as fallback” messaging.
   - Phi Research step helper text: indexed library required; no HTML backfill story.

3. **Tests**
   - Resolver tests: RAG miss / empty filter / RAG disabled / index building → **no** `seed_html` pages; assert failure or empty+hard warning that gates treat as gap.
   - Remove or rewrite tests that assert Mongo HTML fallback success.
   - Keep tests that assert `rag_chunk` mapping fields (url, paragraphs from chunk text, empty headings).

4. **Gates**
   - Confirm pre-PLAN evidence ready / fail-closed content types treat missing `partnerResearch` pages + missing run ids as gaps (already largely true).
   - Ensure SoftDisabled / empty Pages cannot satisfy partner-required types.

### Docs

5. Link this plan from [plans/README.md](README.md).
6. One-line cross-ref in [partner-extraction.md](partner-extraction.md) and [competitor-analysis.md](competitor-analysis.md): library-only; no seed-HTML fallback.
7. Optional master-plan honesty bullet if Jeff wants it in §7 tracker.

### Out of scope (call out, do not sneak in)

- Changing what chunk **fields** are extracted into citable/ad/comparison assets (see partner-extraction plan).
- Reintroducing Markdown backfill in Geek-Crawler-Rag.
- Multi-run ID work (already separate; this plan assumes run ids are bound, then each seed must library-resolve).

---

## Done when

- External partner/competitor resolve never returns `retrievalMode: seed_html`.
- No code path from Create research merge to Mongo HTML extract for those seeds.
- Unit tests lock the fail-closed cases.
- Operator-facing copy no longer promises seed-page fallback.
- Jeff smoke: Create with partner URL whose crawl exists but index is empty/building → job/gap fails closed; with indexed corpus → `rag_chunk` pages only.

# The node survives ingestion and dies at serialization

## What this is about

Geek-Crawler-Rag preserves structure carefully. Seven typed block kinds go in, parent/child chunks
come out, and every node carries `qualityScore`, `sectionTitle`, `chunkRole`, `anchors`,
`parentText`, `childText`, `entityName`, `category`, `contentIntent`.

Then GeekAPI flattens all of it into `GccQuoteablePage(Url, Title, Headings[], Paragraphs[])` and
renders a bare list under a page title. Every piece of metadata the indexer computed is dropped at
that boundary, and the per-page cap decides what survives by **position on the page**.

Jeff, 2026-09-23, on why generated pages read as generic even with grounding: *"Even with RAG it
still does not act like human"*, *"This is really no better than me asking Google or ChatGPT"*.

The four breakdowns below were identified against the live code, not inferred from a checklist. A
generic "why is my RAG ignoring the site" list names chunking, embeddings, top-k and
lost-in-the-middle; none of those is the problem here.

## 1. Truncation by position, not quality — DONE

`HttpGeekCrawlerRagClient` sorted a page's chunks by `ChunkIndex` and took the first
`MaxParagraphsPerPage`. Top-of-page content therefore always survived: navigation, language
selectors, hero taglines, cookie notices. The dense blocks further down were evicted by position,
which silently undid the quality scoring done at index time.

Fixed: chunks are now ordered by `QualityScore`, then by retrieval `Score` as a tiebreak, capped,
and only then restored to `ChunkIndex` order so the prompt still reads in page order.

`QualityScore` had to be added to GeekAPI's `ChunkDto` — Geek-Crawler-Rag returns it on every hit
and this side never read it.

## 2. Parent/child collapse — DONE

`llama_nodes.py` emits parent and child nodes and carries **both** texts in metadata
(`parentText`, `childText`) precisely so a matched child can be expanded to its parent without a
second fetch. Nothing on the GeekAPI side does that, so a retrieved child reaches the writer as an
isolated fragment.

The fix could not be written in C# at all, because **`ChunkHit` did not return those fields**. They
were in the Qdrant payload and unexposed by the search API — which is why this looked like a C#
problem and was not one.

`Geek-Crawler-Rag/src/geek_crawler_rag/models.py`, `ChunkHit` currently returns:

> `pointId · chunkId · runId · crawlType · host · url · finalUrl · title · chunkIndex · language ·
> text · score · pageId · entityName · entityId · sourceType · category · contentIntent ·
> chunkRole · sectionTitle · qualityScore · denseScore · rerankScore · lexicalScore · sourceDigest ·
> parserId · parserVersion · chunkerId · chunkerVersion · embeddingModel · retrievalPolicyVersion ·
> rank`

Needed: `parentText`, `childText`, `anchors`. `chunkRole` already comes back and is a cleaner
parent/child signal than inferring from the presence of `childText`.

Done in three steps:

1. `parentText`, `childText`, `anchors` added to `ChunkHit` and populated from the payload in
   `query.py` (Geek-Crawler-Rag `890a8f3`).
2. `ParentText`, `ChildText`, `Anchors`, `ChunkRole` added to GeekAPI's `ChunkDto`.
3. `RenderChunk` wraps a child in its parent when `chunkRole` is the child role (GeekBackend
   `f93498c`).

**Geek-Crawler-Rag must be deployed for 2 and 3 to do anything** — the C# side reads fields the live
Python service does not yet return, and degrades to the old behaviour until it does.

## 3. Structure is dropped from the rendered block — DONE

`BuildResearchBlock` rendered a page as a title, a URL and a flat list of paragraphs. `sectionTitle`
was carried on `GccQuoteablePage` and never printed; `anchors` never arrived at all.

Fixed in `f93498c`: a chunk renders as its section, its parent context when it is a child, the
specific detail, and the products that section links to — capped at eight anchors, because which
products a section links to is worth a few lines and a navigation menu is not.

This is the same structural loss a LlamaIndex `SimpleWebPageReader` would have caused at ingest —
just deferred to the last hop instead. The crawler's heading levels and anchors are what make
heading-level site matching and anchor-based tool detection possible, and the writer never sees any
of it.

Target shape for a rendered page:

```
[Page title](https://www.medius.com/…) — retrieved from the crawl index

Section: AP Automation
- Context: Simplify AP by getting rid of paper and eliminating manual tasks…
  Specific detail: Get full visibility into invoices, spend, and cash flow…
```

## 4. `minQuality` is never passed — DONE

`build_metadata_filters` accepts `min_quality` and the Content Creator retrieval path does not set
it. So boilerplate is filtered out only by the cap in item 1, after it has already been retrieved
and has already consumed a top-k slot.

Passing a floor at retrieval is strictly better than discarding at serialization: it frees slots for
real content rather than spending them on a cookie banner and then dropping it.

Fixed in `71a6fdd`: `GccPartnerResearchCaps.MinChunkQuality = 0.55`, sent on every query. Permissive
on purpose — it drops navigation, cookie notices and footer fragments rather than second-guessing
what is interesting, and a retrieval that returns nothing is worse than one that returns something
plain.

## Correction: retrieval is already hybrid

An earlier version of this plan said retrieval was dense-only, on the strength of
`QdrantVectorStore(..., enable_hybrid=False)` in `llama_engine.py`. That was wrong, and a plan to
re-embed 168,391 points into a sparse-capable collection was written on top of it. Deleted.

`/v1/query` does not use `llama_engine.aquery`. It routes to `QueryService.query` (`app.py:328`),
which already runs three channels and fuses them:

```python
dense_nodes  = ...                                    # LlamaIndex dense
lexical_hits = await self._store.search_text(...)     # Qdrant text search
bm25_order   = bm25_rank_indices(request.need, docs_for_bm25)
fused        = reciprocal_rank_fusion([dense_ids, bm25_ids, lexical_ids])
```

`bm25_rank.py` and `rrf.py` are real modules. `enable_hybrid=False` governs only whether that one
vector-store object does its own fusion; fusion happens a layer above it, deliberately.

The thing that made this hard to see from the outside: `lexical_score=None` is hardcoded at
`query.py:235`. The lexical channel runs and its score is never reported, so "is BM25 running?"
cannot be answered by reading a response. Reporting it is the small, honest fix.

## What is deliberately not here

No change to chunking, embeddings or the corpus format. The ingestion side is doing the right thing;
the loss is entirely in the last hop, and every fix above is either in GeekAPI's mapper or in what
`ChunkHit` chooses to return.

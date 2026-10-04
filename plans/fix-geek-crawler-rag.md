# Fix Content Creator — Geek-Crawler-Rag

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for Geek-Crawler-Rag: its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D1 | Repeated chunk text: collapse at **index time** (one point per distinct text per run) or at query time. | Index time. One rule for every consumer; query-time would need it in two retrieval paths that work differently. | R1 |
| D4 | Quote verification: a **Library route** GeekAPI calls, or the existing C# substring comparison. | Library route. Two implementations of "is this quote on the page" will disagree on whitespace and punctuation; the quote guard already paid for that. | R4, A1 |
| D15 | Lexical retrieval: today it is a Qdrant scroll in id order with synthetic scores, not a ranked search. Rank it, or drop it from fusion. | Rank it over a run-scoped candidate set, with the collapse before the pool cut. Measure after R1 before building. | R2 |

## Audit — Geek-Crawler-Rag

| Id | Finding | Where |
|---|---|---|
| F-R1 | **Identical chunk text on different pages of one run is one point per page**, same vector, distinct id. Nothing collapses them at index time. The engine's own docstring says one footer CTA is 270 points. There is no `textDigest` field. | `llama_engine.py:238-239`, `:288-289`; `qdrant_store.py:26-27` |
| F-R2 | **Retrieval fills with copies before it de-duplicates.** Dense list capped at `max(topK*2, 30)`; lexical at 30; BM25 runs over only that merged set; RRF ranks it; the pool is cut to `max(topK*2, 40)`; then `seen_text` collapses copies to one, with no refetch. Ramp returned 1 passage from 33,728 chunks. | `query.py:115-179`, `:352-387` |
| F-R3 | **The "keyword" search is a Qdrant scroll in id order with synthetic scores**, not a ranked search. Text payload indexes are deliberately dropped. | `qdrant_store.py:751-817`, `:279-297` |
| F-R4 | **There is no verification route.** `quote_in_text` is called only by diagnostics over caller-supplied documents. `GET /v1/pages/{id}` returns text only. The verify digest (`sha256(page text)`) and the point digest (`sha256(contentHtml or html)`) are two definitions. | `citation_verify.py:19-42`, `:71`; `diagnostics.py:546-570`; `llama_nodes.py:73-75`; `app.py:597-659` |
| F-R5 | `POST /v1/index` does not check `ContentReadyAt`; only the deprecated scheduler does. README says the scheduler is off; `config.py` and the compose file default it on. | `indexer.py:602-607`; `config.py:131`; `deploy/hostinger-compose.yml:50`; `README.md:202-210` |
| F-R6 | The job queue is in-process; a redeploy loses in-flight jobs and nothing reclaims them. README claims lease recovery does; the docs say it does not. | `indexer.py:99-105`; `docs/index-job-recovery-after-restart.md:10-25`; `README.md:361-363` |
| F-R7 | Cohere rerank is disabled in production (no key), so ranking is RRF alone. | `rerank.py:51-53`; compose has no `COHERE_API_KEY` |
| F-R8 | No test covers the same text across page ids, or a pool flooded with copies. | `tests/test_query.py` |
| F-R9 | README drift: upsert delay, memory, tokenizer, embed retry all disagree with code. | `README.md:241`, `:334`, `:246-248`, `:260-263` |

Confirmed sound: Library-only (no `/v1/generate` route; a test asserts it is not advertised); one
block→text projection used for chunking, page text and verification; `grep -ri markdown` finds one
hit, in `architecture.md`, saying it is forbidden.

---

## The work — Geek-Crawler-Rag

**R1 — A repeated text is indexed once per run.** (F-R1; D1)
- Change: at index time, within a run, a chunk whose embedded text was already emitted by an earlier
  page of the run is not emitted again. Key: SHA-256 of the exact embedded string, stored on the
  point as `textDigest` so a resumed run rebuilds its set from points already written. The index
  status reports chunks skipped as repeats.
- Files: `llama_engine.py` (`embed_and_upsert`), `llama_nodes.py` (payload), `indexer.py` (status),
  `qdrant_store.py` (resume scan reads `textDigest`).
- Done when: re-indexing the Ramp run drops its point count by about 7,000; each of the three keyword
  questions in Jeff's 2026-10-04 table returns at least 10 passages from at least 10 pages; the two
  claim questions that returned one passage return more than one.
- Depends on: nothing. Constraint: a push deploys and recreates the container; not while indexing runs.

**R2 — Lexical retrieval is ranked.** (F-R3; D15)
- Change: replace the id-order scroll with a run-scoped candidate fetch (`MatchText`, larger limit)
  ranked by the existing in-process BM25, so the lexical list is a relevance list before fusion.
- Done when: a keyword that appears on 50 pages of a run returns the pages where it is densest, not
  the 30 lowest ids. A test pins it.
- Depends on: R1, and a measurement after R1 of what Ramp returns before deciding the limit.

**R3 — Collapse before the cut, and measure near-copies.** (F-R2)
- Change: run the text collapse before the pool is cut to 40, and backfill from the fetched lists.
  Then measure whether templated near-copies (same paragraph, merchant name swapped) still fill the
  first 32; if so, that is a second problem with the measure already stated (60% of 4-word phrases on
  30% of sibling pages) and gets its own stage. Do not build it on speculation.
- Depends on: R1.

**R4 — A verification route.** (F-R4; D4)
- Change: `POST /v1/verify` taking `runId`, `pageId`, `quote` (and a list form), answering with
  `found`, and the one normalisation `quote_in_text` already applies. One digest definition: the
  page's `sourceDigest` is `sha256(contentHtml)` everywhere, and `verify_citations` uses the same.
- Done when: GeekAPI's verify pass (A1) calls it and has no comparison of its own; a quote with a
  curly apostrophe against a page with a straight one is answered the same way in both places because
  there is only one place.
- Depends on: nothing.

**R5 — Readiness is fail-closed.** (F-R5, F-R6)
- Change: `POST /v1/index` refuses a run without `ContentReadyAt`; the scheduler default matches the
  README (off); restart behaviour is documented once, correctly, and the README's recovery claim is
  removed or made true.
- Depends on: nothing.

**R6 — Tests.** Same text across page ids; a flooded pool; the verify route; the ranked lexical list.

**R7 — README drift** (F-R9): four corrections.

---

## Verification

- **Geek-Crawler-Rag:** `uv run pytest` green; `/health` ok after deploy; the Ramp re-index numbers in

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | C6 (after D16) | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

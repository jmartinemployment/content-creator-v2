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

## Status, 2026-10-04 evening — what is built, and where it departs from the stages above

Reported by the session that built it, checked against the plan. Read this before the stages: the
stages say what was intended, this says what is true.

**Built as specified.** R1: `textDigest` on every point, the index-time collapse, the skipped-repeat
count in the index status. Met on Ramp. R4: a verify route exists. R5: `POST /v1/index` refuses a run
without `ContentReadyAt`, and the scheduler's entrance is gated the same way.

**Departures that stand, by Jeff's direction during the build.**
- There is no resume. Every index attempt deletes the run's points first and writes the run whole.
  The "resumed run rebuilds its set from points already written" clause of R1 is withdrawn.
  **Consequence to respect:** a redeploy or kill mid-index leaves that run with no points until it
  is posted again, and nothing re-posts it. R5 therefore also means: no push to this repo while a
  job is running, and the index status is checked before any deploy.
- The hybrid on/off setting is removed.
- The webhook contract changed with the skip count, so GeekBackend `1c553fc` carries the contract
  copy and the DTO. A contract change is committed on both sides together; that is not a scope
  violation, it is what a contract is.

**Departures that are defects, to fix before R4 is called done.**
1. **Two digest definitions remain.** The route returns `sourceDigest` as `sha256(contentHtml)`
   falling back to `html`; `verify_citations` still hashes the page text. R4 said one definition.
   Until it is one, GeekAPI's A1 must treat the route's `found` as the verdict and never compare
   digests itself.
2. **Quote normalisation is unchanged** (whitespace and case only), so the curly-apostrophe
   done-when is not met. This matters more than it looks: GeekAPI cuts quote candidates from blocks
   in C# (`GccCorpusBlockMapper`) and the Library projects blocks to text in Python
   (`block_text.py`). Those are two implementations of block→text, the exact drift AGENTS.md
   forbids. A1 will send the C# string to the Python check. Either the two projections are proven
   identical by a test that runs the same blocks through both, or the route normalises the
   characters that differ. **New finding F-R10**, owned here.
3. **`verify_citations` and the route disagree** on what a verified quote is, and only the route is
   what A1 will call. Either `verify_citations` calls the same function or it is deleted.

**Departures recorded, no action.**
- The route takes only the list form; one quote is a list of one. Fine. It also returns `reason`
  and `sourceDigest`. Fine.
- Both page-read routes share the new route's refusal helper. Fine.
- Part of R6 (tests for R1, R4, R5) was written early. The flooded-pool and ranked-keyword tests
  are not written and are still R6.
- One README line from R7 was changed early. Fine.
- The scheduler defaults off in the repo; **production still has it on**. That is an operations
  change on the VPS compose, Jeff's to make.

**Violations, recorded so they are not repeated.**
- A re-index of all 62 runs was queued. Jeff killed it; 6 ran, 56 never started. The rule is in R1:
  Ramp first, alone; then only runs a saved project declares, one at a time. The 6 that ran, each
  `complete`, attempt 2, finished 14:25–14:26 UTC, and each deleted and rewritten whole (every
  point carries `textDigest`; point count equals `chunksUpserted`, checked in Qdrant):

  | Run | Site | Crawl type | Points | Repeats skipped |
  |---|---|---|---|---|
  | `c60dc645-d9cc-4287-8372-d5783373ac3d` | airbase.com | partner | 4 | 0 |
  | `d880fb46-e36a-4411-96c0-dbdfa7f3b751` | fnshiftsolutions.com | competitors | 492 | 11 |
  | `44ba341c-5be1-405d-b748-79c6a6934c16` | lightyear.cloud | partner | 346 | 24 |
  | `324af3f2-9ada-4f34-a186-16563dfc04d2` | highnote.com | competitors | 772 | 35 |
  | `dbd75d19-ad75-4ee8-b5b7-7f5a665faa65` | dost.io | competitors | 914 | 386 |
  | `67ac7054-5be3-473c-91ba-30095ffea909` | invoiced.com | partner | 1,136 | 521 |

  These 6 and Ramp have collapsed points; the other 56 do not. Nothing else is re-indexed except
  by R1's rule.
- Wave 2 measurements (R2's keyword list, R3's near-copies) were run before Wave 1's proof. They
  are read-only, so nothing broke, but every measurement before the last sent the bare keyword
  rather than the question GeekAPI sends (`GccGroundingResolver.BuildNeed`). Only the last run's
  numbers count. The question text is the plan's, not the session's: copy it from `BuildNeed`.

**Recommendation received, decision made.** The session recommends deleting the keyword scroll
list from fusion rather than ranking it. The dense list is already LlamaIndex's dense-plus-sparse
hybrid (F-R2), so the scroll is a third signal and today an unranked one. Jeff deferred the decision; it is made: delete it (D15 in the overview, R2 below). The measurement
after deletion is the check that nothing regressed, not the decider.

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
- **Which runs get re-indexed, and how.** Existing runs keep their duplicate points until re-indexed.
  The order is: the Ramp run first, alone, as the measurement above. Then only the runs that a
  saved project declares as a partner or competitor, one at a time, through `POST /v1/index`, each
  one checked at `GET /v1/index/{run_id}` before the next is posted. Never the whole corpus, never the
  `requeue-stranded.sh` cron, never several at once: the queue is in-process, a redeploy kills the
  job in flight (F-R6), and a run that failed mid-index is a run the writer cannot use until it is
  posted again. Runs no project declares are left as they are until a project declares them.

**R2 — The keyword scroll list is deleted.** (F-R3; D15, decided 2026-10-04)
- Change: remove `search_text` from the query path and the lexical list from fusion, so the
  candidates are the dense-plus-sparse hybrid list alone, with the in-process BM25 re-rank over it
  kept. Delete the scroll, its synthetic scores, and `hybrid_lexical_limit`.
- Done when: after the deletion, on the re-indexed Ramp run, the three keyword questions and the two
  claim questions return at least as many distinct pages as before it. If any returns fewer, that is
  reported with the numbers before anything is put back; nothing is put back without them.
- Depends on: R1.

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
  R1; the two claim questions answered from Melio product pages after R2/R3.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / a third declared partner | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

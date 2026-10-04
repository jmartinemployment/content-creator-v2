# Fix Content Creator — GeekRepository

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for GeekRepository: its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D10 | Persist the evidence behind every version (prompts, passages, candidate list, extraction digest, readiness). | Yes, in Postgres through GeekRepository, one row per version. Every diagnosis this week was archaeology on a 60-character excerpt. | A10, D2 |

## Audit — GeekRepository

| Id | Finding | Where |
|---|---|---|
| F-D1 | **`brief_json` and `research_json` are replaced whole, last writer wins, no concurrency token.** The brief save and generation both PATCH the same endpoint. | `GccCreateRepository.cs:126-150` |
| F-D2 | No table links a version to its evidence, and no table holds generate jobs. `metadata_json` carries `{generatedByProvider}` only. | `ContentCreatorDbContext.cs:73-84` |
| F-D3 | Schema and access are correct: every Content Creator table is in `content_creator`; every controller is behind `InternalServicePolicy`; migrations apply at startup. The new bank table follows the same shape. | `ContentCreatorDbContext.cs:31-103`; `Program.cs:231-245` |

---

## The work — GeekRepository

**D1 — `research_json` has one writer.** (F-D1) The brief PATCH writes `brief_json` and `topic`
only. Generation never writes `research_json` back (it resolves grounding in memory, see F-A11 and
A10 for where that goes). `gcc_creates` gets a concurrency token (`RowVersion`), and a stale write
is refused, not silently overwritten.

**D2 — Two tables and their endpoints.** (D10, D11) `gcc_version_evidence` (one row per version,
columns per A10) and `gcc_generate_jobs` (per A11), in `content_creator`, with migrations, snapshot,
repositories, controllers behind `InternalServicePolicy`, and client methods in `HttpGccRepository`.

**D3 — `metadata_json` carries provenance.** (A13) Provider, model id, extractor version, bank
digests.

**D4 — A test that pins the rule.** Every Content Creator table is in `content_creator`; every
controller is behind `InternalServicePolicy`; no other project references `ContentCreatorDbContext`.

---

## Verification

- **GeekRepository:** migrations apply on a fresh database and on the live one; D4's rule test green.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | C6 (after D16) | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

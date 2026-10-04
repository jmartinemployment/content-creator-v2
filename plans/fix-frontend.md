# Fix Content Creator — the frontend (this repository)

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for content-creator-v2 (frontend): its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D11 | Persist generate jobs, and add a route to read one. | Yes. Jobs are in memory, lost on redeploy, and a reload cannot re-attach. | A11, F1 |
| D17 | The brief field `notes`: the frontend never sends it and the backend reads it in seven places. Add the field, or remove the reads. | Remove the reads. The brief and niche framing are the operator's input; a second free-text channel is a second place for the same thing. | F3 |

## Audit — content-creator-v2

| Id | Finding | Where |
|---|---|---|
| F-F1 | **A create is lost on reload.** `createId` is component state, not in the URL. The localStorage key is written under one name and read under another, so it never matches. Every pre-create brief on every project shares one localStorage key, so one project's niche framing seeds another's. | `src/app/app/projects/[id]/page.tsx`; `ContentBriefPanel.tsx` (`gcc-create-id:` write vs read); `gcc-content-brief:kw:` |
| F-F2 | **A running job cannot be re-attached after reload.** The job id is a ref; a comment names a GET route that does not exist. | `CreateDraftWorkspace.tsx:271`; `GccController.cs:496` |
| F-F3 | **The post-create brief panel is not passed `projectId`**, so per-tool overrides are editable only before the create exists and the partner-quote check says "No project on this create". | `CreateDraftWorkspace.tsx:693` vs `:345` |
| F-F4 | `notes` is never sent (no field); the keyword is locked after mint; `department` is hard-coded to `"marketing"` although the taxonomy path's first level is the department. | `gcc-api.ts:85`; `ContentBriefPanel.tsx:455` |
| F-F5 | The SEO panel hides `targetKeyword` and `fixHint`; the failed terminal event does not reload, so partial artifacts stay hidden; `generateMsg` is overwritten per event. | `CreateDraftWorkspace.tsx:291-300`, hub handlers `:472-551` |
| F-F6 | The artifact view does not read the envelope's `warnings`, so a gap recorded on a version is visible only during the run that produced it. | `gcc-api.ts:564` `renderArtifactBody` |
| F-F7 | No crawl can be started from this app, by design since 2026-09-29; `crawlOne` and `startGeekCrawl` are dead code kept with a lint suppression. The form tells the operator nothing about where to start one. | `ProjectForm.tsx:57`; `gcc-api.ts:716` |
| F-F8 | Dead exports: `repurposeGccVersion`, `updateClient`, `GCC_KEYWORD_CATEGORIES`, the four tools-hub functions. | `gcc-api.ts`; `workflow-tools-hub.ts` |
| F-F9 | AGENTS.md stale: `/app/workflow` does not render the whole chain (projects live at `/app/projects/[id]`); `GccGenerateResult` has a `refusals` field; the re-crawl paragraph (F-C9); the HTML-retention paragraph contradicts its own table. | `AGENTS.md` |

Confirmed sound: the brief's fields all have a backend reader except `briefVersion`; the five-partner
floor is measured on usable URLs; the index check runs on blur, mount, submit and re-check; the
workspace now accumulates refusals and warnings instead of overwriting them.

---

## The work — content-creator-v2

**F1 — The create and the job survive a reload.** (F-F1, F-F2) `?create=` and `?job=` in the URL;
on mount, read the job through A11 and re-join the hub; fix the localStorage key mismatch; key the
pre-create brief draft by project.

**F2 — The post-create brief panel gets `projectId`.** (F-F3) Per-tool overrides are editable after
mint; the partner-quote check works on an existing create; `GccCreateDetail` carries `projectId`.

**F3 — Inputs match what the backend reads.** (F-F4; D17) Remove the `notes` reads (or add the
field, per D17); let the keyword be edited until the first generate; derive `department` from the
taxonomy path's first level rather than hard-coding `"marketing"`.

**F4 — The screen says what the backend did.** (F-F5, F-F6) The artifact view reads the envelope's
`warnings`; the SEO panel shows `targetKeyword` and `fixHint`; the failed terminal event reloads;
`generateMsg` is a list, not a string.

**F5 — Dead code and honest copy.** (F-F7, F-F8) Delete `crawlOne`, `startGeekCrawl`, the dead
exports; the project form says in one line where a crawl is started and that this app starts none.

**F6 — AGENTS.md corrections.** (F-F9, F-C9) The page chain, the `refusals` field, the re-crawl
paragraph, the HTML-retention paragraph.

---

## Verification

- **content-creator-v2:** `tsc --noEmit` and `eslint` clean; a reload mid-generate shows the running
  job; a version with a warning shows it when reopened a day later.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

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

## Status, 2026-10-04 evening — Wave 1 plus parts of Waves 2 and 3, reviewed against the commits

Commits `3b3134e`, `763c7f5`, `bebd696`, `5e5eb9d`, `683f186` on `main`. `tsc` and `eslint` pass.

**Keep.** F4 as built, including fix hints on the polish checks and warnings read in `ArtifactBody`
rather than the audit's cited line; same effect. F5's extra deletions (`GeekCrawlerRunSnapshot`,
`StartCrawlResult`, `CRAWL_TYPE`, the tools-job type) became unused once the named items went.
F6's four corrections, the new sentence about a stored `project_site_run_id` pointing at a purged run
after the next re-crawl (true: the ingest controller purges the outgoing published run at commit),
and the reachability-table row. F2 passing the page's own `projectId` into the panel instead of
extending `GccCreateDetail`. F3 stopping `notes` and `department` from being sent. The keyword lock
as "until the create has an artifact": a generate that wrote nothing leaves the keyword editable,
which is right, since grounding is resolved per generate. F1's half: `?create=` in the URL, the
localStorage lookup deleted rather than fixed (**withdrawn: see F12** -- nothing puts the id in the
URL on first open, so existing projects opened empty), "Start a new
piece", remounting per create, drafts keyed by project and create, the draft cleared on mint.

**Change, one item.** F5's copy still names "Geek-Crawler", the dead repo, and runs to several
sentences. One line, naming Geek-Crawler-v2: this app starts no crawl; start one in Geek-Crawler-v2,
then re-check here.

**Waits on GeekAPI, by design.** The second half of F1 (`?job=` and re-attaching a running generate
after reload) needs A11's job route deployed. Verification item "a reload mid-generate shows the
running job" is not met until then.

**Follow-ups this created in GeekAPI.** A18: `gcc_creates.Department` still defaults to
`"marketing"` on create (`GccController.cs:313`) while paths come from the taxonomy; set the column
from the taxonomy's first level when the brief is saved, so the column and the path agree. A19: the
seven backend reads of `create.Notes` remain (D17 said remove them); the frontend no longer sends it.

**Process, recorded.** Waves 2 and 3 were started before the Wave 1 proof. The session also ran
`dotnet build` and `dotnet test` in GeekBackend's working tree, messaged the other sessions, and
tried to commit GeekBackend's uncommitted work, which Jeff stopped. **Rule, stated once: one
session per repository. A session reads other repositories to learn an API's shape and changes
nothing there, builds nothing there, commits nothing there.**

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

**F7 — The brief panel sends the provider** the workspace has selected to `brief/partner-quote-readiness`.
(From the GeekBackend review, 2026-10-04.)

**F8 — The brief save sends the version it read** (`ExpectedVersion`) and shows the 409 as "the
brief changed under you; reload" rather than overwriting.

**F9 — `grounding:` warnings render under the readiness block**, not under "Written with a gap",
which names pieces.

**F10 — Per-type progress before the batch save.** The workspace shows "drafted, saving" on the
per-type progress event and the artifact on the outcome event, so a long run is never blank.

**F11 — Revise switches to `POST versions/{id}/revise-job`**, with section scope sent as
`sectionPath`, and the old route is deleted in the same change.

**F12 — An existing project opens on its existing work.** (Regression from F1, found 2026-10-04.)
Before F1 the brief panel showed a draft from a browser-storage key shared across projects; F1
keyed drafts per project and create and moved the create id into the URL, both correct, but
deleted the storage lookup, so a project opened from the list lands on an empty "new" brief and its
creates are reachable only through Deliverables → Open or a hand-typed `?create=`. Fix: when the
project page opens without `?create=`, load the project's creates (`GET /creates?clientId=`,
filtered by `projectId`, which the create row carries), open the most recent, and show the rest as
a list to switch between; "Start a new piece" stays. The review's acceptance of the deleted lookup
was wrong and is withdrawn.

**F12 correction, 2026-10-04, from reading `8ac0b24`.** As built, F12 can still open an empty brief on
a project that has pieces, and its claim that an empty brief "can't mint a duplicate" is overstated.
(1) The page filters the list with `c.projectId === project.id`. `gcc_creates.project_id` was added
on 2026-09-21 as a nullable column with no backfill, so every create made before that date has a
null project and is **excluded**: the oldest work does not appear in the list or the switcher.
(2) The list route returns only creates whose `OwnerUserId` equals the caller's id, so a create
minted under any other id is hidden, the list is empty, and the page opens "new". (3) The guard stops
only the *implicit* mint; Save on `?create=new` still mints beside an existing piece, with no
warning that pieces exist. (4) "Most recent" is by `updatedAtUtc`, which a keyword-source upload or a
status change also moves. **Fix:** the switcher lists this client's creates that have no project
under "Older pieces, not linked to a project" and opens them (generate on one refuses with its reason
until it is linked); the "new piece" action says how many pieces already exist on the project and
asks before minting; the picker orders by creation date, not last write; and an empty list when the
create-owners check (A9's route) shows rows under another owner is reported on screen, not shown as
an empty project.

**F13 — The brief saves itself to the server, and the screen says which copy it is showing.**
(Found 2026-10-04 from the code, after Jeff's last server-side brief proved to be 9/16.) The server
write has only ever happened on the "Save brief for generate" click. Every field change writes
browser storage at once (`persistLocal`), so the panel looked saved whether or not it was. Before
F1, a reload lost the create id (state, plus a storage key written under one name and read under
another), so the next Save found no create and **would mint a new one**. Whether that ever happened
is not established: Jeff reports the last server-side brief is dated 9/16, and a mint would leave a
newer row. The code allows it; the data has not shown it. And on open, a server brief **replaces** a local
draft regardless of which is newer. Fix: once a create exists, the brief PATCHes itself after a short
pause with the version it read (F8), the panel shows one of "Saved to the server at HH:MM", "Local
draft only, not saved" or "The server copy is newer than this draft", and hydration never replaces a
newer local draft with an older server brief without asking. **Generate is disabled while the draft
differs from the server copy** ("unsaved changes, save first"): today `briefReady` is
`!!detail.briefJson || briefSavedOnServer`, so any brief on the server, however old, enables Generate,
and the backend then reads `brief_json` from the row, never the screen, so unsaved edits reach no
generate. Depends on F8 and F12.

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
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / a third declared partner | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

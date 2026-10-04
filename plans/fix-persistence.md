# Save everything to the database

**Written 2026-10-04. Status: for review. Nothing here is built.**

**Jeff, 2026-10-04: "I am not running a create till that is fixed."** So this plan runs before the
Wave 1 proof in `fix-overview.md`. No Generate is run until Wave P0 below is deployed and verified.

Grounded in the code at GeekBackend `db918bb` and content-creator-v2 `128b2d4`, read 2026-10-04.
Jeff deferred decisions of this kind to the recommendations on 2026-10-04, so the decisions in
Section 2 stand unless he reopens one by number.

## The rule

**The database holds every input the operator types and every output the system produces.** Browser
storage and server memory are caches for speed and crash recovery, never the only copy. A screen never
shows something the database does not hold without saying so on the screen. Content Creator data goes
GeekAPI → GeekRepository → Supabase, schema `content_creator`, and nowhere else.

## 1. What is saved today, from the code

| Data | Where it lives now | The gap |
|---|---|---|
| Brief: every field, niche framing, per-tool overrides, PAA, writing notes | Browser storage on every change (`persistLocal`); the server **only when "Save brief for generate" is clicked** | A screen full of text with a stale or empty database row behind it |
| Brief that is not complete | Browser only. `handleSaveBrief` returns "Required: …" before any network call | A brief being worked on can never reach the database |
| Topic / keyword | Server at create and on each Save | Same as the brief |
| Which brief a Generate used | Not recorded. The backend reads `brief_json` from the row | No way to say what a given version was written from |
| Raw SERP paste | Nowhere. `serp/parse` parses and returns; the curated fields land in the brief | The original text is gone |
| Uploaded keyword-source files | Parsed form in `research_json`. The raw file is not kept | The original file is gone |
| Project and client fields | Server, on form submit | Sound. Projects soft-delete; client deletion not audited here |
| Output-type and provider choices | Component state | Lost on reload |
| Revise feedback and scope | Component state; not stored with the resulting version | Cannot say why a version differs |
| Generated versions, approvals | Server | Sound |
| Deleting a create | Hard delete of the create, its artifacts, versions and approvals. No frontend call reaches it | One route call is permanent |
| Prompts, responses, evidence, discarded drafts, readiness, jobs | Nowhere, or server memory for six hours | Built uncommitted by the GeekBackend session as A10, A11, D2; see 3.2 |
| SEO and polish reports | Computed on every open | Derived; but the report at approval time is not kept |
| Crawl pages (Mongo), vectors (Qdrant) | Crawl store and Library, by existing design | Derived and rebuildable from Mongo. No stage here |

Browser storage is one key family: `gcc-content-brief:` (per project and create since F1; the old
`kw:` and `draft` keys still hold pre-F1 drafts and are untouched by the new code). Server memory
holds `GccJobStore`, the legacy `ToolsGenerationJobStore`, and the old Workflow module's in-memory
`ProjectStore` and `ClientStore`, none of the last two on the live path (A15 deletes them).

## 2. Decisions

| # | Decision |
|---|---|
| P1 | **Every brief save is kept, append-only.** New table `gcc_create_revisions`. Manual saves always insert; autosaves coalesce into one revision per ten minutes per person. Nothing is ever overwritten without a prior copy. |
| P2 | **Any draft can be saved.** Completeness gates Generate only. The backend already allows it (`ValidateBriefRequired` runs at generate). |
| P3 | **Autosave.** Once a create exists, the brief PATCHes itself two seconds after the last change, with the version it read. The create is minted the moment keyword and content type are both present, once. |
| P4 | **Browser storage stays as a crash buffer only**, one key per create, compared by time with the server on open and never silently overwritten in either direction. |
| P5 | **Raw inputs are kept as received** (SERP paste, uploaded files) in `gcc_inputs`, immutable, with a hash, up to 2 MB each. |
| P6 | **Creates soft-delete.** `deleted_at`, restorable, no automatic purge. |
| P7 | **A version records the brief revision it was generated from**, and the workspace shows it. |
| P8 | **One download per create** containing everything the database holds for it. |
| P9 | The project form is not autosaved. A half-entered project must not exist as a project; the index check is its gate. |
| P10 | Backups are Jeff's to verify. They are in Supabase, not in this repository (Section 6). |

## 3. The work, by project

Stage ids: `SD` GeekRepository, `SA` GeekAPI, `SF` frontend. Geek-Crawler-v2 and Geek-Crawler-Rag hold
derived data only and have no stage here.

### 3.1 GeekRepository

**SD1 — `gcc_create_revisions`.** Columns: `id`, `create_id` (FK, RESTRICT), `kind`
(`manual` | `autosave` | `recovered` | `backfill`), `brief_json` text, `topic` text, `saved_by`,
`saved_at`. Index on `(create_id, saved_at desc)`. Written in the same `SaveChanges` as the
`gcc_creates` update, so the row and its history cannot disagree. The migration inserts one
`backfill` revision per existing create from its current `brief_json`. An autosave coalesces into the
latest revision when that one is also an autosave by the same person within ten minutes.

**SD2 — `gcc_inputs`.** `id`, `create_id` (FK, RESTRICT), `kind` (`serp_paste` | `keyword_source_file`),
`filename`, `content` text, `sha256`, `created_by`, `created_at`; unique on
`(create_id, kind, sha256)` so a re-upload does not duplicate.

**SD3 — Soft delete on creates.** `deleted_at`, `deleted_by`. List and get exclude deleted rows.
`DeleteAsync` sets the columns and removes nothing. A restore route clears them.

**SD4 — Bundle read.** One repository method returning the create, its revisions, inputs, artifacts,
versions and approvals, and the evidence and jobs when D2 lands.

**SD5 — `report_json` on `gcc_approval_events`,** the SEO and polish reports as of the approved
version.

All five in `content_creator`, with migrations and the model snapshot, behind `InternalServicePolicy`.
A test pins the rule: every Content Creator table is in the schema, no other project references the
context.

### 3.2 GeekAPI

**SA1 — The brief route writes a revision.** `PATCH creates/{id}/brief-research` takes
`kind` (`manual` | `autosave`), takes `saved_by` from the token, and returns the revision's id and
time. It accepts an incomplete brief (it already does). The 409 contract from D1 stays.

**SA2 — Raw inputs kept.** The keyword-source upload stores the file text as a `gcc_inputs` row
before it parses. `serp/parse` takes the create id, stores the paste as an input, then returns the
parse.

**SA3 — A version names its brief.** The generate job records the revision id it read, and every
version's `metadata_json` carries it. This is what makes "which brief was this written from"
answerable, and it would have answered the question about 9/16.

**SA4 — Bundle route.** `GET creates/{id}/export/bundle`, JSON, owner-checked once A9 ships.

**SA5 — Revise records itself.** Feedback, scope and `sectionPath` go into the new version's
`metadata_json` (A8's revise route).

**SA6 — Approval snapshots.** On approve, the SEO and polish reports for that version are written to
`report_json`.

**SA7 — Soft delete and restore routes** over SD3, owner-checked.

**Already built, uncommitted, belongs to this guarantee:** A10 (evidence per version), A11 (jobs,
with the output-type and provider choices recorded on the job), A12 (all-or-nothing persist), D2
(`gcc_version_evidence`, `gcc_generate_jobs`). They keep their own wave; the output-type and provider
choices are restored from the latest job, so no new column is needed. A15 deletes the in-memory
legacy stores.

### 3.3 content-creator-v2

**SF1 — Save any draft.** Remove the completeness refusal from the Save path. The "Required: …"
list stays, as the reason Generate is off.

**SF2 — Autosave and mint.** Per P3. The existing URL carries the create id (F1).

**SF3 — The save state is always on screen.** One line: "Saved to the server at 14:32", "Local draft,
not yet saved", or "The server copy is newer than this draft". A warning on leaving the page while
the second state is showing.

**SF4 — Hydration never picks silently.** Server newer than local, or local newer than server, the
operator is shown both times and chooses. This replaces "server brief wins" in `ContentBriefPanel`.

**SF5 — Generate waits on the save** (F13) and shows "Generated from the brief saved at …" from SA3.

**SF6 — Recover from this browser.** Reads every `gcc-content-brief:` key, lists each with its
keyword, size and last-changed time, and offers "Save as a revision on this create" (kind
`recovered`). It never deletes a key. It stays until Jeff says he has what he needs.

**SF7 — Download everything for this create** (SA4).

**SF8 — A test that no operator input is browser-only.** Scans `src` for storage calls and fails on
any key outside `gcc-content-brief:`.

## 4. Order, and the gate

**Wave P0 — before any Generate.** SD1, SD3, SA1, SA3, SA7, SF1, SF2, SF3, SF4, SF5, SF6, with F12
(an existing project opens on its existing work). Nothing else ships ahead of it. Jeff does not run a
create until P0 is deployed and the first three checks in Section 5 pass.

**Wave P1.** SD2, SD4, SD5, SA2, SA4, SA5, SA6, SF7, SF8, and A10/A11/A12/D2/D3 as they stand.

**Today, with no code, before anything else is deployed:** do not clear this browser's site data;
copy the value of every `gcc-content-brief` key out of DevTools → Application → Local Storage; read
`brief_json` on the create's row in Supabase and look for `nicheFraming`.

## 5. Verification

The first three are the P0 gate.

1. Type framing, click nothing, hard-reload: the framing is there and the line says it was saved.
2. Cut the network mid-edit: the line says "Local draft"; restore it: the draft saves and nothing is
   lost.
3. Edit the same create in two tabs: the second save is refused with the 409 text, nothing is
   overwritten, and both revisions are kept.
4. An incomplete brief saves, and Generate is off with the reason shown.
5. A brief edited after the last save disables Generate.
6. After a Generate, the version's `metadata_json` names a brief revision whose `brief_json` contains
   the `nicheFraming` on screen.
7. Delete a create, then restore it: every revision, input, version and approval is back.
8. Upload a keyword file twice: one `gcc_inputs` row holding the file's exact text.
9. The bundle is valid JSON and contains each of the above.
10. Recover: the old `kw:` key's content becomes a `recovered` revision, and the key is still in the
    browser afterwards.

## 6. Not decided here, and not visible from the repository

**Backups.** Which Supabase plan this project is on, whether it keeps daily backups or point-in-time
recovery, and whether a restore has ever been tried, are settings in Supabase. This plan cannot see
them. Check Supabase → Database → Backups, and once the revisions table exists, restore one into a
scratch project to prove it works.

**Client deletion.** `deleteClient` exists and its semantics were not audited here. Check before
relying on it.

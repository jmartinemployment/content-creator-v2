# Save a project to the database

**Written 2026-10-04. Status: for review. Nothing here is built. This replaces `fix-persistence.md`.**

**Jeff, 2026-10-04: the unique key is the Project ID. The project contains the Brief, Generate and
Profile. No "Create" is visible anywhere. No Generate is run until this is deployed.**

Grounded in the code at GeekBackend `db918bb` and content-creator-v2 `05ba040`, and in Jeff's
screenshot of `/app/projects/<id>?section=content&create=<id>`, read 2026-10-04.

## Why the last plan was wrong

`fix-persistence.md` and the frontend work F1, F12, F13 and SF1 to SF6 all took the **create** as the
unit of work: the URL carried `?create=<GUID>`, a picker switched between "pieces", revisions and
inputs were keyed to `create_id`. That table came first. `gcc_creates` is in the initial migration of
2026-08-01, when a create was one content-creation session. Clients arrived 8/08. Projects arrived
**9/21**, and were joined to creates by a nullable `project_id`. The UI then showed both. The
screenshot shows it: the project is named "Accounts Payable: Automated Approval Workflows", the one
"piece" in the dropdown has the same name, and so does the Keyword field. They are one thing.

## The rule

**A project is the unit.** Its Profile, its Brief, every Generate and every draft belong to it and are
addressed by its Project ID alone. The database holds every input the operator types and every output
the system produces. Browser storage is a crash buffer, never the only copy. A screen never shows
something the database does not hold without saying so. Data goes GeekAPI → GeekRepository →
Supabase, schema `content_creator`.

**What the operator sees:** the project's name, and Profile, Brief & Generate, Deliverables, Tasks &
Time, History. **What the operator never sees:** a create, a create id, "pillar" as a property of the
project, "Pieces on this project", "Start a new piece", `?create=` in the URL. The project's **Run ID**
stays on Profile as a labelled field; it is crawl identity and a project field.

## 1. Where each part lives today

| Part of a project | Where it lives now | The gap |
|---|---|---|
| Profile: name, site URL, run id, partner and competitor URLs, dates, status, budget | `gcc_projects`, on form submit | Sound. Soft-deletes already (`DeletedAtUtc`) |
| Brief and keyword | `gcc_creates.brief_json` and `topic`, on a row minted by a Save click; browser storage on every keystroke | The brief is not on the project; the server copy only moves on Save |
| Keyword sources, SERP | `gcc_creates.research_json` (parsed only) | Raw input discarded |
| Site section, run id for generation | `gcc_creates` **and** `gcc_projects`, two copies that can disagree | One source needed |
| Starting content type, length band | `gcc_creates.starting_content_type`, derived into the brief | The project has no single content type; Generate picks several each run |
| Drafts | `gcc_artifacts.create_id` → versions | Keyed to the create |
| Deliverables | `gcc_deliverables.create_id` plus `project_id` | Keyed to the create |
| Generate jobs, evidence | Server memory, six hours; evidence nowhere | Built uncommitted as A10, A11, D2, keyed to the create |
| Authorization | Project and client routes: `ManagePolicy` on the whole controller. Create routes: none | The brief and generate sit on the unprotected routes |

The one fact that makes this tractable: every create made since 9/21 already has a `project_id`, and
the project already holds the site URL, the run id and the partner list the writer grounds on.

## 2. Decisions

| # | Decision |
|---|---|
| J1 | **One project is one keyword and one brief.** A second keyword is a second project. Generate adds versions to the project. |
| J2 | **The brief, keyword and research move onto the project** (`gcc_projects`: `brief_json`, `topic`, `research_json`, `site_section_json`). The project's own `project_site_run_id` is the only run id; the create's copy is dropped. |
| J3 | **Any draft saves.** Completeness gates Generate only; the backend already allows it. |
| J4 | **Autosave.** Two seconds after the last change, with the version the editor read; a stale write is refused with a message, never overwritten. |
| J5 | **Every save is kept.** Append-only `gcc_project_revisions`. Manual saves insert; autosaves coalesce to one per ten minutes per person. |
| J6 | **Generate is `POST projects/{id}/generate`.** The output types are chosen each run. There is no starting content type, and the brief carries no length band: it is derived per output type at generate time. |
| J7 | **A version records the brief revision it was generated from.** The workspace shows "generated from the brief saved at …". |
| J8 | **Authorization is the project's.** Brief, generate, versions and approvals sit under `ManagePolicy`, like Profile. The earlier per-create owner check (D8, A9) is withdrawn. |
| J9 | **Browser storage stays a crash buffer**, one key per project, compared by time with the server on open, never silently overwritten either way. The existing `gcc-content-brief:` drafts are recoverable (SF6 stays, re-keyed). |
| J10 | **Raw inputs are kept as received** (SERP paste, uploaded files) in `gcc_inputs`, immutable, hashed, 2 MB each, keyed by project. |
| J11 | **Existing creates are folded in, never deleted** (the rule in 3.1). Creates with no project are reported to Jeff and left alone. |
| J12 | **Backups are Jeff's to verify.** A Supabase backup is taken before the migration runs and its time is recorded here. |

## 3. The work, by project

Three changes ship in this order, so nothing breaks between deploys: **add** the project routes and
columns beside the create routes; **switch** the frontend; **remove** the create routes and table last.
GeekRepository, GeekAPI and the frontend deploy separately, so a route is never removed before nothing
calls it.

### 3.1 GeekRepository

**GR1 — Columns on the project.** Add `brief_json`, `topic`, `research_json`, `site_section_json` to
`gcc_projects`, and the concurrency token (`xmin`, as D1 did for creates). The project form's PUT must
not touch them: it writes only the Profile columns, and the brief route writes only the brief columns.

**GR2 — `gcc_project_revisions`.** `id`, `project_id` (FK, RESTRICT), `kind`
(`manual` | `autosave` | `recovered` | `backfill`), `brief_json`, `topic`, `saved_by`, `saved_at`;
index on `(project_id, saved_at desc)`. Written in the same `SaveChanges` as the project update.

**GR3 — Backfill, with a report first.** For each create that has a `project_id`:
- A project with one create: its brief, topic, research and site section copy onto the project, and a
  `backfill` revision is written.
- A project with several: the newest create by `created_at` becomes the project's current brief; every
  other create's brief becomes a `backfill` revision carrying its own date. Nothing is merged.
- Every artifact of every one of them is re-parented to the project (GR4).

For each create **with no `project_id`:** untouched, and listed in a report (id, client, topic,
created, updated, artifact count) for Jeff to assign to a project or leave. The report is produced
and read **before** the backfill runs. The migration records row counts before and after, and the two
must match.

**GR4 — Drafts keyed to the project.** Add `gcc_artifacts.project_id`, backfilled from the create; add
`gcc_deliverables.artifact_id` (nullable) in place of `create_id`; `gcc_generate_jobs` and
`gcc_version_evidence` (D2) are keyed `project_id` from the start. The create columns stay until the
remove step.

**GR5 — Inputs.** `gcc_inputs`: `id`, `project_id`, `kind` (`serp_paste` | `keyword_source_file`),
`filename`, `content` text, `sha256`, `created_by`, `created_at`; unique on
`(project_id, kind, sha256)`.

**GR6 — Remove (last).** Drop `gcc_creates`, `create_id` on artifacts and deliverables, and the create
routes, only when the unassigned report is empty, one clean Generate has run on the new keys, and the
backup is confirmed.

All of it in `content_creator`, with migrations and the model snapshot, behind `InternalServicePolicy`.
A test pins the rule.

### 3.2 GeekAPI

**GA1 — Project brief route.** `PATCH projects/{id}/brief` takes `briefJson`, `topic`, `expectedVersion`
and `kind`; writes a revision; returns the new version and revision time; 409 with "This project was
changed after you loaded it" on a stale write. It accepts an incomplete brief. Under `ManagePolicy`.

**GA2 — Generate by project.** `POST projects/{id}/generate` with the output types and provider.
`ValidateBriefRequired` reads the project's brief; `lengthBand` leaves its required list. The run id is
the project's. One running job per project (a partial unique index), so a second Generate is refused by
name. The job records the project and the brief revision id it read (J7).

**GA3 — Everything else re-keyed.** Versions, revise, approve, SEO, polish, the export, the probe and
the keyword-source upload move to `projects/{id}/…`. A9's owner checks are replaced by the policy
(J8). A10 (evidence), A11 (jobs) and A12 (all-or-nothing persist) keep their design and are re-keyed to
the project **before** they are committed.

**GA4 — Raw inputs.** The upload stores the file text as a `gcc_inputs` row before it parses.
`serp/parse` becomes `projects/{id}/serp`, stores the paste, then returns the parse.

**GA5 — Bundle.** `GET projects/{id}/export/bundle`: the project, its revisions, inputs, versions,
approvals, evidence and jobs, as one JSON file.

**GA6 — Remove (last).** The create routes and the create DTO, with GR6.

### 3.3 content-creator-v2

**GF1 — The page is the project.** `/app/projects/<id>?section=…` only. No `create` parameter, no
create id on the screen, no "Pieces on this project", no "Start a new piece". The status row that prints
`pillar`, `No research` and the create id is removed. Sections stay: Brief & Generate, Profile,
Deliverables, Tasks & Time, History.

**GF2 — The brief edits the project directly,** with no mint step. Keyword and brief are one form.
Autosave (J4), the always-visible save state ("Saved to the server at 14:32" / "Local draft, not yet
saved" / "The server copy is newer than this draft"), a warning when leaving with the second state
showing, and hydration that never picks silently between server and local (J9).

**GF3 — Generate waits on the save** and reads "Generated from the brief saved at …" (J7). Output types
and provider are chosen on the page each run.

**GF4 — Recover from this browser** (SF6, re-keyed to the project): lists every `gcc-content-brief:`
key with its keyword and last-changed time, saves one as a `recovered` revision on this project, and
never deletes a key. It stays until Jeff says he has what he needs. **This is the first thing built.**

**GF5 — Remove** the piece switcher (`8ac0b24`), the create-keyed storage keys and
`onCreateMinted`/`openCreate`. Keep the autosave and save-state work from `05ba040`; re-key it to the
project.

**GF6 — A test** that scans `src` for storage calls and fails on any key outside the project crash
buffer, and a test that no rendered page contains a GUID other than the project id and the labelled Run ID.

## 4. Order, and the gate

**P0 — before any Generate:** GF4 first, then GR1, GR2, GR3 (report, backup, backfill), GA1, GF1, GF2,
GF3, and GA2 so Generate reads the project's brief. The old create routes stay live and untouched
until P2.

**P1:** GR4, GR5, GA3, GA4, GA5, and the evidence, jobs and all-or-nothing work from the GeekBackend
session re-keyed.

**P2 (remove):** GR6, GA6, GF5, only when the report is empty and the proof has been read.

**Sessions that are building now are stopped.** Work already pushed keyed on the create (`8ac0b24`,
the create-keyed parts of `05ba040`) is adapted in GF1, GF2 and GF5, not reverted. GeekBackend's
uncommitted work stays uncommitted until it is re-keyed.

## 5. Verification

The first four are the P0 gate.

1. Type the brief and the niche framing, click nothing, hard-reload: everything is there and the line
   says it was saved.
2. Cut the network mid-edit: the line says "Local draft"; restore it: the draft saves and nothing is
   lost.
3. Edit the same project in two tabs: the second save is refused with the 409 text, nothing is
   overwritten, and both revisions are kept.
4. The URL, and the rendered page, contain no create id anywhere. The only identifiers on screen are
   the project's and the labelled Run ID.
5. An incomplete brief saves; Generate is off and says why. A brief edited after the last save disables
   Generate.
6. After a Generate, the version names the brief revision it came from, and that revision contains the
   `nicheFraming` on screen.
7. The backfill: row counts match before and after; every old create's brief is a revision with its
   own date; the unassigned report lists exactly the creates with no project; nothing was deleted.
8. Upload a keyword file twice: one `gcc_inputs` row holding the exact text.
9. The bundle is valid JSON and contains each of the above.
10. Recover: the old `kw:` key's content becomes a `recovered` revision on the project, and the key is
    still in the browser afterwards.

## 6. Not decided here

**Backups.** Which Supabase plan this project is on, what it keeps, and whether a restore has ever
been tried are settings in Supabase that this repository cannot see. Take a backup before GR3 and
record the time here. Once the revisions table exists, restore one into a scratch project to prove it.

**Run ID on Profile.** Kept, as crawl identity. Jeff highlighted it in the screenshot; if it should
also go, say so.

**Client deletion.** Not audited. Check before relying on it.

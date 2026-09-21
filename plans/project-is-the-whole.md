# The Project is a real project

Jeff, 2026-09-21:

> One client can have many projects over time. A project always belongs to one specific client.
> Projects have start, due dates & finish dates. Client records contain contact, & billing data,
> while projects track time, tasks, and deliverables.

That is the definition this plan implements. **None of it exists today.**

Work spans **GeekRepository** (tables, migrations, constraints), **GeekAPI** (contracts, auth,
scoping), **GeekOAuth** (one scope) and **content-creator-v2** (UI). Written here because this repo
is where the absence shows.

**Existing data is not carried forward.** The application is not in production; current project
and client rows are development data. Nothing in this plan migrates, maps or preserves them. The
old project store is deleted, not converted.

## Decisions (resolved 2026-09-21)

1. **Scope name — resolved: `content-creator.manage`.** Follows the one existing custom scope
   (`devices.manage`) and the hyphenation of the registered client id `geek-content-creator-v2`,
   without its version suffix: the scope names the data, not the client. Registered in GeekOAuth
   in Stage 1.
2. **Required client fields — resolved.** `NOT NULL`: `name`, `contact_name`, `contact_email`,
   `billing_email`, `payment_terms_days`, `currency`. Everything else is nullable. `billing_email`
   is required even when it equals the contact email: it is stored, never derived at read time.
   `payment_terms_days` is an integer (`0` = due on receipt) so a due date can be computed;
   free-text terms cannot. `currency` has no database default. `rate` stays nullable on purpose: a
   client with no rate cannot have billable time logged against it (see `gcc_time_entries`), which
   is the correct failure.

## Verified state — 2026-09-21, by direct read of each repo's HEAD

| The definition says | What exists |
|---|---|
| Projects have start, due, finish dates | `Project` has only `CreatedAtUtc`, `UpdatedAtUtc`, `ContentApprovedAtUtc` (`GeekAPI/Services/Workflow/Domain/Entities/Project.cs:126-133`) |
| Projects track **time** | No `TimeEntry`, no hours, no rate anywhere in GeekBackend |
| Projects track **tasks** | No task entity. `GccV2TaskAgentKernel` is an agent runtime, not work items |
| Projects track **deliverables** | No deliverable record. Content is `GccCreate` → `GccArtifact` → `GccArtifactVersion` → `GccApprovalEvent`, owned by the *client*, not a project |
| Clients hold **contact** data | `Client` is `Id`, `Name`, `Notes`, `CreatedAtUtc`, `PublishTarget`. `GccClient` is `Id`, `Name`, `Notes`, timestamps (`Entities.cs:100`) |
| Clients hold **billing** data | Nothing — greps for `TimeEntry`, `Deliverable`, `BillingAddress`, `HourlyRate`, `PaymentTerms` return zero across GeekBackend, geek-admin, GeekContentWorkflow |

What exists instead is an **article** record stored as blobs at
`repo/content-writer-v2/blobs/projects/{id}`. `ProjectsController.Create` dedupes on
`TargetKeyword + ProjectUrl` with no `ClientId` in the predicate (`ProjectsController.cs:57-64`),
so a create can hand back another client's project. `GET /api/projects` runs
`PurgeStaleAsync(24h)` before listing (`ProjectsController.cs:97`, `PersistentProjectStore.cs:80`),
deleting every non-`Completed` project older than a day; `/app/workflow` triggers it on mount
(`src/app/app/workflow/page.tsx:48`). All of it is deleted in Stage 1.

## Storage and access

Every record in this plan (client contact and billing, project, task, time entry, deliverable,
log) is a **row in PostgreSQL**. None of it is a blob, a document, or a process cache acting as the
source of truth.

### The only path to a row

```
content-creator-v2 (browser)
  → PKCE → GeekOAuth                          user access token (with content-creator.manage)
  → Bearer JWT → GeekAPI                      validates issuer, audience and scope
  → X-Repo-Key → GeekRepository               only holder of credentials for these tables
  → ContentCreatorDbContext → Postgres, schema content_creator
```

| Tier | Holds | Never holds |
|---|---|---|
| GeekOAuth | User tokens; the `content-creator.manage` scope | Content, project or billing data |
| GeekAPI | JWT validation, scope check, `REPO_URL`, `REPO_API_KEY` | A connection that can read or write these tables, `DbContext`, migrations |
| GeekRepository | `ContentCreatorDbContext`, migrations, Postgres credentials, the expected `REPO_API_KEY` | Login, token issuance |
| content-creator-v2 | The user's access token | Any database URL, `REPO_URL`, `REPO_API_KEY` |

### Known gaps, named rather than asserted away

**The service credential is a static shared key.** `GeekAPI/Program.cs:83-94` attaches
`X-Repo-Key` from `REPO_API_KEY`. The client-credentials handler
(`Services/Auth/GeekOAuthTokenHandler.cs:70`) is wired to one client only, the image generator
(`Program.cs:199-206`). This plan uses `X-Repo-Key`; moving GeekRepository onto client_credentials
is out of scope. The consequence is stated plainly: every user id GeekRepository records is only as
trustworthy as `REPO_API_KEY` is secret. Anything holding the key can write as any user. Stage 0
makes both ends of the key fail closed.

**GeekAPI opens Postgres connections for `LISTEN`/`NOTIFY`.** `GccV2ContextIngestionWorker.cs:348,372`
and `GccV2JobListenService.cs` open `NpgsqlConnection` directly. Rewriting those workers is out of
scope. Stage 0 moves their connection to a role that can connect and listen but holds no grants on
`content_creator`, which makes the "never holds" column above true for every row this plan creates.

### Who did it

`gcc_time_entries.user_id`, `gcc_tasks.assignee_user_id` and `gcc_project_log.actor_user_id` are
the JWT `sub` (GeekOAuth `asp_net_users.id`). Stored as `text` with **no foreign key**, because
that table lives in the `geek_oauth` database. GeekAPI sets the value from the validated token,
never from the request body. GeekRepository accepts it only on a request carrying a valid
`X-Repo-Key`.

### Authorization

Every route this plan adds or changes requires a valid GeekOAuth token with the correct audience
**and** the `content-creator.manage` scope. A valid token without the scope gets **403**. GeekOAuth
is shared across Geek apps, so audience alone is not enough to reach billing data.

There is one operator today: any holder of the scope sees every client. Per-user client ownership
is out of scope, and nothing below implies it.

### Schema

Generated against `ContentCreatorDbContext` in GeekRepository and applied by GeekRepository at
startup. Default schema `content_creator` (`ContentCreatorDbContext.cs:22`). Table names are plural
to match the live convention (`gcc_creates`, `gcc_clients`, `ContentCreatorDbContext.cs:27,126`).
Columns are snake_case throughout; the mixed casing in `gcc_creates` (`SiteAnalysisId` beside
`brief_json`) is not copied.

Calendar dates use `date`, instants `timestamptz`, money `numeric(12,2)` with a `char(3)`
currency. Money is never a float. Status columns are `text` with a `CHECK` listing their values.
Key columns match the type of `gcc_clients.id`.

**Each table ships in the migration of the stage that first writes it** — no table exists before
something writes to it.

| Table | Stage | Columns (beyond id and timestamps) | Constraints |
|---|---|---|---|
| `gcc_projects` | 1 | client_id **not null**; idempotency_key `uuid` **not null**; name **not null**; code; description; status **not null**; site_url; project_site_run_id; department; partner_urls `text[]`; competitor_urls `text[]`; start_date **not null**; due_date; finished_date; estimated_hours `numeric(8,2)`; budget; budget_currency | FK client **RESTRICT**; unique (idempotency_key); status in (`planned`, `active`, `on_hold`, `finished`, `cancelled`); finished_date set **exactly when** status = `finished`; `due_date >= start_date`; `finished_date >= start_date`; budget and budget_currency both set or both null; unique (client_id, code) where code not null; index (client_id) |
| `gcc_project_log` | 1 | id `bigint identity`; project_id; occurred_at_utc default `now()`; actor_user_id `text` **not null**; event_type **not null**; payload `jsonb` **not null** | FK project RESTRICT; event_type in the list below; index (project_id, occurred_at_utc) |
| `gcc_clients` (altered) | 2 | contact_name, contact_email, contact_phone; billing_contact_name, billing_email; contact and billing address (line1, line2, city, region, postal_code, country); payment_terms_days `int`; rate; currency; tax_id; po_reference | keeps `ix_gcc_clients_name_unique`; `NOT NULL` per Decision 2; `payment_terms_days >= 0`; `rate IS NULL OR rate > 0`; `currency ~ '^[A-Z]{3}$'` |
| `gcc_tasks` | 3 | project_id; name **not null**; description; status **not null**; assignee_user_id `text`; due_date; estimated_hours `numeric(8,2)`; sort_order `int` **not null** | FK project RESTRICT; status in (`todo`, `in_progress`, `done`); unique (id, project_id); index (project_id, sort_order) |
| `gcc_time_entries` | 3 | project_id; task_id (null); user_id `text` **not null**; work_date **not null**; minutes `int` **not null**; description; billable **not null**; rate_snapshot; currency; invoiced_at_utc | FK project RESTRICT; **(task_id, project_id) → gcc_tasks(id, project_id)**, so an entry's task must belong to its project; `minutes > 0`; rate_snapshot and currency not null when billable; index (project_id, work_date) |
| `gcc_deliverables` | 4 | project_id; create_id **not null**; name **not null**; type **not null**; status **not null**; due_date; delivered_at_utc | FK project RESTRICT; FK create → `gcc_creates`; unique (create_id); status in (`planned`, `in_progress`, `delivered`); delivered_at_utc set **exactly when** status = `delivered` |

`gcc_project_log.event_type` grows with the stages that produce events:

| Stage | Event types |
|---|---|
| 1 | `project_created`, `project_updated`, `project_status_changed` |
| 3 | `task_created`, `task_updated`, `task_completed`, `time_logged` |
| 4 | `deliverable_created`, `deliverable_delivered` |

#### Enforced by Postgres, not by code

- **Never truncated.** No table in the schema table above is ever truncated — by application code,
  migration, test or script. The Stage 1 migration creates `content_creator.forbid_truncate()`;
  every table gets a `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger calling it, in the same
  migration that creates or alters the table. A direct `TRUNCATE`, or a `TRUNCATE ... CASCADE`
  that reaches any of them, fails and rolls back. Tests that need a clean slate use a throwaway
  database.
- **Append-only log.** A `BEFORE UPDATE OR DELETE` row trigger on `gcc_project_log` raises.
- **Frozen invoiced time.** A row trigger on `gcc_time_entries` raises on any update or delete of a
  row whose existing `invoiced_at_utc` is not null.
- **Nothing under a project is deleted.** Every child FK is RESTRICT, and a project has a log row
  from its first insert, so a project is never deleted. It is closed through `status`.

#### Enforced by GeekRepository, in the same transaction as the write

- **Idempotent create.** Insert the project; on a unique violation of `idempotency_key`, load the
  existing row. Same `client_id` → return it. Different `client_id` → **409**. A repeat submit of
  one form returns the project that submit created, and can never return another client's.
- **Deliverables stay with their client.** A deliverable's `gcc_creates.client_id` must equal its
  project's `client_id`. A mismatch fails the request.
- **Billable rate comes from the client row.** `rate_snapshot` and `currency` are copied from
  `gcc_clients` inside the insert transaction, never accepted from the caller. A later rate change
  cannot rewrite a logged entry.
- **Every change has its log row.** Every write with an event type above inserts its log row in the
  same transaction. Never a change without its log entry, never a log entry without its change.

#### Types on each side

`GccClient`, `GccProject` and the rest are storage types and exist **only in GeekRepository**. The
Workflow `Client` and `Project` in GeekAPI are rewritten as request/response contracts, and JSON is
the contract between the tiers. Adding a field means changing one table and one contract.

## The work, in order

Five stages. Each ships complete: every table ships with its routes, its UI, its log events and its
verification. No stub, no partial entity, no screen showing a field nothing writes (root
`CLAUDE.md` §3).

### Stage 0 — close the fail-opens

- `GeekAPI/Program.cs:90-94` — refuse to start when `REPO_API_KEY` is empty instead of building an
  unauthenticated GeekRepository client.
- **GeekRepository** — refuse to start when its expected key is empty. Reject any request whose
  `X-Repo-Key` is missing or wrong with **401**, comparing with
  `CryptographicOperations.FixedTimeEquals`. The receiving side is the one that matters: nothing
  forces a caller to go through GeekAPI.
- **The two GeekAPI workers** — first confirm, by reading `GccV2ContextIngestionWorker.cs` and
  `GccV2JobListenService.cs`, that their connection issues nothing but `LISTEN`, `NOTIFY` or
  `pg_notify`. If so, move it to a dedicated role with `CONNECT` only and no grants on
  `content_creator`. If the connection does more, this item is removed and the gap stays named in
  *Known gaps* rather than half-fixed.

### Stage 1 — projects become rows

**Delete the old store.** `PersistentProjectStore`'s project path, `PurgeStaleAsync`,
`StaleProjectMaxAge`, the keyword+URL dedupe, `ProjectsController`, and every write to
`repo/content-writer-v2/blobs/projects`. The Workflow `Project` is rewritten as the `gcc_projects`
contract; its article fields (`TargetKeyword`, `ContentApprovedAtUtc`, the pipeline
`ProjectStatus` values) leave with the old store. Any create flow that read a keyword from a
project takes it as create input instead. Remaining references are found by the build and
`tsc`, not by search.

**GeekRepository.** `GccProject` and `GccProjectLog` entities and mappings; one migration with both
tables, their constraints, `forbid_truncate()`, both no-truncate triggers and the append-only
trigger; a repository following `GccCreateRepository`'s shape; routes beside
`GccCreatesController`.

**GeekOAuth.** Register `content-creator.manage` (Decision 1) and allow it on the
`geek-content-creator-v2` client; content-creator-v2 requests it in its PKCE flow.

**GeekAPI.** Project routes on the v1 surface (`api/geek-content-creator`, `GccController.cs`):
list by client, get, create, update. Scope check on each: `content-creator.manage` must be a member
of the `scope` claim split on spaces, with `MapInboundClaims = false` on the JWT handler. An
exact-match `RequireClaim` fails when the claim arrives as one space-delimited string.
`actor_user_id` set from `sub`. This is the only HTTP surface for projects.

**content-creator-v2.**
- `ProjectForm` becomes a project form: client, name, start date, due date, site URL, partner and
  competitor URLs. `checkHostsIndexed` (`src/services/gcc-api.ts`) is unchanged and still gates on
  a resolved Run ID. The form generates its `idempotency_key` with `crypto.randomUUID()` when it
  opens and navigates to the new project's page on success.
- `/app/workflow` gains the projects list for the selected client, restoring what `bb8955b`
  removed.
- A project page shows profile, schedule and log.
- Correct the `AGENTS.md` section that assigns `projectUrl` / `projectSiteRunId` to the client.
  Per Jeff they are project-profile fields.

The uncommitted change at `src/components/content-writer/ProjectForm.tsx:160` (no longer clearing
the form on success) is superseded: Stage 1 rewrites `handleSubmit`.

### Stage 2 — the client becomes a client record

- **Migration.** Contact and billing columns on `gcc_clients`, `NOT NULL` per Decision 2, and the
  no-truncate trigger. It fails against a database that still holds pre-plan client rows; that
  failure is intended. The dev database is recreated from migrations, not patched.
- **`PublishTarget`** exists only on the Workflow `Client`. Grep for readers: if any exist it
  becomes `gcc_clients.publish_target` in this migration; if none, it is deleted. If the Workflow
  `Client` is persisted anywhere other than `gcc_clients`, that store is deleted in this stage.
  `gcc_clients` is the one client table.
- **GeekAPI.** Client contract and routes carry the new fields; scope check on each.
- **content-creator-v2.** `ClientsPanel` creates and edits contact and billing details. Billing
  email is prefilled from contact email as an editable copy, and currency is preselected for the
  user to confirm. Both are stored values, never read-time fallbacks.

### Stage 3 — tasks and time

- **Migration.** `gcc_tasks`, `gcc_time_entries`, the frozen-invoiced trigger, no-truncate triggers
  on both, and the Stage 3 event types.
- **GeekRepository / GeekAPI.** Repositories and routes for both. `user_id` from `sub`;
  `rate_snapshot` and `currency` copied from the client row in the insert transaction.
- **content-creator-v2.** A task list on the project page and a time entry form recording against
  the project or a task, with task, project and billable totals. Both ship together — a task list
  with no way to log time against it is the stub §3 forbids.

### Stage 4 — deliverables

- **Migration.** `gcc_deliverables`, its no-truncate trigger, and the Stage 4 event types.
- **GeekRepository / GeekAPI.** Repository and routes, with the create-client match check.
- **content-creator-v2.** Deliverables on the project page; `CreateDraftWorkspace` opens from a
  deliverable. The content pipeline is not rebuilt: artifacts, versions and approvals stay where
  they are.

Frontend touch points across stages: `src/app/app/workflow/page.tsx`,
`src/components/content-writer/ProjectForm.tsx`, `src/components/content-writer/ClientsPanel.tsx`,
`src/components/content-creator/CreateDraftWorkspace.tsx`, `src/services/content-writer-api.ts`,
`src/services/gcc-api.ts`, `src/lib/types.ts:237,295`.

## Explicitly out of scope

- **Carrying forward existing project or client data** — development data, not preserved.
- **Generation** — stays on the RAG-grounded `ContentCreatorV2/*` path. The v1 generate methods in
  `content-writer-api.ts` have no live caller and none is wired back.
- **Invoicing** — time is tracked, marked billable and rate-stamped; `invoiced_at_utc` exists so
  that work has somewhere to land later.
- **Moving GeekRepository auth to client_credentials.**
- **Rewriting the two GeekAPI workers** — Stage 0 only restricts their role.
- **Splitting migration-owner and runtime Postgres roles.** A trigger stops accidents, not the
  table owner, who can still disable it. The role split is the stronger follow-up.
- **Per-user client ownership.**
- **Crawling** (Geek-Crawler-v2's), **Site Analyzer** (retired), **the `siteAnalysisProfileId`
  rename** ([one-name-for-the-run-id.md](./one-name-for-the-run-id.md)).

## Verification

Proof is by database rows and HTTP status codes, not UI state.

1. **Stage 0.**
   - GeekAPI with `REPO_API_KEY` empty refuses to start. GeekRepository with its expected key empty
     refuses to start.
   - A GeekRepository route called with no `X-Repo-Key`, and with a wrong one, returns 401.
   - Connected as the workers' role: `SELECT` from `content_creator.gcc_clients` is denied;
     `LISTEN` succeeds.
2. **Stage 1.**
   - No code references `repo/content-writer-v2/blobs/projects`, `PurgeStaleAsync` or
     `ProjectsController`.
   - A valid token without the scope gets 403 on every project route.
   - The same keyword and site URL under one client yields **two** rows.
   - The same `idempotency_key` submitted twice yields one row and returns the same id; the same key
     under a different client returns 409.
   - The projects list count equals `select count(*) from content_creator.gcc_projects where
     client_id = …`, via a request that deletes nothing.
   - `project_created` log rows equal project rows.
   - `UPDATE` or `DELETE` on `gcc_project_log` raises. `DELETE` on a project raises. `TRUNCATE` on
     `gcc_projects` or `gcc_project_log` raises.
3. **Stage 2.**
   - The migration fails against a database holding a pre-plan client row and succeeds against a
     fresh one.
   - Inserting a client without a required field is refused by Postgres, as are negative payment
     terms, a zero or negative rate, and a currency that is not three uppercase letters.
   - A client shows contact and billing details; changing one project's site URL leaves its
     siblings untouched.
   - `TRUNCATE gcc_clients CASCADE` raises, and every row count is unchanged afterward.
4. **Stage 3.**
   - Log 90 minutes against a task: it appears in the task total, the project total and the
     billable total at the client's rate. Change the client's rate afterwards — the logged entry
     does not move.
   - A billable entry against a client with no rate is refused.
   - A time entry whose task belongs to another project is refused by the composite FK.
   - A `user_id` sent in the request body is ignored: the stored value equals the token's `sub`.
   - `UPDATE` on an invoiced entry raises. `TRUNCATE` on either table raises.
5. **Stage 4.**
   - A deliverable whose create belongs to another client is refused.
   - A deliverable opens its create in `CreateDraftWorkspace`.
   - `deliverable_delivered` log rows equal deliverables with status `delivered`.
6. **Every stage.** `npx tsc --noEmit` clean; `npm run lint` shows no new findings beyond the 10
   pre-existing errors.

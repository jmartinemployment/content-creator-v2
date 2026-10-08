# The project wire contract the frontend calls — fix-project-persistence P0

Written 2026-10-04 by the content-creator-v2 session, for the GeekAPI session building GA1/GA2
concurrently. Nothing here exists in GeekAPI yet (GeekBackend `db918bb` has no project brief route,
no revisions table, no project generate). The frontend is coded against exactly these names and is
**committed but not pushed** until they are deployed, because pushing this repo deploys it and the
brief and Generate would break against routes that do not exist.

If GeekAPI picks different names, change this file and say so; the frontend follows this file.

All routes under `/api/geek-content-creator`, JSON in camelCase, under `ManagePolicy` (J8).

## 1. Read the project, with its brief — extends the existing `GET projects/{id}`

The existing `GccProject` gains:

| Field | Type | Meaning |
|---|---|---|
| `briefJson` | `string \| null` | The project's current brief (GR1) |
| `topic` | `string \| null` | The keyword (GR1) |
| `researchJson` | `string \| null` | (GR1) |
| `siteSectionJson` | `string \| null` | (GR1) |
| `version` | `number` | The brief's own counter (`brief_version`), which the Save button sends back as `expectedVersion` |
| `briefSavedAtUtc` | `string \| null` | When the current brief revision was saved; null before the first |

**The wire names do not change.** The counter replaces the row's xmin (Jeff's instruction to the
GeekBackend session, 2026-10-04), so a Profile save no longer makes the brief editor's read stale. It
is still called `version` on the project read and in the save response, and `expectedVersion` in the
save request. The frontend is coded against those three names.

## 2. Save the brief — GA1

`PATCH projects/{id}/brief`

```json
{ "briefJson": "…", "topic": "…", "expectedVersion": 123 }
```

- `200` → `{ "version": 124, "revisionId": "<guid>", "savedAtUtc": "…", "topic": "…" }`
- `409` → plain text: `This project was changed after you loaded it. Nothing was saved -- reload and save again.`
- Accepts an incomplete brief (J3). `topic` blank or null leaves the topic unchanged.

## 3. Generate — GA2

`POST projects/{id}/generate`

```json
{ "outputTypes": ["pillar", "tool"], "provider": "OpenAi | Anthropic", "acknowledgeStaleGrounding": false }
```

- `202` → `{ "jobId": "…", "projectId": "…", "status": "running" }`; progress over the existing hub
  (`JoinGccGenerate(jobId)`, events `GccGenerateEvent` / `GccGenerateTypeEvent` /
  `GccGeneratePreflightEvent` unchanged).
- `409` when a job is already running for the project, plain text naming it.
- Every version written records on its `metadata_json`: `briefRevisionId` and
  `briefRevisionSavedAtUtc` (J7). The workspace shows "Generated from the brief saved at …" from the
  second.

### 3a. What a Generate saves — changed 2026-10-05 (GeekBackend `62efbad`)

**A Generate rewrites the project's pages; it does not add drafts.** J1 says "Generate adds versions
to the project", and until this date every Generate created a new artifact for every piece, beside
the last run's and under the same name. Now:

- A project has one page (artifact) per content type and name. A piece whose page exists becomes
  that page's next version, and the page returns to `draft`; a piece with no page creates it.
- A run's pieces are saved in one write, all or none. A failed run saves nothing.
- The run's result is the record of what it saved: the terminal `GccGenerateEvent`'s `resultJson`
  is `{ "created": [{ "artifact", "version" }], "refusals", "preflight", "warnings" }`, or the bare
  `{ "artifact", "version" }` when the run wrote exactly one piece with nothing else to report.
  **Do not work out what a run saved by comparing artifact ids before and after**: a run that
  rewrites six pages creates no new artifact.
- Each `preflight` entry carries `totalCategories` beside `populatedCategories`.
- A pillar or blog that links a tool page the project does not have carries that in its own
  `warnings` (`5671288`).

### 3b. The newest run, read back — A11 (GeekBackend `5248c22`)

`GET projects/{id}/generate/latest`

- `200` → `{ "run": null }` for a project that has never run, otherwise
  `{ "run": { "jobId", "status": "running | ready | failed", "requestedTypes", "provider",
  "startedAtUtc", "finishedAtUtc", "briefRevisionSavedAtUtc", "resultJson", "error" } }`.
- The workspace reads it once when it opens: a `running` run is rejoined with
  `JoinGccGenerate(jobId)`, which replies with the run's current state; an ended one is shown with
  what it recorded. Nothing is polled.
- The plan's A11 route was `GET creates/{id}/jobs/{jobId}`; the page knows its project and not a job
  id, so it asks by project.
- **`resultJson` is not camelCase inside, as of `5671288` — found 2026-10-06.** The route's own fields
  are camelCase, and so are the hub's live events, but the stored result is written with
  `JsonSerializer.Serialize(result)` and no options (`GccJobsAndSeo.cs:48`), so the result's declared
  fields (`created`, `refusals`, `preflight`, `warnings`) come through as declared and everything
  inside them as C# declares it: `preflight[].ProductName`, `Ready`, `PopulatedCategories`,
  `created[].artifact.Id`. Read through the hub's type, the Accounts Payable run of 2026-10-05 showed
  "0 of 5 can be grounded" and "undefined categories" five times over, on a run that wrote four tool
  pages. The workspace now reads the record with every key's first letter lowered
  (`run-display.ts` `runRecord`), which is the identity on camelCase, so GeekAPI serializing the record
  with `JsonSerializerDefaults.Web` is the fix on its side and changes nothing here.

### 3c. A run's record — GeekBackend `a28c7fd`, read by the page since `8ebd3d4`

`GET projects/{id}/generate/{jobId}/events`

- `200` → `{ "jobId", "status", "error", "events": [{ "id", "jobId", "seq", "atUtc", "kind", "piece",
  "payloadJson" }] }`, in `seq` order: what the run was grounded on, every model call, every verdict,
  every batch, every outcome, and how it ended. `404` when the job is not this project's.
- The workspace reads it when a run reports a refusal or a gap and shows it on the page, with
  GUID-valued payload fields left out and a GUID inside prose replaced: the page shows no identifier
  but the project's and the labelled Run ID (`fix-project-persistence.md` GF6).

## 4. The project's drafts — not in the plan's P0, needed by it

GF1 removes the create from the page, and today the only read of a create's drafts is
`GET creates/{id}`. The plan moves drafts to the project in P1 (GR4/GA3). P0 needs one read:

`GET projects/{id}/artifacts` → `GccArtifact[]` (the existing artifact shape), every artifact of every
create on the project until GR4 lands, then the project's own.

Since 2026-10-05 (`62efbad`) each entry also carries `latestVersionNumber` and `latestVersionAtUtc`,
and the list is ordered by the second, most recently written first. `createdAtUtc` is when the page
was first made, which stops being when its text was written the first time a Generate rewrites it.

The version routes the workspace already uses are keyed by artifact or version id and stay as they
are: `GET versions?artifactId=`, `POST versions/{id}/revise`, `/approve`, `GET versions/{id}/seo`,
`/polish`.

## 5. Export — same gap

`GET projects/{id}/export/html` → the zip `creates/{id}/export/html` returns today, for the project.

## 6. Deliverables — a named, dated promise on the project, no create

Jeff, 2026-10-04: "Creates, it is project." The Deliverables panel attached a create from a picker; it
no longer does. A deliverable is a name and a due date on the project.

`POST projects/{id}/deliverables`

```json
{ "name": "Pillar page and five tool pages", "dueDate": "2026-10-31" }
```

- No `createId`. The route requires one today; it must stop requiring it.
- `GccDeliverable` drops `createId`. `type` becomes optional: it was derived from the create's
  starting content type, which the project does not have.
- `GET projects/{id}/deliverables` and `PUT .../deliverables/{id}/status` are unchanged.
- GR4's `gcc_deliverables.artifact_id` is still available for linking a delivered draft later; the
  frontend does not send it.

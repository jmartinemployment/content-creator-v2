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
| `version` | `number` | The concurrency token (xmin) the brief editor sends back as `expectedVersion` |
| `briefSavedAtUtc` | `string \| null` | When the current brief revision was saved; null before the first |

**One question for GeekAPI:** if `version` is the row's xmin, a Profile save (PUT) also changes it,
so a brief save after a Profile edit in another tab is refused as stale. That is safe (refused,
never overwritten) but noisy. A brief-only token avoids it; either works with this contract.

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

## 4. The project's drafts — not in the plan's P0, needed by it

GF1 removes the create from the page, and today the only read of a create's drafts is
`GET creates/{id}`. The plan moves drafts to the project in P1 (GR4/GA3). P0 needs one read:

`GET projects/{id}/artifacts` → `GccArtifact[]` (the existing artifact shape), every artifact of every
create on the project until GR4 lands, then the project's own.

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

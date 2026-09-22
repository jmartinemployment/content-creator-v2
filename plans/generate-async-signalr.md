# Generate becomes a job pushed over SignalR

## Why

Generate holds an HTTP request open for the whole pipeline. One Tool page is 37 partner-extraction
calls plus a multi-call write of 3,500-5,000 words. On 2026-09-22 that exceeded the upstream limit
and returned `502 upstream error` from Railway's edge — GeekAPI never answered, so the controller's
own catch-all never ran and nothing could be reported.

Parallelising extraction (`56838ce`) cut it roughly 4x and was still not enough. The ceiling is
structural, not a tuning problem, and it gets worse on purpose: re-enabling the disabled content
types means one request runs N complete pipelines, since the primary+derive shortcut was removed
and every selected type now generates independently.

Decided with Jeff, 2026-09-22: **not polling. SignalR.** v1 already has a hub.

## What already exists — this is wiring, not invention

| Piece | Where | Note |
|---|---|---|
| v1 hub | `WorkflowRealtimeHub` → `/hubs/workflow-realtime` | `[Authorize]`, group-per-job, `JoinToolsJob` sends a snapshot on join |
| Job store | `GccJobStore` (`GccJobsAndSeo.cs`) | `Create`/`Complete`/`Fail`/`Get`, states `running`/`ready`/`failed` |
| Job read endpoint | `GccController.GetJob` | already live; becomes the reconnect path |
| Background runner pattern | `ToolsGenerationJobRunner` | `_jobs.Create` → push → `Task.Run` → `_scopeFactory.CreateScope()` |
| Push pattern | `ToolsJobProgressNotifier` | `IHubContext<WorkflowRealtimeHub>` → group |
| Browser hub token | `content-creator-v2/src/app/api/auth/hub-token` | returns a short-lived JWT; the browser cannot read the httpOnly cookie |

**Background-safety, verified:** `HttpGccRepository` uses the named `"GeekRepository"` client
authenticated by the repo key, not the caller's bearer, so repository calls survive the request
ending. Tools generation had to capture a bearer only because its SEO tree calls are user-authed.
The one request-bound value to capture before going async is `ICurrentUserContext.UserId`.

## Build

### Backend (GeekBackend)

1. **`GccGenerateProgressNotifier`** — `IHubContext<WorkflowRealtimeHub>`, sends `GccGenerateEvent`
   to `GccGenerateGroup(jobId)`.
2. **`WorkflowRealtimeHub`** — add `GccGenerateGroup(Guid)`, `JoinGccGenerate(Guid)`,
   `LeaveGccGenerate(Guid)`. Join verifies the caller owns the create behind the job before joining
   (stricter than `JoinToolsJob`, which checks only that the job exists) and sends a snapshot.
3. **`GccGenerateJobRunner`** — mirrors `ToolsGenerationJobRunner`: create job, push, `Task.Run`,
   new DI scope. Takes the captured `userId`.
   - **`CancellationToken.None`, never the request's token** — the request token is cancelled the
     moment the 202 returns, which would kill generation instantly and silently.
   - Resolve `GccGenerateService` / `HttpGccRepository` / `GccGroundingResolver` **from the new
     scope**; the request's scoped instances are disposed.
4. **`GccController.GenerateAsync`** — keep every pre-flight gate that is cheap and synchronous
   (site-section gate, brief required, provider parse, stale-grounding conflict, disabled-type and
   empty-`outputTypes` refusals) so bad requests still fail fast with a real status code. Then hand
   off to the runner and return `202 { jobId }`.
5. **One event per requested type, not one per request.** `RunGenerateAsync` already generates each
   type independently via `Task.WhenAll`, so each artifact pushes as it lands: the UI fills in
   progressively and a partial outcome stays legible — four artifacts plus one named refusal, rather
   than one opaque failure. Same lesson as the "37 of 37" diagnostic (`ab7df72`, `afb6f6b`).

### Frontend (content-creator-v2)

6. `@microsoft/signalr` client; connect with `accessTokenFactory` reading `/api/auth/hub-token`,
   direct to GeekAPI — **not** through `/api/cw/[...path]`, which is an HTTP proxy and cannot carry
   a WebSocket.
7. `CreateDraftWorkspace` calls generate, gets `202 { jobId }`, joins the job group, and renders each
   artifact as its event arrives.
8. On reconnect, `JoinGccGenerate` replays a snapshot; `GetJob` covers a cold load. No polling.

## Service boundaries — unchanged by this plan

**All calls to GeekRepository go through GeekAPI** (Jeff, standing rule). Nothing here alters that:
the background runner resolves the same `HttpGccRepository` from its own DI scope and calls it the
way the synchronous request already does, only after the response has returned. No new caller of
GeekRepository is introduced, and nothing in the browser reaches it.

The single topology change is **browser → GeekAPI for the WebSocket**. A WebSocket cannot traverse
`/api/cw/[...path]`, which is an HTTP route handler, so the hub connection is made directly to
GeekAPI. That is still GeekAPI, not GeekRepository, and it is the pattern this repo already
established — `/api/auth/hub-token` exists precisely to hand the browser a short-lived token for it.
Ordinary REST calls continue to go through the proxy unchanged.

## Constraints that must not be lost

- **No second endpoint.** Adding `generate-async` beside the existing one is the parallel-path
  duplication already rejected ("Multi generate methods should not exist"). It is one coordinated
  switch across both repos, or it is not done.
- **The job store is in-memory.** A redeploy loses in-flight jobs, so an unknown job id on reconnect
  must read as *lost*, not *still running* — a spinner that never resolves is the same silent-failure
  class as the swallowed extraction errors.
- **A background failure must be recorded, pushed and visible.** Fire-and-forget that fails quietly
  is exactly what cost a day here.

## Not in scope

Making generation *faster*. Async removes the timeout ceiling; it does not reduce 37 extraction
calls or a slow model. Extraction volume, per-task model choice (`project_llm_model_selection`), and
whether all retrieved pages need extracting are separate decisions.

# The gate, on the v1 surface

## Context

The app is a dead end. `/app/crawl` has one network call — `checkHostsIndexed` on blur — and no
button, no navigation. `unlockWorkflow` has **zero callers**, so `workflowUnlocked` is permanently
`false`, the sidebar's Workflow item is permanently disabled, and everything behind it
(`ProjectForm`, `ProjectList`, the five-panel wizard at `/app/workflow/projects/[id]`) is
unreachable. The sidebar now reads **Crawl | Workflow**, matching v1's two items — but Crawl goes
nowhere and Workflow can never open.

One hop is missing: **project URL → Run ID → unlock Workflow → navigate.**

This was built on 2026-09-18 and correctly torn out, because it was built on
`POST /api/geek-content-creator-v2/research-readiness`. **Version one is what is being
implemented**, and that was the only `-v2` call in the entire frontend. Existing is not the same as
correct when the direction is v1.

Removed the same day, for the same reason: `/app/create` and `CreateStartForm`. Neither exists in
v1 — `GeekContentCreator` has no such component, and v1's nav is **Site Analyzer | Workflow**, two
items. `CreateStartForm` arrived via `07f85b0`, whose message says *"restore: v1 Project features"*,
but there is nothing in v1 to restore it from. Its deletion also removed two of the three dead
`site-analyzer` calls and took lint from 25 → 22 problems.

## The gap

No v1 route resolves a URL to a Run ID. All 30 restored `GccController` routes — creates, clients,
generate, jobs, artifacts, versions, tools, serp/parse, the project sub-surface — and not one does
this. So this is an **add to v1**, not a re-point.

The server-side work already exists and must be reused, not rewritten:

| Piece | Where | What it does |
|---|---|---|
| `CheckSeedReadinessAsync(owner, crawlType, seeds, ct)` | `GccV2GeekCrawlerResearchResolver` | Normalizes, finds the run, authorizes, **probes actual retrieval**, returns `GccV2SeedReadiness(Seed, Ready, RunId, IndexState, Reason)`. Never throws |
| `CrawlTypes.ProjectSite` | `GeekApplication/Models/GeekCrawler/CrawlTypes.cs` | `"project-site"`, in the `Valid` set |
| `unlockWorkflow` / `workflowHref` | `src/components/WorkflowGate.tsx:40,73` | Sets the gate; builds `/app/workflow?siteAnalysisProfileId=<id>` |

Its docblock states the rule this gate depends on: *"Presence is not fitness: the only thing worth
confirming is that pages actually come back."* That is why this, and not `checkHostsIndexed` — the
latter only asks whether a host has vectors, which a crawl that fetched nothing can satisfy.

## Approach

### 1. GeekBackend — one route on the v1 prefix

Add to `GeekAPI/Controllers/ContentCreator/GccController.cs`:

```
POST api/geek-content-creator/project-site/readiness
body     { projectUrl: string }
returns  { seed, ready, runId, indexState, reason }
```

Inject `GccV2GeekCrawlerResearchResolver` — it is already `AddScoped`
(`ContentCreatorV2/ServiceRegistration.cs:61`), and `GccController` uses plain constructor
injection, so this is one added parameter. Call
`CheckSeedReadinessAsync(owner, CrawlTypes.ProjectSite, [projectUrl], ct)` and return the single row.

**Calling a `ContentCreatorV2/*` service in-process is correct and is not a v2 dependency.**
`architecture.md` §8: *"Call | Shared engines in-process in GeekAPI | One stack — call, don't fork
casually."* The rule governs the surface the frontend targets. The frontend will only ever see
`api/geek-content-creator/*`. Forking the resolver to "make it v1" would duplicate the retrieval
probe and guarantee drift — the exact failure this repo keeps paying for.

Follow the file's conventions: `if (!_user.IsAuthenticated) return Unauthorized();`, and return
`BadRequest("…")` as a **result, never a throw** (`.cursor/rules` — no exceptions).

### 2. Frontend — `src/services/gcc-api.ts`

Add `checkProjectSiteReadiness(projectUrl: string)` hitting that path through the existing
`gccRequest` helper (which prefixes `/api/cw`). Mirror the shape above; `runId` is `string | null`.

### 3. Frontend — `src/app/app/crawl/crawl-client.tsx`

Add a **Continue** button. On click, call the new function; on `ready && runId`:

```ts
unlockWorkflow({ siteAnalysisProfileId: row.runId, domain: projectUrl, clientId: null });
router.push(workflowHref(row.runId));
```

Reuse what is already in the file: `parseLines`, `IndexReport`, the `domain` state. Leave the
partner/competitor boxes on `checkHostsIndexed` — they are informational and do not gate.

Use the readiness check **only** for the project URL. Running two signals against the same URL is
how this codebase got *"The existing run is `complete`, holds 0 pages, and its host has 3,545
vectors in Qdrant — status says fine, store says empty, index says populated"* (`235abb7`).

Three states, all fail-closed, each saying which it is:

- not ready → disabled, show `reason`, plus: crawl it in Geek-Crawler, nothing here crawls
- ready but `runId` null → disabled, say the run did not resolve
- response carries no row → disabled, say the server is older than this page. **Not** the same as
  "not ready"; conflating them is a silent dead end that looks like a red URL

**Do not rename** `WorkflowUnlockInput.siteAnalysisProfileId`. It has carried a Geek-Crawler `runId`
since `4f7d540`, and `ProjectForm` reads that exact query param. Renaming spans `WorkflowGate`,
`workflowHref` and `ProjectForm` together or it silently yields nothing.

## Pitfalls — verified against the repo, do not repeat

A proposed blueprint for this plan contained six defects that would not compile or would silently
hit the wrong URL. Recorded so implementation does not reproduce them:

| Proposed | Why it fails | Correct |
|---|---|---|
| `_user.OwnerId` | `ICurrentUserContext` has only `Guid UserId` and `bool IsAuthenticated` | `_user.UserId.ToString("D")` — as `GccV2ResearchReadinessController:37` does |
| `result.Length == 0` | returns `IReadOnlyList<GccV2SeedReadiness>` | `.Count` |
| `gccRequest("/project-site/readiness", …)` | `gccRequest` prefixes `API_BASE = "/api/cw"`; callers pass the **full GeekAPI path** (`gccRequest<GccCreate>("/api/geek-content-creator/creates")`). This resolves to GeekAPI `/project-site/readiness` → **404** | `"/api/geek-content-creator/project-site/readiness"` |
| `setErrorMessage(...)` | does not exist in `crawl-client.tsx`. Only `indexError`/`setIndexError` exist, owned by the partner/competitor index check | add separate project state — reusing `indexError` crosses the two signals this plan forbids |
| `router.push` / `unlockWorkflow` | both imports were removed when the v2 gate was torn out | re-add `useRouter` and `useWorkflowGate, workflowHref` |
| `indexState: string` | C# record is `string? IndexState` | `string \| null` |

Two more that would break the build's 0-warning state or the repo's conventions:

- `class ProjectSiteReadinessRequest { public string ProjectUrl { get; set; } }` — a non-nullable
  reference type with no initializer emits **CS8618**, and `dotnet build` is at 0 warnings today.
  Convention in this codebase is a `sealed record` with a nullable member, e.g.
  `public sealed record HostsIndexedRequest(IReadOnlyList<string>? Urls);` (`RagController.cs:93`).
- A `catch` that replaces the thrown message with a generic string hides the real failure. Report
  `e instanceof Error ? e.message : …`, as the rest of the file does.

Also missing from that blueprint: a `checking` state, so the button has no disabled/in-flight
handling and can be double-submitted.

## Known weakness to carry, not fix here

`GetLatestRunContainingSeedAsync` (`MongoGeekCrawlerService.cs:567`) filters owner + crawlType +
seed and sorts by `CreatedAtUtc` — **no status filter**, so it can return an in-flight or failed
run. `CheckSeedReadinessAsync` reaches it only as a fallback after
`GetRunForSlotAsync(publishedOnly: true)`, and its retrieval probe means such a run reports
not-ready rather than passing the gate. So the gate is safe; the resolver is still wrong. Constrain
it to `complete` as separate work.

## Verification

1. `dotnet build GeekAPI/GeekAPI.csproj` — currently 0 errors, 0 warnings; keep it there.
2. `npx tsc --noEmit`, `npm run build`, `npx eslint <changed files>` — eslint must stay at **zero**
   on `crawl-client.tsx` and `gcc-api.ts`, which are at zero now. Repo total is 22 problems
   (14 errors, 8 warnings), all pre-existing react-hooks.
3. `grep -rn "geek-content-creator-v2" src/` must return **only** `config.ts` — the OAuth client id,
   an identity string, not an API call. Any other hit means the gate went back onto v2.
4. Walk it signed in: unindexed URL → Continue disabled with a reason; indexed URL with a committed
   run → Continue enabled → sidebar **Workflow** enables → URL is
   `/app/workflow?siteAnalysisProfileId=<runId>` → `ProjectForm` shows that same id as **Run ID**.
5. Reload re-locks Workflow. Correct, not a bug — `WorkflowGate.tsx:9-12` documents the unlock as
   *"Session-only … React memory, not localStorage / sessionStorage."*

## Still broken after this, and not in scope

- `GET /api/geek-content-creator/creates` returns **500** — the route exists; the throw is inside
  `ListCreatesAsync`. Every create lands there after it is made.
- `HierarchyContextPanel.tsx:137` calls a retired `site-analyzer` route (404). Deferred by the
  operator — *"technically not needed, will be used to test RAG retrieval."* Its "outside site
  scope" escape hatch now renders on the error path, so Generate stays reachable.
- The backend change is local until GeekBackend ships; the deployed API will 404 the new route.

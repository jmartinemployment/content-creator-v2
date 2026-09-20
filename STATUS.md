# Where things stand — 2026-09-17

I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.


## Pushed and live

| Commit | Repo | What |
|---|---|---|
| `714ef8d` | GeekBackend | Restored `GccController` (1,172 lines), minus Site Analyzer. Deployed to Railway. |
| `57c8c48` | content-creator-v2 | Dropped 6 frontend calls to endpoints retired 2026-08-06 (all had zero callers). |
| `a278ce7` | content-creator-v2 | **Revert** of the Site Analyzer deletion — it was v1's front door. |
| `45122ac` | content-creator-v2 | Page reduced to the crawl URL. 949 lines → 170. |
| `136fc8c` | content-creator-v2 | Renamed to **Create**. `/app/site-analyzer` → `/app/create`. |
| `48e23d7` | content-creator-v2 | Partner + Competitor URL textareas. |
| `719951c` | content-creator-v2 | **All three crawl types go to Geek-Crawler.** |
| `dbf2e8b` | content-creator-v2 | Checkbox is "Use existing site", ticked by default. |

## Not committed

Per-URL seed validation (`src/lib/crawl-seeds.ts` + wiring). Typechecks. Not pushed.

**Why it exists:** the server rejects the whole batch on the *first* bad URL
(`ValidateRawSeeds` returns `Invalid seed URL: {raw}` and stops). Twelve URLs with three
problems = three submits. This checks every line locally and names each one.

**Risk:** it is a *copy* of the server's rules in TypeScript. If they drift, the page
accepts what the server rejects, or silently drops what it would take. A validation
endpoint would remove the duplication; that is a backend change.

## One form, no gate

`/app/crawl` is gone. Everything it collected — project URL, partner URLs, competitor URLs, and the
index check behind them — is on **New Project** (`/app/workflow`), which is now the only destination
in the sidebar.

Page one existed to produce one value, the Run ID, and a whole mechanism existed to carry it to page
two: `WorkflowGate`, `unlockWorkflow`, `workflowHref`, the `?siteAnalysisProfileId=` query param and
the "Workflow is disabled" state. That mechanism was broken until 2026-09-20 — `unlockWorkflow` had
zero callers, so the gate never opened and page two was unreachable. All of it is deleted.

The gate is stronger for being inline: **Create Project is disabled until the URL resolves to a Run
ID**, with the reason beside the button. Refusal at the point of action, not on a screen the
operator has already walked past.

**Still not persisted:** partner and competitor URLs. `createProject` has no parameter for them and
the Project entity has no column. They are index-checked and discarded, exactly as before — moving
them did not fix that, and nothing reads a declared partner list yet: generation queries the partner
corpus by topic (`GccV2CreateLibraryWriter:152-180`).

## Site structure

`GET api/geek-crawler/crawls/{runId}/site-structure` (GeekBackend) returns a run's heading tree
built from the crawler's typed `blocks` — heading levels, the prose under each heading, and the
anchors with their labels — plus a cross-reference of which outside hosts the site reaches and from
which sections, following one hop through on-site pages. Derived per request, never stored.

Proven against live crawls on 2026-09-20 for the project site, and the same read works unchanged for
partner and competitor runs: ingest is one path and every crawl type carries `blocks`.

**The display was scaffolding and is gone.** `SiteStructurePanel` and its call site on `/app/crawl`
were removed once the data was confirmed. `getProjectSiteStructure` remains in `gcc-api.ts` with no
caller — the typed client for a live endpoint, kept for whatever consumes structure next. Git has
the panel if it is wanted back.

**Still reading HTML, not blocks:** partner and competitor extraction
(`GccV2GeekCrawlerResearchResolver:394,607`) re-parses `page.Html` with `GccV2ArticleHtmlExtractor`
to recover prose the crawler already parsed into blocks. A second derivation of the same content
from a different representation — the drift class that emptied the corpus before, and the one
removed from the project-site path today.

## Still broken

1. **`GET /api/geek-content-creator/creates` returns 500.** The live bug. The page the
   sidebar points at. Handler is 3 lines, so the exception is inside `ListCreatesAsync`.
2. ~~Three frontend calls 404, all Site Analyzer~~ — **resolved, verified 2026-09-20.**
   `CreateStartForm.tsx` no longer exists and `e6b3701` repointed `HierarchyContextPanel` at the v1
   run-id route. **Site Analyzer is obsolete; Geek-Crawler-v2 replaced it** — site structure comes
   from a `project-site` crawl run, read back by Run ID. No Site Analyzer call remains in this repo.
3. `src/proxy.ts:73` still matches `/api/site-analyzer/:path*`, and nine now-unreachable proxy routes
   remain under `src/app/api/site-analyzer/**` (344 lines, zero callers). Dead scaffolding, not a
   broken feature — removal plan: `plans/remove-site-analyzer.md`.
4. **`DraftingEnabled` is still `false`** — creates stop before the first paid model call.
   Nothing has tested whether v1 actually produces content again.

## Plan stages (from the approved plan)

- Stage 0, 1, 1b — done, but 1/1b are **unmerged** on `feat/cancel-delete-buttons-and-quotas`
- Stage 2 — seam built, flag still `postgres`, never flipped
- Stage 3, 4 — not started

## Known defect I introduced and fixed

`a5f03b6` removed a fallback: failed Qdrant deletes logged a warning and returned 200.
For the record — **no Qdrant delete has ever failed here.** `wait=True` is set
(`qdrant_store.py:224`) and all three filter keys are payload-indexed. I created doubt
about that by describing a defensive branch as though it were an incident.

## Noted for later

**Add a project URL input to Geek-Crawler-v2's own web UI.**
`web/src/components/submit-crawl-form.tsx` offers the crawl types but the operator
should be able to enter a project site URL there directly, the same way partner and
competitor seeds are entered.

**The project URL input stays on the Create page**, and the crawl it starts is performed
by **Geek-Crawler-v2** — not GeekAPI's in-process .NET crawler.

That second point is not yet true in code. `POST /api/geek-crawler/crawls` currently
routes to `GeekCrawlerService.StartCrawlAsync`, which wakes the in-process crawler inside
GeekAPI — the reason Chromium is installed in the API image, and the one live violation of
the service boundaries. Pointing this at Geek-Crawler-v2 is Stage 3 of the plan.

Open question for when this is picked up: Geek-Crawler-v2 is deliberately local-only
(its README: do not run crawls from Vercel, shared cloud IPs get flagged), so GeekAPI on
Railway cannot call it. Either the crawler polls for queued project-site runs, or the
operator starts it locally and Content Creator accepts the run id.

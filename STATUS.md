# Where things stand — 2026-09-17

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

## Still broken

1. **`GET /api/geek-content-creator/creates` returns 500.** The live bug. The page the
   sidebar points at. Handler is 3 lines, so the exception is inside `ListCreatesAsync`.
2. `CreateDraftWorkspace` and `HierarchyContextPanel` still call `/api/site-analyzer/*`
   — leftovers from the old path, will 404 if reached.
3. `src/proxy.ts` still matches `/api/site-analyzer/:path*`.
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

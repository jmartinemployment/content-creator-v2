# Prove a Run ID returns the project site's structure

**Code is done and now permanent. Verification is not.**

> Scope narrowed 2026-09-20 by `Geek-Crawler-v2/plans/move-crawl-reads-to-geekapi.md`. The second
> panel — crawl pages and their typed blocks — was removed: crawl data is Geek-Crawler's and this
> app must not call `api/geek-crawler/*`. What remains is the site-hierarchy read, now a permanent
> display rather than a `[TEST]` block. The server side moves to
> `api/geek-crawler/crawls/{runId}/site-structure` built from typed `blocks`, with the route this
> app calls delegating to it — same response models, no change here.

| | |
|---|---|
| Shipped | `1eddaea` — route typed; made permanent and restyled after `07a7696` |
| Shipped | `aa56c58` — Run ID handoff, without which the display is unreachable |
| Outstanding | **Open it against a real Run ID.** Nothing has. |

## What to do

1. `npm run dev`, sign in
2. `/app/crawl` — type the project URL, leave the field
3. Click **Continue to Workflow →**
4. Expand **Site structure** on the New Project form

Passes if the homepage matches the project URL, headings nest by level, and at least one node shows
a link count.

A `404` means the Run ID is not a run this user owns — wrong run, not a broken display.

## The route

`GET /api/geek-content-creator-v2/project-site/runs/{runId}/site-hierarchy` — GeekAPI's Content
Creator surface, behind `/api/cw`, already built. Returns the assembled heading tree: `level`,
`headingText`, `links`, `children`.

Filtered server-side to the homepage, tool/use-case hubs, and pages with 2+ link groups, and returns
`siteHierarchy: null` when nothing qualifies — a short list off a large crawl is the filter working,
not a broken crawl.

**This app does not call `api/geek-crawler/*`.** A first pass added a second panel reading the
crawler's typed `blocks` from `GET /api/geek-crawler/crawls/{runId}/pages`. That crosses a boundary:
crawl data is Geek-Crawler's, and inspecting what a crawl captured belongs in the crawler's own UI —
see `Geek-Crawler-v2/plans/site-structure-view.md`. Removed.

## The Run ID

`checkIndex` on `/app/crawl` already returns it — it stores the whole `HostIndexed` row, so
`indexed[url].runId` **is** the Run ID. No lookup, no readiness call, no crawl list.

## Not RAG

Geek-Crawler-Rag publishes nothing structural. Its `/v1/pages` routes return the flattened
block→text projection, which drops `level`, `html` and `anchors` by design, and no route lists a
run's pages. Publishing blocks would mean a new route over `MongoCorpus.iter_pages` plus a GeekAPI
facade — two repos, and out of scope.

## Files

| File | |
|---|---|
| `src/services/gcc-api.ts` | `getProjectSiteHierarchy` |
| `src/components/content-writer/ProjectForm.tsx` | The `[TEST]` block |
| `src/app/app/crawl/crawl-client.tsx` | Run ID → workflow gate + link |

Permanent. What is left is opening it against a live run.

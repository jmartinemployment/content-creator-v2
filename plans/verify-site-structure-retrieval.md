# Prove a Run ID returns the project site's structure

**Code is done. Verification is not.**

| | |
|---|---|
| Shipped | `1eddaea` — both routes typed, `[TEST]` blocks render |
| Shipped | `aa56c58` — Run ID handoff, without which the display is unreachable |
| Outstanding | **Open it against a real Run ID.** Nothing has. |

## What to do

1. `npm run dev`, sign in
2. `/app/crawl` — type the project URL, leave the field
3. Click **Continue to Workflow →**
4. Open the two `[TEST]` blocks on the New Project form

Passes if:

- **Site Structure** — homepage matches the project URL, headings nest by level, at least one node
  shows a link count
- **Crawl pages** — blocks come back non-empty, heading blocks carry `level`, anchor total is
  non-zero

A `404` means the Run ID is not a run this user owns — wrong run, not a broken display.

## The two routes

Both GeekAPI, both behind `/api/cw`, both already built.

| Route | Gives |
|---|---|
| `GET /api/geek-content-creator-v2/project-site/runs/{runId}/site-hierarchy` | Assembled heading tree — `level`, `headingText`, `links`, `children` |
| `GET /api/geek-crawler/crawls/{runId}/pages` | Crawler's typed `blocks` — heading `level` and per-block `anchors` survive here |

Route 1 is filtered server-side to the homepage, tool/use-case hubs, and pages with 2+ link groups,
and returns `siteHierarchy: null` when nothing qualifies — a short list off a large crawl is the
filter working, not a broken crawl. Route 2 is unfiltered and server-paged; the display asks for one
bounded page.

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
| `src/services/gcc-api.ts` | `getProjectSiteHierarchy`, `listCrawlRunPages` |
| `src/components/content-writer/ProjectForm.tsx` | The two `[TEST]` blocks |
| `src/app/app/crawl/crawl-client.tsx` | Run ID → workflow gate + link |

Scaffolding. Remove the `[TEST]` blocks once verified.

# Retrieve the project site structure by Run ID

**Status 2026-09-20 — code shipped, not yet verified.** All three changes landed in `1eddaea`, and
the Run ID handoff that makes them reachable landed in `aa56c58`. **Nothing has been run against a
live Run ID**, which is the whole point of the plan — see § *Verification*, 1 of 7 steps done.

## Context

The project site is crawled by Geek-Crawler-v2 and addressed by **Run ID**. Nothing in this repo has
ever pulled that crawl's structure back, so it is unproven that a Run ID returns real headings,
levels and anchors.

Jeff's ask (2026-09-20): **prove retrieval works.** The routes are the deliverable — the display is
a throwaway dump to eyeball the result, not a component to design.

The starting point was a first attempt in the working tree: `getProjectSiteHierarchyTest` typed
`Promise<unknown>`, rendered as `JSON.stringify`. Untyped meant nothing verified the wire shape, and
a raw blob of a 47-page tree is unreadable. Both routes are now typed — see § *Changes*.

### Why not Geek-Crawler-Rag

The original instruction was to use exposed RAG methods. **RAG publishes nothing structural** —
verified 2026-09-20 against both repos at HEAD.

`/api/rag/*` is five routes (`RagController.cs:14`): `health`, `status`, `entities`,
`hosts-indexed`, `templates`. The client (`IGeekCrawlerRagClient`) has more methods, none exposed and
none useful here:

- `GetPageTextAsync` → `Text`, a single flattened string from `derive_plaintext_from_blocks`
  (`block_text.py:102-117`), the projection that **deliberately** drops `level`, `html`, `anchors`
- `QueryAsync` → `GccQuoteablePage` has a `Headings` field, but `MapChunksToQuoteable` hard-codes it
  to `[]` (`HttpGeekCrawlerRagClient.cs:798`)
- Python side has no run-scoped page listing at all — `GET /v1/pages` needs a `page_id` or exact URL

Blocks never cross the wire into C#. Publishing them would mean a new route over
`MongoCorpus.iter_pages` (`mongo.py:215-254`, which already projects `Blocks`) plus a GeekAPI facade
route — real work in two repos, and the right move only if this becomes permanent.

## The two routes

Both are reachable today through the `/api/cw` proxy with the signed-in user's bearer.

### Route 1 — the assembled tree

`GET /api/geek-content-creator-v2/project-site/runs/{runId}/site-hierarchy` —
`GccV2ProjectSiteController.cs:187`

```
{ siteHierarchy: { homepageUrl, viewport, builtAtUtc,
    pages: [ { pageUrl, roots: [ { level, headingText, paragraphs[],
                                   links[{text,href,rel}], children[…] } ] } ] } }
```

`GccV2SiteHierarchyFromCrawl.Build` parses each page's raw `Html` and nests headings by level with
anchors attached. Two behaviours to surface rather than hide:

- `siteHierarchy` is **`null`** when the seed URL will not normalize or every page is filtered out
  (`GccV2SiteHierarchyFromCrawl.cs:18,36`)
- it **filters**: homepage, tool/use-case hubs, and pages with 2+ link groups only (`:46-72`). Twelve
  pages off a 2,500-page crawl is correct, not a broken crawl — the display must say so

On the `-v2` surface: a pure read, no generation. In bounds; the comment at `gcc-api.ts:797-802`
already records why.

### Route 2 — typed blocks, unfiltered

`GET /api/geek-crawler/crawls/{runId}/pages?limit=&offset=` — `GeekCrawlerController.cs:226-240`

Returns `GeekCrawlerPageDto[]` verbatim (`GeekCrawlerDtos.cs:46-60`): `id, runId, origin, url,
finalUrl, statusCode, robotsAllowed, html, failureReason, crawledAtUtc, title, excerpt, contentHtml,
blocks`.

`blocks` is the crawler's typed array passed through untouched — `heading`(+`level`), `paragraph`,
`listItem`, `quote`, `code`, `row`(`cells`), `term`, `definition`, each with `text`, `html`,
`anchors`. This is the corpus format `AGENTS.md` names as the structural source of truth.

**Paged**: `limit` defaults to 100 and is clamped to 1–500 (`:235-236`). `Html` is ~98% of corpus
size, so this display requests **one bounded page** and labels it as such — it is a retrieval check,
not an export. Do not loop the whole run here.

Route 1 proves the tree assembles. Route 2 proves the underlying blocks carry `level` and `anchors`
at all. Both are worth having: route 1 is what a feature would consume, route 2 is what the migration
target in `AGENTS.md` points at.

## Changes

All in `content-creator-v2`. No backend work.

### `src/services/gcc-api.ts` — the routes, typed

Replace `getProjectSiteHierarchyTest`'s `unknown` with real types and add the second route:

```ts
export interface SiteHierarchyLink { text: string; href: string; rel: string }
export interface SiteHierarchyNode {
  level: number; headingText: string; paragraphs: string[];
  links: SiteHierarchyLink[]; children: SiteHierarchyNode[];
}
export interface SiteHierarchyPage { pageUrl: string; roots: SiteHierarchyNode[] }
export interface ProjectSiteHierarchy {
  homepageUrl: string; viewport: string; builtAtUtc: string; pages: SiteHierarchyPage[];
}
/** null when Build finds no usable pages — a real state, not an error. */
export interface ProjectSiteHierarchyResponse { siteHierarchy: ProjectSiteHierarchy | null }

export interface CrawlPageBlock {
  kind: string; level?: number; text?: string; cells?: string[];
  html?: string; anchors?: Array<{ text: string; href: string }>;
}
export interface CrawlRunPage {
  id: string; runId: string; url: string; finalUrl: string; statusCode: number;
  title: string | null; excerpt: string | null; contentHtml: string | null;
  blocks: CrawlPageBlock[] | null;
}
```

Two functions: `getProjectSiteHierarchy(runId)` and `listCrawlRunPages(runId, limit, offset)`. Both
via the existing `gccRequest` helper, which already throws `ApiError` on non-2xx — no fallback, no
retry.

`blocks` is typed loosely on purpose: GeekAPI passes it through as opaque `JsonElement?`, so a
narrower type here would be asserting a contract GeekAPI does not enforce.

### `src/components/content-writer/ProjectForm.tsx` — throwaway render

The existing fetch effect (`:63-84`) is already correct — keyed on `siteAnalysisProfileId`, `cancelled`
guard, no fallback on failure. Keep it, add a second call for route 2, and replace the `<pre>` dump
with something readable inline:

- Route 1: homepage URL, page count, `viewport`, `builtAtUtc`; then per page a collapsed `<details>`
  with rows indented by level — `H{level} {headingText}` and `· {n} links` where anchors exist
- Route 2: one line per page — url, status, and block-kind counts (`14 heading · 31 paragraph · 9
  listItem`) plus total anchors, which is what proves structure survived
- Three states said plainly: `siteHierarchy: null`, `pages: []`, and the error message. No
  placeholder, no substitute data
- One line naming route 1's homepage/hub filter, and one naming route 2's page bound

Keep the dashed amber border and the `[TEST]` label already there so it reads as scaffolding.

`ProjectForm` is the right host: it reads the Run ID straight from `?siteAnalysisProfileId=`
(`:15-23`), so a Run ID can be pasted into the URL and checked without creating a project.

Do **not** reuse `SiteHeadingHierarchy.tsx` — it takes a flat `headings[]` plus a Site Analyzer
`gaps[]` prop, so it would flatten away the levels and anchors being verified. It has zero importers
and is already listed for deletion in `plans/remove-site-analyzer.md`.

### Files

| File | Change | State |
|---|---|---|
| `src/services/gcc-api.ts` | `getProjectSiteHierarchy` + `listCrawlRunPages`, both typed | ✅ `1eddaea` |
| `src/components/content-writer/ProjectForm.tsx` | Two `[TEST]` blocks replacing the JSON dump | ✅ `1eddaea` |
| `STATUS.md` | Entry under "Not committed" marking it scaffolding | ✅ `1eddaea` |

**Landed after this plan was drafted, and required to reach the display:**
`src/app/app/crawl/crawl-client.tsx` now carries the Run ID from the index check into the workflow
gate and renders a **Continue to Workflow →** link (`aa56c58`). Before that, `unlockWorkflow` had
zero callers, so `ProjectForm` was unreachable and this display could not be opened at all.

## Verification

The proof is the live endpoints with a real Run ID, not a green build. **1 of 7 done.**

1. ✅ `npx tsc --noEmit` — clean before this work, clean after
2. ❌ `npm run dev`, then sign in — `/api/cw` returns 401 without the `gcc_access` cookie
   (`route.ts:19-24`)
3. ❌ On `/app/crawl`, type the project URL and leave the field. The index check already returns the
   Run ID — `checkIndex` stores the whole `HostIndexed` row, and `indexed[url].runId` is it. There is
   nothing to look up, no readiness call and no crawl list
4. ❌ Click **Continue to Workflow →** (it appears under the project field once the row comes back
   indexed with a run), then open the `[TEST]` blocks on the New Project form
5. ❌ **Route 1 passes if:** homepage URL matches the project URL, `builtAtUtc` is the expected crawl,
   headings nest by level, at least one node shows a link count
6. ❌ **Route 2 passes if:** pages come back with non-empty `blocks`, heading blocks carry `level`, and
   the anchor total is non-zero
7. ❌ Network tab: both calls `200`, non-empty bodies

A `404` on either means the Run ID is not a run owned by this user
(`GccV2ProjectSiteController.cs:190-192`, `GeekCrawlerController.cs:233`) — a wrong-run-id result,
not a bug in the display.

## Not in this plan

- Publishing blocks from Geek-Crawler-Rag (a run-scoped route over `MongoCorpus.iter_pages` plus a
  GeekAPI facade) — the only way to build structure *from RAG*, and the migration target `AGENTS.md`
  points at for moving `Build` off raw HTML
- A v1 route `api/geek-content-creator/project-site/runs/{runId}/site-structure`, matching the
  `hierarchy-match` route already at `GccController.cs:1134`, if this becomes permanent
- `HierarchyContextPanel` copy still says "site_analysis_page_section_trees" and
  "site_analysis_profiles.Id" (`:211-215`) though the code now calls the v1 run-id route — belongs
  with `plans/remove-site-analyzer.md`

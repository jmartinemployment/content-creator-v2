# Restore v1's crawl UI

## Context

`/app/create` today is a URL box, a checkbox and two textareas. That is not v1's crawl UI — it is
what I built after cutting v1's 930-line crawl client down to 170 lines and rewiring it. The
affordances that made it useful for verifying a crawl went with it.

v1's crawl UI (`GeekContentCreator/src/app/app/site-analyzer/site-analyzer-client.tsx`) gave the
operator:

1. Domain input, **Analyze** / **Cancel**, and live step progress
2. An **existing crawl picker** — select a previous crawl instead of re-running one
3. **`SiteHeadingHierarchy`** — the heading tree, h2/h5/h6 nesting visible
4. **REPORT 1 — BEFORE ANY PROCESSING WHATSOEVER** — pages as crawled: URL, Title, headings raw and
   in order
5. **REPORT 2 — AFTER DATA HAS BEEN INSERTED INTO THE DATABASE** — the same pages re-fetched from the
   store, *"Compare with REPORT 1 to verify lossless"*
6. Gaps list and start-a-create-from-a-gap

**The two reports are the point.** They are how an operator proves headings survive the crawl → store
round trip. Every claim in the grounding work depends on that surviving — h6 carries tool names, h5 is
the keyword level, h2 are message pillars — and there is currently no way to see whether it does.

`src/components/SiteHeadingHierarchy.tsx` is still in this repo, unused. `CrawlPanel.tsx` is here too
and byte-identical to v1's, but nothing rendered it in v1 either — it was already dead. Do not restore
that one.

## What changes from v1

v1 drove this from Site Analyzer endpoints, which are retired. The same UI is backed by Geek-Crawler
and the RAG index instead. Endpoints that already exist:

| UI element | Source |
|---|---|
| start a crawl | `POST /api/geek-crawler/crawls` with `crawlType: project-site` |
| existing crawl picker | `GET /api/geek-crawler/crawls?crawlType=project-site` |
| heading hierarchy | `GET api/geek-content-creator-v2/project-site/runs/{runId}/site-hierarchy` |
| REPORT 2 (from store) | `GET api/geek-content-creator-v2/project-site/runs/{runId}/pages` |
| indexed? | `POST api/rag/hosts-indexed` |

**REPORT 1 cannot be restored as v1 had it.** v1 held the crawl output in the browser before insert.
The crawler is now a separate local process, so nothing pre-insert reaches this page. Two honest
options, and this is the one real decision in the plan:

- **Drop REPORT 1**, keep REPORT 2 plus the hierarchy. Loses the lossless comparison.
- **Have the crawler report its own counts** — it already builds a reject taxonomy and page counts
  (`Geek-Crawler-v2 a64e915` sends a crawl report on every terminal transition). REPORT 1 becomes
  "what the crawler says it collected" against REPORT 2 "what the store holds". Same question
  answered, different provenance, and it survives the crawler being remote.

Recommend the second.

## Collapsible project-site heading hierarchy

The existing `src/components/SiteHeadingHierarchy.tsx` is 54 lines and is **not a tree**: one
`<details>` wrapper around a flat `<ul>`, with nesting faked by `paddingLeft: (level-1) * 0.75rem`.
Every page's headings are dumped into one list. On a site of any size it is unreadable, and no branch
can be collapsed.

Replace it with a real collapsible tree for the project site:

- **Per page**, collapsible — URL and title as the summary, its heading tree inside.
- **Per heading node**, collapsible where it has children — an h2 collapses its h5s, an h5 collapses
  its h6s.
- **Anchors under a heading shown on the node**, since that is what `HarvestTools` reads. An h6 with
  its links visible is the thing being verified.
- Collapsed by default past the first level, so a 2,500-page crawl opens usable.

**Feed it from the real tree, not the flat array.** `GccV2HeadingNode` carries `Level`, `Children` and
`Links`, and `GET api/geek-content-creator-v2/project-site/runs/{runId}/site-hierarchy` returns it.
The current component takes `pages[].headings[]` — a flat list where the nesting was already lost, so
indentation is a guess about structure rather than the structure itself. Consuming the hierarchy
endpoint means what is drawn is what `GccV2HierarchyToolMatch` will actually match against.

Delete `SiteHeadingHierarchy.tsx` once the tree lands. Nothing renders it today, and leaving a second
component that draws the same data from a flatter source is how the wrong one gets used later.

## Work

- `src/components/ProjectSiteHeadingTree.tsx` *(new)* — the collapsible tree above, over
  `GccV2HeadingNode`.
- `src/app/app/create/create-client.tsx` — restore the structure from v1's client: progress, existing
  crawl picker, the heading tree, and the reports. Keep what was added since and is correct:
  the index check (green/red per URL), partner and competitor fields, one-URL-per-project-site.
- `src/services/gcc-api.ts` — add the run pages and site-hierarchy calls; `listGeekCrawls` already
  exists for the picker.
- Keep `parseLines`. Do not reinstate `crawl-seeds.ts` — the index answers validity.
- Leave `CrawlPanel.tsx` alone; it was dead in v1.

## Verify

1. `npm test`, `npx tsc --noEmit`, `npm run build`.
2. Pick an existing crawl from the picker and confirm the tree renders real nesting — an h2 collapses
   its h5s, an h5 collapses its h6s, and anchors show on the h6 node. That is the structure
   `GccV2HierarchyToolMatch` matches against and `HarvestTools` reads.
   Specifically check `/tools` survived: `DEFAULT_SECTION_QUOTAS` caps `tools: 10`, which the
   project-site profile disables. If that page is thin, the profile did not apply and tool matches
   will silently degrade.
3. Run a project-site crawl and confirm progress advances, then that REPORT 2 lists the pages.
4. Compare the crawler's reported page count against REPORT 2's row count. A gap is the silent
   shortfall this UI exists to make visible.
5. Confirm the project-site URL still shows red until the crawl is indexed — 0 project-site vectors in
   Qdrant today.

## Already shipped today — do not rebuild

- **Index validation** — `POST api/rag/hosts-indexed` → `POST /v1/index/hosts`, green/red per URL on
  all three fields, checked on blur. Verified live. `crawl-seeds.ts` was deleted because a malformed
  URL has no host and so reports no index; syntax checking answered nothing the index does not.
- **Project-site crawls go to Geek-Crawler** — `POST /api/geek-crawler/crawls`, `crawlType:
  project-site`. Returns `{ run, seedsAccepted, rejected }`.
- **"Use existing site"** is answered by the index, not by counting crawl runs.

## Blocked on

Verifying any of this needs a project-site crawl that has actually run. There are none: 0 project-site
runs in Mongo, 0 project-site vectors in Qdrant. The run created from `/app/create` sits at `external`
with 0 pages, waiting for Geek-Crawler-v2 to be run locally against its seed — GeekAPI creates the run
and deliberately will not crawl it.

Until that happens the picker, the tree and both reports are empty. The UI can be built, typechecked
and built clean, but **not seen working**, and none of the verification steps above can be performed.

## Related plans

- `plans/site-grounding-on-geek-crawler.md` — Stages 0–4 of the crawler migration. Stage 2 is blocked
  on the same missing crawl.
- `plans/validate-partner-competitor-urls.md` — the index check, now shipped.

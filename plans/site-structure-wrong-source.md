# Site structure reads the wrong source; Markdown is obsolete and still present

Two defects. The first is that structure is derived from re-parsed HTML in an older store instead of
the crawler's typed `blocks`. The second is that Markdown — **obsolete**, per Jeff 2026-09-20 — still
has 186 references in GeekBackend and three live database columns.

All work is in **GeekBackend**. Nothing in `content-creator-v2` changes — its client and display are
correct and already call through `/api/cw`.

## 1. The wrong method — a live 500

`GET api/geek-content-creator-v2/project-site/runs/{runId}/site-hierarchy` returns **500** for
`c0040c49-c756-4b7a-84e6-202340e814d2`, a Run ID resolved from `hosts-indexed` (verified in the
browser 2026-09-20).

It is not an auth or missing-run failure — both of those are explicit returns, and
`HttpGccV2Repository.GetAsync` yields `null` on any non-success (`:829`), so an unknown run gives
**404**. A 500 means the run was found and something after it threw:

```
GccV2ProjectSiteController.GetSiteHierarchy          :187
  → LoadAllPagesAsync           every page of the run, full Html, batches of 100
  → GccV2SiteHierarchyFromCrawl.Build(run.SiteUrl, stored)
      → GccV2HeadingTreeBuilder.Build(p.Html!)       re-parses markup with HtmlAgilityPack
```

**Why it is the wrong method regardless of the exception.** `GccV2ProjectSiteCrawlPageDto` carries
`Html` and no `Blocks` — a different, older store from the geek-crawler pages this crawler ingests.
So heading levels and anchors are derived **twice**, from two representations: once in
`Geek-Crawler-v2/src/crawl/extract-content.ts` into typed `blocks`, and again in C# out of raw HTML.
Same drift class as CLAUDE.md §1a.

**Fix:** change 1 of `Geek-Crawler-v2/plans/move-crawl-reads-to-geekapi.md` —
`GET api/geek-crawler/crawls/{runId}/site-structure`, assembled from stored `blocks`, with
`site-hierarchy` delegating to it and keeping its own page filter. `GccV2HeadingTreeBuilder`'s HTML
path is deleted once nothing calls it.

Pages carrying no `blocks` are excluded **and counted**, with the count on the response. No fallback
to parsing `contentHtml`: missing blocks is terminal for that page.

## 2. Markdown columns still exist in the database

The live code is clean — **zero** hits across GeekBackend for `MarkdownVerified`, `no_markdown`,
`crawler-markdown`, `AssignmentMarkdown`, and `MarkdownReadyAt` appears in no entity, DTO or
`DbContext`. `AGENTS.md` claims two of those still exist; that is stale.

What remains is the schema. Two migrations added columns nothing maps any more, and no later
migration drops them:

| Migration | Table | Columns |
|---|---|---|
| `20260907120000_AddGeekCrawlerPageMarkdownFields` | `crawl_pages` | **`Markdown`**, **`MarkdownBackfilledAt`** (also `Title`, `Excerpt` — those stay) |
| `20260908123100_AddGeekCrawlerRunMarkdownReadyAt` | `crawl_runs` | **`MarkdownReadyAt`** |

`Markdown` on `crawl_pages` is a corpus column. It is forbidden by CLAUDE.md §1a, and it is the
column whose emptiness classified 5,274 pages `no_markdown` before they were deleted on 2026-09-18.

**Fix:** one new migration dropping `crawl_pages.Markdown`, `crawl_pages.MarkdownBackfilledAt` and
`crawl_runs.MarkdownReadyAt`. Do **not** edit the two existing migrations — they are applied history.

Check row counts for non-null `Markdown` before dropping. If any page still holds Markdown and no
`blocks`, that page is unusable either way and the drop only makes it honest — but the number belongs
in the commit message, not in a guess.

## 3. Correct the docs that assert otherwise

`content-creator-v2/AGENTS.md` and `.claude/CLAUDE.md` both say `MarkdownVerified` and
`MarkdownReadyAt` are "live identifiers pending rename". Neither is in the code. Say what is actually
left: two unused database columns and one run column, pending the drop above.

## 4. Markdown is obsolete — all 186 hits go

Stated by Jeff 2026-09-20: **Markdown is obsolete.** Not "forbidden as a corpus format with two
exceptions" — obsolete. The carve-outs in CLAUDE.md §1a for an operator-supplied asset and a
human-read report are superseded by that; the docs get corrected in step 3 rather than cited back.

`grep -rni markdown --include="*.cs"` over GeekBackend returns **186** lines. They are not one job:

| Group | Where | What removing it means |
|---|---|---|
| **Corpus / gating** | the two migrations above | Drop the columns. Pure deletion, nothing reads them |
| **Prompt instructions** | `ContentPromptBuilder.cs` (30), `GccV2WriteService.cs` (15), `ClaudeContentGenerator.cs`, `OpenAiContentGenerator.cs`, `GccV2ToolPagePromptBuilder.cs`, `GccV2CreateLibraryWriter.cs`, `GccV2FirstPartySkillSeeder.cs` | **A decision, not a deletion.** These tell a model to return Markdown. Drafts have to come back as *something* — decide the replacement before touching them, or generation breaks |
| **Response parsing** | `LlmResponseJsonParser.cs` (7), `GccGenerateService.cs` (8) | Strips Markdown fences off model output. Dies with the instructions above, in the same change, or drafts arrive fenced and unparsed |
| **Connector MIME types** | `GccV2DriveFilesClient.cs`, `GccV2SharePointGraphClient.cs`, `GccV2GscKnowledgeService.cs`, `GccV2UrlKnowledgeService.cs`, `GccV2SharePointKnowledgeService.cs`, `GccV2DriveKnowledgeService.cs` | `text/markdown` on operator-supplied files. Removing it means those uploads are **rejected**, not silently accepted and mishandled — that is the fail-closed reading and it needs saying out loud to whoever uploads one |
| **Tests** | `GccV2UnifiedRagTests.cs` (14), `GccV2ArtifactChangeOverTimeTests.cs` (4) | Follow whatever the above become |
| **`GeekSa2Read/*`** | export reader/builder | Reads a Site Analyzer 2 export format. Site Analyzer is obsolete too, so this goes with it rather than being preserved for compatibility |

**Sequence matters.** The corpus columns can be dropped today — nothing reads them. The prompt and
parsing groups are a single coordinated change and must not be started until the replacement output
format is chosen; deleting the instruction without the parser, or either without a decision, produces
drafts that fail to parse with no error at the boundary.

**The replacement format is the open question, and it is not mine to pick.** The candidates are the
same typed `blocks` the crawler emits, HTML, or plain text. Blocks would make one representation
serve corpus and draft alike, which is the argument the rest of this plan rests on.

## Verify

1. `GET api/geek-crawler/crawls/{runId}/site-structure` on `c0040c49-…` returns a tree: headings nest
   by level, anchors non-zero on pages that link out.
2. The Site structure panel on `/app/crawl` renders it — no 500, no empty tree.
3. A run whose pages predate typed blocks reports every page excluded for missing `blocks`.
4. `\d crawl_pages` and `\d crawl_runs` show no Markdown column.
5. `grep -rni markdown --include="*.cs"` over GeekBackend hits only the two historical migrations and
   the new drop — 186 → 0 in live code.
6. A draft still generates and parses after the prompt/parser change, in whatever format replaced it.
7. An operator uploading a `.md` file gets a clear rejection, not a silent accept.
8. `dotnet test` in GeekBackend.

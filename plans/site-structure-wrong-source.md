# Site structure reads the wrong source; Markdown is obsolete and still present

Two defects. The first is that structure is derived from re-parsed HTML in an older store instead of
the crawler's typed `blocks`. The second is that Markdown — **obsolete**, per Jeff 2026-09-20 — still
had 186 references in GeekBackend. Both are now resolved — see §2 (withdrawn) and §4 (186 → 10).

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

## 2. Markdown columns exist only in a dead store — **withdrawn 2026-09-22, no drop**

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

**Withdrawn — there is no fix here, and proposing one was the error.** Jeff, 2026-09-22:
*"Geek-Crawler v1 is obsolete, retired and no writes from crawler activities are written to a
Postgres target."* The `geek_crawler` **Postgres** schema is not the crawl store — **Mongo is**
(`MongoGeekCrawlerService`). `GeekCrawlerDbContext` has said so in code the whole time (`:27`,
`:53-57`):

> *"Postgres is deprecated for geek_crawler — Mongo is the live store and nothing reads or writes
> `crawl_pages` through EF. These two are ignored rather than migrated: EF has no mapping for
> BsonArray, and adding columns to a table nothing populates would be schema for a dead path."*

That context already `Ignore()`s `ContentHtml`, `Blocks` and `ContentReadyAt` rather than migrating
them, on exactly that reasoning. **Dropping `Markdown` is the same dead-path work.** A Markdown column
in a store nothing writes is not a live Markdown surface, and a drop migration would add a schema
change, a rollback path and a startup migration step to a schema that is on its way out entirely.

**What I got wrong, and why it matters.** I wrote this section calling them "live database columns"
and drafted a migration to drop them. The premise was never checked — a table
name in a migration was read as evidence of a live store, when the DbContext two directories away
said the opposite in a comment. Same failure as §3 and §4: a cheap signal accepted as proof.

**The real question, if anyone wants it later:** retire the `geek_crawler` Postgres schema as a
whole — context, entities, migration runner at `Program.cs:ApplyGeekCrawlerMigrationsAsync` — not
three columns inside it. That is a separate decision and nobody has asked for it.

## 3. Correct the docs that assert otherwise — **DONE 2026-09-22**

`AGENTS.md`, `architecture.md`, both `CLAUDE.md` files and three plans asserted five deleted
identifiers as live code. All seven files now make the argument without naming them.

**The failure worth remembering, and the reason the names went rather than got annotated:** those
line numbers were copied forward between documents for weeks without one re-check. Root `CLAUDE.md`
says *"never write a rule down as enforced while code contradicts it"*; this was the mirror — code
written down as defective after it ceased to exist. A citation is a claim with an expiry date, and a
dead identifier in a document is not inert: it is what the next reader greps, and it reconstructs the
dead thing in their head. Annotating it "historical" does not help — the name travels in grep output,
the annotation does not.

## 4. Markdown is obsolete — **186 → 10, done 2026-09-22**

Stated by Jeff 2026-09-20: **Markdown is obsolete.** Not "forbidden as a corpus format with two
exceptions" — obsolete. The carve-outs in CLAUDE.md §1a for an operator-supplied asset and a
human-read report are superseded by that; the docs get corrected in step 3 rather than cited back.

`grep -rni markdown --include="*.cs"` over GeekBackend returned **186** lines when this was written.
It now returns **10**, every one inside the two applied migrations in §2. The work landed across
`6692aac`, `b51ab94`, `ec67416`, `9564697`, `c52a779`, `c3fcfc8`, `49b68ff` and `5a72445`.

**Correction — my own error in the table below.** The "Prompt instructions" row said those files
*"tell a model to return Markdown"* and priced the change as a decision that would break generation.
That was wrong, and it was wrong because the row was built from grep **counts** without reading the
lines. All 30 hits in `ContentPromptBuilder.cs` were *prohibitions* — `"no markdown fences"`,
`"never markup or Markdown syntax"`, `"Plain URL only — no [text](url) markdown"` — as were all 6 in
`GccV2ToolPagePromptBuilder.cs` and all 3 in `OpenAiContentGenerator.cs`. Deleting them would have
removed the guard, not the Markdown. Only three sites ever instructed a model to emit Markdown, and
all three are now gone.

The table is kept as written, with that correction standing over it:

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
4. ~~`\d crawl_pages` and `\d crawl_runs` show no Markdown column.~~ — **withdrawn**, see §2. Those
   tables are in the deprecated `geek_crawler` Postgres schema; Mongo is the store and nothing writes
   them. Nothing to verify and nothing to drop.
5. `grep -rni markdown --include="*.cs"` over GeekBackend hits only the two historical migrations.
   — **DONE**: 186 → 10, and the 10 are exactly those two migrations, against the dead schema.
6. A draft still generates and parses after the prompt/parser change, in whatever format replaced it.
   — **DONE**: the replacement is structured JSON → `ContentDocument`, not a second markup format.
7. An operator uploading a `.md` file gets a clear rejection, not a silent accept. — **Superseded.**
   `text/markdown` stays on the connector allowlists: an operator-supplied asset is the §1a carve-out
   and is not corpus. Related, decided by Jeff 2026-09-22: **sanitising is not producing** —
   `LlmResponseJsonParser`'s `InlineLinkSyntax` (`:713`) and `CodeFence` (`:579`) strip Markdown out
   of model output and therefore stay.
8. `dotnet test` in GeekBackend.

# Agent guidance — content-creator-v2

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

**Correctness over expediency. Always. No exceptions.**

| Authority | Path |
|-----------|------|
| Service boundaries + current state | this file |
| Architecture detail | [`architecture.md`](architecture.md) |
| Non-negotiables + honesty | [`.cursor/rules/`](.cursor/rules/) (alwaysApply) |

## Target architecture — one concern per service

| Service | Owns | Must not |
|---|---|---|
| **Geek-Crawler** | ALL crawling: `partner`, `competitors`, `geo`, `project-site`, future types | — |
| **Geek-Crawler-Rag** | Retrieval + verification over what was crawled | **Never generates** |
| **GeekAPI** | Service layer / BLL. Generation, grounded on verified block text | **No crawler, no browser** |
| **Geek-SEO** | Site + gap analysis (owns Site Analyzer) | — |
| **Content Creator** (this repo) | Passes a **Run ID** → GeekAPI → displays results | **No crawler, no browser** |

Do not re-expose Site Analyzer through Content Creator. Gap analysis is Geek-SEO's and reaches
Create via RAG. It was retired from the v2 path deliberately (`5072820`).

RAG is **Library-only — retrieval and verification**. `/v1/generate` and `rag-generate.*` were
removed and must never be revived. See `.cursor/rules/geek-crawler-rag.mdc`.

## Markdown is forbidden

**Markdown is not a corpus format, not a verification target, and not an interchange format between
these services.** There is no Markdown converter anywhere in the crawl path
(`Geek-Crawler-v2/src/crawl/extract-content.ts`) and nothing may reintroduce one.

| Concern | The method |
|---|---|
| Corpus body | Typed **`blocks`** — `heading`(+`level`) · `paragraph` · `listItem` · `quote` · `code` · `row`(`cells`) · `term` · `definition`, each carrying `text`, `html`, `anchors` |
| Display / audit | **`contentHtml`** — the clean semantic fragment |
| Page as a string | **One shared block→text projection**, `Geek-Crawler-Rag/src/geek_crawler_rag/block_text.py` (`derive_plaintext_from_blocks`) |
| Quote verification | `citation_verify.quote_in_text(quote, plain_text, blocks)` against that same projection |
| Run readiness | **`ContentReadyAt`** — never `MarkdownReadyAt` |

Chunk text and verification text come from the *same* projection deliberately: a quote is taken from
a retrieved chunk and then matched against the page, so two implementations of "join the blocks" make
correct citations fail. Do not write a second one.

**This is not stylistic.** The crawler migrated off Markdown and the Library did not; every page
then classified `no_markdown` and 5,274 of them were deleted from Mongo with their Qdrant points on
2026-09-18. Writing "Markdown" into a doc is how the two halves drifted in the first place.

**Forbidden, concretely:** `MarkdownReadyAt` / `MarkdownBackfilledAt` / `MarkdownBackfillSkip` as
readiness or gating signals; a `no_markdown` reject reason; HTML→Markdown conversion at any hop
(crawl, ingest, index, extraction, prompt assembly); `parserId: "crawler-markdown"`; synthesizing
Markdown in order to re-parse it with `#`/`[text](href)` regexes. Markdown remains legitimate in
exactly two places, neither of them the corpus: an **operator-supplied asset** (`text/markdown` in
`asset_context.py`) and a **generated report** a human reads.

## Crawl types

`CrawlTypes` (`GeekApplication/Models/GeekCrawler/CrawlTypes.cs`):

- `partner`, `competitors` — third-party, feed RAG
- `local` — **means GEOGRAPHY (local SEO), not the own site.** `Geo` is the better name; the stored
  value stays `"local"` unless migrated. Never conflate it with the project site.
- `project-site` — the operator's own site. **It exists**: `CrawlTypes.ProjectSite = "project-site"`,
  in the `Valid` set. It is not a rename of `local`. (This file claimed it did not exist until
  2026-09-18; check `CrawlTypes.cs` before trusting any claim here about which types are live.)

Sites exceeding 50,000 pages are normal. `SameOriginBfsCrawler` documents itself as "Unlimited
same-origin BFS per host"; that assumption is the reason the corpus reached ~223k pages / 93 GB with
the top 12 runs holding 75% of it. **Any new crawl type ships with a scope policy — depth, path
allow/deny, page budget — on day one.**

**Crawl types are not one size fits all.** Scope and *retention* are separate axes, because the types
feed different consumers:

| | Project site | Partner / competitor |
|---|---|---|
| Consumer | `GccV2SiteHierarchyFromCrawl.Build` → `GccV2HierarchyToolMatch` | RAG retrieval + quote verification |
| Must retain | **Raw HTML** — DOM tree, heading levels, anchors under a heading | Verbatim prose |
| Scale | Own site, bounded | 50,000+ pages, scope hard |
| Failure mode if wrong | Tools/partners silently stop being found — **no error, fewer matches** | Quote verification fails, loudly |

**Grounding cannot be derived from the RAG *text* path.** RAG's page string is the flat block
projection (`block_text.derive_plaintext_from_blocks`): block text joined on blank lines, table rows
on `" | "`, inline markup stripped. Every href, every tag and every heading marker is discarded, so
h6→anchor tool links, "the keyword matched an h5", and h2 message pillars are unrecoverable **from
that string**. `Build` filters on `p.Html` for exactly this reason.

The *blocks* are a different matter: `heading.level`, per-block `html` and per-block `anchors` are all
retained, so structure is recoverable from `blocks` even though it is not recoverable from the
projection. That is the migration target for `Build` — not a Markdown slice, and not a second text
projection.

**Raw HTML is needed at derivation time, not forever.** Everything project-site grounding consumes
lives in the derived tree, not the source:

| Purpose | Reads |
|---|---|
| Hierarchy / keyword match | `GccV2HeadingNode.Level` + `Children` |
| Tools & partners | `GccV2HeadingNode.Links` (anchors under a heading) |
| Don't repeat ourselves | `RelatedPageDto(Url, Title, Headings[0..4], Excerpt≤120)`, 12 pages max — `BuildPartialInformationGain` |
| Paragraphs | **not consumed** |

So the rule is: HTML must be present **when `GccV2SiteHierarchyFromCrawl.Build` runs**. Once
`GccV2PageHierarchy` exists, the HTML for those pages is dead weight and can be dropped. Given
`crawl_pages.Html` is ~98% of corpus size, that is the difference between project-site being expensive
once and expensive forever.

This does **not** apply to partner/competitor pages, whose HTML is still read at extraction time
(`GccV2GeekCrawlerResearchResolver.cs:372,583`).

`crawl_pages.Html` is load-bearing: partner/competitor extraction reads it directly
(`GccV2GeekCrawlerResearchResolver.cs:372,583`) and it is ~98% of corpus size. Do not drop it for
space until extraction moves to `blocks`.

## Crawls are atomic. A run is binary or it is not a run.

A crawl cannot run inside a database transaction — it takes minutes to hours, Mongo's
multi-document transactions default to a 60-second lifetime, and crawl documents carry multi-MB HTML.
The commit is therefore placed on a boundary that is atomic on its own: **a single-document status
flip**. Batch-publish semantics, not 2PC.

| Phase | Rule |
|---|---|
| **create** | A crawl always gets its **own** run. The run currently published for the slot is never touched. Abandoned staging in the slot is reclaimed first — it never published, so nothing read it |
| **publish** | A slot `(ownerUserId, crawlType, seedKey)` resolves to its newest **`complete`** run. A crawl in flight is invisible **by construction**, not because a caller remembered to check |
| **commit** | `PatchRun → complete`. One document, one write. Before it readers see the old corpus whole; after it, the new corpus whole |
| **retire** | The superseded run is deleted **after** the commit. Failing here costs disk, never correctness — two complete runs resolve to the newer by `CreatedAtUtc` |
| **abort** | `failed`/`cancelled` purges vectors and pages. The run **document** survives carrying `ErrorSummary`; it stays uncommitted and therefore unreadable |

**Never purge before the replacement exists.** The original replace-on-recrawl purged the old run and
re-used its id *before* the new crawl ran, so a crawl dying at page 3 of 2,500 destroyed the good
corpus with nothing to roll back to. Peak cost of doing it correctly is 2x for one site during its own
re-crawl; only one copy is ever visible.

**`publishedOnly` is explicit at every call site.** Partner and competitor evidence resolution passes
it too: citing a partner site mid-crawl is the same defect as grounding on a partial project-site
crawl. Vectors are always purged **before** their pages — an index citing deleted rows can never be
verified.

## Fail closed. No middle states.

The system is binary by design: it either has real evidence and proceeds, or it refuses and says why.

- No fallback methods, no auto-repair, no default substitution (`.cursor/rules/no-fallbacks.mdc`)
- No stubs, no success-shaped empty results (`.cursor/rules/no-stubs.mdc`)
- Read env vars so `""` counts as absent — `??` passes an empty string through and has caused two
  production auth outages
- **Partial extraction is failure.** Catching a per-page error and logging "page skipped" is a middle
  state; it hid a total extraction outage behind thirteen drafts of filler

## The direction: version one

**V2 lost features and was rolled back. Version one is what is being implemented.**

This reverses the migration older text in these docs describes. Anything asserting a v2 cutover —
"v1 can be deleted after cutover", "new work uses v2 prefix only", "do not couple into v1 Content
Writer" — records the *previous* direction and is not the instruction. The repo name and the
`ContentCreatorV2/*` namespace are historical, not a statement of direction.

**New work extends `api/geek-content-creator` (v1).** Do not add calls to the `-v2` surface, and do
not reach for a `-v2` endpoint merely because one already exists — existing is not the same as
correct when the direction is v1.

## Current state (2026-09-18)

- **`GccController` is restored and live** — `GeekAPI/Controllers/ContentCreator/GccController.cs`,
  1,747 lines, `[Route("api/geek-content-creator")]`, **30 routes**. Restored in two steps:
  `714ef8d` (+1,175, minus Site Analyzer) then `998f5ad` (the 7 Project endpoints retired
  2026-08-06).
- **The "~15 dead endpoints" claim was true and is now false.** Verified 2026-09-18 by diffing every
  frontend call against the live route table: **all 26** `api/geek-content-creator/*` endpoints the
  frontend calls exist. Do not re-copy that number out of an older doc.
- **Exactly three frontend calls still 404, all Site Analyzer:** `CreateStartForm.tsx:145`
  (`POST .../site-analyzer/analyze`), `CreateStartForm.tsx:161` (polls `GET .../site-analyzer/{id}`),
  `HierarchyContextPanel.tsx:137` (`GET .../site-analyzer/profiles/{id}/hierarchy-match`). There is
  **no `site-analyzer` route anywhere in GeekAPI** — `582a171` deleted v1's; `5072820` removed the
  three v2 replacements it had added.
- **Drafting is OFF by default** — `ContentCreatorV2:DraftingEnabled=false` stops every create before
  the first paid model call, after the free evidence gates. Model default is `gpt-4o-mini`.
- **`GET /api/geek-content-creator/creates` returns 500** — the route exists; the throw is inside
  `ListCreatesAsync`. It is where every create lands after it is made.
- **Project-site crawling still runs inside GeekAPI**, which is why Chromium is installed into the
  API image (`Dockerfile:33`). That is the one live violation of the boundaries above.

### Input the UI collects and then discards

Verified 2026-09-18. Not dead endpoints — fields with no destination at all:

| Field | Where | What happens |
|---|---|---|
| Partner URLs, Competitor URLs | `crawl-client.tsx` | Index-checked on blur, coloured, then forgotten. Never persisted. `startGeekCrawl` is the only function that would take them and has **zero call sites** |
| Target keyword | `ContentBriefPanel.tsx:317` | Only reaches a body inside `ensureCreateId()`, which short-circuits when a create exists — so on every live path it is dropped |
| All of `SerpIngestPanel` | orphaned | Zero importers; its `onCurated` has no implementation |

`/app/projects/[id]` and its eight panels sit behind a collapsed `<details>` on a route with **no
inbound link**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

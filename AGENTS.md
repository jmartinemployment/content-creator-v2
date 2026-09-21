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
| **Geek-Crawler-v2** | ALL crawling: `partner`, `competitors`, `geo`, `project-site`, future types | — |
| **Geek-Crawler-Rag** | Retrieval + verification over what was crawled | **Never generates** |
| **GeekAPI** | Service layer / BLL. Generation, grounded on verified block text | **No crawler, no browser** |
| **Geek-SEO** | Site + gap analysis | **Site Analyzer is obsolete — never call it** |
| **Content Creator** (this repo) | Passes a **Run ID** → GeekAPI → displays results | **No crawler, no browser** |

**`Geek-Crawler` (the original repo) is dead. Nothing deploys from it.** `Geek-Crawler-v2` replaced
it — confirmed by Jeff 2026-09-20. All crawling is Geek-Crawler-v2's: it is where `project-site`
scope and reject reasons are still being fixed (`f3addce`, `02469bd`, both 2026-09-19), while the old
repo stopped at 2026-09-05.

It is a git-history source, nothing more — the same standing as `GeekContentCreator`. Do not call it,
deploy it, cite its contents as current behaviour, or read a defect there as a live defect. A
"Geek-Crawler" in older text means the v2 repo unless it is explicitly naming history.

**Site Analyzer is obsolete. Geek-Crawler-v2 replaced it.** Site structure — headings, heading
levels, anchors under a heading, related pages — now comes from a Geek-Crawler-v2 `project-site`
crawl run and is read back by **Run ID**:
`GET api/geek-content-creator/project-site/runs/{runId}/hierarchy-match`, derived from the crawl by
`GccV2SiteHierarchyFromCrawl.Build`. Nothing crawls at read time.

Do not call a `site-analyzer` route, restore one, or treat a Site Analyzer profile id as grounding.
It was retired from the v2 path deliberately (`5072820`) and GeekAPI's v1 route was deleted by
`582a171`. Gap analysis remains Geek-SEO's and reaches Create via RAG.

**The trap, as it now stands:** the value a Site Analyzer sweep would delete is a **Geek-Crawler-v2
run id**, whatever the field is called. On the live path it is called what it is —
`gcc_projects.project_site_run_id`, `projectSiteRunId` in the browser — and it is resolved by the
index check in `ProjectForm`. Without it a project has no crawl to ground on, which is why the form
refuses to create one.

The chain this paragraph used to name — `ProjectForm` → `createProject` →
`project.siteAnalysisProfileId` → `HierarchyContextPanel` — no longer exists: `ProjectForm` was
rewritten onto `projectSiteRunId` and `HierarchyContextPanel` is not in this repo at all. The legacy
spelling survives only on `gcc_creates`, whose column stays `SiteAnalysisId` because renaming a
column over live rows buys nothing.

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

## One project URL, one run. Re-crawl refills it in place.

A crawl cannot run inside a database transaction — it takes minutes to hours, Mongo's
multi-document transactions default to a 60-second lifetime, and crawl documents carry multi-MB HTML.
So the run row is the unit of bookkeeping, and its **id is stable for the life of the URL**.

**A slot `(ownerUserId, crawlType, seedKey)` owns exactly one run, and re-crawl reuses it.**
`StartCrawlAsync` computes `seedKey`, resolves the slot with
`GetRunForSlotAsync(owner, type, seedKey, publishedOnly: false)`, and hands any hit to
`RequeueExistingRunAsync`, which patches **the same run id** back to `pending`. A new run row is
created only when the slot is empty. (Verified 2026-09-20, GeekBackend `f675e22`,
`GeekCrawlerService.cs`.)

| Status in slot | What re-crawl does |
|---|---|
| `pending` / `running` | Cancelled, `TryRecoverOrphanAsync`, re-woken — same id |
| `external` | Forced to `pending` so the .NET worker takes over — same id |
| `failed` | Resumed, **saved pages kept** — a failed run is partial, not wrong |
| `complete` / `cancelled` | `ClearRunCrawlDataAsync(existing.Id)`, then the crawl refills the same id |

**Clearing a complete run's pages and re-crawling into the same id is correct, not a bug.** The
alternative — a fresh run per crawl, the old one retired afterwards — is what was tried before, and
it accumulated runs until the corpus was unmanageable. A site has one current crawl; the id that
names it should not churn every time it is refreshed.

That is what makes the **client record** the right home for a Run ID. The value is stable, so it is
stored once when the operator confirms the site, not re-resolved per request and not copied onto
every project.

**The consequence to respect: a Run ID is not evidence.** Between the clear and the next commit the
run exists and its corpus does not. So readers gate on **status**, never on the id resolving —
`publishedOnly` is the mechanism, and a run mid-refill must read as not-ready rather than as an empty
success. This is the same fail-closed rule as everywhere else, applied to the window a re-crawl opens
on purpose.

## The client owns the runs. A Run ID names one URL, never a client.

**Run ID = one URL.** `ComputeSeedKey` is `SHA256(sorted seed URLs)`, so the slot key is derived
entirely from the URL. That is the whole identity: a run names a crawl of one URL, and nothing else.

**A client owns several of those pairs** — which is why the crawl page has three fields and only the
first is singular:

| On the client | Cardinality |
|---|---|
| `projectUrl` → `projectSiteRunId` | **exactly one** — the client's own site |
| partner URLs → run ids | many |
| competitor URLs → run ids | many |

**Do not make Client ID the Run ID.** It was considered on 2026-09-20 and rejected for reasons worth
keeping:

- The run id is stable per **URL**, not per client. A rebrand, a domain migration, even a
  www→apex normalization change produces a different `seedKey`, a different slot and a **new run id**.
  If the client's key were the run id, its key would change with its domain, breaking every project,
  create, version and approval pointing at it.
- A client has partner and competitor runs too, so the 1:1 breaks as soon as those persist.
- Client identity lives in `content_creator_v2` (Postgres); runs live in the crawl store (Mongo
  `crawl_runs`). Content Creator's job is to **pass** a Run ID, not to own crawl identity.
- A rename enforces nothing anyway — see below.

**Superseded, 2026-09-21 — the site URL and its Run ID belong to the project, not the client.**
Jeff decided this when the Project concept was defined, and `gcc_projects` implements it:
`site_url` and `project_site_run_id` are columns on the project row
(`plans/project-is-the-whole.md`). A client may run several projects over different sites or
microsites over time, and a project is the thing that targets one of them.

This paragraph used to say the opposite — "the client holds `projectUrl` and `projectSiteRunId`;
projects inherit and carry neither" — and that is no longer the design. The concern behind it was
real and is answered differently: the ten-copies problem came from `ProjectSummary` carrying a URL
that nothing owned, on a record that was really an article. A project owns its site because a
project *is* the engagement with that site; two projects on one site is two engagements, not a copy
of a fact.

**Rename done: `siteAnalysisProfileId` → `projectSiteRunId`.** The new tables use
`project_site_run_id` throughout, and the frontend type is `projectSiteRunId`
(`src/services/gcc-projects-api.ts`). The legacy name survives only on the retired blob-store path
and on `gcc_creates`, whose column is still `SiteAnalysisId` because renaming a column over live
rows buys nothing (`ContentCreatorDbContext.cs`). Never delete the field on a Site Analyzer sweep:
the name is legacy, the value is a Geek-Crawler-v2 run id.

**Correction, 2026-09-20.** This section used to assert the discarded design as fact — "a crawl always
gets its own run", "never purge before the replacement exists", plus create/publish/commit/retire/abort
phases. None of that is the code, and none of it is the intent.

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

**Generation is the exception, and it is not arbitrary: generation is RAG-grounded, and the
RAG-grounded path is `ContentCreatorV2/*`.** Root `CLAUDE.md` §1 says so outright — *"Generation is
GeekAPI-side (`ContentCreatorV2/*`), grounded strictly on corpus text that the Library half
retrieved and verified."* The v1 generate methods are not grounded that way, so drafting must never
go through them again. Confirmed by Jeff 2026-09-21: *"the way you actually generate Content is also
an exception — you will no longer create using v1 methods. i.e., RAG."*

Concretely, `/app/workflow` generates through `CreateDraftWorkspace` on `gcc-api`
(`generateGccCreate` / `reviseGccVersion` / `polishGccVersion` / `seoGccVersion` /
`approveGccVersion`). The v1 generate calls in `content-writer-api.ts` —
`generatePillarPlanContent`, `generatePillarBodyContent`, `generateBlogContent`,
`generateSocialPack`, `generateColdOutreachContent`, `generateImagePromptsContent`,
`generateToolsFromNames`, `generateToolsContent`, `generateAllContent`, `reviseProjectContent`,
`rewriteFromLatestVerdict`, `runReview` — have **no live caller**. Do not wire one back.

## Current state (2026-09-18)

- **`GccController` is restored and live** — `GeekAPI/Controllers/ContentCreator/GccController.cs`,
  1,747 lines, `[Route("api/geek-content-creator")]`, **30 routes**. Restored in two steps:
  `714ef8d` (+1,175, minus Site Analyzer) then `998f5ad` (the 7 Project endpoints retired
  2026-08-06).
- **The "~15 dead endpoints" claim was true and is now false.** Verified 2026-09-18 by diffing every
  frontend call against the live route table: **all 26** `api/geek-content-creator/*` endpoints the
  frontend calls exist. Do not re-copy that number out of an older doc.
- **No Site Analyzer call remains in this repo** — verified 2026-09-20. The claim that stood here,
  "exactly three frontend calls still 404" at `CreateStartForm.tsx:145,161` and
  `HierarchyContextPanel.tsx:137`, is **false**: `CreateStartForm.tsx` no longer exists, and
  `e6b3701` repointed `HierarchyContextPanel` at the v1 run-id route
  `project-site/runs/{runId}/hierarchy-match`. There is still **no `site-analyzer` route anywhere in
  GeekAPI** (`582a171` deleted v1's, `5072820` removed the three v2 replacements) and none is wanted
  — **Geek-Crawler-v2 supplies the structure now.** What survives is unreachable client-side
  scaffolding: nine proxy routes under `src/app/api/site-analyzer/**` with **zero callers**, plus the
  matcher at `src/proxy.ts:73`. Removal plan: `plans/remove-site-analyzer.md`.
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

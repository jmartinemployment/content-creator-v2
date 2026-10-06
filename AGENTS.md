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
crawl run, read back by **Run ID** from the crawl's typed `blocks` by
`GccProjectSiteStructureReader`. Nothing crawls at read time.

**The `hierarchy-match` route is gone, and was never called.** This paragraph named
`GET api/geek-content-creator/project-site/runs/{runId}/hierarchy-match` and
`GccV2SiteHierarchyFromCrawl.Build` as that read path until 2026-10-03, when both were deleted
(`363200e`, `c3219ac`) for having no caller — the frontend's `hierarchy-match.ts` is a pure library
with no fetch in it, and `getProjectSiteStructure` had zero call sites. So the documented path and the
working one had diverged: structure reaches generation through `GccProjectSiteStructureReader`, not
through an HTTP route.

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

## No tools sections on a pillar or a blog

**A tools section is one that lists tools with a heading per product. It is prohibited.** Jeff has
said this three times, most recently 2026-10-01:

> "All five tools are written about with the prose and carry a link to the appropriate tool page.
> No headings, no sections, just discussing how tool can help solve the Keyword & Angle for SEO
> matrix, period."

Five tools, in running prose, each linked to its tool page, no heading per tool. Write Tools owns
the standalone tools page; a pillar or blog that duplicates it is the shape being banned. Pillar and
blog are the same rule — no exceptions, no per-type variation.

**And the obligation the ban exists to protect.** Jeff, 2026-10-01:

> "Pillar is required; same as Blog and all other long-form content types, to discuss tools as a
> solution to the problem identified in the Angle for SEO Problem-Solution"

The ban says where tools may not go. It does not say why they are on the page, so a writer can
satisfy it by mentioning each partner once in passing and linking it — the letter of the rule with
none of its point. **The tools are the answer to the problem the angle identifies.** On a
Problem-Solution angle: name the problem, then show what each tool does about *that* problem, for
this keyword — not a general description of the product. A tool mentioned without saying what it
solves has not been discussed.

Carried by `ContentPromptBuilder.ToolsAsSolutionInstruction`, appended beside the ban at both long-
form call sites so the two travel together.

**Which types.** Pillar, Blog and Tool are the registered prompt sets; every other long-form type is
disabled (Jeff, 2026-10-01: *"if we ever get something stable with these three, we will turn our
attention other content types"*). So this lands on Pillar and Blog today — Tool is about one product
by definition and takes neither half — and any long-form type enabled later inherits both.

**The rule is specified in a prompt constant, not in a document.**

| Thing | Where |
|---|---|
| The instruction the writer is given | `ContentPromptBuilder.NoToolsSectionInstruction` |
| Prompts carrying it | `BuildArticleSectionBatchPrompt` (pillar), `BuildStandaloneBlogBodyPrompt` (blog) |
| The guard | `GccToolsSectionGuard`, run at `GccGenerateService:2789` (pillar) and `:3071` (blog) |
| The retry | `GccToolsSectionGuard.RetryInstruction` |

It names three prohibited shapes: `"Top Tools for ..."`, `"Choosing the Right Tools"`, and **a
heading per product with a product name in it**.

**The guard enforces that list and nothing beyond it, and this is where it goes wrong.** Both
failure directions shipped on 2026-10-01. *Stricter than the prompt* refuses work the writer was
never told to avoid — a bare `\btools?\b` match refused "How AI Tools Simplify Your Accounts
Payable Process", which lists nothing, and no retry could rescue it because every honest heading for
that material contains the word. *Looser than the prompt* lets through what the prompt forbids — a
purely structural test dropped "Choosing the Right Tools", so prompt and guard disagreed about the
same section. **Read one before changing the other.** They are one rule in two places and they drift
silently.

**Documentation lives in prompts here.** Asked whether this rule was documented, a search of
`plans/`, `docs/`, `*.md` and `.cursor/rules/` returned nothing and the answer given was "no
documentation exists" — while `NoToolsSectionInstruction` had spelled it out the whole time, with
the examples. A prompt constant is a specification: grep the code that instructs the model, not only
the files ending in `.md`.

**Removed, 2026-10-01:** `ContentPromptBuilder.BuildToolsPlatformListPrompt` and
`BuildToolsPlatformChildPrompt` built a pillar tools section with an h3 subtree per platform. They
had no callers, but they sat in the same file as the instruction forbidding that shape, and a named
builder reads as permission however dead it is. Gone, with their guidance helper and interface
declarations.

## The model never emits markup — one document model, one renderer

**The output must end up HTML, and exactly one thing may produce it.** `SectionHtmlRenderer`
(`GeekAPI/Services/Workflow/Services/Export/`) declares itself *"the only place tag characters are
produced in the whole pipeline"* and builds an HtmlAgilityPack DOM node-by-node from a
`ContentDocument`, so tags are balanced by construction and text is encoded automatically.

| Concern | The method |
|---|---|
| What the model returns | **Content. Never `##`, never `<h2>`** |
| Structure | `ContentDocument` — `Section` · `TextParagraph(Runs)` · `ListParagraph(Ordered, Items)` · `Run(Text, Bold, Italic, Href)` |
| Markup | `SectionHtmlRenderer`, and nowhere else |
| Headings | `ContentDocumentText.AllHeadings` / `TopLevelHeadings`, never a string parse |

**Asking the model for HTML is the same defect as asking it for Markdown** — it swaps which markup
the model invents instead of removing markup from its job, and produces a second solution that
outputs HTML.

**Markdown cannot carry this even in principle:** it has no paragraph token. A paragraph is a blank
line, so the boundary is whitespace every consumer re-infers. Seven typed corpus block kinds go in and **one** comes out — headings dropped by a `#` filter, list
markers trimmed to prose — failing open and returning raw Markdown as a paragraph when nothing
parses. `ListParagraph` and `Run.Href` already exist, so such a hop flattens structure the target
model holds natively, then rebuilds links with a hand-rolled `[text](href)` scanner.

**v2's writer did this and the code is gone (`5a72445`, 2026-09-22).** It is not named here on
purpose: a dead identifier left in a document is the thing the next reader greps and takes for a live
path. GeekBackend is down to **10** case-insensitive `markdown` hits in `.cs`, all inside two
migrations against the **deprecated `geek_crawler` Postgres schema** — Mongo replaced it and no
crawler activity writes to Postgres (Jeff, 2026-09-22). Those columns stay:
`GeekCrawlerDbContext:53-57` already refuses schema work on that table.

**Two known gaps, recorded rather than asserted away.** `ContentDocument` has no node type for
`quote`, `code` or `term`/`definition` — v1 had no exposure to RAG or to ingesting those pipelines,
so its document model is article-shaped. And `GccGenerateService`'s Create path still returns string
bodies (`GccController.cs:667`, `:674`), so the single-renderer rule holds on the orchestrator path
only. Both are Stage 4 in `plans/grounded-generation-and-serp.md`.

## Version 2 has never produced a document

**Jeff, 2026-09-21: "version 2 never produced one document, none, nada."** `GccV2WriteService` has
zero live callers (`GccV2JobWorker:562-563` routes to `V1Restore.GccV2V1WriteAdapter`) and
`ContentCreatorV2:DraftingEnabled` is unset everywhere. A path that never executes cannot have
written anything.

**So no claim about the quality of v2's output can be sourced from v2** — including "v2 fabricates
structure" (commit `08651ab`), the premise the whole V1Restore direction was built on. It is a claim
with no artifact behind it.

**Decided 2026-09-21: v1 writes; RAG's retrieval and verified quotes move to it.** Not because v1 is
cheaper — because v1 already holds the single correct output path (`ContentGenerationOrchestrator` →
`ContentDocument` → `SectionHtmlRenderer`), while v2 cannot preserve the structure it is grounded
on. The v2 write path is dormant. Whether it is deleted is open and unexecuted; nothing is removed
unasked.

## The project is the unit. No create is visible.

**Jeff, 2026-10-04: the unique key is the Project ID. The project contains the Brief, Generate and
Profile.** A project is one keyword and one brief; a second keyword is a second project. Plan:
`plans/fix-project-persistence.md`. Wire contract: `plans/project-api-contract.md`.

| Concern | The method |
|---|---|
| The page | `/app/projects/<id>?section=…` and nothing else. No `create` parameter, no create id on screen, no list of pieces |
| The brief and keyword | Loaded from the project, written to it when **Save** is clicked — `patchProjectBrief` → `PATCH projects/{id}/brief`, with the `version` it was read at |
| A stale save | Refused (409) with the server's sentence. Nothing is overwritten |
| An incomplete brief | Saves. Completeness gates Generate only |
| Save state | One line beside the button: "Saved to the server at HH:MM" or "Unsaved changes"; the browser warns on leaving with unsaved changes |
| Generate | `generateProject` → `POST projects/{id}/generate`; off while the brief has unsaved changes or the saved brief is missing a required field |
| Drafts | `listProjectArtifacts` → `GET projects/{id}/artifacts` |
| Deliverables | A name and a due date on the project. Nothing is attached |

**The Save button is the only thing that writes the brief, and nothing about the brief is kept in the
browser** (Jeff, 2026-10-04). `src/no-browser-storage.test.ts` fails on any `localStorage` or
`sessionStorage` use under `src`. Do not add a second way to write the brief.

**`gcc_creates` came first and is why the UI once showed both.** It is in the initial migration
(2026-08-01); projects arrived 2026-09-21 and were joined to it by a nullable `project_id`. During the
plan's P0 the server still keeps a create row under each project to hold its drafts. The client never
mints one, never sees its id and never sends it, and this repo has no create client code.

**A project holds one draft per page. It does not hold a history of drafts.** Jeff, 2026-10-06:
*"re-running an existing project requires no history"* and *"I don't see a need for a project to
contain multiple drafts."* Re-running is replacing: a Generate writes the project's pages and
whatever was there is gone; nothing on the page, in the URL or in the wording may imply an older
draft exists to be found. He was *"extremely confused ... trying to determine which was the latest"*
— on 2026-10-05, when every Generate still added a new artifact beside the last run's under the same
name (ended by GeekBackend `62efbad`, which rewrites the page instead), and again on 2026-10-06.

What this means on this side, as of today:

- The page already shows one draft per page and nothing older: it reads a page's versions and keeps
  only the newest (`ProjectContentWorkspace.tsx:228-233`); no older version is reachable on screen.
  Keep it that way — no version list, no "previous draft", no compare, no restore.
- The one thing on screen that still claims a history is the `pillar · v2` label beside a draft
  (`:1100`). A number implies a v1 somewhere; there is nowhere to see one. It should go.
- "Written at HH:MM" and "Generated from the brief saved at …" stay: they say *when* and *from
  what*, not *which of several*.
- Five tool pages on a project are five pages, one per usable partner — not five drafts of one.
- Brief **revisions** are a different thing and stay (J5 in `plans/fix-project-persistence.md`):
  they exist so a stale Save can be refused and so a draft can name the brief it came from. They are
  never shown as a list either.

The server-side version rows (`listGccVersions`, approve/revise/SEO by version id) are GeekBackend's
and are what the number comes from. Whether they go is GeekBackend's call; this repo's obligation is
to show one draft and never to surface more.

## Topic is a descriptor and a keyword

The topic — the project's keyword field, `create.Topic` in GeekAPI's generation code — is **two fields
in one string, split on the first colon.**

```
"Accounts Payable: Automated Data Entry & Processing"
 └── descriptor ──┘  └──────── keyword ─────────────┘
```

| Part | Role |
|---|---|
| `Accounts Payable` | **descriptor** — defines the *type* of the keyword. The keyword alone could be medical records or legal discovery; this says which. |
| `Automated Data Entry & Processing` | **keyword** — the SEO target. It names the **solution**. |
| `brief.Angle` (e.g. `problem_solution`) | read from the brief, reaches every long-form path. For Problem-Solution the problem is the keyword's **manual form**. |
| the partner's product | **subject** — the agent of the solution. **Never the Topic.** |

**What a Problem-Solution page argues:** *Manual Data Entry & Processing is a problem because X.
Automating Data Entry & Processing solves it — with Tool.*

`GccTopic.Parse` is the one parser (`GeekAPI/Services/ContentCreator/GccTopic.cs`). Interpolate the
**keyword** into any problem frame — never the whole string, and never the descriptor alone.

**Why this is written down rather than re-derived.** Two live defects in one day came from one value
doing two jobs:

- `toolName: create.Topic` sent partner extraction hunting for a product named after the keyword. Five
  partners carrying 84–226 quotable spans each and 130 features between them yielded **1 of 22 payload
  categories**, twice, with two different partner sets.
- A retrieval query read *"the problem of doing Accounts Payable: Automated Data Entry & Processing
  manually"* — automated, manually. Splitting the descriptor off was not enough, because the keyword
  itself names the solution: the keyword goes in as the **subject**, with the manual pain asked for
  beside it.

Nothing in either repo split Topic before 2026-10-02. That was the gap, not the design — "no code does
this, therefore it should not be done" reads a defect as an intention.

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
| Consumer | `GccProjectSiteStructureReader` | `GccGroundingResolver` → RAG retrieval + quote verification |
| Must retain | **Typed `blocks`** | Verbatim prose, from `blocks` |
| Scale | Own site, bounded | 50,000+ pages, scope hard |
| Failure mode if wrong | Tools/partners silently stop being found — **no error, fewer matches** | Quote verification fails, loudly |

**Grounding cannot be derived from the RAG *text* path.** RAG's page string is the flat block
projection (`block_text.derive_plaintext_from_blocks`): block text joined on blank lines, table rows
on `" | "`, inline markup stripped. Every href, every tag and every heading marker is discarded, so
h6→anchor tool links, "the keyword matched an h5", and h2 message pillars are unrecoverable **from
that string**.

The *blocks* are a different matter: `heading.level`, per-block `html` and per-block `anchors` are all
retained, so structure is recoverable from `blocks` even though it is not recoverable from the
projection. **That migration is done.** `GccProjectSiteStructureReader` takes the block route and says
so — *"Blocks, never Html"* — so project-site structure no longer reads raw HTML at all.

**Raw HTML is needed at derivation time, not forever.** Everything project-site grounding consumes
lives in the derived tree, not the source:

| Purpose | Reads |
|---|---|
| Hierarchy / keyword match | `GccV2HeadingNode.Level` + `Children` |
| Tools & partners | `GccV2HeadingNode.Links` (anchors under a heading) |
| Don't repeat ourselves | `RelatedPageDto(Url, Title, Headings[0..4], Excerpt≤120)`, 12 pages max — `BuildPartialInformationGain` |
| Paragraphs | **not consumed** |

**Open question, and it is worth real money: nothing in the live path still reads `crawl_pages.Html`.**

This section used to say HTML must be present when `GccV2SiteHierarchyFromCrawl.Build` runs. That
class was deleted on 2026-10-03 (`c3219ac`) for having no caller, which leaves the retention rationale
citing a consumer that does not exist. Checked at that date:

| Reader | Status |
|---|---|
| `GccProjectSiteStructureReader` | live, and **blocks only**, by its own doc |
| `GccGroundingResolver` | live, goes through `IGeekCrawlerRagClient` — retrieval, not raw HTML |
| `GccV2GeekCrawlerResearchResolver` (`:396`, `:611`) | reads `page.Html`, but referenced **only** by `ServiceRegistration` — registered, resolved by nothing |
| `GccV2ProjectSiteGrounding` (`:47`, `:61`) | same: reads `Html`, reachable only from the dormant v2 cluster |
| Geek-Crawler-Rag | **projects** `Html` in its Mongo queries (`mongo.py:255,344,373`) and carries it on `CrawlPage`, but no extraction path consumes it — ingest is block-based |

So `~98% of a 93 GB corpus` is retained for consumers that were deleted, plus one service that fetches
the field over the wire and does not use it.

**Not acted on, deliberately.** This was established by reading GeekAPI, Geek-Crawler-Rag and the
crawl types — not Geek-Crawler-v2's writer, nor any operational tooling, nor whether a future
`blocks`-gap would need HTML to re-derive. Dropping a column is irreversible against a live corpus and
is Jeff's call, not a doc edit's. What the doc can state is the thing that was wrong: **the stated
reason for keeping it no longer holds.**

**Partner and competitor pages are no exception.** Two paragraphs here said they were — "HTML is
still read at extraction time", "`crawl_pages.Html` is load-bearing" — citing
`GccV2GeekCrawlerResearchResolver`, the same class the table above records as resolved by nothing.
They contradicted the table and the table was right. Re-checked 2026-10-04 at GeekBackend `de0bb7e`:
every remaining reader of a crawl page's `Html` in GeekAPI (`GccV2BrandKitBuilder`,
`GccV2ProjectSiteKnowledgeService`, `GccV2SiteSection.BuildSectionFromCrawlPages`) is registered or
declared and called by nothing on the live path. Whether new crawls stop storing it is decision D16 in
`plans/fix-overview.md`, executed as C6 — Jeff's call, after R4 pins the RAG digest to `contentHtml`.

## One project URL, one published run. A re-crawl publishes a new one.

A crawl cannot run inside a database transaction — it takes minutes to hours, Mongo's
multi-document transactions default to a 60-second lifetime, and crawl documents carry multi-MB HTML.
So the run row is the unit of bookkeeping, and **publishing is a single-document status flip**.

**Every crawl gets a fresh run id; the slot's published run is replaced at commit.** This section
said the opposite until 2026-10-04 — "re-crawl reuses the same run id and refills it in place", via
`StartCrawlAsync` → `RequeueExistingRunAsync` → `ClearRunCrawlDataAsync`. That is not the live path.
Crawls arrive from Geek-Crawler-v2 through `GeekCrawlerIngestController`, which (GeekBackend
`de0bb7e`):

| Step | What happens |
|---|---|
| Start | `CreateRunAsync` — *"Always a fresh run. The published run for this slot, if any, stays readable until the new one commits."* |
| Crawl | Pages are written into that staging run; the published run is never touched |
| Commit (`status=complete`) | Refused without `contentReadyAt`; the slot's outgoing published run is found with `GetRunForSlotAsync(..., publishedOnly: true)` and the new run's status flip is the publish |
| After commit | The outgoing run is purged; a purge that fails is reported as `supersededAwaitingPurge`, not as a failed crawl |

The reason is written in the controller: the in-place shape cleared the good corpus up front, so a
crawl that died at page 3 of 2,500 left the operator with neither the old data nor the new.

**The consequence to respect: a stored Run ID names the crawl that was published when it was
stored.** `gcc_projects.project_site_run_id` is resolved by `ProjectForm`'s index check at save time;
after a re-crawl commits, that id names a superseded run and then a purged one. Readers still gate on
**status** — `publishedOnly` — never on an id resolving. How a stored id is re-resolved after a
re-crawl is not established here; `plans/fix-geekapi.md` F-A16 records that `create.ProjectSiteRunId`
and `project.ProjectSiteRunId` can already disagree. Check before relying on either.

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

**Generation is the exception, and it is not arbitrary: generation must be RAG-grounded.** Root
`CLAUDE.md` §1 — *"Generation is GeekAPI-side (`ContentCreatorV2/*`), grounded strictly on corpus
text that the Library half retrieved and verified."* Jeff, 2026-09-21: *"the way you actually
generate Content is also an exception — you will no longer create using v1 methods. i.e., RAG."*

**Superseded later the same day, and the conflict is left visible on purpose.** Two facts landed
after that instruction:

1. **v2 has never produced a document** — *"version 2 never produced one document, none, nada."*
   Zero live callers, `DraftingEnabled` unset. So `ContentCreatorV2/*` was never the RAG-grounded
   *working* path; it was the RAG-grounded *intended* path.
2. **v2 cannot preserve the structure it is grounded on.** Seven typed corpus block kinds in,
   one out, failing open when nothing parsed — code since deleted (`5a72445`).

**The requirement is unchanged: generation must be RAG-grounded. The vehicle inverts.** Rather than
moving drafting to v2, retrieval and verified quotes move to v1, which already holds the single
correct output path (`ContentGenerationOrchestrator` → `ContentDocument` → `SectionHtmlRenderer`).
"No longer create using v1 methods" was aimed at *ungrounded* v1 generation — the thing being
removed is the ungroundedness, not the writer.

**This reinterprets a direct instruction, so it stands until Jeff says otherwise.** If the intent was
"the v2 codebase writes, whatever it costs", this section is wrong and the decision reverts to
hardening v2. Full reasoning and evidence: `plans/grounded-generation-and-serp.md` Stage 1.

Concretely, `/app/projects/[id]` generates through `ProjectContentWorkspace` on `gcc-api`
(`generateProject` / `reviseGccVersion` / `polishGccVersion` / `seoGccVersion` /
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
- **Route counts change; re-run rather than re-copy.** `GccController` carried 36 routes until
  2026-10-03, when 12 that nothing live reached were deleted (`363200e`) — leaving 24. The live
  surface is whatever this prints:
  `grep -ohE '`/api/geek-content-creator[^`]*' src/services/*.ts`. A literal-path grep of the backend
  proves nothing: these clients build URLs by interpolation, so a route as written never appears in
  any source file.
- **No Site Analyzer call remains in this repo** — verified 2026-09-20. The claim that stood here,
  "exactly three frontend calls still 404" at `CreateStartForm.tsx:145,161` and
  `HierarchyContextPanel.tsx:137`, is **false**: `CreateStartForm.tsx` no longer exists, and
  `e6b3701` repointed `HierarchyContextPanel` at the v1 run-id route
  `project-site/runs/{runId}/hierarchy-match` — itself deleted on 2026-10-03 for having no caller, so
  neither route exists now. There is still **no `site-analyzer` route anywhere in
  GeekAPI** (`582a171` deleted v1's, `5072820` removed the three v2 replacements) and none is wanted
  — **Geek-Crawler-v2 supplies the structure now.** The unreachable client-side scaffolding this
  used to describe — nine proxy routes under `src/app/api/site-analyzer/**`, the matcher entry at
  `src/proxy.ts`, the dead gap-handoff writer, and copy naming Site Analyzer as the happy path —
  is **removed**, 2026-09-22, per `plans/remove-site-analyzer.md`. `grep -rni "site.analyzer" src`
  turns up only historical comments explaining a rename (`types.ts`) and this cleanup itself
  (`ContentBriefPanel.tsx`) — no live reference.
- **Drafting is OFF by default** — `ContentCreatorV2:DraftingEnabled=false` stops every create before
  the first paid model call, after the free evidence gates.
- **Three models, by task class, not one.** `OpenAiOptions.ResolveModel(LlmTaskClass)` picks per call;
  each specific setting falls back to `Model` when empty, so an unset one is not a broken one. Live in
  Railway production (`GeekAPI`), 2026-10-03:

  | Setting | Task class | Value | What runs on it |
  |---|---|---|---|
  | `LlmProviders__OpenAi__Model` | `Writing` (**the default**) | `gpt-4o` | all prose — ledes, bodies, every `ChatCompletionRequest` that does not say otherwise |
  | `LlmProviders__OpenAi__ExtractionModel` | `Extraction` | `gpt-4o-mini` | structured extraction over crawled pages — the bulk of call volume, no prose judgement |
  | `LlmProviders__OpenAi__UtilityModel` | `Utility` | `gpt-4o-mini` | short structured work; only three call sites set it (`ContentPromptBuilder:2497`, `:2539`, `:2806`) |

  This line used to read *"Model default is `gpt-4o-mini`"*, which was wrong in both halves and
  misleading in a way that cost real time: it named the cheap model as the default, so a
  `ledeType: "problem_solution"` failure on 2026-10-03 was first attributed to a weak model echoing a
  nearby token. **The lede is `Writing`** — `ChatCompletionRequest.TaskClass` defaults to
  `LlmTaskClass.Writing` (`ProviderModels.cs:60`) and no lede prompt overrides it — so that failure was
  `gpt-4o`, and the cause was a genuinely ambiguous prompt rather than a cheap model. Read
  `ResolveModel` and the request's `TaskClass` before attributing anything to a model.
- **Anthropic is `claude-sonnet-5`** (`AnthropicOptions.Model`) and has no task-class split — one model
  for everything on that provider. Which provider is live is `LlmProviders__DefaultProvider`.
- **`GET /api/geek-content-creator/creates` returns 500** — the route exists; the throw is inside
  `ListCreatesAsync`. It is where every create lands after it is made.
- **Project-site crawling still runs inside GeekAPI**, which is why Chromium is installed into the
  API image (`Dockerfile:33`). That is the one live violation of the boundaries above.

### Reachability in this repo — read in full 2026-10-02

The section that stood here claimed four things about discarded input. **All four were stale**, and it
was the section most likely to be cited as evidence. Corrected against a full read of `src`:

| The old claim | What is actually true |
|---|---|
| Partner/competitor URLs are "index-checked, coloured, then forgotten. Never persisted" in `crawl-client.tsx` | **`crawl-client.tsx` does not exist.** `ProjectForm` collects them, and `createProject`/`updateProject` carry `partnerUrls`/`competitorUrls` to the project row — they are persisted and they are what grounding resolves from |
| `startGeekCrawl` has "zero call sites" | It was called by `crawlOne` in `ProjectForm`, itself unreachable since 2026-09-29. Both were deleted 2026-10-04 (F5): this app starts no crawl |
| Target keyword "is dropped on every live path" | It is the project's **`topic`**: `ContentBriefPanel` sends it with the brief on every Save (`patchProjectBrief`). It is editable until the project has a draft, and fixed after — the pages already written were written for it |
| `SerpIngestPanel` is "orphaned; zero importers" | **`ContentBriefPanel` imports it** |
| "`/app/projects/[id]` and its eight panels sit behind a collapsed `<details>` on a route with no inbound link" | Was true when written and is now inverted: **`/app/projects/[id]` exists** and renders the workspace, while the four `creates/*` routes this row listed were deleted on 2026-10-03 (`8758146`) for being reachable only through two links labelled "Back to workflow" that pointed at them. `src/app/app/` is `projects/[id]` and `workflow` |

**The reachable surfaces.** `AppNavbar` has a single nav item and `/app` redirects to it, so
everything starts at **`/app/workflow`**, which renders `ClientsPanel` and `ProjectsPanel` only.
Opening a project navigates to **`/app/projects/[id]`**, which renders the rest: `ProjectProfilePanel`,
`ProjectWorkPanel`, `ProjectDeliverablesPanel` and `ProjectContentWorkspace` (→ `ContentBriefPanel` →
`SerpIngestPanel`, and `SiteContextBanner`). This paragraph used to put the whole chain on
`/app/workflow`.

**The unreachable components are gone — removed 2026-10-03** (`a5ea3d7`), with
`plans/remove-unwired-code.md` Phase 2. There were **nine**, not seven, and **1,888 lines**, not
~1,450: this section had missed `ReviewPublishPanel` (452) and `AppSidebar` (65). Do not re-copy
either number; re-run the check.

**`content-writer-api.ts` is gone too** (`8758146`), along with `/app/creates/*`. Six of its nine
importers were those dead components and the other three were those routes, which were themselves
reachable only through two links labelled "Back to workflow" that pointed at them — corrected in
`fb166f5`. Client CRUD now exists once, in `gcc-projects-api`.

**The lesson this section exists for, restated.** A grep hit on a dead path reads exactly like a hit
on a live one, and the way out is never a bare name search:

- **Resolve by import.** `grep -rln 'from "@/services/<module>"'`, then check what that file uses.
  `createClient` existed in two modules; searching the name found the live one and cleared the dead
  one.
- **Quote the glob.** `--include=*.tsx` unquoted fails in zsh and returns zero for everything, which
  reads as "all dead". During the 2026-10-03 audit it reported 30 live functions as dead.
- **Dead and transitively dead are different claims.** Say which.

**Also confirmed by the same read**, because these are relied on elsewhere:

- **Five partners is a floor, not a count.** `declared-url-gate.ts` measures it on *usable* URLs, and
  `GccDeclaredUrlEvidence.WrongCount` is `actual >= required` — *"Five good partners are five good
  partners whether a sixth was entered or not."* So a project may declare more, and one tool page per
  usable partner may be more than five.
- **`angle` is a required brief field** (`brief-catalog.ts` `isContentBriefComplete`), so any
  angle-driven behaviour always has a real value and never falls back.
- **The output tabs already support several artifacts per type** — one tab per content type, `(N)` when
  it has more, and an inner row showing `a.name`. Which is why an artifact's name has to be the
  product, not the topic: five pages named alike are indistinguishable there.
- **`GccGenerateResult` carries `refusals`, and `warnings` since 2026-10-04** (`gcc-api.ts`). The
  workspace accumulates both, and since F4 the progress lines too (`generateMsgs`), so with several
  artifacts of one type no message overwrites another. A version's `warnings` also live in its
  envelope and are shown whenever the version is opened, not only during the run that wrote it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

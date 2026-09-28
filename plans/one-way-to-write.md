# One way to write

**The instruction this serves.** Jeff, 2026-09-23: *"Much simpler to have one path, instead of
spaghetti."* Jeff, 2026-09-29: *"Existing codebase is way too complicated, having three separate ways
to write content"* and *"All these patches have gotten me nothing."*

**What this document is.** The single remediation plan for content generation. It replaces the
piecemeal fixes of the last eight days. Every claim carries a `file:line` or a commit SHA — in this
codebase a plan asserting something is not evidence that it is true, and **this plan is subject to
that rule too**.

**Why there are 26 other files in this directory and this is not a 27th concern.** Most of them
describe work that was specified and partly built. Several describe work marked Complete that has
never executed. That gap is not incidental to the problem — it *is* the problem, and §1 explains the
mechanism.

---

## 1. Root cause: three writers, one live, and the prompts belong to another

| Writer | Path | Injected by | Live? |
|---|---|---|---|
| `ContentGenerationOrchestrator` | `Services/Workflow/Services/` | `GccController:41`, `GenerateController:12`, `ReviewLoopService:34` | the v1 workflow surface |
| `GccGenerateService` | `Services/ContentCreator/` | `GccController:43` | **yes — this is what Create runs** |
| `GccV2WriteService` | `Services/ContentCreatorV2/Write/` | `GccV2ValidateController:27`, `GccV2CanvasController:39`, `GccV2ValidateService:70` | dormant; `AGENTS.md`: *"version 2 never produced one document, none, nada"* |

All three share one prompt library, `ContentPromptBuilder`. That is the whole defect in one sentence:

> **The prompts read a context object that only the orchestrator fills in, and the writer that runs is
> `GccGenerateService`, which fills in almost none of it.**

`BuildMinimalContext` (`GccGenerateService.cs:2090-2162`) is accurately named. It populates the
company profile, the operator's brief, the publisher's own crawled pages, and known tools. Every
research field is left empty:

```csharp
KeywordSources: [],            // :2132
PeopleAlsoAskQuestions: [],    // :2133
MatchedUseCase: null,          // :2146
JsonLdStructuredSummary: null, // :2131
DesiredHeadings: null,         // :2145
```

and `HierarchyPath`, `HierarchyChildHeadings`, `HierarchySourcePageUrl`, `HierarchyAssignment`,
`HierarchyToolsByHeading`, `SerpTitles`, `SerpUrls`, `SerpPaaQuestions`, `SerpRelatedSearches` and
`PillarBodyExcerpt` are **not passed at all** and default to null.

The code already knows this pattern, because it was found once and fixed for one field
(`GccGenerateService.cs:2160-2161`):

> *"Empty on every Create-path generate until 2026-09-27, which is why `AppendKnownToolsBrief` never
> rendered and no draft ever linked a tool."*

Exactly that, for every other research field, is still true today.

### 1.1 What is consequently dead on the live path

| Prompt machinery | Reads | On the Create path |
|---|---|---|
| `AppendKeywordSerpBrief` | `SerpTitles/Urls/RelatedSearches` | renders nothing |
| `AppendAuthoritativeSourcesBrief` | `KeywordSources` | renders nothing |
| `AppendCompetitorGapsBrief` | `KeywordSources` | renders nothing |
| `AppendPaaBrief` | `PeopleAlsoAskQuestions` | renders nothing |
| `AppendCompactSiteContext` assignment block | `HierarchyPath` / `HierarchyAssignment` | renders nothing |
| `HierarchyPromptGuidance`, `HierarchyChildOutlineInstruction` | `Hierarchy*` | render nothing |
| matched-use-case alignment in `BuildArticleMetadataPrompt` | `MatchedUseCase` | never fires |
| `=== PILLAR USE-CASE EXCERPT ===` in `BuildToolBodyPrompt:2492` | `PillarBodyExcerpt` | never renders — set only by `ContentGenerationOrchestrator:211,343` |

`ResearchBriefBuilder` has six phases. On the live path all of them reduce to `AppendKnownToolsBrief`
plus a one-line instruction.

**Correction, 2026-09-29 — half of this is dead by design, not by omission.** Checked before
planning Stage 2, and the finding is narrower than the table above implies:

- `GccSerpIndex` — the type `SerpTitles`/`SerpUrls`/`SerpPaaQuestions`/`SerpRelatedSearches` would be
  filled from — is **declared and never constructed anywhere in the solution**, and the frontend
  never sends one. `ResearchJson.SerpIndex` is always null. But SERP data does reach the prompt: the
  Create path renders `ResearchJson.SerpPages` directly in `BuildResearchBlock`. So
  `AppendKeywordSerpBrief` is not a missing input — it is a second route to material already
  arriving by the first.
- `KeywordSourceSummary` wants `Headings` and `Paragraphs`; `GccKeywordSource`, what a create
  actually stores, holds only `HeadingCount` / `ParagraphCount` / `QuestionCount`. The text is not
  on the create to pass, so `AppendAuthoritativeSourcesBrief` cannot be populated from it.

**So "fill the context" was the wrong frame.** The Create path assembles evidence its own way —
`BuildResearchBlock` off `ResearchJson`, `BuildEvidenceBlock`, `BuildPublisherSiteBlock` — and the
orchestrator's context fields are that other writer's input shape. Two of the eight rows above are
better read as *the orchestrator's plumbing, inert here*, and the honest fix for those is to stop
calling them on this path rather than to feed them.

The rows that are genuine gaps, because nothing else carries them:

| Gap | Why nothing else covers it |
|---|---|
| `Hierarchy*` — the project-site match and its tools-by-heading | `BuildPublisherSiteBlock` carries the site's *content*, never its *structure* |
| `PillarBodyExcerpt` on the tool path | set only by `ContentGenerationOrchestrator:211,343`; the tool prompt asks for it and never gets it |
| partner retrieval for Pillar and Blog | §4.2 |
| competitor prose, all three types | §4.3, §4.4 |

That is Stage 2's real scope, and it is smaller and more specific than the original wording.

### 1.2 The same split explains the other oddities

- `BuildArticleSectionPrompt` (one section per call) and `BuildArticleSectionBatchPrompt` both exist
  because the orchestrator uses one and Create uses the other.
- `PillarSectionClassifier`-keyed guidance fires on the orchestrator (model-written headings) and
  cannot fire on Create (obligation strings) — §4.9.
- The partner and competitor extraction services were built against v2 and only the partner half was
  ever reconnected to v1 — §4.3.

---

## 2. Consequence: the evidence is collected and not delivered

Three crawl types are crawled, extracted to typed blocks, ingested and vector-indexed. This is what
reaches the writer.

| Crawl | Purpose | Indexed | → Pillar | → Blog | → Tool |
|---|---|---|---|---|---|
| project-site | don't duplicate ourselves | yes | publisher headings + paragraphs only; **hierarchy/tool-match dead** | same | same |
| partner | say true things about partners | yes | **no retrieval fires** | **no retrieval fires** | retrieved, extracted, verified, fail-closed |
| competitor | be differentiated | yes | headings only | headings only | **nothing at all** |

---

## 3. What has already landed (2026-09-28/29), so it is not re-planned here

Batched section generation for all three types with per-batch word/keyword shares and a single
closing instruction (`a481394`); the brief's control fields reaching the tool body; the audience
reaching every body from one rendering (`a7ddbd5`); the tool page's retry able to state what it is
retrying (`4fc1816`). 1,143 tests green.

These were the "patches that got nothing". They were correct and they were at the last hop.

---

## 4. Findings

### 4.1 The index gate was specified and never built

`plans/validate-partner-competitor-urls.md` mandates: *"Create submit blocked while any entered URL
is red … partner and competitor alike."*

Commit `fd5c920` — *"feat: partner and competitor URLs validate against the index"* — delivered the
lookup, the green/red display and the `crawl-seeds.ts` deletion. The only submit guard it added:

```diff
-        disabled={starting || !canCrawlSite || siteBlocked}
+        disabled={starting || !canCrawlSite || siteTooMany}
```

`canCrawlSite = !useExistingSite && siteUrls.length === 1`. Neither expression reads an index answer,
and the button is *crawl the site*, not create. Today `ProjectForm.tsx:141-142` gates on
`name + startDate + projectSiteRunId`; `IndexReport` is a pure display component with no callback.
Both server hops check URL **syntax** only (`GccProjectsController.cs:83-86` POST, `:127-129` PUT).

Host normalization (`www.x.com` ≡ `x.com`) **is** done, both directions, with tests
(`Geek-Crawler-Rag/app.py:646-683`, `tests/test_host_index.py`), fixed 2026-09-23.

**Decided by Jeff, 2026-09-29: implement as mandated.**

### 4.2 One table does two jobs, so Pillar and Blog retrieve nothing

`GccGroundingResolver.RequiredCrawlTypes:80-85` is `{tool → partner, aitool → partner}`. Its own
remark (`:71-79`) says the table is also the retrieval trigger:

> *"it's the actual retrieval step … Removing it here would mean Tool never receives any partner
> pages to extract from at all, not merely relax a duplicate check."*

Pillar/Blog were removed on 2026-09-22 — correct as *policy*, since citing was never their
requirement. But `ResolveAsync` returns `NotRequired()` **before the retrieval loop** (`:105-109`).
Meanwhile `GccRequiredToolMentions` obliges Pillar and Blog to name every declared partner, then
refuses with *"a partner with no evidence gives the writer nothing to say about it."*

### 4.3 A complete competitor subsystem is wired to a dead path

`competitor-extraction-complete.md` (deleted 2026-09-29; in git history) — **Status: Complete
(2026-09-14)**, §12 all Done, unit tests. `GccV2CompetitorExtractionService` is purpose-built (CONSULTANCY vs CONTENT rivals; software
metrics forbidden — `:49-70`) and takes the same input type as the partner extractor (`:98`).

Every caller is in v2: `GccV2GeekCrawlerResearchResolver:155`, `GccV2ValidateService:288`,
`GccV2PlanService:158`. The live frontend calls no v2 route.

The retrieval side is written too and never invoked: `GccGroundingResolver:144` maps
`CrawlTypes.Competitors => project.CompetitorUrls`; `BuildNeed:287-298` returns *"competitor
differentiation research"*; `:174` calls `QueryAsync(crawlType:)`; `HttpGeekCrawlerRagClient:498-499`
forwards it to the library, which filters on it.

### 4.4 Competitor prose is fetched and discarded

`GccCompetitorAnalysisResolver:80` fetches whole pages — the DTO carries `Html`, `ContentHtml` and
typed `Blocks` (`GeekCrawlerDtos.cs:46-60`) — then keeps a heading tree and JSON-LD types only
(`:89-95`). `DeclaredSchemaTypes` has no consumer anywhere.

### 4.5 Turning competitor retrieval on naïvely causes harm

One channel exists from RAG to prompt: `Pages → MergeRetrievedEvidence → ResearchJson.Quoteables →
BuildResearchBlock`, a flat list with **no crawl-type field**. Crawl type survives only as a loop
variable (`:139`) and a request key (`:499`); it is not echoed back and is on neither
`GccQuoteablePage` (`GccResearchModels.cs:58-75`) nor `GccGroundedPassage` (`:44-47`).

A competitor page merged there today would (1) render under `=== QUOTEABLE RESEARCH (partner/tool
evidence) ===` whose Rule 2 says *"name the source and include its URL where the claim appears"* —
instructing the model to cite a rival; (2) be fed to `_partnerExtraction.ExtractFromPagesAsync`
(`:1682`), which reads all quoteables at `:1663`; (3) feed `SoftwareApplication.url` origin
derivation (`:1671-1679`).

In-repo precedent for the fix: `GccV2CreateLibraryWriter:790-826` keeps two **separate lists** under
separate headers; `GccV2ContextAdapter:154-167` holds the fullest "competitor, never cite" text
already written.

### 4.6 The prompts name a different keyword than the scorer measures

`TargetKeyword: topic` (`:2124`) is the whole `"Accounts Payable: Automated Data Entry & Processing"`.
The scorer uses `GccTargetKeyword.FromTopic(keyword)` (`GccController.cs:829`) — **the only caller of
that class in the repository**. So the SEO blocks instruct the writer to place the full colon-joined
string verbatim in the lede and an H2, and the page is scored against a different string. Affects all
three types.

### 4.7 Shared rules reach some types and not others

| | Pillar | Blog | Tool |
|---|---|---|---|
| Fabricated-outcome ban, body | yes | **no** | yes |
| Fabricated-outcome ban, lede | yes | **no** | **no** |
| Filler ban, lede | **no** | **no** | **no** |
| Brief's PAA questions | → FAQ | **dropped** | n/a (partner FAQ) |
| FAQ generated | when PAA present | **never** | when partner FAQ present |
| Metadata call sees the body | **no** | n/a (runs first) | yes |
| Brand tone in metadata prompt | yes | yes | **no** |

Blog has no ban on invented case studies anywhere — the most likely single contributor to the
100%-AI-detected report. Cause is on record in `SeoBodyInstruction`'s own comment: these rules *"were
accreted one sentence at a time, in whichever prompt was open when a failure was reported."*

### 4.8 Pillar plans its metadata last and discards the plan

`:2681` fabricates `Title: create.Topic`, `MetaDescription: Truncate((create.Notes ?? create.Topic), 160)`.
`create.Notes` is the "Notes (optional)" box on `/app/creates/new`, never used — so the lede prompt
prints the same string under both `Article title:` and `Meta description:`. The real
`BuildArticleMetadataPrompt` runs after all five body sections (`:2866`), never sees the document,
and its `sectionOutline` is discarded — taking `SeoOutlineInstruction`, "no Tools H2" and
"sectionOutline[0] must be a hook" with it. Blog does the opposite; Tool passes the finished
`document` (`:1919`).

### 4.9 Pillar's opening contradicts its body, and skips the guard

`IntroductionJsonContract:883` says nested h3s are optional; `BuildPillarLedePrompt:1344-1346` says
2-3 h3 each **MUST** nest 1-3 h4; `BuildArticleSectionBatchPrompt:1465` says "not a fixed lattice".
`FindUnlicensedHeadings` runs on `bodySections` only (`:2730,:2746,:2803,:2831`), so up to twelve
invented headings ship unchecked while the body is refused for one.

`PillarSectionClassifier`-keyed guidance: all six pillar slot labels tested against all three
classifiers — **0 of 6 match**, so 53 lines of anti-slop instruction never render on this path.

### 4.10 Dead-but-present inventory

`DeclaredSchemaTypes`; `GccGroundingOutcome.Passages` / `GccGroundedPassage` (built at `:229`, read
only by tests); `checkProjectSiteReadiness` (`gcc-api.ts:838`, no call site, and the *stronger* probe
than the one the site gate uses); `GccV2ResearchReadinessController`; `GccPartnerUrlResearchService`
(v1 twin, no callers). Tool's subject is still `create.Topic` rather than a partner
(`plans/tool-page-per-partner.md`).

---

## 5. Corrections to things said earlier in this session

1. **"Only Tool has partner evidence" — wrong.** The prompt plumbing reaches all three; the
   *retrieval* is what does not fire (§4.2).
2. **Adding `AppendKeywordSerpBrief` to `ResearchBriefPhase.ToolBody` (`a481394`) is inert** — it
   reads `Serp*`, which `BuildMinimalContext` never populates (§1).
3. **"Competitor headings only, by design — I'd leave it" — withdrawn.** The editorial rule (read
   rivals as a coverage checklist, not a style model) stays as guidance; it never justified not
   reading their prose.

---

## 6. Plan

**Stage 0 — decide the writer.** Everything below assumes `GccGenerateService` is the one writer and
the other two are retired or frozen. That decision is §7 Q1. Without it, each stage risks being
built against the wrong path a third time.

**Stage 1 — the index gate.** Pure verdict function `src/lib/declared-url-gate.ts` (the test runner
is `node --test`, no DOM, so the logic must leave the component to be testable); consulted by
`canSubmit` and awaited inside `submit()` to close the blur race; per-field check state; UI copy at
`ProjectForm.tsx:89-92,:301-305` reversed. "Could not ask" (`HostsIndexedAsync` returns `[]`, never
`false`) stays distinct from "not indexed" — both block, different message. Server-side gate on
`POST` and `PUT` in `GccProjectsController`: **flagged to strike** (§7 Q3). Reuses
`checkHostsIndexed`, `IndexReport`, `RagController`, `_host_candidates` unchanged.

**Stage 2 — the context fields that are genuinely missing.** Narrowed by the correction in §1.1:
`Hierarchy*` from the project-site run via `GccV2SiteHierarchyFromCrawl.Build`, and
`PillarBodyExcerpt` on the tool path. `Serp*` and `KeywordSources` are **not** in scope — the first
already reaches the prompt by another route, the second has no text on the create to pass. Their
`ResearchBriefBuilder` phases should be dropped from this path rather than fed, so nothing reads as
a live input that is not one.

**Stage 3 — split policy from retrieval.** `RequiredCrawlTypes` becomes `MustCite` (tool/aitool →
partner, unchanged) and `RetrieveFor` (all three → partner **and** competitor). The loop, query and
merge already exist; this is a second entry point over them that does not refuse.

**Stage 4 — keep the two evidence sets apart.** `GccResearchDocument` gains `CompetitorQuoteables`
(defaulting null; plain camelCase `System.Text.Json` over optional positional fields, so old JSON
round-trips). Chosen over tagging `GccQuoteablePage` because the tool path reads `Quoteables`
wholesale — a separate list leaves every existing consumer correct by construction. New render block
modelled on `GccV2ContextAdapter:154-167`: *"COMPETITOR RESEARCH (differentiate; never quote, never
cite, never link)"*, reaching Pillar, Blog **and Tool**.

**Stage 5 — competitor structured extraction** (§7 Q2): call
`GccV2CompetitorExtractionService.ExtractFromPagesAsync` from v1 exactly as `:1682` already does for
partners; `GccV2CompetitorExtractionVerify` stamps `QuoteVerified`.

**Stage 6 — one composition for shared rules.** A single block set every long-form body receives, and
one every lede receives, enforced by a `[Theory]` over `{pillar, blog, tool}` — the shape of
`ContentPromptBuilderBriefReachTests` and `ContentPromptBuilderSectionBatchTests`, extended to the
whole set. The complete list of legitimate exceptions, declared in code: Tool's title is the product
name; Tool's FAQ is verified partner pairs; Tool refuses on thin partner grounding; Tool has no
`NoToolsSectionInstruction`; per-type word/section targets. Nothing else differs.

**Stage 7 — the keyword.** `GccTargetKeyword.FromTopic(...)` into the three SEO blocks; the full topic
stays everywhere else, which is the point of the colon.

**Stage 8 — Pillar.** Metadata planned first as Blog does (or at minimum handed the document as Tool
does); lattice contradiction resolved in favour of the body's rule; the lede's children run through
the provenance guard.

**Stage 9 — the dead list.** Each item in §4.10 is wired or deleted. Nothing stays "complete but
unreachable", because that state is what produced this document.

---

## 7. Decisions needed

1. **Stage 0 — the writer.** Retire `ContentGenerationOrchestrator` and `GccV2WriteService`, or
   freeze them and mark the prompt builders each one owns? Retiring is the instruction on record
   ("one path, not spaghetti"); freezing is cheaper and keeps the `/app/workflow` surface alive.
2. **Stage 5 — structured competitor extraction, or passages only?** Passages cost nothing extra;
   extraction is what the signed-off spec describes, at one model call per competitor page.
3. **Stage 1 — server-side gate.** The mandate specifies a frontend block; `CLAUDE.md` §2 says a
   boundary is only fail-closed if code rejects the bad input, and `PUT projects/{id}` is reachable
   without the UI. Recommended, flagged.

---

## 8. Out of scope

Reviving any v2 *write* path (this calls two v2 *extraction* services from v1, which is the direction
`AGENTS.md` records). Changing what the crawler or RAG collects — both already collect what is
needed. Rewriting the Pillar prompt: its prose is the strongest of the three and §4.8–4.9 are
ordering, wiring and one internal contradiction.

---

## 9. How this is judged

Not on a diff. On one generation:

1. Same create, before and after: word count, SEO score, keyword density, and whether partner claims
   trace to a partner page.
2. *"a partner with no evidence gives the writer nothing to say about it"* stops appearing because
   evidence arrives — not because a check was relaxed.
3. The draft shows awareness of what rivals claim, with no rival URL, quote or CTA anywhere in it.
4. Tool still refuses without partner grounding — Stage 3 must not weaken the one fail-closed gate
   that works.
5. The shared-rule theory passes for all three types and fails if any block is removed from any one.
6. `dotnet test` green; `npm test` green; `npm run build` clean.

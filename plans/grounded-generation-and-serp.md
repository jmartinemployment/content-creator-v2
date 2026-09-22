# Grounded generation, a Brief that reaches it, and a real SERP

> Revised after AI review. The review's central finding — that Stage 2 guarded the wrong failure —
> was correct, and verifying it surfaced something worse (see **Urgent**). Every verification step
> is now a binary assertion rather than an output comparison.

## Terminology this plan holds to

The model writes. **RAG retrieves and verifies** the corpus text the writing is grounded on — it
never generates (`CLAUDE.md` §1, `architecture.md` §7). `GccV2CreateLibraryWriter` is the writer.
"Grounded" means exactly that — never that RAG does the writing.

**Verified 2026-09-21:** Geek-Crawler-Rag has no content-write capability to remove (24 routes:
index / query / diagnostics / intelligence; `/v1/generate` gone; OpenAI use is
`text-embedding-3-small` only; zero `generate`/`write`/`draft` functions in `src`). No residential-IP
or proxy-based SERP scraper exists anywhere in these repos — one `PROXY_URL`, no vendor SDKs.

---

## Urgent — DONE 2026-09-21

Verifying the review's point about guard evidence produced a worse finding than the review assumed.
**Commit `08651ab`'s guard narrative does not match the code.**

| Guard | `GccGenerateService` (runs today) | `ContentGenerationOrchestrator` (what V1Restore routes to) |
|---|---|---|
| Consultant appendix / AI-filler ban | `:227` defined, called **once** at `:1087` | **absent** |
| `UseExactKeywordAsTitle` | present | present |
| Refusal outside site scope | no match | no match |

Two consequences:

1. The appendix is referenced by `V1Restore/GccV2V1PlanAdapter.cs:13` **in a doc comment only** —
   the adapter routes to the orchestrator, which never calls it. The restore did not restore that
   guard.
2. The single appendix call sits inside `GenerateStartingContentAsync` (`:1040`), covering
   techArticle / social / ads / imagePrompt / aiTool / multi-select. **`GeneratePillarBodyAsync`
   (`:1982`) and `GenerateBlogBodyAsync` (`:2017`) reference neither the appendix nor the filler
   ban.**

So today, single-select **Pillar and Blog** — the highest-volume outputs — generate with no
appendix, no filler ban, no Brief, and no retrieval. That is a one-method fix on the path that
actually runs, and it depends on no question below. **Ship it before Stage 0.**

**Closed.** Retrieval landed as part of Stage 4's grounding gate. The Brief and the filler ban
landed together: Stage 4's rewrite of `GeneratePillarBodyAsync`/`GenerateBlogBodyAsync` onto the
shared structured prompt builders meant `BuildBriefBodyGuidance` was already being called from both
— the Brief reached pillar/blog as a side effect of a different fix. The filler ban did not follow
for free; `FillerBanInstruction` was added as a shared constant and wired into both body prompts.
The third guard, refusal outside site scope, was never pillar/blog-specific — it was absent on both
live paths because the Create path never used Site Analyzer hierarchy matching. `GccGroundingResolver`
is its real equivalent: refusal on insufficient evidence rather than on a hierarchy-path mismatch.

---

## Context

**1. The grounded writer is built and fenced off.** `GccV2WriteService` / `GccV2CreateLibraryWriter`
has **zero live callers**. `GccV2JobWorker:562-563` calls `V1Restore.GccV2V1WriteAdapter` instead,
behind `ContentCreatorV2:DraftingEnabled` (`:336`) — **unset everywhere**. So only one path actually
runs: `GccController.Generate` → `GccGenerateService`. The restored path has likely never executed
in production either, which means "v1's guards work" rests on a path nobody has run.

**Evidence quality — the premise has no artifact behind it.** Jeff, 2026-09-21: *"version 2 never
produced one document, none, nada."* The code agrees and always did: `GccV2WriteService` has zero
live callers and `ContentCreatorV2:DraftingEnabled` is unset everywhere, so the writer has never
executed. **A claim about the quality of v2's output cannot be sourced from v2, because there is no
v2 output.** "v2 fabricates structure" rests on one commit message (`08651ab`) whose guard claim is
separately shown inaccurate in **Urgent** above. Treat the premise as not merely unverified but
unsourceable from the artifact it describes.

**And v2's Markdown was not a format choice — it was the writer's interchange format.**

> **All of the code this section describes was deleted on 2026-09-22 (`5a72445`).** Its method names
> and line numbers have been removed rather than annotated: a dead identifier left in a document is
> what the next reader greps and takes for a live path — the failure this whole section is about.

The writer serialized the in-progress document to Markdown, the model answered in Markdown, a parser
read it back, and a section-writer flattened it on every write. A hand-rolled `[text](href)` scanner
sat alongside them. Removing Markdown from v2 was never an edit to it; it was a rebuild of its
document model, serializer, parser, list and link handling, and structure guard.

**A candidate explanation for the zero.** That parser threw on *any* deviation — "Final synthesis changed document structure: expected N H2 headings,
received M". A model returning `<h2>`, or drifting by one heading, aborts the run. Fail-closed on a
brittle format would produce exactly the observed outcome: no document, ever.

**2. The Brief barely reaches generation.** `CanonicalBrief` is attached to every draft request
(`GccV2WriteService.cs:461`, `:1156`, `:1354`) and read once — into a provenance signature
(`GccV2AgentExecutionFactory.cs:185`), never prompt text. On the live path, pillar/blog/email/social
ignore `BriefJson`; only `GenerateStartingContentAsync` dumps it as raw JSON (`:160-219`).

**3. SERP is manual-paste only and unreachable.** `GccSavedSerpParser.cs` parses a Google results
page; `SerpIngestPanel.tsx` has zero importers; `PaaPafCluster` is never constructed.

**Correction:** `BuildLedeTypeGuidance` is live today for pillar-family types via
`ContentGenerationOrchestrator.cs:1424`. **It loses its only live caller the moment V1Restore is
deleted (Stage 4)** — so Stage 6 must land with or before Stage 4, or the guidance goes dark.

## Dependency graph

```
Urgent ─────────────────────────────── independent, ship now
Stage 0 (naming) ───────────────────── independent
Stage 7 (SERP upload) ──────────────── independent, parallel from day one
Stage 9 (local/FAQ schema) ─────────── independent, parallel from day one
Stage 1 ─── Not a fork: v1 writes; RAG is the capability being added.
Stage 2 (provenance) → Stage 3 (Brief) → Stage 4 (grounding onto v1) → Stage 5 (frontend)
                                                        Stage 6 (lede) — no longer time-critical
Stage 8 (analyses) — unblocked: Stage 4 and Stage 7 both done
```

---

## Stage 0 — Finish the naming correction *(DONE 2026-09-21)*

- Rename `GccV2WriteService.GenerateRagSectionAsync` and `WriteRagCompleteAsync` toward
  *library*/*grounded*. Correct vocabulary already exists (`GccV2CreateLibraryWriter`,
  `architecture.md:188`).
- **Resolve the PAF collision while renaming:** `PaaPafCluster` means *People Also Ask/Found* in GCC
  while `PAF` means *Primary Answer Feature* in Geek-SEO. One of them changes.
- Commit the already-done prose correction first, so no stage points at working-tree state.

## Stage 1 — Not a fork. v1 writes; RAG is the capability it lacks *(requirement delivered 2026-09-22, via Stages 2/4/6/7/8 on `GccGenerateService`)*

**The (a)/(b) framing was wrong and is withdrawn.** It was mine, not Jeff's, and it forced a choice
between two writers where no choice exists. Jeff, 2026-09-21:

> *"This is not a binary or this or that decision, v1 worked beautifully produce html prose exactly
> as requested, but had no concept of using RAG as the definition I supplied earlier. Versus v2
> supposedly built for RAG, that never produced one html document."*

| | v1 | v2 |
|---|---|---|
| Produces HTML prose as requested | **Yes** | **Never — not one document** |
| RAG as defined — retrieval + verification, never generation | **No concept of it** | Built for it, unproven |

**So the work is additive: give the working writer the capability it lacks.** There is no migration,
no cutover, and no writer to select. v2 contributes **no code** — it never executed, so nothing in it
is proven — but its *intent* is the specification for what to add.

**What was actually wrong with v1 — stated by Jeff, 2026-09-21:**

> *"The problem with version one was it wasn't grounded enough, didn't cite or quote Partners/Tools,
> said it used SERP and didn't."*

**All three are one defect: grounding is optional, and its absence is silent.**
`ContentGenerationOrchestrator.cs:869` says so in the code —
*"research (KeywordSources/SerpIndex) is optional enrichment, **not a generation gate**. Brief +
Hierarchy alone grounds generation."* Every grounding block is conditional and simply disappears
when empty:

| Block | Guard | When absent |
|---|---|---|
| Partner/tool quoteables | `if (research?.Quoteables is { Count: > 0 })` (`GccGenerateService.cs:169`) | omitted; generation continues |
| Keyword SERP uploads | `if (research?.SerpPages is { Count: > 0 })` (`:185`) | omitted; generation continues |
| SERP index (organics, PAA) | `if (research?.SerpIndex is { } serp)` (`:204`) | omitted; generation continues |

Nothing ever *claims* SERP in words. The pipeline carries SERP fields, drops them when empty, and
produces equally confident prose either way — so the operator cannot tell a grounded draft from an
ungrounded one. That is what "said it used SERP and didn't" describes, and it is the same
middle-state failure the repo already bans: *"Partial extraction is failure… it hid a total
extraction outage behind thirteen drafts of filler"* (`AGENTS.md`).

**So the requirement is not "add retrieval." It is three things, and the third is the one that was
missing entirely:**

1. **Retrieval** — passages from the indexed crawl for the topic at hand.
2. **Citation and quotation of Partners/Tools** — verbatim quote plus its source, verified against
   the block text it came from, not paraphrase the model produced unaided.
3. **Provenance that is enforced, not asserted.** A draft records what actually fed it. Absent
   grounding is a **refusal**, never a silent omission. This is `CLAUDE.md` §2 applied to the
   product: never state a property nothing enforces.

**Everything else v1 already has, and that is the part not to break:**
`ContentGenerationOrchestrator` → `ContentDocument` → `SectionHtmlRenderer` — structure in a document
model, markup produced in exactly one place, HTML out — plus a cross-linked schema graph that fails
closed on an empty builder.

**Note the inversion this forces.** `:869` is a deliberate decision, recorded with a commit
(`293da90`), that made research optional so generation would not block. Reversing it means drafts
that used to succeed will now refuse. That is the intended outcome — a refusal is information, a
generic draft is not — but it is a behaviour change to make on purpose, not by accident.

**What v1 already has, and must keep.** `ContentGenerationOrchestrator` → `ContentDocument` →
`SectionHtmlRenderer` is the single correct output path: structure in a document model, markup
produced in exactly one place, HTML out. It emits a cross-linked schema graph (TechArticle /
BlogPosting / SoftwareApplication with Person, Organization, WebPage, ImageObject) and fails closed
on an empty builder. None of that is up for renegotiation while adding retrieval.

**Why v2's code could not be ported in, only its intent.** Its write loop used Markdown as the
interchange format between the document and the model: the corpus's seven typed block kinds went in
and **one** came out — headings removed by a `#` filter, list markers trimmed into prose, lines
joined on spaces — then it failed open, returning raw Markdown as a single paragraph when nothing
parsed. `ListParagraph` and `Run.Href`
already exist in `ContentDocument`, so that code flattened structure the target model holds
natively and then rebuilt links with a hand-rolled `[text](href)` scanner (`:764`). Porting it would
import the defect.

**The open question is not which writer. It is how retrieval reaches the document model** — and the
measured answer is Stage 4: `ContentDocument` represents four of the corpus's seven block kinds, so
three node types are missing before a retrieved passage can arrive intact.

**Still open, deliberately.** Whether the v2 write path is deleted or left dormant. Jeff: *"You can
throw everything away and start over."* A live option, not an instruction executed here.

**This stage's three requirements, closed against the actual writer.** This section names
`ContentGenerationOrchestrator` throughout as "v1" — corrected, 2026-09-22 (Stage 3/4/5's matching
corrections): the writer the frontend actually reaches is `GccGenerateService`, and that is where all
three landed. (1) Retrieval — `GccGroundingResolver` + `GccCorpusBlockMapper`, Stage 4. (2) Citation
and quotation of Partners/Tools, verified against block text — the same resolver, with the four-rule
attribution block Stage 4 item 3 added to the prompt. (3) Provenance enforced, not asserted — Stage
2's `GccHeadingProvenanceGuard`, which refuses a draft outright rather than silently degrading it,
exactly the "refusal is information, a generic draft is not" standard this stage set.

## Stage 2 — Define "invented structure" as heading provenance *(DONE 2026-09-22)*

**Premise corrected, 2026-09-21.** This originally said "Stage 4 swaps in
`GccV2PlanService.BuildOutlineAsync` at the same moment it swaps the writer" — written before the
pivot. Stage 4 never swaps the writer now; there is no v2 outline builder shipping to guard against.

**Premise corrected again, 2026-09-22 — the entire target named below was dead code.** Everything
this section cited — `BuildArticleMetadataPrompt`'s model-chosen `sectionOutline`,
`PillarHeadingContract.FindPlanViolations`, `GeneratedContent`, `ProjectSnapshot`, `SchemaVersion: 5`
— belongs to `ContentGenerationOrchestrator` and the `Project`/`GeneratedContent` domain. Confirmed by
direct grep: `BuildArticleMetadataPrompt` has exactly two callers, `ContentGenerationOrchestrator.cs:1347`
and the dormant `GccV2WriteService.cs:1441` — never `GccGenerateService`. `FindPlanViolations` has
exactly one non-test caller, also `ContentGenerationOrchestrator.cs`. And `AGENTS.md`'s own "Current
state" already says the orchestrator's route in has **no live caller** — `content-writer-api.ts`'s
generate calls are listed there by name as dead. Same trap as `GccV2*`, applied this time to the
*other* dormant system: presence in a file that is architecturally described as "v1" is not the same
as reachability from the live frontend. Nothing here was ever going to fire.

**What actually runs — `GccGenerateService` — was never checked against this section's four sources,
so it was checked now, directly:**

- **Persisted row exists, and it's simpler than `ProjectSnapshot`.** `GccController.RunGenerateAsync`
  calls `repo.CreateVersionAsync(new CreateGccArtifactVersionCommand(primaryArtifact.Id, bodyJson))`
  — `bodyJson` is the serialized `ContentDocument`. Whatever provenance a `Section` carries would
  ride along automatically, serialized straight through. No `SchemaVersion` bump, no separate
  snapshot serializer — that machinery belongs to a system this doesn't touch.
- **Invented structure is real here, just not where this section described it.** Pillar/blog
  top-level H2s are a fixed plan (`PillarOutline`) or an "advisory... you may refine" list
  (`BuildStandaloneBlogBodyPrompt`), not model-chosen the way `BuildArticleMetadataPrompt` chooses
  one. But `SectionJsonContract` gives every `Section` a `children` array at every call site, and the
  pillar batch prompt *requires* it: "Include 2-3 h3 subsections nested in children... every h3 needs
  at least one substantive h4 child" (`ContentPromptBuilder.cs:645-648`). Every pillar generation
  invents dozens of h3/h4 headings this way, and nothing — not `FindPlanViolations` (wrong system,
  duplicates only anyway), not `ValidateContentHygiene`, not `ContentGuardrail` — checks any of them
  against anything.
- **Three of the four licensing sources don't reach the prompt that writes these headings, at all —
  checked directly, not inferred:**
  - *Retrieval.* `GccGroundingResolver.ResolveAsync` runs and can refuse on missing evidence
    (`GccController.cs:703-705`) — that gate is real. But its `Passages` (the typed, block-level
    verified evidence — the thing a heading could actually be licensed against) is computed and never
    read again anywhere in the controller. Its `Pages` are merged into `create.ResearchJson`
    (`MergeRetrievedEvidence`) — but `BuildPillarContext` (`GccGenerateService.cs:2100`), which builds
    the context for both `GeneratePillarBodyAsync` and `GenerateBlogBodyAsync`, never reads
    `ResearchJson` at all. The only place that ever deserializes it and renders a "QUOTEABLE RESEARCH"
    block is `BuildBriefAndResearchBlock`, called from exactly one place:
    `GenerateStartingContentAsync:1111` — the *other* content types (techArticle etc.), not pillar or
    blog. **Retrieved evidence is resolved, merged, and then never seen by the two highest-volume
    generators.** The Urgent section's "Closed. Retrieval landed as part of Stage 4's grounding gate"
    is true only for the refusal gate — evidence presence is checked, but the evidence itself still
    doesn't reach pillar/blog's prompt. Presence of a gate is not the same claim as presence of
    grounding; this plan should not make that read easy to conflate a second time.
  - *Competitor headings.* Stage 8a's own entry says it plainly: "Not wired into outline selection."
    `GccCompetitorAnalysisResolver` has no caller inside `GccGenerateService`.
  - *PAA questions* — the one source that does reach generation, but only into the isolated FAQ
    section Stage 8c added (verbatim, by construction, so no provenance question even arises there).
    Stage 8c's FAQ questions are never available to the *main body's* h3/h4 invention.
  - *Brief fields* are the only source that reaches pillar/blog's main body today, via
    `BuildBriefBodyGuidance` — and it renders POV/style controls (intent, tone, CTA, length,
    E-E-A-T signals), not factual claims a heading could cite.

**What this changes about "the real fix," concretely.** The old estimate (a `sectionOutline` JSON
field + a `GeneratedContent` property + a `ProjectSnapshot` version bump) was pricing a task against
a system that isn't running. The real fix, priced against what's actually live, is three sequential
pieces, not one:

1. **Wire retrieval into pillar/blog.** Either call `BuildBriefAndResearchBlock` from
   `BuildPillarContext` (reads `ResearchJson`, already populated by the existing merge — cheapest),
   or thread `grounding.Passages` through as typed evidence (richer, but needs a new parameter on
   both `GeneratePillarBodyAsync`/`GenerateBlogBodyAsync` and a render path for it). Without this,
   "licensed by a verified retrieval passage" can never be true for a pillar/blog heading, because no
   retrieval passage is ever shown to the model that writes them.
2. **Wire competitor headings into the same context**, so `GccCompetitorAnalysisResolver`'s output is
   visible material the model can draw a heading from, not stored evidence nothing reads.
3. **Only then does provenance-tagging make sense**: extend `SectionJsonContract` so every section
   the model writes states which of the now-actually-available sources justified it; extend `Section`
   with a non-`[JsonIgnore]` provenance field so it survives serialization into the artifact version
   row; write a binary validator — no similarity matching — that checks each tag against the real,
   concrete evidence set assembled for *that* generation call (a retrieval URL that's actually in
   `Passages`, a brief field that's actually non-empty, a PAA question that's actually in the curated
   list, a competitor heading that's actually in the resolver's output for *this* project) and fails
   the whole generation on any tag that doesn't resolve. Fail closed, same as everywhere else in this
   codebase — not a warning, not a partial strip.

Steps 1 and 2 are themselves real wiring work, not scaffolding around step 3 — and they're the
reason "Stage 2 in full" now costs meaningfully more than what was scoped when that ordering decision
was made. Flagged back to Jeff rather than built silently against the corrected-but-still-larger
scope. Jeff chose the full 3-step build.

**Built, 2026-09-22.** All three steps, against `GccGenerateService`:

1. **Retrieval wiring** used the cheaper of the two named options — `BuildBriefAndResearchBlock`'s
   research half, split out as its own `BuildResearchBlock(create)` so pillar/blog can pull it in
   without re-rendering the Brief a second time (that block already exists separately via
   `BuildPillarContext`/`BuildBriefBodyGuidance`).
2. **Competitor wiring** added a `GccCompetitorAnalysisResolver` dependency to `GccGenerateService`
   and calls it from both `GeneratePillarBodyAsync`/`GenerateBlogBodyAsync`, gated on
   `create.ProjectId` — empty, never a throw, when the create has no project or no indexed
   competitor crawl.
3. **Provenance tagging**: `Section` gained a `Provenance` field (the mirror image of `Id` —
   `Id` is `[JsonIgnore]`, code-assigned, never read from the model; `Provenance` is the opposite,
   model-assigned, never `[JsonIgnore]`, so it rides straight through into the artifact version row
   `GccController.RunGenerateAsync` already persists). `GccHeadingProvenanceGuard
   .FindUnlicensedHeadings` walks the returned section tree at every depth and checks each tag —
   `plan` / `retrieval:<url>` / `brief:<field>` / `paa:<question>` / `competitor:<heading>` — against
   the exact evidence set assembled for that call. Any unresolved tag throws
   `InvalidOperationException` before the document is assembled; nothing is trimmed or persisted
   half-licensed.

**A real discovery made while wiring step 1, not anticipated by the plan text above.** The first
attempt folded the research/competitor blocks into `BuildPillarContext`'s `sourceContext`
(`ProjectGenerationContext.CrawledParagraphs`) on the assumption that's what reaches the model — it's
how `GenerateStartingContentAsync`'s other content types get research. It doesn't reach pillar or
blog: `ResearchBriefBuilder`'s `ArticleSection` phase (pillar body's own phase) never calls
`AppendCompactSiteContext`, the one place `CrawledParagraphs` is ever rendered — caught by the new
integration tests actually asserting on the rendered prompt, not just on the guard's math. Fixed by
routing evidence through a direct `evidenceBlock` parameter on `BuildArticleSectionBatchPrompt`/
`BuildStandaloneBlogBodyPrompt` instead, appended straight into their own system text — decoupled
from `ResearchBriefPhase`'s per-phase rendering entirely, so it can't silently depend on which phase
happens to include it.

**Scope actually held to pillar and blog**, matching the plan's own framing ("Pillar and Blog — the
highest-volume outputs"). `GenerateStartingContentAsync`'s fallback branch (techArticle and other
types) was left untouched — it already gets research a different way, and pulling it into this stage
would have been scope beyond what was decided.

**Not attempted, left for a real decision later, same as Stage 8a's own scope cut:** the Coverage
Gate itself — consuming competitor headings/retrieval at *outline selection* rather than only at
*provenance checking* — is a different, later change; this stage makes the input real and checks
what the model does with it, it does not choose the outline.

899 tests pass (882 before this stage), 17 new: `GccHeadingProvenanceGuardTests` (11, pure guard
logic) and `GccGenerateServiceProvenanceTests` (6, live-path integration — an unlicensed heading
refuses generation, a `plan`-tagged heading passes with no other evidence, and — the two that caught
the `CrawledParagraphs` dead end — competitor/retrieval evidence actually reaching the rendered
system prompt, not just satisfying the guard).

## Stage 3 — The Brief reaches generation *(v1 side DONE 2026-09-21; v2 side dropped 2026-09-22)*

`GccV2CreateLibraryWriter.BuildResearchUserPrompt` (`:749-768`) is `private static` with 3 call
sites (`:391` outline, `:432` section, `:683` long-form).

**Do not inject the whole brief at all three.** That multiplies tokens by section count and invites
every section to re-cover the same themes — a repetition failure the filler ban does not catch.

| Call | Gets |
|---|---|
| Outline (`:391`) | SERP organics, PAA clusters, angle, intent, buying stage |
| Section (`:432`) | Audience, tone, notes — plus only the brief content relevant to that heading |
| Long-form (`:683`) | As section, plus CTA |

Render as labeled prose, never a raw JSON dump (v1's mistake at `GccGenerateService.cs:160-219`),
carrying *"if audience notes conflict with segment, follow notes."*

**Sequencing:** design the renderer **after** Stage 7 adds `serpTitles`/`serpUrls`/
`relatedSearches`/`paaQuestions`, or it gets designed against a brief about to change shape.

**v1 side — DONE.** `GccGenerateService.BuildBriefAndResearchBlock` dumped `create.BriefJson`
verbatim; the "raw JSON dump" mistake this section calls out by name. `BuildBriefFieldsBlock` now
renders the already-parsed `BriefFields` as one labeled line per populated field, carrying "if
audience notes disagree with the segment, follow notes" inline. Covers
`GenerateStartingContentAsync`'s content types (techArticle/social/ads/imagePrompt/aiTool/
multi-select); pillar/blog got their own version via `ContentPromptBuilder.BuildBriefBodyGuidance`
in the Urgent fix. Verified: the raw JSON string can never appear verbatim in the rendered block.

**v2 side — dropped, 2026-09-22.** `GccV2CreateLibraryWriter.BuildResearchUserPrompt` belongs to the
same dormant `-v2` job-worker pipeline named in Stage 5's correction below: `ContentGenerationOrchestrator`
and everything routed to it (`V1Restore`, `GccV2JobWorker`) has zero live frontend callers, checked
directly — `generateGccCreate` in `gcc-api.ts` calls `api/geek-content-creator/creates/{id}/generate`,
never a `-v2` route, and there is no `geek-content-creator-v2` reference anywhere in this repo's
frontend. Jeff decided not to pursue making it live. `GccGenerateService` is the writer; its Brief
rendering is the v1-side work above, already done.

## Stage 4 — Bring retrieval and verification to v1 *(DONE 2026-09-22 — see items 1-5, and the correction below them)*

**The output contract, which decides this stage's shape.** The output must end up HTML, and there
must be **one** solution that produces it. `SectionHtmlRenderer` already is that solution and says
so: *"The only place tag characters are produced in the whole pipeline."* It builds an
HtmlAgilityPack DOM node-by-node from a `ContentDocument` — never string concatenation — so tags are
balanced by construction and inserted text is encoded automatically.

**Therefore the model never emits markup. Not Markdown, not HTML.** It returns content; the document
model holds structure; the renderer makes tags. Any prompt asking the model for `##` or for `<h2>`
creates a second markup producer and is wrong for the same reason.

**Correction — my own error, 2026-09-21.** Removing Markdown from `GccGenerateService` (:260,
:1995, :2030, :2122) was right; replacing it with *model-authored HTML* was not. That swapped which
markup the model invents instead of taking markup out of the model's job, and made
`GccGenerateService` a second tag producer. Jeff caught it: *"producing two solutions to out html."*

**The block-kind gap, measured.** The corpus types seven kinds
(`Geek-Crawler-v2/src/crawl/extract-content.ts:418-425`). `ContentDocument`
(`Workflow/Domain/Entities/ContentDocument.cs`) represents four:

| Corpus block | `ContentDocument` | |
|---|---|---|
| `heading(level)` | `Section` heading + nesting | present |
| `paragraph` | `TextParagraph(Runs)` | present |
| `listItem(ordered)` | `ListParagraph(Ordered, Items)` | present |
| anchors | `Run.Href` | present |
| `quote` | — | **missing** |
| `code` | — | **missing** |
| `term` / `definition` | — | **missing** |

**Why the gap exists, and it is not an oversight:** v1 had no exposure to RAG or to ingesting those
pipelines. `ContentDocument` was designed for article output, so it covers the article-shaped kinds
and lacks the ones real crawled pages carry — code on docs pages, definition lists on glossaries,
blockquotes. Same category error as Readability: an article-shaped model applied to a corpus that is
mostly not articles.

**This also prices what v2 was destroying.** `ListParagraph` and `Run.Href` already exist, so
that flattening of `-`/`*` into prose, and the hand-rolled `[text](href)` scanner, were
flattening and then reconstructing structure the target model holds natively.

**The gate's granularity — decided 2026-09-21.** Each content type declares the evidence it
requires; a draft whose required evidence is absent is **refused with a named reason**, never
silently degraded. Refusal is at the draft, not per-section: a half-grounded article is the middle
state the repo already bans. A social post does not get refused for want of a partner crawl, because
it never declared one.

**The work, in order:**

1. **Extend `ContentDocument`** — **DONE 2026-09-21.** `QuoteParagraph(Runs, Cite)`,
   `CodeParagraph(Code, Language)`, `DefinitionParagraph(Items)` / `DefinitionItem(Term,
   Definition)`. Every match site updated, since an unhandled subtype vanishes silently:
   `SectionHtmlRenderer` (`blockquote[cite]`, `pre>code`, `dl>dt+dd`), `ContentDocumentText`
   (the one shared projection), `ContentGuardrail` (quotes and code pass through uncleaned —
   cliché-stripping a quote produces a misquote). The checklist for an eighth kind lives on
   `Paragraph` itself and names the dormant v2 sites. 784 tests pass.

   *Found and removed on the way:* `GccGenerateService.FlattenDocument` was a **second**
   implementation of `ContentDocumentText.Flatten` that emitted `"- "` bullets into a prompt
   (`:1152`) — Markdown at prompt assembly, via exactly the duplicate projection `CLAUDE.md` warns
   caused the corpus drift.
2. **Create → project link — DONE 2026-09-21.** `gcc_creates.project_id`, nullable, indexed, FK
   to `gcc_projects` with RESTRICT. Was blocking: **a create could not reach its partner and
   competitor URLs.** This is the structural cause of *"didn't cite or quote Partners/Tools"*: even
   with retrieval wired, nothing tells it which hosts to query.

   | Fact | Where |
   |---|---|
   | Partner/competitor URLs live on the **project** | `GccProject.PartnerUrls`, `.CompetitorUrls` (`ProjectEntities.cs:39,42`) |
   | A create carries **no `ProjectId`** | `GccCreate` has `ClientId`, `OwnerUserId`, `ProjectSiteRunId` only (`Entities.cs:5-28`) |
   | The only create→project join is `GccDeliverable(ProjectId, CreateId)` | `ProjectEntities.cs:198,201` |
   | Deliverables are created by an explicit operator action, not on create | `GccProjectsController.CreateDeliverable:308` |

   So at generation time a create typically has no project link at all. `ClientId` does not
   substitute — a client may run several projects over different sites.

   **The retrieval half is otherwise ready and needs no new client.**
   `IGeekCrawlerRagClient.QueryAsync(need, runId, crawlType, …)` already returns
   `IReadOnlyList<GccQuoteablePage>` — **the exact type** `research.Quoteables` feeds into the v1
   prompt at `GccGenerateService.cs:169`. It also already carries the rule this stage needs:
   `Failed` is documented *"empty Pages must not be treated as success."* URL → run id is
   `HostsIndexedAsync`, which returns `GeekCrawlerRagHostIndex(Url, Host, Indexed, RunId)`.
   `GccV2CreateLibraryWriter.SeedQueryAsync` (`:602-640`) is the working reference for the
   null / `Failed` / warning handling, and `BuildNeed` (`:641`) for composing the query.

   Nullable because existing creates predate it — and because a create with no project genuinely
   cannot resolve partner evidence, which must **refuse** rather than generate ungrounded. Carried
   through `GccCreateDto`, `CreateGccCreateCommand`, the repository mapping and the create endpoint;
   model snapshot hand-updated alongside the hand-written migration.

3. **The grounding gate — DONE 2026-09-21.** `GccGroundingResolver`:

   ```
   project → PartnerUrls / CompetitorUrls → HostsIndexedAsync → run ids
           → QueryAsync(need, runId, crawlType) → GccQuoteablePage[]
   ```

   A null client result and `Failed` are both failures; **empty `Pages` from a successful query is
   not** — another run may cover the topic. Requirements are declared per content type
   (`RequiredFor`), refusal is at the draft, and the refusal carries a named reason mapped to 400
   through the controller's existing convention. Retrieved passages fold into the create's research
   so the existing quoteable prompt block carries them, appending to operator uploads rather than
   replacing them. 800 tests pass; 16 new ones assert the declared policy.

   **Closed 2026-09-21.** `IGccProjectReader` — a narrow interface over the one method grounding
   needs, rather than mirroring `HttpGccRepository`'s 43. Every refusal path is now proven: no
   project, no partner URLs, no indexed crawl, null client result, `Failed` never read as success,
   and a successful-but-empty query still refusing.

   **The gate changed on the orchestrator path too.** `293040a`/`293da90`'s "optional enrichment,
   not a generation gate" is reversed for the four types that cite partners — pillar plan, pillar
   body, tool pages, blog — which now refuse when no partner URLs are declared. Social, cold
   outreach and image prompts declare no requirement, the same split as `RequiredFor`.
   `AllowOutsideSiteScope` still overrides, matching the site-analysis and hierarchy gates beside it.

   **Attribution is now required in the prompt.** The quoteable block carried each URL but only
   said "quote/paraphrase; do not invent". It now states four rules — claims must come from a
   passage, must name the source and carry its URL, must not extrapolate a capability/price/
   integration/limitation no passage states, and must omit what the evidence does not cover — and
   labels each passage *retrieved from the crawl index* or *operator-supplied*.

4. **Map typed corpus blocks → `ContentDocument`.**

   **Correction, 2026-09-21 — "RAG flattens" was wrong framing and is withdrawn.** Two different
   things were collapsed into one:

   | | Markdown conversion | The plaintext projection |
   |---|---|---|
   | What it did | Threw hrefs and heading levels away **irrecoverably** | Derives a flat string **alongside** the blocks |
   | Why | A failed implementation | Chunk text and verification text must be *the same string*, or correct citations fail |
   | Recoverable | No — no blocks to fall back on; 5,274 pages went | **Yes — the blocks are still in Mongo** |

   `block_text.py`'s own docstring states the purpose: *"a quote comes out of a retrieved chunk and
   is then matched against the page projection, so any divergence makes correct citations fail."*
   Non-destructive and deliberate.

   **So nothing is blocked and nothing is lost. GeekAPI simply was not reading the blocks it
   already had.** `MapChunksToQuoteable` (`:761`) builds each `GccQuoteablePage` from
   `ChunkDto.Text` with `Headings: []` — correct for prompt text, but it is the projection, not the
   structure. The design anticipated this: `ChunkDto` carries `PageId`, so a matched chunk leads
   straight back to its page's blocks.

   `AGENTS.md` already names the route: structure is recoverable from `blocks` (`heading.level`,
   per-block `html`, per-block `anchors`) even though it is not recoverable from the projection.
   Read `crawl_pages.Blocks` for the retrieved URLs — no change to Geek-Crawler-Rag, and no second
   text projection, which is the thing that must never be written twice.

   **`GccCorpusBlockMapper` — DONE 2026-09-21.** Blocks in, typed nodes out, kind for kind: `quote`
   → `QuoteParagraph` carrying the page URL as `Cite`; `code` → `CodeParagraph` as raw text;
   `term`/`definition` → paired `DefinitionItem`s; consecutive `listItem`s → one `ListParagraph`,
   closed when a paragraph interrupts or `ordered` flips. A `row` has no node type, so its cells
   are joined rather than dropped. An anchor becomes an `Href` only when it labels the whole block
   text — anchors carry no offsets, so placing a partial link would be guessing at structure, which
   is the failure the mapper exists to avoid. 14 tests, including that all seven kinds survive one
   page. `IGccCrawlPageReader` reads the pages by URL within a run (≤32 per call).

   **Attribution did not need this and shipped first** — a chunk plus its URL is already a citable
   quote. Typed blocks preserve *shape* (code as code, a glossary as a glossary), which is
   secondary to citing at all.

   Original intent, unchanged: block kind to node type. No Markdown, no model-authored HTML, and
   not via the flat text projection — that projection discards hrefs, tags
   and heading markers by design (`AGENTS.md`), which is why `Build` filters on `p.Html`.
5. **Route `GccGenerateService`'s Create path through `ContentDocument` — DONE 2026-09-21.**
   `GeneratePillarBodyAsync` and `GenerateBlogBodyAsync` asked the model for a prose body and the
   caller read structure back out of the string — first as Markdown `"## "`, then briefly as HTML,
   which was the same defect in different markup and made this service a second tag producer.

   Both now use the structured prompt builders this service already used for its standalone blog
   path: `BuildPillarLedePrompt` + `BuildArticleSectionBatchPrompt`, and
   `BuildStandaloneBlogLedePrompt` + `BuildStandaloneBlogBodyPrompt`. Sections return through
   `LlmResponseJsonParser`, become a `ContentDocument`, pass `ContentGuardrail`, and serialize with
   `CwDocumentJson` — the shape `renderArtifactBody` already renders.

   `ExtractSectionHeadings` parses nothing now: `ContentDocumentText.TopLevelHeadings` reads them
   off the tree. The interim HtmlAgilityPack scan and its regexes are gone.

   **The known deviation below is closed:** `SectionHtmlRenderer` is once again the only place tag
   characters are produced, on every path.

**Deviation closed 2026-09-21.** `SectionHtmlRenderer` is the single tag producer on every path;
the Create path returns a `ContentDocument`. It was recorded while it was true because a rule the
code does not enforce must never be written down as though it does (`CLAUDE.md` §2).


**This stage used to say "switch the writer" — v1 → v2. There is no switch.** v1 is the writer
and always was; this stage adds the retrieval and verification it has no concept of. Do not port v2's Markdown document
model, its serialize/parse loop, or its section flattener.

**The four bullets below named `ContentGenerationOrchestrator`/`V1Restore` as "v1." Corrected,
2026-09-22 — that naming is what's wrong, not (only) the bullets' content.** Checked directly:
`ContentGenerationOrchestrator`, reached only via `V1Restore`/the `-v2` job-worker route, has zero
live frontend callers — same finding as Stage 3's v2 side and Stage 5 below, and the same standing
decision (Jeff, 2026-09-22): don't pursue making it live. **`GccGenerateService` is v1** — it is what
`GccController` actually calls, what the frontend actually reaches, and item 5 above already routed
it through `ContentDocument` with real grounding (Stage 4 itself), citation, and provenance (Stage 2).
The bullets are kept below as a record of the track that was considered and dropped, not as
remaining work:

- ~~Feed `ContentGenerationOrchestrator` retrieved, verified corpus passages~~ — done instead via
  `GccGroundingResolver` + `GccCorpusBlockMapper`, both wired into `GccGenerateService`'s live path.
- ~~Carry the seven block kinds through to the generated document~~ — `ContentDocument`'s four
  present kinds plus `QuoteParagraph`/`CodeParagraph`/`DefinitionParagraph` (item 1 above) already
  serve the live path; this was never orchestrator-specific.
- ~~V1Restore stays — Stage 6's `BuildLedeTypeGuidance` caller lives there~~ — also corrected: Stage
  6's real live caller was `GccGenerateService`'s `BuildStandaloneBlogLedePrompt`, missing the same
  guidance pillar already had. Fixed there, 2026-09-22.
- ~~Tier decision — move the job worker/V1Restore out of GeekAPI, or record the exception~~ — moot;
  nothing is being built on that path to move.

**Presence, not fitness:** all 11 v2 methods exist and compile (`GccV2WriteService.cs:380-405`) and
**none has ever produced a document.** The 11-type target now applies to `GccGenerateService`'s path.

## Stage 5 — Frontend reaches the pipeline *(dropped 2026-09-22 — the frontend already reaches the live pipeline)*

**Dropped, not done.** This stage's whole premise was pointing `generateGccCreate` at the `-v2`
job-worker route so `ContentGenerationOrchestrator` would finally have a live caller. Checked
directly, 2026-09-22: `generateGccCreate` (`gcc-api.ts:253`) calls
`api/geek-content-creator/creates/{id}/generate` today — the live `GccController`/`GccGenerateService`
route — and there is no `geek-content-creator-v2` reference anywhere in this frontend. The frontend
was never *not* reaching a pipeline; it was reaching the correct one the whole time, under a name
(`api/geek-content-creator`, no suffix) this stage's own title didn't credit as "the pipeline." Jeff
decided not to pursue making the `-v2` route live (same decision as Stage 3's v2 side and Stage 4's
closing bullets), so there is no routing change to make.

**5a/5b kept below as a record, not remaining work.** Both were real problems on the `-v2` path
specifically — the 11-value canonical mapping, and the fan-out gap between N social-platform
checkboxes and `CreateDraftWorkspace` polling one job — but that path isn't being pursued, so neither
needs solving there. If the live path (`GccGenerateService`/`GccController`) ever needs multi-platform
fan-out, that would be scoped fresh against its own code, not inherited from this stage's v2-shaped
answer.

**5a — routing and mapping (dropped).** Point `generateGccCreate` (`gcc-api.ts:244`) at
`POST /api/geek-content-creator-v2/creates/{id}/generate` and poll `.../jobs/{id}`. The 11 UI values
→ canonical mapping (`techArticle`→`tech-article`, `imagePrompt`→`image-prompt`, `aiTool`→`tool`,
`metaAds`/`googleAds`→`ads`, `linkedIn`/`x`/`instagram`→`social`) **lives server-side as the single
source of truth**, not in the client.

**5b — platform mechanisms (dropped).** Per-job platform: a Create-level `socialPlatform`
(`GccV2WriteService.cs:1636`) cannot express LinkedIn + X + Instagram checked together, and
`WriteAdsAsync:1082` has no Meta/Google split at all. **Fan-out:** N checkboxes create N jobs while
`CreateDraftWorkspace` polls one. Both are missing mechanisms, not unset fields.

**Hidden dependency:** `ProjectSiteCrawlRunId` and non-empty `SiteSectionJson.RelatedPages` may
depend on the own-site crawl, which touches out-of-scope Site Analyzer. Resolve before committing to
5a.

## Stage 6 — Lede guidance *(DONE 2026-09-22)*

**Delivered 2026-09-21 for the Create path.** Routing the pillar lede through
`BuildPillarLedePrompt` brings `BuildLedeTypeGuidance` to `GccGenerateService`, which previously had
no lede-type handling at all. It is now live on both paths, and formalized rather than deleted —
which was the ask. What remains below is `blog`, which still uses a hardcoded opening.

`BuildLedeTypeGuidance` (`ContentPromptBuilder.cs:230-286`) reads fields already present on
`wc.BaseContext` (`GccV2WriteService.cs:111`).

- Expose on `IContentPromptBuilder` as a `string`-returning method.
- Call only at the lede sites — `WritePillarAsync:918-924`, `WriteBlogAsync:974-975` — distinct from
  the body loops (`:938-945`, `:990-997`).
- Fixes `blog`, which uses a hardcoded "prefer creative opening" today.

**Ordering constraint — void as of Stage 1's decision.** It assumed Stage 4 deletes V1Restore and
with it this method's only live caller (`ContentGenerationOrchestrator.cs:1424`). Under (b),
V1Restore stays and the caller is never removed. Stage 6 becomes formalization, not a rescue:
expose it properly, and fix `blog`, which uses a hardcoded "prefer creative opening" today.

**Blog fixed, 2026-09-22 — on the actually-live path, checked directly.** The bullets above named
`GccV2WriteService`'s `WriteBlogAsync`/`WritePillarAsync` — dormant, zero live callers, same as every
other `GccV2*` writer this session has already found unreachable. The real live blog lede is
`BuildStandaloneBlogLedePrompt`, called from `GccGenerateService.GenerateBlogBodyAsync` (and from
`GenerateStartingContentAsync`'s fallback branch, which shares the same lede prompt) — and it still
had the exact hardcoded line this stage names: *"Prefer a creative (hook/narrative) opening; use a
summary opening only if a creative angle genuinely doesn't fit"* — with **no** guidance for the other
10 of 12 `ledeType` values the prompt's own JSON contract already required a value from. Fixed by
calling `BuildLedeTypeGuidance(context)` there too, same as pillar's live lede already does. 901
tests pass, 2 new: the guidance block is present and the hardcoded line is gone; a populated
angle/intent actually renders into the prompt, not just that some text appears.

## Stage 7 — Keyword SERP by manual upload *(DONE 2026-09-22)*

**Automated fetch is foreclosed, not merely risky.** `cheerio-runner.ts:221` sets
`respectRobotsTxtFile: { userAgent: BOT.name }` unconditionally with an `onSkippedRequest` recording
`robots_disallowed` (`:222-226`); Google disallows `/search`. The crawler refuses before reaching
bot detection — correct, since `bot/identity.ts` declares the bot in headers (`From`, `X-Bot-Name`,
`X-Bot-Url`). Alternatives rejected: bypassing robots, or an external crawl that persists.

**Implement it as an `ISerpProvider`.** Geek-SEO already owns the SERP abstraction
(`SeoProviderRegistration.cs`, `SerpController`, `SerpAnalysisService`). Manual upload is a natural
implementation of it. Building on GCC's parallel `GccSavedSerpParser`/`GccSerpLensModels` without
reconciling them leaves two SERP models forever — say which survives.

Two input modes:

1. *Keyword HTML upload* — `GccSavedSerpParser.cs` parses organic, PAA, related searches,
   `InferShape`, `ScorePaaRelevance`.
2. *Direct PAA entry* — **one question per line**, already the implemented contract
   (`brief-catalog.ts:205`; `splitLines` at `:483-488`). The four fields exist with no input UI today.

**Presence, not fitness — confirmed exactly right, and it changed the whole shape of this
stage.** `SerpIngestPanel.tsx` and `serp-lens.ts` were real and complete: the parser
(`GccSavedSerpParser`), a live endpoint already calling it, the full upload/paste/select/confirm
panel, and **both merge modes already implemented** in `applyCuratedSerpToBrief`. `SerpIngestPanel`
had zero importers; `applyCuratedSerpToBrief` had zero callers anywhere. "Wiring, not building" was
exactly right — the fix was mounting one component and calling one function that already existed.

**Model reconciliation, decided:** `GccSavedSerpParser`/`GccSerpLensModels` were not touched.
Geek-SEO's `SerpResult`/`SerpOrganicResult`/`PeopleAlsoAskResult` fit the raw data GCC's parser
produces (Domain/Snippet/Answer/SourceUrl all nullable or defaultable), but `SerpAnalysisService`
— the actual consumer of `ISerpProvider` in Geek-SEO — is a different product surface entirely (its
own 7-day deep-cache, `DeepSerpResult`, competitor-gap analysis) with no relationship to GCC's
Brief. Routing manual upload through it would have been wiring to the wrong consumer. GCC's model
(`SavedSerpParseResult`/`SavedSerpOrganic`/`PaaCandidate`) survives because it carries real,
GCC-specific advisory value — `SerpShapeSummary`'s Angle-for-SEO guidance, `PaaCandidate`'s
relevance scoring — that Geek-SEO's raw-fetch shape has no reason to hold. Left as two models on
purpose, not by default: one is raw SERP data, the other is content-strategy analysis built from it.

Required behaviours — all four done:

- **Zero organics parsed ⇒ fail — DONE.** `curatedSerpHasOrganics` existed but nothing called it in
  `SerpIngestPanel`; confirm was gated only on `parsed` being non-null, so every organic could be
  unchecked and confirm would still fire. Now gates and disables the button.
- **Merge mode: conflicts surfaced, not silent — DONE.** `applyCuratedSerpToBrief` now returns
  `{ brief, conflicts }` instead of a bare brief. `ContentBriefPanel` renders each conflict with
  "use SERP value" / "keep existing" actions.
- **Provenance stamped — DONE.** `serpCapturedKeyword`/`serpCapturedAt`/`serpLocale` added to
  `ContentBrief`, stamped only when a field is actually written (never claimed on a no-op merge),
  surfaced in `buildBriefBlock`'s rendered output.
- **No-SERP gate — decided: optional, not required.** No create has ever required SERP data —
  forcing it now would be a breaking change with no consumer yet to justify it. "Recorded as
  skipped for that create" is Stage 8's job: 8b/8c are the actual consumers of that skip signal,
  and they don't exist yet. Building the skip-recording plumbing here, ahead of anything that reads
  it, would be exactly the orphaned scaffolding this whole plan has been finding and fixing all
  session. Stage 8 records the skip when it's built, against this decision.

**Also done, not originally listed:** direct PAA entry — a plain textarea bound to `paaQuestions`,
kept deliberately separate from the upload flow (an operator who already knows the real questions
shouldn't need to save and parse a page), bypassing `applyCuratedSerpToBrief` since hand-typed
questions carry no SERP provenance to stamp.

Frontend production build clean, `tsc --noEmit` clean, eslint clean on every changed file.
`serp-lens.test.ts`: 8 assertions — the zero-organics distinction, provenance stamped only on a
real write, both merge modes, and that a conflict carries the value a caller needs to offer a
"use it anyway" action.

## Stage 8 — The three analyses *(8a and 8c done; 8b split -- rescoped half done, extraction half's foundation done, full richness open — 2026-09-22)*

| Analysis | Source | Persisted? |
|---|---|---|
| Competitor | `competitors` crawl pages | Already stored |
| Partner | `partner` crawl pages | Already stored |
| Keyword | Stage 7 upload | In `briefJson` — existing store |

**The real shape of this stage, found while scoping — not "build three analyses," but "reach v2's
real extraction services from v1 for the first time."** `GccV2PartnerExtractionService`
(comparisons, alternatives, pricing, FAQs, case studies, battlecards, quote-verified — 501 lines,
real, tested) and `GccV2HeadingTreeBuilder` (heading outlines from arbitrary HTML, 195 lines, real,
tested, already used by the live project-site hierarchy path) are genuinely working code with real
callers — **but every one of those callers is `GccV2*` namespace, and the frontend makes zero calls
to any `api/geek-content-creator-v2/*` route, confirmed directly.** Same trap as `GccV2WriteService`
and `SerpIngestPanel` before it: presence inside the v2 namespace is not reachability. Confirmed:
neither `GccGenerateService` nor `ContentGenerationOrchestrator` (the live v1 writer) calls either
service anywhere today. So each of 8a/8b/8c is a wiring task from v1 into this real v2 logic — the
same pattern as Stage 4's grounding gate, done three times.

**8b decided, 2026-09-22:** rescope to *"partner domain absent from the top N organic results"*
plus a weak title/snippet mention check. No new fetch, no new persisted rows — computable today
from data already crawled. The non-persisting-fetch alternative was available and not chosen.

**Approach decided:** one analysis at a time, in the plan's own order — 8a → 8b → 8c — each wired,
tested and committed before the next starts, matching Stage 4's rhythm.

**8c's Markdown concern, already resolved — checked directly.** `BuildArticleFaqSectionPrompt`
(`ContentPromptBuilder.cs:945`) already emits `SectionJsonContract` — `tag`/`heading`/`paragraphs`,
"no code fences, no commentary" — not `##` headings. Whatever the plan's concern was written
against, it isn't the current code. The heading-title naming concern ("People Also Ask" is Google's
feature name, not necessarily reader-facing copy) is real but minor — left as-is; "People Also Ask"
is now common enough as reader-facing copy that this isn't a correctness issue.

**Stale reference fixed:** 8c said `PaaPafCluster`; that type was renamed to `PaaCluster` in Stage 0
(the PAF-collision fix) after this section was written.

**Coverage gate — applies to all of Stage 8.** Feeding competitor headings and PAA clusters into
outline selection produces headings the corpus may have nothing on, leaving the writer only invention
or refusal. **A candidate heading enters the outline only if retrieval returns verified evidence for
it; otherwise it is recorded as a content gap and not written.** Those gaps are the most valuable
output of competitor analysis, and recording them is the fail-loud alternative to a thin section that
reads fine.

**8a. Competitor — DONE 2026-09-22.** `GccCompetitorAnalysisResolver`: project → `CompetitorUrls`
→ `HostsIndexedAsync` → indexed run ids → `ListPagesBySeedsAsync` → per page,
`GccV2HeadingTreeBuilder.Build(page.Html)` for the heading tree (a real tree — an h2 nests under
its h1 as a child, proven by test, not flattened) and the new
`IJsonLdParserService.DistinctDeclaredTypes` for the page's declared schema.org types.
`GccJsonLdBlockExtractor` is `SiteCrawlerService.ExtractJsonLd` ported and made reusable, per the
plan's own word for it. Reused Stage 4's `IGccProjectReader`/`IGccCrawlPageReader`/
`IGeekCrawlerRagClient` wholesale — no new plumbing, only new analysis logic.

*Content mix scope cut, taken as flagged:* `InferShape` classifies SERP titles, not page structure,
and needs its own logic. Not built — the resolver produces the raw heading/schema material a
content-mix classifier would consume; it does not classify.

*Not wired into outline selection at write time* — this resolver's output became a real, checkable
license for a heading once Stage 2 landed (`GccHeadingProvenanceGuard`'s `competitor:<heading>` tag,
matched against exactly this resolver's output), which is the Coverage Gate's actual realization:
"a candidate heading enters the outline only if [it resolves against real evidence]; otherwise it is
not written" — done after the fact (the model proposes, the guard refuses) rather than before it
(pre-filtering candidates), a distinction Stage 2's own writeup records but that does not change
which headings end up licensed. 871 tests pass, 7 new.

**8b. Partner — split into two, one done, one still open.**

**Missing-brand-integration, rescoped — DONE 2026-09-22.** `GccMissingBrandIntegrationCheck`: per
partner, whether its domain ranks in the top N of the brief's curated organics, at what position,
and a weak title-mention check for when the domain itself doesn't rank but a competitor's title
names it. Pure function, no crawl reads, no LLM calls. 879 tests pass, 8 new.

**The extraction half — foundation DONE 2026-09-22, full richness still open.**
`GccV2PartnerExtractionService` (22 payload types — audited against the restored
`plans/partner-extraction-complete.md` spec and found *richer* than it, not thinner) is real, and
its trigger question is answered: `GenerateToolPageAsync` calls it directly on `create`'s already-
resolved partner pages (`ResearchJson.Quoteables`, the same `GccQuoteablePage[]` `GccGroundingResolver`
produces), no new caching layer, no scheduling decision needed — extraction runs once per generation
call, same cost shape as every other per-call LLM step this pipeline already makes. Consumes into
`BuildToolBodyPrompt`'s `extractedToolResearchJson` parameter (already existed, wired to nothing live
before this) and real partner `SoftwareApplication` JSON-LD (price/review fail-closed). Fail-closed
per instruction: a create with no usable partner extraction refuses rather than generating an
ungrounded page. 906 tests pass, 5 new.

**What this does not yet do — the richness the spec's §8 "Primary Create outputs" column describes
beyond a single tool page:** Comparison (`versus` tables), Alternatives (deficit-router switch
content), dedicated Ads/social snippets pulling `Advertisement`/`Offer-CTA` payloads, and the
competitor-deficit → partner-swap join (`GccV2PartnerAlternativesJoin`'s live-path equivalent) are
all real, spec'd, and still unbuilt — each is closer to a new content type than a wiring task, and
was deliberately left out of this pass rather than folded in under time pressure. See the codebase
audit and the tool-page grounding commit (`ca6ae95`, GeekBackend) for what's reusable as-is.

**8c. Keyword intent — DONE 2026-09-22.** The real gap wasn't clustering PAA again — Stage 7's
`SerpIngestPanel` already lets the operator pick which PAA questions matter, before they ever reach
`briefJson`. It was that `GccGenerateService.GeneratePillarBodyAsync` — the path the live frontend
actually calls, confirmed via `src/services/gcc-api.ts`, not `ContentGenerationOrchestrator`'s
separate `Project`/`Project.BriefJson` system — parsed `PaaQuestions` via `ExtractBriefFields` and
then never used them. No FAQ section reached a pillar body on the live path at all.

Fixed by calling `BuildArticleFaqSectionPrompt` once, gated on the brief having any PAA questions,
and appending its parsed section to `bodySections` before the document is assembled. Already
verified before wiring: the prompt titles the section "People Also Ask" (Google's feature name, kept
deliberately) and emits `SectionJsonContract`, not `##` headings — no markdown risk. 882 tests pass,
3 new (`GccGenerateServicePillarFaqTests`: no-PAA means 2 completion calls, PAA present means 3 with
the third routed through the FAQ prompt, and the FAQ section's content actually lands in the
serialized document).

*Not wired into outline selection at write time* — same as 8a, and same resolution: Stage 2's guard
makes a curated PAA question a real, checkable `paa:<question>` license for any body heading the
model invents, not only the FAQ section's own verbatim ones. The Coverage Gate is Stage 2, done.

---

## Stage 9 — Emit local and FAQ schema *(DONE 2026-09-21)*

**Premise, verified 2026-09-21 — v1 schema already works.** The live long-form writer
`ContentGenerationOrchestrator` emits a properly cross-linked graph, and it fails closed
(`GccGenerateService.cs:1399` throws on an empty builder result):

| Content | Emitted | Where |
|---|---|---|
| Pillar | `TechArticle` + `Person` + `Organization` + `ImageObject` + `WebPage` + related `BlogPosting`, with the page's `SoftwareApplication` entries embedded | `:176`, `:299`, `:479`, `:538` |
| Blog | `BlogPosting` + the same envelope + related `TechArticle` | `:532`, `:601` |
| Tool | `SoftwareApplication` + the same envelope + `TechArticle` | `GccGenerateService.cs:1398` |

Nothing here is broken and nothing in this stage replaces it. This stage adds the node types that
are absent — confirmed by grep returning zero hits across all three live builders.

**The input already exists.** `JsonLdParserService` is injected into the orchestrator
(`ContentGenerationOrchestrator.cs:23`) and run over the client's own crawled markup
(`:1132`, `Summarize(crawl.JsonLdBlocks)`). It already classifies `LocalBusiness`,
`ProfessionalService`, `Organization`, `Corporation` and `Store` (`JsonLdParserService.cs:9`) and
already extracts `areaServed` (`:89`, `:190`). The result reaches the model as
`JsonLdStructuredSummary` (`:1160`). So geography is **harvested and already in the prompt** — it is
simply never written back out. No new brief field, no new input, no invented geography.

- **9a — `areaServed` on the `Organization` node — DONE.** `ProjectGenerationContext` now carries
  `SiteAreaServed`/`SitePublisherType` (the structured `JsonLdSiteSummary` was previously discarded
  right after being formatted to text), populated into every `ContentMetadata` construction site.
  Empty is omitted, never `[]` — verified by test.
- **9b — a `LocalBusiness` / `ProfessionalService` node — DONE.** `PublisherType` mirrors what the
  crawled site declared, defaulting to `Organization` when nothing was — verified by test.
- **9c — `FAQPage` / `Question` / `Answer` — DONE.** `ContentDocumentText.ExtractFaqPairs` is a
  direct port of `GccV2JsonLdBuilder.ExtractFaqPairs`/`IsFaqSection`/`CollectFaqPairs` — the dead v2
  path had already solved this correctly. Emitted only when the generated document actually has a
  section headed FAQ or People Also Ask.
- **9d — the tool-page drop, decided by reading the code.** `GenerateToolPageAsync` takes no
  project or crawl reference at all (`toolName`/`brief`/`sourceContext` only) — `JsonLdStructuredSummary:
  null` was never an oversight, there is no site to ask about geography or business type. Left
  unset, documented in the code as deliberate. `Faq` is wired anyway since it reads the tool page's
  own document, independent of any site.

**Consumer already waiting:** Geek-SEO extracts `areaServed` (`SchemaOrgExtractor.cs:413`) and
reasons over it (`LocalGapGenerator.cs:60`). Today it can only ever find it on competitor sites,
never on ours.

---

## End state — what survives

| Component | Fate |
|---|---|
| `GccV2CreateLibraryWriter` | **Keep** — the writer |
| `ContentPromptBuilder` | **Keep** — v2 depends on it for lede (6) and FAQ (8c); assign an owner |
| `ContentGenerationOrchestrator` | **Keep — this is the writer, and it works.** Add retrieval to it |
| `GccGenerateService` | **Keep** — it runs, and as of this session carries no Markdown |
| `GccV2WriteService` write path | Dormant. Deletion is open, not decided — nothing removed unasked |
| `V1Restore/` | **Keep** — v1 routing, and Stage 6's live caller sits in it |
| `GccSavedSerpParser` / `GccSerpLensModels` | Keep, reconciled with `ISerpProvider` |
| `TechnicalArticleSchemaBuilder` / `BlogPostingSchemaBuilder` / `SoftwareApplicationSchemaBuilder` | **Keep** — these are the working v1 schema path; Stage 9 extends them |
| `JsonLdParserService` | **Keep** — already harvests `areaServed` and the business type; Stage 9 writes it back out |
| `GccV2JsonLdBuilder` | Source for the 9c `FAQPage` port, then follows the v2 publish path's fate |

## Verification — binary assertions only

Output comparison proves nothing: two runs with identical inputs differ anyway.

- **Urgent:** the rendered pillar and blog prompts contain the appendix string. Assert on the prompt,
  not the article.
- **Stage 2 / 8:** every H2/H3 in the persisted outline has a non-null provenance pointer. Query the
  row.
- **Stage 3:** a rendered-prompt snapshot contains each non-empty brief field, at the call type the
  table assigns it to.
- **Stage 4:** provenance on the persisted draft names `GccV2CreateLibraryWriter`; 11 of 11 job types
  reach a terminal state other than `Unsupported`.
- **Stage 5:** each of the 11 UI values produces a job whose stored `contentType` is the canonical
  string; N checked boxes produce N job rows.
- **Stage 6:** the chosen lede type is recorded on the draft. (If the model picks it rather than code,
  that is itself worth knowing.)
- **Stage 7:** a `briefJson` row query returns the uploaded organics, PAA, and the provenance stamp.
- **Stage 9:** parse the persisted `JsonLdSchema`. For a client whose crawl summary carries a
  non-empty `AreaServed`, the `Organization` node has a non-empty `areaServed`; for one whose
  summary is empty, the property is **absent, not `[]`**. The emitted business `@type` equals the
  type the crawled site declares. A draft with Q&A structure yields a `FAQPage` node; one without
  yields none.
- Build/lint/typecheck clean is **hygiene, not verification**.

## Out of scope

Paid SERP providers. Any new store. Rewriting `GccGenerateService` internals. The legacy
`/app/workflow` UI and `content-writer-api.ts`. Site Analyzer. The `siteAnalysisProfileId` rename.
**AI Overviews** — the parser does not capture them and they are arguably the most AEO-relevant block
on a 2026 SERP; excluded deliberately. Extracting competitors' markup (8a) is analysis and stays in
scope.

**`FAQPage` emission is no longer deferred — it is Stage 9c.** It was deferred while its live
status was unclear; it is now confirmed absent from the v1 builders and present only on the dead v2
publish path. The rich-results history stands and is the reason to judge it on machine consumption
rather than SERP appearance: the verifiable fact is that Google restricted FAQ **rich results** to authoritative government
and health sites in **August 2023**, so for a site like this one they do not render. That is a
rich-results fact, not a reason to skip the markup — its plausible present value is machine
consumption (AI Overviews, LLM retrieval, entity understanding), which this plan does not evaluate.
Stage 9c proceeds on that basis. *(An earlier draft asserted a May 2026 deprecation; that was
carried over from review feedback unverified and is not supported here.)*

## Audit — known weaknesses

1. **Stage 1 is unestimated and gates 2–6.** Its premise rests on one commit message now shown
   inaccurate on a related claim.
2. **"All 11 types written" is presence, not fitness.** Same caveat now applied to Stage 7's
   never-reachable components.
3. **Stage 5's four preconditions are unverified**, one touching out-of-scope Site Analyzer.
4. **Stage 7 trades infrastructure risk for adoption risk** — upload always works, but only if
   someone does it.
5. **8a's content-mix item uses a classifier built for different input.**
6. **8b's headline join may be uncomputable** without a decision that contradicts a stated constraint.

## Settled questions

- **Persistence:** no new store. Uploaded SERP merges into `briefJson`. *Open sub-question:* 8b may
  force a non-persisting fetch of ranking URLs.
- **Keyword SERP acquisition:** manual upload. Automated fetch foreclosed by our own robots
  compliance; bypass and external-crawl-with-persistence both rejected.
- **RAG write methods:** none exist. Verified 2026-09-21.
- **Residential-IP scraper:** none exists in these repos. Verified 2026-09-21.
- **v1 schema emission:** **working, and not to be touched.** Pillar, blog and tool pages each emit a
  cross-linked graph and fail closed on an empty builder. Verified 2026-09-21 by reading
  `ContentGenerationOrchestrator` directly. *(Two earlier claims in this session that the types were
  "never emitted" were wrong: both were drawn from `GccV2JsonLdBuilder` — the v2 publish path — and
  from `GccGenerateService`, which only handles tool pages. Neither is the live long-form writer.
  The live long-form writer is `ContentGenerationOrchestrator`, which this plan had already
  identified as such at Stage 6.)*
- **Local schema input:** already harvested. `JsonLdParserService` extracts `areaServed` and the
  business type from the client's own crawled markup and puts it in the prompt. Stage 9 is emission
  only — no new field, no inferred geography.

# Evidence is resolved per draft, not per create — and three other things found tracing it

Every claim cites `file:line`. Where I could not establish something I say so rather than infer.
Code is in **GeekBackend** unless stated; this plan lives here because that is where plans are read.
Written to be reviewable without the codebase — see the appendix for terms and excerpts.

## Context

Tracing why Generate kept refusing led to a question that outlived the refusals: what happens to a
create's grounding evidence. It is resolved separately for every content type, used once, and thrown
away — so Pillar, Blog and Tool each pay for the same retrieval, can disagree about what the same
partner said, and a regenerate cannot reproduce a draft.

Two corrections from Jeff shaped this, both of which overturned where I was heading:

- **Ownership.** *"Who needs the data, who queries the data — all of this is creation's
  responsibility."* I had argued retrieval and verification belonged in RAG. They don't. Nothing
  here is a service-boundary move; it all stays inside Content Creation.
- **Persistence.** *"Crawl data is persisted on KVM4 Mongo."* I was about to propose storing
  resolved evidence on the create. That would duplicate a store that already exists, into a database
  that is forbidden here (Finding 4). **There is no persistence stage in this plan.** The defect is
  querying the corpus repeatedly, not failing to keep the answer.

---

## Finding 1 — the same evidence is resolved once per content type

`GccGenerationCoordinator.cs:180-198` fans the requested types out with `Task.WhenAll`, and each
`GenerateOneAsync` independently calls `ResolveAndMergeGroundingAsync` (`:247`). Its own doc says so:
*"Resolves its own grounding (never reused across types)"* (`:221-227`). No memoisation exists.

`RetrieveCrawlTypes` gives pillar, blog and tool the identical `EveryGroundingCrawlType`
(`GccGroundingResolver.cs:120-129`), so all three do the same work over the same runs.

**Measured for 1 project-site + 10 partner + 10 competitor runs, generating pillar+blog+tool:**

| Call | Per resolve | ×3 types |
|---|---|---|
| `rag.QueryAsync` — one per run id (`GccGroundingResolver.cs:282-291`) | 21 | **63** |
| `rag.HostsIndexedAsync` (`:265`) | 2 | 6 |
| `pages.ListPagesBySeedsAsync` (`:376`) | up to 21 | up to 63 |
| `repo.GetProjectAsync` (`:197`) | 1 | 3 |

≈**135 HTTP round trips** per generate, 63 of them vector searches. Plus, for Tool, one LLM
extraction call per retrieved partner page (`GccV2PartnerExtractionService.cs:146-149`) — its own
comment records 37 pages on a real project.

### The correctness half, which matters more than the cost

`seenUrls` is shared across crawl types within one resolve (`GccGroundingResolver.cs:226, 329`), and
the crawl-type **order differs by content type**: `crawlTypes` is `mustCite.Concat(retrieveFor)`
(`:180`), and only `tool` has a `mustCite` (`[Partner]`, `:101`). So pillar/blog walk
`[ProjectSite, Partner, Competitors]` while tool walks `[Partner, ProjectSite, Competitors]`.

**A URL in two corpora lands in a different list depending on which content type is being written** —
partner evidence for Tool, project-site evidence for Pillar. Same create, same corpus, same moment.

Nothing about retrieval is deterministic either: no seed on `QueryAsync`
(`HttpGeekCrawlerRagClient.cs:503-535`), no ordering contract, `runIds` ordered by whatever
`HostsIndexedAsync` returned (`:271`), and extraction at temperature 0.1 with no seed field on
`GccV2SchemaConstrainedRequest` (`GccV2SchemaConstrainedGenerator.cs:49-59`). A project near
`HasSufficientPartnerData`'s 3-of-22 floor (`GccGenerateService.cs:2039-2041`) can refuse on one run
and pass on the next.

## Finding 2 — 63 round trips per generate build a list nothing reads

`GccGroundingOutcome.Passages` (`GccGroundingResolver.cs:24`) is built at `:224`, filled at `:333`,
returned at `:351`. `MergeRetrievedEvidence` reads `.Pages`, `.CompetitorPages`, `.SitePages` and
**not** `.Passages` (`GccGenerationCoordinator.cs:39-65`). The only reads in the solution are two
test assertions (`GccGroundingResolverTests.cs:264, :285`).

It is not cheap: `ReadTypedPassagesAsync` is the `ListPagesBySeedsAsync` row above — up to 21 round
trips per resolve, 63 per three-type generate — plus `GccCorpusBlockMapper.MapBlocks` (`:396`).

Its docstring describes exactly what the tool page's block quotation needs: *"what lets a retrieved
quote arrive as a `QuoteParagraph` carrying its source"* (`:56-61`). A capability that was built, is
paid for on every generate, and is discarded — while the quote path separately reconstructs
candidate spans out of flattened chunk text.

## Finding 3 — the staleness gate on Generate cannot fire

`GccController.TryBuildStaleGroundingResponseAsync` (`:663`) calls `_seo.GetSiteAnalysisStatusAsync`
→ `GET api/seo/site-analyzer/{profileId}/status` (`HttpGeekSeoSiteAnalyzerClient.cs:121`). Three
things are wrong at once:

1. **Site Analyzer no longer exists** (Jeff, 2026-10-01); the repo already records its routes as
   deleted (`GccController.cs:1301-1302`, `:604-608`).
2. **Wrong kind of id.** `create.ProjectSiteRunId` is a Geek-Crawler-v2 run id (`Entities.cs:32-37`)
   bound to a local literally named `profileId` (`:669`). The sibling method at `:604-608` records
   this exact defect being found and fixed next door; the stale gate was not fixed with it.
3. **Fails open in every mode** — unset URL, no bearer, unreachable, 404, not-complete, null dates
   all `return null`, which `Generate` reads as "proceed" (`:497`).

`GEEK_SEO_API_URL` has since been removed from Railway, so the client is disabled and the call fails
silently. The same logic makes `analysisStale` permanently false on `GET creates/{id}` (`:122-131`).

**There is no other staleness check on grounding evidence.** `GccGroundingResolver` asks only "is
there an indexed crawl" (`:265-279`), never how old. Exhaustive grep found only unrelated
subsystems: `GccV2ContextManifestService._staleAfterDays` (V2 context fields),
`GccPartnerFreshnessAsset` (a payload category), and `Provenance.TemporalAnchorUtc`
(`GccPartnerExtractionModels.cs:66`), stamped from `page.CrawledAtUtc` and never compared to
anything.

## Finding 4 — Content Creation runs on Postgres, which is a standing rule violation

Jeff, 2026-10-01: *"POSTGRES IS NEVER USED IN CONTENT CREATION"*, confirmed as **a standing rule the
code violates** — fix-on-sight, not a constraint to design around.

`ContentCreatorDbContext` is registered against **Npgsql**, schema `content_creator`, with
`MigrateAsync()` on every GeekRepository boot and a refusal to start on failure
(`GeekRepository/Program.cs:83-88`, `:231-245`). It holds twelve entity sets
(`ContentCreatorDbContext.cs:13-24`): creates, artifacts, artifact versions, approval events, site
analyses, site findings, clients, projects, project log, tasks, time entries, deliverables. A second
`ContentCreatorV2DbContext` is registered beside it (`Program.cs:90`).

Same shape as the `geek_crawler` Postgres layer removed on 2026-09-29 — Npgsql, migrating on boot —
but the whole domain rather than a vestige.

**This plan does not attempt it.** Moving twelve entity sets is a programme of work, not a fix, and
designing it unasked is how today went wrong twice. Recorded so the next reader finds it stated
rather than discovers it again. One narrowing note: `GccSiteAnalysis` and `GccSiteFinding` are Site
Analyzer tables and that service is gone, so two of the twelve are already dead.

---

## Plan

### Stage 1 — resolve the evidence once per generate

**Files:** `GccGenerationCoordinator.cs`, `GccGroundingResolver.cs`

Split `ResolveAsync` into the two things it does at once:

- **retrieve** — crawl types, run ids, queries, page lists. Identical for every content type, so it
  runs once per generate over the union of crawl types.
- **gate** — the `MustCiteCrawlTypes` check (`:101`), which differs per type and stays per type.

Hoist the retrieve above the `Task.WhenAll` in `RunGenerateAsync` (`:180`); pass the one outcome into
each `GenerateOneAsync`, which applies its own gate to it.

**This fixes the cross-list bug by construction** — one resolve means one `seenUrls` pass and one
crawl-type order, so a URL cannot be partner evidence for Tool and project-site evidence for Pillar.

Fix the order while in there: `crawlTypes` should be stable and independent of `mustCite`, which is
about refusal and has no business deciding which list a shared URL falls into.

**Expected:** `QueryAsync` 63 → 21. `ListPagesBySeedsAsync` 63 → 21, and Stage 2 narrowed it
further to the partner runs alone.
`HostsIndexedAsync` 6 → 2.

### Stage 2 — consume `Passages` — **done, 2026-10-01**

Decided (AI review, 2026-10-01, and it is right): wire `.Passages` into the quote path rather than
stop building it. It produces `QuoteParagraph`s carrying their cite — what the tool page's block
quotation needs, and what `GccQuoteCandidates` reconstructed from `RenderChunk` output with
`Section:` / `Context:` / `Specific detail:` labels interleaved. The typed path keeps structure the
flattening throws away. `GccCorpusBlockMapper` already does the mapping.

Two dangers the review raised do **not** apply to the current quote path, and the plan should not
claim them as motivation: the selector returns a **candidate number**, not text, so it cannot
truncate or extend a span; and each candidate carries its own `PageUrl`, so identical boilerplate on
two partner URLs cannot bleed into the wrong cite. The argument for consuming is structure
preservation, not citation safety — that part is already sound.

**What shipped, and four things the wiring forced that the plan had not seen:**

1. **The passages travel beside the create, not inside it.** `ResolveAndMergeGroundingAsync` returns
   both. The create carries research as JSON, which is where the prompt's quoteable block reads from;
   serializing a list of `Paragraph` records into it would flatten the block structure the typed path
   exists to preserve.

2. **They are partner-only, by construction.** `GccGroundingOutcome.Passages` became
   `PartnerPassages`, and the competitor and project-site runs skip the read entirely. A tool page's
   block quotation must cite a partner — a competitor is read and never quoted, the publisher's own
   pages are what the piece must not repeat — so one list spanning three corpora would hand the quote
   cutter spans it must refuse, with nothing but a caller's memory to filter them. Same reason
   `CompetitorPages` is its own list rather than a tag on `Pages`. It is also the cheaper half: the
   `ListPagesBySeedsAsync` column drops to the partner runs alone.

3. **For a must-cite-partner type the typed read is evidence, so it refuses.**
   `ReadTypedPassagesAsync` was best-effort with the remark *"its absence must not turn a grounded
   draft into a refusal"* — right for pillar and blog, which never quote, and wrong for tool once the
   blocks became the quote source. Without a refusal at the resolver, a repository outage reached the
   writer and came back as *"the tool page does not carry a verifiable block quotation"*: the model
   blamed for the crawl store being unreadable, and an operator sent to the prompt to fix it. The
   resolver now refuses under the reason that is true, naming re-crawl.

4. **The brief-time probe had to move with it, and the read is now one implementation.**
   `GccAngleQuoteProbe` declares *"the probe that validates is the probe that writes"*, and it was
   still cutting candidates from `retrieved.Pages`. Leaving it there would have made validation and
   generation read different sources — the same class of bug as `5b14705`. The read-back-and-map is
   extracted to `GccTypedPassageReader`, used by both, and the probe keeps its
   Unavailable-vs-NoAnswer distinction: pages retrieved but unreadable is the store failing, not a
   verdict on the partner.

**And the `GccQuoteablePage` overload of `GccQuoteCandidates` is gone**, with the `RenderChunk` label
stripper that existed only to serve it. Nothing called it once the probe moved, and two ways to find a
quote is two answers to one question — exactly what this stage was for.

**Verification.** 1,373 tests pass. Five mutations, each failing a test: reading every corpus back
(not just partner); removing the must-quote refusal; the tool path ignoring the passages handed down;
the writer shown an empty list while the guard holds a full one; the probe collapsing unreadable pages
into a verdict on the partner. The writer/guard mutation passed at first — the prompt-builder test
pinned the block's rendering, not the wiring that fills it, which is the half that was wrong in the
live failure — so `The_writer_is_shown_the_same_spans_the_quote_guard_will_check` was added at the
service level.

**The divergence this flagged is closed, same day.** `GccV2ToolResearchExtractor` held a second quote
selection in four steps: the first paragraph over forty characters; failing that, the longest one with
the page *title* among the candidates; truncated at five hundred characters with an ellipsis appended,
which edits a quotation and then presents it as verbatim; and failing all of that, the model's own
retyped sentence checked by substring. Its input was `GccQuoteablePage.Paragraphs` — `RenderChunk`
output — and this path has no label stripper, so the chosen span could be a prompt label in a quote box
attributed to a partner. The last step is a fallback method besides.

All of it is removed. `ExtractAsync` stays, because it is reachable from the pillar spawn path, but
returns the structured fields and no `SourceQuote`, and no longer refuses for want of a quotation —
it used to pick one *before* the model was called and throw if that came back empty, so a partner page
whose paragraphs were all short decided whether extraction ran at all. `GccV2PartnerToolWriteService`
refuses and names the source it would need rather than resolving one its own way; wiring typed passages
into it would be building out `GccV2WriteService.WriteAsync`, which has no live caller.

**I had this wrong twice while doing it**, both times from an incomplete grep: first that
`ExtractAsync` had no callers (a filtered grep hid two), then that its chain was wholly dead. The
callers are on dormant paths but the method is live-reachable. Recorded because the plan's own standard
is that a negative claim is worth the grep behind it.

**Also removed:** `GccController.SiteAnalysisStaleAfterDays`, a thirty-day constant documented as
*"requires an explicit operator choice before Generate proceeds"*. Nothing read it, and Finding 3 is
that there is no staleness gate at all — a declared policy no code enforces is read as enforced.

### Stage 3 — remove the dead Site Analyzer calls from the Create path

**Files:** `GccController.cs`

Drop the two `_seo.GetSiteAnalysisStatusAsync` calls (`:122`, `:676`) and the `_seo` field (`:48`,
`:66`). They call a service that no longer exists, with the wrong kind of id, and fail open.

Keep `HttpGeekSeoSiteAnalyzerClient`: its nested DTOs (`PageSectionTreeDto`, `PageSectionDto`) are
consumed by `GccGenerateService.ExtractToolsFromTrees` (`:465, :472`) and several tests.
`ToolPageGenerator.cs:229` also calls it and throws loudly — the old Workflow path, not Create, and
a separate decision.

Generate then has no staleness gate. That is the honest state: it has never had one that could fire.
Whether evidence age should gate generation is a real and separate question; the data to answer it
exists (`ContentReadyAt`, `RagIndexedAtUtc` on the run row).

---

## Verification — status, 2026-10-01

| # | What | Status |
|---|---|---|
| 1 | The refusal tests pass **unchanged** through Stage 1 | **Done.** `GccGroundingPolicyTests.cs` untouched by every commit in this plan. `GccGroundingResolverTests.cs` and `GccGroundingRetrievalTests.cs` changed only in their fakes and in two tests Stage 2 deliberately inverted (below) |
| 2 | `GccRetrievedEvidenceReachesThePromptTests.cs` stays green | **Done.** Untouched and passing |
| 3 | Coordinator tests, written first | **Done.** `GccGenerationCoordinatorTests.cs`, 12 cases over `NormalizeRequestedTypes`, `ValidateRequestedTypes` and `MergeRetrievedEvidence` |
| 4 | The cross-list regression | **Done.** `One_url_in_two_corpora_appears_in_both_lists_rather_than_whichever_was_walked_first` — and it is both lists, not one, which is the correction Jeff made to this plan |
| 5 | Count the calls | **Done.** `ThreeContentTypesQueryTheCorpusOnce_NotThreeTimes` |
| 6 | Mutation-check the hoist | **Partly.** See the gap below |
| 7 | End to end on a real create | **Not done.** Needs a deployed Generate on a real create; nothing local can stand in for it |
| 8 | The refusal names the run and the crawl type | **Done.** `A_library_failure_names_the_crawl_type_and_the_run_that_failed` and `An_empty_library_answer_names_...`, both failing under a mutation that drops the two facts from the message |

**Two tests Stage 2 inverted on purpose.** `MissingBlocksDoNotTurnAGroundedDraftIntoARefusal` asserted
that a `tool` with unreadable blocks still proceeds. Once the blocks became the quote source that is
exactly what must not happen, so it is now two tests: the original property kept for `pillar`, which
never quotes, and its opposite pinned for `tool`. `RetrievedPagesAreReturnedWhenEvidenceExists` had to
start supplying blocks. Neither is a refusal test moving to accommodate the split — item 1's warning —
they are the quote source changing.

### The one gap in item 6, stated rather than implied

**The hoist itself is not pinned.** The call-count test lives on `GccGroundingResolver` and asserts
that one `ResolveAsync` over three content types issues 21 queries rather than 63. It does not assert
that `GccGenerationCoordinator` makes **one** such call instead of three — reverting the hoist back
into `GenerateOneAsync` leaves every test green.

Pinning it means constructing the coordinator, which needs a `GccGenerateService`: a concrete class
with thirteen constructor dependencies and no interface. So the test needs an interface extracted
first, which is live-code surgery for a test and was not in this plan's scope. The mutations that
*are* pinned cover the consequences the hoist was for — one crawl-type order, per-corpus dedupe, the
passages reaching the tool path — but not the hoist.

## Rejected, with reasons

An AI review of this plan (2026-10-01) proposed two changes that this codebase's rules forbid.
Recorded so they are not proposed again.

**A Polly retry + `FallbackAsync(fallbackValue: Empty)` around each run query.** Forbidden by
`.cursor/rules/no-fallbacks.mdc` (`alwaysApply: true`): *"Never write fallback implementations that
return mocked, generic, empty, or stale data when retrieval fails. **RAG fail ≠ empty success** —
typed error; never empty-Pages-as-success."* The same rule bans automatic retries. A test already
pins it — `AFailedQueryIsRefusedAndNeverReadAsSuccess` (`GccGroundingResolverTests.cs:201`), whose
comment reads *"Failed with an empty page list looks exactly like 'no results' unless Failed is
checked first"* — which is precisely the state the proposed fallback manufactures. This pattern has
a scar behind it: a per-item catch-and-continue once made a total provider outage read as a data
shortage for two hours.

Its underlying worry — that hoisting lets one failure tank all three types — is **already the
contract**, verbatim at `GccGenerationCoordinator.cs:172-175`, Jeff 2026-09-23: *"do not incur
changes on failures. One failure fails all, for now."* Hoisting makes stated behaviour explicit
rather than changing it. What it does change is the message, which is why verification step 8 exists.

**A graceful fallback around `ToolPageGenerator.cs:229`.** Throwing loudly on a dead service is
correct here: *"Primary paths must crash loudly or bubble explicit, descriptive errors."*

**One correction to the review's risk list:** it warned that hoisting inflates memory by holding a
larger object graph across the fan-out. That assumes the branches run sequentially. They do not —
`Task.WhenAll(requested.Select(...))` (`:180`) means three outcome graphs are already live at once.
Hoisting takes peak from three to one; memory improves.

## Out of scope, recorded

- **The Postgres migration** (Finding 4) — stated, not designed.
- **`GccPartnerResearchCaps.CacheFreshnessHours = 24`** (`GccResearchModels.cs:177`) — declared,
  documented as *"Reuse a successful partner crawl for the same URL within this window"*, referenced
  by nothing. A surviving name that reads as a live caching policy.
- **The v1 `GccPartnerUrlResearchService` instance class** (`GccPartnerUrlResearchService.cs:13`) —
  not DI-registered anywhere; only its statics are used.
- **Extraction determinism** — no seed field on `GccV2SchemaConstrainedRequest` or
  `ChatCompletionRequest`, so reproducible extraction needs a provider-level change.

---

## Appendix — for a reviewer without the codebase

### Terms

| Term | Meaning here |
|---|---|
| **Create** | One unit of work: a topic/keyword, a brief, and the drafts generated from it. Belongs to a Project. |
| **Content type** | What gets written from a create — `pillar`, `blog`, `tool`. Several can be requested in one Generate. |
| **Project** | The engagement: a site URL and its crawl run id, plus declared partner and competitor URLs. |
| **Crawl type** | `project-site` (the client's own site), `partner`, `competitors`. Each declared URL is crawled under one. |
| **Run / Run ID** | One crawl of one URL. Evidence is retrieved per run. |
| **Grounding / evidence** | Passages retrieved from the indexed corpus for this create, rendered into the writing prompt. |
| **`MustCite` vs `Retrieve`** | Two tables. `Retrieve` = what a type fetches; `MustCite` = what it is *refused* for lacking. Only `tool` must cite (partner). |

### The shape of the defect, in code

Generation fans out per content type, and each branch resolves evidence independently:

```csharp
// GccGenerationCoordinator.cs:180
var attempts = await Task.WhenAll(requested.Select(async type =>
    await GenerateOneAsync(repo, gen, create, section, provider, type, mustMentionBlock, ct)));

// GccGenerationCoordinator.cs:247, inside GenerateOneAsync
create = await ResolveAndMergeGroundingAsync(create, contentType, ct);
```

And inside the resolve, one vector query per run:

```csharp
// GccGroundingResolver.cs:282
foreach (var runId in runIds)
{
    var result = await rag.QueryAsync(need, runId, crawlType: crawlType, topK: TopK, ...);
```

The order that differs by content type, which is what splits a shared URL across lists:

```csharp
// GccGroundingResolver.cs:180
var crawlTypes = mustCite.Concat(retrieveFor).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
// mustCite is [Partner] for tool, [] for pillar and blog
```

### Why there is no persistence stage

The corpus is already stored — crawl pages and runs in Mongo, vectors in Qdrant. Resolved evidence
is a *selection* from it. Storing that selection would duplicate an existing store, and the only
place available (`gcc_creates.research_json`) is Postgres, which Finding 4 establishes as a standing
violation in this domain. So the fix is to stop re-querying, not to start saving.

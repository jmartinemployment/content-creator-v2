# Competitor, Partner and Project-site data — definitions, and the work that follows

## Context

GCC V2 ingests three datasets — competitor, partner, and project-site — two of which were built as
one. Competitor extraction is literally the partner extractor run over competitor pages with partner
vocabulary, then relabelled. Competitor weaknesses are never joined to the partner strengths meant to
answer them. And the project-site crawl, whose primary objective is to *be* the RAG knowledge base,
has no knowledge of that objective anywhere in its pipeline.

This plan states what each dataset is *for*, then fixes what follows: the contaminated extractor, the
regex extraction method, the two missing joins, the partner field gaps, and the misplaced
project-site promotion.

---

## §0.00 Why this is a rewrite, not a patch

The defects below are not independent. They are one method applied repeatedly: **copy a working
shape, relabel it, drop the part that made it correct.**

| Instance | What was copied | What was dropped |
|---|---|---|
| Competitor extractor | partner extractor + `Relabel()` | competitor-native vocabulary — still searches `partnerToolNames` |
| Competitor JSON-LD | partner JSON-LD | the entity type — emits `SoftwareApplication` for a services business |
| V2 `BuildPartialInformationGain` | `GccSavedSerpParser` v1 | the `organics` parameter — `competitorOpens` is permanently `[]` |
| Deficit ↔ win theme | both halves extracted | the join |
| Own coverage ↔ competitor opens | both halves defined | the join |

A patch restores one dropped parameter or one field and leaves the method intact, so the next copy
reproduces it. Two further reasons patching cannot reach this:

- **The extraction method itself is the defect.** 36 `[GeneratedRegex]` methods and 123 regex
  references are not a wart on semantic extraction — they are a substitute for it (W2).
- **The governance that would catch a bad patch is gone.** `AGENTS.md` and `plans/master-plan.md` are
  empty or deleted, while the instruction file still loading into every session asserts a RAG Generate
  half that was deliberately removed (W0).

**What must survive the rewrite.** Several mechanisms here are correct and load-bearing; discarding
them repeats the same mistake in the opposite direction:
`GccV2CompetitorTypePlanRouting` (direct/content split), `GccV2PartnerMentionGate` +
`GccV2PartnerCitableBridge`, the knowledge-asset lifecycle and `IsIndexed` approval gate, and the
quote↔block-text verify layer. These are the regression bar in Verification.

## §0.0 Hard constraint — RAG does not generate

**RAG is retrieval and verification only. It is never used to generate content, in any workstream
below.** The Library half ingests crawls, serves chunks/pages, and verifies quotes against the shared
block→text projection. That is its entire role.

**Markdown is forbidden** as corpus, verification target, or interchange format — the body is typed
`blocks`, the string is `block_text.derive_plaintext_from_blocks`, readiness is `ContentReadyAt`.
Every "Markdown" below that names a live identifier (`MarkdownVerified`, `MarkdownReadyAt`) is a
legacy name to be renamed, not a format to honour. See `AGENTS.md` § *Markdown is forbidden*.

The live code already agrees: `RagLibraryStatus.generateEnabled` is documented *"Always false — RAG
generate is removed"* (`src/app/creates/rag-client/types.ts:29–30`), and the client header reads
*"RAG does not generate drafts"* (`rag-library-client.ts:15`).

**This matters for W2.** Replacing regex extraction with schema-constrained extraction routes through
`IGccV2SchemaConstrainedGenerator` → `IContentGenerationProvider` — **GeekAPI-side generation against
the block text that RAG returned**. It does not call, restore, or depend on any RAG generate endpoint. RAG's
only involvement stays what it is today: serving the pages and verifying the quotes.

### The docs are why this keeps coming back — W0, do this first

Checked on disk, not assumed:

| File | State | Says |
|---|---|---|
| `/Users/jeffmartin/development/.claude/CLAUDE.md` | **live, 1865 b** | *"The Generate Half (Generation & Synthesis): Uses the `POST /v1/generate` endpoint to draft structured outputs"* |
| `content-creator-v2/.claude/claude.md` | **live, 1865 b** | identical text |
| `content-creator-v2/.cursor/rules/geek-crawler-rag.mdc` | **correct already** | *"`/v1/generate` / `rag-generate.*` are removed — never revive them for Create"* |
| `content-creator-v2/AGENTS.md` | **emptied** (0 b; 1477 b at HEAD) | — |
| `content-creator-v2/CLAUDE.md` | **emptied** (0 b) | — |
| `content-creator-v2/plans/master-plan.md` | **deleted** (28,201 b at HEAD) | — |
| `content-creator-v2/plans/rag-foundation-rewrite.md` | **this file** — was untracked and 0 b | — |

So the governing documents are gone from the working tree, and the only instruction text still
loading into every session is the one that is **wrong** — and the parent-directory copy applies to
*every* project under `development/`, not just this one. An agent starting cold reads "RAG has a
Generate Half, use `POST /v1/generate`", and rebuilds precisely what was removed. That is the loop.

**W0:** correct §1 of both `CLAUDE.md` files to state that RAG is Library-only — retrieval and
verification — and that generation is GeekAPI-side. Restore `AGENTS.md` and `plans/master-plan.md`
from HEAD (`git show HEAD:AGENTS.md`, `git show HEAD:plans/master-plan.md`) or replace them
deliberately; leaving them empty means no release authority exists. `.cursor/rules/geek-crawler-rag.mdc`
needs no change — mirror its wording.

**Note on sourcing:** an earlier draft of this plan cited `plans/rag-foundation-rewrite.md` §0.0/§6.0
as the authority for the "never produced usable content" finding. That file was empty on disk; this
document now occupies it. That claim is operator-stated and remains unsourced in code — treat it as a
premise, not a finding.

## §0. Model specs

Both are already implemented; recorded here as the standing spec, with the constraints they impose.

**Generation — reasoning models, per stage.** `o3` and `o1-pro`
(`Generation/GccV2GenerationContracts.cs:321–322`), governed by `ContentModelPolicy` version
`content-model-policy.v1`. The model is chosen per stage, not globally:

| Stage | Approved |
|---|---|
| `researchPlanning` | `o3` |
| `outline`, `finalSynthesis` | `o1-pro`, `o3` |
| `section`, `repair`, `validation`, `complete` | `o3`, `o1-pro` |
| `imagePrompt` | `o3` |

Operator presets are `best-quality`, `o3-only`, `custom`
(`content-creator-v2/src/app/creates/rag-contract.ts:3`; picker at `new-create-form.tsx:1843`).
Downgrades require an explicit reason and confirmation (`ModelPolicySelection.downgradeReason`).
Note `gpt-4o` is declared as `StandardMultimodal` but appears in **no** approved stage list — it is
reachable only if something bypasses the policy, which is worth confirming rather than assuming.

**Embedding — `text-embedding-3-small`, 1536 dimensions.** `geek_crawler_rag/config.py:21–22`,
`embed.py:17–18`, `.env.example:16`. Converts document chunks and user queries into vectors for
semantic search over the Qdrant collection `geek_crawler_chunks`.

Three operational facts that constrain changes here:

- **Moving to `text-embedding-3-large` is not a config flip.** It is 3072-dimensional, while
  `embedding_dimensions` and `qdrant_store.py:59` (`vector_size: int = 1536`) are both fixed at 1536.
  Switching means a new collection and a full corpus re-embed, with query and stored vectors
  mismatched until it completes.
- **Embedding is fail-closed by design**, consistent with the repo's silent-failure rule:
  `openai_embedding_max_retries: 0`, no in-process retries, failures routed to
  `embedding_quarantine_dir`.
- **Throughput is deliberately throttled to 400k TPM against a 1M ceiling.** Running at the limit
  returned HTTP 500 `server_error` instead of clean 429s (`config.py:23–26`). Do not raise this
  while adding per-page model calls in W2.

---

## §1. Competitor data — definition

**Purpose: content-strategy intelligence.** It tells us what to write, what already works, and where
the gaps are. Positioning is downstream of that, not the point of it.

| # | Job | Fields | Reaches the model at |
|---|---|---|---|
| 1 | ~~**Find content gaps**~~ — **SEPARATE CONCERN.** Content gap analysis is outside Content Creation's scope and belongs to a different system. `GapMap`/`CoverageMap` are retained only as the source of Information Gain's anti-duplication check during drafting (W4), not as topic discovery | `GapMap`, `CoverageMap` | `GccV2ContextAdapter.cs:203` |
| 2 | **Capture bottom-of-funnel intent** — buyers actively comparing; we control the narrative rather than letting a third party define the difference | `ComparisonAxes`, `DeficitRouter`, `PricingCatalog` | `:207`, `:200`, `:194` |
| 3 | **Build trust through honesty** — a fair breakdown, including where we're weaker | `ProofPack`, `FaqBank`, `FramingBank`; `ClaimRiskFlags` *enforces* it | `:205`, `:293`, gate at `Validate/GccV2ValidateService.cs:288` |
| 4 | **De-risk SEO** — reverse-engineer the keywords, ad themes and formats already earning traffic | `DemandSignals` (`PrimaryKeywordFocus`, `ContentFormat`, `SearchIntentCategory`, `AdOrCopyTheme`) | `:211` |

Job 2 is what the `comparison` and `alternatives` content types exist for
(`content-creator-v2/src/app/creates/content-types.ts:11,14`) and why they alone request the
`battlecard` capability (`src/app/creates/rag-contract.ts:234`).

**Direct vs content competitors — already built and correct.**
`Plan/GccV2CompetitorTypePlanRouting.cs` splits rivals into direct/both and content-only, and
enforces: *"Never treat content-only rivals as product substitutes, recommended tools, or Versus
product options."* `FilterProductEntities` strips content-only rivals from product-target lists. So a
Forbes-Advisor-style publisher informs Jobs 1 and 4 without ever being offered to a reader as
something to buy. **Protect this through the rebuild.**

## §2. Partner data — definition

**Purpose: the monetization spine, and the substance behind every recommendation.** Partners are
third-party SaaS promoted for affiliate revenue. Partner data is **mandatory on every create** —
"Partner tool URLs (required)… An indexed partner crawl run is always required"
(`new-create-form.tsx:1604–1606`). Competitor data is optional enrichment; this is not.

| # | Job | Mechanism |
|---|---|---|
| 1 | **Monetize** | `OfferCtas` (`CtaLabel`, `DestinationUrl`, `OfferType`); `tool` is a first-class content type, and `ToolPages/GccV2ToolPageSpawnService` idempotently spawns a tool job per `(createId, partnerSlug)` when the pillar reaches `ready` — one pillar fans out into N standalone tool pages |
| 2 | **Give the recommendation substance** | `Citables`, `PricingCatalog`, `FaqBank`, `Integrations`, `Icp`, `UseCasePlaybooks`, `DemoBeats`, `Comparisons`, `BattlecardSlices` — all fed to the model at `GccV2ContextAdapter.cs:218+` under "prefer these over inventing pricing, CTAs, FAQs, feature vectors, or swaps" |
| 3 | **Ship structured data that ranks** | `ToolPages/GccV2ToolPageSchemaBuilder` → `GccV2PartnerSoftwareApplicationJsonLd`, fail-closed via `EnsureShipReadyOrThrow`. Here `SoftwareApplication` is the *correct* type |
| 4 | **Stay honest and disclosed** | `GccV2PartnerMentionGate` — name a partner in prose and that section needs ≥1 verified partner citation (`GccV2ValidateService.cs:269`, `GccV2CitationEvidenceGuard`); `GccV2PartnerCitableBridge` auto-attaches a matching verified citable to repair the gap; `Disqualifiers` record where the tool doesn't fit; `AffiliateDisclosures` carry the disclosure |

### Coverage against the required partner field set

| Requirement | Status | Field |
|---|---|---|
| Granular feature list | **Gap** | nearest is `Comparisons.StandardizedFeatureId`/`CapabilityPayload` — a comparison vector, not an inventory |
| Integrations | Have | `Integrations(IntegrationName, IntegrationType, ApiOrSdk)` |
| Limitations / gated features | Have | `PricingCatalog.FeatureGates` |
| Technical constraints | **Partial** | `OverageTerms` + `Disqualifiers.LimitDetail` as prose; no structured ceilings |
| Tier breakdown | Have | `TierName, ListPrice, PriceCurrency, BillingPeriod` |
| Cost per unit | **Partial** | `OverageTerms` prose, `Comparisons.NormalizedCost`; nothing structured per-seat/per-credit |
| Free offerings | Have | `PricingCatalog.FreeOrTrial` |
| Affiliate/partner perks | **Gap — uncrawlable** | negotiated with the vendor, never published on their site |
| Primary differentiators (USPs) | Have | `BattlecardSlices.WinTheme` |
| ICP guardrails | Have, strong | `Icp(ServedSegments, ExcludedSegments, CompanySizeBand, Industries, BuyerRoles)` |
| Counter-arguments | Have | `BattlecardSlices.Landmine` + `CoachingLine` |
| Case studies / testimonials / awards | **Partial** | all three collapse into `ProofPack(ProofKind, ProofClaim)` free text |

## §2.5 Project-site data — definition

The project-site crawl has **two distinct roles**, and they are easy to conflate because they share
one crawl run.

### Role A — the RAG knowledge base itself (the primary objective)

This is the point of crawling our own site: it is the cleanest structured source we control, and it
is what the Library half retrieves from. Instead of relying on a model's static training data, the
system pulls from a corpus built out of our own verified pages.

The path is `Context/GccV2ProjectSiteKnowledgeService.PromoteAsync` — a **completed** crawl run is
promoted into a governed Knowledge asset (asset → version → resources), then indexed. It sits
alongside the other context connectors (`Drive`, `Gsc`, `Url`, `SharePoint`) behind
`GccV2ContextIngestionWorker`, and creates select it via
`contextSelection.knowledgeAssetVersionIds`.

| Objective | Status | Mechanism |
|---|---|---|
| **Clean text extraction** — strip boilerplate, keep main content | Implemented | resource kinds `original` and `normalized_text`; `Hierarchy/GccV2TextExtractor`; 2,000,000-character normalization cap |
| **Metadata tagging** — URL, run, dates, category, for citation and recency | Implemented | `SourceDescriptorJson` carries the source run id; provenance carries `RunId`, `PageId`, `SectionTitle`, `TemporalAnchorUtc`, `SourceDigest`, `SourceRights` |
| **Grounding / no hallucination** — generate only from the crawled set | Implemented | quote↔block-text verify (flag still named `MarkdownVerified` — misnomer, rename pending), `GccV2CitationEvidenceGuard`, `GccV2SourceRightsGate`, VALIDATE gates |
| **Brand voice from our own archive** | Implemented | `BrandKit/GccV2BrandKitBuilder.BuildVoiceSamples(pages, website, section)` derives voice samples from crawled own-site pages |
| **Continuous / scheduled refresh** | **Gap** | no scheduled re-crawl exists; `forceRecrawl` is manual per create. Context connectors have a `CanRefresh` concept (`GccV2DriveContextConnector:19`) that project-site does not implement |

Governance worth protecting: promotion is lifecycle-gated (`draft` → `review` → `approved`, with
`revoked`/`deprecated`), only a `complete` run may be promoted, and approval requires `IsIndexed` —
an unindexed source cannot be approved into use.

#### ⚠️ The crawl was never built to serve this objective

The app crawls the project site, but **the crawl pipeline has no knowledge of the knowledge base.**
The whole of `ProjectSite/` — 9 files, 749 lines: BFS crawler, crawl service, worker, run
coordinator, stall recovery — contains **zero** references to promotion, knowledge, or indexing. The
server-side story ends at `GccV2ProjectSiteCrawlService.cs:214` setting `Status: "complete"`.

What actually turns a crawl into RAG knowledge is a single fire-and-forget line in a React component:

```
new-create-form.tsx:726   void promoteRunToSourceLibrary(runId);   // inside applyReadyCrawl
```

It does the right thing when it runs — posts to `runs/{runId}/promote-to-source` with
`approve: true` (`:700`), and the comment claims *"Every completed project-site crawl becomes a
reusable source — no operator prompt."* That claim only holds for crawls completed **inside the
Create wizard, in a live browser session.** Consequences:

- A crawl that completes by any other path — API, retry, stall recovery — **never becomes knowledge.**
- The call is `void`-ed. If it fails, `applyReadyCrawl` still advances the wizard to `goal`; the only
  trace is a UI status string. The operator proceeds believing the site is in the corpus.
- Approval is further deferred: `PromoteAsync` approves only when `IsIndexed` is already true,
  otherwise `GccV2ContextIngestionWorker:280` (`WantsAutoApproval`) has to finish it later.

**This is the §0.00 pattern again** — the mechanism is present, so a presence check passes, but its
placement means it does not reliably serve the objective. The objective belongs in the crawl
pipeline: completing a project-site crawl should *be* what promotes and indexes it, server-side,
with a real failure state — not a side effect of a browser tab staying open.

**W6:** move promotion into the crawl completion path in `ProjectSite/`, make failure explicit rather
than a discarded promise, and leave the frontend call as a no-op or remove it.

### Role B — per-create IA and SEO context

Separate, transient, and **mandatory**: `Write/GccV2WriteService.cs:199–200` refuses WRITE without
non-empty `relatedPages`.

| # | Job | Fields | Wired at |
|---|---|---|---|
| 1 | **Placement / IA** | `gapSectionPath`, `Hierarchy` | `Hierarchy/GccV2SiteHierarchyService`, `GccV2HeadingTreeBuilder`, `GccV2SiteHierarchyFromCrawl` |
| 2 | **Gaps on our own site** | `ContentGapDto(Topic, SectionPath, Reason, SourcePageUrl)` | `GccV2SiteSection.cs` |
| 3 | **Information gain / anti-duplication** | `InformationGainNote(thisSiteCovers, competitorOpens, summary)` | `GccV2SiteSection.cs:127,158` |
| 4 | **Internal linking** | `relatedPages`, `topicalNeighbors` → `InternalLinkOpportunities` | `Plan/GccV2PlanService.cs:331`, `GccV2GenerationContracts.cs:561,728`, context at `GccV2ContextAdapter.cs:470,496` |

Crawl orchestration for both roles lives in `ProjectSite/` (BFS crawler, run coordinator, worker,
stall recovery). Note the BFS crawler itself has **no** RAG/index references — indexing happens only
via the Role A promotion path, which is why the two roles are easy to mistake for one.

---

## §3. The defect the three definitions expose

**The same failure appears four times: each half exists, the join does not — and where a join is not
needed, the objective sits at the wrong layer.**

1. Competitor extraction *is* partner extraction relabelled (§3.1).
2. Competitor deficits are never joined to partner win themes (§3.2).
3. Project-site crawl never promotes itself into the corpus — the objective lives in a React callback,
   not the crawl pipeline (§2.5, W6).
4. Our site's coverage is never joined to competitor opens — `GccV2SiteSection.cs:221` returns
   `new InformationGainNote(covers, [], summary)`. **`competitorOpens` is hardcoded empty.** The v1
   parser it was copied from (`ContentCreator/GccSavedSerpParser.cs:70–108`) accepts an `organics`
   argument and computes real opens by excluding our own hosts; the V2 copy dropped the parameter.
   The summary text still says *"Upload a saved SERP to compare competitor opens"*, but V2 has no
   path to accept one. Information Gain therefore answers "what do we already cover?" and never
   "what are rivals covering that we are not?" — the half that makes it *gain*.

### §3.1 Competitor extraction is partner extraction wearing a label

```
Partner/GccV2CompetitorExtractionService.cs:31
  var mirrored = GccV2PartnerExtractionService.ExtractFromPages(pages, partnerToolNames);
  → Relabel(...)        // :48, :67–:90, defined :276
```

Live production path (`GeekCrawler/GccV2GeekCrawlerResearchResolver.cs:527`). Consequences are
job-specific, and Jobs 1 and 4 are not degraded but **blind** — a SaaS feature-matrix extractor never
looks for topical coverage, keywords, formats or ad themes, so `GapMap` and `DemandSignals` are
filled from whatever the partner heuristics happened to catch.

### §3.2 The counterweight is never actually joined

Competitor `DeficitRouter(TriggerDeficit,
RecommendedSwap, PivotCopy)` is the weakness dataset; partner `BattlecardSlices(WinTheme, Landmine,
CoachingLine)` is the strength dataset. `GccV2PartnerAlternativesJoin.cs:53` merges competitor
deficits into partner `Alternatives` as flat text — nothing matches a deficit to a win theme.
`StandardizedFeatureId` exists on both `Comparisons` and `ComparisonAxes` but is not used as a join
key. So the match is left to the model to improvise from two unrelated lists in the prompt, which is
precisely where invention enters.

---

## §4. Work

### W1 — Competitor extractor, de-contaminated (blocking)

New `ContentCreatorV2.Competitor` namespace and extractor. Delete the mirrored partner call and the
whole `Relabel` path. Move `GccV2CompetitorExtractionVerify` alongside it. Give competitors their own
`GccCompetitorExtractionProvenance` instead of sharing `GccPartnerExtractionProvenance` — that shared
type is the last thing letting a competitor hydrate into a partner shape. Bump
`CurrentExtractorVersion` to `gcc-competitor-extraction.v4`.

Add the per-job extraction that does not exist today:
- Job 1: topical coverage map with depth assessment — what they cover, how deeply, what they omit.
- Job 4: on-page keyword focus, content format, apparent search intent, recurring ad/copy themes.

Reshape rather than delete: `ComparisonAxes.StandardizedFeatureId` becomes an axis that works for
services as well as products; keep `PricingCatalog` (agencies publish rates and packages — genuine
BOFU material) but drop the seat/billing/overage semantics inherited from SaaS.

Delete `GccV2CompetitorSoftwareApplicationJsonLd` — `@type: SoftwareApplication` for a services
business, computed, never emitted, no production callers.

### W2 — Replace regex extraction with schema-constrained extraction

`GccV2PartnerExtractionService.cs` carries **36 `[GeneratedRegex]` methods and 123 regex references
across 983 lines**; the competitor extractor adds 9 more. Beyond being unreadable, it is the wrong
instrument: regex can find a price string, but `WinThemeHintRegex` "finds" USPs by taking the first
sentence of 20–220 characters matching a hint pattern (`:590`), deduped and capped at 10 (`:863`).

Replace it with the seam already in the tree and unused: `IGccV2SchemaConstrainedGenerator`
(`Generation/GccV2SchemaConstrainedGenerator.cs`) — real implementation, strict JSON schema via
`GccV2AdHocJsonSchema.For<T>`, zero callers. Its own doc comment asks call sites to stop hand-building
free-text prompts; the regex extractor's doc comment already claims it was superseded by
schema-constrained extraction that was never built. **No new regex in either extractor.**

Per §0.0 this is GeekAPI-side generation over RAG-served block text — it does not restore or call any
RAG generate path.

Non-negotiable: keep `GccV2PartnerExtractionVerify` / `GccV2CompetitorExtractionVerify` strict. The
quote↔block-text verify is what makes this safe — without it we trade unreadable-but-deterministic for
readable-but-hallucinating. Per the repo's silent-failure rule, a page yielding no verifiable signal
returns an empty document; never a fabricated or partner-shaped fallback.

Trade-off to accept explicitly: a model call per page where regex was free.

### W3 — Build the counterweight join

Introduce a shared axis identifier used by **both** sides, so a deficit binds to a win theme instead
of being improvised:

> A deficit→strength pair is admissible only when the competitor's gap and the partner's matching
> strength are each traceable to their own verified chunk id, on the same axis id. Two chunk ids and
> a shared axis, or the pair is dropped.

Carry `CompetitorDeficitChunkId`, `PartnerStrengthChunkId` and `AxisId` on the pairing record. Update
`GccV2PartnerAlternativesJoin.cs:53`, `GccV2GeekCrawlerResearchResolver.cs:219–221` and
`GccV2ContextAdapter.cs:179,:200`.

### W4 — Restore the Information Gain join

Give V2 a real `competitorOpens`. Two options, in preference order:

1. **Derive from competitor data we already hold** — `GapMap` (§1 Job 1) is exactly "topics they cover
   that we don't." Once W1 makes `GapMap` competitor-native, it is a better source than a SERP upload
   and needs no new input surface.
2. **Restore the saved-SERP path** — re-add the `organics` parameter the V2 copy dropped, matching
   `GccSavedSerpParser.cs:85–100` (exclude our own hosts, take the rest as opens).

Either way, delete the summary string that instructs the operator to upload a SERP the V2 path cannot
accept. Per the silent-failure rule, an empty `competitorOpens` must read as "not computed", never as
"no gaps found" — those are different states and the current code cannot distinguish them.

### W5 — Close the partner field gaps

- **Granular feature list**: a canonical feature inventory, distinct from the comparison vector.
- **Technical constraints** and **cost per unit**: structured values rather than prose in
  `OverageTerms`.
- **Affiliate perks**: an **operator-supplied** input path — discount codes, extended trials and
  bonuses are negotiated with the vendor and appear nowhere on their site, so no extractor can reach
  them. This is a new input surface, not an extraction change.
- **Split `ProofPack`** into case-study (structured metric + named company), testimonial (industry,
  buyer role) and award (normalized source: G2, Capterra, Product Hunt), so proof can be injected at
  the right moment rather than dumped generically.
- **`AffiliateDisclosureAsset.JurisdictionOrPolicy`** has zero consumers — disclosure text exists but
  nothing binds it to a jurisdiction or policy. On the revenue path, in an otherwise well-gated
  pipeline, this is the compliance-shaped hole. Wire it through PLAN/WRITE or decide deliberately not
  to.

### W6 — Move project-site promotion into the crawl pipeline

Today the only thing turning a completed crawl into RAG knowledge is a fire-and-forget call in a
React callback (`new-create-form.tsx:726`); all of `ProjectSite/` (9 files, 749 lines) has zero
references to promotion, knowledge or indexing, ending at `Status: "complete"`
(`GccV2ProjectSiteCrawlService.cs:214`). See §2.5.

Completing a project-site crawl should *be* what promotes and indexes it, server-side, with an
explicit failure state rather than a discarded promise. Crawls completing via API, retry or stall
recovery must reach the corpus too. Then make the frontend call a no-op or remove it.

---

## Verification

One test per job, because the restructure must not quietly break what already works.

**Competitor:** gap topics with depth reach context; comparison axes and deficit copy still reach
`comparison`/`alternatives`; `ClaimRiskFlags` still fails VALIDATE closed; keyword/format/intent
signals reach context; a content-only rival never appears as a product substitute while a direct
rival still may (`FilterProductEntities`).

**Partner:** tool-page spawn stays idempotent on `(createId, partnerSlug)`; partner JSON-LD still
passes `EnsureShipReadyOrThrow`; `GccV2PartnerMentionGate` still requires a verified citation for any
named partner, with `GccV2PartnerCitableBridge` repairing rather than failing.

**Join:** a pair drops when either chunk id is absent or the axis ids differ.

**Extraction swap:** competitor pages containing SaaS-style pricing copy produce no seat-cap or
billing-period fields; every extracted asset still carries a verified quote with offsets.

**W0:** grep the repo for `/v1/generate` and confirm the only surviving references are the ones
saying it is removed.

## Out of scope

- Re-crawling or reconciling the corpus (§0.00 data-purge question).
- Partner-side *purpose* changes — Jobs 1–4 above are correct; only the extraction method and the
  field gaps change.
- Deploying the Grounded Systemic Rewrite Engine prompt. It depends on W1–W3 landing first and is
  tracked separately.

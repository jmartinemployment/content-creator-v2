# Fix Content Creator — GeekAPI

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for GeekAPI: its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D3 | The comment at `GccNicheFraming.cs:25` recording that affiliate economics are deliberately absent: keep or delete. | Keep. It reads as "deliberately absent", the opposite of evidence that the feature exists. Give the zero-hits criterion one named exception. | A7 |
| D4 | Quote verification: a **Library route** GeekAPI calls, or the existing C# substring comparison. | Library route. Two implementations of "is this quote on the page" will disagree on whitespace and punctuation; the quote guard already paid for that. | R4, A1 |
| D5 | A framing claim about a tool with no verified quote behind it: **refuse the page**, or write it unsupported. | Refuse. The framing's own rule says the operator may say what the problem is but may not attribute a capability to a product. | A3, A4 |
| D6 | Which of the 22 extraction categories are dropped outright. | Drop `affiliateDisclosures` and `freshnessLog` now. Hold `icp`, `useCasePlaybooks`, `disqualifiers`, `demoBeats` until A3's fill-rate measurement says what real sites carry. | A3, A7 |
| D7 | The dormant v2 cluster (~60 registered classes, zero callers): **delete** after lifting the four pieces the live path lacks, or keep dormant. | Delete. The four pieces (verify pass, citation audit, per-category rendering, grounded check) are lifted first in A1 and A6; the rest is what every reader greps and mistakes for live code. | A15 |
| D8 | Ownership checks on every create and version route. | Yes. First list every `gcc_creates` row whose `OwnerUserId` is not the operator's `sub`, so the check does not lock out existing work. | A9 |
| D9 | Revise: rebuild as a guarded regenerate with the create's evidence, or disable until then. | Rebuild. Interim: disable Revise on tool pages (it ships an unguarded quote today) and keep pillar/blog Revise behind the pillar/blog guards. | A8 |
| D10 | Persist the evidence behind every version (prompts, passages, candidate list, extraction digest, readiness). | Yes, in Postgres through GeekRepository, one row per version. Every diagnosis this week was archaeology on a 60-character excerpt. | A10, D2 |
| D11 | Persist generate jobs, and add a route to read one. | Yes. Jobs are in memory, lost on redeploy, and a reload cannot re-attach. | A11, F1 |
| D12 | The tool body: does QUOTEABLE RESEARCH reach it? Today only the lede gets it. | Yes. The body is written from extraction JSON and competitor text; the retrieved partner passages reach the lede only. | A2 |
| D13 | Block quotations on Pillar and Blog: enforce the ban in code (parser refuses a quote paragraph on those types), or allow verified ones. | Enforce the ban as the prompt states it. Verified quotes on long-form is a separate feature, if ever. | A6 |
| D14 | Image-prompt failure after a guarded draft: refuse the whole piece, or save the draft and report. | Save and report, the way the scheduler link and partner mentions already do. | A6 |

## Status, 2026-10-04 evening — Waves 1–3 built uncommitted; reviewed from the report

The GeekBackend session built A1 interim, A2, A5, A6, A7, A16, D1, A1 full's shape, A4-adjacent
pieces, A8, A9, A10, A11, A12, A13, A14, D2 and D3 in one uncommitted working tree, on Jeff's
"continue". There is no diff to read, so this is a review of its own report. Verdicts: **keep**,
**change** (before commit), **run first** (a precondition), **follow-up** (another project's stage).

**Process.**
- Commit by stage, in wave order, as separate commits, and push the Wave 1 commits first. The
  Accounts Payable generate runs on that deployment and is read before Wave 2 and Wave 3 commits are
  pushed. The gate is honoured retroactively; the code is not thrown away.
- **Run first:** the create-owners route it added (`GET internal/create-owners`) against production,
  before A9 ships. If any `gcc_creates` row's owner is not the operator's `sub` (or the worker
  service id, which is the same id today), A9 waits.

**Contract changes.**
- Probe route requires `provider`; the frontend does not send it; the button returns 400. **Change:**
  `provider` optional on that route, absent meaning `LlmProviders__DefaultProvider`, which is the
  configured setting and what the probe used before, not a fallback. **Follow-up F7:** the brief
  panel sends the workspace's provider.
- `GccCreateDto.version`, optional `ExpectedVersion`, 409 on stale. **Keep.** **Follow-up F8:** the
  brief save sends the version it read; until it does, the brief save is still last-writer-wins.
- `GccQuoteablePage.RetrievalScore` in `research_json`; tool envelope `provenance`; readiness
  `pagesDigest`; job status `ready`; refusal text changes. **Keep.**
- Retrieval warnings pushed as warning events under the label `grounding`. **Keep**, with
  **follow-up F9:** the workspace renders `grounding:` warnings under the readiness block, not under
  "Written with a gap", which names pieces.

**A6, one combined retry and the guard function.**
- One retry naming every finding, replacing up to four per-guard retries. **Keep.**
- The rule for keeping the retry: "fewer refusals, or a strict subset". **Change:** strict subset
  only. "Fewer" lets a retry swap one failure for a new one and be kept.
- Link allowlist widened to partner page URLs from QUOTEABLE RESEARCH and any page on the
  publisher's hosts. **Keep.** Rule 2 tells the writer to link partner pages; the plan omitted them.
- Figure evidence widened to the brief, topic, notes, the serialized generation context and the
  outline. **Change:** brief, topic and notes yes; the generation context and the outline no. Both
  carry instruction numbers (word floors, density targets, "600-850 words"), and a check that
  licenses "3,000" because the prompt said it is a check that licenses nothing. The figure grammar
  has to be written down: what counts as a figure (percentages, currency, counts with a unit,
  multipliers, numbers of three or more digits) and what does not (ordinals, list numerals, headings,
  years in a cite, version numbers). Changing `ScriptedBody` headings from digits to letters so the
  check passes is the fixture dodging the check; the grammar fixes it instead.
- Tool quotation gets one retry before refusal; the product-name check is in the tool guard and
  retried. **Keep.** A retry naming the finding is not a repair.
- Pillar FAQ before the body; tool FAQ after the first draft and carried through the retry. **Keep.**

**A5.** Unreachable-index refusal: **keep.** "Zero passages for a declared partner refuses for all
types, including tool": **change.** For tool the outcome is per partner (page written, or a named
soft refusal), and a whole-type refusal would undo "four pages and one named refusal". Pillar and
blog refuse; tool refuses that partner.

**A7.** Dormant adapter edited, `ProviderSchemaName` v5, tests replaced. **Keep.**

**A1 interim.** One more "verified" sentence removed from the tool body prompt; `VerifiedAnswer`
field name kept until A1 full. **Keep.**

**D1.** `xmin` as the concurrency token with an empty migration, not `RowVersion`. **Keep**; that is
the correct Postgres shape. Changed-columns-only writes, keyword-source routes carrying the
version: **keep.**

**D2, D3.** Status check constraint, partial unique index for one running job per create, RESTRICT
foreign keys, evidence written once per version, extra job endpoints, create deletion cascading to
evidence and jobs, a list of model ids. **Keep.** Evidence rows at about 1 MB per piece: fine for
now; a retention rule is a later stage, not this one.

**A13, A14.** Unavailable provider reports every page failed, not an empty document: **keep**,
that is fail-closed. The ledger renamed and "tracking the current piece ambiently through the call
chain": **check before commit.** Multi-type generation fans out with `Task.WhenAll`; ambient state
is correct only if it is set inside each type's task, not before the fan-out. A test with two
types in parallel asserting each version records only its own models is the proof. A14 taken as
"advisory": **keep**; it was the plan's stated alternative.

**A10, A11, A12.** Startup fails every job still `running`, assuming one GeekAPI instance:
**keep**, and write the assumption where the code is, since Railway can scale it. New batch route
`POST creates/{id}/generated` beside the per-artifact routes: **keep.** Per-type outcome events now
fire only after the batch write: **change.** A twenty-minute run must not show nothing until the
end. Push a per-type progress event when a piece is drafted (no artifact yet), then the outcome
events after the batch write. **Follow-up F10:** the workspace shows "drafted, saving" for the
first and keeps "each appears as it finishes" honest.

**A8.** The interim and the full rebuild both built; the full one is `POST versions/{id}/revise-job`
beside the old route. **Keep as a transition, with an end:** **follow-up F11** switches the
workspace to the new route, and the old route is deleted in the same change. Section scope keeps
stored metadata and JSON-LD: **keep**; "regenerated" in the stage was for full scope. Section
matching by H2 heading text and splicing: **change.** Match by section path or index, which the
workspace already carries as `sectionPath`; two sections can share a heading. Revise refused for
types other than pillar, blog and tool: **keep.**

**A9.** Content Creator routes accept only GeekOAuth bearer tokens, so `X-Geek-User-Id` cannot
reach them: **keep**; better than disabling the header, which other services use.
`ValidateAudience` left false because GeekOAuth tokens carry no audience: **keep**, recorded as the
reason. Ownership failures return 404: **keep.** Tools jobs record their owner for `JoinToolsJob`:
**keep.**

**New follow-ups created by this review:** F7 (probe provider), F8 (brief version), F9 (grounding
warnings placement), F10 (drafted-then-saved events), F11 (switch Revise route, delete the old) in
`fix-frontend.md`; the figure grammar and the ambient-ledger test here under A6 and A13.

## Audit — GeekAPI

| Id | Finding | Where |
|---|---|---|
| F-A1 | **"Every answer below is already verified against the partner's own site" is false.** FAQ answers are model-extracted. The only verifier, `VerifyAgainstLibraryAsync`, has one caller, in a class nothing calls; and it returns the document unchanged when the Library is disabled. | `ContentPromptBuilder.cs:2802`, `:2813-2815`, `:2822`; `GccV2PartnerExtractionVerify.cs:19`, `:28`; caller `GccV2GeekCrawlerResearchResolver.cs:482` |
| F-A2 | **The tool body never receives QUOTEABLE RESEARCH.** The research block is set on the context, then overridden by the body writer's parameter, which the caller fills with competitor and own-site text. The comment above it says the opposite. Only the lede gets the retrieved passages. | `GccGenerateService.cs:1414-1417`, `:1475-1499`; comment `:1389-1405` |
| F-A3 | **The gate is "three of twenty-two buckets, one item each"**, over an unverified extraction. One fact, one award and one call-to-action pass it. Only `FaqBank` is read by name downstream; the other 21 reach the writer as one JSON dump. | `GccGenerateService.cs:1700-1726`, `:1334-1336` |
| F-A4 | **Pillar and Blog are never refused for zero partner evidence.** The resolver refuses only when *every* URL of a crawl type is unindexed; one dropped partner crawl is skipped silently, against its own comment. Retrieval warnings are collected and never read. `GccHeadingProvenanceGuard` says "an empty set cannot reach generation"; true for Tool only. | `GccGroundingResolver.cs:333-340`, `:376-382`, `:417-420`; `GccHeadingProvenanceGuard.cs:33-34` |
| F-A5 | **The pillar FAQ is generated after the provenance check and dropped by the mentions and CTA retries**, which rebuild the document from retry sections. Retries re-run provenance but not the tools-section guard. | `GccGenerateService.cs:2547-2554`, `:2588`, `:2627` |
| F-A6 | **Prompt-only promises, unenforced:** "Do not quote. No blockquotes" on Pillar/Blog (parser accepts a quote paragraph, no quote guard runs there); "exactly one block quotation" on Tool (code requires one or more); "never a specific price not in the research" (body unchecked); "a number may appear only if it is in the evidence" (five sites, none enforced); "never cite or link a competitor" (hrefs never validated; competitor URLs printed to the model); "name the product in every section" (one substring anywhere); "never attribute a claim to a URL you did not read it under". | `ContentPromptBuilder.cs:361-366`, `:869-893`, `:1638-1639`, `:2676-2681`; `ToolPrompts.cs:72`; `GccGenerateService.cs:354-355`, `:3113-3118`, `:3164`, `:1619` |
| F-A7 | **Affiliate wording:** 19 hits in 6 files; the extraction prompt defines a partner as promoted "for affiliate revenue"; `affiliateDisclosures` is one of the 22 gate buckets. | `GccV2PartnerExtractionService.cs:11`, `:52`; `GccGenerateService.cs:1586`; `GccV2PartnerUrlResearchService.cs:200` |
| F-A8 | **Revise regenerates from flattened prose with no evidence, no brief, no guards**, one call for the whole body, and `scope=section` regenerates everything. On a tool page it demands a numbered quote with no spans listed and never runs the quote guard, so an invented quote with any cite ships. | `GccGenerateService.cs:925-1043`, `:994-1008` |
| F-A9 | **Authorization:** no `[Authorize]` on the controller; only `ListCreates` checks ownership. `PATCH brief-research` accepts arbitrary `researchJson` with no shape check, and injected quoteables outrank retrieved evidence at the same URL. `ValidateAudience=false`. Under the API key, `X-Geek-User-Id` impersonates any GUID. The hub join checks job ownership, not create ownership; `JoinToolsJob` checks nothing. | `GccController.cs:28-30`, `:91-98`, `:140`, `:454`, `:680`, `:759`; `GccGenerationCoordinator.cs:71-88`; `Program.cs:204-210`; `ApiKeyMiddleware.cs:102-109`; `WorkflowRealtimeHub.cs:26-34`, `:52-79` |
| F-A10 | **Persistence is non-transactional across artifacts** ("one failure fails all" is not true past the first write). Two Generates on one create can run at once. An image-prompt failure discards a draft that passed every guard. The length shortfall is logged, not reported. | `GccGenerationCoordinator.cs:240-252`, `:505-520`; `GccGenerateService.cs:3277`, `:3488+` |
| F-A11 | **Nothing needed for a diagnosis is persisted:** no prompt, no raw response, no discarded first draft, no merged research, no typed passages, no candidate list, no RAG query or scores, no readiness, no job, no link from a version to the bank row it came from, no model id. | `GccVersionProvenance.cs:20-31`; `GccGenerationCoordinator.cs:68` |
| F-A12 | **The job store is in memory**, single instance, evicted after six hours, lost on redeploy, with no read route. A job killed by a redeploy is never marked failed. | `GccJobsAndSeo.cs:7-68`; `GccController.cs:495-498` |
| F-A13 | **~60 v2 classes are registered with zero callers** outside tests and registration. Four hold logic the live path lacks: `VerifyAgainstLibraryAsync`, `GccV2CitationEvidenceGuard.AuditWriteOutputAsync`, `GccV2ContextAdapter.AppendPartnerExtractionNotes` (per-category rendering with a verified flag), `IsGrounded`. Live v2 pieces are exactly: `GccV2PartnerExtractionService`, `GccV2PartnerSoftwareApplicationJsonLd`, `GccV2SiteSection`, `IGccV2SchemaConstrainedGenerator`, `GccV2SubUserIdProvider`, and the v2 hub. | `ContentCreatorV2/ServiceRegistration.cs:31-143`; `Program.cs:161`, `:369` |
| F-A14 | **Provider and model are not what the operator chose and not recorded.** Extraction and the probe use `GetDefault()`; `ToLlm` maps any unknown value to OpenAI; the version records "generatedByProvider" and no model id. | `GccV2PartnerExtractionService.cs:101`; `GccAngleQuoteProbe.cs:106`; `GccGenerateService.cs:1799-1800` |
| F-A15 | **"The probe that validates is the probe that writes" is false.** Probe: host-filtered, topK 8, an LLM selector. Generate: unfiltered, topK 32, the writer picks, and the guard does not check angle fit. | `GccAngleQuoteProbe.cs:22-26`, `:116-117`; `GccGroundingResolver.cs:187`, `:515-537` |
| F-A16 | The stale-grounding gate always returns null and `acknowledgeStaleGrounding` is ignored. `create.ProjectSiteRunId` and `project.ProjectSiteRunId` are two ids that can disagree; one gate checks each. The must-mention block is silently null when no run or no match. | `GccController.cs:572-600`, `:611-633`; `GccGenerateService.cs:122`; `GccGroundingResolver.cs:355` |
| F-A17 | A hard-coded "there is no case-study data available" line is sent even when `CaseStudies` is non-empty, contradicting the PARTNER DATA block in the same prompt. | `ContentPromptBuilder.cs:2676-2681` vs `:2753` |
| F-A18 | Stale comments that read as current: the tool evidence comment (`:1389-1405`), "already-verified partner FAQ pairs" (`:1536`), the provenance guard's claim, the probe's claim. | as cited |

Confirmed sound, as of 2026-10-03/04: the tool quotation is chosen by number and resolved from the
system's own string; the tool page is told the create's keyword; the length floor is one rule with a
per-batch retry; the partner extraction is banked by content digest, successes only; a pillar or blog
that fails to name a partner after a retry is saved with the gap recorded; Rule 2 puts the URL in
`href`; parser hygiene covers quote runs; metadata missing a required field is refused by name.

---

## The work — GeekAPI

**A1 — Extracted items are verified before they count.** (F-A1; D4)
- Change: after extraction and before the gate, at both sites (`GccGenerateService.cs:581` pre-flight,
  `:1280` drafting), every item carrying a quote is checked through R4. An item whose quote is not on
  its page is removed: it does not count toward any gate, does not reach any prompt, does not enter
  the bank. If the Library cannot be asked, the create is refused; the unverified document is never
  used in its place. The bank stores verified documents only; `CurrentExtractorVersion` is bumped so
  every banked row re-extracts. The "already verified" sentences become true.
- Interim, before R4 exists: remove the three "verified" sentences from the FAQ prompt and the comment
  at `:1536`. A promise the code does not keep is removed the day it is found.
- Done when: a test feeds an extraction with one item whose quote is not on the page and shows it
  absent from the gate count, the prompt, the JSON-LD and the bank.
- Depends on: R4 (full); nothing (interim).

**A2 — The tool body receives QUOTEABLE RESEARCH.** (F-A2; D12)
- Change: `WriteToolBodyAsync` is passed the research block and the competitor/own-site blocks, not
  one in place of the other. The comment at `:1389-1405` is made true by the code under it.
- Done when: the test that asserts the spans reach the body also asserts the `=== QUOTEABLE RESEARCH`
  marker reaches it.

**A3 — A gate per content type replaces "3 of 22".** (F-A3; D5, D6)
- Change: each of the twenty types declares what it needs, and is refused naming what is missing.
  Two kinds of requirement: **claims** (every statement the framing makes about a specific tool has a
  verified quote, from A4, or the page is refused naming the claim) and **categories** (the verified
  categories that type's sections draw on, per the table in Section 0). `HasSufficientPartnerData`
  and `CountPopulatedPartnerDataCategories` are deleted.
- Measure first: a script over the bank counts, per category, how often it fills with verified items
  across the indexed partners. A type whose categories are mostly empty on real sites is not enabled
  whatever its gate says. Comparison and Alternatives are the ones to check.
- Depends on: A1, A4.

**A4 — One Library question per framing claim.** (F-A15 in part; D5)
- Change: alongside the keyword question, each partner's run is asked one question per paragraph of
  that tool's framing (its "automation to pitch" and "where they fail", or the category's when there
  is no override): the product name plus the paragraph, length-bounded like the keyword need. The
  passages returned for a claim are kept with that claim, shown to the writer under it, and read by
  A3's gate. No model call forms the questions.
- Done when: for the Melio framing, the passages for "connects to QuickBooks Online, QuickBooks
  Desktop, or Xero" come from Melio pages that name those products, and the same question against a
  partner that does not integrate with them returns nothing citable.
- Depends on: R1 (a partner that returns one page has nothing to verify).

**A5 — Pillar and Blog refuse on missing partner evidence.** (F-A4)
- Change: with partners declared, zero quoteables for any declared partner refuses, naming the
  partner. The resolver refuses when *any* declared URL of a crawl type is unindexed, as its comment
  says. Retrieval warnings are written into the envelope's `warnings`, not dropped. The provenance
  guard's comment is corrected.

**A6 — The guards are one function per type, run on every draft.** (F-A5, F-A6, F-A10; D13, D14)
- Change: per type, one `Guard(document)` that runs every check and is called on the first draft and
  on every retry, so a retry cannot pass fewer checks than the draft it replaces. Specifically:
  - the pillar FAQ is generated before the guards and carried through retries;
  - Pillar/Blog refuse a `QuoteParagraph` (the ban, enforced);
  - Tool requires exactly one quotation;
  - every run `href` is checked against the allowed set (the five tool pages, the scheduler anchor,
    the own-site URLs); a href outside it is refused, which is the only way "never link a competitor"
    becomes true;
  - a number in the body is checked against the evidence block and the extraction (digits only; a
    number not present in either is refused naming the sentence), which is the only way "a number
    may appear only if it is in the evidence" becomes true;
  - the length shortfall after retry goes into `warnings`;
  - image-prompt failure saves the guarded draft and reports (D14);
  - the hard-coded "no case-study data" line is replaced by the extraction's actual state.
- Done when: a mutation test per guard shows the retry path cannot skip it.

**A7 — Affiliate wording and category removed.** (F-A7; D3, D6)
- Change: the extraction prompt defines a partner as a third-party product the firm implements for
  clients; `affiliateDisclosures` and `freshnessLog` leave the schema, the document model, the gate
  and the adapter; the "affiliate perk" wording goes. `CurrentExtractorVersion` bumps.
- Done when: zero case-insensitive hits for `affiliate` in `.cs` except the kept comment at
  `GccNicheFraming.cs:25`.

**A8 — Revise is a guarded regenerate.** (F-A8; D9)
- Change: Revise runs the same path as Generate with the operator's feedback added: the create's
  brief, research, evidence, must-mention, candidates and the per-type guard. `scope=section`
  regenerates that section with the rest held fixed. Metadata and JSON-LD are regenerated; warnings
  are carried. Interim: tool Revise returns 400 "not available until Revise is guarded"; pillar and
  blog Revise run the A6 guard.

**A9 — Authorization.** (F-A9; D8)
- Change: `[Authorize]` on the controller; every create and version route checks the create's
  `OwnerUserId` against the caller; `PATCH brief-research` accepts `briefJson` and `topic` only
  (generation owns `researchJson`, see D1 in 3.4), validated for shape; `ValidateAudience=true` with
  audience `geekapi`; `X-Geek-User-Id` impersonation disabled outside Development; `JoinToolsJob`
  checks ownership. First: a query listing creates whose owner is not the operator's `sub`.

**A10 — Evidence persisted per version.** (F-A11; D10)
- Change: for every version written, one row with: the prompts sent (system and user, per call), the
  raw responses, discarded first drafts and which guard fired, the merged research, the typed passages,
  the numbered candidate list, the readiness verdicts, the bank digests used, the RAG queries and
  their scores, the provider and model id. Through GeekRepository (3.4 D2).
- Done when: for any version, "what was the writer given, and what did it return" is answerable from
  the database alone.

**A11 — Jobs persisted, with a read route.** (F-A12; D11)
- Change: `gcc_generate_jobs` through GeekRepository; `GET creates/{id}/jobs/{jobId}`; on startup the
  runner marks any job left `running` as `failed: interrupted by redeploy`; one active job per create
  (unique partial index), so a second Generate on the same create is refused by name.

**A12 — Persistence is all-or-nothing per generate.** (F-A10) Either every piece's artifact and
version are written, or none, with the pieces that were written named in the failure; through one
GeekRepository call.

**A13 — Provider and model provenance.** (F-A14) Extraction and the probe take the operator's
provider; `ToLlm` refuses an unknown value; `metadata_json` records provider, model id, extractor
version and the bank digests used.

**A14 — The probe is the generate path.** (F-A15) Same need builder, same topK, same candidate
cutter, same selection rule; or the claim is removed and the probe is described as advisory.

**A15 — The dormant v2 cluster is deleted.** (F-A13; D7)
- Change: after A1 and A6 have lifted the four pieces, delete every registered v2 class with zero
  callers, the v2 hub, the v2 controllers and tables, `ContentCreatorV2:DraftingEnabled`,
  `GccV2JobWorker` and `GccV2ContextIngestionWorker`. The live v2 pieces are moved into
  `Services/ContentCreator` and renamed without the `V2` prefix.
- Done when: `grep -rl ContentCreatorV2 --include=*.cs` returns nothing.

**A17 — The crawl discovery ledger is readable.** (from Geek-Crawler-v2 C3, 2026-10-04) The crawler
now writes a discovery ledger into `HostProgressJson` on every terminal transition (discovered,
enqueued by source, fetched, budget, refusals by rule, off-sitemap counts, per-section counts,
sitemap size and truncation). GeekAPI stores the string and nothing reads it. Either type it onto
`GeekCrawlerRunReport` (which today drops unknown fields) or return it on the run read, so the
operator and the C2 measurement can see it. Until then the counters C3 built are invisible from
the product.

**A18 — `gcc_creates.Department` agrees with the taxonomy.** (from the frontend review) The frontend
no longer sends `department`; the controller defaults it to `"marketing"` (`GccController.cs:313`)
while every published path comes from the taxonomy path's first level. Set the column from the
taxonomy when the brief is saved, and refuse a generate whose brief has no taxonomy path.

**A19 — The `Notes` reads go.** (D17) Seven reads of `create.Notes` remain; the frontend never sends
it. Remove the reads, the column stays until a later migration.

**A16 — Stale comments corrected** (F-A18): the four named, plus any the A-stages make stale.

---

## Verification

- **GeekAPI:** `dotnet build` zero errors; `dotnet test` green (1,540 today, rising); for every guard
  a mutation test that disables it and shows a test go red; for every prompt sentence that asserts a
  safety property, a line of code named beside it in the test that enforces it.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / a third declared partner | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

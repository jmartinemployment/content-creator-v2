<!-- Generated from fix-overview.md and the five project files. Edit those; regenerate this. -->

# Fix Content Creator — overview

The six files: this overview, then one per project: `fix-geekapi.md`, `fix-geekrepository.md`,
`fix-geek-crawler-v2.md`, `fix-geek-crawler-rag.md`, `fix-frontend.md` (this repository's UI).

**Written 2026-10-04. Status: for review. Nothing in Sections 3–5 is built.**

This plan rests on two things and nothing else:

1. **The code as it runs today**, read on 2026-10-04 at these commits: GeekBackend `main` `de0bb7e`,
   content-creator-v2 `main` `5d0cfbe`, Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`. Every
   `file:line` below was read at those commits. A line number is a pointer to re-check, not a fact
   that survives the next commit.
2. **Jeff's stated decisions**, listed in Section 0 as settled.

It does **not** rest on any earlier plan. None of the 22 files in `plans/` and `GeekBackend/plans/` was
reviewed or approved, and they contradict each other on whether Postgres is allowed, which writer is
live, whether evidence is persisted, and whether the tools-section guard is the enforcement. They are
listed once, in Appendix A, as retired. Nothing in them is cited here as evidence of anything.

The plan is organised by **project**, because each project owns one concern and a fix in the wrong
project is a fix that drifts. Section 1 is the decisions Jeff has to make before building. Section 2
is the audit: what the code does today, per project. Section 3 is the work, per project. Section 4
is the order. Section 5 is how each piece is proven.

---

## 0. Settled rules — Jeff's decisions, not open for re-litigation

| Rule | Source |
|---|---|
| **Postgres:** GeekAPI → GeekRepository → Supabase → a defined schema. GeekRepository is the only service with Postgres credentials. Nothing bypasses it; nothing writes outside a defined schema. | Jeff, 2026-10-04 |
| **No branches.** Commits go to `main` in every repo. | Jeff, 2026-10-03 |
| **Version one writes.** The v2 write path never produced a document. Generation is RAG-grounded; the grounding moved to v1, not the writer to v2. | Jeff, 2026-09-21 |
| **Markdown is forbidden** as corpus, interchange, or verification target. Typed `blocks` are the corpus; one block→text projection; HTML is produced by one renderer. | AGENTS.md, standing |
| **No tools section** on any long-form type; tools are discussed in prose as the solution to the angle's problem, each linked. | Jeff, 2026-10-01 |
| **Topic is `descriptor: keyword`.** The keyword is the SEO target and names the solution; the partner's product is the subject and is never the topic. | Jeff, 2026-09-28, 2026-10-02 |
| **Affiliate and partner-program wording has no place** in prompts, data, or output. A partner is a third-party product the firm implements for clients. | Jeff, 2026-10-02, 2026-10-04 |
| **Fail closed. No middle states. No fallbacks.** A draft saved with its gap named is not a middle state; a draft silently thinned is. | AGENTS.md; Jeff 2026-09-27 (CTA), 2026-10-04 (partner mentions) |
| **Tool equals Pillar on every measure.** Quality beats count, and the floor is still a floor. | Jeff, 2026-09-22, 2026-09-28 |
| **A quotation is the partner's published words, chosen by number from spans the system cut.** The model never types a quote. | Design, enforced 2026-10-03 |
| **Service boundaries.** Crawling is Geek-Crawler-v2's. Retrieval and verification are Geek-Crawler-Rag's; it never generates. Generation is GeekAPI's. Data is GeekRepository's. Content Creator passes a run id and displays results; it has no crawler and no browser. | AGENTS.md |
| **Content types.** Twenty, listed below. Seven are live. A disabled type is enabled only when its spine, its gate, and one real proof exist. | Jeff, 2026-10-04 |

### The twenty content types

| Type | State today | Grounding it needs |
|---|---|---|
| Pillar | live | project site, partners (named, linked, as solution), competitors (read, never cited) |
| Blog | live | same as Pillar |
| Tool page | live | one partner's own pages: features, pricing, integrations, limits, FAQ, one quotation |
| Email — cold outreach | live | the angle's problem; partner offers |
| Social | live | the angle's problem; offers and facts with numbers |
| Image prompt | live | the topic and brief |
| Ads | live | advertisements and offers from partner data |
| Tech article | disabled | as Pillar, deeper mechanics |
| Comparison | disabled | comparisons, battlecards, features, pricing, across partners |
| Alternatives | disabled | alternatives |
| Case study | disabled | case studies, testimonials, facts with numbers |
| Guide / How-to | disabled | as Pillar, procedural spine |
| Listicle | disabled | awards, categories |
| Service page | disabled | own site; the firm's implementation offer |
| Local landing | disabled | own site plus `local` (geography) crawl |
| Whitepaper | disabled | as Pillar, long |
| Email — newsletter | disabled | offers, facts with numbers |
| Email — story nurture | disabled | the angle's problem, sequence |
| Email — transactional | disabled | none; template |
| PDF / LinkedIn document | disabled | as Pillar, sectioned for slides |

The "grounding it needs" column is the first draft of each type's gate (Section 3.3, A3). It is for
discussion, not in code.

---

## 1. Decisions — made 2026-10-04

**Jeff, 2026-10-04: "I have insufficient knowledge and defer these decisions to your
recommendations."** So each row's recommendation is the decision. The rows are kept as written, with
the reasoning, so a later reader can see what was chosen and why, and can reopen one by name. A
stage marked **blocks** was blocked until this date and is not blocked now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D1 | Repeated chunk text: collapse at **index time** (one point per distinct text per run) or at query time. | Index time. One rule for every consumer; query-time would need it in two retrieval paths that work differently. | R1 |
| D2 | Links the sitemap omits: admit **every** same-origin link under the existing quotas, or only product/evidence-tier links. | Admit every link under the quotas, and raise the request budget off the sitemap size. The tier list is a priority order, not a whitelist. | C1 |
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
| D15 | Lexical retrieval: today it is a Qdrant scroll in id order with synthetic scores, not a ranked search. Rank it, or drop it from fusion. | Rank it over a run-scoped candidate set, with the collapse before the pool cut. Measure after R1 before building. | R2 |
| D16 | Raw `Html` on crawl pages: keep storing it, or stop. | **Withdrawn, Jeff 2026-10-04: raw HTML stays stored.** This project is HTML, never Markdown; `contentHtml` and every block's `html` are HTML too, and nothing here moves toward anything else. `GccV2SiteSection` reads `Html` on a live path, which settles it regardless. | — |
| D17 | The brief field `notes`: the frontend never sends it and the backend reads it in seven places. Add the field, or remove the reads. | Remove the reads. The brief and niche framing are the operator's input; a second free-text channel is a second place for the same thing. | F3 |

---

## 2. The audit and 3. The work — one file per project

The audit findings and the stages are in the project files, so each project's owner reads one file:

| Project | Plan |
|---|---|
| Geek-Crawler-Rag | [`fix-geek-crawler-rag.md`](fix-geek-crawler-rag.md) |
| Geek-Crawler-v2 | [`fix-geek-crawler-v2.md`](fix-geek-crawler-v2.md) |
| GeekAPI | [`fix-geekapi.md`](fix-geekapi.md) |
| GeekRepository | [`fix-geekrepository.md`](fix-geekrepository.md) |
| content-creator-v2 (frontend) | [`fix-frontend.md`](fix-frontend.md) |

Finding ids (`F-C1` crawler, `F-R1` RAG, `F-A1` GeekAPI, `F-D1` GeekRepository, `F-F1` frontend)
and stage ids (`R1`, `C1`, `A1`, `D1`, `F1`) are shared across all six files. The pattern every
finding shares, in all five projects: **a property asserted in a prompt, a comment or a doc that no
code enforces.** The audit looked for that shape specifically.

---

## 4. Order

Stages with no dependency start now and run in parallel across projects. Each wave ends the same
way: one real Generate on the Accounts Payable create, all seven live types, and Jeff reads the
output. No wave starts until the previous wave's proof has been read.

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Wave 1 is the set that removes false promises and silent drops without redesigning anything. Wave 2
makes verification real and feeds the writer per-claim evidence. Wave 3 replaces the gate and makes
the system diagnosable. Wave 4 is the deletion, last, so nothing is removed that a lift still needs.

Disabled content types are not enabled in any wave of this plan. Each one is a later plan of its own:
its spine, its gate from A3's table, and one real proof.

---

## 5. Verification

Per project, the checks a stage must pass before it is called done. These are in addition to each
stage's own "done when".

- **Geek-Crawler-Rag:** `uv run pytest` green; `/health` ok after deploy; the Ramp re-index numbers in
  R1; the two claim questions answered from Melio product pages after R2/R3.
- **Geek-Crawler-v2:** `tsx --test` green including the new `sitemap.test.ts`; the three re-crawls in
  C1 with their reports; no counter in the report that nothing increments.
- **GeekAPI:** `dotnet build` zero errors; `dotnet test` green (1,540 today, rising); for every guard
  a mutation test that disables it and shows a test go red; for every prompt sentence that asserts a
  safety property, a line of code named beside it in the test that enforces it.
- **GeekRepository:** migrations apply on a fresh database and on the live one; D4's rule test green.
- **content-creator-v2:** `tsc --noEmit` and `eslint` clean; a reload mid-generate shows the running
  job; a version with a warning shows it when reopened a day later.
- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

---

## Appendix A — plans retired by this one

None of these was reviewed or approved. They are not evidence of what is live, what was decided, or
what is done. Where one contains a measurement (the Ramp passage counts, the sitemap drop counts),
the measurement was re-run or re-read against code for this plan and is cited above from code.

content-creator-v2/plans: `agent-specialists.md`, `angle-aware-blockquote-validation.md`,
`bank-extraction-and-legible-quote-guard.md` (its banking half shipped 2026-10-04 as described in
F-A3's "confirmed sound" line; its quote-guard half was superseded by selection by number),
`content-creation-off-postgres.md` (contradicts the settled Postgres rule), `content-type-dispatch-and-richness.md`,
`cross-linking-generated-content.md`, `finish-the-v1-restore.md`, `fix-code-review-findings.md`,
`grounded-generation-and-serp.md`, `grounding-resolved-once-per-generate.md`,
`no-tools-section-by-construction.md`, `one-way-to-write.md`,
`per-partner-tool-pages-and-competitor-structure.md`, `rag-serialization-bottleneck.md`,
`remove-unwired-code.md`, `research-source-upload-ui.md`, `site-grounding-on-geek-crawler.md`,
`tool-page-per-partner.md`, and `query.py` (not a plan; a copy of a RAG module).

GeekBackend/plans: `audit-does-the-writer-use-rag.md`, `competitor-partner-data-purpose.md`
(describes partners as promoted products; contradicts the affiliate decision), `session-notes-2026-09-28.md`,
`writer-anchor-tool-detection.md`.

Jeff's 2026-10-04 investigation note (`partner-evidence-reaches-the-writer.md`, written in
Geek-Crawler-Rag) is the one document whose findings this plan carries forward, re-verified: its
Stages 1–6 are R1, C1, A7, A1, A4 and A3 here, with the dependencies it stated.

## Appendix B — AGENTS.md statements now known to be stale

- `/app/workflow` renders the whole panel chain. It renders clients and projects; the rest is at
  `/app/projects/[id]`.
- `GccGenerateResult` has no `refusals` field. It has one, and `warnings` since 2026-10-04.
- A re-crawl reuses the same run id and refills it in place. GeekAPI issues a fresh run id and purges
  the previous published run at commit (F-C9).
- `crawl_pages.Html` is load-bearing for partner/competitor extraction. The cited reader has no caller;
  the paragraph contradicts the table above it (F-C8).
- `ContentDocument` has no node for quote, code or term/definition. It has all three.
- "Whether the v2 write path is deleted is open and unexecuted." It is decision D7 here.
- The tools-section guard at `GccGenerateService:2789/:3071` is the enforcement. The line numbers are
  stale and the guard catches top-level listings only (F-A6); A6 is the enforcement.


---

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
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.


---

# Fix Content Creator — GeekRepository

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for GeekRepository: its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D10 | Persist the evidence behind every version (prompts, passages, candidate list, extraction digest, readiness). | Yes, in Postgres through GeekRepository, one row per version. Every diagnosis this week was archaeology on a 60-character excerpt. | A10, D2 |

## Audit — GeekRepository

| Id | Finding | Where |
|---|---|---|
| F-D1 | **`brief_json` and `research_json` are replaced whole, last writer wins, no concurrency token.** The brief save and generation both PATCH the same endpoint. | `GccCreateRepository.cs:126-150` |
| F-D2 | No table links a version to its evidence, and no table holds generate jobs. `metadata_json` carries `{generatedByProvider}` only. | `ContentCreatorDbContext.cs:73-84` |
| F-D3 | Schema and access are correct: every Content Creator table is in `content_creator`; every controller is behind `InternalServicePolicy`; migrations apply at startup. The new bank table follows the same shape. | `ContentCreatorDbContext.cs:31-103`; `Program.cs:231-245` |

---

## The work — GeekRepository

**D1 — `research_json` has one writer.** (F-D1) The brief PATCH writes `brief_json` and `topic`
only. Generation never writes `research_json` back (it resolves grounding in memory, see F-A11 and
A10 for where that goes). `gcc_creates` gets a concurrency token (`RowVersion`), and a stale write
is refused, not silently overwritten.

**D2 — Two tables and their endpoints.** (D10, D11) `gcc_version_evidence` (one row per version,
columns per A10) and `gcc_generate_jobs` (per A11), in `content_creator`, with migrations, snapshot,
repositories, controllers behind `InternalServicePolicy`, and client methods in `HttpGccRepository`.

**D3 — `metadata_json` carries provenance.** (A13) Provider, model id, extractor version, bank
digests.

**D4 — A test that pins the rule.** Every Content Creator table is in `content_creator`; every
controller is behind `InternalServicePolicy`; no other project references `ContentCreatorDbContext`.

---

## Verification

- **GeekRepository:** migrations apply on a fresh database and on the live one; D4's rule test green.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.


---

# Fix Content Creator — Geek-Crawler-v2

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for Geek-Crawler-v2: its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D2 | Links the sitemap omits: admit **every** same-origin link under the existing quotas, or only product/evidence-tier links. | Admit every link under the quotas, and raise the request budget off the sitemap size. The tier list is a priority order, not a whitelist. | C1 |
| D16 | Raw `Html` on crawl pages: keep storing it, or stop. | **Withdrawn, Jeff 2026-10-04: raw HTML stays stored.** This project is HTML, never Markdown; `contentHtml` and every block's `html` are HTML too, and nothing here moves toward anything else. `GccV2SiteSection` reads `Html` on a live path, which settles it regardless. | — |

## Audit — Geek-Crawler-v2

| Id | Finding | Where |
|---|---|---|
| F-C1 | **A discovered link not in the sitemap is dropped, silently.** The test is exact string membership, so trailing-slash, case and www variants not literally in the map are dropped too. No counter is bumped. | `src/crawl/sitemap.ts:273`; intent at `:37-41`, `:250-253`; logged once at `cheerio-runner.ts:208-211` |
| F-C2 | **The request budget is clamped to the sitemap's size** when under 2,500, so admitting off-sitemap pages would only displace listed ones. | `cheerio-runner.ts:217-237` |
| F-C3 | **There is no link-trap defence** other than the sitemap allowlist. `maxDepth` is null for every profile, so the depth check is inert. URL dedup deliberately keeps `page`, `sort`, `variant`. | `cheerio-runner.ts:273-276`; `dedup.ts:9`, `:61-109` |
| F-C4 | **Most counters are never persisted.** `runs.recordRejectStats` has no caller, so `run.json` reject and dedup fields are never written. Off-sitemap drops, locale drops, depth suppression, per-section admitted/suppressed, sitemap truncation, and budget exhaustion are not counted anywhere. The one merged counter, `enqueueSuppressedSectionQuota`, is inflated by repeated refusals. | `runs.ts:248-296`; `section-quota.ts:350-355`; `cheerio-runner.ts:683-687` |
| F-C5 | **No sitemap test exists.** `filterEnqueueUrls`, `initialCrawlUrls`, `loadSiteMapForSeed` have no unit test. The integration fixture serves an off-sitemap link and asserts nothing about it. | `tests/integration/crawler.integration.test.ts:96-98`; `tests/fixtures/site.ts:100` |
| F-C6 | **Page-level near-duplicate detection compares whole pages** (64-bit simhash over 5-word shingles, Hamming ≤ 3). Block-level repetition, which is what floods retrieval, is invisible to it. | `dedup.ts:157-200`, `:219-227` |
| F-C7 | Classifier and quota tables drifted: `case-studies` is qualifier-prefixed in one and bare in the other; `archive` lacks `page` in one. | `section-quota.ts:111`, `:67` vs `classify-path.ts:147`, `:161-163` |
| F-C8 | **Content is stored three times** per page: raw `Html`, `contentHtml`, and `blocks` (each block carries `text` and `html`). `Html` is the bulk. | `GeekCrawlerPage.cs:5-36`; `ingest-limits.ts:51-56` |
| F-C9 | **A re-crawl gets a fresh run id**, issued by GeekAPI; the previously published run is purged at commit. AGENTS.md says the opposite ("the same run id refilled in place"). | `GeekCrawlerIngestController.cs:109-121`, `:236-244`, `:352-370` |

Confirmed sound: extraction emits eight typed block kinds with `text`, `html`, `anchors`; there is no
Markdown conversion anywhere; `ContentReadyAt` is set only when every saved page has content and is
cleared on cancel and supersede (`persist.ts:321-336`; `IngestController.cs:342-349`).

---

## The work — Geek-Crawler-v2

**C1 — Follow links the sitemap omits, and count them.** (F-C1, F-C2; D2)
- Change: remove the allowlist test at `sitemap.ts:273`. A same-origin link not in the sitemap goes
  through `admitBySection` like any other. The sitemap keeps its job of seeding in priority order.
  Size the request budget from the profile, not the sitemap. Count `offSitemapAdmitted` and
  `offSitemapSuppressed` in `CrawlReport`.
- Done when: a re-crawl of ramp.com fetches `/products`, `/bill-pay`, `/accounting-automation`; of
  bill.com `/pricing`; of lightyear.cloud `/features/*`; and each report states how many off-sitemap
  pages were admitted.
- Depends on: C2 lands in the same change.

**C2 — A link-trap defence that is not the allowlist.** (F-C3)
- Change: the allowlist was also the trap defence. Replace it with the minimum that the measured
  corpus needs: a path-pattern denylist (calendar, faceted and paginated listings), a per-directory
  admitted-page cap for `other`-tier directories, and `maxDepth` set per profile rather than null.
  Measured on ramp, bill, lightyear and the two sites with the most `other`-tier pages.
- Depends on: nothing; ships with C1.

**C3 — Counters are persisted.** (F-C4)
- Change: wire `recordRejectStats`; add per-section admitted/suppressed, depth suppression, sitemap
  truncation, budget exhaustion and the C1 counters to `CrawlReport`, which already persists to
  `CrawlReportJson`. Refusals are memoised so a re-offered URL is counted once.
- Done when: the crawl report for one run accounts for every discovered URL: fetched, suppressed by
  which rule, or left unfetched by budget.

**C4 — Classifier and quota tables agree.** (F-C7) One table, or a test that diffs them.

**C5 — Sitemap tests.** (F-C5) `sitemap.test.ts` for `filterEnqueueUrls`, `initialCrawlUrls`,
`loadSiteMapForSeed`; the integration fixture asserts the off-sitemap link is admitted.

**C6 — withdrawn.** Raw `Html` stays stored (Jeff, 2026-10-04: this project is HTML, never Markdown). `GccV2SiteSection` reads it on a live GeekAPI path. F-C8 stands as a measurement of storage, not as a task.

---

## Verification

- **Geek-Crawler-v2:** `tsx --test` green including the new `sitemap.test.ts`; the three re-crawls in
  C1 with their reports; no counter in the report that nothing increments.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.


---

# Fix Content Creator — Geek-Crawler-Rag

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for Geek-Crawler-Rag: its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D1 | Repeated chunk text: collapse at **index time** (one point per distinct text per run) or at query time. | Index time. One rule for every consumer; query-time would need it in two retrieval paths that work differently. | R1 |
| D4 | Quote verification: a **Library route** GeekAPI calls, or the existing C# substring comparison. | Library route. Two implementations of "is this quote on the page" will disagree on whitespace and punctuation; the quote guard already paid for that. | R4, A1 |
| D15 | Lexical retrieval: today it is a Qdrant scroll in id order with synthetic scores, not a ranked search. Rank it, or drop it from fusion. | Rank it over a run-scoped candidate set, with the collapse before the pool cut. Measure after R1 before building. | R2 |

## Audit — Geek-Crawler-Rag

| Id | Finding | Where |
|---|---|---|
| F-R1 | **Identical chunk text on different pages of one run is one point per page**, same vector, distinct id. Nothing collapses them at index time. The engine's own docstring says one footer CTA is 270 points. There is no `textDigest` field. | `llama_engine.py:238-239`, `:288-289`; `qdrant_store.py:26-27` |
| F-R2 | **Retrieval fills with copies before it de-duplicates.** Dense list capped at `max(topK*2, 30)`; lexical at 30; BM25 runs over only that merged set; RRF ranks it; the pool is cut to `max(topK*2, 40)`; then `seen_text` collapses copies to one, with no refetch. Ramp returned 1 passage from 33,728 chunks. | `query.py:115-179`, `:352-387` |
| F-R3 | **The "keyword" search is a Qdrant scroll in id order with synthetic scores**, not a ranked search. Text payload indexes are deliberately dropped. | `qdrant_store.py:751-817`, `:279-297` |
| F-R4 | **There is no verification route.** `quote_in_text` is called only by diagnostics over caller-supplied documents. `GET /v1/pages/{id}` returns text only. The verify digest (`sha256(page text)`) and the point digest (`sha256(contentHtml or html)`) are two definitions. | `citation_verify.py:19-42`, `:71`; `diagnostics.py:546-570`; `llama_nodes.py:73-75`; `app.py:597-659` |
| F-R5 | `POST /v1/index` does not check `ContentReadyAt`; only the deprecated scheduler does. README says the scheduler is off; `config.py` and the compose file default it on. | `indexer.py:602-607`; `config.py:131`; `deploy/hostinger-compose.yml:50`; `README.md:202-210` |
| F-R6 | The job queue is in-process; a redeploy loses in-flight jobs and nothing reclaims them. README claims lease recovery does; the docs say it does not. | `indexer.py:99-105`; `docs/index-job-recovery-after-restart.md:10-25`; `README.md:361-363` |
| F-R7 | Cohere rerank is disabled in production (no key), so ranking is RRF alone. | `rerank.py:51-53`; compose has no `COHERE_API_KEY` |
| F-R8 | No test covers the same text across page ids, or a pool flooded with copies. | `tests/test_query.py` |
| F-R9 | README drift: upsert delay, memory, tokenizer, embed retry all disagree with code. | `README.md:241`, `:334`, `:246-248`, `:260-263` |

Confirmed sound: Library-only (no `/v1/generate` route; a test asserts it is not advertised); one
block→text projection used for chunking, page text and verification; `grep -ri markdown` finds one
hit, in `architecture.md`, saying it is forbidden.

---

## The work — Geek-Crawler-Rag

**R1 — A repeated text is indexed once per run.** (F-R1; D1)
- Change: at index time, within a run, a chunk whose embedded text was already emitted by an earlier
  page of the run is not emitted again. Key: SHA-256 of the exact embedded string, stored on the
  point as `textDigest` so a resumed run rebuilds its set from points already written. The index
  status reports chunks skipped as repeats.
- Files: `llama_engine.py` (`embed_and_upsert`), `llama_nodes.py` (payload), `indexer.py` (status),
  `qdrant_store.py` (resume scan reads `textDigest`).
- Done when: re-indexing the Ramp run drops its point count by about 7,000; each of the three keyword
  questions in Jeff's 2026-10-04 table returns at least 10 passages from at least 10 pages; the two
  claim questions that returned one passage return more than one.
- Depends on: nothing. Constraint: a push deploys and recreates the container; not while indexing runs.
- **Which runs get re-indexed, and how.** Existing runs keep their duplicate points until re-indexed.
  The order is: the Ramp run first, alone, as the measurement above. Then only the runs that a
  saved project declares as a partner or competitor, one at a time, through `POST /v1/index`, each
  one checked at `GET /v1/index/{run_id}` before the next is posted. Never the whole corpus, never the
  `requeue-stranded.sh` cron, never several at once: the queue is in-process, a redeploy kills the
  job in flight (F-R6), and a run that failed mid-index is a run the writer cannot use until it is
  posted again. Runs no project declares are left as they are until a project declares them.

**R2 — Lexical retrieval is ranked.** (F-R3; D15)
- Change: replace the id-order scroll with a run-scoped candidate fetch (`MatchText`, larger limit)
  ranked by the existing in-process BM25, so the lexical list is a relevance list before fusion.
- Done when: a keyword that appears on 50 pages of a run returns the pages where it is densest, not
  the 30 lowest ids. A test pins it.
- Depends on: R1, and a measurement after R1 of what Ramp returns before deciding the limit.

**R3 — Collapse before the cut, and measure near-copies.** (F-R2)
- Change: run the text collapse before the pool is cut to 40, and backfill from the fetched lists.
  Then measure whether templated near-copies (same paragraph, merchant name swapped) still fill the
  first 32; if so, that is a second problem with the measure already stated (60% of 4-word phrases on
  30% of sibling pages) and gets its own stage. Do not build it on speculation.
- Depends on: R1.

**R4 — A verification route.** (F-R4; D4)
- Change: `POST /v1/verify` taking `runId`, `pageId`, `quote` (and a list form), answering with
  `found`, and the one normalisation `quote_in_text` already applies. One digest definition: the
  page's `sourceDigest` is `sha256(contentHtml)` everywhere, and `verify_citations` uses the same.
- Done when: GeekAPI's verify pass (A1) calls it and has no comparison of its own; a quote with a
  curly apostrophe against a page with a straight one is answered the same way in both places because
  there is only one place.
- Depends on: nothing.

**R5 — Readiness is fail-closed.** (F-R5, F-R6)
- Change: `POST /v1/index` refuses a run without `ContentReadyAt`; the scheduler default matches the
  README (off); restart behaviour is documented once, correctly, and the README's recovery claim is
  removed or made true.
- Depends on: nothing.

**R6 — Tests.** Same text across page ids; a flooded pool; the verify route; the ranked lexical list.

**R7 — README drift** (F-R9): four corrections.

---

## Verification

- **Geek-Crawler-Rag:** `uv run pytest` green; `/health` ok after deploy; the Ramp re-index numbers in
  R1; the two claim questions answered from Melio product pages after R2/R3.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.


---

# Fix Content Creator — the frontend (this repository)

**Written 2026-10-04. Status: for review. Nothing in "The work" is built.**

One of five project plans. The overview, the settled rules, all seventeen decisions, the wave order
and the retired-plans list are in [`fix-overview.md`](fix-overview.md). This file is
self-contained for content-creator-v2 (frontend): its audit findings, its decisions, its stages, and how each is proven.

Grounded in the code read on 2026-10-04 (GeekBackend `de0bb7e`, content-creator-v2 `5d0cfbe`,
Geek-Crawler-v2 `a08ac9e`, Geek-Crawler-Rag `9afef9c`) and in Jeff's stated decisions. Not in any
earlier plan. Every `file:line` is a pointer to re-check at the commit named, not a fact that survives
the next commit.

## Decisions this project rests on

Made 2026-10-04: Jeff deferred every decision to the recommendation, so each row's recommendation is the decision. Nothing here is blocked on a decision now.

| # | Decision | Decided (per the recommendation) | Unblocks |
|---|---|---|---|
| D11 | Persist generate jobs, and add a route to read one. | Yes. Jobs are in memory, lost on redeploy, and a reload cannot re-attach. | A11, F1 |
| D17 | The brief field `notes`: the frontend never sends it and the backend reads it in seven places. Add the field, or remove the reads. | Remove the reads. The brief and niche framing are the operator's input; a second free-text channel is a second place for the same thing. | F3 |

## Audit — content-creator-v2

| Id | Finding | Where |
|---|---|---|
| F-F1 | **A create is lost on reload.** `createId` is component state, not in the URL. The localStorage key is written under one name and read under another, so it never matches. Every pre-create brief on every project shares one localStorage key, so one project's niche framing seeds another's. | `src/app/app/projects/[id]/page.tsx`; `ContentBriefPanel.tsx` (`gcc-create-id:` write vs read); `gcc-content-brief:kw:` |
| F-F2 | **A running job cannot be re-attached after reload.** The job id is a ref; a comment names a GET route that does not exist. | `CreateDraftWorkspace.tsx:271`; `GccController.cs:496` |
| F-F3 | **The post-create brief panel is not passed `projectId`**, so per-tool overrides are editable only before the create exists and the partner-quote check says "No project on this create". | `CreateDraftWorkspace.tsx:693` vs `:345` |
| F-F4 | `notes` is never sent (no field); the keyword is locked after mint; `department` is hard-coded to `"marketing"` although the taxonomy path's first level is the department. | `gcc-api.ts:85`; `ContentBriefPanel.tsx:455` |
| F-F5 | The SEO panel hides `targetKeyword` and `fixHint`; the failed terminal event does not reload, so partial artifacts stay hidden; `generateMsg` is overwritten per event. | `CreateDraftWorkspace.tsx:291-300`, hub handlers `:472-551` |
| F-F6 | The artifact view does not read the envelope's `warnings`, so a gap recorded on a version is visible only during the run that produced it. | `gcc-api.ts:564` `renderArtifactBody` |
| F-F7 | No crawl can be started from this app, by design since 2026-09-29; `crawlOne` and `startGeekCrawl` are dead code kept with a lint suppression. The form tells the operator nothing about where to start one. | `ProjectForm.tsx:57`; `gcc-api.ts:716` |
| F-F8 | Dead exports: `repurposeGccVersion`, `updateClient`, `GCC_KEYWORD_CATEGORIES`, the four tools-hub functions. | `gcc-api.ts`; `workflow-tools-hub.ts` |
| F-F9 | AGENTS.md stale: `/app/workflow` does not render the whole chain (projects live at `/app/projects/[id]`); `GccGenerateResult` has a `refusals` field; the re-crawl paragraph (F-C9); the HTML-retention paragraph contradicts its own table. | `AGENTS.md` |

Confirmed sound: the brief's fields all have a backend reader except `briefVersion`; the five-partner
floor is measured on usable URLs; the index check runs on blur, mount, submit and re-check; the
workspace now accumulates refusals and warnings instead of overwriting them.

---

## The work — content-creator-v2

**F1 — The create and the job survive a reload.** (F-F1, F-F2) `?create=` and `?job=` in the URL;
on mount, read the job through A11 and re-join the hub; fix the localStorage key mismatch; key the
pre-create brief draft by project.

**F2 — The post-create brief panel gets `projectId`.** (F-F3) Per-tool overrides are editable after
mint; the partner-quote check works on an existing create; `GccCreateDetail` carries `projectId`.

**F3 — Inputs match what the backend reads.** (F-F4; D17) Remove the `notes` reads (or add the
field, per D17); let the keyword be edited until the first generate; derive `department` from the
taxonomy path's first level rather than hard-coding `"marketing"`.

**F4 — The screen says what the backend did.** (F-F5, F-F6) The artifact view reads the envelope's
`warnings`; the SEO panel shows `targetKeyword` and `fixHint`; the failed terminal event reloads;
`generateMsg` is a list, not a string.

**F5 — Dead code and honest copy.** (F-F7, F-F8) Delete `crawlOne`, `startGeekCrawl`, the dead
exports; the project form says in one line where a crawl is started and that this app starts none.

**F6 — AGENTS.md corrections.** (F-F9, F-C9) The page chain, the `refusals` field, the re-crawl
paragraph, the HTML-retention paragraph.

---

## Verification

- **content-creator-v2:** `tsc --noEmit` and `eslint` clean; a reload mid-generate shows the running
  job; a version with a warning shows it when reopened a day later.

- **End to end, every wave:** one Generate on the Accounts Payable create with five partners produces
  five tool pages, a pillar, a blog, one cold-outreach email, one social piece, one image-prompt set
  and one ads set, or refuses each by name; Jeff reads them; every quote on every page is found on
  the page it cites.

## Where this project sits in the order

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / lightyear | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
| 3 — the gate | R7 | — | A3, A8, A9, A10, A11, A12 | — | F1 |
| 4 — delete | — | — | A15 | — | — |

Stages here with no dependency on another stage start now. A wave does not start until the previous
wave's end-to-end proof has been read.

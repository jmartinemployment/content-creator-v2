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
| D15 | Lexical retrieval: today it is a Qdrant scroll in id order with synthetic scores, not a ranked search. Rank it, or drop it from fusion. | **Decided 2026-10-04: delete it.** The dense list is already a dense-plus-sparse (BM25) hybrid, so lexical signal is in the fusion. The scroll adds a third signal that is unranked, id-ordered and scored by position, and it is the second doorway the copies flooded through. Ranking it would be a second lexical engine beside the sparse one. R2 deletes it and measures afterwards to confirm the claim questions do not regress; the measurement is the check, not the decider. | R2 |
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
| Saving a project, all projects (runs first) | [`fix-project-persistence.md`](fix-project-persistence.md) |  (`fix-persistence.md` is superseded)

Finding ids (`F-C1` crawler, `F-R1` RAG, `F-A1` GeekAPI, `F-D1` GeekRepository, `F-F1` frontend)
and stage ids (`R1`, `C1`, `A1`, `D1`, `F1`) are shared across all six files. The pattern every
finding shares, in all five projects: **a property asserted in a prompt, a comment or a doc that no
code enforces.** The audit looked for that shape specifically.

---

## 4. Order

**Jeff, 2026-10-04: no Generate is run until persistence is fixed.** Wave P0 in `fix-project-persistence.md` ships before the Wave 1 proof below, and the proof runs on top of it.


Stages with no dependency start now and run in parallel across projects. Each wave ends the same
way: one real Generate on the Accounts Payable create, all seven live types, and Jeff reads the
output. No wave starts until the previous wave's proof has been read.

| Wave | Geek-Crawler-Rag | Geek-Crawler-v2 | GeekAPI | GeekRepository | content-creator-v2 |
|---|---|---|---|---|---|
| 1 — stop the bleeding | R1, R4, R5 | C1+C2, C3, C5 | A1 interim, A2, A5, A6, A7, A16 | D1 | F4, F5, F6 |
| 2 — verify | R2, R3 (measure), R6 | C4, re-crawl ramp / bill / a third declared partner | A1 full, A4, A13, A14 | D2, D3, D4 | F2, F3 |
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

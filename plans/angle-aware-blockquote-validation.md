# Validate that the partners can answer the Brief's angle — before Generate

## Context

Jeff, 2026-10-01: *"Currently the flow of the applications does not support what needs to happen on
validation. The Brief contains the Angle for SEO, which is used to obtain the type of question that
the blockquote answers … You are seeking a blockquote with a cite to provide an answer the problem
with Manual Data Entry & Processing that a Partner fixes. Ideally, I need to know that you are going
to be able to answer the question through validate."*

The blockquote is not "any verbatim partner sentence." It must **answer a specific question, and the
Angle determines which question**. For `problem_solution` on "Accounts Payable: Automated Data Entry
& Processing", the quote must evidence the pain of *manual* data entry that a partner resolves.

Nothing asks that question until Generate runs. By then the answer costs a paid draft and arrives as
a refusal the operator cannot act on:

> Refused: the tool page … does not carry a verifiable block quotation. The page carries no block
> quotation, and the partner evidence holds no quotable span to build one from.

### The flow problem, precisely

| | Where it lives | What it knows |
|---|---|---|
| Validation today | Project form | URLs, and whether each is indexed with enough pages/chunks |
| The Angle | **Brief** (`angle` in brief JSON) | Which question the quote must answer |

Validation runs before a Brief exists, so it cannot ask the angle's question. It checks **volume** —
"is there a lot of this partner" — and calls that usable. Volume is not fitness. That is the gap.

**This dissolves the blockquote problem rather than adding to it.** The probe that validates is the
same retrieval that supplies the quote: one question, one span, verified once. Validation cannot say
yes and generation then fail for want of a quote, because they are the same call.

### Why the obvious cheaper fix does not exist

Sourcing the span from the corpus's typed `quote` blocks would need no model at all. It does not
work: `Geek-Crawler-v2/src/crawl/extract-content.ts:421` emits a `quote` block **only** from a
literal `<blockquote>` element, and vendor marketing pages render testimonials as styled `div`s.
Jeff, 2026-10-01: *"You will never find one based on that criteria."* `GccGroundingOutcome.Passages`
therefore holds nothing useful for quoting — which is incidental, since nothing in the solution
reads it anyway.

---

## What already exists and should be reused

- **Retrieval takes a free-text question scoped to one run.**
  `rag.QueryAsync(need, runId, crawlType, host, topK, …)` — `GccGroundingResolver.cs:284-291`.
  Asking the angle's question of a partner's run is this call, moved earlier.
- **The precedent for fitness-over-presence is already here.** `project-site/readiness`
  (`GccController.cs:1100`) deliberately *"runs the same retrieval PLAN runs, so presence is not
  mistaken for fitness."* This is that idea applied to partners.
- **Angle vocabulary is closed — four values.** `GccGenerateService.cs:2237-2250` maps everything
  onto `problem_solution`, `comparative`, `case_study_data`, `ultimate_guide`.
- **Verbatim + cite checking.** `GccV2ToolResearchExtractor.IsVerbatimFromPage` (`:213-218`),
  `StripWrappingQuotes` (`:234-243`), `IsUsableQuote` (`:190-195`) — tested, and they already
  operate on `GccQuoteablePage`.
- **Schema-constrained generation.** `IGccV2SchemaConstrainedGenerator.CompleteAsync<T>`, the path
  partner extraction already uses at temperature 0.1.
- **The guard's verbatim and cite rules stay exactly as they are** (`GccToolQuoteGuard.cs:71`,
  `:84-91`). Only *where candidates come from* changes.

---

## Phase 1 — angle-level validation

### The selector

Jeff's matching framework (2026-10-01); its four cases map 1:1 onto `LegacyAngleMap`:

| Angle | Select a span that… |
|---|---|
| `problem_solution` | highlights a major pain point for the keyword **and** how the partner solves it |
| `comparative` | states a differentiator, feature or advantage versus competitors or traditional methods |
| `case_study_data` | carries tangible proof — data, metrics, a success story or testimonial |
| `ultimate_guide` | is authoritative or definition-style, explaining a core concept or best practice |

Run through `CompleteAsync<T>` at temperature 0.1, RAG context wrapped in `<rag_context>` tags.

**Four constraints, each closing a specific failure:**

1. **An explicit "no qualifying span" result is required, and is a correct answer.** The source
   template says "choose a blockquote"; a model told to choose always will. For generation that is
   risky; for validation it is fatal — every partner would validate regardless of the evidence. The
   schema must allow and expect none.
2. **No markup in the model's output.** Return `quoteText` as plain text. Root `CLAUDE.md` §1b:
   *"What the model returns: Content. Never `##`, never `<h2>`"*; `SectionHtmlRenderer` builds the
   `<blockquote>`. (Jeff: *"we are not using markdown"*.)
3. **The model never supplies the cite.** It returns the span plus the **chunk id** it came from;
   the system resolves the URL from that chunk, which already carries `url`. A model-supplied URL
   can attribute real words to a page that does not carry them — already a distinct violation at
   `GccToolQuoteGuard.cs:88-90`.
4. **Verbatim is enforced, not requested.** Keep `IsVerbatimFromPage` running server-side after the
   model answers. The guard's own doc: *"Asking the prompt for one is not having one."*

### Refinements from review (2026-10-01)

**Accepted as stated.**

- **Explicit trigger, not on Brief load.** A probe per declared partner is a retrieval plus a model
  call each; ten partners would hang the panel. Operator-triggered — "Verify partner fit" — which is
  also the idiom already in use on the Project form, where the index check runs on blur and a
  "Re-check the index" button re-runs it rather than polling.
- **Schema carries an explicit negative.** `quoteText` and `chunkId` nullable, plus
  `hasQualifyingQuote: bool`. A strictly-typed absence beats forcing the model to invent fields it
  does not have.
- **Telemetry on "cannot answer".** Record the brief state and the need that was asked. Over a few
  runs that distinguishes "partner sites lack quotable copy" from "retrieval is picking the wrong
  pages" — the same distinction `DescribePartnerDataCoverage` already draws between an extraction
  outage and a genuine shortage, which is why that function exists.

**Accepted, with a boundary the review did not draw — punctuation normalisation.**

The risk is real and already visible in the corpus: the live spans carry typographic apostrophes
(`We’ve streamlined our payment workload by 200 percent.`), so a model echoing `We've` with a
straight apostrophe fails an exact comparison. But "add a normalization layer" is one step from
tolerating paraphrase, which is the one thing this guard exists to prevent.

The boundary: **fold Unicode variants of the same character — curly/straight quotes and apostrophes,
en/em dashes, non-breaking spaces — and nothing else.** No case folding, no punctuation stripping, no
stemming, no word changes. And it applies **only to the comparison**; the span that gets stored and
rendered is the source's exact characters, never the normalised form.

While in there, resolve an existing contradiction rather than building on top of it:
`GccToolQuoteGuard.cs:71` compares `OrdinalIgnoreCase` while `Normalize`'s own doc comment (`:156`)
says *"wording, punctuation and case-sensitivity of the match are the point."* One of the two is
wrong today. Decide which, deliberately.

**Partly mitigated already — multi-chunk span fracturing.**

The review is right that a quote straddling two chunks would break both the verbatim check and the
chunk-id cite. Two existing properties reduce it:

- Chunking is overlapping and two-tier — children 200 tokens with 40 overlap (stride 160), parents
  500 with 80 — and each indexed point carries **both** `parentText` and `childText`. A span that
  crosses a child boundary is usually whole inside its parent.
- Verification runs against the assembled page representation (`FormatPageText`: title, headings and
  the page's rendered chunks), not against one chunk in isolation.

Still worth doing: let the selector return contiguous chunk ids, and verify containment against the
span's own parent text as well as its child. The cite resolves from the chunk the span is contained
by — if several, the first in document order.

### The check

For each declared partner, with its run id: build the need from angle + topic, call `QueryAsync`
scoped to that run and host, run the selector over the returned chunks, and keep a span only if it
passes `IsUsableQuote` and `IsVerbatimFromPage`. Report per partner:

- **can answer** — with the span it would quote and the URL it would cite, so the operator sees it
- **cannot answer** — this partner has evidence, but none of it answers *this* angle

**Where it runs.** At the Brief, not the Project — the first point at which the Angle exists, and
before Generate is pressed. The Project form keeps its current check unchanged; it answers a
different and still-necessary question (is there a crawl at all).

**Fail closed, unchanged.** A partner that cannot answer is reported, never substituted. No fallback
quote, no softened span — `.cursor/rules/no-fallbacks.mdc`.

**One selector, both jobs.** Validation runs it and reports can/cannot answer; generation runs it and
takes the span. Same question, same answer, so the two cannot disagree.

## Phase 2 — the specific point (deferred, Jeff: *"that can be a phase 2"*)

Answering a *specific* point needs the rough outline, so the question is aimed at the section it will
sit in rather than at the piece as a whole. Same mechanism, narrower need: section heading + angle
template. Nothing in Phase 1 should make this harder — the need is a string, so Phase 2 changes what
goes into it, not the machinery around it.

---

## Files

| File | Change |
|---|---|
| new, `GeekAPI/Services/ContentCreator/` | angle → quote-question templates; the four entries above |
| new, beside `GccGroundingResolver` | the probe: need → `QueryAsync` per partner run → selector → verbatim-checked span |
| `GccController.cs` | a readiness route for the brief, shaped on `project-site/readiness` |
| `GccToolQuoteGuard.cs` | take candidates from the probe's spans as well as Testimonials/Citables; keep `:71` and `:84-91` as they are |
| `GccGenerateService.cs` | narrow the refusal at guard `:57` to what was actually checked, and attach `DescribePartnerDataCoverage` (`:2059`) so an extraction outage reads differently from a genuine shortage |
| content-creator-v2 Brief panel | show per-partner can/cannot answer, with the span and cite |

`GccV2PartnerExtractionService` stays as it is — its document feeds the tool FAQ section, pricing,
comparisons and the SoftwareApplication JSON-LD. Removing it to fix quoting would take those too.

---

## Verification

1. `dotnet test` — the 10 existing `GccToolQuoteGuardTests` must pass **unchanged**. They pin
   verbatim matching, cite/source mismatch, paraphrase rejection and whitespace tolerance, none of
   which this changes.
2. **Mutation-check the new tests**: revert the probe source and confirm they fail. A test that
   passes either way pins nothing.
3. End to end on a real brief: `problem_solution` + "Accounts Payable: Automated Data Entry &
   Processing" against the declared partners. Validation should name which partners can answer and
   show the span; Generate should then produce a tool page quoting that same span, cited to that
   same URL.
4. A partner that cannot answer must still refuse at Generate, with a message naming what was
   checked rather than asserting the evidence is empty.

---

## Known unknowns — not assumed away

- **Whether the declared partner list is reachable at Brief time** with its run ids. The project
  holds `partnerUrls`; the run id per partner URL comes from the index check. Confirm before the
  probe can be scoped per run.
- **The project declares 10 partners** (per *"Pillar names 7 of 10 partner tools"*). The index holds
  11 hosts typed `partner`, which is **not** the same set — Avalara appears in that pillar error as
  a partner while being indexed as a competitor. The probe must run over the project's declared
  list, not the index's.
- **`crawl_pages.Blocks` quote-element count** — unread, denied as a production read. It would only
  quantify the finding above, not change it.

## Out of scope

- **The blog refusal.** `IsToolsListingHeading` (`PillarSectionClassifier.cs:18-19`) is `\btools?\b`,
  so any h2 containing the word trips it, and the heading that tripped it — *"What Are the Top AI
  Tools for Accounts Payable?"* — is a curated PAA question. A prompt instruction and a guard in
  direct conflict, which a retry cannot resolve. Separate decision.
- **The pillar refusal** (*"names 7 of 10 partner tools"*). Corpay and Tipalti are usable partners
  and Avalara is indexed as a competitor, so the error's advice to "check that each has an indexed
  crawl" is misleading there.
- **The uncommitted URL-validation work** — usable-count rule and the 10-pages/3-chunks-per-page
  bar, 1,270 backend / 11 frontend tests green. Not committed; vetoed 2026-10-01.

---

## Appendix — for a reviewer without the codebase

### Terms

| Term | Meaning here |
|---|---|
| **Run / Run ID** | One crawl of one URL. `Run ID = one URL`; the id is stable for the life of that URL and a re-crawl refills the same row. |
| **Crawl type** | `partner`, `competitors`, `project-site`, `local` (geography). Partners and competitors feed retrieval; project-site grounds the client's own structure. |
| **Quoteable** (`GccQuoteablePage`) | A retrieved page as generation sees it: `Url`, `Title`, `Headings`, `Paragraphs`, `PageId`, `SectionTitle`. **`Paragraphs` is not page prose** — each entry is a rendered chunk with `Section:` / `Context:` / `Specific detail:` labels interleaved, capped at 80 chunks/page and 2,000 chars each. |
| **Brief** | Per-create inputs: topic/keyword, audience, tone, **angle**. Held as JSON on the create. |
| **Project** | The engagement: site URL + its run id, declared partner URLs, competitor URLs. Exists before any Brief. |
| **ContentReadyAt** | Stamped when every persisted page of a run carries extracted content. Gates whether a run is indexable. |

### The defect, in code

Candidate quotes are drawn from exactly two of twenty-two extracted categories:

```csharp
// GccToolQuoteGuard.cs:118-154 — QuotableSpans
foreach (var testimonial in extraction.Testimonials) { ... }   // QuoteText
foreach (var citable in extraction.Citables)        { ... }    // Provenance.Quote, IsolatedClaim
// Nothing else contributes. Features, pricing, FAQs, case studies,
// constraints, awards — all carry a verbatim Quote + source URL, all ignored.
```

When both are empty the operator is told:

```csharp
// GccToolQuoteGuard.cs:57
"The page carries no block quotation, and the partner evidence holds no quotable span to build one from."
```

That claim is about *the partner's evidence*; the check only inspected two buckets of one derived
document. The upstream document is built by one schema-constrained model call per page across all 22
categories — so when the model files a testimonial under "features", the page is refused.

### Retrieval already takes a question

```csharp
// GccGroundingResolver.cs:284-291 — what generation already does
var result = await rag.QueryAsync(need, runId, crawlType: crawlType, topK: TopK, ct: ct);
```

`need` is free text. The whole of Phase 1 is building that string from the angle and asking it
earlier, scoped per declared partner run.

### Why typed quote blocks cannot supply the span

```ts
// Geek-Crawler-v2/src/crawl/extract-content.ts:421
if (name === 'blockquote') return { kind: 'quote', text, html, anchors };
```

A `quote` block requires a literal `<blockquote>`. Vendor sites style testimonials as `div`s, so the
corpus has effectively none — which is why the model-free design is not available.

### Evidence the spans exist

Read directly from the live index on 2026-10-01 (31→34 hosts, ~136k points, actively filling).
Quote-marked, complete-sentence, first-person spans per partner-typed host, excluding legal and
licence paths:

```
tipalti 40 · corpay 52 · bill.com 417 · parseur 145 · stampli 238 · dext 168
melio 67 · approvalmax 48 · avidxchange 35 · plooto 100 · lightyear 51
```

Representative accept:

> "Stampli plays an important part of our daily AP process." — stampli.com/case-studies/cti/

Representative rejects, each for a different reason: Mozilla licence text (dext.com/licenses), a
contract clause (data-processor-agreement), a UI label with no terminal punctuation
("Do Not Sell/Share My Personal Information"), a mid-sentence fragment, and catalogue copy that is
not speech.

**This measurement is not the proposed mechanism.** It was a shape heuristic used to establish that
quotable material exists at all. The mechanism in Phase 1 is retrieval plus the angle selector, which
answers a question the heuristic cannot: *does this span answer what this brief needs?*

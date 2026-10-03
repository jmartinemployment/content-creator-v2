# Bank the partner extraction

## Context

Jeff, 2026-10-03: *"Fix both issues."* This plan covered two. **The second — the quote guard — has
moved to [`fix-code-review-findings.md`](fix-code-review-findings.md) § B**, because a max-effort code
review found the change I had written is *fail-open* and should be reverted rather than patched. See
the note at the end before acting on any earlier advice about it.

What remains here is the first issue, and it stands.

**The partner extraction is thrown away after every generate.** ~108 model calls across five
partners, recomputed from scratch on every attempt. On 2026-10-03 that was paid for four or five
times, including runs that completed extraction and *then* died — once on an Anthropic `400`
(`temperature` deprecated), once on an OpenAI `429` (credits exhausted). Each had already done the
expensive half and discarded it.

It is not only cost. The extraction is the evidence the page is built from and it does not survive the
run, so every diagnosis that day was archaeology on a 60-character excerpt. "What spans was the model
actually given?" is currently unanswerable after the fact.

**Intended outcome:** a re-generate reuses extraction it already paid for, and the evidence behind a
page can be inspected after the fact.

---

## Concurrency, measured rather than assumed

Review asked, and the answer changed the design.

- **Partners are sequential.** `GccGenerateService:630` is a plain
  `foreach … await AssessPartnerToolReadinessAsync(slice, ct)`.
- **Pages within a partner are parallel.** `GccV2PartnerExtractionService:147` fans out every page
  with `Task.WhenAll(pages.Select(ExtractOnePageAsync))`, then consumes results in page order so
  dedupe and the reported first failure stay deterministic. No local semaphore — a comment says it
  relies on an existing global limit rather than adding a competing one, though `LlmConcurrencyGate`
  exists and is not referenced here, which is worth its own look.

So ~108 calls is 5 sequential partners × ~21 concurrent pages.

## Where it is stored, and why not the obvious place

**Not `create.ResearchJson`.** That was the original design and it is wrong.

`HttpGccRepository.UpdateBriefResearchAsync` PATCHes `repo/content-creator/creates/{id}/brief-research`,
and `GccCreateRepository.cs:126` implements it as:

```
FirstOrDefaultAsync → mutate entity → Update → SaveChangesAsync
```

Whole-column replacement. No row lock, no concurrency token, no JSON merge — **last writer wins**.
Partners being sequential makes a single generate safe on its own, but two generates on one create, or
a generate racing the brief-research PATCH the frontend sends on every brief save, silently drops
entries. The brief save uses the *same endpoint* and the same whole-column replacement.

**Bank it as its own row, keyed `(createId, partnerHost)`.** Each partner's write touches only its own
row, so collisions are impossible by construction rather than by narrow timing. It also makes the
digest comparison an indexed lookup instead of deserialising a growing JSON blob on every partner, and
keeps `ResearchJson` — which `GccController.cs:129` returns whole in the create GET the workspace loads
on mount — from accumulating five extraction documents.

This costs a migration in GeekRepository, which is why it was avoided first. "No schema change" was
buying a lost-update bug.

## The stamp

A cache that reuses stale extraction is worse than no cache: the tool page would be grounded in last
week's pages with nothing on screen saying so.

**It cannot be the crawl run id.** `AGENTS.md`: a re-crawl *reuses* the same run id — the slot
`(ownerUserId, crawlType, seedKey)` owns one run and `ClearRunCrawlDataAsync` refills it in place. A
run-id stamp would match forever and never re-extract.

**It cannot be the page count or URL set.** A re-crawl of the same site produces the same URLs with new
content.

So it is a **content digest**: SHA-256 over the slice's pages, sorted by `Url`, each contributing its
URL and its paragraph text. `GccQuoteablePage:83` carries both. Identical pages → identical digest →
reuse; any change to any page's text → re-extract.

**Key the row by the digest, not only by the create.** Review's closing point, and it is right: the
digest is a function of the crawl pages alone, so it is identical across every create on the same
partners. Keyed per create, ten creates on the same five partners still pay 108 × 10 calls. Keyed by
digest, the second create onward is free. Keep `createId` on the row for traceability, but let the
lookup be `(partnerHost, digest)`.

## Read and write

Both in the pre-flight, where the calls happen:

- **Read** in `AssessPartnerToolReadinessAsync` (`:532`), before `ExtractFromPagesAsync`. On a digest
  hit, use the banked document and make no provider call.
- **Write** after each partner completes, not at the end of the generate — so a run that later dies on
  a `429` still banks what it paid for. That is what happened twice on 2026-10-03, and it is the
  property the separate-row design exists to make safe.

## Two rules that decide whether this helps or hurts

1. **Bank successes, never failures.** That day's 16 failed pages were a draining balance, not thin
   content. Freezing them in would make a billing incident a permanent property of the partner. A
   failed page is simply absent and is attempted again.
2. **Say when it was reused.** A silent cache is how a stale result becomes invisible. The readiness
   line must distinguish "extracted now" from "reused banked extraction".

## Files

| File | Change |
|---|---|
| `GeekRepository` migration + entity + repository | new table keyed `(partnerHost, digest)`, carrying the extraction document, `createId` and `extractedAtUtc` |
| `GeekRepository/Controllers/ContentCreator/` | read and upsert endpoints for it |
| `GeekAPI/HttpClients/HttpGccRepository.cs` | client methods |
| `GeekAPI/Services/ContentCreator/GccGenerateService.cs` | digest helper; read before `ExtractFromPagesAsync` at `:538`; write after; carry a "reused" flag onto `GccPartnerToolReadiness` |
| `GeekApplication/Models/ContentCreator/GccDtos.cs` | the reused flag |
| `content-creator-v2/src/components/content-creator/CreateDraftWorkspace.tsx` | show it on the readiness line |

## Verification

1. `dotnet build` 0 errors; `dotnet test` ≥1,512 passing.
2. **The digest is the test that matters.** Same pages → reuse with zero provider calls; change one
   paragraph of one page → re-extract. `GccToolPageFanOutFixture`'s `CallCounter` already counts
   extractions: assert 0 on the second run and non-zero after a page edit.
3. A second create on the same partners reuses the first's bank — the cross-create property.
4. A failed page is not banked: fail one page, re-run, assert it is attempted again.
5. Mutation: stamp on run id instead of the content digest, and the changed-paragraph test must fail.
6. Concurrency: two writes for different hosts on one create must both survive — the lost-update bug
   the `ResearchJson` design would have had.

## Not in scope

- **No retry on a failed extraction page.** Jeff: *"I hate hearing 'retry would fix it'."* The failures
  were a draining balance, not transient faults, and a retry would have buried that. Banking successes
  removes the cost pressure that made it tempting.
- The Anthropic `max_tokens` / `stop_reason` work stays separate.

---

## Note on the second review of this plan

A review of the earlier version endorsed the pivot to a separate table — that endorsement stands and is
incorporated above. **Its assessment of the quote guard does not**, and the disagreement is worth
recording because it is a case of two reviews reaching opposite conclusions with different evidence.

It judged the typography folding to pose *"virtually zero risk of false matches"*, reasoning that both
sides undergo the same clean-up. That reasoning is sound and the conclusion is still wrong: the
max-effort review **ran a port of the method** and found `&amp;` is decoded *first* in the chained
`Replace`, so `&amp;nbsp;` double-decodes and a quote omitting three characters the partner published
matches as verbatim. A false positive on the one guard whose whole job is exactness. It also found the
fold runs *before* the decode, so `&mdash;` — the commonest encoding of the dash the change was written
to handle — can never be folded at all.

Reasoning about the design said zero risk; executing it found a false positive. That is the whole
argument for the other review's structural answer: select quotes by `candidate.Id`, which
`GccAngleQuoteProbe` already does, and the fold table stops existing.

One observation from this review is genuinely new and worth keeping: **the dash/math collision.**
`"-2% to -5%"` and `"—2% to —5%"` fold to the same string, so a numeric range and a pair of negative
values become indistinguishable. Harmless in marketing copy, not harmless in a quoted financial claim —
and a good illustration that every entry in a fold table is a semantic judgement that has to be right
for every sentence it will ever see. Another reason not to maintain one.

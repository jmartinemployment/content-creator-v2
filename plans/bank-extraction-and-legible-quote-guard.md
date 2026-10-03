# Two fixes: bank the partner extraction, and make the quote guard legible

## Context

Jeff, 2026-10-03: *"Fix both issues."* Both surfaced while trying to produce five tool pages, and both
cost real money and real time today.

**1. The partner extraction is thrown away after every generate.** ~108 model calls across five
partners, recomputed from scratch on every attempt. Today that was paid for four or five times,
including the runs that completed extraction and *then* died — once on an Anthropic `400`
(`temperature` deprecated), once on an OpenAI `429` (credits exhausted). Each of those had already
done the expensive half and discarded it.

It is not only cost. The extraction is the evidence the page is built from, and it does not survive
the run — so every diagnosis today has been archaeology on a 60-character excerpt. "What spans was the
model actually given?" is currently unanswerable after the fact.

**2. The quote guard refuses pages without showing its working.** Stampli's page was refused:
*"Block quotation 'Only Stampli offers AI-powered dynamic approval workflows bu…' is not a verbatim
span of the partner evidence."* Neither Jeff nor I could tell whether the model invented that
sentence or reproduced it with a straight apostrophe — because `Normalize` folded whitespace only, and
the message printed the rejected quote and nothing it was compared against.

**Intended outcome:** a re-generate reuses extraction it already paid for, and a refusal says which of
the two things happened.

---

## Status: issue 2 is written and uncommitted

The `GccToolQuoteGuard` change is on disk and builds clean (`0 Error(s)`), not yet committed or tested.
It needs tests before it ships. What it does:

- **`Normalize` now folds typography**, not just whitespace: curly quotes → straight, the dash family →
  `-`, non-breaking spaces → space, and the common HTML entities decoded. Both sides of the comparison
  get the same treatment.
- **`NearestCandidate`** finds the supplied span sharing the most leading words (≥3, so "the platform"
  is not a match) and the refusal names it: *"The closest supplied span was … — compare the two"*, or,
  when nothing shares three words, *"No supplied span begins with those words (N were available), so
  this reads as composed rather than copied."*

**This is not loosening the rule.** `’` and `'` are the same published word; verbatim means the same
words, not the same code points. Different words are still refused, which is what the guard is for.

### Still to do for issue 2

Tests in `GeekBackend.Tests/ContentCreator/`, following `GccToolQuoteGuardTests` if it exists:

1. A quote reproducing a candidate with `'` where the span has `’` **passes** — the regression that
   motivated this.
2. Em dash vs hyphen, and `&amp;` vs `&`, likewise.
3. A genuinely invented quote still **fails**, and its message says *"reads as composed rather than
   copied"*.
4. A quote that differs from a real span by wording fails with the *nearest span named*.
5. Mutation: revert `Normalize` to whitespace-only and (1) must fail.

---

## Issue 1 — bank the extraction per create

### Where it goes

`GccResearchDocument` (`GeekApplication/Models/ContentCreator/GccResearchModels.cs:7`) already holds
`SerpIndex`, `Quoteables`, `Sources`, `SerpPages` and the competitor list, and it already documents the
pattern for extending itself: *"Optional with a default, so research written before competitors were
retrieved deserializes as null and round-trips unchanged."*

Add one optional trailing field — a list of banked extractions, one per partner host. No schema change:
it serialises into `create.ResearchJson`, which already has a write path
(`UpdateGccCreateBriefResearchCommand`, used by the keyword-sources endpoints) and a read
(`GccResearchFetchService.Deserialize`).

### The stamp, which is the whole design

A cache that reuses stale extraction is worse than no cache: the tool page would be grounded in last
week's pages with nothing on screen saying so. So each banked entry records what it was derived from,
and is used only on an exact match.

**The stamp cannot be the crawl run id.** `AGENTS.md`: a re-crawl *reuses the same run id* — the slot
`(ownerUserId, crawlType, seedKey)` owns one run and `ClearRunCrawlDataAsync` refills it in place. A
refreshed crawl keeps its id, so a run-id stamp would match forever and never re-extract.

**It also cannot be the page count or URL set.** A re-crawl of the same site produces the same URLs with
new content.

So the stamp is a **content digest**: SHA-256 over the slice's pages, sorted by `Url`, each contributing
its URL and its paragraph text. `GccQuoteablePage` (`:83`) carries both. Identical pages → identical
digest → reuse. Any change to any page's text → different digest → re-extract. This cannot go stale,
which is the only property worth having here.

### Read and write

Both sit in the pre-flight, which is where the calls happen:

- **Read** in `AssessPartnerToolReadinessAsync` (`GccGenerateService.cs:532`), before
  `ExtractFromPagesAsync`. On a digest hit, use the banked document and make no provider call.
- **Write** after extraction completes for a partner, not at the end of the whole generate — so a run
  that later dies on a `429` still banks what it paid for. That is exactly what happened twice today.

### Two rules that decide whether this helps or hurts

1. **Bank successes, never failures.** Today's 16 failed pages were a draining balance, not thin
   content. Freezing those in would make a billing incident a permanent property of the partner, and the
   readiness gate would keep reporting a data shortage long after the cause was fixed. A page that
   failed is simply absent from the bank and is attempted again.
2. **Say when it was reused.** A silent cache is how a stale result becomes invisible. The readiness
   line should distinguish "extracted now" from "reused banked extraction", so the operator can tell a
   cheap run from a real one — and so a wrong result can be traced to reuse rather than to the model.

### Files

| File | Change |
|---|---|
| `GeekApplication/Models/ContentCreator/GccResearchModels.cs` | one optional field on `GccResearchDocument`; a small record for a banked entry (host, digest, document, extractedAtUtc) |
| `GeekAPI/Services/ContentCreator/GccGenerateService.cs` | digest helper; read before `ExtractFromPagesAsync` at `:538`; write after; carry a "reused" flag into `GccPartnerToolReadiness` |
| `GeekApplication/Models/ContentCreator/GccDtos.cs` | the reused flag on the readiness DTO |
| `content-creator-v2/src/components/content-creator/CreateDraftWorkspace.tsx` | show it on the readiness line |

---

## Verification

1. `dotnet build GeekAPI/GeekAPI.csproj` — `0 Error(s)`; `dotnet test GeekBackend.Tests` — 1,512 passing
   now, plus the new quote-guard tests.
2. **The digest is the test that matters.** Same pages → reuse with zero provider calls; change one
   paragraph of one page → re-extract. Use the existing `GccToolPageFanOutFixture`, whose `CallCounter`
   already counts extractions — assert the count is 0 on the second run and non-zero after a page edit.
3. A failed page is not banked: fail one page, re-run, and assert it is attempted again.
4. Mutation: stamp on run id instead of the content digest, and the changed-paragraph test must fail.
   That is the failure mode this design exists to prevent.
5. End to end, once credits are restored: generate, note the extraction call count; generate again
   unchanged and confirm the readiness line says reused and the run is materially cheaper.

## Not in scope

- No retry on a failed extraction page. Jeff, 2026-10-03: *"I hate hearing 'retry would fix it'."* The
  failures were diagnosed as a draining balance, not transient faults, and a retry would have buried
  that. Banking successes removes the cost pressure that made a retry tempting.
- The Anthropic `max_tokens` / `stop_reason` work from the earlier diagnosis stays separate.

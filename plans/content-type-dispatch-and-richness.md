# Content-type dispatch and richness — scoped 2026-09-22, deliberately not started

Found while scoping partner-grounded content generation (`plans/partner-extraction-complete.md`),
then confirmed by direct code inspection. Jeff, 2026-09-22: treat as its own follow-on piece of
work, after the session that found it completes -- email's per-subtype content differentiation is
folded into this plan, not split out.

## Status: 13 of these types are actively disabled (GeekBackend `GccGenerateService.DisabledContentTypes`)

As of 2026-09-22, picking a disabled type refuses server-side (not just hidden in the picker) with
`"Refused: '<type>' is disabled pending a written, approved resolve plan..."`, and every picker in
this repo (`creates/new`, the Tasks panel, `CreateDraftWorkspace`'s Generate checkboxes) shows the
disabled ones greyed out rather than hiding them. This plan *is* that resolve plan for them. Disabled
now: TechArticle, Comparison, Alternatives, CaseStudy, Guide, Listicle, Service, Local, Whitepaper
(Stages 0/2/3), LinkedInDocument (Stage 4), EmailNewsletter, EmailStoryNurture, EmailTransactional
(Stage 1). Not disabled: Pillar, Blog, Tool (real, independent generators), Email — cold outreach
(the one email variant genuinely implemented), Social, Ads, standalone Image prompt (never flagged
as broken). A type only becomes selectable again once its stage below actually ships, not before --
enabling any of these in the picker ahead of that is exactly the gap this plan exists to close.

## Shared architecture every new type below should follow

Every type this session actually built (pillar, blog, Stage 6's lede fix, the tool-page grounding)
converged on the same shape, and it's the right default for everything in Stages 2-4 rather than
inventing a new pattern per type:

1. A fixed or advisory outline (`PillarOutline`-style constant, or an "advisory... you may refine"
   list like blog's).
2. A dedicated `BuildXBodyPrompt` (and `BuildXLedePrompt` if the opening needs its own framing) on
   `IContentPromptBuilder`, returning the shared `SectionsArrayJsonContract` shape.
3. `LlmResponseJsonParser.ParseSections` → `ContentDocument` → `ContentGuardrail.Apply` →
   `JsonSerializer.Serialize(document, CwDocumentJson)` — the same pipeline pillar/blog/tool use,
   never a second ad-hoc string format.
4. Where real evidence exists (partner/competitor extraction, retrieval), wire it in directly —
   `GccGenerateService` calling `GccV2PartnerExtractionService`/`GccCompetitorAnalysisResolver`
   itself, the way `GenerateToolPageAsync` now does — not a new indirection layer.
5. Where a claim needs provenance the way headings did in Stage 2, reuse
   `GccHeadingProvenanceGuard`'s shape (a binary check against the real evidence set for that
   call) rather than a new ad-hoc verification mechanism.

## Stage 0 — Close the reachability gap for real, not just the three found

Only `tool`/`image-prompt`/`email-*` were individually diffed against the live dispatch literals
this session (found via reading, not a systematic sweep). The other 15 `CONTENT_TYPES` values were
never individually re-checked — they're *inferred* safe only because an unmatched value fails open
to the generic branch rather than erroring, which is exactly why the tool/image-prompt bug went
unnoticed as long as it did.

**Work:** diff every value in `src/lib/content-types.ts`'s `CONTENT_TYPES` against every string
literal `GccController.cs`'s switch and `GccGenerateService.GenerateStartingContentAsync` compare
`StartingContentType` against, case-insensitively. Fix any further mismatches found the same way as
`tool`/`image-prompt` (accept both spellings at the check site) rather than renaming either side.

**A real design question this raises, worth deciding before Stage 1 not after:** the fix so far is
`string.Equals(x, "a") || string.Equals(x, "b")` accreting per mismatch. With ~20 types and four of
them already needing two spellings, a small canonical-mapping table (frontend value → dispatch key)
read once at the top of `GenerateStartingContentAsync` would scale better than more inline `||`
clauses. Not required to close Stage 0, but flag it rather than let the pattern silently compound
through Stages 1-4.

## Stage 1 — Email: real differentiation for all four sub-types

`GenerateEmailAsync` is hardcoded to write cold-outreach/sales copy — one system prompt, no branch
on sub-type. Wiring all four `email-*` values to it (Stage 0's fix pattern) would make
`email-newsletter`/`email-story-nurture`/`email-transactional` reach the right method and still get
cold-outreach framing.

**Work:** branch `GenerateEmailAsync` (or a small router in front of it) on which of the four was
requested. Each needs its own tone/length/structure — a newsletter is not a shorter cold email:

| Sub-type | Shape (starting point, not final) |
|---|---|
| `email-cold-outreach` | Existing behavior — 150-200 words, one idea, one CTA. Keep as-is. |
| `email-newsletter` | Warmer, roundup-shaped — likely multiple short items, not one pitch. |
| `email-story-nurture` | Narrative, relationship-building, no hard sell. |
| `email-transactional` | Short, confirmation/status-shaped, minimal-to-no marketing framing. |

**Check before inventing these from scratch:** the restored `plan/content-creator-v2.md` and
`plan/v2-master.md` may describe the original intent behind these four `GeneratedContentType`
values (they predate `content-types.ts`) — read them first rather than designing blind.

## Stage 2 — The cheap tier: outline + prompt only, no new backend wiring

`tech-article`, `guide`, `listicle`, `service`, `local`, `whitepaper`, `case-study`, `social` — each
needs a dedicated outline and system prompt, no new evidence source. Rough shape per type, to
refine, not to build unexamined:

- `guide` — numbered/sequential steps.
- `listicle` — numbered or bulleted items, each substantive, not filler.
- `case-study` — challenge / approach / result narrative arc.
- `service`, `local` — offering-shaped: what it is, who it's for, proof, CTA; `local` adds
  area-served/local-proof framing `pillar`/`blog` don't carry today.
- `tech-article`, `whitepaper` — longer-form, closer to pillar's own shape than to blog's.
- `social` — **open question, not yet resolved:** `CONTENT_TYPES`' single `social` value names no
  platform, but the live `GenerateSocialPostAsync` is already platform-specific (`"linkedin"` /
  `"facebook"`, reached today only via the separate `GCC_OUTPUT_TYPES` multi-select vocabulary).
  Decide whether selecting "Social" as a *starting* type should prompt for a platform, default to
  one, or generate platform-agnostic copy the operator adapts — don't build against a guessed
  answer.

Suggest building one at a time in whatever priority order Jeff cares about — this session has no
usage data to prioritize by itself.

## Stage 3 — Comparison and Alternatives: reuse the extraction already live

Both are exactly what `plans/partner-extraction-complete.md` §4/§5 and
`plans/competitor-extraction-complete.md` spec in field-level detail:

- **Comparison** — `standardized_feature_id` / `capability_payload` / `normalized_cost` per tool,
  partner rows from `GccV2PartnerExtractionService.Comparisons`, rival rows from competitor
  extraction/`GccCompetitorAnalysisResolver`'s headings.
- **Alternatives** — `trigger_deficit` / `recommended_swap` / `pivot_copy`, the
  competitor-deficit-to-partner-swap join `GccV2PartnerAlternativesJoin` models in the dormant
  pipeline; a live-path equivalent needs building the way `GccHeadingProvenanceGuard` was Stage 2's
  live-path equivalent of the same "Coverage Gate" idea.

**A real architectural gap this surfaces, not yet solvable by prompt work alone:** `ContentDocument`
has no table/row node type. `AGENTS.md` already flags this precisely — the corpus's `row` block
kind "has no node type, so its cells are joined rather than dropped" (`GccCorpusBlockMapper`,
Stage 4). A Comparison piece whose entire value is a side-by-side table, rendered instead as joined
prose, loses the thing that makes it a comparison. **Decide this before building Comparison, not
after:** either add a `TableParagraph` (mirroring the corpus's own missing 8th block kind, the way
`QuoteParagraph`/`CodeParagraph`/`DefinitionParagraph` were added in Stage 4), or explicitly accept
a prose-only comparison as the v1 shape and say so.

`GccV2PartnerExtractionService`'s extraction and the live grounding call pattern (`ca6ae95`) already
exist — this stage is wiring the same data into a new prompt shape, not building extraction again.

## Stage 4 — Thinnest spec, scope before estimating

`ads`, `linkedin-document` — neither has a detailed spec restored or found this session, and `ads`
gets no content-type-specific treatment today: `BuildConsultantAppendix` (the one thing that could
be mistaken for ads-specific handling) is gated on the brief's `toneOfVoice`/`angle`, not on content
type — checked directly, 2026-09-22, it applies identically to any type whose brief asks for
`consultant_professional` tone or `ultimate_guide` angle. `linkedin-document` ("PDF / LinkedIn
document") is structurally the most different from everything else here — closer to a slide/carousel
document than an article — and likely needs real design work, not just a new prompt, before it's
buildable at all.

## Not started

Nothing in this plan has been built. This document exists so the next session (or this one, later)
starts from an accurate map instead of re-deriving the reachability bug or re-discovering which
types are actually differentiated.


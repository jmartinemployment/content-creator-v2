# Content-type dispatch and richness — scoped 2026-09-22, deliberately not started

Found while scoping partner-grounded content generation (`plans/partner-extraction-complete.md`),
then confirmed by direct code inspection. Jeff, 2026-09-22: treat as its own follow-on piece of
work, after the session that found it completes.

## Two separate problems, not one

**1. A reachability bug** — the frontend sends values the live dispatch code never matched.
**2. A richness gap** — most of the 20 starting content types produce identical generic content
regardless of which one is selected, reachability aside.

Fixing (1) without (2) means a type routes to the right place and gets the wrong content anyway
(the email case, below). Both matter; they are not the same fix.

## The reachability bug — origin, and where it stands

`src/lib/content-types.ts` (`CONTENT_TYPES`, 20 kebab-case values — `tool`, `image-prompt`,
`email-cold-outreach`, etc.) is the **starting**-type picker, added 2026-09-16 ("derived from real
code" per its own comment) but cross-checked only against the backend's `GeneratedContentType`
*enum names*, never against the actual string literals `GccGenerateService`/`GccController`
compare `StartingContentType` against.

`src/services/gcc-api.ts`'s `GCC_OUTPUT_TYPES` (camelCase — `techArticle`, `imagePrompt`, `email`,
`linkedIn`, `aiTool`) is a **separate, older** vocabulary for the multi-output/repurpose flow, and
matches what the server's dispatch code actually expects. It was never the problem.

Confirmed mismatches between `CONTENT_TYPES` (what a real create actually sends) and the live
dispatch literals in `GccGenerateService.GenerateStartingContentAsync`:

| Frontend sends | Backend checked for | Status |
|---|---|---|
| `tool` | `aiTool` | **Fixed** `b024ca3` — both spellings now accepted |
| `image-prompt` | `imagePrompt` | **Fixed** `b024ca3` — both spellings now accepted |
| `email-cold-outreach` / `email-newsletter` / `email-story-nurture` / `email-transactional` | `email` (controller switch case) | **Not fixed** — see below, routing alone isn't the real fix here |

Before the two fixed cases: selecting "Tool page" silently skipped the dedicated
`GenerateToolPageAsync` path — including this session's own partner-grounding work
(`ca6ae95`), built correct but unreachable until `b024ca3` closed the gap. Same for image prompts.

**Method for finding the rest, if any remain:** diff every `value` in `CONTENT_TYPES` against every
string literal `GccController.cs`'s switch and `GccGenerateService.GenerateStartingContentAsync`
compare against, case-insensitively. Only `tool`/`image-prompt`/`email-*` were checked directly
this session — the other 15 values were not individually re-verified against the live dispatch
code, only inferred as reaching the generic fallback (which is default-case, so any unmatched
value lands there safely — a missed dedicated case fails open to generic content, not to an
error, which is exactly why this bug went unnoticed).

## Why email needs more than a routing fix

`GccGenerateService.GenerateEmailAsync` is hardcoded to write "cold outreach / sales emails" —
one system prompt, one framing, no branch on sub-type. Routing all four `email-*` values to it
(the same one-line fix as tool/image-prompt) would make `email-newsletter`, `email-story-nurture`,
and `email-transactional` all arrive at the right method and still get cold-outreach copy — wrong
content, just reachable now instead of unreachable. The real fix needs `GenerateEmailAsync` (or a
router in front of it) to branch on which of the four was requested, each with its own tone/length/
structure — newsletter reads nothing like a transactional confirmation.

## The richness gap — what's actually differentiated today

Only **pillar**, **blog**, **tool**, and **image-prompt** have real type-specific generation.
Everything else routes to `GenerateStartingContentAsync`'s fallback branch: a hardcoded 3-heading
outline (Overview / Key considerations / Next steps), one generic system prompt, regardless of
which of these is selected:

- `tech-article`, `comparison`, `alternatives`, `case-study`, `guide`, `listicle`, `service`,
  `local`, `whitepaper`, `social`, `ads`, `linkedin-document`
- `email-cold-outreach` reaches real email copy only once the routing above is fixed; the other
  three email types would still be wrong-shaped even then, per above.

## Three tiers, for whoever scopes the real build

**Cheap — prompt + outline work only, no new backend wiring.** Each of these is close to what
pillar/blog/tool already do: a dedicated method (or a branch inside one), its own outline shape,
its own system prompt tone/length/structure. No extraction, no new evidence source.
`tech-article`, `guide`, `listicle`, `service`, `local`, `whitepaper`, `case-study`, `social`, and
the 3 non-cold-outreach email sub-types.

**Medium, but real groundwork already exists — reuse, don't rebuild.** `comparison` and
`alternatives` are exactly the content types `plans/partner-extraction-complete.md` §4/§5 and
`plans/competitor-extraction-complete.md` spec in field-level detail — `Comparison`
(`standardized_feature_id`/`capability_payload`/`normalized_cost`) and `Alternatives`
(`trigger_deficit`/`recommended_swap`/`pivot_copy`, the `DeficitRouter` competitor-to-partner-swap
join). `GccV2PartnerExtractionService`'s extraction and `GccGenerateService`'s live grounding call
(`ca6ae95`) already produce this data for tool pages — building comparison/alternatives means
wiring the same extraction into a new prompt shape, not starting from nothing.

**Thinnest spec, scope first.** `ads`, `linkedin-document` — neither has a detailed spec restored
or found this session; scoping what "done" looks like for either comes before estimating effort.

## Not started

Nothing in this plan has been built. This document exists so the next session (or this one, later)
starts from an accurate map instead of re-deriving the reachability bug or re-discovering which
types are actually differentiated.

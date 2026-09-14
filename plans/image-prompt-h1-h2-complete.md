<!-- e6b2fc28-c800-43bc-84fe-4ec0d8c7f052 -->
---
todos:
  - id: "unify-spawn"
    content: "Unify BuildTargets: H1+H2 for all parents including tool; drop tool single-companion"
    status: completed
  - id: "registry-export-tests"
    content: "Align LongFormTypes helper, export folders, spawn tests (tool first-class)"
    status: completed
  - id: "docs-copy"
    content: "Doc/UI copy: tools = partners; image prompts H1+H2 for all parent types"
    status: completed
isProject: false
---
# First-class H1/H2 image prompts for all types (tools included) — complete

**Status: Complete** — GeekAPI `GccV2ImagePromptSpawnService` / `GccV2LongFormTypes.UsesHeroAndSectionImagePrompts` (2026-09-14). Tools = partners; every parent type (including `tool`) gets H1/hero + non-FAQ H2 spawn. Never spawn from `image-prompt`. Jeff signed-in Canvas smoke remains master-plan §7 (not an eng code gap).

## Product correction (shipped)

**Tools = partners = what you sell.** Prior behavior: article-like types got hero + per-section prompts, but `tool` only got **one** companion. **Shipped:** `tool` uses the **same** H1 + H2 spawn path as pillar/blog/etc. via `AddH1AndH2Targets`.

## Goal

After any parent Create job (except `image-prompt` itself) reaches `ready`, spawn sibling `image-prompt` jobs for:

1. **H1 / hero** — document/job title (one target)
2. **Each H2** — every body section with tag `h2` (missing tag treated as H2 for backward compat)

**Parent types (all first-class):**  
`blog`, `pillar`, `tool`, `comparison`, `case-study`, `guide`, `alternatives`, `tech-article`, `listicle`, `service`, `local`, `whitepaper`, `email`, `social`, `ads`, `linkedin-document`

**Never spawn from** `image-prompt` (no recursion).

**FAQ:** keep excluding FAQ H2s via `PillarSectionClassifier.IsFaqSectionTitle` (current behavior).

## Implementation (GeekBackend) — Done

Primary: [`GccV2ImagePromptSpawnService.cs`](file:///Users/jeffmartin/development/GeekBackend/GeekAPI/Services/ContentCreatorV2/Jobs/GccV2ImagePromptSpawnService.cs)

1. Done — spawn gated by `UsesHeroAndSectionImagePrompts` (includes `linkedin-document`).
2. Done — single path for all parents; tool single-companion removed.
3. Done — `AddH1AndH2Targets`: order 0 `{sourceType}-hero`; distinct body H1s; non-FAQ H2s (missing tag = H2).
4. Done — `GccV2LongFormTypes.UsesHeroAndSectionImagePrompts` includes tool + all parents; `BuildTargets` wired through it.
5. Done — export folders: `tool` sections + `linkedin-document` / `-hero`.
6. Done — `GccV2ImagePromptSpawnTests` (tool first-class, pillar/blog FAQ skip, channels, zero for image-prompt).

## Frontend / docs (light) — Done

- Canvas / Create copy: all parent types including Tool get H1 + H2 image prompts; tools = partners.
- master-plan + plans/README pointer.

## Verify

| Check | Status |
|-------|--------|
| Tool: H1 + multiple H2s (not single-only) | Done — unit `BuildTargets_tool_is_first_class_hero_plus_h2s` |
| Pillar/blog: hero + H2s, FAQ skipped | Done — unit tests |
| email/social/ads/linkedin-document: hero min; H2s when present | Done — unit tests |
| image-prompt parent: zero spawn | Done — unit test |
| Re-spawn idempotent | Done — existing `(sourceJobId, sourceType, order)` skip path unchanged |
| Deploy GeekAPI (Railway) | Done — `railway up` production (2026-09-14) |
| Deploy phi copy (Vercel) | Done — production when copy changed |
| Signed-in Canvas smoke (Tool multi-H2 tabs) | Jeff §7 — not an eng gap |

## Out of scope

- Actual image generation (prompts only)
- H3+ prompts
- Changing FAQ exclusion
- Geek IQ empty-state / attachment `not_ready` work

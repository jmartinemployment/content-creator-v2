# Where things stand — 2026-10-03

I am implementing Content Creator version one.

**This file goes stale faster than anything else here.** The version it replaced was dated
2026-09-17 and still described Site Analyzer, an `/app/site-analyzer` → `/app/create` rename and an
uncommitted seed-validation branch — none of which existed any more. If a claim below cannot be
re-checked in ten seconds, it does not belong in this file. Authority is [`AGENTS.md`](AGENTS.md).

## Content is being produced

All three enabled types — Pillar, Blog, Tool — generate and export. Tool fans out one page per
usable declared partner, with a pre-flight that refuses a partner by name rather than silently
producing fewer pages.

## Shipped today

| What | Where |
|---|---|
| Practical client diagnosis as the CTA | brief field → `ClosingCallToActionInstruction`; reaches pillar, blog and tool |
| Writing model switchable per generate | Stage 2 picker; **writing only** — extraction stays on `LlmProviders__DefaultProvider` |
| "Provided by" on each draft | provider stamped into the version's `MetadataJson` at `PersistOneAsync` |
| Tool FAQ moved off the cheap model | `BuildToolFaqSectionPrompt` was `Utility`; it ships on the page, so it is `Writing` |
| No hardcoded models | all three providers take their model from config and refuse when it is unset |
| Lede prompt no longer offers an angle as a `ledeType` | the `problem_solution` crash |

## The cleanup, 2026-10-03

About **19,000 lines** removed across both repos — see
[`plans/remove-unwired-code.md`](plans/remove-unwired-code.md) for the method and the per-phase
verification.

- 9 components with no importer (1,888 lines), `content-writer-api.ts` (655), `/app/creates/*` (584),
  12 dead `gcc-api` functions, 6 brief fields nothing read
- 12 `GccController` routes nothing reached; 20 `ContentCreatorV2` controllers (7,392) and the
  services they were holding up (~4,400)

**Kept on purpose, and both look deletable:** `creates/{id}/keyword-sources`, whose backend still
reads uploaded SERP pages into the prompt but has no UI; and `GccV2WriteService` + `Carousel/`, the
dormant writer and the LinkedIn deck's basis.

## Known open

- **`GccV2SiteHierarchyFromCrawl.Build` now has no caller.** Its only one was the `hierarchy-match`
  route, deleted because no frontend called it — but `AGENTS.md` describes it as the project-site
  grounding read path. Either the path was never wired or the doc is aspirational; it is kept
  pending that call.
- **`GeneratedByModel` stores the provider name**, not the model (`GccController`). Fine while one
  model is configured per provider; wrong the moment two Anthropic models are compared.
- **No DI startup validation.** `Program.cs` sets no `ValidateOnBuild`/`ValidateScopes`, so a
  registration whose dependency is missing fails at first request rather than at boot.
- **`GEEK_SEO_API_URL`** is set in Railway and read by nothing; Geek-SEO is off Railway.
- `globals.css`: `--foreground` is `var(--gcc-ink)`, the same `#0b162a` the project page uses as its
  background, so `text-foreground` is invisible there.

# Where things stood — 2026-10-03

I am implementing Content Creator version one.

**Superseded for state by [`HANDOFF.md`](HANDOFF.md) (2026-10-06).** What is deployed, what is open
and how to check the live app are there; this file is the record of 2026-10-03 and 2026-10-04, kept
for its "Known open" list and for the cleanup and code-review record below it. Of the open items,
three were re-checked on 2026-10-06 and are still open: no `ValidateOnBuild` in `Program.cs` and
`GeneratedByModel = llmType.ToString()` (`ContentGenerationOrchestrator.cs:416`) at GeekBackend
`5671288`, and `--foreground: var(--gcc-ink)` at `globals.css:266`. The `crawl_pages.Html` question
and the `GEEK_SEO_API_URL` variable were not re-checked. Authority for rules is [`AGENTS.md`](AGENTS.md).

**This file goes stale faster than anything else here.** The version it replaced was dated
2026-09-17 and still described Site Analyzer, an `/app/site-analyzer` → `/app/create` rename and an
uncommitted seed-validation branch — none of which existed any more. If a claim below cannot be
re-checked in ten seconds, it does not belong in this file.

## The project is the unit — 2026-10-04

The brief, Generate and the drafts belong to the project and are addressed by its id alone; no create
is visible anywhere. The brief is written by one Save button and nothing about it is kept in the browser. Detail and the
rule: [`AGENTS.md`](AGENTS.md), "The project is the unit". It depends on GeekAPI's project routes in
[`plans/project-api-contract.md`](plans/project-api-contract.md).

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

About **19,000 lines** removed across both repos. The method and the per-phase verification are in
the retired plan `remove-unwired-code.md`, deleted from `plans/` on 2026-10-08 and kept in git history.

- 9 components with no importer (1,888 lines), `content-writer-api.ts` (655), `/app/creates/*` (584),
  12 dead `gcc-api` functions, 6 brief fields nothing read
- 12 `GccController` routes nothing reached; 20 `ContentCreatorV2` controllers (7,392) and the
  services they were holding up (~4,400)

**Kept on purpose, and both look deletable:** `creates/{id}/keyword-sources`, whose backend still
reads uploaded SERP pages into the prompt but has no UI; and `GccV2WriteService` + `Carousel/`, the
dormant writer and the LinkedIn deck's basis.

## The code review, and what it cost

A max-effort review of the cleanup returned 15 findings. One was a live incident: `363200e` deleted
twelve `[Http*]` attributes and only three method bodies, leaving nine actions routable with no verb,
so every request to `/api/geek-content-creator` resolved as `AmbiguousMatchException` — a 500 on the
API's base path, in production, **with 1,512 tests green**. Fixed in `227edea`; a route-shape test now
exists (`a2f4339`) and the lesson is recorded in `.cursor/rules/no-unwired-code.mdc`.

Also fixed from that review: a zero-page partner masking a provider fault and a footer contradicting
its own headline (`b54ece8`); Revise silently rewriting an Anthropic draft through OpenAI and dropping
the provider stamp (`29706ed`, `f8eb318`) — making `provider` required surfaced **two more** broken
call sites the review had not found; the diagnosis instruction reaching all seven pillar sections
instead of the closing (`b5b4a6b`); two fail-open provider paths (`816cda8`); two model-resolution
sites bypassing the guard (`7962d79`); and the restored `ApiKeyMiddleware` auth test plus deletion of
the unreachable GitHub skill importer (`acc3a09`).

**The pattern worth remembering** is not any single defect. Four times that day the correct mechanism
already existed in the repo and a new one was written instead — `BatchClosingInstruction`,
`GccAngleQuoteProbe`'s id-based quote selection, an export-safety assertion written hours earlier, and
`ProviderModelGuard`. Each shortcut cost more than the work it avoided.

## Known open

- **Nothing in the live path reads `crawl_pages.Html` — ~98% of a 93 GB corpus.** Verified
  2026-10-03 across GeekAPI and Geek-Crawler-Rag: the project-site reader is blocks-only by its own
  doc, grounding goes through the RAG client, the two classes that still read `Html` are reachable
  only from the dormant v2 cluster, and RAG *projects* the field in its Mongo queries without
  consuming it. Not acted on — dropping a column against a live corpus is irreversible and is a
  decision, not a doc edit. See `AGENTS.md` § Crawl types.
- **`GeneratedByModel` stores the provider name**, not the model (`GccController`). Fine while one
  model is configured per provider; wrong the moment two Anthropic models are compared.
- **No DI startup validation.** `Program.cs` sets no `ValidateOnBuild`/`ValidateScopes`, so a
  registration whose dependency is missing fails at first request rather than at boot.
- **`GEEK_SEO_API_URL`** is set in Railway and read by nothing; Geek-SEO is off Railway.
- `globals.css`: `--foreground` is `var(--gcc-ink)`, the same `#0b162a` the project page uses as its
  background, so `text-foreground` is invisible there.

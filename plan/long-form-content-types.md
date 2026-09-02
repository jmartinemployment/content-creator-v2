# Long-form content types (gcc-v2)

Canonical registry: `GeekBackend/GeekAPI/Services/ContentCreatorV2/ContentTypes/GccV2LongFormTypes.cs`  
Phi UI: `src/app/creates/content-types.ts`

All types below use the standard pipeline: **PLAN → outline approval → section WRITE → VALIDATE → REPAIR → export**. They are not short-form (`email`, `social`, `ads`, `image-prompt`).

## Type catalog

| `contentType` | Tier | Outline template (default) | WRITE path | FAQ | Export folder | CMS |
|---------------|------|----------------------------|------------|-----|---------------|-----|
| `pillar` | — | site hierarchy or narrative H2s | pillar | yes | `use-cases/` | yes |
| `blog` | — | site hierarchy or narrative H2s | blog | yes | `blog/` | yes |
| `tool` | — | overview + tools index | tool | no | `tools/` | yes |
| `comparison` | 1 | criteria → one row per option → verdict | pillar | yes | `comparison/` | yes |
| `case-study` | 1 | context → challenge → approach → implementation → results → lessons | pillar | optional | `case-studies/` | yes |
| `guide` | 1 | prerequisites → steps → faq | blog | yes | `guides/` | yes |
| `alternatives` | 1 | why alternatives → one per partner tool → faq | pillar | yes | `alternatives/` | yes |
| `tech-article` | 2 | architecture / implementation H2s | pillar | yes | `tech-articles/` | yes |
| `listicle` | 2 | intro → numbered rows → verdict | blog | yes | `listicles/` | yes |
| `service` | 2 | offer → deliverables → process → proof → CTA | pillar | no | `services/` | yes |
| `local` | 3 | service area → local proof → local FAQ | pillar | yes | `local/` | yes |
| `whitepaper` | 3 | exec summary → sections → methodology → findings → CTA | pillar | no | `whitepapers/` | **export-only** |

**Alternatives vs tool:** `alternatives` is a narrative page only — it does **not** auto-spawn partner tool jobs. Full partner pages remain `tool` under Also draft.

## Research hooks

| Type | Research |
|------|----------|
| `comparison`, `alternatives` | Partner + competitor Geek-Crawler reads; missing seeds **warn and skip** (`partnerResearchWarnings[]`) |
| `local` | Geek-Crawler `crawlType: local` for project site URL + optional `localBusinessUrls[]` in brief |
| Others | Project-site crawl + hierarchy plan as today |

## Image-prompt spawn (§3.1)

All article-like long-form types (except `tool`) get **hero + per-H2** prompts (FAQ excluded), same as pillar/blog. Source types use `{contentType}-hero` and `{contentType}` for section rows. Export folders mirror type (`image-prompts/comparison/`, etc.).

## JSON-LD

Built at job `ready` via `GccV2JsonLdBuilder` and persisted on `ResultJson.jsonLdSchema`:

- Article-like (pillar, comparison, case-study, alternatives, tech-article, service, local, whitepaper) → `TechnicalArticle`
- Blog-like (blog, guide, listicle) → `BlogPosting`
- Tool partner pages → `SoftwareApplication`; overview → `TechnicalArticle`

## Re-Purpose

All long-form types plus `email`, `social`, `ads` are valid Re-Purpose sources (`GccV2RepurposeSourceTypes`, `repurpose-channels.ts`).

## LinkedIn document carousel (PDF)

Not a long-form web page — export-only channel type. See [`linkedin-carousel.md`](./linkedin-carousel.md).

- **Canvas:** Generate carousel PDF from any ready long-form tab  
- **Also draft:** `linkedin-carousel` spawns after the first long-form job on the create reaches `ready`  
- **Export:** `social/linkedin/carousels/{slug}.pdf` + caption + slides JSON  

## Phi operator notes

- **Primary draft** dropdown lists all long-form types; **Also draft** offers the remaining long-form types plus email/social/ads/**LinkedIn carousel**.
- Amber banner for `partnerResearchWarnings` appears in create detail when external partner/competitor/local crawls are missing.
- Local crawls are started in **Geek-Crawler** (`crawlType: local`), not from Content Creator.

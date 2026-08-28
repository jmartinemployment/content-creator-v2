# v2 vs Content Writer (workflow) — Discrepancies

**Path:** `/Users/jeffmartin/development/content-creator-v2/plan/workflow-discrepancies.md`  
**Status:** Working audit (Aug 2026). Not part of the shipping plan until gaps are triaged into `v2-master.md`.

**Compared against:** GeekBackend workflow engine — `ContentGenerationOrchestrator`, `HtmlExportService`, `ToolPageGenerator`, `SchemaBuilders`, `ContentDocumentText` (`/Users/jeffmartin/development/GeekBackend`).

**v2 surface:** `GeekAPI/Services/ContentCreatorV2/*`, phi BFF (`content-creator-v2`).

**Related:** [`v2-master.md`](./v2-master.md) (what ships), [`executor.md`](./executor.md) (isolation rules).

---

## Intentional v2 differences (keep)

| Area | Workflow (Content Writer) | v2 target |
|------|---------------------------|-----------|
| Image prompts | One batched LLM call after blog; `GeneratedContent` rows | One `image-prompt` **job** per hero/section/companion; spawn when **each** source job hits `ready` ([`v2-master.md` §3.1](./v2-master.md)) |
| Image prompt FAQ | All top-level section headings get prompts (includes PAA H2) | **Exclude** `People Also Ask` / `job: "faq"` |
| Generation UX | Single project, step buttons | Multi-job create; PLAN → outline gate → VALIDATE → REPAIR per long-form job |
| Ads | Not in workflow export | `ads` Also-draft type + export path |
| Social export | `social/facebook` + `social/linkedin` | LinkedIn path only today (`social/linkedin`) |
| Editorial loop | Review optional before export | VALIDATE → REPAIR on long-form; ship-ready on `ResultJson` |

---

## Export & HTML

| Feature | Workflow | v2 today | GeekBackend reference |
|---------|----------|----------|------------------------|
| JSON+LD in `.html` | `TechnicalArticle` / `BlogPosting` / `SoftwareApplication` embedded via `SectionHtmlRenderer` | `jsonLdSchema: null` always | `GccV2HtmlExportService.cs` L81; `HtmlExportService.cs` L117–122 |
| `<meta>` summary variants | `excerpt`, `mainSummary`, `heroSummary`, `homeSummary`, `blogSummary`, `advertisingSummary`, `tags`, `date` | `slug`, `department`, `keywords` only | `HtmlExportService.cs` L94–108 |
| `keywords` meta | From WRITE metadata `row.Keywords` | Uses **create title** | `GccV2HtmlExportService.cs` L86 |
| Pillar/blog/tool `.html` body | `SectionHtmlRenderer.RenderDocument` | Same renderer | Parity |
| Canonical URLs | Base URL + department + slug | Same pattern | Parity |
| Image `.txt` folder | `pillar/`, `blog/`, `sections/`, `social/facebook`, `social/linkedin` by row type | All → `image-prompts/sections/` | `GccV2HtmlExportService.cs` L153; `HtmlExportService.cs` L164–168 |
| Image `.txt` body | **Prompt string only** (first text paragraph in body) | Heading + prompt + notes (`PlainTextOf` full document) | `HtmlExportService.cs` L136–139; `GccV2HtmlExportService.cs` L106–114 |
| Export approval gate | Can skip unapproved rows | Exports any job with parseable `ResultJson` | `HtmlExportService.cs` L172–178 |
| Inline `section.ImagePrompt` | Secondary `.txt` per embedded prompt in body tree | Not extracted | `HtmlExportService.cs` L181–211 (rarely populated in workflow) |
| Ads export | N/A | `ads/{slug}.txt` | v2-only |

---

## WRITE — metadata & body

| Feature | Workflow | v2 today | GeekBackend reference |
|---------|----------|----------|------------------------|
| Pillar metadata LLM | `BuildArticleMetadataPrompt` → title, metaDescription, keywords, sectionOutline | Same prompt — **calls shipped** | `GccV2WriteService.cs` `GeneratePillarMetadataAsync` |
| Blog metadata LLM | `BuildStandaloneBlogMetadataPrompt` (or paired with pillar) | Same — **calls shipped** | `GccV2WriteService.cs` `GenerateBlogMetadataAsync` |
| Tool metadata LLM | `BuildToolMetadataPrompt` → 9 summary fields + metaDescription | Reuses `BuildArticleMetadataPrompt`; **no tool metadata call** | `ToolPageGenerator.cs` L344–379; `GccV2WriteService.cs` L411–415 |
| Tool body | Metadata call + `BuildToolBodyPrompt` (~2 LLM calls) | Body call only | `GccV2WriteService.cs` L421–425 |
| Tool summaries on row | `Summary`, `MainSummary`, `HeroSummary`, `HomeSummary`, `BlogSummary`, `ToolPageExcerpt`, `AdvertisingSummary`, … | Not generated | `GeneratedContent.cs`; `ToolPageGenerator.cs` L365–392 |
| Pillar summary variants | Separate LLM call for listing-card copy variants | Not generated | `ContentGenerationOrchestrator.cs` L181–188 |
| Blog → pillar CTA | Appends link to pillar URL in code after body | Not in v2 WRITE | `ContentGenerationOrchestrator.cs` L520–526 |
| FAQ section | Written as part of pillar body flow | Appended post-WRITE / VALIDATE repair | `GccV2WriteService.cs` `AppendFaqSectionAsync` |
| `keywords` persisted | On `GeneratedContent.Keywords` | LLM returns keywords; **dropped** before `ResultJson` save | `GccV2JobWorker.cs` L378–386 |

---

## JSON+LD

| Content | Workflow builder | `@type` | v2 today |
|---------|------------------|---------|----------|
| Pillar | `TechnicalArticleSchemaBuilder` | `TechnicalArticle` (+ optional `SoftwareApplication` in `@graph`) | Not built |
| Blog | `BlogPostingSchemaBuilder` | `BlogPosting` (cites pillar URL) | Not built |
| Tool page | `SoftwareApplicationSchemaBuilder.BuildToolPage` | `SoftwareApplication` | Not built |
| Email / social / ads | None | — | N/A (parity) |

Workflow refreshes pillar JSON+LD after tools and blog complete (cross-links + tool descriptors). v2 has no equivalent — sibling job URLs on the same create are required when implemented.

**Files:** `TechnicalArticleSchemaBuilder.cs`, `BlogPostingSchemaBuilder.cs`, `SoftwareApplicationSchemaBuilder.cs`, `ContentGenerationOrchestrator.cs` L165–177, L292–301, L528–539.

---

## Image prompts

| Feature | Workflow | v2 today | Notes |
|---------|----------|----------|-------|
| **When** | `GenerateImagePromptsAsync` after blog ≥200 words; optional pillar | **Not spawned** — no `GccV2ImagePromptSpawnService` | Plan: spawn per source job `ready` ([`v2-master.md` §5.2](./v2-master.md)) |
| **How many LLM calls** | One batch for all targets | N/A (not implemented) | v2: one call per spawned job |
| **Targets** | `BuildSectionTargets`: heroes + all top-level headings + tool titles | Planned: spawn per §3.1 on job `ready` | v2 plan excludes FAQ H2 |
| **WRITE** | `BuildSectionImagePromptsPrompt` (section-aware) | `BuildStandaloneImagePrompt(topic, notes, null)` | Wrong for spawned jobs |
| **Stored settings** | `ImagePromptMetadata.Serialize` in row `MetaDescription` | Notes as second body paragraph | Pollutes v2 `PlainTextOf` export |
| **Export** | `.txt` prompt only; routed folders | `.txt` but wrong folder + wrong body | See Export table |
| **VALIDATE** | N/A (not in editorial loop) | Skipped — write-only | Matches v2 plan |

**Files:** `ContentGenerationOrchestrator.cs` L764–850; `GccV2WriteService.cs` L577–615; `GccV2TransformController.cs` L102–112.

---

## CMS publish

| Feature | Workflow / CMS data | v2 today | GeekBackend reference |
|---------|---------------------|----------|------------------------|
| Summary slots | Distinct LLM fields per slot | Uses `MainSummary` / slot fields when on `ResultJson`; else `metaDescription` | `GccV2CmsPublishService.cs` |
| `JsonLdOverride` | From schema builders | Built at publish from `ResultJson` or builders | `GccV2CmsPublishService.cs` |
| Job selection | One artifact per content type | **Requires `jobId`** — per active tab | `GccV2PublishController.cs` |
| Intended scope | Pillar/blog/tool CMS upsert; channel types export-only | **Shipped** — `GccV2PublishTypes` scope guard | [`v2-master.md` § Publish triage](./v2-master.md) |
| CMS upsert | Update in place on republish | **Shipped** — publish record → slug → `UpdatePostAsync` | `GccV2CmsPublishService.cs` |

---

## Multi-draft workflow

| Feature | v2 today | Status |
|---------|----------|--------|
| Generate N jobs per create | Shipped | `GccV2Controller.cs` Generate |
| Brand kit cascade to siblings | Shipped | `AcceptBrandKit` |
| Outline approve cascade | **Shipped** | `GccV2OutlineApproval` + `ApproveOutline` |
| Draft tabs for all jobs | Shipped | `page.tsx` |
| Export all ready jobs | **Shipped** — summary header + image-prompt paths | §5.4 |
| Image-prompt auto-spawn | **Shipped** | `GccV2ImagePromptSpawnService` on job `ready` |

---

## `ResultJson` shape

### v2 today (worker)

**After VALIDATE** (`GccV2JobWorker.cs`):

```json
{
  "title": "…",
  "metaDescription": "…",
  "document": { },
  "shipReady": true,
  "outstandingIssues": false,
  "repairAttempts": 0
}
```

**image-prompt (write-only):**

```json
{
  "title": "…",
  "metaDescription": "…",
  "document": { },
  "shipReady": true,
  "outstandingIssues": false,
  "writeOnly": true
}
```

### Workflow `GeneratedContent` (reference)

Persists: `Keywords`, `JsonLdSchema`, summary variants (`Summary`, `MainSummary`, …), `RelatedArticleUrl`, `Slug`, tool-specific fields.

### Likely v2 additions (when gaps close)

| Field | Purpose |
|-------|---------|
| `keywords` | Export `<meta>` + JSON+LD |
| `jsonLdSchema` | Export `<script type="application/ld+json">` + CMS `JsonLdOverride` |
| `imagePromptSection` | Spawn idempotency + section-aware WRITE |
| Tool summary fields | CMS listing cards + export meta |

---

## v1 GCC (`GccGenerateService` / `GccController`) — separate from workflow

v1 Content Creator HTTP API is **not** the same as the workflow export path. Notable v1-only behaviors:

| Area | v1 GCC | v2 |
|------|--------|-----|
| Generate model | Single-shot per content type in one request | Job pipeline per type |
| Image prompts (pillar/blog) | `GenerateSectionImagePromptsAsync` in same generate flow | Planned: spawned jobs ([`v2-master.md` §3.1](./v2-master.md)) |
| Image prompt standalone | `GenerateImagePromptJsonAsync` | `WriteImagePromptAsync` |

Do not treat v1 GCC as the export/metadata source of truth — **workflow `HtmlExportService`** is.

---

## Triage — promoted to `v2-master.md`

| # | Item | Bucket |
|---|------|--------|
| 1 | Outline approve sibling cascade | Multi-draft (§5.1) |
| 2 | Image-prompt spawn + WRITE + `.txt` export | Export (§5.2) |
| 3 | `keywords` + JSON+LD on `ResultJson` + export HTML | Export + CMS |
| 4 | Tool `BuildToolMetadataPrompt` + summary fields | WRITE |
| 5 | Export meta richness | Export |
| 6 | CMS upsert pillar/blog/tool + `JsonLdOverride` + per-job publish | CMS (§5.6) |
| — | email / social / ads / image-prompt | **Export only** — not CMS |

Removed from CMS scope: mapping short-form types to `Blog` posts; “blog-only” publish UI.

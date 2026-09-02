# v2 vs Content Writer (workflow) — Discrepancies

**Path:** `/Users/jeffmartin/development/content-creator-v2/plan/workflow-discrepancies.md`  
**Status:** Working audit (Aug 2026). Not part of the shipping plan until gaps are triaged into `v2-master.md`.

**Compared against:** GeekBackend workflow engine — `ContentGenerationOrchestrator`, `HtmlExportService`, `ToolPageGenerator`, `SchemaBuilders`, `ContentDocumentText` (`/Users/jeffmartin/development/GeekBackend`).

**v2 surface:** `GeekAPI/Services/ContentCreatorV2/*`, phi BFF (`content-creator-v2`).

**Related:** [`v2-master.md`](./v2-master.md) (what ships), [`tool-pages-v2.md`](./tool-pages-v2.md) (tool page target — planned), [`executor.md`](./executor.md) (isolation rules), [`crawl-architecture.md`](./crawl-architecture.md) (external research policy).

---

## External research & outline (Sep 2026 audit)

**Spec authority:** [`crawl-architecture.md`](./crawl-architecture.md) § external research policy.

| Feature | Product spec | Shipped today | GeekBackend / phi reference |
|---------|--------------|---------------|----------------------------|
| External partner lookup | By-seeds only; no full-run pagination | **Yes** | `GccV2GeekCrawlerResearchResolver.ExtractQuoteableFromCrawlerPagesAsync` |
| Partial/failed Geek-Crawler run with seed HTML | Merge and continue | **Yes** | `ffc13ee` |
| Missing / empty external seed | Skip + `partnerResearchWarnings[]`; generate continues | **Yes** | `GccV2GeekCrawlerResearchResolver` warn-and-skip restored |
| Preflight `externalResearchNote` | “Skipped partners; generate still runs” | Copy + behavior aligned | Phi banner active when warnings present |
| Phi amber research banner | Show warnings after generate | UI + backend **Yes** | `create-detail-shell.tsx`, `sessionStorage` |
| Geek-Crawler page-limit / operator config | Out of scope for Creator | N/A | Do not surface in phi or generate errors |
| **Outline PUT save** | Fast persist; no hub replay | **Yes** (`16fb679`) | `PutOutline` — no `OutlineReady` append |
| **Outline regenerate** | Hub `OutlineReady` to replace canvas | **Yes** | `RegenerateOutline` still appends event |
| Hub push after other job events | Best-effort; don’t fail persistence | **Yes** | `GccV2JobEventWriter.TryPushAsync` |

**Triage:** Notify-and-skip restored; tests use `*_warns_and_skips`.

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
| JSON+LD in `.html` | `TechnicalArticle` / `BlogPosting` / `SoftwareApplication` embedded via `SectionHtmlRenderer` | **Yes** — built at job `ready` via `GccV2JsonLdBuilder`, persisted on `ResultJson`, used at export/CMS | `GccV2JobWorker`, `GccV2HtmlExportService` |
| `<meta>` summary variants | `excerpt`, `mainSummary`, `heroSummary`, `homeSummary`, `blogSummary`, `advertisingSummary`, `tags`, `date` | Tool pages + export meta wired; long-form uses `keywords` from WRITE metadata | `GccV2HtmlExportService`, tool WRITE |
| `keywords` meta | From WRITE metadata `row.Keywords` | From `ResultJson.keywords` when present | `GccV2JobWorker`, `GccV2HtmlExportService` |
| Pillar/blog/tool `.html` body | `SectionHtmlRenderer.RenderDocument` | Same renderer | Parity |
| Canonical URLs | Base URL + department + slug | Same pattern | Parity |
| Image `.txt` folder | `pillar/`, `blog/`, `sections/`, `social/facebook`, `social/linkedin` by row type | Per-type folders for long-form heroes/sections (`image-prompts/comparison/`, etc.) | `GccV2HtmlExportService.ImagePromptFolderFor` |
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

## Tool pages (planned — [`tool-pages-v2.md`](./tool-pages-v2.md))

**Target** when Also draft **Tool page** is checked (not shipped):

| | Workflow (v1) | v2 today | v2 target (`tool-pages-v2.md`) |
|--|---------------|----------|--------------------------------|
| Cardinality | N partner pages + hub roundup | **1** job — keyword as faux product | **1** keyword overview + **N** partner pages; **no** hub |
| Tool discovery | SA trees / `HierarchyToolsByHeading` | `recommendedTools` in brief (pillar only) | Same brief data; spawn N partner jobs after pillar `ready` |
| Research | `extractedToolResearchJson` in body prompt | `partnerResearch` on brief; **not wired into tool WRITE** | Per-partner LLM extract from operator URL |
| Metadata | `BuildToolMetadataPrompt` → 9 fields | `BuildArticleMetadataPrompt` stub | Copied tool metadata prompt in v2-owned files |
| Source citation | (implicit in research) | None | `<blockquote cite="{sourceUrl}"><p>…</p></blockquote>` on partner pages only |
| Outbound partner link | On tool page body | None | Optional **Visit {name}** `<a>` on partner pages only |
| Pillar / overview hrefs | On-site `/tools/…` | Pillar: on-site; tool stub: wrong slug | Unchanged pillar rules; overview links to on-site partner slugs |

**Copy rule:** logic copied into `ContentCreatorV2/ToolPages/*` — do not call `IToolPageGenerator` or `IContentPromptBuilder` tool methods.

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
| Tool pages | N pages via `ToolPageGenerator` after pillar | **1** stub tool job (keyword as product) — see [`tool-pages-v2.md`](./tool-pages-v2.md) |
| Image prompts (pillar/blog) | `GenerateSectionImagePromptsAsync` in same generate flow | Spawned jobs ([`v2-master.md` §3.1](./v2-master.md)) |
| Image prompt standalone | `GenerateImagePromptJsonAsync` | `WriteImagePromptAsync` |

Do not treat v1 GCC as the export/metadata source of truth — **workflow `HtmlExportService`** is.

---

## Triage — promoted to `v2-master.md`

| # | Item | Bucket |
|---|------|--------|
| 1 | Outline approve sibling cascade | Multi-draft (§5.1) |
| 2 | Image-prompt spawn + WRITE + `.txt` export | Export (§5.2) |
| 3 | `keywords` + JSON+LD on `ResultJson` + export HTML | Export + CMS |
| 4 | Tool pages v2 — metadata, N partner pages, overview, blockquote cite | WRITE — [`tool-pages-v2.md`](./tool-pages-v2.md) / [`v2-master.md` §5.7](./v2-master.md) |
| 5 | Export meta richness | Export |
| 6 | CMS upsert pillar/blog/tool + `JsonLdOverride` + per-job publish | CMS (§5.6) |
| — | email / social / ads / image-prompt | **Export only** — not CMS |

Removed from CMS scope: mapping short-form types to `Blog` posts; “blog-only” publish UI.

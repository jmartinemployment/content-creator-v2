# PDF as new long-form content type (gcc-v2)

**Origin:** LinkedIn document carousel (`linkedin-carousel` → `linkedin-document`) is the design ancestor — same QuestPDF stack, but carousel is an export-only transform from a ready long-form draft. This plan promotes PDF to a first-class long-form type with its own PLAN → WRITE → VALIDATE → REPAIR → export pipeline.

**Phi UI canonical list:** `src/app/creates/content-types.ts`  
**Backend canonical registry:** `GeekBackend/GeekAPI/Services/ContentCreatorV2/ContentTypes/GccV2LongFormTypes.cs` (per `plan/long-form-content-types.md:4`)

## Goal

Add `pdf` as a native long-form `contentType` that operators can select as **Primary draft** or **Also draft**, goes through the standard outline-gated generation pipeline, and exports a paginated PDF document (A4, QuestPDF) plus HTML fallback — without breaking existing long-form types, the LinkedIn carousel transform, or the short-form Also draft flow.

## Success Criteria

- `CONTENT_TYPES`, `PRIMARY_DRAFT_TYPES`, `ALSO_DRAFT_SHORT_TYPES`/`OTHER_LONG_FORM` updated; `isLongFormContentType("pdf") === true`, `isExportOnlyType("pdf") === true` (export-only like `whitepaper`), `isCmsPublishType("pdf") === false`.
- New create form: Primary dropdown lists PDF; Also draft offers remaining long-form + PDF; helper copy describes PDF; brief → generate creates a `pdf` job.
- Outline editor: `supportsAdvanceOutlineRows("pdf") === true` (add/remove sections before FAQ).
- Job ordering: `GENERATE_TYPE_ORDER` includes `pdf` (after `whitepaper`, before `linkedin-document`); `sortJobs` stable.
- Re-Purpose: `pdf` is a valid source type (same 6 channels as other long-forms).
- Canvas: PDF jobs render document sections, validation report, and export/commit buttons; no LinkedIn carousel confusion on PDF tabs (carousel button remains gated to `isLongFormContentType` — PDF qualifies, but behavior documented).
- Backend (GeekBackend, coordinated): `GccV2LongFormTypes`, outline template, WRITE prompt, VALIDATE word floor, JSON-LD (`TechnicalArticle`), `GccV2HtmlExportService` routes to `pdfs/{slug}.pdf` + `pdfs/{slug}.html` + `image-prompts/pdf/...`, image-prompt spawn (hero + per-H2, excl FAQ).
- Plan docs updated: `long-form-content-types.md`, `v2-master.md` (content types table + export paths), `linkedin-carousel.md` relationship note.
- `npm run build` + `npm run lint` green; manual create → outline approve → ready → export ZIP contains `pdfs/*.pdf`.

## Context And Current Facts

- **Shipped long-form catalog (12 types)** in `src/app/creates/content-types.ts:31` (`PRIMARY_DRAFT_TYPES`): `pillar`, `blog`, `tool`, `comparison`, `case-study`, `guide`, `alternatives`, `tech-article`, `listicle`, `service`, `local`, `whitepaper`. Catalog spec in `plan/long-form-content-types.md:12` with tier, outline template, WRITE path, FAQ, export folder, CMS scope. All use `PLAN → outline approval → section WRITE → VALIDATE → REPAIR → export`.
- **Whitepaper precedent:** `whitepaper` is long-form but `isExportOnlyType() === true` and `isCmsPublishType() === false` (`content-types.ts:110`, `whitepaper` export `whitepapers/` HTML, higher VALIDATE word floor — `new-create-form.tsx:129`).
- **PDF today is NOT a long-form type.** The PDF product is the LinkedIn carousel transform (`plan/linkedin-carousel.md:1`, `canvas.tsx:860` `POST .../transform/linkedin-carousel` → `pdfBase64`); source must be a ready long-form job; Also draft `linkedin-carousel` spawns after first long-form `ready`; export to `social/linkedin/carousels/{slug}.pdf` via QuestPDF 1080×1350 carousel template + caption + slides JSON.
- **Frontend drift (working tree, Sep 2):** `content-types.ts:17`, `job-snapshot.ts:84`, `outline-editor.ts:76` rename `linkedin-carousel` → `linkedin-document` in uncommitted changes while `plan/linkedin-carousel.md`, `long-form-content-types.md`, and the API route keep `linkedin-carousel`. This must be resolved before adding a new `pdf` value to avoid collision on the `linkedin-*` prefix.
- **Outline advance rows:** `outline-editor.ts:76` `supportsAdvanceOutlineRows` enumerates every long-form type (including `whitepaper` + both linkedin values). `job-snapshot.ts:83` `GENERATE_TYPE_ORDER` enumerates order including `whitepaper` + `linkedin-document`.
- **Re-Purpose source types:** `repurpose-channels.ts:14` already includes `whitepaper` and all long-forms as valid sources (same channel mix).
- **Export & CMS buckets:** `v2-master.md:234` — pillar/blog/tool/comparison/etc. are CMS upsert; `whitepaper` is export-only; image-prompts are sidecars. PDF should follow the whitepaper bucket unless product decides otherwise.
- **Backend is out-of-tree:** `GeekBackend` owns `GccV2LongFormTypes.cs`, outline prompt templates, `GccV2WriteService`, `GccV2ValidateService` word floors, `GccV2JsonLdBuilder`, `GccV2HtmlExportService`, `GccV2ImagePromptSpawnService`. Phi change alone is insufficient — backend coordination required.

## Constraints And Non-goals

- **Constraints:** Frontend is Next.js 16.2.12 on `api/geek-content-creator-v2`; do not fork v1 `STARTING_CONTENT_TYPES`; keep free-form `GccV2Create.ContentType` compatibility (no enum lock on API); respect existing long-form outline gate and VALIDATE→REPAIR contract; QuestPDF Community license check persists for the new A4 renderer.
- **Non-goals:**
  - Replacing or removing the LinkedIn carousel PDF transform (1080×1350) — it stays as a separate transform/Also-draft channel; this plan clarifies the relation.
  - Turning PDF into a CMS-publishable web page type (`geek_blog.post_type`) unless product explicitly opts in — default is export-only.
  - PPTX/DOCX outputs — PDF only (QuestPDF) per `linkedin-carousel.md:31` precedent.
  - Client-side PDF editing — Canvas shows editable outline/document; PDF rendering is server-side export/transform.

## Key Decisions

| Decision | Recommendation | Why / rejected alternative |
|----------|----------------|----------------------------|
| **Value string** | `pdf` (`{ value: "pdf", label: "PDF" }`) | Shortest, matches `plan` table kebab style, distinct from `linkedin-document`/`linkedin-carousel` (carousel stays as LinkedIn-specific). Rejected `pdf-document` (redundant prefix) and `document` (too generic, collides with ContentDocument term in `canvas-types.ts`). Keep `linkedin-carousel` as backend route value; alias `linkedin-document` as frontend label if rename lands — do not reuse `pdf` for that. |
| **Long-form vs short-form** | Long-form primary + Also-draft (like `whitepaper`) — `PRIMARY_DRAFT_TYPES` + `OTHER_LONG_FORM` | PDF needs outline gate, section WRITE, VALIDATE; short-form auto-write would skip outline and under-write multi-page report. |
| **CMS scope** | Export-only (`isExportOnlyType true`, `isCmsPublishType false`) — same as `whitepaper` | PDF is a binary asset, not a `geek_blog` web page. Publish path stays `export/html` + commit to `content-writer-output/`; CMS upsert would need fake `post_type`. Revisit only if product wants `pdf` HTML companion published as `Pillar`. |
| **Outline template** | `exec summary → sections → methodology → findings → CTA` variant (whitepaper base) plus optional `cover` block | Reuses proven whitepaper pipeline; whitepaper already higher word floor. Alternative pillar/blog template would under-spec executive framing needed for distributable PDF. |
| **WRITE path** | `pillar` (article-like `TechnicalArticle` JSON-LD) — not `blog` | Consistent with whitepaper (`long-form-content-types.md:12` whitepaper → pillar path, `TechnicalArticle`). Blog-like `BlogPosting` would mislabel formal PDF. |
| **Export folder & artifacts** | `pdfs/{slug}.pdf` (QuestPDF A4), `pdfs/{slug}.html` (HTML fallback for preview/commit), `image-prompts/pdf/{slug}-hero.txt` + `image-prompts/pdf/h2-{slug}.txt` | Mirrors `whitepapers/` but gives PDF its own top-level folder; avoids `whitepapers/` confusion. Carousel stays `social/linkedin/carousels/`. Follows `GccV2HtmlExportService.ImagePromptFolderFor` per-type pattern. |
| **JSON-LD** | `TechnicalArticle` via `GccV2JsonLdBuilder` | Matches whitepaper/article-like types; no new schema needed. |
| **Image prompts** | Hero + per-H2 (excl FAQ), same as pillar/whitepaper (§3.1) | PDF is article-like; `tool` companion-only rule does not apply. |
| **Re-Purpose** | Include `pdf` in `REPURPOSE_SOURCE_TYPES` | Operators will want LinkedIn/X/email packs from a PDF source, same as other long-forms. |
| **Resolve linkedin rename drift** | Commit-or-revert `linkedin-carousel` ↔ `linkedin-document` before landing `pdf` | Prevents `content-types.ts` + `job-snapshot.ts` + `outline-editor.ts` triple drift and plan-doc divergence; `isExportOnlyType` already aliases both as safety (`content-types.ts:110`). |

## Recommended Approach

Introduce `pdf` as the 13th long-form entry, shadowing the `whitepaper` implementation seam — minimal new abstraction, maximal reuse of the long-form pipeline. Keep LinkedIn carousel as the *derived* PDF transform; PDF long-form as the *authored* multi-page document. Frontend leads with registry + UI; backend lands outline/WRITE/VALIDATE/export in the same release train; docs and export contract update in lockstep.

End-state mental model for operators:
- **Generate a PDF** → pick Primary `PDF` (or Also draft `PDF`), approve outline, get paginated A4 PDF + HTML preview.
- **Generate a LinkedIn carousel PDF** → keep `linkedin-document`/`linkedin-carousel` Also draft or Canvas `Generate carousel PDF` from any ready long-form (including the new `pdf` source) — 1080×1350 swipeable, not the A4 report.

## Work Plan

**Phase 0 — Resolve naming drift (pre-req, 0.5 day)**
- Files: `src/app/creates/content-types.ts`, `src/app/creates/job-snapshot.ts`, `src/app/creates/outline-editor.ts`, `plan/*.md`
- Decide: keep `linkedin-carousel` as canonical `contentType` value (route + persisted `contentType`) and use `LinkedIn document` as display label, or rename end-to-end to `linkedin-document`. Either way, make `content-types.ts` + `job-snapshot.ts` + `outline-editor.ts` + `isExportOnlyType` alias + plan docs agree. Do not add `pdf` on top of a half-renamed linkedin value.
- Validation: `grep -rn linkedin-carousel/linkedin-document src/ plan/` returns single canonical value + alias only in `isExportOnlyType`.

**Phase 1 — Phi content-type registry (frontend, 1 day)**
- `src/app/creates/content-types.ts`
  - Add `{ value: "pdf", label: "PDF" }` to `CONTENT_TYPES`.
  - Add same entry to `PRIMARY_DRAFT_TYPES` and to `OTHER_LONG_FORM` (so `alsoDraftOptionsFor` auto-exposes it).
  - `CMS_PUBLISH_TYPES` — leave `pdf` out (export-only).
  - `isExportOnlyType` → include `pdf`.
  - `isLongFormContentType` automatically covers `pdf` via `PRIMARY_DRAFT_TYPES` set — verify.
- `src/app/creates/job-snapshot.ts`
  - Insert `"pdf"` into `GENERATE_TYPE_ORDER` after `"whitepaper"` and before `"linkedin-document"` (or before `"linkedin-carousel"` depending on Phase 0).
- `src/app/creates/outline-editor.ts`
  - Add `t === "pdf"` branch to `supportsAdvanceOutlineRows`.
- `src/app/creates/repurpose-channels.ts`
  - Add `"pdf"` to `REPURPOSE_SOURCE_TYPES`.
- `src/app/creates/brief-catalog.ts` or `new-create-form.tsx` helper
  - Add length band / brief handling if PDF needs distinct band (otherwise reuse `pillar` band); at minimum ensure brief validation does not reject `pdf`.

**Phase 2 — Create flow + Canvas UI (frontend, 1 day, depends on Phase 1)**
- `src/app/creates/new/new-create-form.tsx`
  - Add `case "pdf":` to `primaryDraftHelperCopy` — e.g. `"Paginated A4 report (export-only — PDF in pdfs/ + HTML preview). Pillar-style outline with executive summary. Content Creator renders PDF via QuestPDF on export."`
  - Ensure `alsoDraftOptionsFor(primaryDraft)` correctly hides self and shows PDF when primary is not PDF (already handled by `OTHER_LONG_FORM` filter).
  - If `CmsPublishType` guard exists on form, ensure PDF does not show CMS publish toggle.
- `src/app/creates/canvas.tsx`
  - No new carousel button needed; verify existing `canLinkedInCarousel = status === "ready" && isLongFormContentType(contentType)` now also enables carousel from a `pdf` source (intentional — carousel can be derived from PDF long-form). If undesirable, gate carousel to `contentType !== "pdf"` and document why.
  - Ensure publish button uses `isCmsPublishType(contentType)` — PDF will correctly hide Publish and show Export/Commit only.
  - Tab labels via `labelForContentType` pick up new label automatically.
- `src/app/creates/canvas-types.ts` — no change (document shape shared).

**Phase 3 — Backend contract (GeekBackend, parallel, 2–3 days, owner: GeekAPI)**
- `Services/ContentCreatorV2/ContentTypes/GccV2LongFormTypes.cs` — add `Pdf` entry (tier 3 like whitepaper, export-only).
- Outline service — add PDF template (exec summary → sections → methodology → findings → CTA) reusing whitepaper prompts with PDF-specific instruction tweak.
- `GccV2WriteService` — route `pdf` through pillar WRITE path (or dedicated `WritePdfAsync` if prompt diverges); ensure section `heading` + `BrandKit` + `siteSection` grounding matches whitepaper.
- `GccV2ValidateService` — apply whitepaper word floor to PDF; no FAQ requirement (like whitepaper/service).
- `GccV2JsonLdBuilder` — map `pdf` → `TechnicalArticle`.
- `GccV2ImagePromptSpawnService` — spawn hero + per-H2 (excl FAQ) with `sourceType: "pdf"` / `"pdf-hero"`.
- `GccV2HtmlExportService`
  - Add `ImagePromptFolderFor` → `image-prompts/pdf/`.
  - Export routing: `pdf` → `pdfs/{slug}.pdf` (QuestPDF A4 renderer) + `pdfs/{slug}.html` (existing `SectionHtmlRenderer` for preview).
  - QuestPDF template: A4 portrait, 60pt/80pt safe-zone precedent from carousel but A4 page size, typographic + BrandKit colors v1 (no embedded images), snake_case filename.
  - `ResultJson` → `jsonLdSchema` passthrough.
- Real-time/export API — no new route; existing `GET /export/html` + `POST /export/html/commit` include PDF artifacts; verify ZIP manifest lists `pdfs/`.

**Phase 4 — Docs + operator notes (0.5 day, depends on Phases 1–3)**
- `plan/long-form-content-types.md` — add row: `| pdf | 3 | exec summary → sections → methodology → findings → CTA | pillar | no | pdfs/ | export-only |` plus Research hooks/Image-prompt/JSON-LD rows if PDF diverges.
- `plan/v2-master.md` — update Content types table, Re-Purpose source list, Export (ZIP paths) table, Publish triage (add `pdf` to export-only bucket), and §5 multi-draft notes.
- `plan/linkedin-carousel.md` — add “Related: PDF long-form” note contrasting `pdf` (authored A4 report) vs `linkedin-carousel` (derived 1080×1350 swipeable).
- `architecture.md` § if needed — no change (copy/call/do-not-reuse boundary unchanged).

**Phase 5 — Cleanup (0.5 day)**
- Remove `linkedin-carousel` alias from `isExportOnlyType` once canonical linkedin value is settled.
- Ensure `isExportOnlyType` and `isCmsPublishType` have unit coverage for the new value (or add a simple content-types spec if none exists).

## Validation Plan

| Work unit | Command / check | Expected evidence |
|-----------|-----------------|-------------------|
| Phase 0 drift | `grep -rn "linkedin-carousel\|linkedin-document" src/ plan/` | Single canonical value; plan docs match code; `isExportOnlyType` alias only if intentional |
| Phase 1 registry | `npm run build --webpack` and `npm run lint` | No TS errors; new `pdf` type narrows correctly (`ContentType`, `PrimaryDraftType`) |
| Phase 1 ordering | Unit: `sortJobs([{contentType:"pdf"},{contentType:"pillar"}])` order | `pillar` before `pdf` before `linkedin-document` per `GENERATE_TYPE_ORDER` |
| Phase 2 create flow | Manual: New create → Primary `PDF` → helper copy shows PDF text → Also draft lists other long-forms | Dropdown + copy render; `alsoDraftOptionsFor("pillar")` includes `pdf` |
| Phase 2 outline | Manual: Generate PDF → outline approves → `supportsAdvanceOutlineRows("pdf")` adds/removes section | Advance row inserts before FAQ |
| Phase 2 canvas triage | Manual: PDF job `ready` tab | Export/Commit visible, Publish hidden; Re-Purpose button enabled; carousel button behavior documented |
| Phase 3 backend | Backend tests: `dotnet test` for `GccV2HtmlExportService` + `GccV2ImagePromptSpawnService` | PDF export path `pdfs/{slug}.pdf`, prompt folder `image-prompts/pdf/`, JSON-LD `TechnicalArticle` |
| Phase 4 export E2E | Generate one PDF create (pillar primary + PDF also, or PDF primary) → Export ZIP → `unzip -l` | `pdfs/{slug}.pdf`, `pdfs/{slug}.html`, `image-prompts/pdf/*.txt` present; carousel `social/linkedin/carousels/` unchanged |
| Regression | Existing creates (pillar/blog/tool/whitepaper) generate + export | No change in their ZIP paths or CMS publish behavior |

## Risks / Rollback

- **Naming collision:** Adding `pdf` while `linkedin-carousel`/`linkedin-document` drift is unresolved creates duplicate PDF semantics and `GENERATE_TYPE_ORDER` ambiguity. **Mitigation:** Phase 0 gates Phase 1.
- **Backend drift:** Frontend ships `pdf` but GeekBackend has no `GccV2LongFormTypes` entry → generate 400/500 or silent fallback. **Mitigation:** Feature-flag the Primary option until backend deploy; or keep `pdf` behind `NEXT_PUBLIC_ENABLE_PDF_TYPE` until `GeekAPI` reports `pdf` in its type registry.
- **Export folder confusion:** Operators expect `whitepapers/` vs `pdfs/` distinction. **Mitigation:** Docs + helper copy explicitly state `pdfs/` + `pdfs/*.html` preview; keep whitepaper path unchanged.
- **QuestPDF license:** New A4 template inherits carousel’s Community-license caveat (<$1M revenue). **Mitigation:** Same confirmation gate already in `plan/linkedin-carousel.md:52`; add to this plan’s export section.
- **Rollback:** Revert Phase 1–2 commits (frontend registry + UI) and backend type addition; existing jobs with `contentType: "pdf"` remain in DB but become `labelForContentType` fallback (`"pdf"`); export for those jobs returns 404 until re-added. No data migration needed if caught before GA — otherwise add `isExportOnlyType` alias retention for orphaned rows.

## Open Questions

- **Q1 — Exact `contentType` value and label:** Confirm `pdf` / `PDF` vs `pdf-document` / `PDF Document`. Default recommendation is `pdf`.
- **Q2 — CMS scope:** Confirm export-only (recommended) vs CMS-publishable HTML companion alongside PDF. If CMS, specify `geek_blog.post_type` mapping.
- **Q3 — PDF spec:** A4 portrait confirmed? Margins, typography, BrandKit color usage, cover page, table of contents, and header/footer requirements. Carousel v1 was typographic-only — should PDF v1 also omit embedded section images (image prompts stay as sidecar `.txt`)?
- **Q4 — Word floor & FAQ:** Whitepaper-level floor (~1200+ words) with no FAQ (recommended) vs pillar-level floor with optional FAQ?
- **Q5 — Keep `linkedin-carousel` route alias:** Should `POST .../transform/linkedin-carousel` also accept `linkedin-document` payload alias for backward compat while drift is resolved?

## Sources

- Workspace files inspected via `read_file` / `grep`: `src/app/creates/content-types.ts`, `src/app/creates/job-snapshot.ts`, `src/app/creates/outline-editor.ts`, `src/app/creates/brief-catalog.ts`, `src/app/creates/new/new-create-form.tsx`, `src/app/creates/canvas.tsx`, `src/app/creates/canvas-types.ts`, `src/app/creates/repurpose-channels.ts`, `plan/long-form-content-types.md`, `plan/linkedin-carousel.md`, `plan/v2-master.md`, `architecture.md`, `package.json`.
- QuestPDF already in use per `plan/linkedin-carousel.md:40` + `plan/linkedin-carousel.md:46` renderer path; no new external library evaluation required for initial plan.

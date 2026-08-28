# Remaining work — plumbing, export, PAA/FAQ, scores, competitors

**Path:** `/Users/jeffmartin/development/content-creator-v2/plan/remaining-work.md`

Consolidated from production feedback (Aug 2026). Replaces the Cursor-only export plan.

**Related:** [`outline-must-mentions-names-only.md`](./outline-must-mentions-names-only.md), [`polite-partner-crawl.md`](./polite-partner-crawl.md), [`competitor-site-crawl.md`](./competitor-site-crawl.md)

---

## Issue inventory

| # | Issue | Status today | Fix |
|---|--------|--------------|-----|
| 1 | Outline must-mentions show URLs / crumbs like `leads` | Broken (`GuessToolNameFromUrl` on operator URLs) | GeekBackend PLAN |
| 2 | Article links go to partner sites not on-site `/tools/…` | Broken (`MergePartnerTools` merges operator hrefs) | GeekBackend WRITE notes |
| 3 | Publish CMS / Publish live wrong for non-blog workflow | Blog CMS only | v1-style ZIP + Commit; demote CMS |
| 4 | Other content types hard to find | Jobs exist; UI hides them | Also-draft / tabs / creates list |
| 5 | Scores low; no FAQ | PAA unused; GEO expects FAQ; repair ignores SEO/GEO | PAA → People Also Ask + resolve fails |
| 6 | Competitors never worked | No crawler before | Same pattern as partner tools |

---

## 1–2. Outline names + on-site article links

**Canonical:** [`outline-must-mentions-names-only.md`](./outline-must-mentions-names-only.md)

**Locked rules**

| Data | Outline must-mention | WRITE inline href | Partner crawl |
|------|----------------------|-------------------|---------------|
| `recommendedTools[].name` | Yes | — | — |
| `recommendedTools[].href` (on-site `/tools/…`) | No | Yes (absolute) | — |
| `operatorTools` URL | **Never** | **Never** | Yes (excerpts) |

**GeekBackend**

- `GccV2PlanService.ExtractPartnerToolNames`: names from `recommendedTools` only; drop `GuessToolNameFromUrl`; reject `http(s):` names.
- `GccV2ContextAdapter.MergePartnerTools` / `BuildPartnerWritingNotes`: recommendedTools only; dedupe by **name**; drop off-site hrefs; absolutize `/tools/…` from siteUrl / ToolBaseUrl.
- Crawl unchanged — operator URLs still feed polite partner research.

**Verify:** regenerate outline (clean bullets); new generate → lede/body link to `geekatyourspot.com/tools/…` only.

---

## 3. Export like Content Writer v1 (not CMS)

**Publish to CMS / Publish live** upsert Geek **blog** CMS posts only. Wrong for pillar / tool / email / social / ads. Not git export.

v1: GeekContentCreator `ReviewPublishPanel` — **Export .html (.zip)** + **Commit to geekatyourspot** → `content-writer-output/{use-cases,blog,tools,social,email,...}`.

**Backend**

- `GccV2HtmlExportService`: job `ResultJson` `ContentDocument` → existing `SectionHtmlRenderer`.
- Folder map: `pillar`→`use-cases`, `blog`→`blog`, `tool`→`tools`, `email`→`email`, `social`→`social/linkedin`, `ads`→`misc`, `image-prompt`→`.txt` under `image-prompts/`.
- Routes: `GET creates/{createId}/export/html` (ZIP), `POST .../export/html/commit` (GitHub `content-writer-output/` via `GEEKATYOURSPOT_GITHUB_TOKEN`).
- Export **all completed jobs** on the create, not only the open Canvas tab.

**Frontend**

- Canvas primary: **Export .html (.zip)**, **Commit to geekatyourspot**.
- **Publish to CMS** secondary, labeled **Blog CMS only**.

---

## 4. Viewing other content types

**Today**

- **New brief:** Primary (Pillar/Blog) + **Also draft** checkboxes → one job per type.
- **Create page:** tabs under title when `jobs.length > 1` (`?jobId=`).
- **Re-Purpose:** short remixes without separate jobs.
- **Home:** Your v2 creates / View v1 creates (read-only).

**UX upgrades**

- Creates list: show **all job content types** per create (not only primary `contentType`).
- Create page: always show Drafts strip; hint to use Also draft for tool/email/social.

---

## 5. Scores: PAA → FAQ + resolve fails (not display-only)

VALIDATE repair today only handles overlap / polish / guardrail — **SEO/GEO fails are never repaired**. PLAN never schedules FAQ though GEO’s `faq-or-direct-answers` check expects one.

Scores are **% of binary checks passed** (often 5 checks → 0/20/40/60/80/100). AI visibility = average(SEO, GEO). GEO is **advisory** — does not block ship-ready or export.

### 5a. FAQ from People Also Ask (match v1)

| Surface | PAA |
|---------|-----|
| v1 brief | “People Also Ask (one per line)” — operator-curated |
| v1 SERP upload | Parsed for weeding; **never auto-dumped** |
| Content Writer | Outline ends with H2 `"People Also Ask"`; PAA as H3 answers |
| v2 `brief-catalog.ts` `paaQuestions` | Field exists; `GccV2ContextAdapter` maps → `PeopleAlsoAskQuestions` |
| v2 New brief UI | **No PAA control** |
| v2 PLAN | Never adds FAQ |

**Locked (pillar/blog)**

1. **UI:** Restore PAA textarea on New brief (one question per line).
2. **PLAN:** Trailing H2 **`People Also Ask`**, `job: faq`. Child H3s = brief PAA (cap ~12). If PAA empty → fallback 3–5 keyword/tool questions only.
3. **WRITE:** Each PAA question verbatim as H3; short direct-answer opener + 2–4 sentences.
4. **VALIDATE repair:** If FAQ missing and PAA present → append FAQ from those questions (do not invent a second set).
5. Short-form: no FAQ; type-aware scoring skips FAQ checks.

**PAA wins** — do not invent FAQ children when PAA is present.

### 5b. Resolve SEO/GEO in VALIDATE

| Failed check | Resolution |
|--------------|------------|
| `faq-or-direct-answers` | Append or rewrite FAQ section from PAA |
| `keyword-in-lede` / entity early | Rewrite lede with target keyword |
| `keyword-in-heading` | Ensure ≥1 advance H2 contains keyword |
| `citeable-passages` | Rewrite 1–2 paragraphs to standalone ≥40-word claims |
| density / word-count (long-form) | Expand weakest section |

Cap: `MaxRepairAttempts` (2). Persist `seoChecks` alongside `geoChecks`.

### 5c. Rail: Fix readiness

After auto-repair, if advisory GEO/SEO still fail: show failed checks + **Fix readiness** button (re-run repair pass). Label as readiness checklist, not content quality grade.

### 5d. Calibration

- Type-aware thresholds (no 800w / 3 H2 / FAQ on email/social/ads/tool).
- AI visibility keyword = same source as VALIDATE (no silent empty keyword).
- Export not gated on high scores.

---

## 6. Competitors — work like partner tools

v1 competitor input did not work (no crawler). Copy **partner-tools** path — do not build Frase auto-discovery.

### Why (optional field)

| | Partner tools | Competitors |
|---|---------------|-------------|
| **Who** | Products you recommend | Rival pages for same intent |
| **Crawl** | Feature excerpts | Positioning excerpts → **differentiate** |
| **In article** | On-site `/tools/…` links | Research only — **no** rival CTAs |

**Helps WRITE when URLs provided:** differentiation in advance sections; comparison keywords; coverage gaps. **Not in scope:** gap dashboards, auto-discovered rival lists.

**Implementation**

| Partner tools | Competitors |
|---------------|-------------|
| Operator pastes tool URLs | Operator pastes rival URLs (1–5) |
| Confirm → polite crawl + cache | Same `GccPoliteCrawler` + research records |
| Excerpts → WRITE notes | Excerpts → differentiation notes |
| Soft-skip 403/robots | Soft-skip — never block Generate |

- Brief field `competitorUrls` (one per line), optional, near partner tool URLs.
- WRITE notes: “Competitors (research only): …” — how we differ; no long quotes; no off-site CTAs.

Empty field = unchanged from today.

---

## Execution order

1. Plumbing (#1–#2) + tests + deploy GeekAPI
2. PAA → FAQ: brief UI + PLAN `People Also Ask` + WRITE (#5a)
3. VALIDATE SEO/GEO repair + calibration (#5b/#5d) + rail Fix readiness (#5c)
4. Competitors like tools (#6)
5. Export ZIP/Commit (#3)
6. Content-type discoverability (#4)
7. Verify: PAA as FAQ H3s; competitor crawl soft-skips; on-site links; multi-job export

---

## Todos

- [x] `ExtractPartnerToolNames`: recommendedTools names only
- [x] WRITE notes: on-site `/tools/` hrefs only; dedupe by name; absolutize
- [x] Tests: outline names; MergePartnerTools on-site href only
- [x] PAA textarea on New brief
- [x] PLAN+WRITE: trailing People Also Ask from `paaQuestions`
- [x] VALIDATE repair: FAQ from PAA; SEO/GEO resolution
- [x] Scoring: type-aware thresholds; keyword align; Fix readiness rail
- [x] Competitor URLs → polite crawl → differentiation notes
- [x] `GccV2HtmlExportService` + GET zip + POST commit
- [x] Canvas: Export ZIP + Commit; CMS labeled blog-only
- [x] Creates list / tabs: show all draft types
- [ ] End-to-end verify (deploy + smoke test in production)

---

## Non-goals

- Stopping operator URL paste (needed for partner/competitor crawl)
- Changing polite crawler behavior
- GEO as ship-ready gate
- Persisting Re-Purpose variants in ZIP (jobs only first)
- Failed checks without resolution path
- Auto-discovering competitors
- Blocking generate on competitor crawl failure

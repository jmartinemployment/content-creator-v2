# Rules

**Correctness over expediency.**

Authoritative rules for **content-creator-v2** (phi), executors, and agents. When this file conflicts with an older plan snippet, **this file wins** unless the owner overrides in chat.

| Doc | Role |
|-----|------|
| **This file** | Hard rules — pass/fail |
| [`executor.md`](./executor.md) | Build sequence for phi |
| [`v2-master.md`](./v2-master.md) | Product scope and cutover |
| [`tool-pages-v2.md`](./tool-pages-v2.md) | Tool page generation |
| [`crawl-architecture.md`](./crawl-architecture.md) | Three crawl domains — project site vs Geek-Crawler |
| [`crawl-implementation.md`](./crawl-implementation.md) | Phased build — Geek-Crawler read, project-site crawl, phi cutover |
| [`geek-crawler.md`](./geek-crawler.md) | Geek-Crawler ↔ gcc-v2 read boundary |
| [`../architecture.md`](../architecture.md) | Platform map, copy / call / do not reuse |

---

## 1. Workspace and repos

| Rule | Detail |
|------|--------|
| **Phi workspace** | `/Users/jeffmartin/development/content-creator-v2` only — app at repo root, not `web/`, `frontend/`, or sibling `GeekContentCreatorV2` |
| **Preserve** | `plan/` and `architecture.md` at repo root |
| **Geek-Crawler** | **Separate repo:** `/Users/jeffmartin/development/Geek-Crawler` — not inside GeekBackend, **not** in content-creator-v2 `src/` |
| **Do not invent repos** | No new sibling products without owner approval |

---

## 2. Isolation — zero diffs where forbidden

Fail any change that touches:

| Forbidden path | Notes |
|----------------|-------|
| `/Users/jeffmartin/development/GeekContentCreator` | v1 UI — **zero diffs** unless owner documents a one-line scoped exception |
| `GeekAPI/Controllers/ContentCreator` (non-V2), `Services/ContentCreator`, `HttpGccRepository.cs` | v1 API |
| `GeekRepository` Content Creator (non-V2) tables/controllers | v1 data |
| **Geek-SEO** hubs / crawlers | **Read-only** from v2 — no edits |

**Allowed additive GeekBackend edits:** `ContentCreatorV2/*`, `HttpGccV2Repository`, additive `Program.cs` / CORS / migrations for schema `content_creator_v2` only.

---

## 3. Correctness — no silent failures

- Jobs must reach **`ready`**, **`failed`** (with error), or an explicit **`awaiting_*`** state — never **`pending`** forever.
- **Fail closed** when **project grounding** fails: missing brief, empty `relatedPages`, failed project-site crawl gate — surface errors to the operator.
- **External partner/competitor research (Geek-Crawler):** **notify and skip** — append `partnerResearchWarnings`, generate continues. Never block generate or expose Geek-Crawler page-limit / operator config changes from Content Creator. See [`crawl-architecture.md`](./crawl-architecture.md).
- **No silent fallbacks:** do not substitute guessed data, blank forms, or “good enough” success when a **required project-site** step failed.
- **No timer polling as a fallback** when SignalR or push fails — fix hub/reconnect; do not add `setInterval` “just in case.”

---

## 4. Realtime — push, not poll

**Forbidden in phi `src/`:**

- `usePollJob`, `pollUntilReady`, `POLL_MS`
- `setInterval` / `setTimeout` loops whose purpose is job, crawl, or analysis **status**
- Worker `SELECT … WHERE status = 'pending'` on a sleep ticker

**Required:**

- Long-running progress over **SignalR** (GeekAPI `/hubs/gcc-v2-realtime` for v2 jobs; `/hubs/geek-crawler-realtime` for Geek-Crawler runs)
- Hub **`Join*`** methods with snapshot on connect / **`lastSeq`** replay for jobs
- REST GET for history, initial load, manual refresh, reconnect catch-up only — **never on a timer**

---

## 5. Crawlers and site facts

See [`crawl-architecture.md`](./crawl-architecture.md). Three domains — do not collapse them.

| Rule | Detail |
|------|--------|
| **Project site crawl** | **gcc-v2 owned** — copy Geek-Crawler engine patterns into `ContentCreatorV2/ProjectSite/*`; store in `content_creator_v2`. Powers `relatedPages`, BrandKit, `siteHierarchy`. **Not** a Geek-Crawler `crawlType`. |
| **Project site ≠ always “client’s site”** | Say **project site** (URL bound to a create). Often a client property today; do not hard-code that assumption in APIs or tenancy. |
| **No Site Analyzer runtime** | Copy former Site Analyzer **behavior** into owned project-site crawl — do **not** call Geek-SEO analyze APIs or keep `siteAnalysisProfileId` as permanent gate. |
| **Partner / Tools crawl** | **Geek-Crawler** (`crawlType: "partner"`) — start in Geek-Crawler UI; gcc-v2 **reads** `geek_crawler` pages at generate, does not inline-crawl |
| **Competitors crawl** | **Geek-Crawler** (`crawlType: "competitors"`) — same read-only rule |
| **Local / regional crawl** | **Geek-Crawler** (`crawlType: "local"`) — future South Florida / local business scope; not project site |
| **Mobile-only** | Pixel 7 viewport for all BFS crawls — never desktop |
| **No crawl UI in phi** | No Geek-Crawler BFF, hub, or start-crawl UI in content-creator-v2 `src/` |

**Do not use:** `gcc_v2_tool_source_crawl_*`, `gcc_v2_partner_research_records` (delete after GC read path), `api/geek-content-creator-v2/tool-sources/crawl*`, `tool-vendor-crawl`, **vendor crawl**, **vendor research**, `ai-tools` — use **partner crawl** / **`crawlType: "partner"`**.

---

## 6. Next.js (phi) structure

| Rule | Detail |
|------|--------|
| **App Router** | Routes under `src/app/` — product URLs `/`, `/creates/...`, `/legacy/...` |
| **No nested `/app` URL** | `src/app/` is the router root only — no `src/app/app/` |
| **Auth** | Colocated under `src/app/auth/` + handlers under `src/app/api/auth/` |
| **No `server/` tree** | Do not create top-level `src/server/` |
| **No API clients in `lib/`** | BFF routes under `src/app/api/*`; helpers under `src/app/auth/` or next to features — not `src/lib/` for GeekAPI fetch |
| **GeekOAuth** | Client only — distinct client id and cookies from v1; **never** duplicate the IdP |

---

## 7. Brief and catalogs

- **Content Brief** fields and catalogs live in **`brief-catalog.ts`** in this app — phi owns them.
- Do not call v1 for brief data or ship blank Infobase-style forms.
- Generate reads **persisted** create/brief JSON — no client-only bypass.

---

## 8. Copy, call, do not reuse

| Action | What |
|--------|------|
| **Copy** | v1-specific shapes into v2-owned files (`ContentCreatorV2/*`, phi components) |
| **Call** | Shared engines in GeekAPI (`ContentPromptBuilder`, analyzers, review) — **called, not edited** |
| **Do not reuse** | v1 `GccController`, `HttpGccRepository`, or v1 generate routes for **new** work |

Tool pages: copy workflow logic into `GeekAPI/Services/ContentCreatorV2/ToolPages/*` per [`tool-pages-v2.md`](./tool-pages-v2.md) — do not call workflow `ToolPageGenerator` at runtime.

---

## 9. Language

Use ordinary English in plans, API names, UI copy, and comments.

| Avoid | Use instead |
|-------|-------------|
| vendor crawl / vendor research | **partner crawl**, partner tool URLs |
| `ai-tools` | `partner` (`crawlType`) |
| force (as product verb) | start a crawl / crawl again |
| cache (stretched) | saved results / past run |
| metadata (for run info) | run details |

Write the full term before an acronym once per section (e.g. “Hypertext Markup Language (HTML)” then “HTML”).

**Geek-Crawler plans:** do not label work as “Phase 1”, “Phase 2”, etc. Describe scope directly.

---

## 10. Geek-Crawler (standalone product)

| Item | Value |
|------|-------|
| **Repo (UI)** | `/Users/jeffmartin/development/Geek-Crawler` |
| **Engine + DB** | GeekBackend `GeekAPI/Services/GeekCrawler/*`, `MongoGeekCrawlerService` → Mongo DB `geek_crawler` (`MONGO_CRAWLER_URL`) |
| **Auth** | GeekOAuth on public API; machine JWT GeekAPI → GeekRepository only |
| **Progress** | SignalR `/hubs/geek-crawler-realtime` on GeekAPI |
| **Phi** | No crawl start UI, BFF, or hub — operator URLs on brief only |
| **gcc-v2 read** | Query `partner` and `competitors` runs/pages at generate — see [`geek-crawler.md`](./geek-crawler.md) |

GeekBackend keeps **read bridge** for gcc-v2 (`HttpGeekCrawlerApiClient` / page resolver) — **not** a second store for partner/competitor HTML in `content_creator_v2`.

Wrong duplicate storage: `gcc_v2_partner_research_records`, revived `tool_source_crawl_*`.

---

## 11. Verification before merge

```bash
# Isolation
git diff --name-only | rg 'GeekContentCreator|ContentCreator/(?!V2)' || true

# No polling (phi)
rg 'setInterval|pollUntilReady|POLL_MS|usePollJob' src/

# No forbidden vendor crawl strings (phi src)
rg -i 'vendor.?crawl|tool-vendor-crawl|tool-sources/crawl' src/

# Structure
test ! -d src/server
test ! -d src/lib  # or ensure no GeekAPI clients there

# Build
npm run build
```

GeekBackend changes: `dotnet build` + targeted `dotnet test` for touched areas.

---

## 12. Git

- **Do not commit** unless the owner asks.
- **Do not force-push `main`** without explicit owner approval.
- Prefer **revert commits** over `reset --hard` + force push when rolling back published history on `main`.

---

## 13. Isolation checklist (every change)

```text
[ ] No edits under GeekContentCreator (unless documented exception)
[ ] No edits under Geek-SEO (read APIs only)
[ ] No edits under GeekAPI ContentCreator v1 or HttpGccRepository for new features
[ ] GeekBackend Program.cs diffs additive only
[ ] No sibling GeekContentCreatorV2 / web / frontend folders
[ ] Auth under src/app/auth + src/app/api/auth — no src/server/
[ ] No GeekAPI BFF clients under lib/
[ ] No job/crawl/analysis timer polling
[ ] Geek-Crawler code only in Geek-Crawler repo
[ ] Partner naming — not “vendor crawl”
[ ] Crawl split — project site owned; partner/competitors read Geek-Crawler only
```

---

## 14. Out of scope (unless owner expands)

- Editing GeekContentCreator for v2 features
- Embedding Geek-Crawler in GeekBackend or phi
- Redis/Hangfire/job HTTP pollers
- Content Writer v3/v4
- Force-push rollback of `main` without approval
- Mock or placeholder external services when a real integration is required

# Content Creator v2 — Executor Plan

**Correctness over expediency.**

**Workspace (only):** `/Users/jeffmartin/development/content-creator-v2`  
**Design authority:** [`v2-master.md`](./v2-master.md) + [`tool-pages-v2.md`](./tool-pages-v2.md) (tool generation) + [`../architecture.md`](../architecture.md) (platform map; **§8 copy / call / do not reuse** is canonical for v1 dependency boundaries).

**This file is what an executor follows.** Do not invent sibling repos. Use existing GeekOAuth as IdP (client only — never duplicate that service).

---

## Hard rules (fail the phase if broken)

1. **Do not modify v1.** Zero diffs under:
   - `/Users/jeffmartin/development/GeekContentCreator`
   - `GeekAPI/Controllers/ContentCreator` (non-V2), `Services/ContentCreator`, `HttpGccRepository.cs`
   - `GeekRepository` Content Creator (non-V2) tables/controllers
   - Geek-SEO hubs / crawlers (read-only from v2)
2. **No polling.** No `usePollJob`, no `setInterval` on job URLs, no worker `SELECT pending` sleep loop.
3. **No second crawler.** Brand/site facts come from existing Geek-SEO analysis (read).
4. **Content Brief** fields and catalogs live in `brief-catalog.ts` (this app owns them; do not call v1 for brief data or replace with blank Infobase forms).
5. **Next.js = standard App Router.** Routes under `src/app`. Auth colocated under `src/app/auth/` (next to callback) + `src/app/api/auth/` route handlers. **Do not** invent a top-level `server/` tree. **Do not** put GeekAPI/BFF fetch clients in a folder named `lib`.
6. **Use existing GeekOAuth — do not duplicate it.** This app is an **OAuth client** of the already-running GeekOAuth service. Distinct client id + cookies from v1. Do not copy the GeekOAuth repo or stand up a second IdP.
7. **Do not create** `/Users/jeffmartin/development/GeekContentCreatorV2` or folders named `web` / `frontend`. App lives **in this workspace**. Prefer **repo root** as the Next app (keep `plan/` + `architecture.md` beside it). If a subfolder is required, ask the owner for the name first.
8. **One app, no `/app` URL.** `src/app/` is the Next App Router root only. Do not nest `src/app/app/`. Product routes are `/`, `/creates/...`, etc.

---

## Gate 0 — Owner decisions (only if blocking)

| Decision | Default |
|---|---|
| Auth | **GeekOAuth** — client of the existing service (not a duplicate IdP); distinct client + cookies from v1 |
| Next app location | **Repo root** of `content-creator-v2` |
| Local origin for CORS | Append when known (e.g. local Next port) — additive only |

---

## Phase 1 — Standard Next + GeekOAuth (this workspace only)

**Do:**

1. `create-next-app` (App Router, TypeScript, Tailwind) **into this repo root** (or owner-named path — never `web`/`frontend`/sibling `GeekContentCreatorV2`).
2. Preserve `plan/` and `architecture.md`.
3. Wire this app as a **GeekOAuth client** (Authorization Code + PKCE against the live GeekOAuth URLs): `app/api/auth/{start,callback,token,logout,hub-token}`, callback page, proxy refresh. Reference v1/GCW **patterns** only; **new files** here. Distinct client id + cookie names. **Do not** copy or redeploy GeekOAuth itself.
4. Colocate auth helpers under `src/app/auth/` (with callback). Route handlers under `src/app/api/auth/`. **No** top-level `server/` directory. **No** GeekAPI clients under `lib/`.
5. Empty authenticated page after sign-in. Confirm v1 still signs in with its own cookies.
6. Confirm `npm run dev` works.

**Do not:** duplicate GeekOAuth; put auth/API clients in `lib/`; edit GeekContentCreator.

**Verify:** sign-in hits real GeekOAuth; v1 cookies untouched; no second IdP; no `lib/` API layer; no sibling repo.

---

## Phase 2 — GeekAPI + GeekRepository stubs (additive)

**Do:**

1. New namespaces only: `Controllers/ContentCreatorV2`, `Services/ContentCreatorV2`, `ContentCreatorV2DbContext`, schema `content_creator_v2`.
2. Additive `Program.cs` only (register v2 context/migrate; `AddContentCreatorV2()`); append this app’s origin to CORS allowlist.
3. Health (or ping) under `api/geek-content-creator-v2` requiring GeekOAuth bearer (same API auth middleware family as v1).
4. Next BFF proxy route under `app/api/...` → GeekAPI v2 prefix (helpers not in `lib/`).

**Do not:** poll worker, SignalR yet (Phase 3), edit v1 controllers.

**Verify:** authenticated BFF → health; empty diffs on v1 Content Creator paths; `content_creator` schema untouched.

---

## Phase 3 — Event infra (highest risk)

**Do:**

1. Tables: `GccV2Job`, `GccV2JobEvent` (append-only `Seq`), `GccV2StageResult`, creates/briefs as needed.
2. Enqueue = persist + `NOTIFY gcc_v2_job` (+ in-process `Channel`).
3. Worker **listens**; claims with `FOR UPDATE SKIP LOCKED` only when woken. Startup: **one** expired-lease scan. No pending ticker.
4. Hub `/hubs/gcc-v2-realtime` on GeekAPI; `JoinJob(jobId, lastSeq)` **replays** then streams. Copy SignalR **patterns** into **new** files; do not edit Geek-SEO hub.
5. Dummy multi-stage job + outline pause/resume + cancel.
6. UI: connect to hub only after Gate 0 auth exists; until then, prove hub with a non-browser test client if needed.

**Forbidden:** job HTTP poller; worker sleep loop.

**Verify:** grep no pollers; reconnect via `lastSeq`; restart mid-job resumes.

---

## Phase 4 — Brief + BrandKit + hierarchy (product core)

**Do:**

1. Copy **brief catalogs/fields** from v1 into this app (UI form only) — not auth.
2. Require crawl id (same gate spirit as v1 Generate).
3. `GccV2BrandKitBuilder`: map crawl → competitor Infobase/Brand Voice fields ([`v2-master.md`](./v2-master.md) §1). Review UI; provisional voice.
4. Hierarchy-match (read-only) → outline children; partition must-mentions; research allocation map.
5. Outline approval gate before WRITE.
6. CC-owned site hierarchy crawl when building structured `siteHierarchy`: **mobile-only** (Pixel 7 / Google-style), same as Site Analyzer — shipped in v2 (see [`v2-master.md`](./v2-master.md) §4). Do not desktop-crawl or dual-crawl.

**Do not:** blank Infobase; edit Geek-SEO; invent SERP children; treat intentional mobile/desktop twin differences (e.g. no hero on mobile) as crawl bugs; flatten hierarchy to markdown for storage/retrieval.

---

## Phase 5 — WRITE / VALIDATE / Canvas (blog + pillar first)

**Do:**

1. Section-by-section WRITE with allocation + BrandKit; call `ContentPromptBuilder` / analyzers / review **via adapters** (no signature edits).
2. VALIDATE: review adapter + SEO + GEO + citations + **OverlapGate** (named H2 pair).
3. REPAIR flagged section only (cap 2).
4. Canvas: event-streamed sections + right-rail scores/overlap.

**Verify:** overlap fails with named headings; brief still required; BrandKit pre-filled from crawl.

---

## Phase 6 — Remaining types + guardrails

Tool pages v2 ([`tool-pages-v2.md`](./tool-pages-v2.md)): keyword overview + N partner pages, URL extract, `<blockquote cite="…">`, spawn after pillar `ready` — **copy** into `ContentCreatorV2/ToolPages/*`, do not call workflow `ToolPageGenerator`.

Social, image, ads, email; transforms; DB guardrail rules as hard gate. Spike evaluate prompts (go/no-go).

---

## Phase 7 — Backlog (explicitly later)

LLM Pass-2 restructure; read-only v1 create view; CMS publish; AI-visibility dashboards.

---

## Isolation checklist (every phase)

```text
[ ] No edits under GeekContentCreator
[ ] No edits under Geek-SEO (except zero — read APIs only)
[ ] No edits under GeekAPI ContentCreator (v1) or HttpGccRepository
[ ] Program.cs diffs additive only
[ ] No sibling GeekContentCreatorV2 repo
[ ] No folders named web/ or frontend/
[ ] No API layer under lib/
[ ] GeekOAuth used as existing IdP (client only — no duplicate service)
[ ] Auth under src/app/auth + app/api/auth — no top-level server/ directory
[ ] No GeekAPI clients under lib/
[ ] No job pollers / pending worker ticker
```

---

## Out of scope

GEO dashboards, Frase CMS, MCP, token streaming, Redis/Hangfire, Jasper Grid, Copy.ai GTM, live v1 data migration, guessing brand with no crawl.

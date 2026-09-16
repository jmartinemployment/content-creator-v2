# Content Creator v2 — Architecture

**Correctness over expediency. No polling for live job status.**

| Authority | Path |
|-----------|------|
| **Service boundaries + current state** | [`AGENTS.md`](./AGENTS.md) |
| **This file** | Platform map, isolation, Create/BFF/hub contracts |
| **Agent rules** | [`.cursor/rules/`](./.cursor/rules/) |

`plans/master-plan.md` no longer exists. When this file conflicts with an older doc or git history,
**AGENTS.md + this file win** unless Jeff overrides in chat.

**Preferred term:** **site section context** (related pages, headings, excerpts, section path). Not “neighborhood.”

---

## 1. This application

| Item | Value |
|------|--------|
| Repo | `content-creator-v2` |
| UI | Next.js App Router on Vercel (**phi**): `https://content-creator-v2-phi.vercel.app` |
| GeekAPI prefix | `api/geek-content-creator-v2` |
| Persistence | `content_creator_v2` schema (GeekRepository via GeekAPI) |
| Backend isolation | GeekAPI `Services/ContentCreatorV2/*` |
| Authoring path | `/app/creates/new` → job → draft workspace |

phi is the product surface. **As of 2026-09-16 it serves v1's frontend** (restored from
`GeekContentCreator`); V2's frontend was removed. It is **not** a feature inside Geek Content Workflow
and **not** a thin form over legacy Content Writer UI.

---

## 2. Platform stack

```text
Browser (phi)
  → GeekOAuth
  → Next BFF (/api/gcc-v2/*, /api/rag/*)
  → GeekAPI (ContentCreatorV2 + Rag facade)
       → GeekRepository (content_creator_v2)
       → Geek-Crawler / Mongo (partner & competitor corpus)
       → Geek-Crawler-Rag / Qdrant (query + page Markdown)
```

| Layer | System | Use for |
|-------|--------|---------|
| Auth | **GeekOAuth** | Sign-in, session cookies, bearer to GeekAPI |
| HTTP API | **GeekAPI** | Create jobs, VALIDATE, Create writer, RAG **library** facade (query/pages) |
| Data | **GeekRepository** | Creates, versions, approvals under `content_creator_v2` |
| Project site | **ContentCreatorV2 ProjectSite** | Owned crawl / BrandKit / site section context |
| Partner / competitor | **Geek-Crawler** (read via GeekAPI) | Indexed HTML → RAG library; never treat competitor as partner |
| Evidence library | **Geek-Crawler-Rag** | `/v1/query` + page Markdown verify only for Create |
| Create writer | **GeekAPI** (`gcc-create-library.v1`) | Drafts PLAN/WRITE/VALIDATE grounded on library excerpts |
| Realtime | **SignalR** `/hubs/gcc-v2-realtime` | Job + crawl progress only (no timer polling) |

### Deploy

- **Vercel** — this Next app (stable phi host for OAuth CSP)
- **Railway** — GeekAPI / GeekRepository / related backends
- **CORS** — extend GeekAPI `CORS_ORIGINS` with phi + `http://localhost:3004` (do not invent a Next CORS layer)

---

## 3. Environment contract

Secrets and LLM keys stay on **GeekAPI** — never in the browser bundle.

### This app (see `.env.example`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_AUTH_URL` | GeekOAuth issuer |
| `NEXT_PUBLIC_APP_URL` | App origin / OAuth redirect base (phi in prod) |
| `NEXT_PUBLIC_OAUTH_CLIENT_ID` | OAuth client (`geek-content-creator-v2`) |
| `NEXT_PUBLIC_GEEK_API_URL` | GeekAPI base for BFF + default hub host |
| `NEXT_PUBLIC_GCC_V2_HUB_URL` | Optional SignalR hub override |

### GeekAPI (selected Create/RAG)

| Concern | Notes |
|---------|--------|
| `GCC_V2_CITEABLE_CREATE_V1` | Citeable VALIDATE kill switch (default ON; OFF = **fail closed**, never degraded Ready) |
| RAG URL / citeable generate flags | Soft-disable must not look like citeable Create success |
| OpenAI / provider keys | GeekAPI only |
| Mongo / crawler URLs | Server-side only; Mongo `:27017` is accepted-risk per master-plan P5 |

---

## 4. Create domain model

| Concept | Meaning |
|---------|---------|
| **User** | GeekOAuth identity |
| **Client / account** | Brand the content is for |
| **Project site** | URL/property bound to a create; grounds BrandKit + related pages |
| **Create / job** | One writing effort: brief → evidence → PLAN → WRITE → VALIDATE → draft workspace |
| **Partner (tools)** | What we sell / distribute; `crawlType:"partner"`; indexed partner crawl on **every Create** — **fail closed**. Product payloads + **SoftwareApplication** JSON-LD — [`plans/partner-extraction-complete.md`](plans/partner-extraction-complete.md) |
| **Competitor** | Direct or content rivals to **analyze and (when honest) name**; competitor crawl on **every Create** — **fail closed**; never cited as partner. Extract + **competitor SoftwareApplication JSON-LD** — [`plans/competitor-extraction-complete.md`](plans/competitor-extraction-complete.md) |
| **Citation** | URL · `pageId` · quote · `sourceDigest` · authorized `runId` · `sectionKey` · `crawlType` · `sourceRights` · provenance |
| **shipReady** | Appendix B predicate only — `jobStatus: Ready` ≠ ship-ready |

Generate / VALIDATE require real project-site (where typed) **and always** partner + competitor crawl runs (master-plan **Create evidence policy** + Appendix A). **Fail closed** if either corpus run is missing — not optional enrichment. Project-site does not replace them.

### Competitor intelligence (contract pointer)

Create uses competitor pages for **both** analysis and explicit mention when strategy warrants it—not as optional color. Authoritative plan: [`plans/competitor-extraction-complete.md`](plans/competitor-extraction-complete.md) — **minimum expand** (pricing, ICP, integrations, FAQ, proof, CTA destinations, disqualifiers), **competitor-specific** payloads (gap map, framing bank, demand signals, type label, deficit→partner swap, comparison axes, claim-risk), extended ad/SEO catalog, and competitor `SoftwareApplication` JSON-LD. Evidence binding remains fail-closed (`competitorSourceRunIds` / legacy singular every Create) per master-plan. Library extraction feeds `/v1/query` — Create drafting stays GeekAPI, not RAG generate.

**Live path (GeekAPI + library):** After competitor quoteables resolve, `GccV2CompetitorExtractionService` (`gcc-competitor-extraction.v1`) writes brief `competitorExtraction` (always `crawlType:competitors`); Markdown verify via `GccV2CompetitorExtractionVerify`; deficit→partner swaps join partner Alternatives; WRITE notes include COMPETITOR EXTRACTION + claim-risk guidance; JSON-LD via `GccV2CompetitorSoftwareApplicationJsonLd`. Indexer stamps competitor chunk metadata (`competitorName`, `competitorChunkKind`, `featureTag`). PLAN applies `GccV2CompetitorTypePlanRouting` (content rivals ≠ product substitutes). VALIDATE fail-closes rival claim-risk echoes via `GccV2CompetitorClaimRiskGate`.

### Partner extraction payloads (contract pointer)

Partner library extraction isolates core assets (**Citable**, **Advertisement**, **Comparison**, **Alternatives**), a **minimum expand** set (Pricing catalog, ICP, Integrations, FAQ/objections, Proof pack, Offer/CTA destinations, Disqualifiers), an **extended catalog**, plus **SoftwareApplication** JSON-LD — defined in [`plans/partner-extraction-complete.md`](plans/partner-extraction-complete.md). Binding remains fail-closed (`partnerSourceRunIds` / legacy singular every Create). Tools = partners; competitors never as `crawlType:"partner"`.

**Live path (GeekAPI):** After partner quoteables resolve, `GccV2PartnerExtractionService` (`gcc-partner-extraction.v2`) writes brief `partnerExtraction`; `GccV2PartnerExtractionVerify` Markdown-verifies claim assets via `GET /v1/pages`; competitor deficits join via `GccV2PartnerAlternativesJoin` (never `crawlType:"partner"` on rivals); VALIDATE uses `GccV2PartnerCitableBridge` for §P1. Publish uses `GccV2PartnerSoftwareApplicationJsonLd` (no price without Pricing catalog evidence).

---

## 5. North-star job flow

> **As of 2026-09-16, PLAN and WRITE call v1's engine** (`ContentGenerationOrchestrator`) through
> `GeekAPI/Services/ContentCreatorV2/V1Restore/`. VALIDATE, REPAIR and final synthesis still run
> V2-side against v1's output. Drafting is gated by `ContentCreatorV2:DraftingEnabled` (default
> **false**), which stops a create after the free evidence gates and before the first paid model call.


```text
/app/creates/new → brief → evidence → PLAN → approve → WRITE (citeable) → VALIDATE → draft workspace → export
```

RAG runs **inside** the Create job — not as a parallel product UI.

| Stage | Contract |
|-------|----------|
| **PLAN** | Research plan / outline grounded on usable sources |
| **WRITE** | Section / complete / final synthesis with provenance |
| **VALIDATE** | Quote verify, coverage, partner-mention gate, `sourceRights` (kill switch ON). OFF = fail closed — no skipped-gates Ready |
| **Draft workspace** | Operator edit/export; Ready ≠ shipReady; no degraded-success banner |

Live progress: **SignalR** `JobEvent` on `/hubs/gcc-v2-realtime`. REST is for start, snapshot, `/result`, and reconnect catch-up — **never** a timer poll loop for status.

---

## 6. Frontend surfaces (this repo)

| Path | Role |
|------|------|
| `/app/creates` | Create list |
| `/app/creates/new` | Start a create from a topic + content type (20 types) |
| `/app/creates/[id]` | Draft workspace |
| `/app/creates/[id]/repurpose` | Repurpose |
| `/app/workflow`, `/app/workflow/projects/[id]` | Workflow surfaces |
| `/app/site-analyzer` | **Broken and deprecated** — its endpoints were retired; gap analysis is Geek-SEO's, arriving via RAG |
| `/api/cw/[...path]` | BFF passthrough → GeekAPI |
| `/api/auth/*` | PKCE start / token / logout / hub-token |

**Known broken:** ~15 `api/geek-content-creator/*` calls target v1 endpoints deleted in `582a171`.
Only `/app/creates/new` avoids them. See AGENTS.md § Current state.

Foreign `runId` → **safe-fail only** (no cross-tenant corpus adoption).

---

## 7. RAG = library (definition). Do not name drafting “RAG generate”

**RAG** means retrieval + verification against indexed sources. It is **not** Create’s writer.

| Half | System | Contract |
|------|--------|----------|
| **Library (RAG)** | Geek-Crawler-Rag | Index crawls; `/v1/query` / pages; verify quotes against Markdown. Fail closed on empty/Failed query. |
| **Writer (Create)** | GeekAPI | `gcc-create-library.v1` — drafts PLAN/WRITE/VALIDATE from library excerpts. Provenance must say Create library, not RAG generate. |

**Naming debt (do not treat as product definition):** historical strings `rag-generate.v2` / `rag-generate.v3` and former Geek-Crawler-Rag `POST /v1/generate` are **removed** from the live Create/GeekAPI/Rag product path. Prefer **library query** vs **Create library writer**. Do not revive generate.

Honesty (master-plan P0):

- Empty RAG pages / Failed query ≠ empty success
- SoftDisabled / one-shot / `rag-generate.*` ≠ citeable Create success
- No silent required-evidence fallbacks
- External Create research (partner / competitor / local) is **library-only** — no Mongo `seed_html` substitute; see [`plans/remove-remaining-fallbacks-complete.md`](plans/remove-remaining-fallbacks-complete.md) + [`plans/remove-partner-seed-html-fallback-complete.md`](plans/remove-partner-seed-html-fallback-complete.md)

---

## 8. Copy, call, do not reuse

| Action | What | Why |
|--------|------|-----|
| **Copy** | v1-specific shapes into `ContentCreatorV2/*` | v1 can be deleted after cutover |
| **Call** | Shared prompt/SEO/GEO engines in-process in GeekAPI | One stack — call, don’t fork casually |
| **Do not reuse** | v1 GCC controllers/repos as permanent runtime | New work uses v2 prefix only |

### Isolation hard rules

- Creates-canonical only (no second writer UI)
- Tools = partners; competitors never as partner
- Isolation under `ContentCreatorV2/*` and this repo identity
- No automatic WRITE retries; user-initiated new job only

---

## 9. Ship-ready vs runtime Ready

| Signal | Means |
|--------|--------|
| `jobStatus: Ready` | Stages completed |
| `shipReady: true` | Appendix B satisfied (verified citations, coverage, partner-mention where required, `sourceRights` ∈ {consented, licensed}, authz OK) |
| Kill switch OFF | Fail closed — not an alternate Ready / skipped-gates path |

Full predicate: master-plan **Appendix B**. Release decision: master-plan **P3** / §7.

---

## 10. Sibling repos

| Repo | Role |
|------|------|
| `content-creator-v2` | This UI (phi) |
| `GeekBackend` / GeekAPI | Create orchestration, RAG facade, hubs |
| `Geek-Crawler` | **All crawling** — partner / competitors / geo / project-site / future |
| `Geek-Crawler-Rag` | Query / pages. **Retrieval + verification only — never generates** |
| `Geek-SEO` | Site + gap analysis (owns Site Analyzer) |
| `GeekContentCreator` | v1 UI — **source of the frontend now running in this repo** |
| `GeekContentWorkflow` | Pattern reference only — not the product shell |

---

## 11. Local / first-wire checklist

1. GeekOAuth + env from `.env.example` (phi redirect URIs registered).
2. BFF can reach GeekAPI (`/api/gcc-v2/*`, `/api/rag/*`).
3. Hub connects: `/hubs/gcc-v2-realtime` (no status polling).
4. Create job reaches PLAN with healthy RAG; the draft workspace shows citations / gaps honestly.
5. CORS includes this app’s origins on GeekAPI.

Until signed-in against real GeekAPI, local UI is not a substitute for §7 smokes.

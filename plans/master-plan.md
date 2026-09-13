# Content Creator v2 — Master Plan (program of record)

**Updated:** 2026-09-13  
**Role:** Short living authority for what to build next.  
**Not this file:** Historical dump and research — see [archive/master-plan-consolidated-dump-2026-09-13.md](archive/master-plan-consolidated-dump-2026-09-13.md) (parts 0–19 as consolidated 2026-09-13).  
**Platform map:** [architecture.md](../architecture.md) at repo root.

When this file conflicts with the archive dump or any older plan snippet, **this file wins** unless the owner overrides in chat.

---

## 1. Authority — one north star

| Decision | Authority | Losers (demoted) |
|----------|-----------|------------------|
| **Product surface** | **Creates-canonical:** `/creates/new` → durable gcc-v2 job → Canvas. One way to author publishable content. | Promoting `/rag` as primary “Write” nav; treating Agent Library as a second writer |
| **Evidence engine** | Geek-Crawler-Rag (hybrid/graph query + citeable generate) **inside** PLAN / WRITE / VALIDATE — not a parallel product | Standalone `/rag` as long-term home; paste-in competitor text as primary research |
| **Execution engine (near term)** | GeekAPI `GccV2JobWorker` + `RagGenerateService` / citeable stages | LlamaIndex stage agents (parked until citeable path + goldens exist) |
| **Task agents** | Consumers of the same evidence plane; diagnostics → handoff into Create — not a second draft pipeline | Migrating all content agents onto `/rag` as the writer of record |
| **Pipelines / Grid** | Real product surface once stage advancement is durable; do **not** disable as “dead” without verifying current code | Part-4 “hide Pipelines forever” as north star |
| **PDF long-form type** | Backlog after citeable Create path is stable | Parallel green “start now” |

### Naming — Tools are partners, not competitors

| Term | Meaning | `crawlType` / store |
|------|---------|---------------------|
| **Partner / Tools** | Tool vendors and partner products you may advertise or integrate | Geek-Crawler `partner` |
| **Competitors** | Rival companies / offerings used for **differentiation research only** | Geek-Crawler `competitors` |
| **Local** | Regional / local businesses (future) | Geek-Crawler `local` |
| **Project site** | URL bound to a create (often a client property; do not hard-code “client”) | gcc-v2 owned project-site crawl — **not** a Geek-Crawler type |

**Never** call tools “competitors.” Tool ads retrieve **partner** corpus (+ optional competitor excerpts for differentiation). UI, APIs, briefs, and plans must say **partner** / **partner crawl** / `crawlType: "partner"` — not vendor crawl, `ai-tools`, or competitor-as-tool.

---

## 2. Standing policy (fail the change if broken)

Full historical wording lives in the archive Part 0. Non-negotiables:

1. **Correctness over expediency** — no silent fallbacks for required project-site grounding; external partner/competitor research is **notify-and-skip** (`partnerResearchWarnings`), never a generate blocker that exposes Geek-Crawler caps.
2. **Realtime = SignalR** — no `usePollJob` / status `setInterval` in phi `src/`.
3. **Isolation** — zero diffs to v1 Content Creator / Geek-SEO hubs; GeekAPI edits only under `ContentCreatorV2/*` (+ additive Program/CORS/migrations for `content_creator_v2`).
4. **Phi workspace** — `/Users/jeffmartin/development/content-creator-v2` only. No Geek-Crawler BFF/hub/start-crawl UI in phi. No Qdrant/embed/indexer under phi `src/`.
5. **Repos** — Geek-Crawler-Rag owns index/query/generate; GeekAPI + phi are thin authenticated consumers.
6. **Repos transport security** — no long-term plaintext `http://` bare-IP RAG URL with shared key in the clear (see Security queue).
7. **Language** — partner crawl not vendor crawl; project site not “always client site.”

---

## 3. Security queue (ahead of product features)

Details: [security-queue.md](security-queue.md) (tightened 2026-09-13).

**Labels:** S0 = availability blocker. **S1 / S5 / S6 = security incidents — start immediately in parallel with S0.** Do not read the list as permission to defer SSRF or credential containment.

| # | Item | Class | Fix (summary) |
|---|------|-------|----------------|
| S0 | Knowledge ingestion stuck | Availability | Atomic claim/lease, idempotent transitions, terminal failure path independent of failed transition; 409 handler is containment only |
| S1 | Crawl SSRF | Security incident | DNS + redirects every hop + rebinding + schemes/ports + metadata/outbound policy — not IP-literal-only |
| S5 | Trusted RAG index/delete | Security incident | Manifest-bound owner, caller identity, rotation/replay, tests; reduce shared-key-only trust |
| S6 | RAG key + HTTP | Security incident | **Rotate key + shut down plaintext HTTP now**; TLS/hostname alongside |
| S2 | Crawl budgets | Hardening | Seeds + URLs + concurrency + duration + bytes + redirects + rate; define cancel / partial-run usability |
| S3 | OAuth forwarded headers | Hardening | Deployment-specific proxy-chain design + direct vs proxied tests |
| S4 | OIDC redirect URIs | Hardening | Prefer exact registered URIs; narrow namespace + separator if dynamic |

**Product M1** only after **S0–S2 production verification**.

---

## 4. Product track — Creates-canonical (citeable)

### Goal

Highest-quality, evidence-grounded content through one path:

`/creates/new` → brief → research/evidence manifest → PLAN → outline approval → WRITE (citeable) → VALIDATE → Canvas → export/publish.

RAG is the **research and evidence engine**, not a second UI taxonomy. The seven `/rag` writing intents become internal retrieval/generation strategies mapped from gcc-v2 content types.

### Bridge (allowed while migrating)

- Keep `/rag` reachable for operators who already use it.
- Do **not** make `/rag` the primary nav CTA.
- Prefer “Continue in Create” / evidence handoff **into** `/creates` over growing `/rag` as product home.
- Task-agent “Write from this finding” should eventually land on Create with a typed brief — interim deep-link to `/rag` is acceptable only if labeled transitional.

### Near-term milestones

**M1 — Contracts (no UI chrome)**

- Versioned `GccV2GenerationBrief` from persisted create/brief + brand + hierarchy + run IDs.
- Inspectable **research/evidence manifest** before PLAN (sources, readiness, gaps, conflicts).
- `GccV2ContentTypeRagMapper` — content type → RAG family (LongForm / ShortForm / Battlecard / slides).
- Citation DTO on WRITE stage output + job `ResultJson` (quote-level, not only source links).
- **`ResearchEntity`** for partner vs competitor identity (page/URL/entity key, role **per request**, never conflating tools with competitors).

**M2 — Vertical slice on Create**

- One long-form type (prefer `pillar` or `blog`) end-to-end: PLAN outline from citeable research → WRITE sections with verified citations → Canvas shows citations.
- Partner tools from brief `operatorTools` / partner run IDs; competitor URLs only as differentiation research.
- Fail closed on missing **project-site** grounding; notify-and-skip on missing partner/competitor index.

**M3 — Generalize types + retire standalone writer**

- Map remaining content types; lift guided outline/citation UX into Canvas.
- Redirect `/rag` after parity; keep API generate only as internal engine.
- Wire task-agent next actions → Create (not a permanent `/rag` home).

**M4 — Model policy**

- Stage-aware policy (quality-first). No silent downgrade; operator-controlled downgrade only.
- Park LlamaIndex agentization (former Part 18) until M2 goldens exist.

### Corpus / indexing gate

Citeable Create assumes indexed **partner** (and when needed **competitor**) Markdown in Qdrant.

- Scheduler may be off; quarantined runs need explicit `POST /v1/index` — do not assume “Research ready” means your sources are indexed.
- Large partner runs that are skipped/quarantined block tool-ad quality — treat reindex/backfill as an ops gate for M2, not a soft warning.

---

## 5. Parallel tracks (bounded)

These may proceed **only** when they do not reopen the north-star fork:

| Track | Do | Don’t |
|-------|----|-------|
| **Task agents DoD** | Honest diagnostics, provenance (`observed` \| `imported` \| `generatedHypothesis`), purpose renderers, GSC observed-only for Query Planner | Become a second content writer; paste competitor HTML as primary corpus |
| **Geek IQ** | Version pin on runs, freshness, project-site → Knowledge promotion | New Railway sidecars / hosted multimodal parsers |
| **Pipelines / Grid** | Verify current stage advancement; then durable async DAG + schedule→pipeline | Hide forever based on a possibly stale “no worker” claim without re-audit |
| **PDF `pdf` type** | After M2 citations stable; resolve `linkedin-carousel` vs `linkedin-document` naming first | Land as competing green “start now” |
| **Fallback/correctness audit** | Execute archive Part 6 priority list after S0–S6 | Re-plan the audit; treat dump as the finding index |

---

## 6. Explicitly out of scope

- Rewriting generation from superseded v2-master (archive Part 19).
- New Railway compute services (ClamAV sidecars, separate “context compute”).
- LlamaParse / LlamaCloud parsing (prohibited).
- Geek-Crawler start UI or RAG indexer inside phi.
- Calling tools “competitors” or storing tool pages under competitor crawl types.
- Re-expanding this file into a 6k-line dump — add links to archive or new focused plan files instead.

---

## 7. Next slice (≤5 checkboxes)

- [ ] **Immediate parallel:** S1 SSRF containment + S5 RAG auth containment + S6 key rotation / HTTP shutdown
- [ ] **Parallel:** S0 atomic claim/lease + independent terminal failure (409 = containment only)
- [ ] **Then:** S2 crawl budgets; S3 proxy-trust design; S4 exact redirect URIs
- [ ] **Prod verify S0–S2** (signals in [security-queue.md](security-queue.md))
- [ ] **Only then M1** — [citeable-create-pipeline.md](citeable-create-pipeline.md)

---

## 8. Archive index

| Archive location | Former parts | Why demoted |
|------------------|--------------|-------------|
| [archive/master-plan-consolidated-dump-2026-09-13.md](archive/master-plan-consolidated-dump-2026-09-13.md) | 0–19 dump | Conflicting north stars; historical incident notes; Jasper research; superseded v2-master |
| Dump Part 0 | Rules | Superseded by §2 here; keep dump for full checklists |
| Dump Part 1 | Jasper remaining | Agents/pipelines backlog — §5 parallel only |
| Dump Part 4 | “Make workable” /rag-first | Bridge tactics only; contradicts Creates-canonical |
| Dump Part 6 | Fallback audit | Finding index + priority list — execute, don’t re-author |
| Dump Part 16 | Unify RAG into Create | **Absorbed** as §4 north star (edited for partners≠competitors) |
| Dump Part 18 | LlamaIndex agents | Parked until M2 goldens |
| Dump Parts 2,3,8,11,19 | Shipped / superseded | History only |

Focused plans for review (do not paste back into this master):

- [README.md](README.md) — index
- [critique-master-plan-consolidation.md](critique-master-plan-consolidation.md)
- [security-queue.md](security-queue.md) — S0–S6
- [citeable-create-pipeline.md](citeable-create-pipeline.md) — M1–M2

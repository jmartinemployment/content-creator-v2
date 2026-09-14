# Content Creator v2 — Master Plan (program of record)

**Updated:** 2026-09-14  
**Role:** Short living authority for what to build next.  
**Not this file:** Historical dump and research — see [archive/master-plan-consolidated-dump-2026-09-13.md](archive/master-plan-consolidated-dump-2026-09-13.md).  
**Platform map:** [architecture.md](../architecture.md) at repo root.

When this file conflicts with the archive dump or any older plan snippet, **this file wins** unless the owner overrides in chat.

**Enforceable non-negotiables live only in §2** (and linked focused plans for citeable/security detail). Archive Part 0 is **historical wording**, not a second rules source — do not implement from the dump when §2 differs.

---

## 1. Authority — one north star

| Decision | Authority | Losers (demoted) |
|----------|-----------|------------------|
| **Product surface** | **Creates-canonical:** `/creates/new` → durable gcc-v2 job → Canvas. One way to **author** publishable content. | Promoting `/rag` as primary “Write” nav; treating Agent Library as a second writer |
| **Evidence engine** | Geek-Crawler-Rag (hybrid/graph query + citeable generate) **inside** PLAN / WRITE / VALIDATE — not a parallel product | Standalone `/rag` as long-term home; paste-in competitor text as primary research |
| **Execution engine (near term)** | GeekAPI `GccV2JobWorker` + `RagGenerateService` / citeable stages | LlamaIndex stage agents (parked until citeable path + goldens exist) |
| **Task agents** | Consumers of the same evidence plane; diagnostics → handoff into Create — not a second draft pipeline | Migrating all content agents onto `/rag` as the writer of record |
| **Pipelines / Grid** | **Orchestration only** around Create jobs (schedule, DAG, stage visibility). Must **not** become a second place to initiate/edit authoring copy. Do not disable without verifying current code. | Part-4 “hide Pipelines forever”; Pipelines as parallel writer |
| **PDF long-form type** | Backlog after citeable Create path is stable | Parallel green “start now” |

### Naming — Tools are partners, not competitors

| Term | Meaning | `crawlType` / store |
|------|---------|---------------------|
| **Partner / Tools** | Tool vendors and partner products you may advertise or integrate | Geek-Crawler `partner` |
| **Competitors** | Rival companies / offerings used for **differentiation research only** | Geek-Crawler `competitors` |
| **Local** | Regional / local businesses (future) | Geek-Crawler `local` |
| **Project site** | URL bound to a create (often a client property; do not hard-code “client”) | gcc-v2 owned project-site crawl — **not** a Geek-Crawler type |

**Never** call tools “competitors.” UI, APIs, briefs, and plans must say **partner** / `crawlType: "partner"`.

---

## 2. Standing policy (fail the change if broken)

1. **Correctness over expediency** — no silent fallbacks for **required** project-site grounding.
2. **Partner/competitor — two layers (do not conflate):**
   - **Runtime (user generate):** Missing or unindexed partner/competitor research is **notify-and-skip** with warnings and **restricted claims** (no uncited partner-specific claims). Do **not** hard-block `blog`/`pillar` generate solely because a partner index is empty. Content-type exceptions (e.g. `tool` / partner ads fail-closed) are defined in [citeable-create-pipeline.md](citeable-create-pipeline.md) §1 — not a blanket “always skip.”
   - **Release-readiness (declare M2/M3 done):** A **representative partner corpus must be indexed and usable** before M2 is marked complete. Quarantined/skipped large partner runs **block declaring release-ready** (ops gate / reindex), not the runtime skip policy. Someone must not “fix” runtime by making partner indexing fail-closed for all types.
3. **Realtime = SignalR** — no `usePollJob` / status `setInterval` in phi `src/`.
4. **Isolation** — zero diffs to v1 Content Creator / Geek-SEO hubs; GeekAPI edits only under `ContentCreatorV2/*` (+ additive Program/CORS/migrations for `content_creator_v2`).
5. **Phi workspace** — `/Users/jeffmartin/development/content-creator-v2` only. No Geek-Crawler BFF/hub/start-crawl UI in phi. No Qdrant/embed/indexer under phi `src/`.
6. **RAG** — Geek-Crawler-Rag owns index/query/generate; GeekAPI + phi are thin authenticated consumers.
7. **RAG transport security** — no long-term plaintext `http://` bare-IP RAG URL with shared key in the clear (see Security queue).
8. **Language** — partner crawl not vendor crawl; project site not “always client site.”
9. **runId authorization** — every retrieval, citation verify, and Canvas render path must authorize `runId` for the current owner/workspace/project. Unauthorized / foreign run → safe failure. Belongs in citeable M1/M2 acceptance, not only the security queue.
10. **Source rights / freshness** — “Partner” is a **business role**, not automatic license to quote or advertise. Prefer consented partner crawl corpus; respect freshness expectations; if source markdown no longer contains the quote (reprocess/delete), citation verification **fails** and ship-ready must not claim verified.

---

## 3. Security queue (evidenced states — not one checkbox)

Details and ops contracts: [security-queue.md](security-queue.md).

**Do not** collapse S0–S6 into a single “done.” Use these states: `implemented` · `deployed` · `production-verified` · `monitoring` · `accepted-risk`.

| # | Item | State (2026-09-13) | Evidence |
|---|------|--------------------|----------|
| S0 | Knowledge ingestion claim/lease | **production-verified** | Prod `Revision` column + migration; `queued=0`; terminal jobs — [security-queue.md](security-queue.md) verification log |
| S1 | Crawl SSRF | **production-verified** | Deployed + unit tests (DNS/redirects/caps) |
| S2 | Crawl budgets | **production-verified** | Caps + budget-fail terminal; unit coverage |
| S3 | OAuth forwarded headers | **deployed** + **monitoring** | `TRUSTED_PROXY_CIDRS`; GeekOAuth docs |
| S4 | OIDC redirect URIs | **deployed** + **monitoring** | Preview hyphen-required patterns |
| S5 | Trusted RAG index/delete | **deployed** + **monitoring** | Shared `CONTEXT_MANIFEST_SIGNING_KEYS`; residual: prove key inventory outside GeekAPI |
| S6 | RAG key + HTTP | **production-verified** | HTTPS `sslip.io`; public HTTP closed; key rotated |
| — | Mongo `:27017` public | **accepted-risk** | Needed for Railway GeekRepository until private network; auth required |

**Product M1** required **S0–S2 production-verified** (met). Residual accepted-risk items do not reopen the M1 gate but must stay visible.

---

## 4. Product track — Creates-canonical (citeable)

**Detail plan:** [citeable-create-pipeline.md](citeable-create-pipeline.md) (M1–M2 policies win over short bullets here).

### Goal (measurable)

Evidence-grounded content through one authoring path:

`/creates/new` → brief → research/evidence manifest → PLAN → outline approval → WRITE (citeable) → VALIDATE → Canvas → export/publish.

RAG is the **research and evidence engine**, not a second UI taxonomy.

### Launch metrics (M2 / M3)

Track weekly (phi + GeekAPI). “Parity” is measured — not vibes.

| Metric | M2 target (blog) | M3 target (generalized) |
|--------|------------------|-------------------------|
| Job completion rate (start → ready, non-cancel) | ≥ 80% on smoke corpus | ≥ 85% across mapped types |
| Median time to usable outline (OutlineReady) | Record baseline; regress &lt; 2× | Improve or hold baseline |
| Citation resolution rate (verified citations / citations shown) | ≥ 95% on ship-ready jobs | ≥ 95% |
| Section citation coverage (body sections with facts that have ≥1 verified citation or explicit gap) | 100% on ship-ready | 100% |
| Unsupported-claim rate (VALIDATE flags / ship attempts) | Declining; ship-ready requires 0 blocking flags | Same |
| Operator approve → export rate | Record baseline | Hold or improve |

### Verified / quote-level citation (contract)

`runId` + `sectionKey` alone are **not** a quote. A citeable citation requires:

| Field | Role |
|-------|------|
| Canonical source URL (or asset locator) | Identity |
| `pageId` / chunk or document id | Source unit |
| Exact `quote` and/or character offsets | Span |
| `sourceDigest` or content revision | Reproducibility |
| `runId` (authorized) | Corpus binding |
| `sectionKey` (+ optional claim/paragraph anchor later) | Generated-content anchor |
| `crawlType` / role | Partner ≠ competitor |
| Retrieval/generation timestamp + model + prompt/policy version | Provenance |

Full policy, coverage, snapshot, and negative smokes: [citeable-create-pipeline.md](citeable-create-pipeline.md).

### Durable job contract (compact)

`GccV2JobWorker` stages: plan → (gates) → write → validate → ready | failed | canceled.

| Concern | Rule |
|---------|------|
| Idempotency | Claim/lease per job; stage transitions claim-bound; duplicate wake must not double-write sections |
| Retry ownership | Worker retries transient RAG/provider errors within stage; terminal fail after budget; operator may regenerate section / re-PLAN |
| Cancellation | User cancel → terminal `canceled`; no further stage work |
| Partial results | Stage results + SignalR events remain readable; Canvas shows last good section set |
| Recovery | Failed job shows actionable error; project-site gaps point to crawl; index gaps point to wait/reindex |

### Authorization / tenancy

- Create/job `OwnerUserId` scopes all Geek-Crawler / RAG `runId` use.
- Citation verify and Canvas must re-check authz (not trust client-supplied run ids blindly).
- Cross-tenant or stale run → safe failure / warning — acceptance criterion for M2.

### Source rights / freshness

- Partner crawl implies operator-intended advertising corpus, not unlimited claim license.
- Prefer fresh indexed Markdown; verification fails if quote absent from current stored page.
- Stale citations on old drafts: show as unverified / gap on re-validate; do not silently keep “verified.”

### Product surface — `/rag` UI removed

- **Authoring URL:** `/creates/new` only. Product route `/rag` is **deleted** (404; no redirect).
- **Evidence engine:** GeekAPI `/api/rag/*` + Geek-Crawler-Rag remain internal (Create BFF + jobs). Naming “rag” on the API is not a product surface.
- Do not reintroduce a second writer UI or “bridge” retirement story.

### Near-term milestones

**M1 — Contracts** — **done** (contracts exist; see citeable plan). Does **not** prove citeable writing alone.

**M2 — `blog` vertical** — **in progress** (code gate wired; smokes not recorded)

- Verified citation + section coverage in VALIDATE (`GccV2CitationEvidenceGuard`); evidence snapshot fields on ResultJson.
- Runtime vs release partner policy (§2).
- Happy **and** negative smokes recorded (project-site missing, unindexed partner, invalid/unauthorized runId, mixed partner/competitor, WRITE retry fail, section regen).
- Kill switch: `GccV2CiteableCreateV1` via `GCC_V2_CITEABLE_CREATE_V1` (default ON).

**M3 — Generalize content types + Canvas citeable UX** — **blocked until M2 done when**

- Map remaining content types; lift outline/citation UX into Canvas.
- Task-agent next actions → Create.

**M4 — Model policy**

- Stage-aware quality-first; no silent downgrade.
- Park LlamaIndex agentization until M2 goldens exist.

### Corpus / indexing gate

- **Runtime:** notify-and-skip when partner/competitor index missing (per content-type table in citeable plan).
- **Release-readiness:** M2 cannot be declared complete without a representative **indexed + usable** partner corpus (ApprovalMax/Plooto smoke hosts documented in citeable plan). Quarantined large runs → reindex ops, not “Research ready” UI lies.

---

## 5. Parallel tracks (bounded)

Proceed **only** when they do not reopen the north-star fork:

| Track | Do | Don’t |
|-------|----|-------|
| **Task agents DoD** | Honest diagnostics, provenance, purpose renderers | Second content writer; paste competitor HTML as primary corpus |
| **Geek IQ** | Version pin, freshness, project-site → Knowledge | New Railway sidecars / hosted multimodal parsers |
| **Pipelines / Grid** | Durable async DAG + schedule **orchestrating Create jobs**; verify stage advancement | Second authoring surface; hide forever without re-audit |
| **PDF `pdf` type** | After M2 citations stable; fix linkedin naming drift first | Competing green “start now” |
| **Fallback/correctness audit** | **Done** 2026-09-14 — [fallback-correctness.md](fallback-correctness.md) F1–F11 + K2 | Re-plan the audit; treat dump as living rules |

---

## 6. Explicitly out of scope

- Rewriting generation from superseded v2-master (archive Part 19).
- New Railway compute services (ClamAV sidecars, separate “context compute”).
- LlamaParse / LlamaCloud parsing (prohibited).
- Geek-Crawler start UI or RAG indexer inside phi.
- Calling tools “competitors” or storing tool pages under competitor crawl types.
- Re-expanding this file into a 6k-line dump — add links to archive or focused plans instead.
- Treating archive Part 0 as enforceable rules when §2 differs.

---

## 7. Next slice (≤5 checkboxes)

- [x] Delete `/rag` product UI (404, no redirect); relocate Create RAG clients; strip bridge narrative
- [x] M2: citation provenance + section coverage gate in VALIDATE ([citeable-create-pipeline.md](citeable-create-pipeline.md))
- [x] Kill switch `GccV2CiteableCreateV1` (`GCC_V2_CITEABLE_CREATE_V1`, default ON)
- [ ] M2: signed-in happy **and** negative-path smokes recorded in citeable §Smoke log
- [ ] Security: maintain **per-item** evidenced states in §3 / security-queue

---

## 8. Archive index

| Archive location | Former parts | Why demoted |
|------------------|--------------|-------------|
| [archive/master-plan-consolidated-dump-2026-09-13.md](archive/master-plan-consolidated-dump-2026-09-13.md) | 0–19 dump | Conflicting north stars; historical only |
| Dump Part 0 | Rules | **Superseded by §2** — not a second non-negotiables source |
| Dump Part 1 | Jasper remaining | §5 parallel only |
| Dump Part 4 | `/rag`-first | Bridge tactics only |
| Dump Part 6 | Fallback audit | Finding index — execute, don’t re-author |
| Dump Part 16 | Fold RAG into Create | Absorbed as §4 |
| Dump Part 18 | LlamaIndex agents | Parked until M2 goldens |
| Dump Parts 2,3,8,11,19 | Shipped / superseded | History only |

Focused plans:

- [README.md](README.md) — index  
- [critique-master-plan-consolidation.md](critique-master-plan-consolidation.md)  
- [security-queue.md](security-queue.md) — per-item S0–S6 evidence  
- [citeable-create-pipeline.md](citeable-create-pipeline.md) — M1–M2 citeable acceptance  

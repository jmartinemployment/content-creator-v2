# Citeable Create pipeline (M1–M2)

**Status:** M2 in progress (`blog` vertical) — PLAN gate + WRITE sectionKey wired; prod smoke pending  
**Authority:** [master-plan.md](master-plan.md) §4  
**Depends on:** [security-queue.md](security-queue.md) — **S0–S2 production verification** recorded 2026-09-13 (gate open). Security incidents S1/S5/S6 are live.  
**Absorbs:** archive dump Part 16 (Creates-canonical), not Part 4 `/rag`-first  

---

## Naming (non-negotiable)

| Role | Use | Do not use |
|------|-----|------------|
| Tool vendors / products to advertise | **Partner**, `crawlType: "partner"`, brief `operatorTools` | competitor, vendor crawl, `ai-tools` |
| Rival research for differentiation | **Competitor**, `crawlType: "competitors"`, brief `competitorUrls` | Treating tools as competitors |
| Create-bound site | **Project site** (gcc-v2 owned) | Geek-Crawler type; “always client site” |

Tool ads retrieve **partner** corpus. Competitor excerpts are optional differentiation only (notify-and-skip if missing).

---

## Goal

One authoring path with verifiable evidence:

```text
/creates/new → brief → evidence manifest → PLAN → outline approve
  → WRITE (citeable sections) → VALIDATE → Canvas (citations) → export
```

RAG is the evidence engine inside gcc-v2 jobs. Standalone `/rag` stays reachable as a **bridge**, not the product home.

```mermaid
flowchart TD
  createNew["creates/new"]
  brief["Canonical brief"]
  manifest["Evidence manifest"]
  plan["PLAN citeable outline"]
  canvas1["Canvas outline approve"]
  write["WRITE citeable sections"]
  validate["VALIDATE"]
  canvas2["Canvas citations"]
  bridgeRag["slash-rag bridge only"]

  createNew --> brief --> manifest --> plan --> canvas1 --> write --> validate --> canvas2
  bridgeRag -.->|"transitional"| createNew
```

---

## M1 — Contracts (no UI chrome)

Ship typed contracts and fixtures before changing PLAN/WRITE behavior.

### Deliverables

1. **`GccV2GenerationBrief`** (versioned) — **done**  
   Assembled once from persisted create/brief + brand kit + hierarchy + project-site run IDs + **partner** run IDs / tool URLs + competitor run IDs / URLs (role-separated).  
   `GccV2GenerationBrief.CurrentVersion` = `gcc-v2-generation-brief.v1`.

2. **Research / evidence manifest** (inspectable before PLAN) — **done (assembler)**  
   `GccV2ResearchEvidenceManifest` + `GccV2PrePlanEvidenceManifestAssembler`: index readiness, candidate quotes slot, gaps/conflicts, internal-link opportunities. Missing required **project-site** evidence is a visible gate (`Ready == false`). Missing partner/competitor index → warnings, not hard block.

3. **`GccV2ContentTypeRagMapper`** — **done**  
   Maps gcc-v2 content types → RAG family (LongForm / ShortForm / Battlecard / slides). Intents are internal strategies, not a second UI taxonomy.

4. **Citation DTO** — **done**  
   `RagCitationDto` / RAG `GenerateCitation` include `runId` + `sectionKey` (Canvas-ready). Wired through GeekAPI RAG client mapping. No production WRITE attach change yet.

5. **`ResearchEntity`** — **done (request ref)**  
   Durable `GccV2ResearchEntity` store already exists. `GccV2ResearchEntityRef` adds **role per request** (`partner` | `competitor`) without mutating the row. Stable key from URL authority or entity id.

### Files

- GeekBackend: `GccV2GenerationContracts.cs`, `RagGenerateModels.cs`, `HttpGeekCrawlerRagClient.cs`, `RagGenerateService.cs`
- Geek-Crawler-Rag: `models.GenerateCitation` (`runId`, `sectionKey`); pages context includes `runId`
- Phi: `src/app/creates/rag-contract.ts` (+ `rag/types.ts`) — types only

### Verification

- Golden fixtures in `GccV2UnifiedRagTests`: brief assembly; pre-PLAN gate/warnings; entity role separation; citation JSON round-trip; mapper table
- No production PLAN/WRITE behavior change in this milestone (PLAN still builds post-retrieval manifest as before)

**Done when:** Contracts compile, fixtures green, no production PLAN/WRITE behavior change required yet (or feature-flagged).

---

## M2 — Vertical slice on Create

Prove one long-form type end-to-end signed-in against deployed stack.

### Choose one

**Selected: `blog`** (stable outline gate, existing Canvas). Pillar follows the same path once smoke passes.

### Work

1. PLAN uses citeable/RAG outline path — **done** (existing) + **pre-PLAN gate wired** (`GccV2PrePlanEvidenceManifestAssembler` fail-closed on missing project-site; partner/competitor → warnings on outline `EvidenceManifest`).
2. WRITE citeable sections — **done** (existing) + **`SectionKey` stamped** on citations (section RAG, complete, final synthesis).
3. Canvas quote-level citations — **already wired** (`SectionCitations` / `sectionCitations`); no new chrome.
4. Brief `operatorTools` feed partner names — **done** (`ExtractPartnerToolNames` reads `operatorTools`; never competitor URLs).
5. Fail closed on missing project-site — **done** at PLAN (and already at Generate/WRITE).
6. Ops gate: partner run(s) indexed for smoke — **candidates verified 2026-09-13** (index `complete`):
   - Preferred smoke: `04fbbd9c-6b11-478d-98bf-13f2377a0d7a` — ApprovalMax (`approvalmax.com`), 29 pages / 248 chunks
   - Stronger corpus: `cd2c4bac-268b-41fe-85ea-9930bceb40da` — Plooto (`plooto.com`), 271 pages / 7781 chunks
   - Avoid for smoke: `25e09e3b-…` Rytr — index complete but only 32 chunks (thin)

### Bridge rules during M2

- Do **not** add `/rag` to primary nav as “Write”
- Optional: “Open legacy RAG writer” link labeled transitional
- Task-agent “Write from finding” may deep-link Create with prefilled brief; `/rag` deep-link only if labeled transitional

### Verification

**Deterministic** — fixtures green (`GccV2UnifiedRagTests`: pre-PLAN gate, partner≠competitor, sectionKey stamp)

**Signed-in prod smoke (fixed seeded partner + optional competitor)** — ready to run

**Seed:** blog create; `partnerSourceRunId` = `04fbbd9c-6b11-478d-98bf-13f2377a0d7a` (ApprovalMax); `operatorTools` include “ApprovalMax”. Optional competitor omit OK.

1. Create blog → evidence manifest visible on Canvas  
2. Approve outline → WRITE → ready  
3. Canvas shows ≥1 verified citation from **partner** corpus  
4. Competitor-only absence does not block; partner-required absence warns per policy  

**Done when:** Smoke checklist passes; fixtures green; no second writer declared the product home.

---

## Later (not this plan)

| Item | When |
|------|------|
| M3 generalize types + redirect `/rag` | After M2 |
| M4 model policy (no silent downgrade) | After M2 |
| LlamaIndex stage agents (archive Part 18) | After M2 goldens |
| PDF `pdf` content type | After citations stable; fix linkedin naming drift first |
| Migrate all task agents onto `RagGenerateService` as writer | Rejected as north star; agents consume evidence → Create |

---

## Out of scope

- Hiding/disabling Pipelines as a product decision
- Ad-template `localStorage` → DB (separate small plan if needed)
- Rebuilding from superseded v2-master
- LlamaParse

---

## Review checklist

- [x] Owner confirms Creates-canonical (not `/rag`-first) — proceeding under master §4
- [x] First vertical type: **`blog`**
- [x] Owner confirms partner run IDs / hosts for M2 smoke (indexed) — ApprovalMax `04fbbd9c-…` / Plooto `cd2c4bac-…`
- [x] Bridge rules (no primary-nav `/rag`)
- [x] Security S0–S2 prod verification acknowledged; S1/S5/S6 contained
- [x] M1 contracts + fixtures green
- [x] M2 code wiring (PLAN gate + sectionKey stamp) + fixtures green

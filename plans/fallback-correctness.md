# Fallback / correctness remediation

**Status:** Executed 2026-09-14 — F1–F11 + K2 landed (tests green for stub/seed/negotiate batches; phi typecheck green)  
**Authority:** [master-plan.md](master-plan.md) §2 (correctness) + §5 (fallback audit track)  
**Finding source:** 2026-09-14 full-app fallback audit (all classes: silent, success-shaped, explicit, stub/demo)  
**Depends on:** [security-queue.md](security-queue.md) residuals do not block this track  
**Sibling:** archive dump Part 6 finding index — execute here; do not re-author the dump  

### Principle

Preserve **intentional, user-visible degradation** with hard state contracts. Remove **hidden substitution** (success-shaped stubs, empty≡error, unmarked writer downgrade, wrong CMS category, invented FAQ).

### Runtime vs release (do not conflate)

| Layer | Rule |
|-------|------|
| **Required project-site grounding** | Fail closed / surface error — no silent substitute. Seed HTML is allowed only under §Keep contracts below. |
| **Partner/competitor research (runtime)** | Notify-and-skip + warnings OK; never invent claims from missing sources |
| **Realtime** | SignalR only — no poll / `setInterval` status fallback |
| **Model / writer** | Explicit operator downgrade only; transport outages are retryable infra failures |

---

## Scope

**In scope:** phi (`content-creator-v2/src`) + GeekAPI `ContentCreatorV2/*` (+ additive Program env validation for stub gate).

**Isolation:** GeekAPI edits stay under `ContentCreatorV2/*`. Phi `src/proxy.ts` matcher is already limited to gcc-v2 routes (`/creates`, `/agents`, `/skills`, `/brand-sources`, `/legacy`, `/api/gcc-v2`, `/api/rag`) — session behavior changes must **remain inside that matcher** and ship with a route-isolation test. Do not broaden matcher to v1 hubs.

---

## Keep contracts (stricter than “warnings must surface”)

Every kept degraded mode has an allow-list, fail path, provenance fields, and authz rule. If the contract cannot be met, **fail closed** (or notify-and-skip for partner/competitor only).

### K1 — Partner/competitor notify-and-skip

| Field | Contract |
|-------|----------|
| **When** | External partner/competitor seed has no usable RAG chunks and no authorized seed page |
| **Must** | Append `partnerResearchWarnings`; restrict uncited partner claims; generate may continue for types that allow skip ([citeable-create-pipeline.md](citeable-create-pipeline.md) §1) |
| **Must not** | Invent partner facts; omit warning from API/UI |
| **Authz** | `runId` / seed host authorized for current owner/workspace |

### K2 — RAG → seed HTML (split by grounding class)

**Project-site (required grounding)** — seed HTML is **valid evidence**, not a soft warning path:

| Field | Contract |
|-------|----------|
| **Allowed when** | (1) Geek-Crawler-Rag index empty/pending/unavailable for that authorized `runId`, **and** (2) seed page HTML exists from the **authorized project-site crawl** bound to this create/job |
| **Artifact** | Persist/expose source unit: canonical URL, `pageId`, content digest/`sourceDigest`, `runId`, crawl timestamp |
| **Provenance** | Every citation/use sets `retrievalMode: "seed_html"` (distinct from `"rag_chunk"`); Canvas/Validate can show “seed HTML (non-index)” |
| **Fail closed when** | Seed extraction missing, empty body, digest mismatch vs crawl snapshot, unauthorized `runId`, or crawl older than freshness policy for ship-ready — **do not** generate as if grounded; job/stage error with “re-crawl project site” / “wait for index” recovery |
| **Authz test** | Seed HTML from foreign `runId` → safe failure; no citation emitted |

**Partner/competitor (optional research)** — seed HTML after empty RAG is **notify-and-skip adjacent**:

| Field | Contract |
|-------|----------|
| **Allowed when** | Authorized partner/competitor run has seed page HTML |
| **Must** | Same artifact + `retrievalMode: "seed_html"`; warning if index was empty/pending |
| **When seed also missing** | Skip that seed + warning (do not invent); do not fail entire blog/pillar generate solely for partner gap |

### K3 — Hierarchy soft-fail

| Field | Contract |
|-------|----------|
| **When** | Playwright/fetch unavailable or thin |
| **Must** | Return null hierarchy; amber UI; never invent heading tree |
| **Must not** | Pretend partners were hierarchy-matched when tree absent |

### K4 — `usedFallbackStub` WRITE stub

| Field | Contract |
|-------|----------|
| **Must** | `usedFallbackStub: true` on section + amber “Draft needs review”; VALIDATE treats as needs review |
| **Must not** | Ship-ready without operator acknowledgment of stub sections |

### K5 — Operator model downgrade

| Field | Contract |
|-------|----------|
| **Must** | Explicit checkbox + reason before non–best-quality path |
| **Must not** | Silent provider/model switch on outage (see F3) |

---

## Finding inventory (disposition)

Stable IDs. Completion = disposition done + named test green + evidence note.

| ID | Severity | Location | Disposition | Test / evidence |
|----|----------|----------|-------------|-----------------|
| F1 | P0 | GSC/Drive/SP stub connect (GeekAPI + phi) | **Done** | `GccV2FallbackCorrectnessTests` stub policy; phi notices use `status==="stub"` |
| F2 | P0 | `GccV2CmsPublishService` category fallback | **Done** | Fail closed in `ResolveCategorySlugAsync` before mutation |
| F3 | P0 | Negotiate + RAG capabilities | **Done** | Typed `CapabilitiesTransportError` / `CapabilitiesUnavailableException`; v2-only reason on provenance |
| F4 | P1 | `GccV2PlanService` invented FAQ | **Done** | Empty PAA → no FAQ section |
| F5 | P1 | `creates/rag-client/*` | **Done** | `LoadResult<T>` + create-form error UI |
| F6 | P1 | Empty-list cluster | **Done** | Batches 2a–2e error ≠ empty |
| F7 | P1 | `creates/[id]/page.tsx` | **Done** | Metadata/jobs error banner |
| F8 | P2 | `roi-api.ts` unknown → demo | **Done** | Unknown source badge (not demo) |
| F9 | P1 | Hub rejoin swallow | **Done** | Rejoin fail → “Live updates disconnected — refresh.” |
| F10 | P1 | `proxy.ts` | **Done** | Invalid clears; 5xx/network preserves; `proxy-session.spec.ts` |
| F11 | P2 | Legacy wizard | **Done** | Guided-only; dead Step types removed |
| F12 | P3 | sessionStorage swallow | **Keep** | N/A |
| F13 | P3 | Tone / `FALLBACK_NEXT` / discovery facets | **Keep** | N/A |
| K1–K5 | — | Keep contracts above | **Keep** + hardened | Seed-HTML provenance + authz tests in `GccV2FallbackCorrectnessTests` |
| O1 | — | Geek-Crawler-Rag / GeekOAuth / GeekRepository concurrency | **Out of scope** | [security-queue.md](security-queue.md) |

---

## Shared phi contract: `Result<T>`

Implemented as `src/app/lib/load-result.ts` → `LoadResult<T>`.

| State | UI |
|-------|-----|
| Loading | Disabled control + “Loading…” (not empty options alone) |
| `ok` + empty | “None yet” / create CTA |
| `error` | Disabled control + error text + Retry; `aria-live="polite"` |
| `unauthorized` | Sign-in prompt where applicable |

---

## Work checklist

- [x] **F1** Stub gate: default false; startup reject outside local/e2e; audit log; phi uses server `status`/`mode`
- [x] **F2** CMS category preflight before mutation + fail closed + partial-write discoverability
- [x] **F3** Typed capability errors; retryable transport; v2-only provenance; no null→v2
- [x] **F4** PLAN FAQ no invention
- [x] **K2** Seed HTML provenance (`retrievalMode`) + fail closed for project-site when seed bad + authz test
- [x] **2a–2e** Result\<T\> batches
- [x] **F8** ROI unknown source
- [x] **F9** Hub rejoin banner
- [x] **F10** Proxy: invalid clears; network preserves (+ optional 1 retry)
- [x] **F11** Legacy wizard removal
- [x] Master-plan §5 tick + inventory rows marked done with evidence

---

## Acceptance evidence (2026-09-14)

| Test | Result |
|------|--------|
| `GccV2FallbackCorrectnessTests` (stub + seed + negotiate codes) | Passed |
| `GccV2GeekCrawlerResearchResolverTests` (incl. seed_html in brief) | Passed |
| `GccV2UnifiedRag` + governed skills filter | Passed |
| phi `npm run typecheck` | Passed |
| Grep `.catch(() => setX([]))` on list loads | Zero remaining |
| `tests/e2e/proxy-session.spec.ts` | Added (matcher isolation + invalid refresh) |

---

## Out of scope

- O1: Geek-Crawler-Rag / GeekOAuth / GeekRepository concurrency ([security-queue.md](security-queue.md)).
- Removing K1 notify-and-skip or K3 hierarchy soft-fail (contracts hardened, not deleted).
- LlamaParse or poll-based job status.

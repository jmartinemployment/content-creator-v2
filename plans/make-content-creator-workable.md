# Make Content Creator workable: one RAG-grounded content pipeline

**Created:** 2026-09-12
**Target environment:** deployed phi → production GeekAPI
**Related:** [`fix-create-plan-signalr-errors.md`](./fix-create-plan-signalr-errors.md) (P0 production create/SignalR), [`jasper-remaining-work.md`](./jasper-remaining-work.md) (fuller product backlog), [`rag-content-writing-pipeline.md`](./rag-content-writing-pipeline.md) (writer implementation history)

## Context

The stated job: produce content for geekatyourspot.com, grounded in RAG over partners and competitors, with tool advertisements as the near-term output — using the fourteen specialized agents **as part of** that pipeline, not as a separate track.

Verified against code, not assumed: nothing is stubbed at the code layer — ~28k lines of frontend, all 18 purpose-specific result renderers exist, all 16 RAG analysis endpoints exist backed by ~3,700 lines of real Python analysis, and the RAG service answers live right now. The problem is that three RAG-grounded systems exist and none of them know about each other, and a first pass at this plan tried to fix all three in place at once. Revised below into a contract-first, vertical-slice-first sequence after review.

### The three systems, and why they don't tie together

**1. `/rag` — the writer.** Retrieves from the indexed partner/competitor crawl corpus automatically, verifies quotes, shows citations, supports ad-template few-shot. `GeekAPI POST /api/rag/generate` → `RagGenerateService` → Geek-Crawler-Rag `v1/query` / `v1/generate`.

**2. The fourteen task agents — a second, disconnected generation path.** Nine diagnostics/intelligence (readiness, fact-density, entity-mapper, schema-markup, query-planner, readiness-comparison, content-gap, competitor-audit, competitor-positioning), five content (citable-claims, faq-generator, comparison-brief, pillar-article, competitive-response). All fourteen run through `GccV2TaskRunWorker` → `RunDiagnosticAsync` → Geek-Crawler-Rag `v1/diagnostics/*`, `v1/intelligence/*`, `v1/content/*` — the same underlying corpus and RAG service, through entirely separate code, with no shared entity model, no shared ad templates, no shared citation format.

Several agents don't retrieve from the corpus at all: `content-gap`'s input form (`src/app/task-agents/input-adapters.ts:311-329`) asks the user to **paste competitor page content by hand** into `competitorContent`. That's a form calling an LLM, not RAG. The corpus `/rag` already draws from sits unused.

**3. Chaining exists in the backend but reaches nothing.** `GccV2TaskAgentNextActions.cs` maps each agent's output artifact type to a downstream capability (e.g. `contentGapAnalysis.v1 → content-gap`) but only ever agent-to-agent. Nothing maps a diagnostic finding into `/rag`; nothing maps a finished draft back into an agent.

**Two secondary findings:**

- **`/rag` is not in top-level navigation** (`src/app/components/product-shell.tsx:8-18` lists eleven items, none is `/rag`). Reachable only by typing the URL.
- **Pipelines is a dead end.** `GccV2PipelinesController.StartRun` writes a run row; no worker in `AddHostedService` (`ServiceRegistration.cs:67-161`) ever advances a stage after that. A pipeline has ordered stages where stage 2 waits on stage 1 finishing — that stage-advancing code doesn't exist. Unrelated to the fourteen agents, which run fine on their own worker.

### Why this plan is sequenced the way it is

An earlier draft proposed migrating all five content agents onto `RagGenerateService`, building bidirectional chaining, moving ad templates to a database, and redoing navigation — as parallel milestones with no shared data contract between them. That risks standardizing the UI while backends keep interpreting payloads differently, and turns "migrate the content agents" — the highest-risk item, since it touches artifact schemas, versioning, discovery facets, and retry/idempotency for five live capabilities — into an unstaged one-line bullet.

This revision fixes that: define the contracts once, prove them on one capability end-to-end, then generalize. Security remediation is pulled out of "polish" and moved first, since it's independent of everything else and shouldn't wait on product sequencing.

## P0 — Security prerequisite (independent of everything below)

`GEEK_CRAWLER_RAG_URL=http://2.24.101.90:8080` — plaintext HTTP to a bare IP, carrying `GEEK_CRAWLER_RAG_API_KEY` in the clear on every GeekAPI → RAG call.

- Terminate TLS in front of Geek-Crawler-Rag; move to a hostname; verify GeekAPI validates the certificate (not just that the request succeeds).
- Confirm both local GeekAPI and Railway production point at the new URL; disable the old plaintext listener rather than leaving it reachable alongside.
- Rotate `GEEK_CRAWLER_RAG_API_KEY` — it has been transmitted in the clear.
- Audit logs/config for the key in plaintext.

This blocks nothing else in the plan and should not wait on it.

## Milestone 1 — Canonical contracts

No UI or migration work until these are written down and agreed, because Milestone 2's vertical slice and Milestone 3's generalization both depend on them being right the first time.

- **`ResearchEntity`** — the shared partner/competitor representation, replacing `/rag`'s ad hoc `entitySeeds` (`rag-writer-form.tsx:33`) and each agent's own free-text fields. Must answer: what is the identity key (crawl corpus page ID, URL, or a new GeekRepository entity record)? How does one company with multiple indexed pages resolve to one entity? Is `partner`/`competitor` role stored on the entity or supplied per-request? What happens when an entity has no crawl yet (manual paste-in remains the fallback, never the primary path)?
- **`WriterBrief`** — the handoff payload from any diagnostic/intelligence result into `/rag`. Must carry the originating artifact ID (for lineage), topic, `ResearchEntity[]`, and capability-specific evidence (gap findings, recommended queries, evidence URLs) rather than each result view inventing its own mapping into `/rag`'s form fields.
- **Retrieval equivalence definition** — "same corpus" does not imply "same retrieval." Before any content agent is migrated, define what equivalence means (same entity pair + topic + corpus snapshot → same retrieved document IDs and source URLs) so Milestone 3's migration has something concrete to verify against, not just "both requests succeed."
- **Next-action edges** — extend `GccV2TaskAgentNextActions`' existing artifact-type → capability map to include `/rag` as a valid destination in both directions, rather than adding a second, frontend-only mapping. This is the one typed map every "write from this finding" and "follow-on from this draft" affordance reads from.

## Milestone 2 — One vertical slice, end to end

Prove the contracts on a single path before touching the other thirteen agents or any UI chrome.

1. Migrate `content-gap` off manual paste-in to `ResearchEntity`-based corpus retrieval.
2. Add "Write from this finding" on its result view, constructing a `WriterBrief` and landing in `/rag` with entities and topic pre-filled.
3. Generate a draft in `/rag`; confirm citations trace back to the same corpus documents `content-gap` retrieved (retrieval-equivalence check from Milestone 1, not just "it rendered").
4. Add one reverse edge: the finished draft offers `faq-generator` as a follow-on, using the next-action map, carrying the draft's entities and at least one evidence reference forward.
5. Write contract/fixture tests for `ResearchEntity` normalization, `WriterBrief` construction, and the next-action edge — before any production smoke test, so the common failure modes are caught deterministically.

Do not proceed to Milestone 3 until this slice works signed-in against deployed phi and the fixtures pass.

## Milestone 3 — Generalize

- Migrate the remaining eight diagnostics/intelligence agents onto `ResearchEntity` retrieval, same pattern as `content-gap`.
- Migrate the four remaining content agents (citable-claims, comparison-brief, pillar-article, competitive-response) onto the same `RagGenerateService` path `faq-generator` proved in Milestone 2, one at a time. For each: confirm the artifact schema stays backward-compatible (existing saved artifacts of that type must still render), keep the old `v1/content/*` route live until the migrated version is confirmed in production use, then retire it explicitly rather than leaving both paths running indefinitely.
- Wire the remaining next-action edges (diagnostic → `/rag`, draft → remaining content agents) using the same typed map extended in Milestone 1.

## Milestone 4 — Shared persistence: ad templates

- Move ad templates off `localStorage` (`src/app/rag/ad-templates.ts:3`, key `gcc-v2-rag-ad-templates`, seeded with three generic samples unrelated to tool ads) into a GeekRepository collection with a GeekAPI controller, per the standing constraint that backend work stays inside GeekAPI + GeekRepository with no new Railway services.
- Define ownership before writing the schema: are templates per-user or shared org-wide? What's the authorization check on write? How are duplicate names, soft deletion, and a max body size handled? Existing `localStorage` templates need an explicit one-time migration path (import on next visit, or accept they're lost) — decide which, don't leave it implicit.
- Seed with real tool-ad templates once the schema is settled.
- Acceptance criterion is tenancy-scoped, not just "appears in another browser": a template saved by one user appears for every session **that should** see it, and not for one that shouldn't.

## Milestone 5 — Surface it, bounded

- **Add `/rag` to primary navigation**, labeled for the job ("Write"). Regroup `product-shell.tsx`'s flat eleven-item `NAV` into a short **Create** group and a collapsed **Configure** group, reusing the existing `futureNav` pattern (`product-shell.tsx:21`) built for this exact demotion. Bounded acceptance: the primary CTA opens `/rag`; no other nav or dashboard change is required to close this milestone.
- **Dashboard leads with the writer**, extending the existing "Recent content" panel: acceptance is the three most recent drafts are visible and resumable in one click. Nothing broader than that is in scope here.
- **Hide Pipelines completely, not just from nav.** Confirm `/pipelines` and `/pipelines/[id]` either redirect or render an explicit "not available" state rather than a working-looking form that silently does nothing; confirm `StartRun` is disabled server-side, not only hidden client-side, since a direct API call or bookmark must not still create an inert run.
- **Replace the blanket agent failure message** with `RagGenerateService.GetStatus()`'s specific reason (already computed, already wired to `/api/rag/status`), so a RAG hiccup doesn't read as fourteen simultaneous feature failures.

## Verification

**Deterministic, before any production check** — these catch the common failure modes without depending on live infrastructure:
- `ResearchEntity` normalization (single entity with multiple crawled pages resolves to one record; missing corpus entry falls back correctly)
- `WriterBrief` construction from each migrated capability's artifact shape
- Next-action edge resolution in both directions
- Retrieval-equivalence check between `content-gap` and `/rag` on a fixed entity pair and corpus snapshot
- Backward-compatible artifact parsing for each migrated content agent's pre-migration output
- `RagGenerateService.GetStatus()` reason propagation when RAG is forced unreachable

**Signed-in against deployed phi → prod**, since that's this plan's definition of "working":
1. `GET /api/rag/status` → `available: true`, or a `reason` that names the cause.
2. Round trip: `content-gap` on a real entity pair → "Write from this finding" → `/rag` draft with entities pre-filled and citations that trace to the same corpus documents → follow-on into `faq-generator`.
3. Template saved in one session is visible in another session with access, absent from one without.
4. Every remaining primary nav item reaches something that performs work; `/pipelines` shows its explicit unavailable state rather than a live-looking dead end.

Add one signed-in production smoke spec covering steps 1-2, using a fixed seeded entity pair (not arbitrary user input) so it's reproducible and doesn't create unbounded content, kept separate from the fake-platform suite and out of `test:ci` so real-infrastructure failures stay visible instead of mocked away.

## Out of scope

- Building the Pipelines stage-advancing worker (a durable executor where each stage waits on the one before it) — a separate, larger piece of work that doesn't block the RAG content job. This plan only requires Pipelines to stop presenting as functional.
- ROI calculator and Studio (custom agent authoring) — neither blocks the partner/competitor content job.
- Rebuilding generation from `plan/v2-master.md` or other historical plans.
- New Railway compute services.
- Consolidating the fifteen documents in `plan/`.
- Observability (correlation IDs, latency/citation-rate dashboards, feature-flagged rollout) — real needs, but a separate initiative once the vertical slice proves the contracts are right; adding instrumentation before that risks building telemetry for a shape that's about to change.

## Todos

- [ ] P0: TLS + hostname for Geek-Crawler-Rag; rotate API key; confirm cert validation, not just request success
- [ ] M1: define `ResearchEntity`, `WriterBrief`, retrieval-equivalence criteria, and extended next-action map
- [ ] M2: migrate `content-gap` to corpus retrieval; wire "Write from this finding"; verify retrieval equivalence; add `faq-generator` follow-on; write fixture tests
- [ ] M3: migrate remaining 8 diagnostic/intelligence agents to `ResearchEntity`
- [ ] M3: migrate remaining 4 content agents to `RagGenerateService`, one at a time, old routes retired explicitly after confirmation
- [ ] M3: wire remaining next-action edges
- [ ] M4: ad templates to GeekRepository with explicit tenancy model and migration path from `localStorage`
- [ ] M5: `/rag` in primary nav; dashboard shows 3 most recent resumable drafts
- [ ] M5: `/pipelines` disabled server-side, not just hidden
- [ ] M5: blanket agent failure message replaced with specific RAG status reason
- [ ] Deterministic fixture tests (entity, brief, next-action, retrieval-equivalence, backward-compat, status propagation)
- [ ] Signed-in production smoke spec on fixed seeded entities, excluded from `test:ci`

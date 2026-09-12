# Remaining Jasper work

**Created:** 2026-09-12  
**Authority:** current code + recent commits — not `plan/v2-master.md` or other obsolete plans  
**Related:** [`fix-create-plan-signalr-errors.md`](./fix-create-plan-signalr-errors.md) (P0 production create/SignalR)

## Product goal

Ship Jasper-parity **task applications**:

- Fourteen purpose-built agents discovered through an **Agent Library**
- Grounded by **Geek IQ** (shared context plane)
- Fed by **CC-owned Google Search Console** (copy Geek-SEO patterns; do not call Geek SEO at runtime for Creator GSC)
- Composable through **Geek Content Pipelines** + **Grid**
- Plus **ROI Business Calculator** and **Custom Agent Studio**

Not a flat Writing/Marketing/SEO/AEO specialist picker.

### Hard constraint

All backend work stays inside **GeekAPI + GeekRepository**. No new Railway compute services. Keys and orchestration on GeekAPI only.

### The fourteen agents

| # | Name | Capability ID | Workflow |
|---|------|---------------|----------|
| 1 | AI Readiness Score | `ai-readiness` | Optimize |
| 2 | Fact Density Audit | `fact-density` | Optimize |
| 3 | Entity Mapper | `entity-mapper` | Optimize |
| 4 | Schema Markup | `schema-markup` | Optimize |
| 5 | Query Planner | `query-planner` | Originate |
| 6 | AI Readiness Comparison | `ai-readiness-comparison` | Optimize |
| 7 | Gap Finder | `content-gap` | Outrank/Optimize |
| 8 | Competitor Audit | `competitor-audit` | Outrank |
| 9 | Competitor Positioning | `competitor-positioning` | Outrank |
| 10 | Citable Claims | `citable-claims` | Originate/Optimize |
| 11 | FAQ Generator | `faq-generator` | Originate |
| 12 | Comparison Brief | `comparison-brief` | Originate |
| 13 | Pillar Article | `pillar-article` (outline remains `pillar-outline`) | Originate |
| 14 | Competitive Response | `competitive-response` | Outrank |

**Custom Agent** (Studio) is a separate 15th capability. **ROI** is `roi-business-calculator`.

### Per-agent definition of done

1. Immutable task-agent version: input/output schemas, discovery facets, context policy, renderer, next actions, digest  
2. Durable owner-scoped run: progress, cancel, typed artifact, citations/evidence, rerunnable snapshot  
3. Purpose-specific result view (not raw JSON fallthrough)  
4. Cross-language contract fixtures + fake-platform e2e (form → run → result)  
5. Partial-source / missing-crawl → typed findings — never silent cohort reduction  
6. Query provenance labeled `observed` \| `imported` \| `generatedHypothesis` where applicable  
7. Discoverable in Agent Library by outcome facets  

---

## Already shipped (do not re-plan)

Treat these as done unless a regression appears:

- **Geek IQ** UI (`/brand-sources`) + catalogs: Brand Voice, Knowledge, Audiences, Style Guide, Visual Guidelines schema, Product IQ gates  
- **Knowledge connectors:** URL, GSC, Drive, SharePoint; gated local **image** OCR; run attachments from-url  
- **CC-owned GSC** OAuth + Knowledge `from-gsc`  
- **Agent Library** prefs on `/task-agents`: favorites, saved configs, facets  
- **Fourteen agents + ROI** seeded; `pillar-article` exists alongside outline  
- **Pipelines:** definition/run/work-item/stage-attempt, TaskRun fan-out, approval pause, canvas/publish handoffs, Grid↔pipeline binding, Optimize ROI stage  
- **Studio:** custom-agent authoring/generate gates  
- **Grid:** CSV import/export, Canvas asset attach, pipeline projection  

Recent BE/FE commits through image OCR / SharePoint / Drive / pipeline approval are in this bucket.

---

## Remaining backlog (priority order)

### P0 — Make production creates work

Local phi on `:3004` defaults to production GeekAPI. Creates currently fail PLAN / SignalR when prod env is incomplete.

- [x] Set/verify Railway GeekAPI: `SKILL_SNAPSHOT_*`, agent-team signing, `GEEK_CRAWLER_RAG_*`, citeable generate flags  
- [x] Match RAG `SKILL_SNAPSHOT_SIGNING_KEY_ID`  
- [x] Redeploy GeekAPI; harden empty-config masking of env  
- [ ] Operator: retry create / confirm SignalR with valid hub-token session  
- Details: [`fix-create-plan-signalr-errors.md`](./fix-create-plan-signalr-errors.md)

### P1 — Close the fourteen agents to DoD

Most agents are **partial shells** (seeded + UI + some RAG path). Bring each to the DoD checklist above.

**Suggested order**

1. Diagnostics: `ai-readiness`, `fact-density`, `entity-mapper`, `schema-markup`  
2. Planning / competitive: `query-planner`, `ai-readiness-comparison`, `content-gap`, `competitor-audit`, `competitor-positioning`  
3. Content: `citable-claims`, `faq-generator`, `comparison-brief`, `pillar-article` (full article quality, not outline-only), `competitive-response`  

Gaps to close across the set: evaluation suites / release thresholds, partial-crawl honesty everywhere, production smoke, purpose renderers, follow-on chains.

### P2 — Geek IQ completion

- IQ selectors on every task-agent run form; exact versions pinned in every run snapshot  
- Knowledge freshness warnings; clear **Add content** (run attachment) vs **Add to Knowledge**  
- Project-site crawl → governed Knowledge promotion (preserve crawl/page IDs, digests, freshness)  
- Product IQ approved-claim + mandatory-disclaimer gates on paths that assert product truth  
- **Audio/video** Knowledge remain fail-closed until local transcription/keyframes (image OCR already feature-gated)

### P3 — GSC as agent data (not only Knowledge)

CC-owned OAuth + Knowledge ingest exists. Still needed:

- Query Planner (and any agent claiming “real query data”) labels `observed` only from CC GSC store or explicit import  
- Prefer `/gsc/connections/{id}/observed-queries`; finish deprecation of any Geek SEO rankings bridge for Creator  
- Keep GSC metrics separate from AI-visibility / model observations  

### P4 — Pipelines + Grid maturity

- Fuller **async DAG** workers (durable stage advancement beyond sync `StartRun`)  
- Budgets, richer Plan→Create→Adapt→Activate→Optimize templates, history UX  
- Grid schedules trigger **pipeline** runs (not orphaned cell stubs only)  
- Expand Grid demos beyond `faq-generator` / `pillar-outline` once those agents meet DoD  

### P5 — Canvas / Studio / ROI

- Multi-asset project workspace: typed assets, handoffs across all fourteen capabilities  
- Studio: visibility scopes, test suites/thresholds, publish / deprecate / rollback rigor  
- ROI agent: transparent deterministic formulas + labeled reconciliation (`modeled` \| `telemetry-measured` \| …); `/roi` as thin entry into the same result shell  

### P6 — Verification and rollout

- Cross-language fixtures for all fourteen artifacts  
- E2E: library → run → result → Canvas / Grid / pipeline handoff  
- Server-side gates, signed-in production smoke, rollback runbooks per capability  

---

## Explicitly out of scope

- Rewriting generation from obsolete `v2-master`  
- New Railway sidecars (ClamAV, “context compute”, etc.)  
- Hosted multimodal parsers  
- Consolidating historical garbage plans into a mega-master  

---

## Immediate next slice

After **P0** env/SignalR fix is green, pick **one**:

1. Query Planner CC-GSC `observed` provenance (P3)  
2. Async pipeline stage worker (P4)  
3. Weakest diagnostic agent DoD gap (P1)  

---

## Todos

- [ ] P0: production signing + RAG + SignalR (see fix-create plan)  
- [ ] P1: fourteen agents to DoD (diagnostics → planning → content)  
- [ ] P2: Geek IQ selectors, freshness, promotion, Product IQ gates; AV stay fail-closed  
- [ ] P3: GSC observed provenance on agents; drop SEO bridge for Creator  
- [ ] P4: async pipeline DAG + Grid schedule→pipeline  
- [ ] P5: Canvas / Studio / ROI depth  
- [ ] P6: fixtures, e2e, smoke, rollouts  

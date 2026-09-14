# Remove remaining Create fallbacks (complete)

**Updated:** 2026-09-14  
**Accountable owner:** Jeff Martin  
**Release authority:** [master-plan.md](master-plan.md)  
**Honesty rule:** [`.cursor/rules/no-fallbacks.mdc`](../.cursor/rules/no-fallbacks.mdc)  
**Related (partner/competitor seeds):** [remove-partner-seed-html-fallback-complete.md](remove-partner-seed-html-fallback-complete.md)

**Status: Complete** — GeekAPI eng (2026-09-14). External Create research is library-only (partner, competitor, **local**); brief/topic-only draft forbidden; pre-PLAN gaps for missing run IDs (Appendix A every Create); tool overview keyword-only removed; citeable attribution strict-only; ad template soft-disabled success removed; task-agent dual-engine hydrate; Playwright unavailable fails closed for hierarchy fetch. Jeff signed-in smoke remains master-plan §7.

---

## Already closed (do not re-open)

| Item | Where | Done |
|------|--------|------|
| Partner/competitor Mongo `seed_html` | `TryResolveExternalSeedAsync` library-only | [remove-partner-seed-html-fallback-complete.md](remove-partner-seed-html-fallback-complete.md) |
| Unfiltered adopt-all RAG pages on host miss | same | same |
| Preflight “generate still runs / seed pages” copy | `GccV2Controller.externalResearchNote` | same |

---

## Done checklist (implementation complete)

| ID | Item | Status | Where |
|----|------|--------|--------|
| F1.1 | Local (+ all external) seed-HTML removed | Done | `GccV2GeekCrawlerResearchResolver.TryResolveExternalSeedAsync` — library-only; Mongo extract deleted from external path |
| F1.2 | Brief/topic-only Create draft | Done | `RagGenerateService.DraftFromCreateLibraryAsync` throws |
| F1.3 | Manifest soft warnings → gaps | Done | `GccV2PrePlanEvidenceManifestAssembler` — partner+competitor gaps every Create |
| F1.4 | Tool overview keyword-only | Done | `GccV2ToolOverviewWriteService` throws when no partner jobs |
| F1.5 | Attribution quote softening | Done | `ResolveAttributionQuote` strict-only; partner WRITE throws on miss |
| F2.1 | RAG null soft paths (Create) | Done | Create library draft already throws when RAG unset / empty with runs |
| F2.2 | Ad template soft-disabled success | Done | `IndexAdTemplatesAsync` throws |
| F2.3 | Task-agent HTTP→PW | Done | Dual-engine documented; both fail → hard fail |
| F2.4 | Playwright unavailable | Done | `GccV2PageFetcher` throws; controller rethrows |
| F3 | Copy / stub honesty | Done | No “Continuing without it” / “Generate continues”; new stubs not set |
| Tests | Lock table | Done | Fallback + resolver + unified RAG + partner tool tests |

**Note:** Project-site **on-site** HTML extract (`ResolveOnSite*`) remains project-site grounding (not Geek-Crawler external seed-HTML). F4 ops health `degraded` stays infra-only.

---

## Principles (non-negotiable)

1. **Required evidence fails closed** — missing run IDs, empty library pages, RAG disabled, index not ready → gap / typed exception / terminal `failed`.
2. **No secondary corpus** for Create partner / competitor / required local research.
3. **Warnings ≠ cleared gaps**.
4. **SoftDisabled / SoftUnavailable ≠ citeable success**.
5. **Kill switch OFF** remains fail closed.
6. **RAG = library only** — Create writer stays GeekAPI `gcc-create-library.v1`.

---

## Explicit non-goals

- Reintroducing `/v1/generate` or SoftDisabled citeable success.  
- Partner/competitor **structured extraction** ([partner-extraction-complete.md](partner-extraction-complete.md), [competitor-extraction-complete.md](competitor-extraction-complete.md)).  
- Broad Geek-Crawler-Rag ops redesign (F4 document-only).

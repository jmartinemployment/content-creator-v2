# Citeable Create M3 — generalize + Canvas UX

**Status:** In progress (operator **overrode** M2 smoke gate 2026-09-14)  
**Authority:** [master-plan.md](master-plan.md) §4  
**Depends on:** [citeable-create-pipeline.md](citeable-create-pipeline.md) M1–M2 policies (smokes deferred, not waived forever)  
**Do not:** reopen a second writer UI; claim M2 “done when” without smokes  

### Gate note

M2 signed-in smokes remain **deferred**. M3 proceeds by operator override. Return to citeable §Smoke log before declaring program M2/M3 release-ready.

---

## Goals

1. **Content-type map** — enforce partner/competitor evidence policy rows beyond `blog` (tool fail-closed; comparison/alternatives per named subjects).
2. **Canvas citeable UX** — honest verified vs unverified citations; surface evidence gaps on outline + draft.
3. **Task-agent → Create** — next actions open `/creates/new` with `contentType` (+ topic when known), not only other task agents.

---

## Wave 1 (this slice)

| Item | Deliverable |
|------|-------------|
| W1a | Pre-PLAN fail-closed partner for `tool`; `ads` when `operatorTools` present; `comparison`/`alternatives` when partner tools named |
| W1b | Task-agent result shell: Create deep links in next-actions |
| W1c | Canvas/SectionCitations: count and label only `verified === true` as verified; show gaps |
| W1d | Plans + fixture tests |

## Wave 2 (next)

| Item | Deliverable |
|------|-------------|
| W2a | Prefill Create from artifact payload (tools/competitors/claims) |
| W2b | Outline tab: evidence strip parity with brief tab |
| W2c | Short-form types: explicit “no section coverage gate” contract in UI |

## Done when (M3)

- Tool create without partner run fails closed at pre-PLAN with actionable copy  
- Comparison/alternatives with named partners fail closed without partner run  
- Content-writing task agents expose ≥1 **Write in Create** next action  
- Canvas never labels unverified quotes as “verified”  
- M2 smoke log still open until operator returns  

---

## Review checklist

- [x] W1a–W1d shipped (await deploy)
- [ ] Wave 2  
- [ ] M2 smokes completed (deferred)  

# Plans

**Sole release-plan & decision record:** [master-plan.md](master-plan.md)

| Concern | Where |
|---------|--------|
| Release gates, §7 tracker, smokes, kill switch, Appendices A–E | [master-plan.md](master-plan.md) |
| **Competitor extraction plan (complete)** — `gcc-competitor-extraction.v1` + §9 chunking + claim-risk VALIDATE + PLAN type routing | [competitor-extraction-complete.md](competitor-extraction-complete.md) |
| **Partner extraction plan (complete)** (citable, ads, comparison, alternatives, pricing/ICP/FAQ min-expand, partner SoftwareApplication JSON-LD) — `gcc-partner-extraction.v2` | [partner-extraction-complete.md](partner-extraction-complete.md) |
| **Remove partner/competitor Mongo seed-HTML fallback** (library-only resolve) | [remove-partner-seed-html-fallback.md](remove-partner-seed-html-fallback.md) |
| **Remove remaining Create fallbacks** (local seed-HTML, brief-only draft, keyword-only overview, soft gaps, quote soften, RAG soft-disable) | [remove-remaining-fallbacks.md](remove-remaining-fallbacks.md) |
| **Fix run_attachment not_ready** (reclaim/wake/pending gate/status UI) | [fix-attachment-not-ready.md](fix-attachment-not-ready.md) |
| **Fix attach before save** (no dead-end Save copy; ensure create id on Review) | [fix-attach-before-save.md](fix-attach-before-save.md) |
| **Geek IQ empty-state UX** (no gray wall of disabled selects) | [geek-iq-empty-state.md](geek-iq-empty-state.md) |
| **H1/H2 image prompts for all types** (tools first-class; tools = partners) | [image-prompt-h1-h2.md](image-prompt-h1-h2.md) |
| **Per-format specialist teams** — **Complete** (keep SEO/AEO for covered formats; subset resolve per job) | [per-format-specialist-teams-complete.md](per-format-specialist-teams-complete.md) |
| Platform / API / isolation contracts | [`../architecture.md`](../architecture.md) |
| Agent-enforced non-negotiables | [`../.cursor/rules/master-plan-nonnegotiables.mdc`](../.cursor/rules/master-plan-nonnegotiables.mdc) |
| Honesty (stubs / fallbacks / correctness) | [`../.cursor/rules/`](../.cursor/rules/) |

**Sync rule:** When Non-negotiables or P0 honesty language in `master-plan.md` change, update `.cursor/rules/` in the same change. Rules mirror the plan — they are not a second authority.

**Live tracker:** master-plan **§7**. P1.5 (`sourceRights`) must pass before R1a/R1b count toward release.

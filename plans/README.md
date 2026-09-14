# Plans

**Sole release-plan & decision record:** [master-plan.md](master-plan.md)

| Concern | Where |
|---------|--------|
| Release gates, §7 tracker, smokes, kill switch, Appendices A–E | [master-plan.md](master-plan.md) |
| **Competitor extraction plan (complete)** — `gcc-competitor-extraction.v1` + §9 chunking + claim-risk VALIDATE + PLAN type routing | [competitor-extraction-complete.md](competitor-extraction-complete.md) |
| **Partner extraction plan (complete)** (citable, ads, comparison, alternatives, pricing/ICP/FAQ min-expand, partner SoftwareApplication JSON-LD) — `gcc-partner-extraction.v2` | [partner-extraction-complete.md](partner-extraction-complete.md) |
| **Remove partner/competitor Mongo seed-HTML fallback** — **Complete** (library-only resolve) | [remove-partner-seed-html-fallback-complete.md](remove-partner-seed-html-fallback-complete.md) |
| **Remove remaining Create fallbacks** — **Complete** (local seed-HTML, brief-only draft, keyword-only overview, soft gaps, quote soften, RAG soft-disable) | [remove-remaining-fallbacks-complete.md](remove-remaining-fallbacks-complete.md) |
| **Fix run_attachment not_ready** — **Complete** (reclaim/wake/pending gate/status UI) | [fix-attachment-not-ready-complete.md](fix-attachment-not-ready-complete.md) |
| **Fix attach before save** — **Complete** (no dead-end Save copy; ensure create id on Review) | [fix-attach-before-save-complete.md](fix-attach-before-save-complete.md) |
| **Geek IQ empty-state UX** — **Complete** (no gray wall of disabled selects) | [geek-iq-empty-state-complete.md](geek-iq-empty-state-complete.md) |
| **H1/H2 image prompts for all types (complete)** (tools first-class; tools = partners) | [image-prompt-h1-h2-complete.md](image-prompt-h1-h2-complete.md) |
| **Per-format specialist teams** — **Complete** (keep SEO/AEO for covered formats; subset resolve per job) | [per-format-specialist-teams-complete.md](per-format-specialist-teams-complete.md) |
| Platform / API / isolation contracts | [`../architecture.md`](../architecture.md) |
| Agent-enforced non-negotiables | [`../.cursor/rules/master-plan-nonnegotiables.mdc`](../.cursor/rules/master-plan-nonnegotiables.mdc) |
| Honesty (stubs / fallbacks / correctness) | [`../.cursor/rules/`](../.cursor/rules/) |

**Sync rule:** When Non-negotiables or P0 honesty language in `master-plan.md` change, update `.cursor/rules/` in the same change. Rules mirror the plan — they are not a second authority.

**Live tracker:** master-plan **§7**. P1.5 (`sourceRights`) must pass before R1a/R1b count toward release.

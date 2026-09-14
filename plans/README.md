# Plans

**Sole release-plan & decision record:** [master-plan.md](master-plan.md)

| Concern | Where |
|---------|--------|
| Release gates, §7 tracker, smokes, kill switch, Appendices A–E | [master-plan.md](master-plan.md) |
| **Competitor Analysis plan** (strategy, min-expand + competitor-specific payloads, chunking, competitor SoftwareApplication JSON-LD) | [competitor-analysis.md](competitor-analysis.md) |
| **Partner extraction plan** (citable, ads, comparison, alternatives, pricing/ICP/FAQ min-expand, partner SoftwareApplication JSON-LD) | [partner-extraction.md](partner-extraction.md) |
| **Remove partner/competitor Mongo seed-HTML fallback** (library-only resolve) | [remove-partner-seed-html-fallback.md](remove-partner-seed-html-fallback.md) |
| Platform / API / isolation contracts | [`../architecture.md`](../architecture.md) |
| Agent-enforced non-negotiables | [`../.cursor/rules/master-plan-nonnegotiables.mdc`](../.cursor/rules/master-plan-nonnegotiables.mdc) |
| Honesty (stubs / fallbacks / correctness) | [`../.cursor/rules/`](../.cursor/rules/) |

**Sync rule:** When Non-negotiables or P0 honesty language in `master-plan.md` change, update `.cursor/rules/` in the same change. Rules mirror the plan — they are not a second authority.

**Live tracker:** master-plan **§7**. P1.5 (`sourceRights`) must pass before R1a/R1b count toward release.

# Plans

**Sole release-plan & decision record:** [master-plan.md](master-plan.md)

| Concern | Where |
|---------|--------|
| Release gates, §7 tracker, smokes, kill switch, Appendices A–E | [master-plan.md](master-plan.md) |
| Platform / API / isolation contracts | [`../architecture.md`](../architecture.md) |
| Agent-enforced non-negotiables | [`../.cursor/rules/master-plan-nonnegotiables.mdc`](../.cursor/rules/master-plan-nonnegotiables.mdc) |
| Honesty (stubs / fallbacks / correctness) | [`../.cursor/rules/`](../.cursor/rules/) |

**Sync rule:** When Non-negotiables or P0 honesty language in `master-plan.md` change, update `.cursor/rules/` in the same change. Rules mirror the plan — they are not a second authority.

**Live tracker:** master-plan **§7**. P1.5 (`sourceRights`) must pass before R1a/R1b count toward release.

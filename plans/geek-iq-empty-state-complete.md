<!-- geek-iq-empty-state -->
---
todos:
  - id: empty-state-ui
    content: "context-selector: empty/mixed Geek IQ UI (notes + CTA, no gray wall)"
    status: completed
  - id: empty-state-tests
    content: "Add smoke/unit coverage for empty vs mixed catalog rendering"
    status: completed
isProject: false
---
# Fix Geek IQ “disabled” empty state on Create Review — Complete

## Image prompts (answered)

**Yes — for all parent Create types** (including Tool; tools = partners). After the parent job reaches `ready`, GeekAPI auto-spawns sibling `image-prompt` jobs: **H1/hero + one per non-FAQ body H2** via `GeekBackend/.../GccV2ImagePromptSpawnService.cs` (`BuildTargets` / `AddH1AndH2Targets`). No dedicated spawn feature flag. Never spawn from `image-prompt` itself. Canvas treats them as separate draft tabs (`ImagePromptSpawnCompleted`). See [image-prompt-h1-h2-complete.md](image-prompt-h1-h2-complete.md).

---

## Problem (Geek IQ)

On Create Review, [`src/app/creates/new/context-selector.tsx`](src/app/creates/new/context-selector.tsx) always renders Audience / Style / Visual selects with `disabled={options.length === 0}` and copy like “No approved audience available.” When catalogs are empty, the teal Geek IQ block looks **broken/disabled** even though Brand Voice / Locale / search toggles still work. Operators are not guided to approve anything.

Fail-closed product rules stay: Generate does not require Geek IQ catalogs today; empty is allowed. This is a **UX honesty** fix, not a new hard gate.

## Locked approach

Replace the wall of gray selects with an intentional empty state when a catalog has zero approved versions; keep working controls; strengthen **Manage Geek IQ** CTA. Do not invent stub/default approved catalogs.

## Implementation (content-creator-v2)

Primary file: [`src/app/creates/new/context-selector.tsx`](src/app/creates/new/context-selector.tsx).

1. **Detect empty catalogs** using existing `approvedOptions(...)` for brand kit, audience, style, visual, knowledge, products.
2. **When all governed catalogs are empty** (no approved audience/style/visual/knowledge/products, and brand kit empty):
   - Show one empty-state panel: short explanation that Geek IQ is optional for this run but selectors unlock after approved versions exist.
   - Primary link/button: **Set up Geek IQ** → `/brand-sources`.
   - Still show Locale + web-search toggles + run notes + Check context (those are not catalog-gated).
3. **When some catalogs have options and others do not**:
   - Render enabled selects only for catalogs with options.
   - For empty ones, show a single-line note + link (“Approve an Audience in Geek IQ”) instead of a disabled select labeled “No approved…”.
4. **Brand Voice**: if options exist, keep current select; if not, same empty note (no gray fake select).
5. **Copy**: avoid “disabled” language; use “No approved items yet” + action.
6. **Tests**: unit or e2e smoke that empty catalogs render the empty state (not four disabled selects); mixed catalogs render selects + notes.

## Out of scope

- Auto-creating or soft-approving Geek IQ stubs.
- Making Geek IQ required for Confirm (separate product decision).
- The run-attachment `not_ready` plan (separate).

## Verify

- Fresh account / empty catalogs on Review: one clear empty state, no gray wall; Confirm still available if other gates pass.
- After approving an Audience in `/brand-sources` and reload: Audience select appears enabled; other empties stay as notes.
- Brand Voice with approved kit still shows “Use saved default.”

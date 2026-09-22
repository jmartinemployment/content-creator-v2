# CreateDraftWorkspace: no way to switch artifacts, and too dense for one page

Found 2026-09-22 while Jeff tested generation directly. Written down properly rather than left as
a verbal note, matching how everything else this session is tracked.

## Problem 1 — DONE 2026-09-22 (`a894590`)

Confirmed by reading `CreateDraftWorkspace.tsx` directly. Selecting three output types at generate
time produces three real artifacts server-side (`generateGccCreate` sends all of `outputTypes`,
and a multi-select response returns `result.created` — an array). But `reload()` (lines 50-84)
picks exactly **one** to display:

```ts
const primary =
  d.artifacts.find((a) =>
    ["blog", "pillar", "techarticle", "technicalarticle"].includes(a.type.toLowerCase()),
  ) ?? d.artifacts[0] ?? null;
setArtifact(primary);
```

`d.artifacts` (the full list) is read only to pick this one value. Nothing in the component lists
the others, shows how many exist, or offers a way to switch. The other two generated artifacts are
real and retrievable (`listGccVersions(artifact.id)` already works per-artifact) — there is simply
no UI surface that ever asks for any artifact but the "primary" one.

**Built:** a tab switcher driven by `detail.artifacts`, shown whenever a create has more than one.
`reload()` now preserves the operator's selection across reload cycles (via
`selectedArtifactIdRef`) instead of snapping back to the "primary" heuristic every time — the same
principle already used for `outputTypes`. A fresh generate is the one case that moves the
selection on purpose. Switching also clears SEO/polish reports, since those are per-version.
`tsc`/`lint`/`build` all clean.

## Problem 2 — real, but needs Jeff's read on what's overwhelming before proposing a shape

`CreateDraftWorkspace.tsx` is 564 lines, one component: brief editing, generate controls +
output-type checkboxes, revise/SEO/polish action panels, body preview, and a raw-JSON toggle, all
rendered inline on one page. Jeff, 2026-09-22: "the existing page has so much content, we need a
different way to display drafts."

**Not scoped yet, deliberately** — a redesign guessed at without seeing what's actually
overwhelming in practice (which section dominates? is it the brief form, the action panels, the
body preview itself, or the sheer count of controls visible at once regardless of content length?)
risks solving the wrong problem. Once Jeff has tested and can point at what's actually in the way,
that becomes the input to this section, not a guess made now.

**The sequencing question above was answered by necessity, not by choice:** Problem 1 shipped first,
as the stopgap it was flagged as — testing multi-select generation at all required being able to
see more than one result. It does make Problem 2 somewhat worse in the meantime (one more control
on an already-dense page); a genuine page-structure redesign should treat the switcher as one panel
among several, not retrofit around it.

## Not started

Problem 2 has no fix built. This document exists so the next pass on it starts from what Jeff
actually finds overwhelming when testing, instead of guessing at a layout.

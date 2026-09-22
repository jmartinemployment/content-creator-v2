# CreateDraftWorkspace: no way to switch artifacts, and too dense for one page

Found 2026-09-22 while Jeff tested generation directly. Written down properly rather than left as
a verbal note, matching how everything else this session is tracked.

## Problem 1 — concrete, already traced: no artifact switcher

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

**Shape of the fix, not yet built:** a switcher (tabs, a dropdown, a list) driven by `d.artifacts`,
replacing the single auto-picked `artifact`/`setArtifact` with a selected-artifact-id state the
operator controls. Small, well-scoped — this is a real gap, not a design question.

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

**One connection worth naming up front:** Problem 1's fix (an artifact switcher) makes Problem 2
*worse* before it's addressed — adding a switcher to an already-dense page adds another control to
an already-overloaded layout. Worth sequencing: either solve them together (a genuine
page-structure redesign that includes artifact switching as one of its panels, not a bolt-on), or
solve Problem 1 first with visible awareness that it's a stopgap, not the final shape.

## Not started

Neither problem has a fix built. This document exists so the next pass on this starts from what
was actually traced (Problem 1) and what's still an open question pending Jeff's input
(Problem 2), instead of re-finding the switcher gap or guessing at a layout.

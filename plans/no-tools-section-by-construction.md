# No tools section, by construction — not by detection

**Repo:** `GeekBackend` unless stated. Claims cite `file:line`; anything unestablished says so.

**For review.** This replaces a patch, and the patch is part of what is being reviewed: on 2026-10-02 I
added a second *detector* for tools-listing headings (`94780e2`) after the first kept failing. Jeff's
objection is the premise of this plan: *"you have not thrown away and actually fixed, you've merely
attempted yet another patch, because this by definition should not exist, `FindToolsHeadings`."*

---

## The rule

**Within a pillar or a blog, tools have no headings.** Not a section, not a subheading, not a
product-named h3. They are named in running prose, each linked, each saying how it solves the problem the
Angle for SEO identifies. Jeff, stated four times, most recently 2026-10-02.

The Tool page is a different artifact — one product, its own six sections — and is not what the rule is
about.

## What actually went wrong historically: three failures, not one

Jeff, 2026-10-02: *"no tools was ever mentioned within the solution and instead were put into a tool
section like, Best Tools for x, and worse it repeated on every run."*

| | Failure | Does banning the section fix it? |
|---|---|---|
| 1 | **Omission** — tools absent from the solution prose, where they belong | **No.** A ban removes the section and leaves a page with no tools at all — worse |
| 2 | **Displacement** — collected into "Best Tools for X" | Partly |
| 3 | **Repetition** — the same shape every run | **No.** Deterministic output is the prompt's shape, not variance |

This is why `ContentPromptBuilder.ToolsAsSolutionInstruction` had to be bolted on beside
`NoToolsSectionInstruction`: two instructions in tension — *discuss the tools* and *do not give them a
section* — which the model resolved by giving them a section.

## Why detection cannot close it

`GccToolsSectionGuard.FindToolsHeadings` / `IsToolsListingHeadingText`
(`GeekAPI/Services/ContentCreator/Guardrail/GccToolsSectionGuard.cs:62-69`) requires
`PillarSectionClassifier.IsToolsListingHeading` — bare `\btools?\b` — **and** an enumerating or selection
phrase.

- It enforces a **lexical subset** of the rule. `"Choosing the Right AI Tools…"` is caught; a heading named
  `Dext`, or `"Why Bill.com Handles Approvals Better"`, passes. Those are tools with headings in a pillar,
  which the rule forbids outright.
- Pattern-matching product names is unbounded — every way a model can name a product is a new case.
- It addresses neither omission nor repetition.

A pillar or blog section is about a problem or its solution, **never about a product**. That is structural,
and a closed set is enforceable where a pattern is not.

---

## The verified cause: only the blog lets the model choose its sections

Read directly from the three files, not inferred.

| Type | `OutlineFor` returns | Tools section possible? |
|---|---|---|
| **Tool** | `ContentTypes/ToolPrompts.cs:47-69` — six `SectionSlot.Cover`, **no heading text**; the opening switches on `context.ContentAngle` (`:82-96`) | **No** — every obligation is about one named product |
| **Pillar** | `ContentTypes/PillarPrompts.cs:22-36` — six `SectionSlot.Cover`, **no heading text**, `ctx` ignored | **No** — none of the six obligations is about tools |
| **Blog** | `ContentTypes/BlogPrompts.cs:26-27` — `ctx.BlogMetadata.SectionOutline.Select(SectionSlot.Assigned)` — **free strings from the metadata call** | **Yes** |

`SectionSlot` (`Workflow/Services/PromptBuilders/SectionSlot.cs:40-62`) has exactly two factories:
`Assigned(heading)` and `Cover(covers, depth, guidance)`, with `WritesItsOwnHeading => Heading is null`.
A `Cover` slot states an obligation and the writer invents the heading; an `Assigned` slot hands over
heading text.

**Every tools-section refusal across three live Generate runs was the blog.** The pillar is already built
the right way — there is no obligation to write about tools, so "Best Tools for X" has nothing to come
from.

Two instructions make it near-certain on the blog:

- `BlogMetadataJsonContract` (`ContentPromptBuilder.cs:1962-1964`) asks for *"5-6 conversational H2
  headings — hooks, numbered angles, or how-to framing"*. A numbered angle on a tools keyword **is** a
  roundup.
- `BuildArticleMetadataPrompt:1434` — *"Derive sectionOutline from keyword SERP and local pack
  headings"* — while `ResearchBriefBuilder` feeds that prompt competitor titles verbatim, eight competitor
  H2s per source, and a bulleted list of partner tool names. The model is shown listicles and asked to
  imitate them.

**And the premise written into the guard is false.** `BuildStandaloneBlogBodyPrompt` presents the planned
H2s as *advisory* — *"prefer these H2s when they still fit, but refine any that reads as a reusable
label"* — not as an assignment the writer cannot decline, which is what the guard's own remarks claim.

---

# Plan

## Stage 1 — the blog gets obligations, like the pillar and the tool

`BlogPrompts.OutlineFor` returns a fixed `SectionSlot[]` of 5–6 `Cover` obligations instead of wrapping
invented strings.

Blog-shaped rather than a copy of the pillar's: 2,000–2,700 words over 5–6 sections
(`ContentLengthTargets.cs:33-49` — `BlogSectionCountMin = 5`, `BlogSectionCountTarget = 6`),
conversational in register, and the opening obligation switches on `brief.Angle` the way
`ToolPrompts.Opening` already does (`ToolPrompts.cs:82-96` — the only angle-aware structure in either
repo; reuse its shape rather than inventing a second one).

Then **no live type lets the model choose what its sections are**, and a tools section is unproducible.

Supporting edits:

- Drop `sectionOutline` from `BlogMetadataJsonContract`, and the *"numbered angles"* invitation with it.
  Nothing on the Create path consumes the field (see *What breaks* below).
- `BuildStandaloneBlogBodyPrompt` must render `Cover` slots the way the pillar and tool builders do
  (`slot.WritesItsOwnHeading`, `Depth`, `Guidance`, as at `ContentPromptBuilder.cs:2450-2465` and
  `:1663-1670`). It currently flattens to `sl.Label` and calls the result advisory, which would print an
  obligation sentence as though it were a heading.

## Stage 2 — the obligation lives in the slots that own it

The prohibition alone produced a page with **no tools at all**, which is the worse half of the original
failure. So the solution-side obligations state it: the partner tools are named *here*, in this section's
prose, each saying what it does about *this* facet of the problem, linked on first substantive mention.

Presence and placement become one thing instead of two instructions in tension, and the repetition breaks
because the tools are distributed across the argument rather than collected into a list.

`GccRequiredToolMentions` keeps enforcing that every declared partner is named, and its existing behaviour
answers "what if one is missing": retry once naming the omission, then refuse
(`GccGenerateService.cs:2333-2347`). Not a new policy — the one already in place for tool mentions.

## Stage 3 — delete the detectors

- `GccToolsSectionGuard.FindToolsHeadings`, `IsToolsListingHeadingText`, `OutlineRetryInstruction`
- `GccGenerateService.ReplanOutlineWithoutToolsSectionsAsync` and both call sites — all added in `94780e2`
- The claim in `NoToolsSectionOutlineInstruction` that *"the body writer is handed these headings as its
  assignment and cannot decline one"* — false for the blog, and moot once slots are obligations

**A bug in `94780e2` to undo.** The pillar's re-plan sits at `GccGenerateService.cs:2402-2418`, which runs
*after the entire pillar body is written*, on a `sectionOutline` that nothing consumes. As shipped it can
refuse a finished pillar over a discarded value.

**Recommendation, open to veto: keep `FindToolsSections` (the body guard)** as an assertion that should now
never fire. But it is only a lexical subset of the rule, so it must not be described as the enforcement —
the section plan is.

## Stage 4 — remove sizing for a shape that cannot exist

`ContentLengthTargets.PillarToolsSectionMinWords` and `PillarToolsSectionTargetMaxWords`
(`ContentLengthTargets.cs:26-27`) size a pillar tools section. No live reader. A surviving name reads as
licence.

---

## What breaks if the blog stops taking invented headings

**Nothing on the live Create path.** `metadata.SectionOutline` is not persisted and not returned: the
pillar envelope (`GccGenerateService.cs:2431-2440`) and blog envelope (`:2720-2730`) carry
`title / metaDescription / summary / body / jsonLdSchema` only. Slugs and anchors come from the written
document (`ContentDocumentText.AssignSectionIds`), not the outline. In the frontend, `sectionOutline`
appears once — a type declaration at `src/lib/types.ts:321` — and no component reads it.

The pillar on Create already pours *coverage sentences* into that field
(`GccGenerateService.cs:2180`, via `SectionSlot.Label`), so anything reading it as headings is already
reading prose.

## Out of scope, named rather than fixed

- **`ContentGenerationOrchestrator`** takes invented pillar headings (`:1461`, `:1505`) and **logs a
  tools-named H2 as a warning and ships it** (`:1374-1381`, documented *"Reported, never rejected"*). It
  has neither the body guard nor the plan-time check. Reachable from Revise
  (`GccController.cs:1795-1806`, whose own comment says those endpoints were retired without the code
  being removed). Whether a tools H2 can still reach production through Revise is a runtime question that
  cannot be answered by reading.
- **`ToolSectionExtractor`** (`Workflow/Services/ToolSectionExtractor.cs:19-40`) requires a pillar to
  *have* a tools section, matching `tool|platform|software|vendor|solution|stack|technology`
  (`PillarSectionClassifier.cs:21-38`) — the inverse of this rule. It feeds a tool-name picker
  (`GccController.cs:1665`), already obsolete for Create, which derives tool pages from declared partners.
- **`GccV2ToolOverviewWriteService.ResolveToolsHeading`** (`:308-313`) deliberately synthesises
  `"Tools for {keyword}"`.

## Verification

1. **Assert the negative structurally:** no `SectionSlot` returned by any live `OutlineFor` carries
   heading text — one test over the content-type registry, which fails the moment any type returns to
   invented headings. This is the test that makes the rule enforced rather than policed.
2. Blog outline: 5–6 obligations, none about tools, opening varies by `brief.Angle`.
3. The tools obligation reaches the blog and pillar body prompts, naming the declared partners.
4. `GccRequiredToolMentions` still refuses after one retry when a declared partner is unnamed.
5. Every deleted name returns zero hits, comments included.
6. **Mutation:** point `BlogPrompts.OutlineFor` back at `BlogMetadata.SectionOutline` — the structural test
   must fail.
7. **End to end:** one Generate → 5 tool pages + pillar + blog. Every declared partner named in the
   solution prose of both long-form pages; no tools heading anywhere; two runs on the same create should
   not share a section shape beyond the obligations.

## Review questions I would most like challenged

1. **Is a fixed blog spine right, given "it repeated on every run"?** The repetition complaint was about
   the tools section, and the pillar already has a fixed spine — but a fixed blog spine does mean every
   Problem-Solution blog shares a skeleton. The alternative considered was a schema-constrained plan where
   the model still plans per topic but each section must declare the problem facet it addresses, making a
   tools section inexpressible rather than absent-by-fiat. That keeps variety at the cost of more work.
   This plan takes the fixed spine because it matches the two types that already work.
2. **Should the body guard survive at all?** Keeping a never-firing assertion is defensible; it is also
   how this codebase accumulated two detectors for one rule.
3. **Does the orchestrator path need to be in scope?** If Revise is live, a tools H2 ships from there
   regardless of everything above.

# The hook is shared. Tool's body is not.

## The instructions this reconciles

Jeff, 2026-09-23, in order:

1. *"Again you are treating the most important Content Type as a second class citizen. All long form
   content gets a purpose-written hook chosen from twelve types against audience and angle."*
2. *"Much simpler to have one path, instead of spaghetti."*
3. *"Tools are different."*
4. *"Tools should be paraphrasing Partner data."*

Read together: the **lede is universal** and must not be implemented a third time. The **body is
not** — a tool page is a paraphrase of a partner's own data, which is a different job from a pillar
or a blog, and flattening it into a shared generator would destroy what makes it a tool page.

## What is shared: the hook

`ContentPromptBuilder` already has the 12-type lede system — `BuildPillarLedePrompt`,
`BuildArticleLedePrompt`, `BuildBlogLedePrompt`, `BuildLedeTypeGuidance`, and `LedeJsonContract`
(`summary | immediateIdentification | delayedIdentification | singleItem | anecdotal | narrative |
sceneSetting | startlingStatement | directAddress | question | quote | wordplay`, with the heading
required to be "a real written headline").

`GenerateToolPageAsync` calls none of it:

```csharp
var lede = sections[0] with { Tag = "h2" };
var document = new ContentDocument(lede, sections.Skip(1).ToList());
```

Tool's outline starts with `"Overview"`, so that section is promoted into the lede slot — which is
why **every tool page opens with a section headed "Overview"** and never gets a hook. The "lame
lede" and "Overview on every page is boring" reports are one defect.

**Fix:** Tool uses the same lede path Pillar does, with `outline[0]` as the lede slot. Since the
contract forbids literal headings, the repeating "Overview" disappears. Do not write a
Tool-specific lede prompt — that is the third copy the "one path" instruction rejects.

**Done 2026-09-23.** Tool calls the shared lede path, and the hook is additive rather than carved
out of the body -- all six sections survive, so Tool still equals or exceeds Pillar
(`project_tool_is_the_priority_content_type`). The hardcoded *"Required top-level (h2) sections, in
order: Overview, …"* prose and its per-section word budget went with it: the prompt renders the
outline from `ToolPrompts.Outline`, the one definition, and no "Overview" case survives in it for
any angle -- including `ultimate_guide` and the unrecognised-angle fallback, which were the most
common paths of all. Jeff: *"I really don't want to see Overview again, on any content type.
Overview is a type of Lede."*

## What is not shared: the body

A tool page paraphrases partner data. That is its substance, not context for it. Done
2026-09-23 — `BuildToolBodyPrompt` now presents the extraction as
`=== PARTNER DATA -- THE SUBSTANCE OF THIS PAGE ===` and instructs: every factual statement restates
something present in that data, in the model's own words; nothing added that is not in it; where the
data is silent, write less rather than invent; name the product concretely, because a page that
could be about any tool in the category has not used the data.

Tool keeps its own body prompt, and keeps its own extras: the FAQ built only from verified partner
FAQ pairs, `SoftwareApplication` JSON-LD, and per-H2 image prompts. None of those belong in a shared
long-form generator.

## Still open on Tool

- **Subject.** `toolName: create.Topic` makes the page's subject the SEO keyword, not a partner
  product — see `plans/tool-page-per-partner.md`. Paraphrasing partner data improves the substance
  but the page is still aimed at a category until that is fixed.
- **Per-partner pages.** Five partners should be five pages, each from its own partner's evidence.

Closed 2026-09-23: the lede, above — and the silently-short image prompt list, which now refuses
anything less than one hero plus one per H2 rather than leaving later sections with none.

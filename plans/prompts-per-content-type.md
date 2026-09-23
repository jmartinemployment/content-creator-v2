# One prompt set per content type

## The instruction

Jeff, 2026-09-23: *"you do not have a prompt for a content type, this is going to get very
confusing and convoluted when we add 10 more content types?"* and then *"create specific prompts for
each content type ... including the disabled ones."*

## The state today

`ContentPromptBuilder.cs` is **2,228 lines, one class, 54 prompt-building signatures / 28 distinct
prompts**, organised as a flat *type x role* matrix:

```
BuildPillarLedePrompt        BuildArticleSectionBatchPrompt   BuildArticleMetadataPrompt
BuildBlogLedePrompt          BuildBlogBodyPrompt              BuildBlogMetadataPrompt
BuildStandaloneBlogLedePrompt BuildStandaloneBlogBodyPrompt   BuildStandaloneBlogMetadataPrompt
BuildToolBodyPrompt          BuildToolFaqSectionPrompt        BuildToolMetadataPrompt
...
```

Nothing groups a type's prompts together; which ones a type uses is decided in
`GccGenerateService`'s switch. **The duplication this predicts has already happened**: Blog and
StandaloneBlog each carry their own lede, body and metadata prompt, kept in step by hand.

At ~4 prompts per type, 10 more types is ~40 more methods on the same flat surface.

## What this cost, concretely, on 2026-09-23

Both of the night's Tool defects were this structure, not bad prompt writing:

- **The writer did not know what a partner is.** `BuildToolBodyPrompt` framed *"a senior technical
  writer for an IT consulting firm"* and never used the word, while
  `GccV2PartnerExtractionService` -- which produces the data it consumes -- defines one precisely.
  Two halves of one pipeline, no shared definition, because no file owns "what is a Tool page".
- **Tool's context builder drifted from Pillar's.** `GenerateToolPageAsync` hand-built a
  `ProjectGenerationContext` field-for-field identical to `BuildMinimalContext` except it passed
  none of the brief, so `BuildLedeTypeGuidance`'s `hasBrief` test was false and Angle for SEO never
  reached the lede.

## Target

A type owns its prompts; shared rules are composed, never copied:

```
IContentTypePrompts
    Key                       // "tool", "pillar", "blog", "email-cold-outreach"
    Outline                   // the type's own section list
    LengthTarget              // its own, not a constant in a shared file
    Lede(ctx)                 // may return the shared 12-type hook unchanged
    Body(ctx)
    Metadata(ctx, document)
    Extras(ctx)               // Tool: FAQ from verified partner pairs + JSON-LD; most types: none
```

Shared pieces stay shared and are injected, not duplicated per type:
`BuildLedeTypeGuidance` (12 types + exemplars), `SectionsArrayJsonContract`, `ParagraphJsonShape`
(text | list | quote), `BrandTones`, the provenance rules, the no-invention rules.

**A new content type becomes a new file that declares what it is** -- not four methods appended to a
5,000-line class and a case added to a switch.

## The property this unlocks: "disabled" stops being a list

Today `GccGenerateService.DisabledContentTypes` is a hardcoded array of 13 normalised strings, and
`GenerateOneAsync`'s `default:` branch exists only so a type with no real generator does not error.

With a registry, **a type is enabled exactly when a prompt set is registered for it**. The array and
the `default:` fallthrough both disappear, and "write the prompts" becomes literally the act of
enabling a type -- which is what `content-type-dispatch-and-richness.md` has been describing.

## Sequencing -- and the one amendment to "all of them now"

Authoring 20 prompt sets before the structure is proven is a large unvalidated bet: Tool is the type
with the most attention here and four defects in its chain surfaced in a single night, with its
output still unjudged. Per-type files also make it *easy* to re-copy the shared rules 20 times,
which is the same drift wearing a new shape.

So:

1. **Structure + registry**, with the shared pieces extracted once.
2. **Migrate the four live types** -- Pillar, Blog, Tool, Email cold outreach. Tool first, since it
   is the priority type and the one we can judge.
3. **Prove it on Tool** end to end before going wider.
4. **Then one disabled type at a time**, each enabled by the act of writing its set. Collapse
   Blog/StandaloneBlog's three duplicated pairs during the migration rather than carrying them.

Prerequisite worth respecting: **the per-partner subject fix comes first**
(`tool-page-per-partner.md`). Tool's prompts get their identity from having a real product as the
subject; restructuring around `toolName: create.Topic` would bake the wrong noun into the new
structure.

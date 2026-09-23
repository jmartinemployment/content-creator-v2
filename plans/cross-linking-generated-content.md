# Cross-linking a create's generated content

## The model (decided with Jeff, 2026-09-23)

| | Links out to | Linked to from | JSON-LD cross-refs |
|---|---|---|---|
| Pillar | Blog, Tool pages | Blog, Tool pages | cites Blog; one `SoftwareApplication` node per Tool page |
| Blog | Pillar, Tool pages | Pillar, Tool pages | cites Pillar |
| Tool | Pillar, Blog | Pillar, Blog | `SoftwareApplication`, cites Pillar |
| LinkedIn / X / email / ads | **one canonical URL, inbound only** | nothing | none |

Short form is distribution, not a page: it exists to send someone to the canonical piece. The
canonical page never links back -- a social post is ephemeral and not indexable, so an outbound link
earns nothing and leaks attention. Jeff: *"the Tool(s) do not seem an appropriate place for a link
to LinkedIn."* This matches the live pillar's own graph, which cited the blog and listed the tools
and mentioned no social at all.

**Default target for short form:** the Pillar, with the Tool page as the exception when the create's
primary intent is commercial. Marketing call, revisit freely.

## Why the normal case is the hard case

Jeff: *"the only way this could realistically happen is when all three are created at the same
time."* So cross-linking cannot depend on a sibling already existing -- it has to work for types
selected in one run, which is where titles do not yet exist when the prose is written.

## What makes it solvable without extra model calls

Two of the three titles do not depend on their body:

- `BuildStandaloneBlogMetadataPrompt(context)` -- context only
- `BuildArticleMetadataPrompt(context, ...)` -- context only
- Tool's title is the product name, known before generation

Only `BuildToolMetadataPrompt` needs the finished document, and that is for the meta description.

So the sequence becomes:

1. **Resolve titles first** for every requested type; derive `{base}/{department}/{slug}` for each.
   The URL scheme is the live site's and v1's: `use-cases/marketing/<slug>`,
   `blog/marketing/<slug>`, `tools/marketing/<slug>`.
2. **Generate bodies**, each handed the others' titles and URLs so prose can link naturally.
3. **Build JSON-LD** with complete cross-links.

Same number of calls -- the metadata call moves from last to first for Pillar and Blog.

## Limits, stated rather than discovered

- Only types in the same run cross-link in prose. Generating Blog today and Pillar tomorrow lets
  tomorrow's Pillar link back, but yesterday's Blog cannot link forward without regenerating.
  JSON-LD for an earlier artifact could be rewritten cheaply; its prose cannot.
- The pillar's `SoftwareApplication` nodes are one per Tool page, so this compounds with
  `tool-page-per-partner.md`: five partner pages means five nodes, derivable from the artifacts.

## Prerequisite

Nothing generated after the 2026-09-23 changes has been verified at runtime -- roughly
twenty-five commits on the generation path (lede chain, envelopes, metadata, JSON-LD, prompt
restructure, atomic failure, export). Build this against a known-good baseline, not on top of
unverified work.

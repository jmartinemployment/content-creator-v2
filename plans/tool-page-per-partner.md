# A Tool create produces one page per partner

## The requirement

Jeff, 2026-09-23: a project with **5 partners** should produce **5 tool pages** — one per partner
tool, each about that partner's product.

Today it produces **one** page, aimed at the create's Topic (an SEO keyword such as "Automated Data
Entry & Processing"), blending all partners' evidence together. The generated page named no partner
at all, which is the symptom that surfaced this.

## Why it currently produces one blended page

The per-partner structure exists right up to the point where it is discarded.

| Step | Today | Evidence |
|---|---|---|
| Retrieval | **Already per-partner.** `GccGroundingResolver` queries each indexed run separately at `TopK = 8` | 5 runs × 8 = 40 retrieved, 37 after de-dup — the number in the refusal |
| Merge | Flattened into one `retrieved` list, then one `ResearchJson.Quoteables` | `MergeRetrievedEvidence` |
| Extraction | One call per page, all 37 pooled into **one** `GccPartnerExtractionDocument` | `ExtractFromPagesAsync(partnerPages, [name], ct)` |
| Sufficiency gate | Evaluated once, on the pool | `HasSufficientPartnerData` |
| Subject | `toolName: create.Topic` → `app.Name` | `"Write expert third-person technical prose focused on {app.Name}"` |
| Output | One artifact | `GenerateAndPersistOneAsync` |

So extraction is asked to find pricing, features and ICP for a *category* across five different
vendors' pages simultaneously, and the writer is told the subject is that same category. The
keyword belongs on the page — it is the problem being solved — but it cannot also be the
subject, and "mentions none of the tools" follows directly from the collapse.

## Target shape

One Tool create → N artifacts, one per partner, each:

- about that partner's tool **and how it addresses the create's keyword**, not the keyword alone,
- grounded **only** in that partner's own crawl run,
- extracted with that partner's tool name as `toolNames`,
- gated for sufficiency **per partner**,
- written with that tool as the subject,
- persisted as its own artifact, named for the tool.

## Decisions needed before implementing

1. **Where does a partner's tool name come from?** `GccV2PartnerUrlResearchService.CollectPartnerToolRows`
   already parses named tool rows out of the brief and is what the v2 resolver feeds to extraction.
   `GccController.ParseAiToolNames(topic, notes)` also exists and has **zero callers**. Options:
   brief tool rows; a name derived from the partner's own pages during extraction; or an explicit
   per-partner name on the project. Until this is settled the pages cannot be titled correctly.
2. **What identifies a partner** — the crawl `RunId`, or the project's partner URL/host? Pages carry
   both (`GccQuoteablePage.RunId`, `.Url`). Run id is the unit retrieval already works in; host is
   what an operator recognises.
3. **Topic is not the wrong thing to have on the page — it is the problem the tool addresses.**
   A tool page is *this partner's tool, and how it addresses/fixes this keyword* (Jeff,
   2026-09-23). The prompt already carries both roles: "Tie Overview and When to Use to this
   project's use-case ({context.TargetKeyword})" alongside "this page is about {app.Name}, not a
   roundup". The defect is that `toolName: create.Topic` makes **both roles the same value**, so
   the tool identity collapses into the keyword and "how it fixes this" has nothing to hang on.
   Per partner the page is *that tool × this keyword*: five tools, one shared problem, five
   pages. Topic keeps its role untouched; only the subject needs a real tool name.

## Partial outcomes are required, not optional

Three partners with usable data and two without must produce **three pages and two named refusals**,
never one blanket failure. Today's sufficiency gate is all-or-nothing over the pool, which both
masks a thin partner and lets one thin partner block the rest.

This is now expressible: generate already runs as a job pushing one event per unit of work
(`plans/generate-async-signalr.md`), so each partner can report its own outcome as it lands. The
per-type event becomes per-partner for this type.

## Pieces that already exist

- Retrieval is per-run — no change needed to get partner-scoped pages, only to stop flattening them.
- `ExtractFromPagesAsync(pages, partnerToolNames, ct)` already accepts a tool-name list.
- `GenerateAndPersistOneAsync` already persists exactly one artifact per call, so N partners is N
  calls of a method that already exists, the same way multi-select types work.
- Extraction now runs concurrently and reports faults honestly (`56838ce`, `ab7df72`, `afb6f6b`).

## Sequencing

The three Tool polish items this section used to list are closed as of 2026-09-23 — the lede (Tool
calls the shared 12-type path, and it now runs *before* the body so the body continues it, on the
Create path and the orchestrator's `ToolPageGenerator` alike), the silently-short image prompt list,
and JSON-LD rendering.

What remains is the subject itself, and it is the larger half: the page is aimed at a category until
`toolName: create.Topic` becomes a real partner tool name. The outline now names the product in
every slot (`ToolPrompts.Outline(context, productName)`), so once the subject is per-partner the
sections follow it with no further change — five partners give five outlines and five genuinely
different pages, rather than five renderings of one.

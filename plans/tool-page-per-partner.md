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
vendors' pages simultaneously, and the writer is told the subject is that category. Both are the
wrong question, and "mentions none of the tools" follows directly from the last row.

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
3. **Does Topic still matter?** Likely yes, as the SEO angle each partner page is written *for* —
   but it stops being the subject.

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

This precedes the Tool polish items, because both are about a page currently aimed at the wrong
subject:

- **Lede** — `GenerateToolPageAsync` promotes the model's first body section into the lede slot
  (`var lede = sections[0] with { Tag = "h2" }`). Nothing writes a lede, and the six-section outline
  loses its first section to it.
- **Image prompts** — one per H2 is intended, but a short prompt list is silently accepted: index 0
  goes to the hero and any section past `prompts.Count` keeps none, with no complaint.
- **JSON-LD** — generated correctly, never rendered; `renderArtifactBody`'s tool branch draws only
  title + body.

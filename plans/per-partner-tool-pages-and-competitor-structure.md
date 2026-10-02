# Five tool pages, a pillar and a blog — from one Generate

**The task, Jeff 2026-10-02:** one Generate produces **5 tool pages + 1 pillar + 1 blog**, and single
tool pages are needed too — both, with sets of five the priority. Cost is not a consideration.

Part 2 of `plans/grounding-resolved-once-per-generate.md`, whose Stages 1–3 shipped and made its
Verification 7 runnable for the first time. Three live Generate runs then refused on seven defects.
Repo is `GeekBackend` unless stated.

---

## The Topic contract

`Topic` is two fields split on the **first colon** — now parsed by `GccTopic`, and recorded in
`AGENTS.md`.

```
"Accounts Payable: Automated Data Entry & Processing"
 └── descriptor ──┘  └──────── keyword ─────────────┘
```

The descriptor defines the *type* of the keyword; the keyword is the SEO target and **names the
solution**; on a Problem-Solution angle the problem is the keyword's **manual form**; the partner's
product is the agent of the solution and is **never** the Topic.

> *Manual Data Entry & Processing is a problem because X. Automating Data Entry & Processing solves it —
> with Tool.*

---

## What was wrong, and what is now fixed

| # | Defect | Commit |
|---|---|---|
| 1 | The sections JSON schema had no `quote` shape, so the required blockquote **could not be emitted** | `512df0d` |
| 2 | Three outline prompts banned a tools section in weaker words than the body prompt and the guard | `512df0d` |
| 3 | The quote was specified as a testimonial, not as how the tool solves the problem | `0a6ec94` |
| 4 | Provenance was the only guard with no retry | `0fda0c4` |
| 5 | The grounding refusal never named the product it searched for | `5f782cf` |
| 6 | `Topic` was unparsed, and the retrieval query contradicted itself | `684cc59` |
| 7 | One tool page named after the keyword over pooled evidence | `b229eb0` |
| 8 | Competitor structure read from five homepages instead of the crawl | `8fc23a1` |

**1 is the instructive one.** `ParagraphJsonConverter` was taught to *read*
`{"type":"quote",…}` on 2026-09-23; the schema the provider enforces was never taught to permit
*emitting* one. The prompt demanded a blockquote, listed 40 spans, and the guard refused the page —
while the model had no legal shape to answer with. Every test passed, because the fake provider ignores
the schema. `ParagraphWireShapeTests` now compares schema against converter.

**7, the main event.** `create.Topic` was the product name *and* the problem, so extraction searched
every partner's pooled pages for a product named after the keyword: **1 of 22 payload categories**, twice,
with two different partner sets, against partners carrying 84–226 quotable spans each.

`GccPartnerToolSlices` splits the pooled evidence into one slice per declared partner — host, product
name, that partner's pages, that partner's typed passages — and narrows the create so a page sees only
its own partner. Both shapes use it: `GenerateToolPagesPerPartnerAsync` loops every slice, or takes
`onlyProduct` for one. One method, two call shapes, so a single page cannot drift from the set of five.

It reuses what existed: `GccRequiredToolMentions.AnchorLookup` already returned
`host → authoritative product name` with the precedence rules, and `PartnerUrlsForAsync` already read the
project's partner URLs — the tool path simply never called it. `HostKeyOf` is now public and
`GccGenerateService.HostOfQuoteable` delegates to it, collapsing a second copy of that normalization.

**Each page stands alone.** A partner with too little evidence refuses its own page and the refusal is
returned, not thrown, so the others still ship — a deliberate exception to *"one failure fails all"*
scoped to this fan-out. Every partner refusing is still a failure of the type. A partner with no
retrieved pages still gets a slice, so it refuses by name rather than vanishing.

**8.** `GccCompetitorAnalysisResolver` asked `ListPagesBySeedsAsync` for the five declared homepage URLs,
matched by exact equality, so at most five of 1,777 crawled pages could return — in practice one per
competitor. It now reads the run by id through `GccProjectSiteStructureReader` and derives headings from
typed `blocks` rather than raw `Html`, which is not a validated ingest field. `DeclaredSchemaTypes` went
with the HTML re-parse: no production consumer.

---

## What is left

### Stage A — the Problem-Solution shape in the long-form prompts
State it where the writer is told things: the problem is the **manual form** of the keyword, say *why*,
then automation as the solution and that partner's tool as its agent. The "because X" is the writer's —
there is no problem field on the brief, only `angle` and `writingNotes`
(`src/lib/content-creator/brief-catalog.ts:187-220`). Use the brief's actual angle via
`GccAngleQuoteQuestion.For` so generation asks the same question the brief-time probe asks.

### Stage B — realtime needs a partner identity
`onTypeOutcome(contentType, …)` → `GccGenerateNotifier.PushTypeAsync` is documented *"One event per
requested content type"*. Five tool events all arrive as `contentType: "tool"` with no partner identity.
`CreateDraftWorkspace.tsx:396-404` only sets a message and reloads, so nothing breaks — but the operator
cannot see *which* partner failed. The payload has no name/slug field.

### Stage C — a route for a single tool page
`GenerateToolPagesPerPartnerAsync(onlyProduct: …)` exists and is grounded. The legacy project-scoped
endpoints (`gcc/tools/generate`, `gcc/projects/{id}/tools-from-names`) pass no create, so they produce
**ungrounded** pages and cannot be rewired without one. Exposing the grounded single-page path needs a
route decision.

### Stage D — competitor data check
One Mongo query against `crawl_pages` would confirm what the fix assumes: that competitor rows carry
blocks. The read now reports `PagesWithoutBlocks` rather than failing silently, so a bad assumption shows
up as an empty structure with a log line rather than as nothing.

---

## Verification

| | Status |
|---|---|
| `GeekBackend.Tests` | **1,421 pass** |
| `GeekBackend.IntegrationTests` | **50/51** — `GeekCrawlerE2ETests.Rag_webhook_is_delivered_to_owner_joined_run_group` is pre-existing on `main` (fails at `9b7134a`) and owned by another session |
| Topic parsing | first colon only; no colon; colon with nothing usable either side; whitespace |
| Per-partner slicing | host bucketing (incl. `www.`), `AnchorLookup` naming, narrowing to one origin, `ForProduct`, a partner with no pages still sliced |
| Fan-out | five declared partners produce five named outcomes; one refusing does not stop the others; an undeclared product refuses by name |
| Competitor | pages beyond the declared URL are read; a page with no `Html` still yields headings |
| Query regression | `BuildNeed` never emits "automated … manually" |

**Mutations that fail a test:** dropping partners with no retrieved pages (12 tests); reverting the Topic
split; putting the whole Topic back in the query; splitting on the last colon; narrowing the competitor
read to one page per run; removing the schema's `quote` variant; restoring the weak outline paraphrase.

**Not pinned, stated rather than claimed:** nothing asserts `PersistOneAsync` uses the piece's name —
reverting it to `create.Topic` leaves the suite green. `HttpGccRepository` is concrete, so a fake needs an
interface extracted first.

**Still the only thing that proves it:** one Generate on a real create → 5 tool pages + pillar + blog.

---

## Methodology notes, because each cost money

1. A test pinning a prompt's **wording** stays green while the prompt says something weaker than the
   guard enforces. Pin the shapes the rule names.
2. A guard needs three questions answered: does the prompt ask, does the guard match the prompt, and
   **can the schema express it**. Nothing was asking the third.
3. A negative claim from an incomplete look sends the work the wrong way — "no code splits Topic,
   therefore it should not be split" read the defect as the design.

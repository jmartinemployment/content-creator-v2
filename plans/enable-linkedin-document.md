# Enable the PDF / LinkedIn document — a type of its own, not a repurpose

**Written 2026-10-08. Status: nothing is built. The type stays disabled in both gates until G4 and
G5 ship; the decisions in §2 want Jeff's yes or no first, and §9 lists the four that are genuinely
his.**

One plan for one disabled type, as `fix-overview.md` §4 requires: "a disabled type is enabled only
when its spine, its gate, and one real proof exist" (Jeff, 2026-10-04). Jeff asked for this plan in
the Geek-Crawler-Rag session on 2026-10-08 (20:48 UTC "How hard would enabling PDF / LinkedIn
document (disabled) be?", 21:01 UTC "Create Plan to add LinkedIn document (PDF carousel)"); that
session answered the first question and then spent the evening on the Blog and Tool FAQ fields, so no
plan was written there. This is that plan, in the directory where the cross-repository plans live.

Jeff set the type's first two rules the same evening, in this session: **this is not repurposing
content** — the deck is written from the brief, the framing and the partner evidence like every other
type, never cut down from a page that already exists — and **it incorporates the partners' tools**,
named as the solution, the way Pillar does.

Grounded in code read on 2026-10-08: GeekBackend `bcec6d4` (the local `main`; the Geek-Crawler-Rag
session recorded the same commit as the Railway deployment at 20:29 UTC — re-check Railway before any
push that calls a route), content-creator-v2 `ce773b0`. Every `file:line` is a pointer to re-check at
that commit, not a fact that survives the next one.

## 0. The rules that bind this type

| Rule | Source |
|---|---|
| **Not repurposing.** The deck is generated from the brief, the niche framing and the partners' retrieved evidence. No existing page is read as its source. | Jeff, 2026-10-08 |
| **It incorporates the partners' tools.** Every declared partner is named, as the solution to the failure it fixes. | Jeff, 2026-10-08 ("Yes, it should incorporate"); the obligation Pillar already carries (`GccRequiredToolMentions.cs:8-16`) |
| **No tools section.** A slide's title names the failure or the outcome, never the product; the product is named in the slide's lines. | Jeff, 2026-10-01; `GccToolsSectionGuard` |
| **Consultant Voice is the only voice.** The deck takes the brief's tone like every type. This plan adds no tone. | Jeff, 2026-10-08 |
| **The model never emits markup.** Slides come back as content in the sections-array contract the pillar body already uses. One renderer builds the PDF node by node; `SectionHtmlRenderer` builds the HTML. No string concatenation of markup anywhere. | AGENTS.md §1b |
| **Markdown is forbidden** at every hop. | AGENTS.md §1a |
| **Fail closed, no middle states, no defaults.** A deck saved with its gap named is not a middle state; a slide padded to length, or a role defaulted when the model left it out, is. | AGENTS.md §2; Jeff 2026-09-27, 2026-10-04 |
| **No quotation on the deck**, as on Pillar and Blog. Quotations are the tool page's. | `GccDraftGuard.cs:84-86` |
| **A number appears only if it is in the evidence**; currency grammar as every type. | `GccDraftGuard` AddNumberFindings, AddCurrencyFindings |
| **The closing is built by code**, not written by the model. | Jeff, 2026-10-07; `GccClosing.cs:7-15` |
| **Project is the unit.** No identifier on screen but the project's and the labelled Run ID. | `fix-project-persistence.md` GF6 |
| **Affiliate and partner-program wording has no place** in prompts, data or output. | Jeff, 2026-10-02, 2026-10-04 |
| **Generate runs are paid runs.** The proof run (G7) starts only on Jeff's word. | Jeff, 2026-10-06 |

## 1. What exists today

**The two gates, and the refusal.** `linkedindocument` sits in `DISABLED_CONTENT_TYPES`
(`src/lib/content-types.ts:60-74`) and in `GccGenerateService.DisabledContentTypes`
(`GccGenerateService.cs:224-229`), both normalised to letters only. The coordinator refuses the whole
request before a job starts when any requested type is in that set: "Refused: '…' is disabled pending a
written, approved resolve plan for its content-type quality" (`GccGenerationCoordinator.cs:184-191`).
The picker greys the type and says why on hover (`ProjectContentWorkspace.tsx:1732-1746`). The comment
on the frontend set says no resolve plan exists (`content-types.ts:42-44`); this file is the one for this
type.

**Where the type would land if the gate opened today.** `GenerateOneAsync` dispatches on the normalised
type (`GccGenerationCoordinator.cs:560-640`): `pillar`, `blog`, `email`, the social platforms, `tool`,
`imageprompt`, and a `default:` branch that is the generic fallback — "every type still routed here is
disabled". A deck through that branch would be a generic article with slide-shaped nothing; that is
why the type is disabled, and the plan's job is a real branch.

**The prompt-set registry is the enabling mechanism.** `ContentTypePromptRegistry` says it plainly: "a
type is implemented exactly when a set is registered for it … writing a prompt set becomes literally
the act of enabling a type" (`ContentTypePromptRegistry.cs:5-15`). Pillar, Blog and Tool are
registered (`Program.cs:139-144`); `IContentTypePrompts` is `Key`, `OutlineFor`, `Lede`, `Body`
(`IContentTypePrompts.cs:29-48`), outlines are `SectionSlot.Cover(covers, depth, guidance)` obligations
the writer titles itself (`SectionSlot.cs:40-69`), and `PillarPrompts.cs` is the shape to copy: six
slots, guided by the operator's framing when the brief has one (`PillarPrompts.cs:58-97`).

**The pillar's sequence is the sequence.** `GeneratePillarBodyAsync` (`GccGenerateService.cs:2535-2706`
at `bcec6d4`): resolve partners and competitor analyses → build context, provenance evidence and the
evidence block → lede call → body in batches → the code-built closing appended → every check once
through `GccDraftGuard.Pillar` with one retry (`GuardedDraftAsync`) → image prompts → metadata → the
envelope `{ title, metaDescription, summary, warnings, body, jsonLdSchema }`. The guard's inputs are
`GccGuardInputs` (`GccDraftGuard.cs:33-62`): required partners, the consultation href, the allowed link
set, the number evidence, how many sections were appended outside the outline.

**A deck already exists in the code, and it is the thing Jeff ruled out.** Seven files under
`GeekAPI/Services/ContentCreatorV2/Carousel/` (820 lines) are a LinkedIn carousel built as a
*repurpose*: the prompt opens "Turn the source long-form content below into a concise PDF slide deck"
(`GccV2LinkedInCarouselPromptBuilder.cs:24`), `GccV2LinkedInCarouselDocumentConverter.FromContentDocument`
cuts an existing page into slides mechanically, and `GccV2LinkedInCarouselSpawnService` spawns the
carousel job when a long-form job reaches `ready` (`:57-100`, called from `GccV2JobWorker.cs:725`).
`STATUS.md:52-54` kept the folder as "the LinkedIn deck's basis". Under Jeff's rule the basis is one
file: the renderer. `GccV2LinkedInCarouselPdfService.Render` builds the PDF page by page with QuestPDF
(1080 × 1350 portrait, one slide per page, bullets as rows, a page counter; `:19-45`), and QuestPDF
2025.12.3 is already a dependency (`GeekAPI.csproj:22`), as is PdfPig 0.1.16 (`:21`), which can read a
PDF back in a test. Not reusable as written: the colours are not the brand's (`#1E3A5F`, `#2563EB`,
`GccV2LinkedInCarouselService.cs:138-144`); the font is asked for by name, `Fonts.Arial` (`:30`),
which a Linux container does not have; the parser substitutes a role when the model omits one and a
file name when it omits one (`GccV2LinkedInCarouselParser.cs:34`, `:67-69`), which the rules forbid;
and it retries once on any provider exception (`GccV2LinkedInCarouselService.cs:81-86`).

**A correction to the estimate Jeff heard.** The Geek-Crawler-Rag session's 20:49 UTC answer said "A
PDF renderer: there is none in the stack; everything today is HTML". There is one, above, and the
library is installed. Its other two points stand: a generator with its own prompt set and guards, and
this plan as the gate.

**The frontend needs little.** Tabs derive from the enabled list (`generated-content-set.ts:42-44`), so
enabling the type gives it a tab in the same change. `ArtifactBody` renders any `ContentDocument`
envelope — title, then the document (`gcc-api.ts:529-553`) — so a deck whose slides are sections shows
as a list of titled slides with no new component. Two things are wrong today: the type's length band is
the LinkedIn *post* band, `socialLinkedIn` (`brief-catalog.ts:866`; the comment at `:838-845` says
`linkedin-document` "picks the closest platform-specific band rather than naming one exactly"), and
`src/lib/config.ts:64-76` holds a second list of content types, `STARTING_CONTENT_TYPES`, that names
"linkedin" and has no reader — a surviving name.

**Export can already carry bytes.** `ExportedHtmlDocument(FileName, Content, BinaryContent)`
(`ExportedHtmlDocument.cs:3`), `GccExportZip` writes a binary entry when one is present
(`GccExportZip.cs:20-24`), and the project export route is `GET projects/{id}/export/html`
(`GccProjectsController.cs:141-148`) behind `downloadProjectHtmlExport` (`gcc-api.ts:315`).

**The repository needs nothing.** `GccArtifactVersion.BodyJson` is a string holding "ContentDocument
shape for long-form" (`GeekRepository/Data/Entities/ContentCreator/Entities.cs:100-105`); pieces are saved
under the requested type's own string and deleted by it (`GccGenerationCoordinator.cs:968-979`).
`GeneratedContentType` (`ContentEnums.cs:35-52`) is v1's enum and the Create path does not dispatch on
it; no member is added.

## 2. Decisions

Each row's recommendation is what §5 builds unless Jeff says otherwise. §9 lists the ones that are his
to make rather than the code's.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | Source of the deck's content. | **The brief, the niche framing and each partner's retrieved passages. Never a page.** Jeff, 2026-10-08. The carousel's prompt, converter and spawn are therefore not a basis; G4 deletes them, because a surviving "turn the source long-form content into a deck" is read as the live design. |
| D2 | What the deck is in the code. | **A `ContentDocument`: the cover is the lede, every slide is a top-level `Section` whose heading is the slide title and whose one `ListParagraph` holds the slide's two to four lines.** One document model, two renderings (PDF, HTML). Every pillar check runs on it unchanged; the only new checks are slide-shape ones. The alternative — the carousel's separate `CarouselSlide` model — is a second document model with no guards, and a second parser. |
| D3 | How the partners' tools are incorporated. | **One teach slide per declared partner**, titled by the failure that partner fixes (from that partner's framing, `GccNicheFramingReader.ForProduct`, `GccNicheFraming.cs:224`), its lines saying what the approach does about it and naming the partner, written from the same passages that partner's tool page is written from. `GccRequiredToolMentions` applies as on the pillar: a partner not named is a reported gap. No slide lists tools; a slide titled with a product name is refused by the tools-section check. Alternative considered: slides as approach steps with partners named where they act — it does not guarantee every partner a slide, and the obligation is every partner. |
| D4 | Links inside the PDF. | **None.** LinkedIn's document viewer does not make links inside the PDF clickable, so a linked partner name is a promise the reader cannot act on. The deck prints no `href`; any `href` refuses it (the existing link check with an empty allowed set). The **caption** (D6) carries the links: each partner's tool-page URL and the scheduler link, appended by code from the same allowed set the pillar links against. The last slide prints the booking words and the publisher's host in words. **Jeff to confirm** (§9). |
| D5 | Where the PDF bytes live. | **Nowhere. Rendered on request** from the stored document: `GET versions/{id}/pdf`, and into the export zip as `linkedin-document/{slug}.pdf`. The PDF is a rendering of the document exactly as the HTML is; stored bytes could drift from the stored text, and the carousel's ten-megabyte base64 field on the job record (`GccV2LinkedInCarouselService.cs:22`, `:104-110`) made every read of that record carry the file. |
| D6 | The caption — the LinkedIn post that carries the document. | **Written by the deck's own prompt set in the cover call** (one call returns the cover slide and the caption, as the pillar's lede call returns lede and introduction), held to the `socialLinkedIn` band (200–300 words, 1,300–1,900 characters; `brief-catalog.ts:800-806`) and to the number and currency checks. The LinkedIn post guidance the social generator holds inline (`GccGenerateService.cs:2475`) moves to one shared constant both compose from — shared rules are composed, never copied (`IContentTypePrompts.cs:21-24`). Links appended by code (D4). **No hashtags**: a tag is a claim about where the post belongs and nothing in the evidence licenses one; the operator adds any when posting. Stored in the envelope as `caption`; shown under the slides; exported as `linkedin-document/{slug}.caption.txt` (a file a person reads, not corpus). |
| D7 | The deck's numbers. | **Six to twelve slides**: cover, the problem, one slide per declared partner (two to eight), the approach end to end, what to do next. Title at most ten words; two to four lines of at most fourteen words each; the cover's one line at most twenty words; depth per slide "40–60 words", which is also the batch floor the body is held to (`BatchFloorWords`). Whole deck 300–750 words. The numbers live in `ContentLengthTargets` and in `CONTENT_LENGTH_TARGETS.linkedInDocument`, and the brief-catalog comment at `:765-769` already says why both must change together. |
| D8 | Brand on the slides. | **The parent site's palette**, not the carousel's blues: `#0b162a` navy for text, titles and the cover ground; white ground on teach slides; `#c83803` accent for exactly one thing per deck, the booking line on the last slide (the 530:21 rule — orange is text first, a fill means "act here"); `#023059` for the approach slide's ground. **Type: the parent's Sora (titles) and Figtree (lines)**, both Open Font License, shipped as resources in GeekAPI and registered with QuestPDF's `FontManager` — the Railway container has no Arial. The app's own Fraunces + Source Sans 3 stays the app's; the deck is a published brand asset, not the app. **Jeff to confirm** (§9). |
| D9 | Image prompts for slides. | **None in this cut.** Slides are text on brand colour. The pillar's per-section image prompts are for a web page; a slide carries its own look. |
| D10 | Where the generator sits. | `LinkedInDocumentPrompts : IContentTypePrompts` (key `linkedindocument`) registered beside the three; a `case "linkedindocument"` in `GenerateOneAsync` calling `GenerateLinkedInDocumentAsync`, which follows the pillar's sequence without FAQ, image prompts, meta description, JSON-LD or canonical URL — the deck has no page URL. The `default:` branch stays for the twelve types still disabled. |
| D11 | How the gate opens. | **Backend first.** `linkedindocument` leaves `DisabledContentTypes` in G4, deploys, is seen SUCCESS on Railway and `git show`n; then G5 removes it from the frontend set. The other order offers a type the backend refuses — fail closed, but a refusal the operator did nothing to earn. |
| D12 | The proof. | **One Generate on the project "test" requesting `linkedin-document` alone**, on Jeff's word. Jeff reads the PDF. Then the seven-type end-to-end proof in `fix-overview.md` §5 becomes eight. |
| D13 | The QuestPDF licence. | QuestPDF's Community licence is for organisations under one million US dollars annual gross revenue; the renderer sets `LicenseType.Community` (`GccV2LinkedInCarouselPdfService.cs:16`). **Jeff to confirm** it applies, else the Professional licence before G3 ships (§9). |

## 3. The spine

Slides, in order. Every title is the writer's, as every pillar heading is; what each slide owes the
reader is fixed here as a `SectionSlot.Cover` obligation.

| # | Slide | Owes the reader | Written from | Who writes it |
|---|---|---|---|---|
| 1 | Cover | The failure this deck is about, as the reader lives it, in a title of at most ten words and one line | The framing's failures (`GccNicheFraming.FailuresGuidance`, `:118`); the keyword | The model, in the cover call, with the caption |
| 2 | The problem | What is going wrong today and what it costs — hours, errors, delay, who absorbs them | The category framing (`ForCategory`) | The model |
| 3…N+2 | One per declared partner | The failure this partner fixes, what the approach does about it, the partner named in the lines — never in the title | That partner's framing (`ForProduct`) and its retrieved passages, the same passages its tool page is written from | The model |
| N+3 | The approach, end to end | How the pieces fit, in the order they happen | The framing's approach (`ApproachGuidance`, `:146`) and the publisher's stated method (`GccPublisherPositions.ApproachSlotGuidance`) | The model |
| N+4 | What to do next | "Answer these questions when booking your free consultation", the operator's questions, the publisher's host in words | `CompanyProfileOptions`, the brief's questions | **Code**, in `GccClosing` beside the page closing it shares its wording with |

N is the number of declared partners with retrieved evidence, two to eight. More than eight: the
first eight in the operator's order, the rest named in the gap report. Fewer than two: refused by
name (§4).

## 4. The gate

What the type needs, and what it refuses naming what is missing — the A3 form (`fix-geekapi.md` A3).
One function, `GccDraftGuard.LinkedInDocument(document, inputs)`, run on the first draft and on the
retry, so the retry cannot pass fewer checks than the draft it replaces.

**Refused before a model call, by name:**

- No project, or no brief: the existing refusals.
- A brief with no niche framing, or a framing with no failure: "a deck teaches the operator's method
  against a named failure; this brief names none".
- Fewer than two declared partners with retrieved evidence: "a deck is one slide per partner; this
  project has {n}". A declared partner without passages is treated exactly as the pillar treats it
  (the same resolver, the same warning), so the two types cannot disagree about one project.

**Refused on the draft, naming the slide or the line:**

- Slide count outside six to twelve; a slide with fewer than two or more than four lines; a line over
  fourteen words; a title over ten words; a cover line over twenty words.
- A slide title that names a product (the tools-section check, as on Pillar and Blog).
- Any `href` anywhere in the deck (D4).
- A quotation (as Pillar and Blog).
- A number not in the evidence; a foreign amount outside the currency grammar.
- A slide title with no provenance licence, under the same heading check as the pillar's H2s; the
  framing rows are brief text and are therefore licensed.
- A caption outside 200–300 words or 1,300–1,900 characters; a caption carrying a number not in the
  evidence.

**Saved, with the gap named (as the pillar does):**

- A declared partner not named on its slide.
- A length shortfall after the retry.
- Partners beyond the eighth, left out, by name.

**Checked once, at build time, by tests:** for every check above, a test that disables it and shows a
test go red (`fix-overview.md` §5, GeekAPI).

## 5. The work

| Stage | Repository | Change | Done when |
|---|---|---|---|
| **G1 — the prompt set** | GeekBackend | `ContentTypes/LinkedInDocumentPrompts.cs`: `Key = "linkedindocument"`; `OutlineFor` builds the §3 slots from the framing and the partner list; `Lede` is the cover-and-caption call with a new `CoverAndCaptionJsonContract` beside `LedeAndIntroductionJsonContract`; `Body` asks for all slide slots in one batch through `BuildArticleSectionBatchPrompt` with the slide-shape rules in its guidance. The LinkedIn post guidance becomes one shared constant (D6). Registered in `Program.cs` and in `TestContentTypePrompts.Registry()` (`GeekBackend.Tests/ContentCreator/TestContentTypePrompts.cs:13-22`), which exists so tests exercise the real sets. | A test resolves `linkedin-document`, `linkedindocument` and "PDF / LinkedIn document" to the set; the outline for a five-partner brief has nine slots in §3's order; a brief with no framing yields the §4 refusal. |
| **G2 — the generator and the guard** | GeekBackend | `GenerateLinkedInDocumentAsync` in `GccGenerateService`, the pillar's sequence less what D10 drops; the deck's closing slide in `GccClosing`, sharing the page closing's wording constants; `GccDraftGuard.LinkedInDocument`; `ContentLengthTargets.LinkedInDocument*` constants (D7); the envelope `{ title, caption, warnings, body }`; `case "linkedindocument"` in `GenerateOneAsync`. | `dotnet test` green; one mutation test per §4 check; a coordinator test shows a request for `linkedin-document` reaching the new branch and never `default:`; a test shows the closing slide carries no `href`. |
| **G3 — the renderer, the route, the export** | GeekBackend | `ContentCreator/Export/GccLinkedInDocumentPdfRenderer.cs`, rewritten from the carousel renderer to read a `ContentDocument` and the D8 brand, fonts registered from resources; `GET versions/{id}/pdf` on `GccController` beside `versions/{id}` (`:626`), `application/pdf`, 400 by name when the version is not a deck; `GccArtifactExportService` adds `linkedin-document/{slug}.pdf` and `{slug}.caption.txt` beside the HTML it already writes. | A test renders a nine-slide document and reads it back with PdfPig: nine pages, the cover title on page one, no `http` on any page, the booking words on the last; the route returns a PDF for a deck version and 400 for a pillar's; the export zip of a project with a deck holds the two files. |
| **G4 — open the backend gate, delete the repurpose** | GeekBackend | Remove `"linkedindocument"` from `DisabledContentTypes` (`GccGenerateService.cs:224-229`) and correct its comment. Delete `Carousel/` (the prompt builder, converter, parser, models, service, spawn service; the renderer has moved in G3), the spawn call (`GccV2JobWorker.cs:725`), the carousel branches of `GccV2HtmlExportService` (`:88-104`, `:248-260`), the registrations (`ServiceRegistration.cs:132-133`), the `LinkedInCarousel`/`IsLinkedIn` channel types and their readers (`GccV2ChannelTypes.cs:7-21`, `GccV2PublishTypes.cs:10-11`, `GccV2PlanService.cs:711-712`, `GccV2WriteService.cs:430-431`, `GccV2AgentTeams.cs:309-310`, `GcwContentTypeScoring.cs`), and `GccV2LinkedInCarouselTests.cs`. Deploy. | `dotnet build` zero errors, `dotnet test` green; Railway SUCCESS on the commit; `git show` of that commit's `GccGenerateService.cs` has no `linkedindocument` in the set; `grep -ri carousel` over `GeekAPI` returns nothing. |
| **G5 — open the frontend gate** | content-creator-v2 | After G4 is on Railway: remove `"linkedindocument"` from `DISABLED_CONTENT_TYPES` and rewrite the comment (`content-types.ts:41-74`); `LengthBandKey` gains `linkedInDocument`, `CONTENT_LENGTH_TARGETS.linkedInDocument` is `{ min: 300, max: 750, label: "6–12 slides, 300–750 words" }`, the map sends `"linkedin-document"` to it (`brief-catalog.ts:173-184`, `:757`, `:866`); `downloadVersionPdf(versionId, fileName)` in `gcc-api.ts` fetches and saves through a blob URL as `downloadProjectHtmlExport` does (`:315-335`) — never an anchor with the id in its `href`, which GF6's test would catch; a "Download PDF" button on each deck in the PDF / LinkedIn document tab; `ArtifactBody` shows `caption` under the slides the way it reads `metaDescription` (`ProjectContentWorkspace.tsx:2003-2012`); delete `STARTING_CONTENT_TYPES` and `StartingContentType` (`config.ts:64-76`, no readers). | `tsc`, `eslint`, `npm test` clean; `src/no-foreign-guid-on-screen.test.tsx` gains a `linkedin-document` artifact and version in its fixture, finds the Download PDF button, and still finds no GUID but the project's and the Run ID. Vercel READY. |
| **G6 — the record** | content-creator-v2 | `fix-overview.md` §0 table: the type's row to live, grounding "the framing's failures and approach; each declared partner's passages; no quotation; no link inside — the caption carries them"; `project-api-contract.md` gains `GET versions/{id}/pdf`; `HANDOFF.md` §3 and §5; this file's status line. | Every claim in the four files names a commit. |
| **G7 — the proof** | Jeff | One Generate on "test", `linkedin-document` alone, on Jeff's go-ahead. | Jeff reads the PDF: six to twelve pages, every partner named on its slide, no link inside, every number in the evidence, the booking line on the last page, a caption that reads as a LinkedIn post. The run log shows the grounding and every call. |

## 6. Order

G1 → G2 → G4 in GeekBackend, G3 beside G2 once G1 fixes the document shape. G5 and G6 after G4 is
SUCCESS on Railway and its controller is read. G7 after G5 is READY on Vercel. Nothing here is in any
wave of `fix-overview.md`; it is the "later plan of its own" that §4 promised each disabled type.
About two days across the two repositories, which is what Jeff was told at 20:49 UTC.

## 7. Verification

- **GeekBackend:** `dotnet build` zero errors; `dotnet test` green; for every §4 check a mutation
  test; the PdfPig read-back test in G3; the two gate tests in G1.
- **content-creator-v2:** `tsc --noEmit`, `eslint`, `npm test` clean, including the GF6 rendering
  test with the deck in its fixture.
- **Deployed:** Railway SUCCESS on G4's commit and `git show` of its `GccGenerateService.cs`; Vercel
  READY on G5's.
- **End to end:** G7, read by Jeff.

## 8. Not in this plan

- The twelve other disabled types. Each is its own plan.
- Posting to LinkedIn. The operator downloads the PDF and the caption and posts them.
- Images on slides (D9).
- A PDF export of the other types. The Geek-Crawler-Rag session asked whether "PDF" meant that;
  Jeff's 21:01 UTC message says "LinkedIn document (PDF carousel)" — the type.
- GeekRepository. Nothing changes there.

## 9. Open for Jeff

1. **D4** — no links inside the PDF; the caption carries them; the last slide prints the booking words
   and the publisher's host. Yes or no.
2. **D6** — no hashtags on the caption. Yes or no.
3. **D8** — the parent site's Sora and Figtree on the slides, shipped with GeekAPI; or the app's own
   Fraunces and Source Sans 3.
4. **D13** — the QuestPDF Community licence (under one million US dollars annual gross revenue) applies,
   or the Professional licence is bought before G3 ships.

# Fix the code-review findings

## Context

A max-effort code review of 2026-10-03's work across both repos returned 15 findings. One was
critical and is already fixed and deployed (`227edea`): nine `GccController` actions were left
routable with no verb attribute, so any request to `/api/geek-content-creator` threw
`AmbiguousMatchException` — an unhandled 500 on the API's base path, live since `363200e`.

**The suite was green at 1,512 throughout.** Nothing covers route-table shape, so a 500 on the base
path passed every test. That is the shape of most of what follows: these are defects tests do not
reach, found by reading the diff.

Every finding below was re-verified against HEAD before being written down — none is taken on the
review's word.

**Intended outcome:** the defects introduced today are removed, the pre-existing ones the review
surfaced are fixed or recorded, and the documents stop asserting things the code contradicts.

---

## A. Defects introduced today, shipped

### A1. `everyPartnerFailedExtraction` reverts to blaming the operator's data

`CreateDraftWorkspace.tsx:94`. `pagesAttempted > 0` sits **inside** `.every()`, so a single partner
that attempted zero pages makes the whole predicate false.

`AssessPartnerToolReadinessAsync:538` really does return `PagesAttempted: 0` when
`slice.Pages.Count == 0`. So a 429 that kills four partners plus one partner with no retrieved pages
reverts the headline to "0 of 5 can be grounded", suppresses the "nothing was extracted to count"
note, and shows the counts again — the exact misread `5b35bcb` was written to kill, while the other
four rows still say "extraction failed on all N pages" because the per-partner branch is computed
independently.

Fix: `partners.some(p => p.pagesAttempted > 0) && partners.every(p => p.pagesFailed >= p.pagesAttempted)`.

**Root fix, and the better one:** the backend already captures the cause verbatim
(`GccPartnerExtractionModels.cs:46` `FirstFailure`) and never puts it on `GccPartnerToolReadiness`.
Render the cause instead of inferring it from counts. Counting is why this has now been wrong twice.

### A2. The footer contradicts the headline three lines below its own fix

`CreateDraftWorkspace.tsx:783`. "The rest are drafted" is gated on `preflight.ready < preflight.total`,
independent of the all-failed headline. With `ready=0, total=5` both are true, so the honest headline
is immediately followed by "The partners above that cannot be grounded are not drafted. **The rest
are**, and each is saved on its own." Needs the same suppression the counts note got.

### A3. Revise is outside the Writing-model picker, and loses the provider stamp

Two halves of one hole, which is why they go together:

- `gcc-api.ts:384` hard-codes `provider: input.provider ?? "OpenAi"`, and `CreateDraftWorkspace:1003`
  passes no provider. Select Anthropic, generate, then Revise with scope `full` and the **entire
  body** is rewritten by OpenAI. Revise is the only call on that screen that writes prose; polish and
  seo are read-only. It is also a default substituted over a user-selected value, which
  `.cursor/rules/no-fallbacks.mdc` forbids.
- `GccController.cs:732` creates the revised version with `CreateGccArtifactVersionCommand(artifactId,
  revised)` — two arguments, `MetadataJson` null. So the "Provided by" label added in `764b139`
  disappears on first revise and never returns, because `loadVersionFor` sorts to the highest version.
  The provider is already parsed 22 lines above at `:710`.

Together these silently contaminate the A/B comparison the picker exists for.

Fix: thread `provider` through `reviseGccVersion` and the Revise call site; extract
`GccGenerationCoordinator`'s `private static ProvenanceJson()` into something both version-creating
paths share — the second call site the no-duplicated-logic rule names.

### A4. The diagnosis instruction reaches every pillar section, not the closing

`ContentPromptBuilder.cs:973` put `ClientDiagnosisInstruction` inside
`ClosingCallToActionInstruction`. `BuildArticleSectionBatchPrompt` gates that behind `OwnsTheClosing`,
but `BuildArticleSectionPrompt` — the per-section builder — appends it unconditionally. So 6 of 7
pillar sections are told the closing hands the reader a diagnostic. The per-section builder already
has `sectionIndex`/`totalSections` and can gate on them.

Pin with a test: a non-final section's prompt must not contain the diagnosis. The existing
`ContentPromptBuilderClosingCtaTests.PillarBatchThatDoesNotCloseThePage` is the model.

### A5. Phase 5 deleted the only test of an auth boundary

`fce86ad` removed `GccV2GovernedSkillsTests.cs` because its **file** was named after the skills
subsystem. It carried `ProductionMiddleware_RejectsUnsignedBearerIdentity` — the only test anywhere
referencing `ApiKeyMiddleware`, which survives untouched and guards every route in the API. It
asserted that in Production an `Authorization: Bearer` carrying a bare GUID or an `alg:none` JWT is
rejected 401 and never reaches the next delegate.

`grep -rln ApiKeyMiddleware GeekBackend.Tests/` now returns nothing. A change making the middleware
accept an unsigned bearer passes all 1,512 tests.

Restore that test against the surviving middleware. Same commit also took three
`GccV2GitHubSkillImporter` quarantine tests (never execute a fetched script, quarantine prohibited
capabilities, refuse a mutable git ref before network access) while the importer still boots in DI
and still fetches from github.com — check whether the importer survived the sweep, and if it did,
either restore the tests or delete the importer.

---

## B. The quote guard: revert, then do it properly

The uncommitted `GccToolQuoteGuard` change drew **five** findings and is worse than the bug it fixed.
It is a guard; a false positive publishes an unverified quote.

- **`&amp;` is decoded first** in the chained `Replace`, so `&amp;nbsp;` double-decodes to nothing. A
  partner page storing the literal `Write Rules &amp;nbsp; Receivable` normalises to `Write Rules
  Receivable`, and a quote omitting three published characters matches as verbatim. False positive on
  the one guard whose entire job is exactness.
- **The fold runs before the decode**, so `&mdash;`/`&ndash;` — the commonest encoding of the dash the
  change was written to handle — can never be folded. The stated purpose does not fire on its most
  common input.
- **`U+02BC` is a letter** (category Lm), not punctuation. Folding it to `'` puts it in `Unquote`'s
  edge-strip set, and `Unquote` is applied to the quote side only — so a word-final letter is deleted
  from one side and not the other. `«`/`»` fold to `"` likewise, and `»` is a breadcrumb arrow far
  more often than a quote mark.
- **`Snap` then publishes raw text.** Decoding makes an entity-bearing candidate matchable for the
  first time, and `:198` builds the published `QuoteParagraph` from the **un-normalised**
  `matched.Text`. The reader sees `&nbsp;` inside the partner's supposedly exact words. This is the one
  path in the file that writes output, and the change turned it fail-open.
- **The message is untrustworthy three ways**: it says "begins with" over a substring test (a quote's
  first word can match inside a candidate word), it accuses verbatim copies of being composed whenever
  the divergence is in the first three words, and it truncates both sides to 60 characters so the two
  strings it tells you to compare are frequently identical — on the plan's own Stampli example, byte
  for byte.

**Revert it.** Then take the review's structural point instead of patching the fold table:

`GccQuoteCandidate` already carries an `Id`, and `GccAngleQuoteProbe` 300 lines away already selects
quotes by id with the principle written out — *"nothing here came from the model but the number, so
there is nothing to verify."* Emit `candidate.Id` in `QuotableSpansBlock`, have the writer return an
id, and look the span up. That makes `Snap`, `Unquote`, the fold table and `NearestCandidate` all
dead, and removes the entire class of typography bug rather than enumerating it.

Two things to carry across regardless:

- Normalise `span.Text` **once** where `QuotableSpan` is built, not at all three comparison sites.
  Today the snapper and the judge derive their strings independently and agree by coincidence.
- The refusal must show what it compared against. That requirement was right; the implementation was
  not.

---

## C. Pre-existing, surfaced by the review

Each is small and each violates a rule this repo states explicitly.

| Where | Defect |
|---|---|
| `GroqProvider.cs:50` | `?? Environment.GetEnvironmentVariable("CONTENTWRITER__GROG__MODEL") ?? _options.Model` — `??` passes an empty-but-present variable through, so an empty legacy var shadows a correct `LlmProviders__Groq__Model` and the refusal names the variable that *is* set. Verbatim violation of AGENTS.md's `""`-counts-as-absent rule, and `ProviderModelGuard` documents that rule 12 lines away. The same file's API-key chain at `:34-38` does it correctly |
| `GccController.cs:1203` | `TryParseProvider` fails open twice: absent provider silently becomes `OpenAi` (and the new stamp then asserts it was *chosen*), and `Enum.TryParse` accepts numeric strings, so `"7"` validates into an undefined enum value that `ToLlm` maps to OpenAi |
| `ClaudeContentGenerator.cs:232`, `OpenAiContentGenerator.cs:233` | Both bypass `ProviderModelGuard` with a bare `_options.Model`, which `dfd9e7f` set to `string.Empty`. With the variable unset they POST `"model": ""` and get an opaque 400 — exactly the failure the guard exists to replace. Both are live via `ContentGeneratorFactory` |
| `GccGenerateService.cs:1448` | The CTA retry calls `FindViolations` with no `SnapQuotesToCandidates`, so the retried body is judged by a stricter rule than the first pass. The most expensive single call on the path is discarded when it hits the copying drift snap exists to absorb. One `SnapThenJudge` helper at both sites |
| `AnthropicProvider.cs:138`, `OpenAiProvider.cs:120` | `ModelUsed: parsed.Model ?? _options.Model` → now `""`; also discards a request-level override. `GroqProvider:110` does it correctly |
| `ClaudeContentGenerator` | Holds `TimeoutSeconds: 120` and never applies it, so a long draft dies at `HttpClient`'s 100s default with the generation already billed. `CalculateTokenCost` also hardcodes Claude 3.5 Sonnet pricing in the class whose model id just became operator-set |

**Deliberately deferred, with reasoning:** `b8170fe` drops `temperature` for Anthropic unconditionally,
which silently discards ~21 deliberate values — including the `0.1` on `GccAngleQuoteProbe.cs:172`, the
quote-selection call feeding the quote guard. That is correct today (every current Anthropic model
rejects the parameter) but it should be *recorded* at the call sites that set a temperature, not
silently ignored. Revisit when the id-based quote selection lands, since that removes the probe's
sensitivity to it.

---

## D. Documentation — every claim below re-verified against HEAD

`4431c60` was titled "correct every claim the cleanup made untrue" and missed all of these.

| File | What is false |
|---|---|
| `AppShell.tsx:10` | "`AppSidebar` is kept in the tree for now rather than deleted" — it was deleted in `a5ea3d7` |
| **`AGENTS.md:272`, `:298`** | **The most consequential.** Both name `GccV2SiteHierarchyFromCrawl.Build` as the consumer that requires `crawl_pages.Html` — and that is the stated justification for retaining ~98% of a 93 GB corpus. `c3219ac` deleted it. The retention rationale now cites a consumer that does not exist, while the surviving reader is blocks-only. **Re-derive whether the HTML is still needed at all** before rewriting the paragraph; this may be a storage decision, not a doc edit |
| `AGENTS.md:44-45`, `:472` | Name the deleted `hierarchy-match` route as the live project-site read path |
| `AGENTS.md:517` | Asserts `/app/projects/[id]` does not exist and that four `creates/*` routes do — the opposite of both, and it contradicts itself five lines later where the same section describes `/app/projects/[id]` rendering the workspace |
| `GccMissingBrandIntegrationCheck.cs:6,30` | Names `ContentBrief.serpTitles`/`serpUrls` as its live input; both deleted in `66da239`. Its `Evaluate` has never had a production caller — 8 green tests and nothing else. Decide: delete the class, or keep it and fix the doc |
| `gcc-api.ts:757` | A nine-line JSDoc left with no declaration after `getProjectSiteStructure` was removed; it now reads as the doc for `SiteHostReference` |
| `CreateDraftWorkspace.tsx:113,219` | Cite `/app/creates/[id]` and `creates/[id]/repurpose/page.tsx`, both deleted in `8758146` |
| **`GccNicheFraming.cs:378`** | **Verified: the "One item per *paragraph* — blank-line separated" doc now sits above `ReadQuestionLines`, which splits on lines.** My insertion anchored on `ReadParagraphs` and pushed the new method up under the old doc. The next reader is told, in Jeff's own words, that `diagnosisQuestions` splits on blank lines — the exact regression `d04a496` fixed. `ReadParagraphs` is left undocumented |
| `ContentPromptBuilder.cs:2764` | Same duplicate-`<summary>` shape |
| `GccToolQuoteGuard.cs:243` | Same — moot once section B reverts the change |
| `STATUS.md` | Add the routing-bug incident and its lesson |

---

## E. The coverage gap that let A's worst finding ship

**Nothing asserts route-table shape.** A 500 on the API's base path passed 1,512 tests.

Add a test that reflects over every controller in the assembly and asserts each public action method
carries an `[Http*]` or `[AcceptVerbs]` attribute, excluding SignalR hubs. The sweep I ran by hand
after the fix is exactly this check; it belongs in the suite.

Record the root cause as a rule, because the script shape will be reached for again: **a brace counter
cannot be used on C# containing route templates or interpolated strings.** `[HttpGet("jobs/{id:guid}")]`
opens and closes a brace on the attribute line, which is why the walk stopped there and deleted the
attribute alone. The three deletions that worked are exactly the three whose templates have no braces.
Delete by indentation, and assert the removed span contains exactly one member — the same assertion
that caught the equivalent bug in `gcc-api.ts` and was not carried across.

---

## Order

1. **A1, A2** — frontend, user-visible, minutes.
2. **B revert** — removes a fail-open guard from the tree; the id-based rewrite can follow separately.
3. **A3, A4** — correctness of features shipped today.
4. **E** — the route-shape test, so the class of bug cannot recur silently.
5. **A5, C** — restored coverage and the pre-existing fixes.
6. **D** — documentation last, describing the end state.

## Verification

- `dotnet build` 0 errors; `dotnet test` ≥1,512 passing, plus the new route-shape, per-section
  diagnosis, and restored middleware tests.
- `npx tsc --noEmit && npm run lint && npm run build && npm test` in the frontend.
- **A1 specifically:** a preflight with four all-failed partners and one zero-page partner must show
  the provider-fault headline. That is the case the current code gets wrong, so it is the test.
- **A3 specifically:** generate on Anthropic, revise, and confirm the draft still reads "Provided by
  Anthropic" and that the revise was not silently written by OpenAI.
- **E specifically:** delete an `[HttpGet]` attribute locally and confirm the new test fails.
- Railway and Vercel deploys healthy after each push; backend changes land only after the frontend
  deploy they pair with is `READY`.

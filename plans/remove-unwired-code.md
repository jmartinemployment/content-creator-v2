# Dead code removal — Content Creator and GeekAPI

## Context

Jeff, 2026-10-03, after finding that the SERP panel collects seven fields and one of them does
anything: *"WHAT STUPID CATEGORY THAT DOES NOTHING... AUDIT YOUR CODE SEEMS WE HAVE MORE CODE THAT
DOES[N'T] DO ANYTHING."*

He is right, and the audit that followed found more than the SERP panel. The cost is not disk space.
It is that **a grep hit on a dead path reads exactly like a grep hit on a live one**, so every question
about this system — "is this wired?", "why didn't my input reach the page?" — gets answered from
evidence that looks real and is not. That is the same failure mode `.cursor/rules` already names for a
surviving identifier, applied to whole components, modules and controllers.

It cost real time today: a header said "No research" while the brief was saved, and the natural
reading — *my input is being ignored* — was wrong but unfalsifiable without reading the backend.

**Intended outcome:** every function, component, field and route left in these repos is reachable from
something a user can do, or is deliberately documented as not. Roughly **9,000–12,000 lines** removed.

### This was already written down, and that is the point

`.cursor/rules/no-unwired-code.mdc` is `alwaysApply: true` and exists for exactly this. Its own cost
table, dated **2026-09-27/28**, contains:

> | SERP ingest changed nothing | four brief fields written, nothing on the generate side reads them |
> | No Perplexity upload | working `keyword-sources` endpoint, client functions written, no component calls them |

Both are still true today, six days later, and both are in this plan — the SERP fields in Phase 1, the
keyword-sources endpoint in Phase 4. The rule named the defect, the defect was not removed, and Jeff
rediscovered it from the UI.

So the rule is not the fix. **A standing rule stops new unwired code; it does nothing about the stock
already there.** That is what this plan is for, and it is why Phase 6 — correcting the documents — is
not optional bookkeeping: `no-unwired-code.mdc` must record that its own examples were cleared, or the
next reader finds a live-looking defect list and cannot tell which entries still apply.

### Where this plan lives

Jeff, 2026-10-03: write it to `content-creator-v2/plans/`. **Execution step 0** is to copy this file to
`content-creator-v2/plans/remove-unwired-code.md` and commit it, so the plan is reviewable in the repo
it changes, alongside the sixteen plans already there.

## What the audit established

Verified by grep at HEAD on 2026-10-03, not inherited from docs.

| Finding | Count | Size |
|---|---|---|
| Frontend components with no importer | 9 | 1,888 lines |
| `content-writer-api.ts` functions never referenced | 22 | of 655 lines |
| `gcc-api.ts` functions never referenced | 12 | of 1,048 lines |
| Brief fields no backend reads | 6 | — |
| GeekAPI v1 routes nothing live reaches | ~14 | — |
| `ContentCreatorV2` controllers | 20 | **7,392 lines** |
| `ContentCreatorV2` services total | 170 files | **33,936 lines** |
| Prompt builders with no caller | 1 | `BuildAdvertisingPrompt` |

**No repo calls `api/geek-content-creator-v2/*`.** Checked across all 17 repos under
`~/development`. The only `geek-content-creator-v2` matches are the **OAuth client id** in
`GeekOAuth/.../OidcPublicClientSeeds.cs` and `content-creator-v2/src/lib/config.ts` — an identity, not
a route.

## How to prove something is dead before deleting it

**My own first pass got this wrong**, and the method matters more than the list.

- **Never trust a bare name grep.** `createClient` exists in `content-writer-api.ts` *and*
  `gcc-projects-api.ts`. Searching the name finds the live one and reports the dead one as live.
  **Resolve by import**: `grep -rln 'from "@/services/<module>"'`, then check which symbols that file
  actually uses.
- **Never trust an unquoted glob.** `grep --include=*.tsx` without quotes fails in zsh and returns a
  count of zero for everything, which reads as "all dead". One run here reported 30 live functions as
  dead for exactly this reason.
- **Separate dead from transitively dead.** A function called only by an unreachable component is
  dead, but the call site exists. Classify callers against the unreachable-component list first.
- **A route is dead only when no *live* caller reaches it.** Check the service function, then the
  component that calls it, then whether that component has an importer.

Record the command used in each commit message, so the claim can be re-run rather than re-argued.

## Rules for this cleanup

1. **One phase, one commit.** Each phase is independently revertible. No phase depends on a later one.
2. **Deletion only — no refactors, no renames, no "while I'm here".** A rename in a deletion commit
   makes the diff unreadable and the revert unsafe.
3. **Full test suite green before and after every commit**, both repos. Currently 1,543 backend tests.
4. **If a deletion needs a code change to compile, stop.** That means something live referenced it and
   the deadness claim was wrong. Re-verify rather than patch.
5. **Grep the deleted identifier across all repos before committing.** Zero hits, or the hit is
   explained in the commit message.
6. **Do not delete anything whose absence cannot be observed.** Where a feature is unreachable but the
   backend would use it if data existed, that is recorded (Phase 4), not silently removed.

---

## Execution order

Ordered so that each phase's verification is still meaningful, and so a revert never cascades.

| # | Phase | Repo | Size | Risk | Why here |
|---|---|---|---|---|---|
| 0 | Plan into the repo | frontend | 1 file | none | reviewable where it applies |
| 1 | Dead brief fields + SERP panel | frontend | ~7 fields, 339-line panel | **medium** | the one Jeff can see; smallest change that answers his complaint |
| 2 | Nine orphaned components | frontend | 1,888 lines | low | must precede 3 — it changes what counts as a live importer |
| 3 | Dead service fns, 3× client API, `/app/creates` | frontend | ~34 fns + 655-line module + 584 route lines | low | the module verdict depends on 2 |
| 4 | Orphaned v1 routes | backend | ~14 routes | medium | only provable once 2–3 removed the callers |
| 5 | `ContentCreatorV2` controllers, then services | backend | 7,392 + | **high** | largest; last, so earlier phases are already verified |
| 6 | Documentation | both | ~12 files | low | describes the end state, so it follows it |
| 7 | Retire implemented plans | frontend | ~13 files | low | a plan is retired on the evidence of shipped code |

**Phases 2 → 3 and 4 → 5 are strictly ordered.** The rest could move, but this order means every
deletion is justified by evidence that already exists rather than evidence the next phase will create.

---

## Phase 0 — Put the plan in the repo

Copy this file to `content-creator-v2/plans/remove-unwired-code.md` and commit it alone.

Named for the rule it enforces, not for the symptom, so it sits beside
`.cursor/rules/no-unwired-code.mdc`. It joins sixteen existing plans; `plans/` is the live directory
(`plan/`, singular, is the older set — see Phase 6).

Commit on its own so the plan is reviewable before any code changes, and so the later commits can
reference it by sha.

---

## Phase 1 — The six dead brief fields and the SERP panel

**The one Jeff is looking at.** `SerpIngestPanel` (339 lines) collects seven fields; one is read.

| Field | Backend readers | Verdict |
|---|---|---|
| `paaQuestions` | `GccGenerateService:2407` (pillar FAQ section), `:3120` (heading licensing) | **KEEP — load-bearing** |
| `serpTitles` | 0 | delete |
| `serpUrls` | 0 | delete |
| `relatedSearches` | 0 | delete |
| `serpCapturedAt` | 0 | delete |
| `serpCapturedKeyword` | 0 | delete |
| `serpLocale` | 0 | delete |

Zero occurrences across every `.cs` file, v1 and v2. Raw `briefJson` is never passed to a prompt —
every backend read is a named property extraction (`ExtractBriefFields`, `BuildConsultantAppendix`,
`GccNicheFramingReader`), so there is no loophole by which an unparsed field reaches the model.

**⚠ The trap:** `paaQuestions` is the *only* route to a pillar FAQ section. Jeff asked earlier in this
same session *"how to get FAQ's added?"* — this is the answer. Removing the panel wholesale silently
stops pillar producing FAQs, with nothing on screen explaining why.

**Steps**
1. `brief-catalog.ts` — remove the six fields from `ContentBrief`, `emptyContentBrief()` and the
   migration. Keep `paaQuestions` and `briefVersion` (frontend-only, drives migration).
2. Remove `applyCuratedSerpToBrief`'s handling of the six, and the `SerpMergeConflict` machinery that
   exists only for them — check whether any conflict path survives for `paaQuestions` alone.
3. `SerpIngestPanel` — reduce to selecting PAA questions. Relabel: "SERP shortlist" names where the
   data came from, not what it does. It is **FAQ questions for the pillar**.
4. `ContentBriefPanel` — the `<details>` wrapper copy says "Add a saved search results page"; restate
   it for what remains.
5. Decide `serp/parse` and `GccSavedSerpParser`: the parser still supplies PAA, so the route stays.
   Only the three organic/related outputs become unused in the response.

**Verification:** save a brief, reload, confirm PAA questions persist; generate a pillar and confirm
the FAQ section still appears. That last check is the one that matters — it is the behaviour at risk.

**Risk:** medium. This is the only phase that changes a live feature's shape.

---

## Phase 2 — Nine frontend components with no importer

1,888 lines, zero importers anywhere in `src`:

`FileUploadPanel` 501 · `ReviewPublishPanel` 452 · `DraftRevisePanel` 296 · `DraftQualityPanel` 171 ·
`ContentApprovalPanel` 137 · `StandaloneImagePromptPanel` 118 · `CrawlPanel` 78 · `NotesPanel` 70 ·
`AppSidebar` 65

**`AGENTS.md` is wrong here** — it says "Seven components… about 1,450 lines", missing
`ReviewPublishPanel` and `AppSidebar`. Corrected in Phase 6; do not re-copy its number.

**`AppSidebar` note:** `AppShell`'s comment says it is "kept in the tree for now rather than deleted,
since nothing else references it". That was deliberate at the time and is now superseded by this
cleanup — say so in the commit rather than silently reversing a recorded decision.

**Steps:** delete the nine files, then `npx tsc --noEmit && npm run lint && npm run build`. No other
file should need touching; if one does, the importer check was wrong — stop and re-verify.

**Risk:** low. No importer means no render path.

---

## Phase 3 — Dead service functions and the triplicated client API

### 3a. `gcc-api.ts` — 12 functions, zero references

`listGccArtifacts` · `uploadCreateKeywordSource` · `listCreateKeywordSources` ·
`deleteCreateKeywordSource` · `generateGccTools` · `getGccClientByName` · `createGccClient` ·
`parseSeedLines` · `cancelGeekCrawl` · `listGeekCrawls` · `checkProjectSiteReadiness` ·
`getProjectSiteStructure`

### 3b. `content-writer-api.ts` — 22 functions, zero references

`getClients` · `setPublishTarget` · `getRecentProjects` · `updateProjectHierarchyContext` ·
`updateProjectBrief` · `generatePillarPlanContent` · `generatePillarBodyContent` ·
`startToolsGeneration` · `startToolsFromNamesGeneration` · `getToolsGenerationJob` ·
`generateToolsContent` · `generateToolsFromNames` · `listToolNameCandidates` · `generateBlogContent` ·
`generateSocialContent` · `generateSocialPack` · `generateColdOutreachContent` ·
`generateImagePromptsContent` · `generateAllContent` · `getGeekBackendCategories` ·
`getLmStudioStatus` · `isProductionContentWriterApi`

**The module goes entirely — 655 lines.** It has nine importers; **six are the dead components from
Phase 2**, and the other three are the `/app/creates/*` routes, which go with it. Decided 2026-10-03.

### 3d. `/app/creates/*` — reachable only by a link that lies

Four route files: `creates/` 104 · `creates/new/` 200 · `creates/[id]/` 13 · `creates/[id]/repurpose/`
267.

These looked live, because `CreateDraftWorkspace` links to them at `:378` and `:553` and
`CreateDraftWorkspace` is live. **But both links read `← Back to workflow` and point at
`/app/creates`.** The navbar has one item, `/app/workflow`. So the only way anyone reaches these pages
is by clicking a link that claims to take them somewhere else — which is a navigation bug, not a
feature with users.

That is what makes this decidable on evidence rather than preference. The order matters:

1. **Fix the two links** to `/app/workflow`, the destination they already name. This is a bug fix and
   stands on its own merits whatever happens next.
2. `/app/creates/*` then has **zero inbound links** — the same unreachability as the Phase 2 components.
3. Delete the four route files and `content-writer-api.ts`.

Do the link fix as its own commit, before the deletion. If the deletion is ever reverted, the corrected
links should survive it: they were wrong independently.

### 3c. Client CRUD exists three times

| Module | Functions | Status |
|---|---|---|
| `gcc-projects-api` | `listClients`, `createClient`, `updateClient`, `deleteClient` | **live** — `ClientsPanel` imports this one |
| `content-writer-api` | `getClients`, `createClient`, `deleteClient` | dead once Phase 2 lands |
| `gcc-api` | `getGccClientByName`, `createGccClient` | dead (3a) |

`createClient` existing in two modules is precisely what made the first name-based audit wrong. Collapse
to `gcc-projects-api` and the collision goes with it.

**Steps:** delete 3a, land Phase 2, re-run the importer check, then delete 3b/3c. Typecheck, lint,
build after each.

**Risk:** low, given the import-based verification.

---

## Phase 4 — Orphaned GeekAPI v1 routes

Reachable from nothing live, derived from the dead functions above. In `GccController.cs`:

- `GET artifacts` — the UI reads artifacts off `getGccCreateDetail` instead
- `POST`/`GET creates/{id}/keyword-sources`, `DELETE .../{sourceId}`
- `POST tools/generate` · `POST projects/{id}/tools-from-names` · `GET projects/{id}/tool-name-candidates`
- `POST projects/{id}/social-pack` · `GET jobs/{id}`
- `POST project-site/readiness` · `GET project-site/runs/{runId}/hierarchy-match`
- `GET`/`POST projects/{id}/content-approval` · `GET projects/{id}/image-prompt-rows` — reached only by
  components deleted in Phase 2

**⚠ Keyword sources are the exception — do not delete the backend half.** The upload *UI* is
unreachable, but `GccGenerateService:374-390` still reads `research.SerpPages` and renders an uploaded
SERP into the prompt. The feature is a working backend with no front door. **Record it, keep it, and
state in the commit that the UI is the missing half** — deleting it would remove a path that works the
moment anything writes to it. Jeff's own rule: disable by making unreachable, don't delete
(`feedback_disable_keep_logic_dont_delete`).

Also in this phase: `ContentPromptBuilder.BuildAdvertisingPrompt` — no caller in `GeekAPI` or tests.
A named prompt builder reads as permission regardless of callers; same argument that removed
`BuildToolsPlatformListPrompt` on 2026-10-01.

**Steps:** delete the action methods and any service method left with no caller. `dotnet build`, then
the full suite.

**Risk:** medium. A route can have a consumer this analysis cannot see.

**Mitigation — and a literal-path grep is not enough.** Review flagged this and it is correct: these
clients build URLs by interpolation, e.g. `` `/api/geek-content-creator/creates/${createId}/generate` ``
in `gcc-api.ts`. Searching for the route as written finds **nothing**, because the route as written
never appears in the source. Three checks, all three before deleting:

1. **Grep the distinctive fragment, never the whole path** — `tools-from-names`, `tool-name-candidates`,
   `social-pack`, `image-prompt-rows`. A fragment survives interpolation; a path does not.
2. **Check real traffic.** Railway MCP exposes the GeekAPI logs (`mcp__railway__get-logs`,
   project `GeekAPI`, service `GeekAPI`). A route with zero requests over 30 days is evidence no static
   analysis can give, and it catches a consumer outside these repos entirely.
3. **Record both results in the commit**, with the command, so the claim is re-runnable.

---

## Phase 5 — The `ContentCreatorV2` controllers

**The largest item, and the one to do last.** 20 controllers, 7,392 lines, all under
`api/geek-content-creator-v2/*`: ad-templates, agents, ai-visibility, canvas, drive, gsc, legacy,
research-entities, research-readiness, roi, sharepoint, skills, studio, task-agents, transform,
validate, publish, export, context.

**Nothing calls them.** Verified across every repo under `~/development`.

**⚠ Three traps, each of which breaks something if missed:**

1. **The OAuth client id is not a route.** `geek-content-creator-v2` in
   `GeekOAuth/.../OidcPublicClientSeeds.cs` and `content-creator-v2/src/lib/config.ts` is the
   application's identity. Touching it breaks login for the live frontend. Leave both alone.
2. **The live v1 path depends on `ContentCreatorV2` *services*.** These are referenced from
   `GeekAPI/Services/ContentCreator/` and `Controllers/ContentCreator/` and **must survive**:
   `GccV2AdHocJsonSchema`, `GccV2ContextAdapter`, `GccV2CreateLibraryWriter`, `GccV2HeadingNode`,
   `GccV2HeadingTreeBuilder`, `GccV2HtmlExportService`, `GccV2LongFormTypes`,
   `GccV2PartnerExtractionService`, `GccV2PartnerSoftwareApplicationJsonLd`, `GccV2Repository`,
   `GccV2SchemaConstrainedGenerator`, `GccV2SchemaConstrainedRequest`, `GccV2SiteSection`.
   Plus `GccV2SiteHierarchyFromCrawl` and `GccV2HierarchyToolMatch`, which `AGENTS.md` names as the
   project-site grounding path. **The namespace is historical, not a statement of deadness.**
3. **Deleting a controller orphans its services, and that is the point** — but only delete a service
   once nothing references it, iteratively, rebuilding between passes. Do not batch.

**Steps**
1. Delete the 20 controllers. `dotnet build`.
2. Remove DI registrations in `Program.cs` that no longer resolve.
3. Iteratively: find `ContentCreatorV2` services with zero references, delete, rebuild. Repeat until a
   pass removes nothing. Stop at the keep-list above.
4. Delete tests that covered only deleted controllers; **keep** every test covering a surviving service.

**Expected:** 7,392 controller lines plus a large but unknown share of the 33,936 service lines. Do not
commit to a number in advance.

**Decided by Jeff, 2026-10-03: delete the controllers *and* the services that orphans.** This is the
decision `AGENTS.md` recorded as "open and unexecuted; nothing is removed unasked" — it is now asked.
Update that sentence in Phase 6 so the next reader does not treat a settled question as open.

**Risk:** high by volume, low by evidence. Mitigation: controllers first as their own commit, services
in a second — so a revert of the services pass does not also restore routes.

### The keep-list — not a caveat, a precondition

Review's sharpest point: *"relying on human memory or a written caveat during a repetitive, destructive
iterative loop is highly error-prone."* Correct. A prose note saying "leave these alone" will not
survive step 3, whose whole job is finding things nothing references and deleting them — and
`GccV2WriteService` and `Carousel/` become unreferenced **the moment the controllers go**, which is
exactly when the loop runs.

So the loop takes an explicit root set, and anything reachable from it is off-limits. **Write this list
into the working notes before step 3 and check each pass against it**, rather than remembering:

```
# EXPLICIT ROOTS — treat as referenced even when nothing references them
GccV2WriteService                      # dormant writer; deletion is open, unasked (AGENTS.md)
Carousel/                              # whole folder — basis of the planned LinkedIn deck

# REACHED FROM THE LIVE v1 PATH — deleting any of these breaks generation
GccV2AdHocJsonSchema                   GccV2PartnerExtractionService
GccV2ContextAdapter                    GccV2PartnerSoftwareApplicationJsonLd
GccV2CreateLibraryWriter               GccV2Repository
GccV2HeadingNode                       GccV2SchemaConstrainedGenerator
GccV2HeadingTreeBuilder                GccV2SchemaConstrainedRequest
GccV2HtmlExportService                 GccV2SiteSection
GccV2LongFormTypes                     GccV2SiteHierarchyFromCrawl
                                       GccV2HierarchyToolMatch
```

The second group is derived, not asserted: `grep -ohE "GccV2[A-Za-z]+" GeekAPI/Services/ContentCreator/*.cs
GeekAPI/Controllers/ContentCreator/*.cs | sort -u`. **Re-run it at the start of Phase 5** — if the v1
path has gained a dependency since 2026-10-03, this list is stale and the loop will delete it.

A deletion that breaks the build is the good outcome here. The bad one is deleting
`GccV2PartnerExtractionService`, which still compiles if its only caller went in the same pass, and
shows up later as tool pages with no partner grounding — silently, as fewer matches.

---

## Phase 6 — Documentation, every file that now says something untrue

Dead code survived partly because the docs asserted things no one re-checked. After five phases of
deletion, every document describing this surface is stale by construction. **This phase is not
optional** — an uncorrected doc is how the next reader re-derives a defect that no longer exists, or
trusts a count that was never right.

Work through these in order; each is a specific, known edit, not a re-read.

### content-creator-v2

| File | What is wrong |
|---|---|
| `AGENTS.md` § *Reachability in this repo* | "Seven components… about 1,450 lines" → **nine, 1,888**, listed. It also misses `ReviewPublishPanel` and `AppSidebar`. Re-date the section; being current is its entire purpose |
| `AGENTS.md` § *Current state (2026-09-18)* | the dead-endpoint counts and the "all 26 endpoints exist" claim change in Phase 4 |
| `AGENTS.md` § *Markdown is forbidden* etc. | unaffected — **do not touch**; this phase is scoped to reachability claims |
| `.cursor/rules/no-unwired-code.mdc` | its cost table lists the SERP fields and `keyword-sources` as live defects. Mark them cleared, with the commit. Leave the mandates alone — they are the rule, and they stay |
| `STATUS.md` | **dated 2026-09-17** and describes Site Analyzer, `/app/create`, a `/app/site-analyzer` rename and uncommitted seed validation. Almost none of it is current. Rewrite against HEAD or delete it — a status file nobody updates is worse than none |
| `architecture.md` | re-read against the deletions; it describes the service surface |
| `plans/research-source-upload-ui.md` | the plan for the upload UI that was never wired — the `keyword-sources` half of Phase 4. Record what was decided |
| `plans/grounded-generation-and-serp.md` | its SERP stages are the fields Phase 1 removes |
| `plan/` (singular, 10 files) vs `plans/` (16 files) | **two plan directories**, handled in Phase 7 — not deleted wholesale, for a recorded reason |

### GeekBackend

| File | What is wrong |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | any route or reachability claim touched by Phases 4–5 |
| `GeekAPI/CLAUDE.md`, `GeekAPI/README.md` | the v2 controller surface described in Phase 5 |
| `Architecture.md` | the `ContentCreatorV2` namespace's role, which Phase 5 narrows from "the v2 application" to "services the v1 path depends on" |
| `plans/audit-does-the-writer-use-rag.md` | overlaps the grounding path; check its claims survive |

### The method, recorded once

Add to `no-unwired-code.mdc` — it is the rule that needed it:

- **Resolve by import, never by name.** `createClient` exists in two modules; a name search finds the
  live one and clears the dead one.
- **Quote your globs.** `--include=*.tsx` unquoted fails in zsh and returns zero for everything, which
  reads as "all dead". It reported 30 live functions as dead during this very audit.
- **Dead vs transitively dead** are different claims. Say which.

### The root-cause fix, stated plainly

Three of these docs were wrong in the same way: they counted something once and were never re-counted.
The durable answer is not another document — it is that **a claim about reachability carries the command
that produced it**, so the next reader re-runs it in ten seconds instead of trusting a number from six
weeks ago. Apply that to every count this phase writes.

---

## Phase 7 — Retire the plans that are already implemented

Jeff, 2026-10-03: *"delete implemented plan and/or plans."* Same principle as the code — a plan for
work that already shipped reads as work still outstanding.

### `plan/` (singular) — the whole directory, 10 files

Every file was last touched by **one commit, `2026-09-22`**, and none since. Their own status lines:
`tool-pages-v2.md` — *"Implemented (Aug 2026)"*; `v2-master.md` — *"§5.2 shipped"*;
`unify-rag-into-pipeline.md` — *"Already shipped:"*; `workflow-discrepancies.md` — *"Working audit
(Aug 2026). Not part of the shipping plan"*. The rest are the v2 design set, superseded by the v1
direction (`AGENTS.md` § *The direction: version one*).

**⚠ Read this before deleting it.** That 2026-09-22 commit is titled *"restore: 16 plan docs swept as
collateral by unrelated cleanup commits."* **This directory has already been deleted once by a cleanup
and deliberately restored.** Deleting it now is only correct because it is being done on purpose, named,
and in its own commit — not swept up as collateral by a different change, which is what happened last
time. Say so in the commit message. Git keeps the content either way; what was lost before was not the
files but the intent.

### `plans/` (plural) — per file, verified, not by date

This directory is live (touched through 2026-10-02). Each file gets a verdict against shipped code, and
**the test is whether the work landed, never whether the file looks old**:

- **Delete** where the plan's subject is live: `grounding-resolved-once-per-generate.md` (*"What
  shipped…"*), `no-tools-section-by-construction.md` (the guard runs at `GccGenerateService:2789`/`:3071`),
  `content-creation-off-postgres.md` (Postgres removed 2026-09-29), `grounded-generation-and-serp.md`
  **only if** its Stage 4 is also done — it tracks the `ContentDocument` gap for `quote`/`code`/`term`,
  which is still open, so most likely **keep**.
- **Keep** anything unfinished. Named explicitly because it is the easiest to get wrong:
  **`research-source-upload-ui.md` stays.** It is the plan for the upload UI that was never wired — the
  `keyword-sources` half of Phase 4, a working backend with no front door. Deleting the plan for
  unfinished work is how the work gets forgotten rather than finished.
- **Keep** `remove-unwired-code.md`, this file, until its phases are done.

Do this as the last commit, after the deletions, so a plan is retired on the evidence of the code
rather than on a guess made in advance.

---

## Review responses — two points not taken, and why

A review of this plan raised five points. Three are incorporated above: the deployment ordering gate,
fragment-based route verification plus Railway logs, and the explicit keep-list for Phase 5. Two are
not, and the reasoning is recorded so they are not re-raised.

**"Ensure removing brief fields doesn't corrupt historical JSON records."** Already safe, by
construction, on both sides — no step needed.

- Frontend: `migrateBrief` (`brief-catalog.ts:409`) starts from `emptyContentBrief()` and copies *known*
  keys off the parsed object. An old record carrying `serpTitles` is read, that key is never looked at,
  and it is dropped on the next save. There is no typed deserialization to mismatch against.
- Backend: every read is `JsonDocument.Parse` + `TryGetProperty` (`ExtractBriefFields`,
  `BuildConsultantAppendix`, `GccNicheFramingReader`). Unknown properties are not an error; they are not
  consulted.

The risk the review describes is real for a strict typed deserializer. This codebase does not use one
here, which was verified rather than assumed.

**"Explicitly mandate deleting `plan/` (singular)."** The reasoning — two directories one character
apart will mislead someone — is sound, and Phase 7 does delete it. But the recommendation as phrased
would have been acted on without looking, and **`git log` shows this directory was already deleted once
by a cleanup and restored on purpose.** A second unexamined deletion of files someone deliberately
brought back is exactly the failure this plan exists to prevent. Same destination, arrived at with the
history checked and the intent recorded.

---

## Verification

Per phase, in order:

1. `cd GeekBackend && dotnet build GeekAPI/GeekAPI.csproj` — zero errors
2. `dotnet test GeekBackend.Tests/GeekBackend.Tests.csproj` — **1,543 passing**, no reduction except
   tests deleted with their subject, stated by name in the commit
3. `cd content-creator-v2 && npx tsc --noEmit && npm run lint && npm run build`
4. `git status --short` in **both** repos — clean before the next phase
   (`feedback_no_lingering_uncommitted_changes`)

End to end, after every phase (this is the real test — the suite cannot see a missing render path):

5. `/app/workflow` → client → project → create → brief saves and reloads
6. Generate a **pillar** → confirm the FAQ section still appears (Phase 1's real risk)
7. Generate a **tool page** → confirm partner grounding still resolves (Phase 5's real risk —
   `GccV2PartnerExtractionService` is on the keep-list)
8. Export HTML → confirm the zip still builds

### Deployment — the ordering is a correctness requirement, not a courtesy

Railway (GeekAPI) and Vercel (frontend) both auto-deploy from `main`, so a push is a release. Review
caught the consequence: **a backend deletion that reaches production before the frontend deletion does
leaves the live site calling routes that no longer exist** — 404s for whoever is using it in that
window.

The phase order already runs frontend-first (2, 3) then backend (4, 5), which is the safe direction.
The gate makes the window zero rather than small:

**Before pushing Phase 4, the Phase 3 deploy must be `READY` in production.** Verify, do not assume —
`mcp__vercel__list_deployments` with `app: content-creator-v2`, `target: production`, and confirm the
top deployment's `githubCommitSha` is Phase 3's commit and its `state` is `READY`. Same gate before
Phase 5. A Vercel build takes a minute or two; this costs nothing and removes the failure mode
entirely.

**Not a long-lived cleanup branch.** Review offered that as the alternative, and it is worse here:
eleven commits across two repos, against a `main` that takes daily commits, means a merge conflict in
the exact files being deleted. Frontend-first with a verified gate gives the same safety with no
divergence. Single-commit-per-phase on `main` also keeps every revert independent, which the branch
approach loses.

## Rollback

Each phase is one commit on `main`, so `git revert <sha>` restores it. The highest-risk reverts are
Phase 4 (a route some unseen consumer used) and Phase 5 (a service the v1 path needed). Both surface
immediately — Phase 5 as a build failure, Phase 4 as a 404 in the Railway logs.

# Content Creator v2 — Code Audit

**Date:** 2026-10-09

## Scope and method

Read every tracked file in `content-creator-v2` except `package-lock.json` and the generated `tsconfig.tsbuildinfo`: 70 source/config files, plus 6 unit-test files and 2 guard tests, all read in full. `node_modules`, `.next`, build output and the `plans/*.md` planning documents were not read as code — those are planning prose, not shipped source.

Two whole-repo, case-insensitive greps closed the audit: `markdown|postgres|npgsql|rag.?generate` across every `.ts`/`.tsx` file, and a search for skipped or `.only` tests. Both came back with zero live hits — the one `markdown` match is a code comment explaining why Markdown support was removed, not a live reference.

**Coverage: 70 of 70 tracked source/config files read (100%).**

## What this app is

A Next.js App Router frontend on Vercel (the `phi` host), the live Content Creator v2 surface. It owns no crawler, no browser, and no LLM key — every secret stays on GeekAPI.

- **Auth**: GeekOAuth Authorization Code + PKCE (`src/app/api/auth/*`, `src/lib/auth/*`). Access/refresh tokens live in httpOnly cookies; `proxy.ts` (Next middleware) refreshes the access token ahead of rendering, since Server Components cannot write cookies mid-render.
- **BFF proxy**: `src/app/api/cw/[...path]/route.ts` forwards every GeekAPI call with the signed-in user's bearer token, never an API key fallback. `maxDuration = 300` because Generate can run several independent long-form writes in one call.
- **Data clients**: `src/services/gcc-api.ts` (Create/brief/generate/versions/SEO/polish/SERP) and `src/services/gcc-projects-api.ts` (clients, projects, tasks, time, deliverables, history log) — both typed, both routed through the `/api/cw` proxy.
- **Realtime**: `src/services/workflow-tools-hub.ts` wraps a SignalR connection to GeekAPI's `workflow-realtime` hub for Generate job progress (per-type events, a partner pre-flight event, and reconnect/rejoin handling).
- **Pages**: `/app/workflow` (client + project picker) → `/app/projects/[id]` (one project: Brief & Generate, Profile, Deliverables, Tasks & Time, History). `ProjectContentWorkspace.tsx` (2,110 lines) is the largest file and the only one that drives Generate, Revise, Approve/Export, and the SEO/polish panels.
- **Domain logic** lives in `src/lib/content-creator/*`: the content brief catalog and its legacy-brief migration (`brief-catalog.ts`, 900 lines), SERP ingest parsing (`serp-lens.ts`), the run/draft display rules that keep a running Generate from being confused with its own earlier drafts (`run-display.ts`), hierarchy matching, image-prompt extraction, and the declared-URL index gate.
- **Project is the unit**: a project's brief, keyword, every Generate and every draft are addressed by the project id alone; there is no separate "create" concept visible anywhere in this app.

## Critical and high findings

None found at critical severity. Content Creator v2 is the cleanest of the repos in this system by a wide margin — no Markdown, no Postgres, no RAG-generate calls, no stubs, no TODOs, no silent-failure violations across any of the 70 tracked files.

**High — a second HTML-producing implementation, duplicating the backend's sole renderer.**
`src/services/gcc-api.ts:432-574` (`docToHtml` / `renderSection` / `renderParagraph` / `renderRuns`) builds HTML by string concatenation (`` `<p>${inner}</p>` ``, `` `<${tag}>${items}</${tag}>` ``, etc.) from the same `ContentDocument`-shaped wire JSON (`lede`/`sections`/`paragraphs`/`runs`) that GeekAPI's `SectionHtmlRenderer` is documented as "the only place tag characters are produced in the whole pipeline." A comment at `ProjectContentWorkspace.tsx:1888-1889` names this directly: "v2 renders the ContentDocument to HTML properly" — i.e., this file is a second renderer of that same document model.

*Scope of this finding*: this is display-only, read-side reconstruction for `dangerouslySetInnerHTML` in the browser (`ArtifactBody` in `ProjectContentWorkspace.tsx:1990-2109`); it does not touch the shipped/exported HTML (the HTML export endpoint is served by GeekAPI directly) or the corpus/generation path, and all inserted text passes through `escHtml` (`gcc-api.ts:451-457`), so it is not by itself an injection risk against trusted backend content. But it is exactly the "second solution that outputs HTML" pattern the project's own rule prohibits by name, and a future change to `ContentDocument`'s shape (e.g. a new paragraph kind) has to be made in two places to stay correct — GeekAPI's renderer and this one — with no shared source of truth and no test tying them together. **Recommendation**: GeekAPI should expose pre-rendered HTML for display (it already renders this exact model for export), and this client-side renderer should be retired in favor of consuming that.

## Medium and low findings

**Low — malformed Tailwind class, broken button styling.**
`src/components/content-writer/ProjectsPanel.tsx:242` reads `className="shrink-0 rounded-fulltext-xs font-semibold text-white"` — a missing space merges `rounded-full` and `text-xs` into one nonsense class name. Neither utility applies: the "Delete for good?" confirm button on a project row loses its pill rounding and its explicit text size (it falls back to the inherited size, which still reads, so this is cosmetic rather than a functional break).

**Low — unused `hierarchySourcePageUrl`-style wire fields carried for migration only.** `src/lib/types.ts` keeps several `ProjectDetail`/`GeneratedContentSet` fields (`hierarchyPath`, `serpTitles`, `serpUrls`, etc.) documented elsewhere as retired/unread; they are typed here but the live create flow (`ProjectContentWorkspace`) never reads them. Not a defect — the type file is shared with older call sites — but worth a cleanup pass if those types are ever pruned.

**No duplication found** across the brief/SERP/hierarchy/run-display modules; each has one definition read from one place, consistent with the project's "no duplicated logic" rule.

**No dead-code drift found**: `renderArtifactBody`'s sibling `previewBodyDocument` (fallback plain-text preview) and the JSON-LD/metadata display logic in `ArtifactBody` are both live and reachable from `/app/projects/[id]`.

## Project-rule compliance

| Rule | Verdict | Evidence |
|---|---|---|
| No Markdown corpus/parsing | **Compliant** | Whole-repo case-insensitive grep for `markdown` returns one hit, a comment explaining Markdown was deliberately removed; no converter, no `#`/`[text](href)` regex parsing anywhere. |
| No Postgres in this app | **Compliant** | Zero hits for `postgres`/`npgsql`. This app has no database client at all — persistence goes through GeekAPI. |
| No RAG-generate calls | **Compliant** | Zero references to a RAG generate endpoint; `/api/rag/hosts-indexed` is the only RAG-facing route, and it is a read-only index check. |
| Save means a Save button | **Compliant** | `ContentBriefPanel` loads from the server and writes only on an explicit Save click (`handleSave`), gated on an `expectedVersion` optimistic-concurrency token; `src/no-browser-storage.test.ts` is a standing regression test asserting no source file reads or writes `localStorage`/`sessionStorage` — it passed on this read. |
| Project is the unit | **Compliant** | Every API call (`gcc-api.ts`, `gcc-projects-api.ts`) is addressed by `projectId`; there is no separate "create" id anywhere in the live surface. |
| Silent-failure / fail-closed | **Compliant** | Every network call wraps fetch failures into a typed `ApiError`; UI gates (`canGenerate`, `declaredShortfalls`, `missingProjectSiteRun`) refuse forward action rather than defaulting through; no caught exception is swallowed into a false-success state anywhere reviewed. |
| No stubs / TODO / placeholder bodies | **Compliant** | No `TODO`, `FIXME`, or elided-code comments found in any of the 70 files. |
| No GUID leakage on screen | **Compliant, and actively tested** | `src/no-foreign-guid-on-screen.test.tsx` renders the workspace and the project form against a fixture GeekAPI and asserts no GUID other than the project id and a labelled Run ID ever appears in the DOM — a real regression test, not just a convention. |
| Single HTML renderer (`SectionHtmlRenderer`, nowhere else) | **Violation, scoped** | See the High finding above: `gcc-api.ts`'s `docToHtml` is a second HTML-producing implementation of the same document shape, for display only. |

## Cross-service contracts

- **GeekAPI result serialization is inconsistent and the frontend has to work around it.** `run-display.ts:48-79` documents and corrects for this directly: GeekAPI serializes a Generate job's top-level result with plain `JsonSerializer.Serialize(result)` and no camelCase options, so the anonymous result's own keys (`created`, `refusals`, `preflight`, `warnings`) come through as declared (camelCase), while every nested C# record or entity inside them (`ProductName`, `Ready`, `PopulatedCategories`, `Id`) comes through PascalCase. The frontend's `camelKeys()` helper lower-cases the first letter of every key recursively to paper over this. **This is a GeekAPI-side defect worth fixing at the source** — flagged here for the GeekAPI report too, since the inconsistency lives in `GccJobsAndSeo.cs`, not in this repo.
- **Declared-URL / index-readiness contract**: this app calls `POST /api/rag/hosts-indexed` with `{urls, crawlType}` and expects `{results: [{url, host, indexed, runId, usable, reason, pages, chunks}]}` per URL — a richer "usable" predicate than a bare indexed flag, because a crawl can complete having been blocked at its first page. The 2026-10-09 change (noted in `ProjectForm.tsx`) moved this from a save-time gate to a Generate-time-only gate; the contract's shape did not change, only when the frontend calls it.
- **SERP parse contract** (`POST /api/geek-content-creator/serp/parse`) was trimmed on the backend side to carry only `peopleAlsoAsk` questions after `organics`/`relatedSearches`/three provenance fields were found to have zero live readers on GeekAPI's side (`serp-lens.ts` documents this). The frontend's `CuratedSerpSeed` type already reflects the trimmed contract, so there is no drift today, but it is a reminder that a wire type's history includes fields the backend has since stopped sending.
- **Hierarchy-match DTO is read defensively**: `hierarchy-match.ts`'s `normalizeHierarchyMatchFromApi` accepts both camelCase and PascalCase keys on every field (`o.path ?? o.Path`), the same defense `run-display.ts` applies elsewhere — a second piece of evidence that GeekAPI's JSON casing is not consistently enforced across its endpoints.
- No mismatch found between this app's `ContentBrief` shape (`brief-catalog.ts`) and what the brief panel sends/reads; `migrateBrief` explicitly handles every known legacy shape, which is the right place for that logic to live.

## Tests and verification

**Covered, and covered by real regression tests rather than conventions documented in prose:**
- No browser storage (`no-browser-storage.test.ts`) — scans every source file for `localStorage`/`sessionStorage`.
- No foreign GUID on screen (`no-foreign-guid-on-screen.test.tsx`) — renders the real workspace and project form against a fixture GeekAPI and fails if any identifier besides the project id or a labelled Run ID appears.
- Domain logic unit tests: `brief-catalog.test.ts`, `declared-url-gate.test.ts`, `hierarchy-match.test.ts`, `preflight-readiness.test.ts`, `run-display.test.ts`, `serp-lens.test.ts` — each exercises the pure functions behind the UI (migration, gating, ranking, display formatting) without a DOM.
- `npm run typecheck` and `npm run build` run in CI (`.github/workflows/ci.yml`); lint runs but is `continue-on-error: true` ("Report existing lint debt"), so a lint failure does not fail the build today.

**Not covered:**
- No component-level test exists for `ProjectForm`'s index-check flow (the declared-URL gate's UI side, as opposed to the pure `declared-url-gate.ts` logic) beyond what the GUID test incidentally renders.
- No test exercises the SignalR hub reconnect/rejoin paths in `workflow-tools-hub.ts` (`onGccGenerateReconnected`, `onclose` handling) — these are commented with real incident history (1006 close codes, a run outliving a dropped connection) but have no regression test guarding the fix.
- No test for `gcc-api.ts`'s `renderArtifactBody`/`docToHtml` HTML construction itself (see the High finding) — nothing would catch a future `ContentDocument` field this renderer fails to handle.

## Recommended fix order

1. Fix the one-character CSS typo in `ProjectsPanel.tsx:242` (`rounded-fulltext-xs` → `rounded-full text-xs`) — trivial, immediate.
2. Flag the GeekAPI casing inconsistency (`JsonSerializer.Serialize` with no camelCase policy on the Generate job result) to the GeekAPI owner so the fix lands at the source instead of being papered over client-side in `camelKeys()`.
3. Decide whether `gcc-api.ts`'s client-side HTML renderer should be retired in favor of GeekAPI serving pre-rendered HTML for display — this is an architecture call, not an urgent bug, since the current version is escaped and functions correctly.
4. Add a regression test for the SignalR reconnect/rejoin path, given its documented incident history.
5. No other action needed: the repo is otherwise in full compliance with every project rule, with real tests enforcing the two rules most likely to silently regress (browser storage, GUID leakage).

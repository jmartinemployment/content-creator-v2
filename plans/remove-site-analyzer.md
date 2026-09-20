# Remove Site Analyzer from content-creator-v2

Jeff instructed on 2026-09-20: **do not restore Site Analyzer — remove it from this repo.**

**Site Analyzer is obsolete — Geek-Crawler-v2 replaced it.** Site structure now comes from a
Geek-Crawler-v2 `project-site` crawl run, read back by Run ID
(`project-site/runs/{runId}/hierarchy-match`). This plan removes what is left of the old client here.

Scope is **content-creator-v2 only**. Geek-SEO still holds the Site Analyzer code, and GeekAPI's
client and GeekRepository's persistence are out of scope — listed under
[Explicitly out of scope](#explicitly-out-of-scope) so nobody widens this later.

## Context

Content Creator's job is: pass a **Run ID** → GeekAPI → display results. Gap analysis is Geek-SEO's
and reaches Create via RAG. Site Analyzer was retired from the v2 path deliberately (`5072820`), and
GeekAPI's v1 route for it was deleted by `582a171` — so what remains in this repo is a client half
with no server half.

## The state is better than the docs say — verified 2026-09-20

`AGENTS.md:184` and `STATUS.md:44` both say "exactly three frontend calls still 404, all Site
Analyzer", naming `CreateStartForm.tsx:145`, `CreateStartForm.tsx:161` and
`HierarchyContextPanel.tsx:137`. **Both claims are now stale:**

- **`CreateStartForm.tsx` does not exist in this repo.** `find src -name "CreateStartForm.tsx"`
  returns nothing.
- **`HierarchyContextPanel.tsx:137` was repointed at the v1 route** by `e6b3701` — it now calls
  `/api/cw/api/geek-content-creator/project-site/runs/{runId}/hierarchy-match`, and the comment
  above it already records that the old site-analyzer route is retired.

So **nothing in `src/` calls the nine local Site Analyzer routes.** Verified by
`grep -rn "/api/site-analyzer" src` → one hit, and it is the middleware matcher, not a caller.

This removal therefore deletes **unreachable code**, not working features. That is the reason it can
be done in one pass with `tsc` as the proof.

## Inventory — what is actually here

`tsc --noEmit` is clean on the pre-removal tree, so every count below is a baseline, not a guess.

| # | Thing | Where | Live callers |
|---|---|---|---|
| 1 | 9 proxy route handlers, **344 lines** | `src/app/api/site-analyzer/**` | **0** |
| 2 | Middleware matcher entry | `src/proxy.ts:73` | n/a — keeps the dead routes session-guarded |
| 3 | sessionStorage handoff | `src/lib/site-section-storage.ts` (94 lines) | see §3 — the **writer has 0 callers** |
| 4 | Copy naming Site Analyzer as the happy path | `src/app/app/creates/page.tsx:53-54,74,89`; `src/components/content-creator/CreateDraftWorkspace.tsx:202` | rendered to users |
| 5 | `SiteHeadingHierarchy.tsx` (54 lines), keyed on Site Analyzer gaps | `src/components/SiteHeadingHierarchy.tsx` | **0 importers** |
| 6 | Doc claims | `AGENTS.md:29,32,179,184-187`; `STATUS.md:19,21,23,44-47`; `architecture.md:165,172,251` | n/a |

The nine routes, each fetching a `${GeekAPI}/api/geek-content-creator/site-analyzer/...` path that
returns 404: `analyze`, `[id]`, `[id]/sitemap`, `[id]/page-section-trees`, `section-context`,
`profiles/recent`, `profiles/by-domain`, `profiles/[siteAnalysisProfileId]/trees`,
`profiles/[siteAnalysisProfileId]/hierarchy-match`.

## What must NOT be removed

**`siteAnalysisProfileId` is a Geek-Crawler-v2 run id, not a Site Analyzer profile id.** The value
changed at `4f7d540`; only the name is legacy. It is load-bearing on the live v1 path:

```
ProjectForm (?siteAnalysisProfileId= query param — a Geek-Crawler-v2 project-site run id)
  → createProject({ siteAnalysisProfileId })            services/content-writer-api.ts:116,128
  → GeekAPI stores it on the project
  → workflow/projects/[id]/page.tsx:109-110 reads project.siteAnalysisProfileId
  → HierarchyContextPanel.tsx:141 GETs project-site/runs/{runId}/hierarchy-match
```

Deleting the field on a "remove Site Analyzer" sweep would silently cut grounding — the failure mode
`AGENTS.md` warns about for project-site: no error, fewer matches. **Rename is a separate,
coordinated change** (`WorkflowGate`, `workflowHref`, `ProjectForm`, `content-writer-api`,
`gcc-api`, and GeekAPI's request contract) and is deliberately not in this plan.

The same applies to `WorkflowGate.tsx` — its field is named after Site Analyzer but carries the run
id. Leave it. (Note for whoever does the rename: `unlockWorkflow` currently has **zero callers**, so
the gate value is always `null` and the query param is the only live source. That is a separate
finding, not this plan's business.)

## Steps

### 1. Delete the nine dead proxy routes

```
git rm -r src/app/api/site-analyzer
```

344 lines, zero callers. No import in `src/` resolves into this tree — nothing else to update.

### 2. Drop the middleware matcher entry

`src/proxy.ts:73` — remove `"/api/site-analyzer/:path*"`, leaving:

```ts
matcher: ["/app/:path*", "/api/cw/:path*"],
```

Do this in the same commit as step 1. A matcher naming a deleted route is exactly the kind of
"documented but unenforced" leftover `AGENTS.md` calls out.

### 3. Delete the dead handoff writer path

`src/lib/site-section-storage.ts` is the Site Analyzer → Content Creator gap handoff. Verified call
sites:

| Export | Callers | Verdict |
|---|---|---|
| `writeSiteSectionHandoff` | **0** — the only writer of `gcc.siteSectionContext` | dead |
| `readSiteSectionHandoff` | `ContentBriefPanel.tsx:85,235` | **always returns `null`** — nothing writes the key |
| `clearSiteSectionHandoff` | `ContentBriefPanel.tsx:249` | only reachable inside `if (handoff)` → dead |
| `siteSectionForApi` | `gcc-api.ts:94` | only reached when a caller passes `siteSection`; **no caller does** |
| `SITE_SECTION_STORAGE_KEY` | internal | dead with the rest |

The writer was the gap-pick flow removed by `b2a7fc8`. With it gone the whole module is a closed
loop that can never hold a value.

Remove, in one commit:

- the whole of `src/lib/site-section-storage.ts`
- `ContentBriefPanel.tsx:82-118` — the "Seed from Site Analyzer handoff" block inside the brief
  `useEffect`, plus its imports at `:37-38`
- `ContentBriefPanel.tsx:234-240` — the `relatedPages` guard, and `:249` `clearSiteSectionHandoff()`
- `ContentBriefPanel.tsx:246-247` — collapse to `siteAnalysisProfileId: siteAnalysisProfileId || null`
  and drop `siteSection` from the call
- `gcc-api.ts:8` import, `:85-92` the unreachable `relatedPages` guard, and the `siteSection`
  parameter/body field in `createGccCreate`

**Keep `SiteContextBanner.tsx` and `parseSiteSectionJson`.** They read `detail.siteSectionJson` off
the create record returned by GeekAPI (`CreateDraftWorkspace.tsx:140`), so creates made before the
handoff died can still carry one. Removing the *write* path is safe; removing the *display* path
would blank data on existing creates. See [Decisions](#decisions-to-confirm).

### 4. Fix the copy that still sells Site Analyzer as the happy path

| File:line | Now | Should say |
|---|---|---|
| `creates/page.tsx:53-54` | "Happy path: Site Analyzer → Content Brief → generate…  Start a create by picking a gap in Site Analyzer." | the Run ID path: confirm project-site crawl evidence → Content Brief → generate |
| `creates/page.tsx:74` | "Pick a gap in Site Analyzer to start one." | start a create from a project with a Run ID |
| `creates/page.tsx:89` | badge `" · Site Analyzer"` when `siteAnalysisProfileId` is set | `" · grounded"` — the field is a run id, so the old badge is simply wrong |
| `CreateDraftWorkspace.tsx:202` | same badge | same fix |

Items 3 and 4 in that table are the reason this step is not cosmetic: the badge asserts a provenance
that has not been true since `4f7d540`.

### 5. Delete `SiteHeadingHierarchy.tsx`

54 lines, **zero importers**, and its `gaps` prop + "missing page" colouring are Site Analyzer gap
output — the thing `AGENTS.md:32` says must not be re-exposed here. Confirm zero importers again at
execution time, then `git rm`.

### 6. Correct the docs

- **`AGENTS.md`** — keep `:29` (Geek-SEO owns it) and `:32` (do not re-expose). Replace `:184-187`:
  the three-404s claim is false; state instead that the routes were removed on 2026-09-20 and no
  Site Analyzer call remains. `:179` is history about GeekBackend — leave it.
- **`STATUS.md`** — `:44-45` same correction; `:47` ("`src/proxy.ts` still matches
  `/api/site-analyzer/:path*`") is resolved by step 2 and should be deleted, not reworded.
  `:19,21,23` are dated history — leave.
- **`architecture.md`** — `:165` lists an `/app/site-analyzer` route that **does not exist** (`ls
  src/app/app` → `crawl`, `creates`, `projects`, `workflow`); delete the row. `:172` repeats the
  three-404s claim; correct it. `:251` (Geek-SEO owns Site Analyzer) stays.

Write what the code enforces. The 5,274-page deletion on 2026-09-18 came from a doc asserting a
safety property no check enforced — the inverse error, a doc asserting breakage that no longer
exists, is what sent the last session looking to restore this.

## Decisions to confirm

1. **Legacy `siteSectionJson` display** — recommend **keep** `SiteContextBanner` and
   `parseSiteSectionJson`. They render server-stored context on old creates; deleting them loses
   real data with no Site Analyzer dependency. Say so if you want them gone too.
2. **Rename `siteAnalysisProfileId` → `runId`** — recommend **separate change**, coordinated with
   GeekAPI's contract. Tracked alongside the run-id work in `plans/one-run-one-url.md`.
3. **`SerpIngestPanel.tsx`** — dead (zero importers, `AGENTS.md` already records it) but it is SERP,
   **not** Site Analyzer. Out of scope; do not fold it in.

## Explicitly out of scope

| Repo | What stays | Why |
|---|---|---|
| **Geek-SEO** | `SiteAnalyzerController.cs` (921 lines, 25 routes), services, workers, `frontend/src/components/site-analyzer/*` | Obsolete, but Geek-SEO's code to retire — not this repo's call |
| **GeekBackend / GeekAPI** | `Services/GeekSeo/HttpGeekSeoSiteAnalyzerClient.cs`, registered `Program.cs:171` | **Live** at `GccController.cs:107,480,506` — analysis freshness, must-mention subtopics, stale-grounding conflict. Removing it would cut v1 grounding |
| **GeekRepository** | `Repositories/Seo/SiteAnalysis*`, `GccSiteAnalysisRepository.cs`, `GeekSa2Read/*` | Persistence for the above |
| **GeekContentCreator** | `src/app/app/site-analyzer/site-analyzer-client.tsx` (930 lines) | Obsolete repo, frozen as a git-history source |

## Verification

Run all four; each must pass before the last commit.

```
npx tsc --noEmit                      # clean before this work; must stay clean
npm run build
npm run lint                          # 25 problems / 17 errors at baseline — must not rise
grep -rni "site.analyzer" src         # expect: zero hits
grep -rn "siteAnalysisProfileId" src  # expect: unchanged run-id plumbing only, no route paths
```

Then load `/app/workflow?siteAnalysisProfileId=<a real project-site run id>`, create a project, and
confirm HierarchyContextPanel still returns matches. That is the one path a wrong deletion here
would break silently, so it is checked by hand rather than inferred from a green build.

## Commit sequence

| # | Commit | Contents |
|---|---|---|
| 1 | `chore: remove the dead Site Analyzer proxy routes` | steps 1 + 2 |
| 2 | `chore: remove the Site Analyzer gap handoff` | step 3 |
| 3 | `fix: copy and badges name the Run ID path, not Site Analyzer` | steps 4 + 5 |
| 4 | `docs: Site Analyzer is removed from this repo` | step 6 |

Separate commits because 1 and 2 are provably behaviour-neutral (unreachable code) while 3 changes
what users read and 4 changes what agents are told. If something does break, the bisect is one step.

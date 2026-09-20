# One name for the Run ID

## Context

One value — the Geek-Crawler-v2 crawl run a piece of content is grounded on — is stored under three
different field names across two entities. One of the three is written by a live code path and read
by nothing, so projects created that way look like they have no crawl evidence.

The value has been a run id since `4f7d540`. Every name still says "site analysis", and Site Analyzer
is obsolete.

## What is actually there

| Entity | Field | Holds | Read by |
|---|---|---|---|
| `Create` (v1) | `SiteAnalysisId` | the run id | `GccController:100, 392, 471, 497`; returned to the frontend as `siteAnalysisProfileId` at `:128` |
| `Project` | `SiteAnalysisProfileId` | the run id | page 2 — the hierarchy match URL |
| `Project` | `SiteAnalysisId` | the run id | **nothing** |

`Project.cs:73` already documents the third as *"Unused wrapper id"*. It is not unused — it is
written:

```csharp
GccV2V1ProjectBridge.cs:83
project.SiteAnalysisId = create.ProjectSiteCrawlRunId;
```

**So the bug is live.** A project created through the New Project form puts the run id in
`SiteAnalysisProfileId`, which page 2 reads. A project created through the bridge puts it in
`SiteAnalysisId`, which page 2 does not read — that project renders as having no crawl evidence,
the hierarchy match never runs, and Generate is blocked with nothing explaining why.

The frontend calls it `siteAnalysisProfileId` on both `ProjectSummary` and `GccCreate`, which is a
third spelling of the same idea and matches neither entity's field on `Create`.

## The fix

**One name: `ProjectSiteRunId`.** It says what it is — the run of the project site — and it stops
naming a retired product.

### 1. `Project` — collapse two fields into one

`SiteAnalysisProfileId` and `SiteAnalysisId` become `ProjectSiteRunId`. `GccV2V1ProjectBridge:83`
writes it, the create path writes it, page 2 reads it. One writer's value is the other's.

**The storage catch.** `PersistentProjectStore` serialises projects into the `projects` collection
by field name, so every stored project carries the old names. `ProjectSnapshotSerializer` must read
`ProjectSiteRunId`, then `SiteAnalysisProfileId`, then `SiteAnalysisId`, and write only the new one —
otherwise every existing project loses its run id on the first load and silently stops grounding.
That fallback stays until a pass confirms no document carries the old names.

### 2. `Create` — rename `SiteAnalysisId`

Same rename, same read-old-names-on-load rule for whatever serialises creates. `GccController:128`
and `GccV2LegacyController:79,93` currently emit it as `siteAnalysisProfileId`; they emit
`projectSiteRunId`.

### 3. Contracts and frontend

`CreateProjectRequest`, `UpdateHierarchyContextRequest`, `ProjectSummaryResponse`,
`ProjectDetailResponse` carry `ProjectSiteRunId`. In `content-creator-v2`: `ProjectSummary`,
`GccCreate`, `createProject`, `getProjectSiteStructure`'s caller, `HierarchyContextPanel`'s prop,
`ContentBriefPanel`'s prop.

Accept both names on the wire for one release — old clients and stored payloads exist — then drop
the old.

### 4. Delete what the rename exposes

`SiteAnalysisId` on `Project` exists because a `gcc_site_analyses` row used to wrap the crawl. That
table is Site Analyzer's and belongs to `plans/remove-site-analyzer.md`. Once the field is gone,
check whether anything still reads the table.

## Not in this plan

- **Whether `Project` and `Create` should both exist.** They are the same concept in two shapes, and
  that is the larger question this one sits inside. Renaming does not answer it; it does make the
  duplication legible, because both will carry an identically-named field.
- **Deriving the run id instead of storing it.** It is resolvable from the project URL via
  `hosts-indexed`, but storing it records which crawl a hierarchy choice was made against, and
  deriving it puts a network call into the generate path.

## Verify

1. A project created through the New Project form and one created through `GccV2V1ProjectBridge`
   both render the hierarchy match on page 2. Today the second does not — this is the bug, and it is
   the test that matters.
2. A project stored before the rename still has its run id after a load and a save.
3. `grep -rn "SiteAnalysisProfileId\|SiteAnalysisId" --include="*.cs"` returns only the
   backward-compatible reads in the serialisers.
4. `grep -rn "siteAnalysisProfileId" content-creator-v2/src` returns nothing.
5. `dotnet test`, `tsc --noEmit`, `npm run build`.

## Executed 2026-09-20

`ProjectSiteRunId` / `projectSiteRunId` is now the name on `Project`, on `Create`, on both wire
contracts and throughout the frontend. `dotnet build` clean, 773 unit tests pass, `tsc --noEmit`
clean, `npm run build` clean.

**The column was not renamed.** `GccCreate.ProjectSiteRunId` is pinned with
`.HasColumnName("SiteAnalysisId")` in `ContentCreatorDbContext`, and the model snapshot records the
pin — so this is property-only and no migration runs over live rows.

**Old names still accepted, deliberately.** `CreateProjectRequest` and
`UpdateHierarchyContextRequest` take `ProjectSiteRunId ?? SiteAnalysisProfileId ?? SiteAnalysisId`;
`ProjectSnapshotSerializer` reads all three and writes only the new one; `parseSiteSectionJson` and
`readSiteSectionHandoff` do the same on the frontend, because stored documents and sessionStorage
outlive a deploy. The grep checks above return these reads, not nothing.

### Two things the rename got wrong, and the reason

A regex over "SiteAnalysis*" hit two fields that are **not** this value:

- `GccSiteFinding.SiteAnalysisId` — a real FK to `gcc_site_analyses`
  (`ContentCreatorDbContext:105,115`). Site Analyzer's own, and it belongs to
  `remove-site-analyzer.md`.
- `GccV2JobDto.SiteAnalysisProfileId` — a Geek-SEO profile id, which `GccV2PlanService:132`
  documents as *"not a crawl run"*. V2's, and left alone per the standing instruction.

Both reverted. The tell in each case was that the code around the field described it as something
other than a run: a rename is only safe where the *value* is the run id, never where the name merely
resembles the ones being retired.

### A fourth name, and a live defect it was hiding

`SiteSectionContextDto` binds the run id as **`projectSiteCrawlRunId`**
(`GccV2SiteSection.cs:13`). The frontend was sending the section's run id as
`siteAnalysisProfileId`, which that DTO binds to nothing — so every create made through the section
handoff stored `Guid.Empty` as the section's run id. `siteSectionForApi` now sends
`projectSiteCrawlRunId`, and `parseSiteSectionJson` reads back all four names.

The DTO's own wire name is left as-is: it is V2's contract, and changing it would need a converter
to keep reading the `siteSectionJson` rows already written under it.

### Still carrying the retired name, on purpose

Out of scope here, listed so they are not mistaken for misses:

- `gcc_site_analyses` / `gcc_site_findings` and everything around them — `remove-site-analyzer.md`.
- Geek-SEO's `SiteAnalysisProfile*` repositories and `HttpGeekSeoSiteAnalyzerClient` — a different
  product's real API.
- `GccController`'s three `_seo` call sites and the `stale_site_analysis` error discriminator —
  named in `finish-the-v1-restore.md` as needing a replacement or removal.
- `src/app/api/site-analyzer/*` proxy routes — they target GeekAPI routes that no longer exist.

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

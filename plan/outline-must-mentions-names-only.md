# Outline names + article links: on-site only

**Path:** `/Users/jeffmartin/development/content-creator-v2/plan/outline-must-mentions-names-only.md`

## Problems

### A. Outline must-mentions show URLs / `leads`
PLAN invents outline bullets from `operatorTools` via `GuessToolNameFromUrl` (full URL or last path segment).

### B. Lede (and body) link to partner sites, not geekatyourspot.com
WRITE notes say `Name <href>` and “use the given href.”  
[`MergePartnerTools`](file:///Users/jeffmartin/development/GeekBackend/GeekAPI/Services/ContentCreatorV2/Adapters/GccV2ContextAdapter.cs) concatenates:

- hierarchy `recommendedTools` (often `/tools/marketing/mailchimp`)
- **and** `operatorTools` (destination `https://mailchimp.com`)

Deduped by **href**, so the same tool can appear **twice**. The model prefers absolute partner URLs → lede gets wrong links (sometimes two).

**Intent:** operator URLs = **crawl/research only**. Article inline links = **on-site** tool pages (`https://geekatyourspot.com/tools/...`).

## Locked rules

| Data | Outline must-mention | WRITE inline href | Partner crawl |
|------|----------------------|-------------------|---------------|
| `recommendedTools[].name` | Yes | — | — |
| `recommendedTools[].href` (on-site `/tools/…`) | No | Yes (resolved absolute) | Only if absolute off-site was somehow stored — prefer not |
| `operatorTools` URL | **Never** | **Never** | Yes (excerpts) |

## Implementation (GeekBackend)

### 1. Outline names — [`GccV2PlanService.ExtractPartnerToolNames`](file:///Users/jeffmartin/development/GeekBackend/GeekAPI/Services/ContentCreatorV2/Plan/GccV2PlanService.cs)
- Names from `recommendedTools[].name` only.
- Remove operatorTools → `GuessToolNameFromUrl`.
- Reject any name starting with `http://` / `https://`.

### 2. WRITE hrefs — [`GccV2ContextAdapter.MergePartnerTools` / `BuildPartnerWritingNotes`](file:///Users/jeffmartin/development/GeekBackend/GeekAPI/Services/ContentCreatorV2/Adapters/GccV2ContextAdapter.cs)
- Build the prompt tool list from **recommendedTools only** (names + on-site hrefs).
- Do **not** merge operator destination URLs into writing-note hrefs.
- Dedupe by **tool name** (case-insensitive), not by href.
- Prefer href when `HrefLooksLikeOnSiteToolPage` (or relative path contains `/tools/`); drop off-site hrefs from the prompt list.
- Resolve relative `/tools/…` to absolute using create `siteUrl` / brand website / `ToolBaseUrl` so the model gets `https://geekatyourspot.com/tools/marketing/mailchimp`, not a bare path.

### 3. Crawl unchanged
[`CollectPartnerToolRows`](file:///Users/jeffmartin/development/GeekBackend/GeekAPI/Services/ContentCreator/GccPartnerUrlResearchService.cs) still attaches operator destinations for `FetchAsync` / `partnerResearch` excerpts only.

## Tests
- `ExtractPartnerToolNames`: operator URLs present → names only; no URLs; no `leads`.
- `MergePartnerTools` (or writing-notes builder): recommended on-site + operator off-site → one entry per name with **on-site** href only.
- Relative `/tools/marketing/mailchimp` + siteUrl `https://geekatyourspot.com` → absolute geekatyourspot URL in notes.

## Verify after deploy
Regenerate outline (clean bullets). New generate: lede/body partner links point at `geekatyourspot.com/tools/…`, not manychat.com / mailchimp.com.

## Non-goals
- Changing Confirm UI
- Stopping operator URL paste (still needed for crawl)
- Changing polite crawler

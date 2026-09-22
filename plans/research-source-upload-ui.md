# Research source upload UI: real backend, dead frontend

Found 2026-09-22 while auditing why Pillar/Blog's `retrieval:` heading-provenance check kept failing
against an empty evidence set (GeekBackend `aa1198e` removed that check as a result — see
`grounded-generation-and-serp.md`). Tracing *why* `create.ResearchJson.Quoteables` was so often empty
led here: there is currently no way for an operator to populate it at all.

## The gap, precisely

**Backend — real, working, untouched by this plan.** `POST creates/{id}/keyword-sources`
(`GccController.UploadKeywordSource`, GeekBackend) accepts a file + `category` and parses it
server-side into the create's `ResearchJson`:

| Category | What happens |
|---|---|
| `KeywordResult` | Saved Google SERP HTML → `GccSavedSerpParser` → organics + related searches, stored as a `SerpPage`. Never hard-fails — even a zero-organic parse persists with its `ParseWarning` rather than losing the upload. |
| `Wikipedia` / `EduDomain` / `GovDomain` | Parsed as an article into a `Quoteable` (URL + headings + paragraphs) — this is the pool `GccHeadingProvenanceGuard`'s evidence and `BuildEvidenceBlock`'s prompt context are built from. |
| `PeopleAlsoAsk` | A `.txt` file, one question per line, parsed and **returned for operator weeding** (never auto-dumped into the brief) — the operator picks which land in `brief.paaQuestions`. |

Unlimited files, `GET`/`DELETE` companions exist too (`listCreateKeywordSources`,
`deleteCreateKeywordSource` client functions, backed by real routes).

**Frontend — the client functions exist, nothing calls them.** `uploadCreateKeywordSource`,
`listCreateKeywordSources`, `deleteCreateKeywordSource`, and the `GCC_KEYWORD_CATEGORIES` list all
live in `src/services/gcc-api.ts`. Checked every `.tsx` file in the repo: **zero components import or
call any of them.** No upload button, no category picker, no attached-sources list, anywhere.

**What's live instead is a different, narrower thing.** `SerpIngestPanel` (rendered inside
`ContentBriefPanel`) uploads one SERP HTML page through `parseSavedSerp` → `POST serp/parse` — a
stateless parse-only endpoint. The operator curates organics/PAA/related-searches from it into plain
*brief text fields* (`serpTitles`, `serpUrls`, typed PAA lines). It never writes to
`ResearchJson.Quoteables` or `SerpPages`, and it only handles the `KeywordResult` category — Wikipedia
and .edu/.gov articles have no ingestion path at all, live or dead-but-close.

**Consequence:** any generation-time mechanism that reads `Quoteables` — heading-provenance evidence,
`BuildEvidenceBlock`'s prompt context, the `retrieval:` licensing kind that was just removed — was
checking against a pool nothing can currently fill. Not "often empty because it's optional." Always
empty, because there's no live path to it at all.

## What "done" looks like

An operator on a create can:
1. Upload a Wikipedia / .edu / .gov article (or another SERP page) as a file, pick its category, and
   see it land in a list of attached sources with a name and parse status.
2. Upload a `PeopleAlsoAsk.txt` and get back the parsed question list to weed/select from — mirroring
   the "direct PAA entry" flow `ContentBriefPanel` already has for manually typed questions
   (`ContentBriefPanel.tsx:538-543`), not replacing it.
3. Remove an attached source.
4. See, before generating, that a create with an empty source list is a create with no `retrieval`-
   equivalent evidence available for Pillar/Blog's heading-provenance headroom.

This is additive to `SerpIngestPanel`, not a replacement for it — `SerpIngestPanel`'s curated-organics-
into-brief-fields flow is real and stays. This plan is specifically about the three categories that
currently have *no* ingestion path (Wikipedia, EduDomain, GovDomain) plus wiring up the two that have
a backend route but no UI at all (`PeopleAlsoAsk` file upload, and `KeywordResult` uploaded as a
`Quoteable`/`SerpPage` rather than only through `serp/parse`'s stateless curate-into-brief-fields path).

## Open design questions (answer before building)

1. **Where does this live?** A new panel/section inside `ContentBriefPanel` next to `SerpIngestPanel`,
   or its own standalone component? Given the "mirror an existing analogous component's ownership
   boundary" preference, `SerpIngestPanel`'s own shape (upload input, parsed-result preview, curate/
   confirm action) is the closest sibling to follow.
2. **Multi-file at once, or one at a time?** The backend endpoint takes one file per call
   (`[FromForm] IFormFile? file`) — the UI can still offer a multi-select input and fire one request
   per file, but needs a per-file success/failure result (the backend "never hard-fails" a SERP parse,
   but a genuinely malformed non-SERP file could still 400).
3. **PeopleAlsoAsk weeding UX** — the backend returns the raw parsed question list and does *not*
   persist it; the client must hold that list, let the operator pick, then write the selection into
   `brief.paaQuestions` itself (likely via the existing `patchBriefResearch`/brief-save path). Needs
   the same "fill-empty, never clobber a typed entry" rule `ContentBriefPanel` already applies to SERP
   merges (`ContentBriefPanel.tsx:186`).
4. **Attached-source list** — `listCreateKeywordSources` returns `GccKeywordSource[]`; confirm its
   shape (name, category, counts) is enough to render a useful list before designing the UI around it.

## Sequencing

Independent of the content-type disable/resolve-plan work (`content-type-dispatch-and-richness.md`) —
this is a research/evidence-input gap, not a content-type generation gap, and doesn't block or get
blocked by it. Per the standing instruction to concentrate on testing and bug fixes first, this stays
a written plan only, not started, until that phase is done and this is explicitly picked up.

## Not started

Nothing has been built. This document exists so the next pass starts from the actual gap (traced to
specific file/line evidence above) rather than re-discovering it.

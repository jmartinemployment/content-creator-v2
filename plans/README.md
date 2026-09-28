# Plans index

*"Because there are so many plans I cannot remember their names."* — Jeff, 2026-09-29

**Status here is checked against code, not copied from the document's own header.** That distinction
is the entire point of this file. Twice on 2026-09-29 a plan's own header proved wrong:
`validate-partner-competitor-urls.md` described a submit block that was never written, and the
competitor extraction spec was marked **Complete** with a §12 checklist all Done while every caller
sat on a path that has never produced a document.

| Status | Meaning |
|---|---|
| **Live** | verified against the code today |
| **Partial** | some of it built; the row says which part is not |
| **Open** | decided, not built |
| **Unverified** | not checked against code — read it as a claim, not a fact |

Anything marked **Unverified** has the same standing as those two headers had. Check before relying
on it, and change the row when you do.

## Current

| Plan | What it decides | Status |
|---|---|---|
| [one-way-to-write.md](one-way-to-write.md) | Three writers share one prompt library; the one that runs fills in almost none of the context those prompts read. Root cause + nine stages | **Open** — §4.1 landed, the rest not started |
| [validate-partner-competitor-urls.md](validate-partner-competitor-urls.md) | A declared partner or competitor URL must have an indexed crawl behind it | **Live** 2026-09-29 — form, `POST` and `PUT` |
| [one-long-form-path.md](one-long-form-path.md) | The 12-type lede is shared; Tool's body is not | **Partial** — lede shared 2026-09-23; Tool's subject is still `create.Topic` |
| [tool-page-per-partner.md](tool-page-per-partner.md) | Five partners should be five pages, each from its own evidence | **Open** |
| [prompts-per-content-type.md](prompts-per-content-type.md) | One prompt set per content type rather than a type × role matrix | **Live** — `IContentTypePrompts`, Pillar/Blog/Tool |
| [remove-site-analyzer.md](remove-site-analyzer.md) | Site Analyzer is obsolete; structure comes from a Geek-Crawler-v2 run | **Live** — no live reference remains in `src/` |
| [grounded-generation-and-serp.md](grounded-generation-and-serp.md) | Grounding, the Brief reaching it, a real SERP | **Partial** — Stage 4 (`ContentDocument` covers 4 of 7 block kinds) open |
| [one-run-one-url.md](one-run-one-url.md) | A Run ID names one URL; re-crawl refills it in place | **Unverified** |
| [one-name-for-the-run-id.md](one-name-for-the-run-id.md) | `siteAnalysisProfileId` → `projectSiteRunId` | **Unverified** |
| [project-is-the-whole.md](project-is-the-whole.md) | The site URL and its Run ID belong to the project, not the client | **Unverified** |
| [site-grounding-on-geek-crawler.md](site-grounding-on-geek-crawler.md) | Rebuild site grounding on Geek-Crawler-v2 | **Unverified** |
| [site-structure-wrong-source.md](site-structure-wrong-source.md) | Site structure reads the wrong source | **Unverified** |
| [rag-foundation-rewrite.md](rag-foundation-rewrite.md) | What competitor, partner and project-site data each mean | **Unverified** |
| [rag-serialization-bottleneck.md](rag-serialization-bottleneck.md) | The node survives ingestion and dies at serialization | **Unverified** |
| [generate-async-signalr.md](generate-async-signalr.md) | Generate becomes a job pushed over SignalR | **Unverified** |
| [draft-workspace-display.md](draft-workspace-display.md) | `CreateDraftWorkspace` artifact switching and density | **Unverified** |
| [cross-linking-generated-content.md](cross-linking-generated-content.md) | Cross-linking a create's generated content | **Unverified** |
| [content-type-dispatch-and-richness.md](content-type-dispatch-and-richness.md) | Content-type dispatch and richness | **Open** — its own header says deliberately not started |
| [research-source-upload-ui.md](research-source-upload-ui.md) | Research source upload: real backend, dead frontend | **Unverified** |
| [finish-the-v1-restore.md](finish-the-v1-restore.md) | Finish the v1 restore | **Unverified** |
| [agent-specialists.md](agent-specialists.md) | Agent specialists per content type | **Open** — proposal |
| [citeable-create-pipeline.md](citeable-create-pipeline.md) | Citeable Create M1–M2 | **Unverified** — v2-era |
| [citeable-create-m3.md](citeable-create-m3.md) | Citeable Create M3 | **Unverified** — v2-era |
| [restyle-brand-colors.md](restyle-brand-colors.md) | Brand colours | **Live** — shipped |

## Deleted, still in git history

`competitor-extraction-complete.md` and `partner-extraction-complete.md` were removed from this
directory on 2026-09-29. Both describe subsystems that exist in code
(`GccV2CompetitorExtractionService`, `GccV2PartnerExtractionService`). The partner half is called by
the live Tool path; the competitor half has no caller outside `ContentCreatorV2`. Recover either with
`git show HEAD:plans/<name>.md`.

## Not a plan

`query.py` — an operator script, deliberately untracked.

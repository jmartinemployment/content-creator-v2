# Handoff — content-creator-v2, 2026-10-06, updated 2026-10-08

For whoever picks this repository up next. Everything here was checked on 2026-10-06 against the
repository, Vercel and Railway, and §3 and the 2026-10-08 entries in §5 were checked again on
2026-10-08; where something was not checked, it says so. Authority for rules is
[`AGENTS.md`](AGENTS.md); this file says where things stand and what to do next.

## 1. What this repository is

The Content Creator frontend (Next.js, deployed on Vercel from `main`). It passes a project id to
GeekAPI and displays results. It has no crawler, no browser automation and no database of its own.
Data goes GeekAPI → GeekRepository → Supabase (`content_creator` schema). This app starts no crawl;
crawls are started in Geek-Crawler-v2.

**Pushing to `main` deploys.** There are no branches. A commit that calls a GeekAPI route must not be
pushed before that route is deployed, or the live app breaks. GeekAPI and GeekRepository deploy from
GeekBackend's `main` on Railway, separately.

## 2. The rules that shape the code (details in AGENTS.md)

- **The project is the unit.** Project ID is the key. A project is one keyword and one brief; its
  brief, every Generate and every draft are addressed by the project id alone. No "create", create id,
  list of pieces or `?create=` appears anywhere. (Jeff, 2026-10-04.)
- **One Save button writes the brief.** Nothing about the brief is kept in the browser.
  `src/no-browser-storage.test.ts` fails on any `localStorage` or `sessionStorage` use under `src`.
  Do not add a second way to write the brief. (Jeff, 2026-10-04.)
- **Fail closed, no middle states, no fallbacks, no stubs.** A piece saved with its gap named is not
  a middle state; a piece silently thinned is.
- **Markdown is forbidden** as corpus, interchange or verification format. The model never emits
  markup; one renderer produces HTML.
- **One session per repository.** A session reads other repositories to learn an API's shape and
  changes nothing there, builds nothing there, commits nothing there, and does not message the other
  sessions to push.
- **No tools section on a pillar or blog; Topic is `descriptor: keyword`; affiliate wording is banned.**

## 3. What is deployed right now

| Repository | `main` | Deployed | Checked |
|---|---|---|---|
| content-creator-v2 | `e91357b` | Vercel production, READY (`dpl_ERsRmeQoNnHVnToEGwSv38Yxcu7r`) | 2026-10-08 |
| GeekBackend (GeekAPI + GeekRepository) | `e45bd0e` | Railway, SUCCESS 2026-10-07 19:57 UTC, both services | 2026-10-08 |
| Geek-Crawler-v2 | `fabb42f` | not checked from here | — |
| Geek-Crawler-Rag | `5e622b6` | not checked from here | — |

The deployed frontend is the project-keyed page:

- `/app/workflow` lists clients and their projects. `/app/projects/[id]?section=…` is one project:
  Brief & Generate, Profile, Deliverables, Tasks & Time, History.
- The brief is read from the project (`GET projects/{id}`) and written by the Save button
  (`PATCH projects/{id}/brief` with `expectedVersion`; a stale save is refused with the server's
  sentence and nothing is overwritten). An incomplete brief saves; completeness gates Generate.
- Generate is `POST projects/{id}/generate`. A running run covers the page; the page reads the
  project's newest run when it opens (`GET projects/{id}/generate/latest`), so a reload shows a run
  in progress or the last run's outcome. A Generate rewrites the project's pages as new versions and
  saves them in one write; the run's result records what it saved.
- Drafts come from `GET projects/{id}/artifacts`; export from `GET projects/{id}/export/html`;
  deliverables are a name and a due date on the project.

The wire contract is [`plans/project-api-contract.md`](plans/project-api-contract.md). It is the
agreement between this repo and GeekAPI; change it before changing either side.

## 4. Where the code is

| Concern | File |
|---|---|
| The project page and its sections | `src/app/app/projects/[id]/page.tsx` |
| Brief & Generate, drafts, revise, SEO/polish, approve, export | `src/components/content-creator/ProjectContentWorkspace.tsx` |
| The brief form and its Save button | `src/components/content-creator/ContentBriefPanel.tsx` |
| Niche framing fields (inside the brief) | `src/components/content-creator/NicheFramingPanel.tsx` |
| Saved-SERP upload into the brief | `src/components/content-creator/SerpIngestPanel.tsx` |
| Brief fields, required list, fingerprint, migration | `src/lib/content-creator/brief-catalog.ts` |
| What a run saved / is doing, from hub events and the latest-run read | `src/lib/content-creator/run-display.ts` |
| GeekAPI content routes (brief, generate, artifacts, versions, export) | `src/services/gcc-api.ts` |
| GeekAPI project, client, task, time, deliverable routes | `src/services/gcc-projects-api.ts` |
| SignalR hub for generate progress | `src/services/workflow-tools-hub.ts` |
| Project form, with the declared-URL index check | `src/components/content-writer/ProjectForm.tsx` |
| Deliverables | `src/components/content-writer/ProjectDeliverablesPanel.tsx` |

Checks: `npx tsc --noEmit`, `npx eslint src`, `npm test` (node's test runner over `src/**/*.test.ts`;
six files). There is no component-rendering test setup and no browser test; do not start a local
dev server to verify UI (Jeff's standing rule) — verify against the deployed app.

## 5. What is open

**Shipped 2026-10-08 (`8ebd3d4`): the run log.** When a run reports anything under "Not written" or
"Written with a gap", or a progress line says failed or refused, the Generate panel reads
`GET projects/{id}/generate/{jobId}/events` and shows the run's whole record on the page — grounding,
every model call, every verdict, every outcome — because the events URL is authenticated and does not
open as a bare link (Jeff, 2026-10-06). The route is GeekAPI `a28c7fd`, in the Railway deployment of
`e45bd0e`. Recorded refusals are shown as the backend typed them; the page no longer prefixes "tool:".

**Plans directory pruned 2026-10-08 (`e91357b`).** Nineteen files deleted — the eighteen
`fix-overview.md` Appendix A retired, plus the stale generated `fix-content-creator-complete.md`.
What remains is what drives work: the fix-overview set, `fix-project-persistence.md`,
`project-api-contract.md`. The plans directory is not a documentation directory (Jeff).

**From `plans/fix-project-persistence.md` (the project-is-the-unit plan):** P0 is shipped on both
sides. Still open there:

- **GF6, second test:** no rendered page may contain a GUID other than the project id and the labelled
  Run ID. Needs a rendering test setup first (new dev dependencies). Jeff: after GeekBackend finishes.
- **P1 and P2** are GeekBackend's (re-keying drafts, deliverables, inputs and evidence to the project;
  removing the create table and routes last). The frontend follows the contract as those land.
- **The backfill (GR3)** ran for one project only ("test"), by Jeff's choice. Any other pre-existing
  project opens with an empty brief; its old brief is still on its create row in the database.

**From `plans/fix-frontend.md` (the Wave plan):** F1–F6 are done. F7–F11 are held until the Accounts
Payable generate has been run and read, and each also needs something GeekAPI does not have as of
`5671288`:

| Stage | Needs from GeekAPI |
|---|---|
| F7 — send the chosen writing provider to the partner-quote check | `brief/partner-quote-readiness` takes only project, topic, angle |
| F9 — `grounding:` warnings shown under the readiness block | **Met.** `GccGenerationCoordinator.GroundingWarningLabel = "grounding"` (`:131` at `5671288`) reaches `warnings` as `grounding: …` and the hub as a type event with that `contentType`; the live page shows one under "Written with a gap". This row said "no such warning prefix" until 2026-10-06; it was wrong |
| F10 — "drafted, saving" per-type progress | no such progress event |
| F11 — Revise through a revise-job route | no such route; `versions/{id}/revise` is the only one |

**Across all repositories (`plans/fix-overview.md`):** the end-to-end proof is one Generate on the
Accounts Payable project — the project named **"test"** (`ed18d0e5-…`), keyword "Accounts Payable:
Automated Approval Workflows", five partners — all seven live types, read by Jeff, with every quote
found on the page it cites. The run of 2026-10-05 18:24 UTC requested only `tool`, `blog`, `pillar`
and finished before GeekAPI `5671288` deployed, so it was not the proof. **Two proof runs were started on 2026-10-06 against `5671288`**, all seven types each. The first,
on OpenAI (10:05 UTC), failed closed in 35 seconds with nothing saved: OpenAI returned
`429 insufficient_quota` / `credit_balance_exhausted` — "You have no credits remaining" — on every
piece. That is a billing limit on the OpenAI account, for Jeff at platform.openai.com. The second,
on Anthropic (10:06 UTC), passed the pre-flight 5 of 5 and then failed closed in 2.5 minutes with
nothing saved: every writing call — pillar, blog, all five tool pages — returned HTTP 200 after
18–66 s with "Anthropic response contained no text content block". The mechanism the evidence
supports, recorded as `plans/fix-geekapi.md` F-A19: `claude-sonnet-5` runs adaptive thinking when
`thinking` is omitted, GeekAPI's provider omits it and sends 512–4,096 `max_tokens`, so the budget
is spent thinking and the body holds only empty `thinking` blocks. Not confirmed — the provider logs
nothing about a 200 body. **So the proof has not been run.** It needs either OpenAI credits or the
F-A19 fix in GeekAPI, and then one seven-type Generate on "test".

**Stale documents — rewritten 2026-10-06.** `README.md` now describes the project-keyed product
and cites only files that exist. `STATUS.md` is headed as the 2026-10-03 record, superseded here for
state and kept for its "Known open" list.

## 6. How to check the live app does what it says

The P0 gate from the plan, in order:

1. Open a project, edit the brief and niche framing, click **Save**, hard-reload: everything is there
   and the line beside the button says "Saved to the server at HH:MM".
2. Edit the same project in two tabs: the second Save is refused with the 409 sentence, nothing is
   overwritten, and both saves exist as revisions in `content_creator.gcc_project_revisions`.
3. The URL and the page contain no create id; the only identifiers on screen are the project's and
   the labelled Run ID on Profile.
4. An incomplete brief saves; Generate is off and says which fields are missing. A brief edited after
   the last Save disables Generate until saved.
5. After a Generate, each version shows "Generated from the brief saved at …", and that revision's
   `brief_json` contains the niche framing that was on screen.

## 7. Pitfalls recorded this week

- **Read the deployed commit, not the plan.** Twice a page was pushed before the routes it called
  existed. Check Railway's deployed commit for GeekAPI, then `git show` that commit's controller for
  the route and record shapes, before pushing anything that calls it.
- **A plan can say more than Jeff asked for.** Persistence features were built from a plan's
  elaboration and vetoed. When a plan adds UI or behaviour beyond the request, ask before building.
- **`GET /creates` and the create routes still exist in GeekAPI** for P0's server-side create row.
  Nothing in this repo may call them; the client code for them is deleted.
- **Browser storage keys** `gcc-content-brief:*` may still exist in operators' browsers from the
  previous design. The app never reads, writes or deletes them.

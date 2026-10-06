# Handoff — content-creator-v2, 2026-10-06

For whoever picks this repository up next. Everything here was checked on 2026-10-06 against the
repository, Vercel and Railway; where something was not checked, it says so. Authority for rules is
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
| content-creator-v2 | `8b621ab` | Vercel production, READY | 2026-10-06 |
| GeekBackend (GeekAPI + GeekRepository) | `5671288` | Railway, SUCCESS 2026-10-05 19:57 UTC | 2026-10-06 |
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
| F9 — `grounding:` warnings shown under the readiness block | no such warning prefix found in the generate code |
| F10 — "drafted, saving" per-type progress | no such progress event |
| F11 — Revise through a revise-job route | no such route; `versions/{id}/revise` is the only one |

**Across all repositories (`plans/fix-overview.md`):** no wave's end-to-end proof has been run yet.
The proof is one Generate on the Accounts Payable project, all seven live types, read by Jeff, with
every quote found on the page it cites. It was held until persistence was fixed; that gate is now met.

**Stale documents, known:** `README.md` still describes the old create-based product
(`/creates/new`, PLAN → WRITE → VALIDATE). `STATUS.md` is dated and partly superseded by this file.

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

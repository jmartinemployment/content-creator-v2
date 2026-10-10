# content-creator-v2

I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.
I am implementing Content Creator version one.

**Correctness over expediency.**

The Content Creator frontend. An operator opens a client's project, saves its brief, presses
Generate, and reads the pages GeekAPI wrote — grounded on the crawl Geek-Crawler-v2 already ran for
that site and its declared partners. This app passes a project id to GeekAPI and displays results. It
has no crawler, no browser automation and no database of its own.

| | |
|--|--|
| **Production UI** | `https://content-creator-v2-phi.vercel.app` — deployed from `main` on every push; there are no branches |
| **GeekAPI** | `https://api.geekatyourspot.com`, routes under `api/geek-content-creator` |
| **Direction** | **Version one is what is being implemented.** v2 lost features and was rolled back. The repo name and the `ContentCreatorV2/*` namespace are historical, not a statement of direction |
| **Where things stand** | [`HANDOFF.md`](HANDOFF.md) — what is deployed, what is open, how to check the live app |
| **Authority** | [`AGENTS.md`](AGENTS.md) (service boundaries, rules, current state) · [`architecture.md`](architecture.md) · [`.cursor/rules/`](.cursor/rules/) (non-negotiables, always applied) |

## The product, as deployed

**The project is the unit.** A project is one client, one site, one keyword and one brief. Its brief,
every Generate and every draft are addressed by the project id alone; nothing else is visible.

- `/app/workflow` — clients and their projects. Everything starts here; `/app` redirects to it.
- `/app/projects/[id]?section=…` — one project: **Brief & Generate**, Profile, Deliverables,
  Tasks & Time, History.
- **The brief** is read from the project and written by one **Save** button
  (`PATCH projects/{id}/brief`, with the version it was read at; a stale save is refused and nothing
  is overwritten). An incomplete brief saves; completeness gates Generate. Nothing about the brief is
  kept in the browser — `src/no-browser-storage.test.ts` fails on any `localStorage` or
  `sessionStorage` use under `src`.
- **Generate** is `POST projects/{id}/generate` for the chosen content types and writing provider.
  Progress arrives over SignalR (`/hubs/gcc-v2-realtime`); a reopened page reads the project's newest
  run (`GET projects/{id}/generate/latest`) and shows a run in progress or the last run's outcome —
  what it saved, what it refused by name, the gaps it saved with, and which partners could be
  grounded.
- **Drafts** are the project's pages, one per content type and name; a Generate rewrites them as new
  versions. Each shows "Generated from the brief saved at …". SEO and polish scores, approve,
  and HTML export (`GET projects/{id}/export/html`) work on them.
- **Content types live today:** Pillar, Blog, Tool (one page per usable declared partner, with a
  pre-flight that refuses a partner by name rather than silently producing fewer pages), cold-outreach
  email, Social, Image prompts, Ads. Every other type is disabled.

The wire contract between this repo and GeekAPI is
[`plans/project-api-contract.md`](plans/project-api-contract.md). Change it before changing either
side.

## Place in the platform

```text
Geek-Crawler-v2 ──crawls──▶ GeekAPI / GeekRepository ──▶ MongoDB (crawl_runs, crawl_pages)
                                                          │
                                                          ▼
                                           Geek-Crawler-Rag / Qdrant  (retrieval + quote verification; never generates)
                                                          │
                                                          ▼
                              GeekAPI  api/geek-content-creator  (generation, grounded on verified block text)
                                   │                      │
                                   ▼                      ▼
     Supabase content_creator (projects, briefs,    content-creator-v2 (this repo)
     versions) via GeekRepository
```

This repo owns the brief UX, the Generate controls and the reading of what was written. It starts no
crawl, talks to no database, and never reaches MongoDB, Qdrant or Supabase directly. Markdown is not
a corpus, interchange or verification format anywhere on this path; the model never emits markup and
one renderer in GeekAPI produces the HTML.

## Technology

Next.js App Router, React, TypeScript, Tailwind CSS, Microsoft SignalR, OAuth 2.0 Authorization Code
+ PKCE against GeekOAuth, Vercel.

The browser never holds a GeekAPI token. Tokens stay in HTTP-only cookies; `src/proxy.ts` refreshes
the access token before a request reaches a Server Component, and `src/app/api/cw/[...path]` forwards
the signed-in user's Bearer to GeekAPI. There is no API-key fallback when the user's token is
rejected — that masked auth failures once.

## Local development

```bash
npm install
npm run dev        # http://localhost:3003
npm run build
```

Configure GeekOAuth and GeekAPI per [`.env.example`](.env.example). Read environment variables so
`""` counts as absent — `??` passes an empty string through and has caused two production auth
outages.

**Checks:** `npx tsc --noEmit`, `npx eslint src`, `npm test` (node's test runner over
`src/**/*.test.ts`). There is no component-rendering test and no browser test. Do not start a local
dev server to verify UI — verify against the deployed app (Jeff's standing rule).

## Documentation

| Doc | Role |
|-----|------|
| [`HANDOFF.md`](HANDOFF.md) | Where the frontend stands, what is open, how to check the live app |
| [`AGENTS.md`](AGENTS.md) | Service boundaries, crawl types, fail-closed rules, current state |
| [`architecture.md`](architecture.md) | Platform map and contracts |
| [`plans/project-api-contract.md`](plans/project-api-contract.md) | The GeekAPI routes this app calls, and their shapes |
| [`plans/fix-overview.md`](plans/fix-overview.md) | The cross-repository fix plan and its end-to-end proof |
| [`.cursor/rules/`](.cursor/rules/) | Agent rules: no fallbacks, no stubs, no unwired code, RAG never generates |

`STATUS.md` is a dated snapshot; `HANDOFF.md` supersedes it. Do not resurrect parallel living plans:
[`AGENTS.md`](AGENTS.md) is the standing authority.

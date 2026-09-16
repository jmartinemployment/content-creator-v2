# content-creator-v2

**Correctness over expediency.**

Content Creator v2 is an authenticated, AI-assisted writing workspace for marketing operators and agencies. It turns a project website, content brief, and partner/competitor research into grounded, citeable content for editing, publishing, or export.

| | |
|--|--|
| **Production UI** | `https://content-creator-v2-phi.vercel.app` |
| **GeekAPI** | `https://api.geekatyourspot.com` |
| **Release status** | **Not release-ready.** v1's frontend is restored and in production; drafting is off by default (`ContentCreatorV2:DraftingEnabled=false`). See [`AGENTS.md`](AGENTS.md) § Current state |
| **Authority** | [`AGENTS.md`](AGENTS.md) (service boundaries + current state) · [`architecture.md`](architecture.md) (platform contracts) · [`.cursor/rules/`](.cursor/rules/) (agent-enforced non-negotiables) |

## Product overview

Operators move from research and planning through outline approval, writing, validation, and Canvas export. Project-site brand context combines with external evidence from Geek-Crawler and Geek-Crawler-Rag.

### Capabilities

- Project-site crawling, hierarchy, BrandKit, and related-page context
- Persisted briefs (topic, keyword, intent, stage, voice, PAA, **partner tool URLs**, **competitor page URLs**)
- Partner/competitor crawl runs **always required** — **fail closed** if either is missing (tools = partners; competitors never as partner)
- Competitor extraction plan (complete): [`plans/competitor-extraction-complete.md`](plans/competitor-extraction-complete.md) (extract + competitor SoftwareApplication JSON-LD)
- Partner extraction plan (complete): [`plans/partner-extraction-complete.md`](plans/partner-extraction-complete.md) (citable, ads, comparison, alternatives, partner SoftwareApplication JSON-LD)
- Approval-driven `PLAN → WRITE → VALIDATE → REPAIR` Create jobs
- Citeable blog/pillar path with verified quotations, partner-mention gate, and `sourceRights`
- Articles, guides, comparisons, tool/service/local pages, ads, social, and related formats
- Editable outlines, section regen, SEO/GEO reporting, CMS publish, export
- SignalR job progress (`/hubs/gcc-v2-realtime`) — no timer polling for live status

### Technology

Next.js App Router, React, TypeScript, Tailwind CSS, Microsoft SignalR, OAuth 2.0 Authorization Code + PKCE, BFF route handlers, GeekAPI, Vercel.

## Place in the Geek content platform

```text
Geek-Crawler → GeekAPI/Repository → MongoDB
                                      ↓
                            Geek-Crawler-Rag / Qdrant
                                      ↓
                          GeekAPI ContentCreatorV2
                                      ↓
                         content-creator-v2 (phi) → Canvas / export
```

This repo owns brief UX, editorial controls, Canvas, publishing, and export. It does not crawl partner research from the browser and does not talk to MongoDB or Qdrant directly.

## Local development

```bash
npm install
npm run dev
# http://localhost:3004
```

```bash
npm run build
```

Configure GeekOAuth and GeekAPI per [`.env.example`](.env.example). Tokens stay in HTTP-only cookies; infrastructure and LLM secrets never ship to the browser.

### Unified Create + evidence

`/creates/new → persisted job → Canvas` is the only authoring path. Product `/rag` is **404**. The BFF still proxies `/api/rag/*` to GeekAPI for research status and Create helpers.

The draft workspace stays backward-compatible with older jobs. Newer results may include `citations`, `sectionCitations`, `provenance`, `evidenceManifest`, `modelPolicy`, and `approvedStageModels`. `jobStatus: Ready` is not `shipReady`.

## Documentation

| Doc | Role |
|-----|------|
| [`AGENTS.md`](AGENTS.md) | Service boundaries, crawl types, fail-closed rules, current state |
| [`plans/README.md`](plans/README.md) | Plans index + rules sync note |
| [`architecture.md`](architecture.md) | Platform map, copy/call/do-not-reuse, Create contracts |
| [`.cursor/rules/`](.cursor/rules/) | Agent rules mirrored from master-plan non-negotiables |
| [`AGENTS.md`](AGENTS.md) | Agent entry (Next.js notice + project pointers) |
| [`tests/e2e/README.md`](tests/e2e/README.md) | Playwright against real GeekOAuth + GeekAPI |

`plans/master-plan.md` was deleted; [`AGENTS.md`](AGENTS.md) is the standing authority. Do not resurrect parallel living plans.

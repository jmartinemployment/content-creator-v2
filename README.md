# content-creator-v2

**Correctness over expediency.**

Content Creator v2 is an authenticated, AI-assisted writing workspace for marketing operators and agencies. It turns a project website, content brief, and partner/competitor research into grounded content ready for editing, publishing, or export.

Production frontend: `https://content-creator-v2-phi.vercel.app`

## Product overview

The application guides an operator from research and planning through outline approval, writing, validation, repair, and publishing. It combines project-site brand context with external evidence supplied by Geek-Crawler and Geek-Crawler-Rag.

### Capabilities

- Project-site crawling, hierarchy inspection, BrandKit review, and related-page context
- Persisted briefs covering topic, keyword, intent, buying stage, voice, PAA questions, partners, and competitors
- Approval-driven `PLAN → WRITE → VALIDATE → REPAIR` workflow
- Articles, guides, comparisons, case studies, tool pages, service pages, local pages, and whitepapers
- Social, email, advertising, LinkedIn document, and image-prompt assets
- Citation-first RAG writing with visible sources and verified quotations
- Partner-versus-competitor battlecards and strategy/pitch-slide themes
- Editable outlines, independent section generation, retry, rewrite, expansion, and tone controls
- SEO/GEO readiness reporting and targeted repair
- CMS draft/live publishing, campaign repurposing, PDF generation, ZIP export, and commit-to-site workflows
- Resumable sessions and reconnectable SignalR progress

### Technology

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Microsoft SignalR, OAuth 2.0 Authorization Code + PKCE, secure backend-for-frontend route handlers, GeekAPI, and Vercel.

## Place in the Geek content platform

```text
Geek-Crawler-v2 → GeekAPI/Repository → MongoDB
                                            ↓
                                  Geek-Crawler-Rag/Qdrant
                                            ↓
                                GeekAPI → Content Creator v2
                                            ↓
                                  Edit → Publish → Export
```

This repository owns the writing intent, brief, editorial controls, result presentation, publishing, and export experience. It does not crawl external research sites directly and does not access MongoDB or Qdrant from the browser.

## Local development

```bash
npm install
npm run dev
# http://localhost:3004
```

Production build:

```bash
npm run build
```

Configure GeekOAuth and GeekAPI using the variables documented in [`.env.example`](.env.example). Authentication tokens remain in secure HTTP-only cookies; infrastructure and LLM secrets are never exposed to the browser.

## Documentation

| Doc | Role |
|-----|------|
| [`plan/rules.md`](plan/rules.md) | **Hard rules** — isolation, polling, naming, structure |
| [`plan/crawl-architecture.md`](plan/crawl-architecture.md) | **Crawl domains** — project site vs Geek-Crawler |
| [`plan/crawl-implementation.md`](plan/crawl-implementation.md) | **Crawl build plan** — phases A/B/C |
| [`plan/geek-crawler.md`](plan/geek-crawler.md) | Geek-Crawler ↔ gcc-v2 read boundary |
| [`plan/workflow-discrepancies.md`](plan/workflow-discrepancies.md) | **Audit gaps** — spec vs shipped (incl. Sep 2026 crawl/outline) |
| [`plan/v2-master.md`](plan/v2-master.md) | Master plan |
| [`plan/tool-pages-v2.md`](plan/tool-pages-v2.md) | Tool page generation — keyword overview + partner pages (planned) |
| [`plan/executor.md`](plan/executor.md) | Build phases and isolation rules |
| [`architecture.md`](architecture.md) | Platform map, copy / call / do not reuse |

Content Creator v2 replaces Geek Content Creator v1 when [`plan/v2-master.md`](plan/v2-master.md) is complete. Historical v1 creates remain available through a read-only compatibility surface.

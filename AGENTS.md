# Agent guidance — content-creator-v2

**Correctness over expediency. Always. No exceptions.**

| Authority | Path |
|-----------|------|
| Sole release-plan | [`plans/master-plan.md`](plans/master-plan.md) |
| Architecture contracts | [`architecture.md`](architecture.md) |
| Non-negotiables + honesty | [`.cursor/rules/`](.cursor/rules/) (alwaysApply) |

Before changing Create, RAG clients, BFF, or Canvas: read master-plan Non-negotiables and §Kill switch. Do not invent parallel plans, success-shaped stubs, timer polling for job status, or release-ready claims while §7 is open.

RAG in this platform is **Library-only — retrieval and verification**. It never generates: `/v1/generate` and `rag-generate.*` were removed and must never be revived. Drafting is GeekAPI-side, grounded on Markdown that RAG retrieved and verified — see `.cursor/rules/geek-crawler-rag.mdc`. Creates stay under GeekAPI `ContentCreatorV2/*` and UI `/creates/*`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

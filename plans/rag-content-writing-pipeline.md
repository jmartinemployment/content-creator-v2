# RAG-backed content writing (content-creator-v2 scope)

Status: **Phase C + D1–D3 shipped** (GraphRAG / Rag ad-template index soft-off until Rag D1/D2).  
Sibling plans: Geek-Crawler-v2 (crawl markdown), Geek-Crawler-Rag (index/query), GeekBackend (`POST /api/rag/generate`).

## This app owns

- Operator UX for choosing **writing intent** (long-form vs short-form vs battlecard vs slides/strategy)
- Calling GeekAPI to generate drafts grounded on partner + competitor crawl RAG
- Displaying citations/sources (entity, URL, **verbatim quotes**, themes, applied templates)
- **Ad template corpus** get/apply/manage (local seed + operator saves) for few-shot short-form
- Later: multi-step outline→fill agent (D4)

## Today

- Content Creator v2 talks to GeekAPI for research / WRITE flows **and** intent-routed RAG generate
- GeekAPI calls RAG `v1/query` / `v1/generate` / `v1/pages` via `HttpGeekCrawlerRagClient`
- Writer for `/rag`: prefer Rag citeable multi-step generate; GeekAPI one-shot is fallback
- Soft-disable: when RAG URL unset or `GEEK_RAG_GENERATE_ENABLED=false` → UI falls back to create → research resolver WRITE
- GraphRAG + Rag ad-template index + citeable generate: status flags from GeekAPI

## Product content matrix

| Writing intent | User-facing labels (examples) | Retrieval expectation (via API) |
|----------------|-------------------------------|----------------------------------|
| Long-form | Technical article, case study | Prefer **parent**; o1/o3 writer |
| Short-form | Ads, social, short blurbs | Prefer **child**; optional few-shot ad templates |
| Battlecard | Competitive compare | Dual query partner vs competitors |
| Slides / strategy | Pitch slides, strategy theme | GraphRAG when enabled; else parent hybrid + theme sources |

## Locked decisions (cross-repo)

- Keep **Crawlee** crawl corpus (not Firecrawl)
- Keep **Qdrant** + Geek-Crawler-Rag FastAPI shell; **LlamaIndex** is adopted **inside** that Rag service
- Keep **OpenAI** as writer; **long-form uses o1/o3** via GeekAPI Phase F
- Hybrid + rerank happen in RAG service; this app only passes intent + topic + entities (+ templates)
- **GraphRAG** index lives in Geek-Crawler-Rag; **ad templates are owned by this app**

## Phase 0 — done

## Phase C — **shipped**

## Phase D — **shipped in this app** (Rag backends soft-off)

### D1. Slides / strategy

- Intents: `Pitch Slides`, `Strategy Theme` on `/rag`
- Theme sources panel on results
- Soft warning when GraphRAG unavailable; generate still uses parent hybrid via GeekAPI

### D2. Few-shot ad template picker

- Local corpus (`src/app/rag/ad-templates.ts` + localStorage)
- Pick up to 3 templates; sent as `adTemplates` on generate
- Result shows **Templates applied**

### D3. Long-form writer signal

- Status line shows `longFormModel` / `shortFormModel` from GeekAPI
- Result shows `modelUsed`

### D4. Optional later

- Multi-step “outline → fill sections” agent UX

## Success criteria

- [x] User can generate long-form and short-form drafts from partner/competitor RAG with visible citations
- [x] Intent choice changes retrieval behavior without this app talking to Qdrant directly
- [x] Works with OpenAI writer configured in GeekAPI (soft fallback to default provider)
- [x] Phase D1: slide/strategy flow (GraphRAG soft-off → hybrid + theme sources)
- [x] Phase D2: short-form can get/apply few-shot ad templates via generate
- [x] Phase D3: long-form generate uses GeekAPI o1/o3 path when enabled (UI surfaces model)
- [ ] Phase D4: optional multi-step agent UX

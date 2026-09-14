# Partner extraction plan (complete)

**Updated:** 2026-09-14  
**Accountable owner:** Jeff Martin  
**Release authority:** [master-plan.md](master-plan.md) (sole release-plan & decision record)  
**Platform contracts:** [architecture.md](../architecture.md)  
**Sibling plan:** [competitor-extraction-complete.md](competitor-extraction-complete.md)

**Status: Complete** — GeekAPI eng implementation `gcc-partner-extraction.v2` (2026-09-14). §12 checklist all Done. Jeff signed-in smoke / release-ready remains master-plan §7 (not an extraction code gap).

This file is the **authoritative Partner extraction plan**: the data payloads to isolate from the partner library (`crawlType:"partner"`) so Create and affiliates can build sellable / distributable content — **citable blocks**, **advertisements**, **comparisons**, **alternatives**, **pricing**, and related affiliate surfaces — plus partner **SoftwareApplication** JSON-LD.

Evidence binding (fail closed) remains locked in master-plan **Create evidence policy** + Appendix A. Partner-mention VALIDATE gate remains master-plan **§P1**.

**Implementation note:** Create research merge materializes quoteable page excerpts (`GccQuoteablePage`) **and** structured `partnerExtraction` payloads via GeekAPI `GccV2PartnerExtractionService` (`gcc-partner-extraction.v2`). Citables are Markdown-verified against `GET /v1/pages` with Appendix C offsets/digest/rights; VALIDATE attaches verified citables for §P1. Excerpt-only resolve without `partnerExtraction` is incomplete for §2–§8 consumers.

---

## Status

| | |
|--|--|
| **Status** | **Complete** (2026-09-14) |
| **Policy** | Locked 2026-09-14 — partner crawl required on every Create; tools = partners |
| **Surfaces** | Create → Research **Partner tool URLs (required)** · Geek-Crawler partner runs · Geek-Crawler-Rag library query |
| **Library** | Existing master partner RAG / vector corpus — **extract** structured product payloads; do not invent soft success without cites |
| **Writer** | GeekAPI `gcc-create-library.v1` retrieves partner chunks via `/v1/query` + Markdown verify — **not** RAG `/v1/generate` |
| **Hard rules** | Always required · fail closed · tools = partners · competitors never labeled `partner` |
| **Expansion** | §6–§7 minimum expand + §8 extended catalog locked as product direction 2026-09-14 |
| **Implementation** | **Complete** — GeekAPI `gcc-partner-extraction.v2`; see §12 Done checklist. Jeff signed-in smoke remains release gate (master-plan §7), not an extraction code gap. |

---

## 12. Done checklist (implementation complete)

| Plan item | Status | Where |
|-----------|--------|--------|
| Core assets §2–§5 | Done | `GccV2PartnerExtractionService` |
| Min expand §6 + Proof pack | Done | same |
| Extended catalog §7 | Done | same (heuristic, on-page only) |
| Brief persist `partnerExtraction` | Done | `MergePartnerResearchAsync` + `MergePartnerExtractionIntoBriefJson` |
| Markdown verify + offsets + digest | Done | `GccV2PartnerExtractionVerify` via `GET /v1/pages` (+ optional `runId`) |
| Appendix C provenance | Done | `GccPartnerExtractionProvenance` (`Quote`, `StartChar`/`EndChar`, `SectionKey`, `SourceRights`, `MarkdownVerified`) |
| §P1 preferred evidence | Done | `GccV2PartnerCitableBridge` → VALIDATE before citation audit |
| SoftwareApplication JSON-LD §9 | Done | `GccV2PartnerSoftwareApplicationJsonLd` (price fail-closed) |
| Ads / comparison / alternatives consumers | Done | Ads WRITE seed + full PARTNER EXTRACTION writing notes for long-form |
| Competitor deficit → partner swap | Done | `GccV2PartnerAlternativesJoin` (`crawlType:competitors` on deficit) |
| Library indexing contract | Done | Crawl chunks remain RAG-indexed; structured payloads are brief-assembled (not a second Qdrant product schema — Library half stays query/verify) |
| Unit tests | Done | `GccV2PartnerExtractionServiceTests` + `GccV2PartnerExtractionCompletionTests` |

**Not in this plan’s eng scope:** Jeff §7 smoke / release-ready stamp (master-plan).

---

## 1. Goal

The partner library is already packed with tool / AI product pages. This plan defines **what to extract** from that library—not a release schedule. Operators and affiliates use these payloads as standalone, highly functional content products.

### 1.1 Core product pieces (original lock)

| Product piece | Asset name | Job |
|---------------|------------|-----|
| Verified facts for long-form / Canvas | **Citable** | Copy/paste a claim with legal and digital proof |
| Short-form marketing | **Advertisement** | Hooks, pain triggers, CTA wrappers |
| Versus / side-by-side tables | **Comparison** | Standardized feature vectors across tools |
| “Top alternatives” / switch content | **Alternatives** | Deficit → recommended swap → pivot copy |

### 1.2 Minimum expand (required for ads / alternatives / comparisons / pricing at scale)

| Product piece | Asset name | Job |
|---------------|------------|-----|
| Pricing pages, offers, schema | **Pricing catalog** | Tiers, list price, gates, trial, overages, effective date |
| Audience targeting | **ICP / buyer fit** | Who it is / is not for |
| BOFU compare & integrations rows | **Integrations & ecosystem** | Named integrations, API/SDK, marketplace |
| Objection ads, FAQ, GEO answers | **Objection / FAQ bank** | Q → verified A pairs |
| Trust / social proof blocks | **Proof pack** | Logos, metrics, certifications — each with proof URL |
| Affiliate & conversion routing | **Offer / CTA destinations** | CTA label, destination URL, offer type |
| Honest limits | **Disqualifiers** | Seat caps, regions, languages, “not for X” |

### 1.3 Extended catalog (ship after minimum expand)

| Product piece | Asset name | Job |
|---------------|------------|-----|
| Listicles / tool deep-dives | **Use-case playbooks** | Job-to-be-done → cited steps/features |
| Programmatic SEO / axes | **Category / taxonomy** | Primary category, synonyms, vs-category labels |
| “As of” pricing & feature claims | **Freshness / change log** | On-page price or feature change notices |
| Sales enablement | **Battlecard slice** | Win themes / landmines (partner-only; rival deficits stay on competitor plan) |
| Carousels / LinkedIn docs | **Demo / product tour beats** | Short feature beats with section anchors |
| Legal / trust footnotes | **Compliance & terms snippets** | Refund, residency, SLA — only when explicit on-page |
| Redistributed offers | **Affiliate disclosure hooks** | Required legal lines (policy text, not invented marketing) |

**Contract:** Extraction + indexing + `/v1/query` + Markdown verify = **library**. Assembly into Create drafts = GeekAPI Create library writer. Do **not** use RAG `/v1/generate` or `rag-generate.*` for Create.

**Not partner extraction:** Rival deficits, rival pricing posture, “why leave X,” rankings, or sentiment from thin fluff without a verifiable quote — those belong on [competitor-extraction-complete.md](competitor-extraction-complete.md) (join at assembly time).

---

## 2. The Citable asset (authority blocks)

Content creators need verified facts to prove claims. Extract **modular packages** so an end user can confidently place a fact next to its proof.

| Field | Meaning | Example |
|-------|---------|---------|
| **`isolated_claim`** | Raw stat, metric, or definitive feature truth | “Reduces video rendering time by 40%” · “Maintains 99.9% API uptime” |
| **`origin_proof_url`** | Exact URL where the library found the information — instant source link for compliance | Partner docs / product page URL |
| **`temporal_anchor`** | `last_checked` (or equivalent) freshness stamp so creators know the claim is not stale | ISO date of last verify / crawl check |

**Ship rules:** Displayed citations still require master-plan Appendix C + Appendix B (`verified`, `sourceRights` ∈ {`consented`,`licensed`}, authorized `runId`, `crawlType:"partner"`). A citable block without re-verifiable proof is not ship-ready.

**Partner-mention gate (§P1):** When a named partner token appears in scanned body prose, the section needs ≥1 verified partner citation — this asset class is the preferred evidence shape.

---

## 3. The Advertisement asset (hooks & angles)

For short-form marketing materials, parse partner chunks into punchy text pairs optimized for click-through.

| Field | Meaning | Example |
|-------|---------|---------|
| **`marketing_hook`** | One-sentence, benefit-driven value proposition | “Stop manually writing cold emails” |
| **`pain_point_trigger`** | Matched frustration block tied to the tool’s core fix | “Tired of hit-or-miss AI generations?” |
| **`cta_wrapper`** | Actionable target text for banners, social, or newsletters | CTA / destination snippet from partner pages |

**Use:** Ads, social, email — still fail closed if required partner corpus is missing; do not fabricate hooks without library grounding when citeable Create is on. Pair with **Offer / CTA destinations** (§6.5) when a click must land on a real URL.

---

## 4. The Comparison asset (matrix vectors)

For “Versus” posts or side-by-side markdown tables, map features to **standardized vectors** so tools compare on identical terms.

| Field | Meaning | Example |
|-------|---------|---------|
| **`standardized_feature_id`** | Unified category tag | `pricing_model` · `api_access` · `seat_limits` |
| **`capability_payload`** | How this specific tool executes that feature | Tool A: “Native C# SDK” vs Tool B: “REST API only” |
| **`normalized_cost`** | Pricing broken into a shared metric | Cost per 1k words · per user · per video minute |

**Use:** Comparison / alternatives content types (Appendix A). Partner rows use `crawlType:"partner"`; rival rows use competitor corpus — never swap labels.

**Note:** Competitor-side comparison extraction (feature / pricing / comparison chunks) is defined in [competitor-extraction-complete.md](competitor-extraction-complete.md). This plan owns the **partner** matrix vectors used when the tool is what we sell. Prefer **Pricing catalog** (§6.1) when building full pricing pages — `normalized_cost` alone is too thin.

---

## 5. The Alternatives asset (deficit router)

For “Top Alternatives to [X]” or “Why you should switch” content, pull the exact pain of a tool and route to better options **in the partner / tool library**.

| Field | Meaning | Example |
|-------|---------|---------|
| **`trigger_deficit`** | Specific limitation, missing feature, or high pricing gate from docs or reviews | Seat pricing too restrictive; no team collab |
| **`recommended_swap`** | List of alternative tools in the database that solve that deficit | Partner tools that close the gap |
| **`pivot_copy`** | Pre-structured transitional sentence | “If you need team collaboration but find Tool X’s pricing tier too restrictive, Tool Y offers flat-rate seats…” |

**Honesty:** When the deficit source is a **competitor**, extract deficits from competitor corpus ([competitor-extraction-complete.md](competitor-extraction-complete.md)) and route `recommended_swap` to **partners** (tools we sell). Never cite a competitor as `crawlType:"partner"`. Never invent a swap without library-backed capability. Use **Disqualifiers** (§6.6) and **ICP** (§6.2) so swaps stay fit-honest.

---

## 6. Minimum expand payloads

These six assets are the **next required extraction set** so ads, alternatives, comparisons, and pricing pages are not stuck on excerpt-only grounding.

### 6.1 Pricing catalog

| Field | Meaning | Example |
|-------|---------|---------|
| **`tier_name`** | Named plan / SKU | Starter · Pro · Enterprise |
| **`list_price`** | Numeric price when stated | `19.00` |
| **`price_currency`** | ISO currency | `USD` |
| **`billing_period`** | Cadence | monthly · annual · usage |
| **`feature_gates`** | What the tier unlocks / locks | “API access on Pro+” |
| **`free_or_trial`** | Free tier / trial terms when stated | 14-day trial · freemium |
| **`overage_terms`** | Usage overages when stated | `$0.02` / 1k words |
| **`price_effective_date`** | “As of” / page-stated effective date | ISO date or on-page phrase |
| **`origin_proof_url`** | Pricing page URL | Partner `/pricing` |

**Fail closed:** No list price or unit price in ship-ready schema/copy without re-verifiable partner evidence.

### 6.2 ICP / buyer fit

| Field | Meaning | Example |
|-------|---------|---------|
| **`served_segments`** | Who the product claims to serve | Mid-market finance teams |
| **`excluded_segments`** | Explicit “not for” when stated | Not for consumer freelancers |
| **`company_size_band`** | Stated size band | 50–500 employees |
| **`industries`** | Named verticals | Accounting · SaaS |
| **`buyer_roles`** | Personas / titles | Controller · RevOps |

### 6.3 Integrations & ecosystem

| Field | Meaning | Example |
|-------|---------|---------|
| **`integration_name`** | Named integration | QuickBooks · Salesforce |
| **`integration_type`** | Category | native · Zapier · API |
| **`api_or_sdk`** | Public API / SDK claims | REST · C# SDK |
| **`marketplace_presence`** | App marketplace listing when stated | Salesforce AppExchange |

### 6.4 Objection / FAQ bank

| Field | Meaning | Example |
|-------|---------|---------|
| **`question`** | FAQ or objection as stated / normalized | “Do you support SSO?” |
| **`verified_answer`** | Answer text grounded in partner page | “SAML SSO on Enterprise” |
| **`origin_proof_url`** | Source FAQ / docs URL | `/docs/security` |

### 6.5 Offer / CTA destinations

| Field | Meaning | Example |
|-------|---------|---------|
| **`cta_label`** | Button / link text | “Start free trial” |
| **`destination_url`** | Absolute URL the CTA resolves to | `https://partner.example/trial` |
| **`offer_type`** | Class of offer | trial · demo · purchase · affiliate |
| **`cta_wrapper`** | Optional short marketing wrapper | Ties to Advertisement asset |

### 6.6 Disqualifiers / limits

| Field | Meaning | Example |
|-------|---------|---------|
| **`limit_type`** | Kind of constraint | seats · region · language · feature |
| **`limit_detail`** | Stated constraint | Max 5 seats on Starter; US-only |
| **`origin_proof_url`** | Source URL | Pricing / limits docs |

---

## 7. Extended catalog payloads

Ship after §6. Same provenance rules as core assets.

### 7.1 Use-case playbooks

| Field | Meaning |
|-------|---------|
| **`job_to_be_done`** | Named use case / JTBD |
| **`cited_steps_or_features`** | Ordered capabilities with proof URLs |
| **`primary_cta`** | Optional link to Offer / CTA destinations |

### 7.2 Category / taxonomy

| Field | Meaning |
|-------|---------|
| **`primary_category`** | Canonical category id / label |
| **`synonyms`** | Alternate labels for SEO / matching |
| **`vs_category_label`** | How the partner frames “vs category” |

### 7.3 Freshness / change log

| Field | Meaning |
|-------|---------|
| **`change_kind`** | price · feature · policy |
| **`change_summary`** | On-page stated change |
| **`stated_as_of`** | Date or phrase from the page |
| **`origin_proof_url`** | Source URL |

### 7.4 Battlecard slice (partner-only)

| Field | Meaning |
|-------|---------|
| **`win_theme`** | When we win with this partner tool |
| **`landmine`** | Known gap / objection (from partner docs — not rival invent) |
| **`coaching_line`** | Short enablement sentence |

Rival “why they lose” material stays on [competitor-extraction-complete.md](competitor-extraction-complete.md).

### 7.5 Demo / product tour beats

| Field | Meaning |
|-------|---------|
| **`beat_title`** | Short slide / frame title |
| **`beat_claim`** | One verifiable feature beat |
| **`section_anchor`** | Heading / section on partner page |
| **`origin_proof_url`** | Source URL |

### 7.6 Compliance & terms snippets

| Field | Meaning |
|-------|---------|
| **`term_kind`** | refund · data_residency · sla · security |
| **`term_text`** | Exact or tightly paraphrased on-page text |
| **`origin_proof_url`** | Source URL |

Only extract when **explicit** on-page — never infer.

### 7.7 Affiliate disclosure hooks

| Field | Meaning |
|-------|---------|
| **`disclosure_text`** | Required legal / affiliate line |
| **`jurisdiction_or_policy`** | Policy id / market if stated |
| **`origin_proof_url`** | Partner or operator policy source |

Policy text only — not marketing invent.

---

## 8. Payload summary (implementation checklist)

| Priority | Asset | Required fields | Primary Create outputs |
|----------|-------|-----------------|------------------------|
| Core | **Citable** | `isolated_claim` · `origin_proof_url` · `temporal_anchor` | Blog / pillar / Canvas cites; partner-mention evidence |
| Core | **Advertisement** | `marketing_hook` · `pain_point_trigger` · `cta_wrapper` | Ads, social, email snippets |
| Core | **Comparison** | `standardized_feature_id` · `capability_payload` · `normalized_cost` | Versus tables, comparison pages |
| Core | **Alternatives** | `trigger_deficit` · `recommended_swap` · `pivot_copy` | Alternatives / switch / battlecard routing |
| Min expand | **Pricing catalog** | tier · list price · currency · period · gates · trial · overages · effective date · proof URL | Pricing pages, offers, schema |
| Min expand | **ICP / buyer fit** | served / excluded segments · size · industries · roles | Targeting, alternatives fit copy |
| Min expand | **Integrations & ecosystem** | name · type · API/SDK · marketplace | Comparison rows, BOFU |
| Min expand | **Objection / FAQ bank** | question · verified answer · proof URL | Objection ads, FAQ, GEO |
| Min expand | **Proof pack** | proof kind · claim · proof URL | Trust blocks, case metrics |
| Min expand | **Offer / CTA destinations** | label · destination URL · offer type | Affiliate routing, conversion |
| Min expand | **Disqualifiers** | limit type · detail · proof URL | Honest alternatives / reviews |
| Extended | **Use-case playbooks** | JTBD · cited steps · optional CTA | Listicles, tool pages |
| Extended | **Category / taxonomy** | primary · synonyms · vs-category | Programmatic SEO |
| Extended | **Freshness / change log** | kind · summary · as-of · proof URL | “As of” claims |
| Extended | **Battlecard slice** | win theme · landmine · coaching line | Sales enablement |
| Extended | **Demo / tour beats** | title · claim · anchor · proof URL | Carousels, LinkedIn docs |
| Extended | **Compliance & terms** | kind · text · proof URL | Footnotes, trust |
| Extended | **Affiliate disclosure** | disclosure text · policy · proof URL | Redistributed offers |

**Proof pack** field detail (minimum expand):

| Field | Meaning | Example |
|-------|---------|---------|
| **`proof_kind`** | logo · case_metric · certification · award | `certification` |
| **`proof_claim`** | Stated proof text / metric | “SOC 2 Type II” · “40% faster close” |
| **`origin_proof_url`** | Page that states the proof | `/customers` · `/security` |

All payloads carry standard citation / provenance fields where claims are shown (Appendix C): URL · `pageId` · quote/offsets · `sourceDigest` · authorized `runId` · `sectionKey` · `crawlType:"partner"` · `sourceRights` · provenance.

---

## 9. SoftwareApplication JSON-LD output

Partner / AI tool pages that Create (or Schema Markup / publish surfaces) emit for tools we sell use official [schema.org/SoftwareApplication](https://schema.org/SoftwareApplication). The node is **parsed from partner library payloads** (core + Pricing catalog + related)—not invented when required evidence is missing.

### Field mapping (library → JSON-LD)

| JSON-LD property | Source payload(s) | Notes |
|------------------|-------------------|--------|
| `name` | Partner identity / tool name from partner corpus | Exact product name we sell |
| `applicationCategory` | **Category / taxonomy** (fallback: catalog) | e.g. `BusinessApplication` |
| `operatingSystem` | Capability / platform claims | Prefer library-backed; e.g. cloud / web |
| `description` | **Advertisement** `marketing_hook` (or equivalent USP text) | Benefit-driven; grounded |
| `offers.price` / `priceCurrency` | **Pricing catalog** (preferred) or Comparison pricing | Top-level offer when a list price exists |
| `offers.priceSpecification` | **Pricing catalog** overages / unit price or Comparison `normalized_cost` | Unit price (per 1k words, per seat, etc.) |
| `offers.url` | **Offer / CTA destinations** `destination_url` | When a concrete offer URL exists |
| `review.reviewBody` | **Citable** + **Disqualifiers** / **Alternatives** honest gaps | Strengths and known limits—no fabricated praise |
| `review.author` | Pipeline / org attribution when audit-authored | Not a fake customer; label the source honestly |

**Fail closed:** Do not emit ship-ready SoftwareApplication JSON-LD that asserts price, metrics, or reviews without re-verifiable partner (and, where deficits are cited, competitor) library evidence and Appendix B `sourceRights`. Soft/empty library ≠ success-shaped schema.

### Canonical example (fully populated)

Parsed from partner RAG / library data payloads, official format renders cleanly like this:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Partner AI Writer Pro",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "All Cloud Platforms",
  "description": "Stop wasting hours on manual token counting—auto-generate ad hooks in seconds.",
  "offers": {
    "@type": "Offer",
    "price": "19.00",
    "priceCurrency": "USD",
    "url": "https://partner.example/trial",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "description": "Per 1,000 words generated",
      "price": "0.02"
    }
  },
  "review": {
    "@type": "Review",
    "reviewBody": "Excellent for bulk operations, though it currently lacks a native C# SDK.",
    "author": {
      "@type": "Organization",
      "name": "Master RAG Pipeline Audit"
    }
  }
}
```

**Competitors:** Rival structured payloads also use `SoftwareApplication` — see [competitor-extraction-complete.md](competitor-extraction-complete.md) §6 (`url`, critical `reviewBody`, `itemReviewed`, ratings). Do **not** emit a rival node as a partner product or with `crawlType:"partner"`. Join partner + competitor graphs in Versus / Alternatives; keep crawl types honest.

---

## 10. Product binding & fail-closed rules

Inherited from [master-plan.md](master-plan.md) — do not weaken here.

| Rule | Behavior |
|------|----------|
| **Partner crawl run(s)** (`partnerSourceRunIds` / legacy singular) | **Every Create** — fail closed if missing or unusable |
| **UI** | Create → Research: **Partner tool URLs (required)** — first-class |
| **Tools = partners** | Only partner corpus uses `crawlType:"partner"` |
| **Project-site** | Never substitutes for partner evidence |
| **Caps** | Product direction: Partner and Competitor **caps are removed** (no soft-limit as a success path) |
| **SoftDisabled / empty library** | Not a citeable Create success path |
| **No seed-HTML fallback** | External partner resolve is library-only — see [remove-partner-seed-html-fallback-complete.md](remove-partner-seed-html-fallback-complete.md) |
| **Excerpt-only ≠ extraction done** | Quoteable paragraphs do not satisfy §2–§8 payloads |
| **SoftwareApplication JSON-LD** | Partners only as **sellable** product schema (§9); rival nodes use competitor-analysis §6 |

---

## 11. Relationship to Competitor Analysis

| Concern | Plan |
|---------|------|
| What to obtain / extract from rivals + competitor JSON-LD | [competitor-extraction-complete.md](competitor-extraction-complete.md) |
| What to **extract** from partners (tools we sell) + partner JSON-LD | **This file** |
| Both runs always bound on Create | master-plan Create evidence policy |

Comparison and Alternatives products often **join** both corpora: competitor deficits + partner swaps; partner capability vectors + competitor counterpart vectors. Labels and `crawlType` must stay honest.

---

## Sync

When this extraction plan’s payloads, JSON-LD contract, or hard rules change:

1. Update the pointer in [master-plan.md](master-plan.md) (Partner extraction).  
2. Update [architecture.md](../architecture.md) Partner row / pointer.  
3. Update [plans/README.md](README.md) index.  
4. Update `.cursor/rules/geek-crawler-rag.mdc` if agent guidance changes.

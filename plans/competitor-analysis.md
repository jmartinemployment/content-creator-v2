# Competitor Analysis plan

**Updated:** 2026-09-14  
**Accountable owner:** Jeff Martin  
**Release authority:** [master-plan.md](master-plan.md) (sole release-plan & decision record)  
**Platform contracts:** [architecture.md](../architecture.md)  
**Sibling plan:** [partner-extraction.md](partner-extraction.md)

This file is the **authoritative Competitor Analysis plan**: why competitors matter, what Create must obtain, **structured extraction payloads**, library chunking, and competitor **SoftwareApplication** JSON-LD. Evidence binding (fail closed) remains locked in master-plan **Create evidence policy** + Appendix A.

**Implementation note:** Today Create research merge often materializes quoteable page excerpts only. This plan defines the **structured payloads to extract** from `crawlType:"competitor"` — excerpt-only resolve does **not** fulfill them.

---

## Status

| | |
|--|--|
| **Policy** | Locked 2026-09-14 — competitor crawl required on every Create |
| **Surfaces** | Create → Research **Competitor page URLs (required)** · Geek-Crawler competitor runs · Geek-Crawler-Rag library query |
| **Writer** | GeekAPI `gcc-create-library.v1` retrieves competitor chunks via `/v1/query` + Markdown verify — **not** RAG `/v1/generate` |
| **Hard rules** | Always required · fail closed · never `crawlType:"partner"` · tools = partners only |
| **Expansion** | §5–§7 named payloads (min expand + competitor-specific + extended) locked as product direction 2026-09-14 |

---

## 1. Why competitor analysis

Using competitors in content creation—both by **analyzing** them and **explicitly mentioning** them—is a powerful strategy to accelerate growth, build trust, and capture high-intent buyers. Instead of guessing what works, leveraging competitors allows Create to build data-driven content from existing market performance. ([Tenspeed — strategic importance of competitor comparison content](https://www.tenspeed.io/blog/strategic-importance-of-competitor-comparison-content))

Create’s competitor crawl corpus exists so PLAN / WRITE / VALIDATE (and affiliates using the same library) can ground the following **intentionally** — not as optional enrichment.

### Strategy goals

| # | Goal | Why content creators focus here | What Create should obtain / use |
|---|------|----------------------------------|----------------------------------|
| **1** | **Content gaps** | Analyzing competitors’ libraries surfaces untapped topics; covering what they missed or treated thinly captures demand they leave on the table. ([SmartSites](https://www.smartsites.com/blog/the-powerful-benefits-of-competitor-analysis-in-your-content-marketing-plan/), [Tenspeed](https://www.tenspeed.io/blog/strategic-importance-of-competitor-comparison-content)) | Topics, angles, FAQs, and depth rivals skip; pain points answered more completely than rival pages |
| **2** | **High-intent / BOFU traffic** | Buyers comparing brands are near purchase. Comparison content lets you control the narrative and conversion path instead of third parties or the rival. ([CMI](https://contentmarketinginstitute.com/demand-generation/how-competitor-analysis-helps-you-create-landing-pages-that-convert), [Tenspeed](https://www.tenspeed.io/blog/strategic-importance-of-competitor-comparison-content), [Pepper](https://www.pepper.inc/blog/5-ways-your-competitors-can-help-you-build-your-content-strategy/)) | Comparison frames, feature/positioning contrasts, USPs vs named alternatives, clear CTAs |
| **3** | **Trust through honesty** | Savvy audiences already know alternatives exist. Naming competitors and giving a fair strength/weakness breakdown builds credibility. ([Search Engine Journal](https://www.searchenginejournal.com/5-reasons-ok-mention-competitors-content/133048/)) | Balanced mention plan; no hiding rivals; no invented soft comparisons |
| **4** | **De-risk SEO / content bets** | Evaluating keywords, ad themes, and formats already working for rivals removes guesswork. ([Nielsen](https://www.nielsen.com/insights/2024/need-to-know-what-can-you-learn-from-your-competitors-ads/), [Tenspeed](https://www.tenspeed.io/blog/strategic-importance-of-competitor-comparison-content)) | Keywords, themes, formats, structures worth mirroring or beating |

---

## 2. Direct vs content competitors

When operators bind **Competitor page URLs**, Create must treat **both** classes as in-scope (a URL may be either):

| Competitor type | Definition | Example | Why content strategy matters |
|-----------------|------------|---------|------------------------------|
| **Direct** | Companies that sell the same type of product or service | Asana vs Monday.com | Comparison / alternatives pages to win buyers choosing between the two |
| **Content** | Entities that don’t sell your product but compete for the same audience’s attention in search | Asana vs Forbes Advisor (productivity) | Analyze SEO authority and coverage to rank for broad industry terms |

**Rule:** PLAN must not treat a **content** rival as a product substitute. Label type (`direct` / `content` / `both`) as a first-class extract field on every rival entity (§6.4).

---

## 3. Obtain brief (operator + system)

From bound competitor URLs / `competitorSourceRunIds` (legacy singular `competitorSourceRunId`), research planning and drafting must be able to surface (citeably where claims appear):

1. **Gap map** — topics, sections, FAQs, and depth competitors skip or treat thinly vs brief intent.  
2. **Comparison axes** — features, pricing posture, ICP, integrations, proof points used in rival pages.  
3. **Narrative control inputs** — how rivals frame “us vs them”; openings for honest counter-positioning.  
4. **Trust-safe mention plan** — when/how to name competitors without false claims; balanced strength/weakness language.  
5. **Demand signals** — keywords, content formats, ad/copy themes, and structures worth mirroring or beating.  
6. **Type label** — direct vs content competitor (or both).

---

## 4. Extraction contract

**Goal:** Turn unstructured competitor content into **structured, queryable** payloads the AI stack uses for briefs, comparison tables, alternatives routing, ads strategy, and scripts.

**Contract:** Extraction + indexing + `/v1/query` + Markdown verify = **library**. Create drafting = GeekAPI `CreateLibraryDraft` / `gcc-create-library.v1`. Do **not** use RAG `/v1/generate` or `rag-generate.*` for Create.

**Forbidden:** labeling competitor payloads or chunks as `crawlType:"partner"`. Partner sell CTAs / affiliate destinations for tools we sell live only in [partner-extraction.md](partner-extraction.md).

All claim-bearing payloads carry master-plan **Appendix C** citation fields: URL · `pageId` · quote/offsets · `sourceDigest` · authorized `runId` · `sectionKey` · `crawlType:"competitor"` · `sourceRights` · provenance.

---

## 5. Minimum expand payloads (mirror partner, rival-labeled)

These seven assets are the **next required extraction set** so ads, alternatives, comparisons, and pricing pages are not stuck on excerpt-only grounding. Field shapes align with partner-extraction minimum expand where possible — always `crawlType:"competitor"`.

### 5.1 Competitor pricing catalog

| Field | Meaning | Example |
|-------|---------|---------|
| **`tier_name`** | Named plan / SKU | Enterprise · Team |
| **`list_price`** | Numeric price when stated | `99.00` |
| **`price_currency`** | ISO currency | `USD` |
| **`billing_period`** | Cadence | monthly · annual · usage |
| **`feature_gates`** | What the tier unlocks / locks | “SSO on Enterprise only” |
| **`free_or_trial`** | Free tier / trial when stated | No free tier · 14-day trial |
| **`overage_terms`** | Usage overages / hidden limits when stated | Prompt caps · overage fees |
| **`price_effective_date`** | “As of” / page-stated effective date | ISO date or on-page phrase |
| **`origin_proof_url`** | Pricing page URL | Rival `/pricing` |

**Fail closed:** No rival price in ship-ready compare/schema without re-verifiable competitor evidence.

### 5.2 Competitor ICP / buyer fit

| Field | Meaning | Example |
|-------|---------|---------|
| **`served_segments`** | Who they claim to serve | Enterprise marketing orgs |
| **`excluded_segments`** | Explicit “not for” when stated | Not for solopreneurs |
| **`company_size_band`** | Stated size band | 500+ employees |
| **`industries`** | Named verticals | Fintech · Healthcare |
| **`buyer_roles`** | Personas / titles | CMO · Demand gen |

### 5.3 Competitor integrations & ecosystem

| Field | Meaning | Example |
|-------|---------|---------|
| **`integration_name`** | Named integration | HubSpot · Slack |
| **`integration_type`** | Category | native · Zapier · API |
| **`api_or_sdk`** | Public API / SDK claims | REST only · no C# SDK |
| **`marketplace_presence`** | App marketplace when stated | Salesforce AppExchange |

### 5.4 Competitor FAQ / objection bank

| Field | Meaning | Example |
|-------|---------|---------|
| **`question`** | FAQ or objection as stated / normalized | “Do you have a free plan?” |
| **`verified_answer`** | Their answer grounded on-page | “No free plan; 14-day trial only” |
| **`origin_proof_url`** | Source FAQ / docs URL | `/faq` |

### 5.5 Competitor proof pack

| Field | Meaning | Example |
|-------|---------|---------|
| **`proof_kind`** | logo · case_metric · certification · award · quote | `case_metric` |
| **`proof_claim`** | Stated proof text / metric | “10k customers” · G2 badge |
| **`origin_proof_url`** | Page that states the proof | `/customers` |

### 5.6 Competitor CTA / conversion destinations

| Field | Meaning | Example |
|-------|---------|---------|
| **`cta_label`** | Button / link text on rival pages | “Book a demo” |
| **`destination_url`** | Absolute URL they send buyers to | `https://rival.example/demo` |
| **`offer_type`** | Class of offer | demo · trial · contact · pricing |

**Use:** Narrative control and funnel analysis — **not** affiliate selling of the rival.

### 5.7 Competitor disqualifiers / limits

| Field | Meaning | Example |
|-------|---------|---------|
| **`limit_type`** | Kind of constraint | seats · region · language · feature · pricing_gate |
| **`limit_detail`** | Stated constraint | Enterprise-only SSO; US-only support |
| **`origin_proof_url`** | Source URL | Pricing / limits docs |

Primary fuel for Alternatives `trigger_deficit` when joining to partner swaps.

---

## 6. Competitor-specific payloads (not on partner plan)

These assets are unique to rival analysis and must stay on this plan.

### 6.1 Gap map asset

| Field | Meaning | Example |
|-------|---------|---------|
| **`gap_topic`** | Topic / FAQ / angle they skip or treat thinly | “Implementation timeline” |
| **`depth_assessment`** | missing · thin · outdated | `thin` |
| **`brief_intent_link`** | How it maps to our Create brief | Our pillar covers X |
| **`rival_url`** | Page reviewed (or null if site-wide gap) | Rival blog URL |
| **`opportunity_for_us`** | What we should cover instead | Full implementation guide |

### 6.2 Mention / framing bank

| Field | Meaning | Example |
|-------|---------|---------|
| **`framed_rival_name`** | Who they name (us or third party) | “Unlike Tool Z…” |
| **`frame_type`** | us_vs_them · category_dismissal · feature_attack | `us_vs_them` |
| **`frame_excerpt`** | Verifiable quote / paraphrase | On-page framing sentence |
| **`sentiment`** | negative · neutral · dismissive | `dismissive` |
| **`origin_proof_url`** | Source URL | Comparison / homepage |

**Use:** Trust-safe counter-positioning; never invent attacks they did not make.

### 6.3 Demand / format signals

| Field | Meaning | Example |
|-------|---------|---------|
| **`primary_keyword_focus`** | Title / H1 / slug targets | “best AP automation” |
| **`content_format`** | blog · landing · docs · video_transcript · other | `landing` |
| **`content_hierarchy`** | Exact H2 / H3 structure | Outline skeleton |
| **`search_intent_category`** | Informational · Transactional · Navigational · Commercial Investigation | Commercial Investigation |
| **`ad_or_copy_theme`** | Recurring promise / offer theme | “Replace spreadsheets” |
| **`structure_worth_beating`** | Pattern to mirror or out-depth | FAQ + comparison table |

### 6.4 Direct vs content type label

| Field | Meaning | Example |
|-------|---------|---------|
| **`competitor_type`** | `direct` · `content` · `both` | `direct` |
| **`type_rationale`** | Short library-backed reason | Sells same category product |
| **`entity_name`** | Rival brand / property | Rival Co |
| **`primary_url`** | Bound competitor URL | `https://rival.example` |

### 6.5 Switch-trigger / deficit router (competitor side)

| Field | Meaning | Example |
|-------|---------|---------|
| **`trigger_deficit`** | Specific rival limitation with proof | No native C# SDK |
| **`origin_proof_url`** | Source of the deficit | Docs / changelog / pricing |
| **`recommended_swap`** | **Partner** tool id(s) only — join to partner library | Partner Y |
| **`pivot_copy`** | Optional transitional sentence | “If you need a C# SDK…” |

**Honesty:** `recommended_swap` must resolve to [partner-extraction.md](partner-extraction.md) tools (`crawlType:"partner"`). Never label the deficit source as partner.

### 6.6 Comparison axis pack (as the rival presents them)

| Field | Meaning | Example |
|-------|---------|---------|
| **`standardized_feature_id`** | Shared axis id (align with partner Comparison) | `api_access` · `pricing_model` |
| **`rival_capability_payload`** | How **they** claim to execute the axis | “REST API only” |
| **`rival_normalized_cost`** | Their unit economics when stated | `$0.15` / 1k prompts |
| **`origin_proof_url`** | Source URL | Feature / pricing page |

### 6.7 Claim risk flags

| Field | Meaning | Example |
|-------|---------|---------|
| **`claim_text`** | Rival claim | “#1 in the market” |
| **`risk_kind`** | unverifiable · dated · superlative · absolute | `superlative` |
| **`stated_as_of`** | Date if present | `2022` |
| **`origin_proof_url`** | Source URL | Homepage |
| **`write_guidance`** | Do not echo as fact · attribute · ignore | `do_not_echo_as_fact` |

Prevents WRITE from laundering rival marketing as verified truth.

---

## 7. Extended catalog (ads / battlecards / SEO)

Ship after §5–§6.

### 7.1 Ad creative themes

| Field | Meaning |
|-------|---------|
| **`headline_pattern`** | Recurring rival headline shape |
| **`offer_promise`** | Core offer / benefit in ads or hero |
| **`landing_promise`** | What the landing claims |
| **`origin_proof_url`** | Source URL |

### 7.2 Content outline clones

| Field | Meaning |
|-------|---------|
| **`outline_skeleton`** | Ordered H2/H3 template from a high-performing page |
| **`source_url`** | Page cloned structurally |
| **`intent_category`** | Search intent for that page |

### 7.3 Authority / SERP posture (content competitors)

| Field | Meaning |
|-------|---------|
| **`coverage_topic`** | Broad industry topic they own |
| **`authority_signal`** | Stated credentials / publication posture |
| **`opportunity_for_us`** | Angle direct product pages under-serve |

Do **not** treat these entities as product substitutes (§2).

### 7.4 Changelog / regression beats

| Field | Meaning |
|-------|---------|
| **`change_kind`** | price_hike · feature_removed · policy · other |
| **`change_summary`** | On-page stated change |
| **`stated_as_of`** | Date or phrase |
| **`origin_proof_url`** | Changelog / pricing / blog |

Strong Alternatives fuel when library-backed.

### 7.5 Legal / compliance posture

| Field | Meaning |
|-------|---------|
| **`term_kind`** | privacy · sla · security · residency · other |
| **`term_text`** | Exact or tightly paraphrased on-page text |
| **`origin_proof_url`** | Source URL |

Only when **explicit** on-page — never infer.

### 7.6 Legacy strategic extracts (still required)

Retain and map into the payloads above (do not drop):

| Legacy §4 cluster | Maps primarily to |
|-------------------|-------------------|
| Core value proposition / USP | Demand signals · framing · JSON-LD `description` |
| Key use cases | Comparison axis · gap map · demand signals |
| Social proof & claims | Proof pack · claim risk flags |
| Unique angles / concept names | Demand signals · framing bank |
| Product gaps & criticisms | Disqualifiers · deficit router · changelog |
| Publish / last-updated · format · author | Demand signals · claim risk · chunk metadata |

---

## 8. Payload summary (implementation checklist)

| Priority | Asset | Primary Create outputs |
|----------|-------|------------------------|
| Min expand | **Pricing catalog** | Versus pricing rows, rival schema offers |
| Min expand | **ICP / buyer fit** | Fair compare audience rows |
| Min expand | **Integrations & ecosystem** | BOFU feature matrices |
| Min expand | **FAQ / objection bank** | Fair Q&A · “they claim” blocks |
| Min expand | **Proof pack** | Trust-safe rival proof citations |
| Min expand | **CTA / conversion destinations** | Funnel / narrative control |
| Min expand | **Disqualifiers** | Alternatives deficits |
| Competitor-specific | **Gap map** | Content gap plans · pillar opportunities |
| Competitor-specific | **Mention / framing bank** | Counter-positioning · honest mention |
| Competitor-specific | **Demand / format signals** | SEO / format bets |
| Competitor-specific | **Type label** | Direct vs content routing |
| Competitor-specific | **Deficit router** | Alternatives join → partners |
| Competitor-specific | **Comparison axis pack** | Versus tables (rival side) |
| Competitor-specific | **Claim risk flags** | VALIDATE / WRITE honesty |
| Extended | **Ad creative themes** | Ad strategy briefs |
| Extended | **Outline clones** | Structure templates |
| Extended | **SERP posture** | Content-competitor SEO |
| Extended | **Changelog / regression** | Switch / alternatives beats |
| Extended | **Compliance posture** | Fair compare footnotes |

---

## 9. Chunking strategy (vector library)

RAG **retrieval** performance depends on how competitor data is split. Prefer **semantic sections** over strict character counts.

| Chunk type | Extraction strategy | Ideal metadata to attach |
|------------|---------------------|--------------------------|
| **Feature** | Specific H2/H3 blocks explaining a feature or benefit | `competitor_name`, `feature_tag`, `url`, axis ids |
| **Pricing** | Pricing tables or packages text | `competitor_name`, `last_updated`, `currency`, tier |
| **Comparison** | Sections where they mention other tools | `competitor_name`, `target_competitor`, `sentiment`, frame_type |
| **Gap / FAQ** | Thin or missing topic markers; FAQ pairs | `competitor_name`, `gap_topic` / `question` |
| **Proof** | Case / badge / metric blocks | `competitor_name`, `proof_kind` |

All competitor chunks also carry Appendix C citation fields and `crawlType:"competitor"`.

**Forbidden:** labeling competitor chunks as `crawlType:"partner"`.

---

## 10. Competitor SoftwareApplication JSON-LD

A structured **Competitor** payload extracted from the master library / RAG database uses official [schema.org/SoftwareApplication](https://schema.org/SoftwareApplication)—same type as partners, **different ownership**: always bound to `crawlType:"competitor"` and never presented as a product we sell.

### Field mapping (library → JSON-LD)

| JSON-LD property | Source (competitor extract / chunks) | Notes |
|------------------|--------------------------------------|--------|
| `name` | Competitor product / brand name | Exact rival name |
| `applicationCategory` | Taxonomy / demand signals | e.g. `BusinessApplication` |
| `operatingSystem` | Platform claims on rival pages | e.g. Web Browser |
| `url` | Competitor page / homepage URL | Prefer bound competitor URL |
| `description` | Position / ICP framing · demand signals | Honest rival positioning |
| `offers.price` / `priceCurrency` | **Pricing catalog** | List / base tier when known |
| `offers.priceSpecification` | **Pricing catalog** unit economics | Include caveats when library-backed |
| `offers.url` | **CTA destinations** when a clear offer URL exists | Rival funnel URL — not our affiliate offer |
| `review.reviewBody` | Disqualifiers · deficit router · claim-safe gaps | May lead with **CRITICAL DISADVANTAGE** only when deficit-backed |
| `review.itemReviewed` | Same competitor `SoftwareApplication` | Self-reference for Review graph |
| `review.reviewRating` | Optional audit rating when pipeline assigns one | `ratingValue` / `bestRating` — never invent |
| `review.author` | Pipeline / org attribution | e.g. Master RAG Pipeline Audit — not a fake customer |

**Fail closed:** Do not invent competitor prices, latency claims, or SDK gaps without library-backed evidence. Never emit this node with `crawlType:"partner"` or as if it were our sellable SKU. Do not echo claim-risk superlatives as verified facts.

### Canonical example (fully populated)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Competitor Legacy Writer",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web Browser",
  "url": "https://competitor-example.com",
  "description": "Expensive, complex marketing suite built for enterprise budgets and large teams.",
  "offers": {
    "@type": "Offer",
    "price": "99.00",
    "priceCurrency": "USD",
    "url": "https://competitor-example.com/demo",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "description": "Base pricing tier with hidden prompt limits",
      "price": "0.15"
    }
  },
  "review": {
    "@type": "Review",
    "reviewBody": "CRITICAL DISADVANTAGE: Suffers from high API latency and completely lacks a native C# SDK.",
    "itemReviewed": {
      "@type": "SoftwareApplication",
      "name": "Competitor Legacy Writer"
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": "2.5",
      "bestRating": "5"
    },
    "author": {
      "@type": "Organization",
      "name": "Master RAG Pipeline Audit"
    }
  }
}
```

**Vs partner JSON-LD:** Partner extraction shape and mapping live in [partner-extraction.md](partner-extraction.md) §9. Competitor nodes add `url`, `itemReviewed`, and often critical `reviewBody` / ratings for Alternatives and Versus content. Join graphs in Create—do not merge crawl types.

---

## 11. Product binding & fail-closed rules

Inherited from [master-plan.md](master-plan.md) — do not weaken here.

| Rule | Behavior |
|------|----------|
| **Competitor crawl run(s)** (`competitorSourceRunIds` / legacy singular) | **Every Create** — fail closed if missing or unusable |
| **UI** | Create → Research: **Competitor page URLs (required)** — first-class, not buried |
| **Partner vs competitor** | Tools = partners only; competitors never as partner |
| **Project-site** | Never substitutes for competitor (or partner) evidence |
| **Caps** | Product direction: Partner and Competitor **caps are removed** (no soft-limit as a success path) |
| **No seed-HTML fallback** | External competitor resolve is library-only — see [remove-partner-seed-html-fallback.md](remove-partner-seed-html-fallback.md) |
| **Excerpt-only ≠ extraction done** | Quoteable paragraphs do not satisfy §5–§7 payloads |
| **Content rivals ≠ product substitutes** | Type label required; PLAN must not swap |
| **Deficit → swap join** | Competitor deficit + **partner** recommended_swap only |
| **Competitor JSON-LD** | `SoftwareApplication` for rivals only as analysis payload (§10); never as partner product schema |

---

## 12. Downstream uses

Structured competitor library data supports:

- Research plans and outlines (PLAN)  
- Comparison / alternatives / battlecard long-form  
- Comparison tables and USP callouts  
- Gap-driven pillar / FAQ content  
- Ad strategy briefs (themes — not rival affiliate selling)  
- Affiliate and operator briefs grounded on citeable rival pages  
- VALIDATE quote re-verify against current corpus  
- Competitor `SoftwareApplication` JSON-LD for Versus / Alternatives structure  

Ship-ready still requires master-plan **Appendix B** (including `sourceRights` and partner-mention gate where applicable).

---

## 13. Relationship to Partner extraction

| Concern | Plan |
|---------|------|
| What to obtain from rivals; competitor extract + chunk types + competitor JSON-LD | **This file** |
| What to **extract** from partners (tools we sell) + partner JSON-LD | [partner-extraction.md](partner-extraction.md) |
| Both runs always bound on Create | master-plan Create evidence policy |

Comparison and Alternatives products often **join** both corpora: competitor deficits + partner swaps; partner capability vectors + competitor counterpart vectors. Labels and `crawlType` must stay honest.

---

## 14. References

1. [Tenspeed — Strategic importance of competitor comparison content](https://www.tenspeed.io/blog/strategic-importance-of-competitor-comparison-content)  
2. [SmartSites — Competitor analysis in content marketing](https://www.smartsites.com/blog/the-powerful-benefits-of-competitor-analysis-in-your-content-marketing-plan/)  
3. [Content Marketing Institute — Competitor analysis for landing pages](https://contentmarketinginstitute.com/demand-generation/how-competitor-analysis-helps-you-create-landing-pages-that-convert)  
4. [Pepper — Competitors in content strategy](https://www.pepper.inc/blog/5-ways-your-competitors-can-help-you-build-your-content-strategy/)  
5. [Search Engine Journal — Reasons to mention competitors](https://www.searchenginejournal.com/5-reasons-ok-mention-competitors-content/133048/)  
6. [Nielsen — Learn from competitors’ ads](https://www.nielsen.com/insights/2024/need-to-know-what-can-you-learn-from-your-competitors-ads/)  

---

## Sync

When this plan’s hard rules, extract/chunk contracts, or competitor JSON-LD change:

1. Update the pointer in [master-plan.md](master-plan.md) **Competitor intelligence**.  
2. Update [architecture.md](../architecture.md) Competitor row / pointer.  
3. Update [plans/README.md](README.md) index.  
4. Update `.cursor/rules/geek-crawler-rag.mdc` competitor library line if agent guidance changes.

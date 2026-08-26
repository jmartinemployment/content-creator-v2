# Competitor site crawl — what they take and how they use it

Research note for Content Creator v2. Sources: product docs / help / marketing pages, 2026. Not reverse-engineering crawlers — what they **document and productize**.

**Your bar:** grounding over expediency. If we cannot match “URL → extracted site facts → used in writing,” we are behind these products.

**Operator expectation (confirmed):** Competitors would **have to** crawl (or otherwise ingest the site) before writing is trustworthy for that brand.

**Design weight:** **Writesonic impresses you most** among the writer products so far — bias v2 toward **domain-bound project + site structure → internal links / section grounding + audit-style health**, not chat-only voice samples.

**Wave 1:** Frase, Jasper, Copy.ai, Writesonic (§1–4).  
**Wave 2:** Byword, Koala AI, Writer, Anyword, Rytr, Marketing Mary, Zapier Blog, DeepSeek, Grammarly AI, Perplexity, Mistral (§5–15).

### Who actually *has to* crawl / ingest your site?

| Product | Have to crawl *your* site? | Practice |
|---------|----------------------------|----------|
| **Frase** | **Yes** | Domain Add Site → Brand Hub |
| **Jasper** | **Yes** (URL path) | Crawl ≤8 HTTPS pages → Brand Voice |
| **Writesonic** | **Yes** (site tools / serious SEO write) | Project **Domain URL** → audit + links |
| **Copy.ai** | Soft (Infobase store) | Website field + uploads; enrichment can research domain |
| **Koala AI** | **Yes** (Brand DNA URL import) | Website URL → profile + Knowledge Base; Growth Agent crawls sitemap |
| **Writer** | **Yes** (for web KG) | Knowledge Graph web connector: URL / sub_pages |
| **Byword** | **Domain-bound** + voice samples | `domain_id` on articles; domain scan for gaps; voice from samples (not Frase Hub) |
| **Anyword** | **Yes** (optional but productized) | Scan webpage URL → tone / persona / vocabulary |
| **Rytr** | **No site crawl** | My Voice from **writing samples** you paste |
| **Marketing Mary** | Stack + guidelines; crawl data optional | Brand guidelines / HubSpot / WP; Screaming Frog ingest for SEO fixes; internal links from CMS site |
| **Zapier Blog / Agents** | **No Brand Hub** | Automates other writers; Agents can read a page you’re on — not “connect domain → kit” |
| **Grammarly AI** | **No crawl for kit** | Brand Tones from wizard / samples; URLs only limit *where feedback shows* |
| **Perplexity** | Open-web + **your files** | Spaces/Projects: uploads, links as resources, web search — research grounding, not site Brand Hub |
| **DeepSeek** | Open-web (DeepSeekBot) | Chat/search cites the public web — **not** a client content writer with project domain |
| **Mistral** | Open-web + **Libraries** | Agents: web_search + document_library RAG — bring your docs; not SEO Brand Hub |

---

## 1. Frase

### Input
- **Domain** via Add Site (site selector). Crawl is required before Brand Hub / Opportunities / AI Visibility are useful.

### What the crawl produces (documented)
**Brand Hub → Profile (auto from site):**
- Business overview
- Tagline
- Target audience
- Brand values
- Tone / how the brand sounds (profile + Writing Brand Voice)
- Competitor matching criteria
- Site visual style signals (fonts, colors, images, etc.)

**Brand Hub → Competitors:**
- Auto-discovered competitor brands from site signals + matching criteria
- Used only after confirm for gap mining / AI Visibility

**Brand Hub → Assets:**
- Logos, icons, wordmarks, fonts, brand colors, image assets

**Separate Writing tools (often manual, but site-informed):**
- Brand Voice (tone, audience, dos/don’ts, CTAs, example phrases) — can be from upload/doc or scratch
- Terminology (preferred / avoid / never)
- Reference docs (product FAQ, style guides, personas)
- Templates (structure)

**Site Health / audit crawl (Optimize):**
- Technical/content health findings (severity, warnings, opportunities) — separate from Brand Hub profile crawl but same connected site

### How Frase uses it
| Extract | Used for |
|---------|----------|
| Profile (overview, audience, values, voice) | Research, content scoring, generation voice, AI Visibility |
| Competitors | Gap topics, Opportunities, AI Visibility prompts |
| Assets / visual style | Frase CMS theming, generation workflows |
| Brand Voice + terms | Auto-applied when generating **and** editing; publish can block on “Never” terms |
| Reference docs | Injected into AI context when relevant |
| GSC (after connect) | Opportunities from real queries/pages — not crawl text, but site-bound |

**Takeaway:** Frase treats **domain connect + crawl → reviewable Brand Hub** as the foundation. Writing without a connected site is second-class.

---

## 2. Jasper

### Input
- Up to **8 examples**: pasted text, files (.txt/.pdf/.docx), and/or **HTTPS URLs**
- Docs: Jasper **crawls** URLs for adequate text (not full “scrape everything” framing); needs enough characters (~1k min across examples)

### What URL crawl produces (documented)
- Enough body text from the page(s) to analyze **tone, style, vocabulary, personality**
- Auto **voice description**
- **Excerpts** the operator can enable/disable to refine the voice
- Preview generations with vs without voice

What Jasper does **not** document as auto-filling from URL (unlike Frase Brand Hub):
- Full Infobase-style company fact sheet (features list, positioning one-liners) from a whole-domain crawl in Brand Voice alone
- Competitor discovery from site
- Visual brand assets from site

(Jasper IQ also has Audiences, Knowledge, Style Guides, Visual Guidelines as **separate** cards — those are not the same as “paste one domain and get Brand Hub.”)

### How Jasper uses it
| Extract | Used for |
|---------|----------|
| Voice profile + enabled excerpts | Agents, Doc editor, Chat generations |
| Default workspace voice | All new content unless overridden |
| Style Guide (Business) | Explicit rules (e.g. terminology) on top of voice |

**Takeaway:** Jasper’s URL path is **voice-sample crawl** — learn how you sound from real pages. Company facts are a different IQ surface; URL is still the common way to seed voice without pasting by hand.

---

## 3. Copy.ai

### Input
- Infobase is primarily **operator-filled structured fields** + uploads (up to ~10MB per entry)
- Documented starter fields include **Company website** alongside name, description, value prop, positioning statements, audiences, features/use cases

### What “website” means here
- Public Infobase docs emphasize **storing and referencing** company info (# / @ tags), not Frase-style “enter domain → auto Brand Hub.”
- Website is still a **first-class field**. Separate Workflows can enrich a company **from a domain** (research/enrich) — that is crawl-like *use* of a URL, then you park results in knowledge the writer tags in.
- So: they don’t document “must crawl before every article” the way Frase does — but for non-generic copy they **still have to** supply site/company facts. Manual fill is their pain; crawl-filled kit is our answer.

### How Copy.ai uses it
| Stored field | Used for |
|--------------|----------|
| Company website + description + positioning + audiences + features | Referenced into Chat/Workflows so generations aren’t generic public-LLM mush |
| Uploaded brand/positioning docs | Same — private knowledge for generation |
| Lists (features, audiences) | Structured recall via Infobase tags |

**Takeaway:** Copy.ai proves the **fields** (website, positioning, audiences, features). Frase/Jasper/Writesonic prove you **have to ingest the site**. We do both: crawl fills those fields; operator Accepts; WRITE uses them.

---

## 4. Writesonic

### Input
- **Project + Domain URL** required for site-bound tools (Site Audit, AI Traffic Analytics). Default project without domain cannot run those.
- Article Writer / brand workflows assume a site property for SEO and internal linking (product marketing + reviews).

### What domain crawl / audit produces (documented)
**Site Audit / SEO:**
- Crawl depth / page count configurable
- Technical + on-page issues (content quality, UX factors, SEO checks)
- Domain-connected monitoring of AI bot visits / indexing-related signals (GEO/AI Traffic Analytics)

**Content generation (product claims / reviews):**
- Internal linking suggestions from site structure
- Brand voice / uploaded docs / URLs as training material
- Research + competitor SERP context (often via integrations), then draft with links/meta

### How Writesonic uses it
| Extract | Used for |
|---------|----------|
| Domain-connected project | Scope for audit, AI traffic, site tools |
| Audit findings | Fix lists, health |
| Site structure / pages | Internal links in articles; GEO-ready structure (FAQ, citeable passages) |
| Brand voice materials | Tone on generated articles |

**Takeaway (your favorite so far):** Writesonic binds work to a **domain URL project**. Internal links and site audit are first-class uses of crawl — same family as our `relatedPages` / site section context. **Weight v2 toward this pattern.**

---

## 5. Byword

### Input
- Articles/API require a **`domain_id`** (site property in the account).
- Programmatic SEO: enter **domain or niche** for opportunity ideas; domain **scan** for topical gaps.
- Brand voice: train from **sample content** (tone/style/terminology), not a Frase-style auto Brand Hub from one Add Site.

### What crawl / ingest produces
| Source | Extract |
|--------|---------|
| Domain scan | Topical gaps / programmatic opportunities |
| Connected CMS + indexing | Publish targets; Indexing API / IndexNow after publish |
| Voice samples | Voice-matching profile (tone, style, terms) |
| MCP / site tools | Read site, search, analytics, crawl, keyword, competitor, performance data (agent workflows) |

### How Byword uses it
| Extract | Used for |
|---------|----------|
| `domain_id` | Scope every generated article to a property |
| Domain scan gaps | Campaign / programmatic page ideas |
| Voice match | Consistent batch articles |
| Site structure + CMS | Internal linking, publish, index |

**Takeaway:** Domain-first like Writesonic for generation scope + links/publish; voice is sample-trained more than full auto Brand Hub.

---

## 6. Koala AI

### Input
- **Brand DNA:** import from **website URL**, Google Maps, or manual template (local / SaaS / ecommerce / etc.).

### What website import / crawl produces
| Extract | Notes |
|---------|--------|
| Business profile | Brand voice, audience, USPs, key business facts from site (or Maps: address, phone, reviews, website) |
| Knowledge Base | Auto-built from import; editable; + docs (services, products, case studies); ~100k char cap |
| Growth Agent site work | Crawls **sitemap**, keywords, backlinks, competitor / AI-search analysis |
| GSC / GA (optional) | Real queries/traffic into recommendations |

### How Koala uses it
| Extract | Used for |
|---------|----------|
| Brand DNA + Knowledge Base | KoalaWriter v2 articles (Prominent / Subtle / None brand mention; CTA) |
| Growth Agent | Strategy, queue articles, schema via KoalaLinks |
| Outline-first option | Review/edit outline + brief before write |

**Takeaway:** Strong “URL → profile + KB → write” — closest peer to Frase Hub + Writesonic domain binding. Outline-before-write matches our gate.

---

## 7. Writer (writer.com)

### Input
- **Knowledge Graph** with type **web**: add website URLs (`single_page` or `sub_pages`, exclude list).
- Also files, Drive/Confluence/Notion, CRM, etc.
- Separate: Style Guide / Brand Voice / terminology (enterprise governance).

### What web crawl produces
- Extracted page text → graph entities/relationships → RAG index (with citations on query).

### How Writer uses it
| Extract | Used for |
|---------|----------|
| Knowledge Graph (incl. site) | Agents / chat / content grounded in *your* pages + docs |
| Style Guide + Brand Voice | On-brand, compliant generation and edit |

**Takeaway:** Explicit **crawl your site into RAG** — facts for generation, not only voice samples. Parallel to Geek-SEO → BrandKit + relatedPages, with stronger enterprise KG framing.

---

## 8. Anyword

### Input
- Brand Voice: **scan a webpage URL** (or samples / PDF guidelines) for tone; same for **target audience / persona**.
- Brand Vocabulary: import from **URL or PDF** (approved / don’t use / use carefully).
- Integrations: ads accounts for performance scoring (Meta, Google, LinkedIn, etc.).

### What URL scrape produces
| Extract | Used for |
|---------|----------|
| Tone summary from page | Brand Voice on generation |
| Persona / pain points from homepage URL | Audience targeting |
| Vocabulary from guidelines URL | Term enforcement |
| Connected campaign data | Predictive performance score (not site SEO crawl) |

**Takeaway:** They productize **URL scrape → voice + persona** (Jasper-like + audience). Scoring is performance-data, not Site Audit. Still: ingest a real page, don’t invent the brand.

---

## 9. Rytr

### Input
- Use-case templates + preset tones.
- **My Voice:** upload **2–3 writing samples** (paid) — not a domain crawl.

### What ingest produces
- Custom tone profile from samples only.

### How Rytr uses it
- Select My Voice / tone per generation for short-form and template outputs.

**Takeaway:** Voice-sample only. **No** “have to crawl the site.” Weak peer for our grounding bar; ignore as crawl model.

---

## 10. Marketing Mary

### Input
- Brand guidelines + best-performing content + messaging (upload/analyze → voice model).
- Live stack: **HubSpot / WordPress** APIs (the real site as CMS).
- Optional: **Screaming Frog crawl** data → prioritized SEO fix lists (with Ahrefs).

### What “site” means here
| Source | Extract / use |
|--------|----------------|
| CMS connection | Publish destination; existing posts for **internal links** both ways; schema |
| Brand guidelines / samples | Voice enforcement in the pipeline |
| Screaming Frog file | Technical/content issues — external crawl ingest, not Mary’s own Brand Hub crawler |

### How Marketing Mary uses it
- Full pipeline: research → write in brand voice → images → SEO/schema → CMS publish → internal links → verification.
- Buyer personas as conversational objects (marketing claim).

**Takeaway:** Writesonic-adjacent on **internal links + CMS-bound site + SEO crawl data**; brand often from guidelines/samples more than auto Hub. Pipeline ambition > single Brand Hub form.

---

## 11. Zapier Blog (and Agents)

**Clarification:** “Zapier Blog” is Zapier’s **editorial / how-to** surface (e.g. automate Jasper or ChatGPT → Docs/WordPress). It is **not** a site-crawl content platform with Brand Hub.

### What Zapier productizes for content
| Piece | Behavior |
|-------|----------|
| Zaps | Trigger topic → Jasper/ChatGPT prompt (you paste brand instructions) → Docs/CMS |
| Agents / former Central | Bots with live data (Sheets/Docs); Chrome extension can **read the page you’re on** |
| No documented | Domain Add Site → auto company profile for all blog Zaps |

**Takeaway:** Orchestration layer. Crawl/grounding lives in the **connected writer** (or page the agent sees), not in Zapier itself.

---

## 12. DeepSeek

### What it is
- LLM + hosted chat/API; optional **Search the web**.
- Crawlers (e.g. DeepSeekBot) for training/retrieval of the **public web** — brands optimize *to be cited*, they don’t “connect my domain to write my blog.”

### How site content is used
| Mode | Use of your site |
|------|------------------|
| Search on | Live fetch/cite public pages |
| Search off | Training memory only |

**Takeaway:** **Distribution / AI-visibility concern**, not a Content Creator competitor for URL → BrandKit → article. Keep for GEO backlog, not Phase A crawl UX.

---

## 13. Grammarly AI (Business Brand Tones)

### Input
- Brand Tones wizard: pick on-brand / off-brand tones + examples.
- Optional: list of **websites where feedback appears** (allowlist for the extension) — **not** a crawl of those URLs into a brand kit.

### How Grammarly uses it
- Real-time tone feedback while humans write in browsers/apps.
- Snippets / style guides on Business plans.

**Takeaway:** Enforcement on human writing, not SEO article generation from a crawled property. Useful metaphor for **Accept BrandKit → enforce in WRITE**, not for crawl extraction.

---

## 14. Perplexity

### Input
- Web search (default product).
- **Spaces / Projects:** files, folders, connectors (Drive/SharePoint), custom instructions, optional **specific links as resources**.

### What “crawl” means
- Open-web retrieval for answers + citations.
- Your uploads/links as **project context** for research threads — not Frase Brand Hub from one domain connect.

### How Perplexity uses it
| Source | Used for |
|--------|----------|
| Web | Cited research answers |
| Project files / links | Ground answers in internal + chosen URLs |

**Takeaway:** Best peer for **research grounding + citations**, not for “who we’re writing for” BrandKit. Our RESEARCH step can learn citation discipline; site identity still needs Geek-SEO.

---

## 15. Mistral

### Input
- Le Chat / Agents: **web_search** / premium; **document_library** (Libraries RAG).
- Mistral’s own crawlers (`MistralAI-User`, `Index`, `Training`) for product search/training — webmaster robots.txt concern, not customer Brand Hub.

### How Mistral uses site-like data
| Tool | Use |
|------|-----|
| web_search | Fetch public web for the answer |
| document_library | RAG over **uploaded** libraries |
| Agents instructions | System prompt / tools config |

**Takeaway:** Model platform with optional RAG + web — you must **bring** brand docs. Same as soft Infobase unless we crawl-fill.

---

## 16. Side-by-side (writers that matter for crawl)

| Concern | Writesonic | Koala | Byword | Frase | Writer | Anyword | Rytr |
|---------|------------|-------|--------|-------|--------|---------|------|
| Entry | Domain on project | Website / Maps / template | `domain_id` + samples | Add Site domain | KG web URLs | Scan page URL | Paste samples |
| Auto brand facts | Site project + tools | Brand DNA + KB | Weak (voice samples) | Brand Hub | KG entities | Tone + persona | No |
| Voice from site | Docs/URLs | From Brand DNA | Samples | Hub + Brand Voice | Style + KG | Page scrape | Samples only |
| Internal links | **Yes** | Via KoalaLinks / brand domain | **Yes** | Site-bound | Via KG awareness | Not core | No |
| Outline before write | Product flows | **Yes** (v2) | Batch/campaign | Research/write | Agent workflows | Editor flows | Templates |
| Closest to our bar | **Primary** | Strong | Strong domain | Strong Hub | Strong RAG | Voice/persona | Weak |

**Not in table (different job):** Zapier (orchestrate), Grammarly (edit feedback), Perplexity/DeepSeek/Mistral (search/models), Marketing Mary (pipeline + CMS; Screaming Frog optional).

---

## 17. What v2 must take from this (product requirements)

**They would have to crawl (or ingest the site).** Hard gate.

**Because Writesonic impresses you most, prioritize:**

1. **Domain URL on the work** — every create is for a property (`Writing for: https://…`).  
2. **Site structure → links** — non-empty `relatedPages` / section context injected into WRITE (Writesonic internal links; Byword/Mary same family).  
3. **Reviewable extract** — BrandKit Accept (Frase Hub + Koala Brand DNA + Copy.ai fields), not silent.  
4. **Outline edit before write** — Koala v2 / Writesonic-style, not Approve-only theater.  
5. Optionally later: audit-style findings from Geek-SEO (Writesonic Site Audit peer) — not blocking Phase A.

Also steal where useful:

- **Koala:** URL import → editable Knowledge Base; brand mention strength.  
- **Writer:** web connector depth (sub_pages) as mental model for Geek-SEO profile trees.  
- **Anyword:** URL → audience/persona scrape into kit.  
- **Byword:** domain_id discipline on every generation.  
- **Perplexity:** citation discipline in research (not BrandKit).  
- **Ignore as crawl models:** Rytr, Grammarly allowlist URLs, Zapier Blog, DeepSeek-as-writer, Mistral-without-Libraries.

**Our stack already crawls** (Geek-SEO). Content Creator must:

1. **Require project site URL** and resolve/run analysis.  
2. **Surface extracted facts** (BrandKit).  
3. **Surface page-level context** (`relatedPages`).  
4. **Use both in WRITE** after Accept.  
5. **Hard stop** if missing — never silent Geek At Your Spot substitute.

Field mapping: [`content-creator-v2.md`](./content-creator-v2.md). Build: [`brandkit.md`](./brandkit.md).

---

## Sources
- Frase: [Connect site & brand](https://docs.frase.io/get-started/connect-your-site-and-brand), [Brand Hub](https://docs.frase.io/feature-reference/brand-hub)
- Jasper: [Brand Voice help](https://help.jasper.ai/hc/en-us/articles/18618693085339-Brand-Voice)
- Copy.ai: [Infobase](https://www.copy.ai/features/infobase)
- Writesonic: [Add website domain](https://docs.writesonic.com/docs/how-to-add-a-new-website-domain)
- Koala: [Brand DNA + KoalaWriter v2](https://koala.sh/blog/brand-dna-and-koalawriter-v2), [Brand DNA](https://koala.sh/brand-dna)
- Byword: [API](https://byword.ai/learn/api/), [MCP](https://byword.ai/docs/mcp/), [Programmatic](https://byword.ai/features/programmatic/)
- Writer: [Knowledge Graph](https://writer.mintlify.app/home/knowledge-graph-concepts), [Web connector](https://writer.mintlify.app/home/web-connector-url)
- Anyword: [Brand Voice](https://support.anyword.com/what-is-brand-voice), [URL tone/persona blogs](https://www.anyword.com/blog/how-to-train-chatgpt-with-your-brand-voice-video)
- Rytr: [My Voice](https://rytr.me/products/my-voice)
- Marketing Mary: [Home](https://www.marketingmary.ai/), [Automated content pipeline](https://www.marketingmary.ai/automated-content-pipeline)
- Zapier: [Agents](https://zapier.com/blog/introducing-zapier-ai-agents/), blog how-tos for Jasper/ChatGPT pipelines
- Grammarly: [Set brand tones](https://support.grammarly.com/hc/en-us/articles/4403544890253-Set-brand-tones)
- Perplexity: [Spaces / internal knowledge](https://www.perplexity.ai/hub/blog/introducing-internal-knowledge-search-and-spaces)
- Mistral: [Websearch](https://docs.mistral.ai/studio/agents/agent-tools/websearch), [Crawlers](https://docs.mistral.ai/robots)
- DeepSeek: product is chat/search + open-web crawl (GEO), not client Brand Hub writer

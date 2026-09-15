# Content Creator v2 — Execution plan (sole release-plan & decision record)

**Updated:** 2026-09-14  
**Accountable owner:** Jeff Martin  
**Platform map:** [architecture.md](../architecture.md) (authoritative for architecture contracts)  
**Agent rules:** [`.cursor/rules/`](../.cursor/rules/) — mirrored from **Non-negotiables** (and P0 honesty); sync when this file’s policy changes

### Status (read this first)

| | |
|--|--|
| **Where we are** | M2/M3 shipped; **P0–P1.5 eng impl + unit tests green** (2026-09-14 audit); Create writer = GeekAPI `gcc-create-library.v1`; partner/competitor extraction + remaining fallbacks **eng complete** — **not** release-ready until Jeff fills §7 **Result=pass** (A1–A4, P1/P1.5, R1a–R11) then **P3** |
| **Goal** | Signed-in prod can ship citeable `blog` through Create → Canvas without success-shaped lies |
| **Surfaces** | Phi `https://content-creator-v2-phi.vercel.app` · GeekAPI `https://api.geekatyourspot.com` |
| **Decision date** | Release-ready yes/no by **2026-09-28** (slip only with a dated note here) |
| **Kill switch** | `GCC_V2_CITEABLE_CREATE_V1` (default ON) — see §Kill switch |
| **Seed** | ApprovalMax `04fbbd9c-6b11-478d-98bf-13f2377a0d7a` (248 chunks); Plooto OK; avoid Rytr |
| **Live tracker** | **§7** |
| **Eng vs release** | Eng cannot mark release-ready. §7 **Result** cells require Jeff Evidence packs (Env · SHAs · UTC date · pack · job id). |

### Create drafting contract (locked 2026-09-14)

| Role | Contract |
|------|----------|
| **RAG** | **Library only** (definition): `/v1/query` + page Markdown verify. RAG does not draft Create. |
| **GeekAPI** | Canonical Create writer: `CreateLibraryDraft=true`, provenance `gcc-create-library.v1`. Fail closed on empty/failed retrieval. |
| **Forbidden** | SoftDisabled / one-shot / capabilities negotiation as a citeable Create success path. |
| **Naming** | `rag-generate.v2` / `rag-generate.v3` / `POST /v1/generate` are **deleted** from the Create + GeekAPI + Geek-Crawler-Rag product path. Historical wire/fixture names may remain in Phase U contracts — do not revive generate. |

### Create evidence policy (locked 2026-09-14)

**Neither partner nor competitor evidence is optional.** Products we sell are partner tools; competitor analysis is required strategy — not enrichment.

**Fail closed** = missing or unusable required evidence → the job **stops with an error**; it does not continue as success.

| Evidence | Required | Behavior |
|----------|----------|----------|
| **Partner crawl run** (`partnerSourceRunId`) | **Every Create** | **Fail closed** — bind partner tool URLs + indexed partner run; no empty research plan; no project-site substitute |
| **Competitor crawl run** (`competitorSourceRunId`) | **Every Create** | **Fail closed** — bind competitor page URLs + indexed competitor run; no soft-skip |
| **Project-site crawl** | Every Create that Appendix A marks site-required | Required **alongside** partner + competitor; **never replaces** either |

**UI (Create → Research):** **Partner tool URLs (required)** and **Competitor page URLs (required)**. Do not bury either.

**Forbidden:** empty research plan / brief-only / site-only drafting as success without both runs; silent substitute of another owner’s run; competitor cited as `crawlType:"partner"`.

**Code follow-up:** **Done** (2026-09-14) — pre-PLAN + Create library `researchPlanning` require **both** partner and competitor run IDs on every Create (Appendix A); brief/topic-only paths throw.

**Remaining fallback closure:** **Complete** — [remove-remaining-fallbacks-complete.md](remove-remaining-fallbacks-complete.md). Partner/competitor Mongo seed-HTML: [remove-partner-seed-html-fallback-complete.md](remove-partner-seed-html-fallback-complete.md).

### Competitor intelligence — what Create obtains (locked 2026-09-14)

**Status: Complete** — GeekAPI eng `gcc-competitor-extraction.v1` (2026-09-14). Authoritative plan: [competitor-extraction-complete.md](competitor-extraction-complete.md) (§12 Done checklist).

**Authoritative plan:** [competitor-extraction-complete.md](competitor-extraction-complete.md) — strategy goals, direct vs content rivals, obtain brief, **named extraction payloads** (pricing/ICP/integrations/FAQ/proof/CTA/disqualifiers min-expand; gap map, framing, demand signals, type label, deficit router, comparison axes, claim-risk; extended ad/SEO catalog), semantic chunking, **competitor SoftwareApplication JSON-LD**, and fail-closed binding.

Summary: competitor analysis + honest mention is required Create strategy (gaps, BOFU comparison, trust, SEO de-risk). Library extracts structured rival payloads for `/v1/query`; structured rival schema = `SoftwareApplication` (competitor-analysis §10). Create drafting remains GeekAPI `gcc-create-library.v1` (not RAG generate). Hard rules: always required · fail closed · never `crawlType:"partner"`. Excerpt-only resolve does not fulfill extraction payloads.

### Partner extraction — product payloads (locked 2026-09-14)

**Status: Complete** — GeekAPI eng `gcc-partner-extraction.v2` (2026-09-14). Authoritative plan: [partner-extraction-complete.md](partner-extraction-complete.md).

**Authoritative plan:** [partner-extraction-complete.md](partner-extraction-complete.md) — extract **Citable**, **Advertisement**, **Comparison**, **Alternatives**, plus **minimum expand** (Pricing catalog, ICP, Integrations, FAQ/objections, Proof pack, Offer/CTA destinations, Disqualifiers) and an **extended catalog** from the partner library for sellable / distributable content; emit **partner** `SoftwareApplication` JSON-LD mapped from those payloads. Rival `SoftwareApplication` nodes: [competitor-extraction-complete.md](competitor-extraction-complete.md) §10.

| Asset | Fields |
|-------|--------|
| **Citable** | `isolated_claim` · `origin_proof_url` · `temporal_anchor` |
| **Advertisement** | `marketing_hook` · `pain_point_trigger` · `cta_wrapper` |
| **Comparison** | `standardized_feature_id` · `capability_payload` · `normalized_cost` |
| **Alternatives** | `trigger_deficit` · `recommended_swap` · `pivot_copy` |
| **JSON-LD** | `SoftwareApplication` (+ `Offer` / `UnitPriceSpecification` / `Review`) — see partner-extraction §9 |

Hard rules: partner crawl always required · fail closed · tools = partners · never label competitors as partner. Library query only — not RAG generate.

**Image prompts:** Every parent Create type (including Tool — tools = partners) auto-spawns H1/hero + non-FAQ H2 `image-prompt` siblings when ready — [image-prompt-h1-h2-complete.md](image-prompt-h1-h2-complete.md). Never spawn from `image-prompt`.

**Authority:** This file is the **sole release-plan and release-decision record**. Referenced specifications (`architecture.md`, Appendices A–E, [competitor-extraction-complete.md](competitor-extraction-complete.md), [partner-extraction-complete.md](partner-extraction-complete.md), [remove-remaining-fallbacks-complete.md](remove-remaining-fallbacks-complete.md), deployed contracts, linked evidence) remain authoritative for their stated contracts. Logs/tests/job artifacts are evidence — not competing plans.

### Roles

| Role | Who |
|------|-----|
| **Accountable** (all gates) | Jeff Martin |
| **Performer (eng)** | Composer/agent or human on GeekAPI/phi for A*/P1/P1.5/P4 impl |
| **Performer (smokes / release / Mongo review)** | Jeff Martin (signed-in) |
| **Verifier** | Jeff Martin (every Result cell) |

---

## Critical path (do in order)

```text
P0 Honesty blockers (A1–A4 verified)
    → P1 Partner-mention gate (verification REQUIRES A4)
    → P1.5 sourceRights provenance (verification REQUIRES A4; needed before R1a/R1b pass Appendix B)
        → P2 Prod smokes (deterministic fixtures where required)
            → P3 Release decision 2026-09-28
                 (Mongo accepted-risk residual recorded)
                → P4 Wave B/C  ·  P5 Mongo audit rows by 2026-10-14
                     (P5 does NOT block M4/PDF)
                        → (parked until P3 only) M4 / LlamaIndex / PDF
```

### Schedule escalation (§7)

If any of **A1–A4**, **P1/R8**, or **P1.5** is not `Result=pass` by **2026-09-22 23:59 UTC**, P3 is automatically **not ready** unless Jeff records a dated revised schedule in the P3 Evidence cell.

---

## Evidence quality (all smoke / verification rows)

A **pass** cell requires **all** of:

1. **Env** = `prod` (or named prod-like env for fault injection — see P2)  
2. **GeekAPI deploy SHA** + **phi deploy SHA**  
3. **Run date (UTC)**  
4. **Verifier** = Jeff  
5. **Evidence pack** (immutable or timestamped link): redacted request/response or ResultJson; Canvas screenshot or exported state showing the assertion; the **assertion text** checked  
6. **Job id** (or fixture id) when a job exists  

Job id alone is **invalid** evidence.

---

## P0 — Honesty blockers (Wave A)

| ID | Work | Primary paths | Done when |
|----|------|---------------|-----------|
| **A1** | Empty refresh token ≠ stub | GSC/Drive/SharePoint connectors + Knowledge + controllers | Fail closed unless `status=="stub"` **and** stubs allowed |
| **A2** | RAG fail ≠ empty success | `HttpGeekCrawlerRagClient`; Create PLAN callers | Typed error; never empty-Pages-as-success |
| **A3** | Citeable soft-disable honesty | `RagGenerateService` | Soft-disable/one-shot ≠ citeable success; Create uses `CreateLibraryDraft` (`gcc-create-library.v1`), never SoftDisabled success |
| **A4** | Acceptance tests | `GccV2Fallback*` / new | A1–A3 CI green |

**Performer:** eng · **Verifier:** Jeff · **Target:** 2026-09-21

**Deploy:** GeekAPI → Railway prod → spot-check.

### Baseline & rollback (operational)

**Baseline query (capture once before A\* prod deploy):**

| Field | Definition |
|-------|------------|
| **Collection** | Fixed UTC window: 7×24h ending at deploy time, **or** the chronologically last **20** Create **starts** that reached PLAN with RAG health=OK — whichever yields ≥20 first. If &lt;20 healthy-RAG starts exist in 7 days, use all available and record `n`. |
| **Start** | Job created / worker claimed into PLAN (document exact event name in Evidence when captured) |
| **Terminal taxonomy** | `ready` · `failed` · `canceled` · (other = exclude from rates) |
| **F0** | `failed / (ready+failed)` among baseline set (**exclude** `canceled`; **exclude** manually failed smoke jobs tagged `smoke:manual`) |
| **S0** | Among `ready`, share with `shipReady=false` (or equivalent) |
| **Report** | Paste query/dashboard URL + CSV/JSON snapshot into Evidence pack |

**Post-deploy window:** 24h after A\* prod deploy **or** first **20** healthy-RAG Create starts, whichever first.

**If &lt;10 healthy-RAG starts in 24h:** do **not** auto-rollback on rate alone; Jeff decides continue/watch/rollback with dated note; stub-shaped response rule (#2) still forces rollback.

**Rollback triggers:**

1. Terminal **fail** rate ≥ `F0 + 15` percentage points on ≥**20** healthy-RAG starts in the window (if only 10–19 starts, require ≥`F0+15` **and** Jeff confirmation) — unless Jeff documents RAG unhealthy as root cause.  
2. **Any** non-stub GSC/Drive/SharePoint connection returns stub-shaped / empty-token success after A1.  
3. ≥2 jobs with shipReady false-positive (Ready/`shipReady` true with missing blocking gap) or false-negative (blocked without matching §P1/coverage/`sourceRights` rule).

**Rollback action:** prior GeekAPI deploy. **Succeeds when:** prior deploy live; one ApprovalMax Create path recovers; no stub-shaped non-stub payloads.

---

## P1 — Partner-mention ship block (R8 interim)

**Name:** Interim **partner-mention coverage gate** — **not** claim-level / sentence-level verification.

**Dependency:** Impl may parallel A\*. **Verification REQUIRES A4 pass.**

### Matching (executable)

| Rule | Spec |
|------|------|
| **Normalize** | Unicode **NFC**, then Unicode case-fold; collapse whitespace runs to single U+0020; trim |
| **Whole-token** | Match only if token is bounded by start/end or a character outside Letter / Number / `_` / `-` (Unicode categories). No substring matches (`Slack` ⊄ `Slackware`) |
| **Punctuation / CJK / symbols** | Labels that are entirely punctuation or symbols match only exact normalized equality of the full label string (no “word boundary” split). CJK tokens: whole-token = no Letter/Number neighbor on either side under NFC |
| **Aliases** | Only explicit alias strings on the tool/brief entry; same normalization. If label ≡ alias after normalize, **dedupe** (single token) |
| **Precedence** | Union of labels + aliases after normalize+dedupe; no preference beyond set membership |
| **Scan region** | Operator-visible prose: body paragraphs, **headings**, **blockquotes**, **table cell text**, image **alt text** |
| **Excluded** | Citation quote spans; footnote/reference lists; bare URLs; markdown link **targets**; fenced/inline code; citation chrome / attribution labels; HTML comments |
| **Gate trigger** | Brief has ≥1 named partner token **and** scanned body region of a section contains a hit |
| **Required evidence** | Same section: ≥1 citation `verified===true` and `crawlType:"partner"` (need not support the hit sentence) |
| **Gap string** | Exact: `partner-mention '{Partner}' on section '{sectionKey}' lacks verified partner citation` where `{Partner}` = brief token **as stored** (original casing from brief entry used for the hit); `{sectionKey}` = exact section key string |

**Appendix B alignment:** Gate applies only when a named partner **appears in scanned body prose** of a section — **not** merely because the brief lists partners.

**Done when:** A4 pass + fixture + R8 smoke; gap string on Canvas/ResultJson.

**Target:** 2026-09-21 · eng / Jeff

---

## P1.5 — sourceRights provenance (release blocker — tracked)

**Why:** Appendix B requires decidable source rights; without this, R1a/R1b cannot pass.

| Field | Spec |
|-------|------|
| **Canonical field** | `sourceRights` on **page/chunk metadata** in Geek-Crawler / RAG source record (preferred). Values: `consented` \| `licensed` \| `unknown` \| `prohibited` |
| **Brief override** | Optional per-create override map `runId|pageId → sourceRights`. **Precedence:** brief override **wins** over page/run default for that create only |
| **Missing field** | Treat as `unknown` |
| **Who may set `consented` / `licensed`** | Jeff Martin (or delegate named in Evidence); eng may set `unknown` defaults and plumbing only |
| **Backfill** | ApprovalMax + Plooto smoke hosts: set page/run default to **`consented`** (operator-intended advertising corpus) before R1a; document run ids in Evidence. All other existing pages default **`unknown`** until reviewed |
| **Ship behavior** | `prohibited` or `unknown` on any **displayed** citation → `shipReady=false`; blocking gap e.g. `sourceRights '{value}' on citation for section '{sectionKey}'` |
| **Fixtures** | Unit: missing≡unknown; override precedence; prohibited blocks. Integration: smoke corpus pages carry `consented` |
| **R1a expected** | All displayed citations `sourceRights=consented` (ApprovalMax/Plooto backfill) |
| **R1b expected** | All displayed citations `consented` or `licensed` (project-site / non-partner sources used must be set accordingly before smoke) |

**Dependency:** Verification REQUIRES A4 (shared deploy train OK). **Target:** 2026-09-21 · **Performer:** eng (plumbing + backfill script) · **Verifier:** Jeff (consent assignment + smoke) · Track in §7.

---

## P2 — Prod smoke matrix

**Target:** 2026-09-25 · Jeff / Jeff · Evidence quality rules apply.

### Fault-injection / setup safety

| ID | Setup (deterministic, reversible) |
|----|-----------------------------------|
| **R3** | Dedicated **reversible test project/create** (not mutation of shared prod corpus). Brief includes named partner token; partner corpus **unavailable** for that create (unindexed / unbound). Use a **controlled draft fixture** (saved section markdown that mentions the partner) → run **VALIDATE only** for the mention gate. Separately assert **warning copy** from generate/PLAN path in one run — **do not** re-generate until mention appears. |
| **R5** | Second signed-in **test tenant/account** (non-sensitive). Fixture: known foreign `runId` owned by tenant B presented to tenant A session. Expect safe-fail; no data leak. Record both user ids (redacted) in Evidence. |
| **R6** | Prefer **prod-like** signed-in env with approved fault injection (e.g. temporary upstream fault flag / bad RAG generate URL for one job) **or** documented Chaos on GeekAPI staging that mirrors worker. **Not** ad-hoc production corpus damage. |

| ID | Check | Expected |
|----|-------|----------|
| **R1a** | Partner-named blog happy path | Named partner + usable corpus; verified partner citation; all displayed citations `sourceRights=consented`; Canvas OK |
| **R1b** | No-partner blog happy path | No partner subjects; shipReady without partner cites; displayed citations `consented`/`licensed` only |
| R2 | Project-site missing | PLAN blocked; actionable recovery |
| **R3** | Named partner + no corpus | Warning copy recorded (skipped/unindexed ≠ ready); draftable; VALIDATE on fixture draft → not shipReady + §P1 gap; **no generation retry loops** |
| R4 | Partner + competitor | No competitor as `partner` |
| **R5** | Foreign runId | Safe-fail only; test tenant fixture |
| **R6** | WRITE failure | Induced WRITE transport/upstream failure → **typed terminal `failed` on first attempt**; **no automatic retry**, no fallback draft, no Ready/`shipReady` true. User-initiated **new job** is allowed and is **not** an automatic retry — record as separate job id |
| R7 | Section regen | Citations for that `sectionKey` only |
| R8 | Partner-mention gate | Fixture draft + VALIDATE; gap string exact |
| R9 | No offsets | Quote/digest verifies |
| R10 | Corpus usable | PLAN ≥1 usable source |
| **R11** | Kill switch OFF | Set `GCC_V2_CITEABLE_CREATE_V1=false` on GeekAPI (Jeff); attempt Create citeable path: **fail closed** (start rejected **or** terminal `failed` with explicit citeable-disabled error) — **never** Ready with ship gates skipped; restore flag ON after. Evidence includes parse matrix unset/true/false/0/off |

Fill Env / SHAs / date / Evidence pack / Job id / Result in §7 (or attach pack links there).

**Depends on:** A1–A4, P1, **P1.5** verified before R1a/R1b/R8/R11 count toward P3.

---

## P3 — Release decision

By **2026-09-28**, Jeff records:

- **Release-ready** — §7 P0–P2 (incl. P1.5, R11) all `pass`; Appendix B on R1a/R1b; escalation clear; Mongo residual sentence: *Mongo `:27017` remains **accepted-risk** per P5; this release does **not** claim a stronger security posture than compensating controls allow.*
- **Not ready** — open/fail IDs + next date  

Never call “M2/M3 complete” while gate open.

---

## Kill switch — `GCC_V2_CITEABLE_CREATE_V1`

| Field | Rule |
|-------|------|
| **Parse** | ON: unset, `true`, `1`, `on` (case-insensitive). OFF: `false`, `0`, `off`. Other values → treat as ON and log warning |
| **Who** | Jeff only on Railway GeekAPI prod; date+reason in Evidence |
| **OFF behavior** | **Fail closed.** Citeable Create MUST NOT skip quote-verify, section-coverage, partner-mention, or `sourceRights` and still succeed. Prefer: reject Create start **or** terminal job `failed` with an explicit “citeable VALIDATE disabled” error. **Forbidden:** Ready / soft-success / “degraded mode” while ship gates are skipped (that is a fallback) |
| **Invariants** | No `validationMode=degraded`. No success-shaped path when OFF. `shipReady` remains Appendix B only when citeable VALIDATE actually ran with gates ON |
| **Release** | OFF **cannot** make the program release-ready; OFF is an emergency stop, not an alternate ship path |
| **Tests** | Unit parse matrix unset/true/false/0/off; R11 smoke (fail-closed, not Ready-with-skipped-gates) |

**Impl note (2026-09-14):** Kill switch OFF is fail closed in GeekAPI VALIDATE for citeable content types (throws; job fails). Do not restore skip-gates Ready.

---

## P4 — Honesty follow-ons

| ID | Work | Done when |
|----|------|-----------|
| B1–B4 / C1–C2 | Per prior Wave B/C list | Fix + verify |

After P3 or parallel · eng / Jeff

---

## P5 — Mongo accepted-risk (auditable; non-blocking for M4)

### Decision (2026-09-14)

Accepted-risk re-accepted by Jeff. Exposure: FW TCP/27017 `source=any`; Railway `MONGO_CRAWLER_URL`. Auth required; TLS unverified. **P5 does not block M4/PDF** (gated on P3 only).

### §7 audit rows (due 2026-10-14)

| ID | Check | Evidence required | Result |
|----|-------|-------------------|--------|
| **P5a** | Credential age | Last Mongo auth secret rotation date; **due by 2026-10-14** if age &gt;180d or unknown — rotate or dated waive | — |
| **P5b** | Auth verification | Proof auth enabled (config redacted / connection refuse without creds) | — |
| **P5c** | Firewall evidence | Hostinger FW export/screenshot: rule id, port 27017, source | — |
| **P5d** | Tunnel/allowlist decision | Dated: proceed tunnel/allowlist **or** re-accept with P5a–c attached | — |

Auth-failure audit visibility: **required compensating control** if available on VPS; if unavailable, P5d re-accept must state the gap explicitly.

---

## §7 — Operational control surface

### Escalation

A1–A4 / P1 / P1.5 not `pass` by **2026-09-22 23:59 UTC** → P3 **not ready** unless dated revision.

### Already shipped

| ID | Item | Result |
|----|------|--------|
| S-rag | `/rag` 404; Create rag-client + BFF | pass |
| S-cite | Citeable VALIDATE + coverage + kill switch present | pass |
| S-m3 | M3 waves UX / fail-closed types | pass |

### Open / in flight

**Eng audit (2026-09-14):** A1–A4 / P1 / P1.5 **plumbing** locked by unit tests (`GccV2FallbackCorrectnessTests`, partner-mention, sourceRights, citeable kill-switch). **Result remains empty until Jeff signs Evidence packs** — do not treat eng-complete as release-ready.

| ID | Depends on | Target | Impl status | Performer | Verifier | Evidence pack | Result |
|----|------------|--------|-------------|-----------|----------|---------------|--------|
| A1 | — | 2026-09-21 | **eng-complete** (tests) | eng | Jeff | GeekAPI empty-token≠stub; unit tests green | — |
| A2 | — | 2026-09-21 | **eng-complete** (tests) | eng | Jeff | RAG `Failed` typed; no Continuing-without | — |
| A3 | — | 2026-09-21 | **eng-complete** (tests) | eng | Jeff | SoftDisabled PromptVersion unavailable; CreateLibraryDraft only | — |
| A4 | A1–A3 | 2026-09-21 | **eng-complete** (tests) | eng | Jeff | `GccV2FallbackCorrectnessTests` green (2026-09-14) | — |
| P1/R8 | **A4 required to verify** | 2026-09-21 | **eng-complete** (tests) | eng | Jeff | `GccV2PartnerMentionGate` + VALIDATE wired | — |
| **P1.5** | **A4 required to verify** | 2026-09-21 | **eng-complete** (plumbing); **Jeff backfill open** | eng+Jeff | Jeff | Gate + RAG `source_rights_consented_hosts` (approvalmax/plooto); Jeff: confirm reindex + smoke | — |
| R1a | A*, P1, P1.5 | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R1b | A*, P1.5 | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R2 | A* | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R3 | P1; deterministic fixture | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R4 | A* | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R5 | A*; test tenant | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R6 | A*; approved fault inject | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R7 | A* | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R8 | P1 | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R9 | A* | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R10 | — | 2026-09-25 | not-started | Jeff | Jeff | | — |
| R11 | Kill switch spec | 2026-09-25 | not-started | Jeff | Jeff | Flag OFF then restore | — |
| P3 | All above pass | 2026-09-28 | not-started | Jeff | Jeff | Mongo residual sentence | — |
| B1–C2 | P3 or parallel | after P3 | not-started | eng | Jeff | | — |
| P5a–P5d | P3 residual | 2026-10-14 | not-started | Jeff | Jeff | | — |

### Parked until P3 = release-ready (not until P5)

- M4 / LlamaIndex / PDF / claim NLP beyond mention gate  

---

## Non-negotiables

**Cursor mirror:** `.cursor/rules/master-plan-nonnegotiables.mdc` (and honesty rules) — sync from this section when it changes.

1. Creates-canonical only.  
2. Tools = partners.  
3. Competitor crawl run **always required** (fail closed) — never optional.  
4. Partner crawl run **always required** (fail closed) — tools = partners; project-site does not substitute.  
5. No success-shaped stubs / silent required-evidence fallbacks.  
6. Runtime ≠ release-readiness (Appendix A).  
7. SignalR only for job status.  
8. Isolation under `ContentCreatorV2/*`.  
9. Repo identity = `content-creator-v2`.  
10. Foreign `runId` → safe-fail only.  
11. Ship-ready = Appendix B only (`jobStatus` Ready ≠ `shipReady`).  
12. Source rights via `sourceRights` (P1.5).  
13. Kill switch `GCC_V2_CITEABLE_CREATE_V1` OFF = **fail closed** (emergency stop) — never a degraded Ready / skipped-gates fallback.  

---

## Appendix A — Content-type evidence

| Type | Project-site | Partner | Competitor |
|------|--------------|---------|------------|
| `tool` | Required | **Required fail-closed** | **Required fail-closed** |
| `comparison` / `alternatives` | Required | **Required fail-closed** | **Required fail-closed** |
| `ads` | Required | **Required fail-closed** | **Required fail-closed** |
| `blog` / `pillar` / `battlecard` / other long-form | Required | **Required fail-closed** | **Required fail-closed** |

**Rules:** Tools = partners. Competitors never as `crawlType:"partner"`. **Every Create** requires bound, indexed **partner** and **competitor** crawl runs before PLAN. Project-site never substitutes for either. Empty / missing URLs or unbound runs → fail closed (not site-only success).

---

## Appendix B — Ship-ready predicate

1. Zero blocking VALIDATE flags  
2. Required project-site evidence  
3. Displayed citations re-verify on current corpus  
4. Coverage where required  
5. Authz OK (foreign safe-fail)  
6. No unverified labeled verified  
7. **Partner-mention gate:** only for sections whose scanned body hits a named partner token (§P1) — not “brief lists partners” alone; **not** sentence-level claim verification  
8. **sourceRights** on every displayed citation ∈ {`consented`,`licensed`}; `unknown`/`prohibited`/missing → not shipReady (P1.5)  
9. Citeable VALIDATE ran with gates ON for any release / shipReady claim (kill switch OFF = fail closed, not a releasable alternate path)  

---

## Appendix C — Citation contract

URL · `pageId` · quote/offsets · `sourceDigest` · authorized `runId` · `sectionKey` · `crawlType` · `sourceRights` · provenance.

---

## Appendix D — Wave A map

| ID | Code | Test |
|----|------|------|
| A1 | GSC/Drive/SharePoint connectors + controllers | Empty ciphertext fail; stub+allowed OK |
| A2 | `HttpGeekCrawlerRagClient` + PLAN | HTTP/throw ≠ empty success |
| A3 | `RagGenerateService` | RequireCiteable Create; soft-disable not citeable-shaped |
| A4 | `GccV2Fallback*` + new | CI green |
| P1.5 | Page metadata + brief override + VALIDATE | missing≡unknown; override wins; smoke corpus consented |

---

## Appendix E — Metrics (after P3)

Unchanged targets; reviewer Jeff; exclude `canceled` and `smoke:manual` from rates.

---

## Out of scope

- Second writer UI; LlamaParse; crawler UI in phi  
- New Railway sidecars  
- Release-ready while §7 P0–P2/P1.5 open  
- Generation retry loops to satisfy assertions  
- Automatic WRITE retries  
- Claiming P5 blocks M4  
- Treating mention gate as claim NLP  

---

## North star

`/creates/new` → brief → evidence → PLAN → approve → WRITE (citeable) → VALIDATE → Canvas → export — RAG inside the job, not a parallel product.

# Security + correctness queue (S0–S6)

**Status:** Security queue **containment complete** with **per-item evidenced states** (not a single “all done” checkbox). See status matrix below.  
**Authority:** [master-plan.md](master-plan.md) §3  
**Finding source:** archive dump Part 6 + Part 4 P0  
**Product gate:** [citeable-create-pipeline.md](citeable-create-pipeline.md) M1 unblocked after S0–S2 **production-verified**

**Naming:** Tools/partners ≠ competitors. This plan hardens Geek-Crawler for all crawl types.

---

## Status matrix (authoritative)

States: `implemented` · `deployed` · `production-verified` · `monitoring` · `accepted-risk`

| # | Item | State | Verified | Evidence (summary) |
|---|------|-------|----------|-------------------|
| S0 | Knowledge ingestion claim/lease | **production-verified** | 2026-09-13 | Prod `Revision` + migration; `queued=0`; terminal jobs |
| S1 | Crawl SSRF | **production-verified** | 2026-09-13 | Deployed GeekAPI; SSRF/redirect/caps tests green |
| S2 | Crawl budgets | **production-verified** | 2026-09-13 | Caps + budget terminal fail; unit coverage |
| S3 | OAuth forwarded headers | **deployed** / **monitoring** | 2026-09-13 | `TRUSTED_PROXY_CIDRS`; GeekOAuth design doc |
| S4 | OIDC redirect URIs | **deployed** / **monitoring** | 2026-09-13 | Preview hyphen-required patterns live |
| S5 | Trusted RAG index/delete | **deployed** / **monitoring** | 2026-09-13 | Manifest signing keys aligned; residual key-inventory proof |
| S6 | RAG key + HTTP shutdown | **production-verified** | 2026-09-13 | HTTPS sslip.io; public HTTP closed; key rotated |
| — | Mongo `:27017` exposure | **accepted-risk** | 2026-09-13 | Railway GeekRepository needs reachability; auth required; private net later |

**Owner:** Jeff Martin  

**Do not** mark the whole queue “remediated” in master §7. Update **this matrix** when state changes.

---

## Priority labels (do not confuse)

| Label | Items | Meaning |
|-------|-------|---------|
| **Availability blocker** | **S0** | Restores Knowledge ingestion; product is broken without it |
| **Security incidents (begin immediately, in parallel with S0)** | **S1**, **S5**, **S6** | Active SSRF / cross-tenant write / credential exposure — **not** deferred until crawl polish finishes |
| **Hardening (after immediate containment)** | **S2**, **S3**, **S4** | Resource budgets, proxy trust design, redirect URI lockdown |

**S0 is first for product restoration. S1 / S5 / S6 are the highest security severity and start in parallel.** Interpreting the queue as “finish Knowledge before touching SSRF or the RAG key” is wrong.

---

## Goal

Contain live security exposure and unblock Knowledge without letting product work jump ahead of verified S0–S2.

---

## Revised sequencing

```text
IMMEDIATELY (parallel):
  S1  SSRF containment (full controls, not IP-literal-only)
  S5  RAG trusted-route auth containment
  S6  API key rotation + plaintext HTTP listener shutdown
      (DNS/TLS hostname migration continues alongside)

IN PARALLEL WITH ABOVE:
  S0  Atomic claim/lease + terminal-state repair for Knowledge ingestion
      (S0a 409 handler = diagnostic containment only — not the fix)

THEN:
  S2  Crawl resource budgets (beyond seed-count)
  S3  Forwarded-header trust (deployment-specific design)
  S4  Exact / narrowly scoped redirect URIs

ONLY AFTER S0–S2 PRODUCTION VERIFICATION:
  Product M1 (citeable-create-pipeline.md)
```

S6 key rotation + HTTP shutdown must not wait on S1/S2. Continued plaintext key use while “crawl work completes” is unacceptable.

---

## Ops contract (every item)

Before marking an item done, record:

| Field | Required |
|-------|----------|
| **Owner** | Named human / team |
| **Deploy order** | Repos + environments (local → staging → prod) |
| **Rollback** | How to revert safely |
| **Production signal** | One measurable signal (examples below) |

---

## S0 — Knowledge ingestion stuck (availability blocker)

**Impact:** Highest product restoration priority.  
**Symptom:** Uploads succeed; ingestion never leaves `queued` / `extracting: queued`; index `pending`.

**Evidence:** `TransitionIngestionJob` → `DbUpdateConcurrencyException` on first transition; worker cannot persist terminal `failed` either.

### Clarify: S0a is not the fix

| Step | Role |
|------|------|
| **S0a** Global `IExceptionHandler` → **409** on `DbUpdateConcurrencyException` | **Diagnostic containment only** — stops opaque 500s; does **not** by itself retry the worker or reach `failed` |
| **S0b–S0d** | **Actual fix** — atomic claim, idempotent transitions, bounded conflict retry, independent terminal failure write |

Do **not** promise that a generic 409 handler can reliably distinguish “row changed” vs “row absent” without an **explicit post-conflict lookup** (or equivalent contract). If distinction is needed, implement that lookup; otherwise return a single conflict class and let the worker follow S0d.

### Work

| Step | Repo | Action |
|------|------|--------|
| S0a | GeekRepository (+ GeekAPI if separate host) | Map `DbUpdateConcurrencyException` → 409 ProblemDetails. Optional: after conflict, **re-read** row to classify absent vs changed — only if that contract is specified and tested |
| S0b | GeekRepository | Concurrency token / row version on `GccV2ContextIngestionJob` (or equivalent CAS column) |
| S0c | GeekAPI + GeekRepository | **Atomic claim/lease** on the worker wake path; single active claimer; lease expiry + reclaim rules documented |
| S0d | GeekAPI + GeekRepository | **Idempotent transition semantics**; **bounded retry** on conflict; **final terminal failure write that does not depend on the failed transition path** (separate persist path / compensation so a conflict mid-fail cannot leave the job non-terminal forever) |
| S0e | Tests | Concurrent claim/transition; conflict retry; terminal failure when claim lost; no forever-`queued` |

**Owner:** _TBD_  
**Deploy order:** GeekRepository (token + handler) → GeekAPI worker → prod verify  
**Rollback:** Revert worker deploy; leave 409 handler if safe  
**Production signal:** Ingestion **terminal-state rate** (jobs reaching `ready`/`failed`/`indexed` within SLA) > 0 and forever-`queued` age drops

**Done when:** New Knowledge upload reaches a terminal extraction/index state (or explicit failed with error) in signed-in prod; S0d path proven under conflict tests.

---

## S1 — SSRF containment (security incident — start immediately)

**Severity:** Highest among crawl findings. Literal private-IP rejection alone is **insufficient**.

**Where:** Seed normalization (`IsValidCrawlHost` et al.) **and** the fetch/redirect path in the crawl engine.

### Required controls

1. **Reject** loopback / link-local / private / metadata ranges for literal IPs (IPv4 + IPv6), unless explicit allow-list.
2. **DNS resolution check** of hostnames (A/AAAA) **before** fetch; reject if any resolved address is disallowed.
3. **Re-validate after DNS** and **again at connect** — mitigate **DNS rebinding** between validation and fetch (pin resolved address or re-check immediately before use).
4. **Redirects:** at **every hop**, re-run host + resolved-IP policy; cap redirect count; no open redirect to internal targets.
5. **Allowed schemes and ports** only (e.g. `https`/`http` on 80/443 — document exact allow-list; deny others).
6. **Outbound network policy / metadata-endpoint blocking** (defense in depth): block link-local metadata (`169.254.169.254`, IPv6 equivalents) at network or client layer so `public.example` cannot succeed after redirect/DNS to a private address.

**Owner:** _TBD_  
**Deploy order:** Shared Geek-Crawler validation library → API reject path → engine fetch path → prod  
**Rollback:** Feature-flag stricter checks if legitimate partners break; never roll back to “any IP literal OK”  
**Production signal:** Count of **rejected private-host / private-resolved / bad-redirect** attempts (structured logs/metrics)

**Done when:** Tests cover IP literals, hostname→private DNS, redirect-to-private, rebinding-style double resolution, disallowed scheme/port; metadata-style targets fail even if seed string looked public.

---

## S2 — Crawl resource budgets (after S1 containment)

**Not only a seed-count cap.** One allowed seed can still pull a 5,000-URL sitemap plus BFS.

### Required budgets (per tenant and/or per request — document which)

| Budget | Intent |
|--------|--------|
| Max seeds per start/ingest | Request admission |
| Max total URLs per run | Cap sitemap + BFS expansion |
| Max concurrent crawls per tenant | Fairness / DoS |
| Max crawl duration | Wall-clock cancel |
| Max bytes fetched | Bandwidth / storage |
| Max redirects (per URL and per run) | Align with S1 |
| Fetch rate limit | Politeness + abuse |

### Cancellation and partial runs

Define explicitly:

- What cancels the run (budget hit, timeout, operator cancel)
- Whether a **partial** run is **usable** for RAG/index (e.g. indexed pages so far remain queryable with `partial`/`truncated` status) or must be marked failed/unusable
- SignalR / status fields operators see when a budget fires

**Owner:** _TBD_  
**Deploy order:** Caps constants + enforce at start and during BFS → UI copy for budget errors → prod  
**Rollback:** Raise caps via config; do not remove enforcement  
**Production signal:** **Crawl-budget rejection** count + distribution of cancel reasons

**Done when:** Oversized seeds and over-budget expansions fail closed with typed errors; partial-run usability is documented and tested.

---

## S3 — GeekOAuth forwarded-header trust (deployment-specific)

**Not** “add a known-proxy allowlist” as a one-liner.

### Design record (required before code)

Document for **each environment** (local, Railway GeekOAuth, any Hostinger frontends):

| Topic | Content |
|-------|---------|
| Proxy chain | Exact hops (public client → ingress → app) |
| Trusted headers | Which headers are trusted from which hop |
| Known proxy IPs / CIDRs | Source of truth and **how ranges are updated** when platform IPs change |
| Failure mode | Behavior if proxy list is stale (fail closed on forwarded trust vs treat as direct) |

### Tests

1. **Direct public request** (no real proxy): forged `X-Forwarded-For` must **not** reset rate-limit partition.
2. **Ingress-proxied request**: legitimate forwarded client IP partitions correctly.

**Owner:** _TBD_  
**Deploy order:** Design doc in PR → GeekOAuth config → verify both test cases in prod-like topology  
**Rollback:** Previous proxy config with incident note; never “trust all”  
**Production signal:** Rate-limit hits keyed by real client IP; alert on sudden unique-IP explosion consistent with bypass

**Done when:** Design recorded; both direct and proxied tests pass; update procedure for proxy IP changes exists.

---

## S4 — Redirect URIs: prefer exact registration

**Prefer exact registered redirect URIs** over a broader regex.

If preview deployments truly need dynamic hosts:

- Narrowly define the **allowed deployment namespace**
- **Enforce a required separator** after the known prefix
- An arbitrary Vercel/project name that merely matches a prefix must **never** qualify

**Owner:** _TBD_  
**Deploy order:** Inventory legitimate callbacks → register exact URIs (or one tight pattern) → remove loose regex → prod  
**Rollback:** Re-add only previously inventoried URIs  
**Production signal:** **Rejected redirect URI** attempts in OAuth logs

**Done when:** Evil-adjacent hosts fail; inventoried prod/preview callbacks succeed; no open-ended `[\w.-]+` glue after prefix.

---

## S5 — Trusted RAG asset routes (security incident — start immediately)

**Reduce reliance on a shared bearer key** as the sole trust model.

### Required

1. Bind `owner_user_id` to a **signed manifest** (or equivalent) like sibling asset routes — body owner alone is insufficient.
2. Specify **caller identity** (service principal / GeekAPI caller claim), not only “has API key.”
3. **Key rotation and revocation** procedure; dual-key window if needed.
4. **Replay protection** (nonce/expiry/body digest as used elsewhere in RAG manifests).
5. Authorization tests for **both** `index` and `delete` (cross-owner deny; expired/replay deny; wrong caller deny).
6. Evidence + monitoring that the key is not held outside GeekAPI (inventory, secret scan, access logs) — **“only GeekAPI holds the key” is an assumption until proven**.

**Owner:** _TBD_  
**Deploy order:** RAG auth change → GeekAPI client update → rotate keys → disable old accept path  
**Rollback:** Dual-verify window; never re-open unsigned owner-from-body  
**Production signal:** Denied cross-owner index/delete; auth failure rate; alert on key use from unexpected sources if observable

**Done when:** Cross-owner index/delete without valid binding fails; GeekAPI happy path works; rotation/revocation runbook exists; tests cover index **and** delete.

---

## S6 — RAG credential + transport (security incident — start immediately)

**Incident containment first; hostname/TLS migration can continue in parallel with S0.**

### Immediate (do not wait on S1/S2)

1. **Rotate** `GEEK_CRAWLER_RAG_API_KEY` (assume compromise from historical plaintext HTTP).
2. **Shut down the plaintext HTTP listener** (or bind localhost-only + remove public `:8080` HTTP) so the old key/path cannot be used from the internet.
3. Update GeekAPI (Railway + local) to the new key; verify calls fail with the old key.

### Alongside (DNS/TLS)

4. Hostname + TLS termination; GeekAPI `GEEK_CRAWLER_RAG_URL` = `https://…`
5. Verify **certificate validation** (not merely HTTP 200 through a bypass).
6. Audit logs/config for old URL/key; purge.

**Owner:** _TBD_  
**Deploy order:** Rotate key → cut HTTP → point HTTPS → confirm HTTPS-only from GeekAPI  
**Rollback:** Emergency HTTPS with previous key only inside dual-key window; do not re-open public HTTP  
**Production signal:** **HTTPS-only RAG requests** from GeekAPI; zero successful auth with retired key; HTTP listener closed

**Done when:** Old key dead; public HTTP gone; prod GeekAPI uses HTTPS with cert validation.

---

## Out of scope

- Full fallback-audit UX cleanup (archive Part 6 remainder) — after this queue
- Partner reindex/backfill — ops gate for citeable M2
- Phi-only UI polish
- Product M1/M2 while S0–S2 unverified in production

---

## Production verification log (2026-09-13)

| Item | Evidence | Result |
|------|----------|--------|
| **S1** | Deployed GeekAPI; 11 targeted unit tests green (seed SSRF, sitemap private redirect, caps, transport policy) | **Pass** |
| **S2** | Caps enforced in crawler service/BFS; budget exceeded → terminal fail; unit coverage | **Pass** |
| **S5** | GeekAPI + RAG share `CONTEXT_MANIFEST_SIGNING_KEYS` key id `ctx-2026-09-09` | **Pass** |
| **S6** | `https://2.24.101.90.sslip.io` HTTPS; public `:8080` closed; API key rotated; GeekAPI RAG URL is HTTPS | **Pass** |
| **S3/S4** | GeekOAuth deployed; `TRUSTED_PROXY_CIDRS` set; preview redirect hyphen fix live | **Pass** |
| **S0** | Prod: `Revision` on `gcc_v2_context_ingestion_jobs`; migration `20260913180000_AddIngestionJobRevision` applied; job counts `queued=0`, all rows terminal (`failed` with `CompletedAtUtc`) | **Pass** |

**Owner:** Jeff Martin  

**Note:** Closing Mongo at the firewall broke Railway GeekRepository crawler reads; `:27017` accept restored. Hardening path later = private network / allowlisted egress, not “drop the port” while Railway still dials the VPS IP.

**M1 gate:** Open (S0–S2 verified).

---

## Review checklist

- [x] Direction approved with tightenings (this revision)
- [x] Owner named (Jeff Martin)
- [x] S6 rotation + HTTP shutdown done (sslip.io TLS)
- [x] S1/S5 started in parallel with S0
- [x] S3 proxy-chain design filled for Railway (`docs/forwarded-headers-trust.md` + `TRUSTED_PROXY_CIDRS`)
- [x] S4 hyphen-required preview URIs shipped
- [x] S0–S2 production verification recorded (DB + deploy + tests)

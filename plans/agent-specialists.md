# Agent specialists per content type

**Status:** proposal for review. Supersedes nothing; complements `plans/rag-foundation-rewrite.md`.

## §0. Context — what happened

The goal was a roster of specialist agents, one per kind of content, selectable per job — the Jasper
model. What exists instead is **four stage-roles on a single long-form pipeline**:

| Agent | Role | Skill | Stages |
|---|---|---|---|
| `writing` | producer | `citation-discipline` | all |
| `marketing` | contributor + reviewer | `brand-voice` | plan/outline/section/synthesis, review at validate |
| `seo` | contributor + reviewer | `seo-fundamentals` | same |
| `aeo` | contributor + reviewer | `geo-direct-answer` | same |

Source: `GeekBackend/GeekAPI/Services/ContentCreatorV2/Generation/GccV2FirstPartyAgentSeeder.cs:80–114`.

These four collaborate on *one* article. They are not per-type specialists — there is exactly one
producer, and it produces everything.

**Everything downstream follows from that gap.** With no per-type producer:
- **Grid** became the way to get volume — run the same two capabilities across twelve rows.
- **Canvas Projects** became the place to file output, and its `AssetKind`
  (`brief | article | social | image | email | report`) is the per-type idea — but only as a label.
  Nothing reads `AssetKind` and dispatches a producer.
- The two capabilities those features can reach (`faq-generator`, `pillar-outline`) route to RAG's
  deterministic `content.py`, so **no model is invoked at all** on that path.

Grid and Canvas Projects are being removed. This plan builds what they were compensating for.

## §1. What already exists — do not rebuild

The machinery is largely present. This is a content and wiring problem, not an infrastructure one.

- **Agent catalog with lifecycle** — authored `instructions`, semantic versioning, security scanning
  (`findings`), contract + rag-smoke tests, `draft → in_review → approved → published → deprecated`.
  Authored at `/agents/admin` (`src/app/agents/admin/agent-admin-client.tsx`), contract in
  `src/app/agents/agent-contract.ts`.
- **Per-type applicability already modelled** — `AgentSummary.supportedContentTypes`, and
  `isCompatibleAgent(agent, primaryContentType)` (`agent-contract.ts:368`) already filters the picker
  by primary format. `formatsCoveredBy` / `formatsSkippedBy` already explain coverage to the operator.
- **Per-type team resolution** — each job resolves the applicable subset of the pinned selection for
  its own content type (`GccV2AgentTeams`), so a specialist that does not apply to an Also-draft is
  dropped for that job rather than failing the create.
- **Pinned, auditable selection** — `selectedAgentIds` on the create, resolved to
  `AgentTeamProvenance` with `snapshotDigest`, members, and handoffs (`rag-contract.ts:128`).
- **Ten skills with per-content-type applicability** and five bundles
  (`GccV2SkillCatalog.cs:72–148`):
  `citation-discipline`, `brand-voice`, `seo-fundamentals`, `geo-direct-answer`,
  `comparison-evidence`, `case-study-proof`, `technical-depth`, `linkedin-document-structure`,
  `anti-repetition`, `cta-alignment`.
  Bundles: `search-growth`, `technical-authority`, `competitive-decision`, `proof-story`,
  `linkedin-education`.
- **A real LLM execution path** — `GccV2StudioLlmExecutor` → `IContentProviderFactory` →
  `provider.CompleteAsync` on o3/o1-pro. Studio agents already run this way.

## §2. The gap, stated precisely

1. **One producer for seventeen content types.** `writing` owns every format.
2. **Short-form has no skills at all.** Every skill in the catalog targets long-form. `email`,
   `social`, `ads` and `image-prompt` have no craft rules — nothing about sequence structure, hooks,
   variation discipline, or composition.
3. **Nothing dispatches by content type at Create time.** The plumbing exists
   (`supportedContentTypes`, `isCompatibleAgent`); the roster to select from does not.

## §3. The specialist model

Two agent classes, both already supported by the catalog:

- **Producers** — exactly one per job, owns the draft for its formats. Declares
  `supportedContentTypes`. Participates as `producer` across all stages.
- **Reviewers/contributors** — cross-cutting quality specialists that ride along where applicable,
  contributing at plan/outline/section/synthesis and reviewing at validation/complete.

This preserves the existing producer rule (exactly one producer supporting the primary type) and the
existing per-job subsetting, so no resolution logic changes.

## §4. Proposed roster — 11 producers, 4 reviewers

Producers group by **craft**, not 1:1 per type — formats sharing a craft share a specialist.

| # | Producer | `supportedContentTypes` | Skills |
|---|---|---|---|
| 1 | Article | `blog`, `guide`, `listicle` | search-growth bundle |
| 2 | Technical Article | `tech-article` | technical-authority bundle |
| 3 | Pillar | `pillar`, `whitepaper` | search-growth + technical-depth |
| 4 | Comparison | `comparison`, `alternatives` | competitive-decision bundle |
| 5 | Case Study | `case-study` | proof-story bundle |
| 6 | Tool Page | `tool` | citation-discipline, brand-voice, seo-fundamentals, cta-alignment |
| 7 | Service & Local | `service`, `local` | seo-fundamentals, cta-alignment, brand-voice |
| 8 | Email | `email` | **new** `email-sequence-structure` + brand-voice, cta-alignment |
| 9 | Social | `social` | **new** `social-hook-structure` + brand-voice |
| 10 | Ads | `ads` | **new** `ad-variation-discipline` + brand-voice, cta-alignment |
| 11 | Image Prompt | `image-prompt` | **new** `image-prompt-composition` |
| 12 | PDF / Carousel | `linkedin-document` | linkedin-education bundle |

Twelve producers covering all seventeen types, with no type unowned.

Reviewers — keep the three that exist, add one:

| Reviewer | Role | Skill |
|---|---|---|
| Marketing | contributor + reviewer | `brand-voice` |
| SEO | contributor + reviewer | `seo-fundamentals` |
| AEO | contributor + reviewer | `geo-direct-answer` |
| **Claims & Disclosure** *(new)* | reviewer | **new** `claim-and-disclosure-discipline` |

The new reviewer is the natural owner of work already landed in the rewrite: competitor
`ClaimRiskFlags` must not be echoed as fact, partner mentions need a verified citation, and affiliate
disclosures must carry a jurisdiction. Today those are gates with no agent accountable for them.

`writing` is retired — its formats are covered by producers 1–3.

**Retiring it breaks re-runs of creates that pinned it, and deprecating does not avoid that.**
Resolution queries only published agents and throws otherwise
(`GccV2AgentTeams.cs:123`, `:134` — *"Every selected specialist version must be published and
applicable."*). A deprecated agent is excluded from that query, so deprecate and delete behave
identically here. Only creates that need to re-run are affected; finished creates keep their output
and their `AgentTeamProvenance` snapshot.

Three options, decide before W2:
1. **Keep `writing` published** — old creates resolve. Needs a legacy/hidden flag, since
   `isCompatibleAgent` (`agent-contract.ts:368`) surfaces any published agent in the picker.
2. **Migrate** `selectedAgentIds` to the matching new producer — clean, but breaks the pinning
   guarantee: a re-run would use instructions the operator never reviewed.
3. **Accept the break** — in-flight creates pinned to `writing` must be re-created.

Pre-release with nothing shipped, (3) is the recommendation: the pinning guarantee is worth more than
in-flight creates.

## §4.5 Precondition — strip the governance ceremony

Create cannot lose the agent layer: `GccV2JobWorker.ProcessJobAsync` calls
`teamResolver.ValidatePersisted(claimed)` on every job before any stage runs. So this is a
refactor, not a deletion.

What stays is the **concept**: an agent is a named specialist with instructions and a list of content
types it owns. What goes is the **change-control ceremony** built around it — enterprise governance
for a tool with four agents and no shipped content. It is the reason retiring one agent turned into a
three-way trade-off about breaking in-flight creates.

### Target model

```
Agent = id · slug · name · description · instructions
      · supportedContentTypes[] · role(producer|contributor|reviewer) · stageParticipation[]
```

Selection stores the **agent id**, not a version id. Retiring an agent is deleting a row.

### Delete

| Concern | Surface |
|---|---|
| Version pinning | `GccV2AgentVersion`, `GccV2JobAgentVersion`, `selectedAgentIds` as version ids |
| Publish lifecycle | `draft → in_review → approved → published → deprecated → revoked` |
| Security scanning | `GccV2AgentReviewFinding`, `GccV2SkillReviewFinding`, blocking findings |
| Agent tests | `GccV2AgentTestRun`, `AgentTests/`, contract + rag-smoke executors, test hub |
| Signed snapshots | `snapshotDigest`, signing key, `GccV2SkillSnapshots` (415 lines) |
| Audit events | `GccV2AgentAuditEvent`, `GccV2SkillAuditEvent` |
| Skills as packages | `GccV2SkillPackage/Version/File/Applicability` + `GccV2SkillGovernance` (280), `GccV2SkillCatalog` (287), `GccV2AgenticSkillsResolver` (131), `GccV2SkillApiMapper` (118) |

Fourteen DB tables collapse to two: `GccV2Agents` and `GccV2AgentStageParticipations`.

### Skills fold into instructions

The ten skills are craft rules — `citation-discipline`, `seo-fundamentals`, `comparison-evidence` and
so on. As a separately versioned, digest-pinned package layer they add ceremony without adding
capability. **Their text moves into the owning agent's `instructions`.** A producer's instructions
then state its craft directly, which is also what makes §5's new short-form rules trivial to add —
they become paragraphs, not new package versions.

Bundles (`search-growth`, `technical-authority`, …) disappear as a concept; each producer simply
carries the rules it needs.

### Order of work

1. Collapse the agent model — drop versions; agent becomes the unit; selection stores agent ids.
2. Fold skill text into agent instructions; delete the skill package layer.
3. Delete lifecycle, scanning, test runs, snapshots, audit events.
4. Simplify `/agents/admin` to name + instructions + content types + role.
5. Reseed the §4 roster against the simplified model.

Each step must leave the build green and `ValidatePersisted` satisfied — Create keeps drafting
throughout.

## §5. New skills required

Five, authored in the same shape as `GccV2SkillCatalog.Definitions` (guidance, evidence preference,
structure rule, review check) with `supportedContentTypes` scoped to their formats:

- `email-sequence-structure` — single-purpose emails, one ask, subject/preview discipline, sequence
  position awareness.
- `social-hook-structure` — first-line hook, platform length, no listicle sprawl, one idea per post.
- `ad-variation-discipline` — generate distinct angles rather than reworded duplicates; keep every
  claim inside evidence; respect platform character limits.
- `image-prompt-composition` — subject, composition, style, negative constraints; never invent brand
  marks or real people.
- `claim-and-disclosure-discipline` — never echo rival claim-risk text as verified fact; require a
  verified citation for any named partner; surface affiliate disclosure with its jurisdiction.

## §6. Work

**W1 — Author the five new skills.** `GccV2SkillCatalog.Definitions`, each with a published version
and content-type applicability. Digests are computed as for existing entries.

**W2 — Seed the roster.** Extend `GccV2FirstPartyAgentSeeder.Definitions` from four entries to the
twelve producers plus four reviewers. Keep `Build(...)`'s stage-participation shape: producers across
all stages; reviewers contributing then reviewing. Bump seeded version to `2.0.0` — this is a
breaking roster change. Deprecate `writing` rather than removing it.

**W3 — Verify dispatch end to end.** No new resolution code should be needed. Confirm that selecting
`email` as primary surfaces the Email producer and not the Article producer, that Also-drafts resolve
their own applicable subset, and that exactly one producer is resolved per job.

**W4 — Operator-facing copy.** The Outputs step already explains coverage via `formatsCoveredBy` /
`formatsSkippedBy`. Update the wording so a roster of twelve producers reads as a choice of
specialist rather than a list of toggles.

**W5 — Fill the short-form writer paths.** `GccV2WriteService` already has
`WriteRagCompleteAsync("email-body")`, `("social-post")`, `("ads-body")`. Confirm each honours its new
producer's instructions and skills rather than falling back to long-form behaviour.

## §7. Out of scope

- Grid and Canvas Projects — being removed separately; nothing here depends on them.
- RAG `content.py` — the deterministic capability path loses its callers with Grid/Canvas; no
  specialist should ever route through it. Specialists run on the GeekAPI provider path.
- Studio agents — user-authored agents keep their existing execution path unchanged.

## §8. Verification

1. Seeder tests: twelve producers and four reviewers published; every content type in `CONTENT_TYPES`
   has exactly one applicable producer; no type is unowned.
2. Compatibility: `isCompatibleAgent(emailProducer, "email")` true, `"pillar"` false; the reverse for
   the Pillar producer.
3. Resolution: pinning Article + SEO + AEO with primary `blog` and Also-draft `email` resolves
   SEO/AEO onto the blog job and the Email producer onto the email job, with no throw.
4. Governance unchanged: each seeded agent passes security scan and contract test before publish.
5. **Acceptance bar** — generate one `email` and one `social` piece and read them. They must be
   recognisably short-form, not a long-form article trimmed. A passing suite is a baseline, not the
   gate.

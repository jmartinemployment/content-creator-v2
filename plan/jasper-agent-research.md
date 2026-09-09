# Jasper Agent Research

**Research date:** September 9, 2026  
**Purpose:** Document Jasper's observable agent capabilities and product patterns to inform Content Creator development.  
**Scope:** Competitor Audit, Competitive Response, Competitor Positioning, Gap Finder, AI Readiness Comparison, Entity Mapper, AI Readiness Score, Fact Density Audit, Schema Markup, Comparison Brief, Query Planner, Citable Claims, FAQ Generator, Pillar Article, and Custom Agent.

## Executive summary

All fourteen named purpose-built agents are present in Jasper's official public Agent Library. Custom Agent is not one fixed agent; it is a configurable application created in Jasper Studio.

Jasper presents these capabilities as task-specific marketing applications, not personalities in a multi-agent team picker. A user chooses a job, completes structured inputs, runs it, receives a purpose-specific artifact, and may pass that artifact into Canvas, Grid, or another agent.

Jasper groups the named GEO/AEO capabilities into three broad workflows:

- **Originate:** identify opportunities and create net-new content.
- **Optimize:** audit and improve existing content.
- **Outrank:** understand competitor advantages and produce a response.

The reusable product pattern is:

1. Discover an agent by desired outcome.
2. Complete a schema-driven form.
3. Apply shared brand, audience, style, and knowledge context.
4. Run a durable task with visible progress.
5. Inspect an output-specific result such as a scorecard, findings report, brief, document, entity map, or JSON-LD.
6. Edit, rerun, save, attach to a project, or launch a compatible follow-on agent.

This differs materially from the current Content Creator implementation. Content Creator has a strong governed specialist-team runtime, but its user-facing agents are broad Writing, Marketing, SEO, and AEO roles. Most of the Jasper-like capabilities require first-class task contracts, independent durable runs, typed artifacts, and dedicated result views.

## Evidence limitations

The following boundaries are important:

- Jasper's public pages verify product names, broad purposes, workflow groupings, and output classes.
- Public pages generally do not expose the exact logged-in input forms, prompts, scoring formulas, model routing, data providers, or evaluation thresholds.
- Claims such as "real query data," "validated JSON-LD," and factors that "AI engines use to select sources" are Jasper product claims. The public methodology is insufficient to validate them independently.
- Five Jasper detail-page URLs are currently cross-wired:
  - `/agents/gap-finder` describes AI Readiness Comparison.
  - `/agents/ai-readiness-comparison` describes Gap Finder.
  - `/agents/competitor-positioning` describes Competitor Audit.
  - `/agents/competitor-audit` describes Competitive Response.
  - `/agents/competitive-response` describes Competitor Positioning.
- The main Agent Library is therefore the safer source for canonical names. The mismatched detail pages remain useful only for broad workflow descriptions.
- Jasper's marketing pages imply that many specialized agents operate at scale in Grid. Current Grid Help documentation explicitly lists Translation, Research, and Optimization as directly selectable workflow-agent columns. The specialized agents may run inside broader workflows or may not be available identically in every account.

## Shared Jasper platform components

### Agent Library

Jasper describes agents as purpose-built applications for structured marketing jobs. The library supports discovery by:

- Marketing function.
- Content type.
- Funnel stage.
- Content process.
- Favorites.
- Recently used agents.
- Personal saved configurations.
- Public, workspace, and custom agents.

The key product decision is that users browse outcomes such as "audit fact density" or "create a comparison brief," not abstract agent roles.

Source: [Agent Library](https://help.jasper.ai/hc/en-us/articles/30482508933403-Agent-Library)

### Structured agent inputs

Jasper's API and Studio documentation expose a schema-driven input model:

- Short text.
- Long text.
- Select.
- Multiselect or checkboxes.
- Tags.
- Knowledge picker or file attachment.
- Required or optional fields.
- Default values.
- Reorderable fields.
- Optional LLM-generated suggestions.

The API can return task context-item definitions including IDs, labels/questions, types, options, required state, and tooltips. This is stronger evidence for Jasper's architecture than trying to infer forms from screenshots.

Sources:

- [Using Agents API](https://developers.jasper.ai/docs/using-agents)
- [Jasper Studio](https://help.jasper.ai/hc/en-us/articles/36783295610395-Jasper-Studio)

### Jasper IQ

Jasper IQ is the shared context layer applied across agents and projects. Public documentation identifies:

- Brand Voice.
- Knowledge Base.
- Audiences.
- Style Guide.
- Visual Guidelines.
- Product and company knowledge.

This context is separate from task inputs. A task asks what work to perform; Jasper IQ controls how the organization should be represented.

Knowledge grounding improves consistency but is not independent factual verification.

### Canvas

Canvas is the single-project editing surface:

- Library-launched agents can open results in Canvas.
- Agent outputs become editable assets.
- Project-level context is inherited by assets.
- Users can invoke another agent against an existing asset.
- Selected text can be rewritten or optimized.
- Related assets can coexist in one project.

Source: [Jasper Canvas](https://help.jasper.ai/hc/en-us/articles/37817833127963-Jasper-Canvas)

### Grid

Grid is the structured bulk-execution surface:

- Rows represent items or targets.
- Columns hold inputs, processing steps, agents, or outputs.
- Outputs from earlier columns can feed later columns.
- Users can test a small sample before running the full dataset.
- CSV import and export support portfolio workflows.
- Runs can be scheduled.

Source: [Jasper Grid](https://help.jasper.ai/hc/en-us/articles/46746641765787-Jasper-Grid)

### Agent Snapshots

Jasper Agent Snapshots expose:

- The agent used.
- Original inputs.
- Settings.
- Attached context.
- A path to modify inputs and regenerate.

The documented snapshot has limitations: only the original generating user can view it, and inherited project context is not fully represented. Content Creator's existing signed snapshots and provenance can provide stronger reproducibility.

Source: [Agent Snapshots](https://help.jasper.ai/hc/en-us/articles/39657086973083-Agent-Snapshots)

### Studio and Custom Agents

Studio is a no-code agent builder. The observable workflow is:

1. Open Agent Library.
2. Select New Agent.
3. Describe the desired finished product.
4. Customize the generated definition.
5. Configure inputs and context.
6. Select a model and temperature.
7. Edit dynamic instructions.
8. Add an example output.
9. Test.
10. Publish privately or to the workspace.

Studio instructions can reference inputs and context dynamically. Up to ten permanent Knowledge Base items may be attached according to current documentation.

Source: [Jasper Studio](https://help.jasper.ai/hc/en-us/articles/36783295610395-Jasper-Studio)

### Governance

Jasper documents:

- Admin, Manager, Developer, and Member roles.
- Restrictions on workspace publication of custom agents.
- Controls over shared Brand Voice, Knowledge, Audience, Style Guide, and Visual Guidelines.
- Usage analytics.
- Workspace audit logs.
- AI-output audit capabilities on its product page.

Content Creator already exceeds some of this with immutable versions, skill scanning, hash pinning, signed snapshots, durable tests, explicit approval, deprecation, revocation, and detailed provenance.

Sources:

- [Governance](https://www.jasper.ai/governance)
- [Permission Settings](https://help.jasper.ai/hc/en-us/articles/34717759798683-Permission-Settings)

## Agent-by-agent findings

### 1. Competitor Audit Agent

**Workflow:** Outrank  
**Purpose:** Explain why competitors earn AI citations or visibility.

Observable analysis includes:

- Page architecture.
- Heading and answer structure.
- Entity coverage.
- Schema implementation.
- Content depth.
- Claim and factual signals.
- Query-level citation patterns.

Likely information sources are owned content, competitor pages, relevant queries, and observed citation context. Exact form fields are not public.

**Output:** A competitive-intelligence report with evidence, gaps, priorities, and recommended actions.

**Content Creator status:** Substantial primitives exist—competitor crawling, corpus retrieval, citations, comparison content, and battlecard support. A typed audit contract and normalized findings model are missing.

### 2. Competitive Response Agent

**Workflow:** Outrank  
**Purpose:** Convert a competitor win into brand-aligned response content.

Documented response modes include:

- A new page.
- Targeted changes to an existing page.
- A counter-narrative.

The output is intended to improve depth, direct answers, proof points, claim quality, and citation-friendly structure without copying the competitor.

**Output:** A cited draft or structured update plan.

**Content Creator status:** Existing writing, comparison evidence, brand context, validation, and repair can be reused. A response-strategy artifact and dedicated workflow are missing.

### 3. Competitor Positioning Agent

**Workflow:** Outrank  
**Purpose:** Analyze how AI systems describe competitors and identify narrative/perception gaps.

Observable analysis includes:

- Recurring attributes and phrases associated with competitors.
- Brand-versus-competitor positioning differences.
- Queries where competitor positioning is strongest.
- Opportunities to emphasize differentiated claims.

**Output:** A narrative map, perception gaps, target queries, content angles, and messaging strategy.

**Content Creator status:** Brand kit, competitor evidence, and Marketing-agent primitives exist. Durable AI-answer observations, positioning dimensions, and a positioning result model are missing.

Any implementation must preserve the model/engine, query, raw response, and observation date. Generated model opinions must not be presented as measured market perception.

### 4. Gap Finder Agent

**Workflow:** Outrank/Optimize  
**Purpose:** Identify specific reasons owned content is weaker than competing or cited content.

Documented gap types include:

- Missing structural elements.
- Weak heading hierarchy.
- Insufficient answer density.
- Missing entities.
- Missing schema.
- Weak claim types.
- Inadequate formatting.

**Output:** A prioritized High/Medium/Low remediation list.

**Content Creator status:** Existing validation reports document some page issues, but no cross-corpus structural/entity/claim coverage matrix exists.

### 5. AI Readiness Comparison Agent

**Workflow:** Optimize  
**Purpose:** Compare one owned page with up to four competitor pages under one AEO/GEO rubric.

**Output:** A side-by-side score matrix, dimension deltas, evidence, and prioritized fixes.

**Content Creator status:** Per-document SEO/GEO scoring exists. Competitor cohorts, shared rubric versioning, normalization, and comparison views are missing.

### 6. Entity Mapper Agent

**Workflow:** Optimize  
**Purpose:** Identify entities and relationships associated with a topic, then compare coverage with competitors.

Entity classes described by Jasper include:

- People.
- Brands.
- Products.
- Concepts.
- Topics.

**Output:** Present and missing entities, relationships, entity-enriched content recommendations, and internal-link suggestions.

**Content Creator status:** Target entity strings, chunk metadata filters, and retrieval themes exist. Canonical entities, aliases, typed relationships, confidence, evidence, and graph visualization are missing.

### 7. AI Readiness Score Agent

**Workflow:** Optimize  
**Input:** One page, URL, or draft.

Jasper states that the output is a 0–100 score across seven dimensions:

1. Heading hierarchy.
2. Answer-first structure.
3. FAQ presence.
4. Schema markup.
5. Fact density.
6. E-E-A-T indicators.
7. Technical performance such as crawlability and page speed.

**Output:** Overall score, seven sub-scores, explanations, and prioritized fixes.

**Content Creator status:** `GccV2GeoAnalyzer` and AI Visibility already produce heuristic SEO/GEO readiness. The current five checks are less comprehensive and are not competitor-calibrated.

The future score must be described as a versioned heuristic until it is validated against observed citation outcomes. A score cannot promise actual citations.

### 8. Fact Density Audit Agent

**Workflow:** Optimize  
**Purpose:** Measure specific, verifiable information versus vague or generalized prose.

Observable findings include:

- Page-level score.
- Section-level scores.
- Flagged weak sentences and paragraphs.
- Unsupported claims.
- Missing statistics, expert evidence, or concrete examples.
- Suggested stronger replacements.

**Output:** A fact-density report and grounded remediation suggestions.

**Content Creator status:** Citation verification, evidence coverage, unsupported-claim counts, and citeable-passage checks can be reused. There is no claim classifier, fact-density formula, section metric, or claim ledger.

The implementation must never invent statistics to increase apparent density.

### 9. Schema Markup Agent

**Workflow:** Optimize  
**Purpose:** Convert visible content into machine-readable JSON-LD.

Jasper publicly names support for:

- FAQ.
- Article.
- HowTo.
- Product.
- Other applicable schema types.

**Output:** Formatted JSON-LD described by Jasper as validated and ready for CMS insertion.

**Content Creator status:** JSON-LD generation exists for articles, blog posts, technical content, comparisons, and software applications. It is publishing infrastructure rather than an interactive agent. FAQPage and broader validation records are missing.

Validation should include syntax, schema shape, required fields, canonical URLs, and consistency between markup and visible content.

### 10. Comparison Brief Agent

**Workflow:** Originate  
**Purpose:** Create a credible but strategically brand-favorable brief for "X vs Y" and "best X for Y" content.

Observable dimensions include:

- Pricing.
- Features.
- Use cases.
- Decision factors.
- Ideal customer profiles.
- Differentiators.
- Positioning angles.
- Proof requirements.

**Output:** A structured brief for a human or downstream writing agent.

**Content Creator status:** Comparison content, competitor URLs, symmetric-evidence guidance, outlines, and battlecard support exist. A standalone brief contract and result view are missing.

### 11. Query Planner Agent

**Workflow:** Originate  
**Purpose:** Identify questions and prioritize content opportunities.

Jasper names three query classes:

- Category-defining: "What is X?"
- Best-in-category: "Best X for Y."
- Comparison: "X vs Y."

**Output:** A query map with content gaps, citation potential, competitive difficulty, priority, and recommended downstream content.

**Content Creator status:** The Python runtime has a typed `researchPlanning` stage and proposed-query output, but normal production does not consistently execute, persist, or approve it.

Each future query must record provenance:

- `observed`: captured from a named external or internal source.
- `imported`: supplied by an operator or connected dataset.
- `generatedHypothesis`: proposed by a model.

Only observed or imported queries should be described as real query intelligence.

### 12. Citable Claims Agent

**Workflow:** Originate/Optimize  
**Purpose:** Convert vague statements or source material into precise, attributable claims.

Jasper emphasizes:

- Quantifiable facts.
- Clear attribution.
- Expert positions.
- Specific sentence structure.
- Verifiability.

**Output:** Standalone claim statements intended for insertion into content.

**Content Creator status:** Full-page Markdown evidence loading, exact quote checks, source URLs, citations, and provenance already exist. A first-class claim-to-evidence ledger is missing.

Each generated claim should preserve:

- Exact claim text.
- Claim type.
- Attribution.
- Evidence references.
- Verification status.
- Confidence.
- Contradiction state.
- Intended insertion location.

### 13. FAQ Generator Agent

**Workflow:** Originate  
**Purpose:** Generate answer-first Q&A content based on query intelligence.

**Output:** Ready-to-publish FAQ pairs structured for later FAQ schema generation.

**Content Creator status:** PAA questions already become a People Also Ask section and validation can trigger FAQ repair. It is not a standalone capability and does not generate FAQPage JSON-LD.

The natural chain is:

`Query Planner → FAQ Generator → Schema Markup → AI Readiness Score`

### 14. Pillar Article Agent

**Workflow:** Originate  
**Purpose:** Produce a comprehensive long-form article that anchors a topic cluster.

Documented characteristics include:

- Broad and deep subtopic coverage.
- Answer-first architecture.
- Clear heading hierarchy.
- Fact density.
- E-E-A-T indicators.
- Links or relationships to supporting FAQs, comparisons, and explainers.

**Output:** Publication-ready pillar content plus topic-cluster context.

**Content Creator status:** The complete long-form pipeline already supports pillar content, research, outlines, sections, synthesis, citations, validation, repair, JSON-LD, and export. It should be exposed as a dedicated task application with a clearer input contract and supporting-content plan.

### 15. Custom Agent

**Workflow:** User-defined  
**Purpose:** Turn a company-specific marketing task into a reusable no-code application.

Documented configuration includes:

- Agent name and desired outcome.
- Structured inputs.
- Permanent knowledge attachments.
- Dynamic instructions referencing inputs/context.
- Model.
- Temperature.
- Example output.
- Private or workspace visibility.
- Test and publish workflow.

**Content Creator status:** Admins can already create, version, review, test, publish, deprecate, and revoke governed agents with pinned skills, tools, and models. The current interface exposes low-level implementation concepts and does not provide an end-user form builder, typed output design, examples, evaluation datasets, or private agents.

## Current Content Creator capability assessment

### Strong existing foundation

- Immutable agent and skill versions.
- Human review and publication lifecycle.
- Skill quarantine and scanning.
- Hash-pinned skill assignments.
- Signed team and skill snapshots.
- Contributor, producer, and reviewer roles.
- Typed specialist handoffs.
- Durable agent tests.
- Model and tool allowlists.
- Execution budgets.
- LlamaIndex FunctionAgent runtime.
- Partner and competitor RAG corpora.
- Full-page Markdown evidence.
- Exact quote verification.
- Staged outline, section, synthesis, validation, and repair.
- SEO/GEO readiness checks.
- JSON-LD generation.
- Canvas, citations, provenance, and publishing.

### Important structural gaps

- Current agents are broad specialists rather than task applications.
- Agent versions do not declare dynamic input or output schemas.
- There is no independent durable task-agent run model.
- Non-document artifacts are stored as generic stage JSON rather than queryable typed records.
- The runtime output union is centered on contributor, producer, and reviewer contracts.
- Exactly-one-producer team rules do not naturally model a standalone audit agent.
- No normalized competitor, criterion, benchmark, finding, query, entity, relationship, claim, or positioning records.
- No purpose-specific result renderers.
- No artifact compatibility or follow-on action system.
- No scheduled competitor/readiness diff workflow.
- No user-facing custom-agent form builder.

### Runtime gaps to correct before expansion

- The frontend and deployed backend must agree on the agent endpoints; an agent catalog failure must not block unrelated content creation.
- The `researchPlanning` stage should run and persist in normal production.
- Reviewer `changesRequired` and `rejected` decisions should gate output or trigger bounded repair.
- Backend and Python handling of the `complete` stage must agree.
- Runtime replay/idempotency protection should be durable across process restarts and replicas.

## Recommended product architecture

The recommended architecture preserves specialist teams internally but adds a separate task-agent application layer.

### Agent definition

Each immutable task-agent version should declare:

- Stable capability ID.
- Display name and outcome-oriented description.
- Workflow group.
- Marketing-function, content-type, funnel-stage, and process facets.
- Input schema.
- Output schema.
- Workflow definition.
- Context policy.
- Allowed tools and models.
- Assigned governed skill versions.
- Result renderer.
- Compatible upstream and downstream artifact types.
- Evaluation suite and release thresholds.
- Digests for every executable contract.

### Durable agent run

Each run should preserve:

- Agent and skill version pins.
- Validated user inputs.
- Brand/knowledge context manifest.
- Source and crawl manifests.
- Budget and model policy.
- Progress events.
- Typed output artifacts.
- Citations and evidence.
- Parent and child artifact relationships.
- Failures and retries.
- Cancellation.
- Actor and authorization.
- A complete rerunnable snapshot.

### Typed artifacts

Initial artifact types should include:

- `readinessScore.v1`
- `factDensityReport.v1`
- `entityMap.v1`
- `schemaMarkup.v1`
- `queryPlan.v1`
- `readinessComparison.v1`
- `gapReport.v1`
- `competitorAudit.v1`
- `positioningStrategy.v1`
- `claimLedger.v1`
- `faqSet.v1`
- `comparisonBrief.v1`
- `pillarArticle.v1`
- `competitiveResponse.v1`

### Shared result shell

Every task run should use one common page structure:

1. Agent identity and objective.
2. Task inputs.
3. Shared context.
4. Source readiness and provenance.
5. Durable progress.
6. Purpose-specific output renderer.
7. Findings and evidence.
8. Snapshot and rerun.
9. Compatible next actions.
10. Attach to project or Canvas.

## Additional Jasper platform research

### Evidence from the supplied Blog Post interface

The supplied image is a screenshot of a public Jasper page showing an embedded Blog Post agent form. It directly shows:

- Separate Jasper IQ selectors for Brand Voice, Audience, and Style Guide.
- A language selector independent of those governance controls.
- Independent Web search and Knowledge search beta toggles.
- An App context area with a `0/10` counter.
- An Add content menu containing Upload file, Add text, Add URL, Attach Knowledge, and Add from Canvas.
- Structured task inputs for length and outline followed by Generate now.

This establishes several useful interaction patterns:

1. An agent is presented as a purpose-specific form, not merely a chat prompt.
2. Brand Voice, Audience, Style Guide, language, web retrieval, and knowledge retrieval are separate choices.
3. Persistent Knowledge is distinct from temporary run context.
4. Existing Canvas assets can become input context for another agent.

The screenshot does not establish retrieval algorithms, citation behavior, supported file formats, plan availability, or freshness guarantees. The visible `0/10` appears to be a surface-specific context-item limit; it should not be generalized to every Jasper surface.

### Multimodal Knowledge

Jasper Knowledge accepts text, documents, URLs, images, audio, and video. Official documentation identifies formats including MP4, MOV, MP3, and JPEG, while the complete format and size limits remain visible only in Jasper's uploader.

The operational model is asynchronous:

1. Upload or connect the source.
2. Process it.
3. Expose ready or failed status.
4. Notify the user when processing completes.
5. Make the resulting Knowledge item attachable to future generations.

Video processing can take up to ten minutes. Audio and images can also be one-run attachments; video is documented as Knowledge-Base-only because of processing cost. Jasper marketing material says video can yield frame analysis, transcription, summaries, and metadata, but public operational documentation does not define the extraction algorithm or quality guarantees.

Content Creator should implement multimodal material as a governed ingestion pipeline, not as an opaque file attachment:

- Preserve the original object, media type, checksum, owner, visibility, and source.
- Persist derived transcript, image description, frame or segment references, and extraction version.
- Expose queued, processing, ready, and failed states with actionable errors.
- Record which derived spans or media segments grounded each output.
- Keep ingestion policy and quotas configurable by plan and modality.

### “Add content” versus “Add to Knowledge Base”

These are different operations:

- **Add content** supplies temporary context to one agent run. The screenshot offers file, text, URL, existing Knowledge, and Canvas sources.
- **Add to Knowledge Base** creates a persistent, reusable Knowledge Asset in the workspace.

Jasper's persistent Knowledge flow records a name, optional tags, and private or workspace visibility. Relevant chunks are retrieved during generation. URLs may be cached for up to two days and are fetched when used rather than continuously synchronized.

Google Drive and SharePoint connectors are read-only, admin-configured folder synchronizations. Jasper documents reprocessing changes in roughly 1–10 minutes, removal after a source deletion in roughly three hours, and root-folder-only synchronization.

Content Creator therefore needs two explicit contracts:

```text
RunAttachment
  run-scoped, temporary, immutable after run starts

KnowledgeAsset
  persistent, versioned, permissioned, searchable, freshness-aware
```

Every Knowledge Asset should retain source type, ownership, visibility, group access, tags, connector identity, ingestion state, source timestamp, last fetch, cache age, and extraction provenance. Retrieval should surface stale-source warnings rather than silently treating cached content as current.

### Style Guide

Jasper Style Guide is a structured generation-time policy, separate from Brand Voice. It covers:

- Grammar and punctuation preferences.
- Oxford comma, active voice, and em-dash settings.
- Replacement and prohibited-term rules.
- Abbreviations and first-mention behavior.
- Case-sensitive branded terminology.
- Custom contextual instructions.

Admins can configure rules manually or import one to three documents, URLs, or Knowledge items. Jasper performs sequential extraction of grammar settings, deterministic rules, and custom instructions. The generated guide is explicitly a starting point that requires human review.

Content Creator should not implement this as one free-form prompt. It should use a versioned policy model with:

- Typed punctuation and grammar settings.
- Term replacement, prohibition, capitalization, abbreviation, and first-use rules.
- Custom instructions for rules that cannot be expressed deterministically.
- Workspace → project → run override precedence.
- Pre-generation application plus post-generation validation findings.
- The exact effective Style Guide version in every run snapshot.

### Product IQ

Product IQ is a structured product catalog, not ordinary semantic Knowledge. A workspace has a shared customizable schema, while every product has its own values. Fields can include:

- Specifications and compatibility.
- Pricing.
- Value propositions and differentiators.
- Approved terminology, taglines, and claims.
- Required regulatory disclaimers.
- Custom attributes and usage instructions.

Jasper can draft a schema and product records from Knowledge, URLs, files, text, or product requirements documents. Its documented workflow still requires a product owner to verify critical values and maintain them. Public documentation does not establish native PIM synchronization or automatic factual correctness.

Content Creator should add a typed product domain separate from RAG:

- Versioned workspace product schemas.
- Product records with attribute-level provenance.
- Draft, reviewed, approved, retired, and superseded states.
- Effective dates and owner assignments.
- Approved-claim and mandatory-disclaimer policies.
- Selective attachment of product IDs and approved fields to runs.
- Validation that blocks unsupported claims and missing disclaimers.

Product truth should be supplied by stable IDs and approved attributes; retrieval similarity alone is insufficient for regulated facts.

### Google Search Console integration

Jasper's integration gives the GEO Agent first-party search data alongside separate AI-visibility data. It can reason over:

- Clicks, impressions, click-through rate, and average position.
- Query, page, date, country, device, and search-type dimensions.
- Web, image, video, news, and Discover search types.
- Up to 16 months of historical data.

Jasper documents a 25,000-row analysis ceiling. It does not expose a dedicated AI Overviews breakdown because Google's API does not provide that report. It also does not manage properties, sitemaps, indexing inspection, crawl errors, Core Web Vitals, mobile usability, or manual actions.

Content Creator should reuse the existing Geek SEO implementation rather than create a second OAuth stack. Current reusable components include:

- `Geek-SEO/GeekSeoBackend/Services/GoogleOAuthService.cs`
- `Geek-SEO/GeekSeoBackend/Services/GoogleDataService.cs`
- `Geek-SEO/GeekSeoBackend/Controllers/Seo/RankingsController.cs`
- `Geek-SEO/GeekSeoBackend/Services/SiteExtraction/GscQueryExtractor.cs`

The integration boundary should expose project-scoped, permission-checked analytics to GeekAPI while retaining the connection owner, verified property, requested dimensions, date range, fetch timestamp, and metric provenance. GSC metrics and AI-visibility measurements must remain separate datasets before a task agent combines them into recommendations.

### Grid

Grid is Jasper's structured batch-production surface:

- Rows are work items.
- Input, processing, and output columns create a left-to-right dependency chain.
- Processing columns can contain prompts, applications, or selected workflow agents.
- Prior outputs are referenced through `@output`.
- Inputs can arrive through CSV, pasted values, or a Canvas table.
- Operators can test cells, columns, or the first ten rows before scaling.
- Production can run by cell, row, column, or full Grid.
- A Grid supports up to 1,000 rows.
- Runs can be manual or scheduled daily, weekly, or monthly.

Grid History records actor, source, mode, run type, status, start time, duration, output count, and credit cost. It does not document exact-time scheduling or automatic post-run export.

Content Creator should implement Grid as an operations view over authoritative GeekAPI jobs:

```text
PipelineDefinition
  -> PipelineRun
    -> WorkItem
      -> StageAttempt
        -> ArtifactVersion
```

A row represents a work item, not a pipeline stage. Columns display typed inputs, outputs, dependencies, validation state, cost, and failures. Durable execution, retries, cancellation, approvals, and audit history remain server-owned.

### Canvas

Canvas is the human editorial and collaboration surface:

- A Project contains related Assets.
- Canvas and Table are alternate views over those Assets.
- Project-level Jasper IQ context is inherited by Assets with per-Asset overrides.
- Agents and Chat can create or modify Assets.
- Users can spatially arrange Assets, edit documents, comment on selected text, and collaborate in real time.
- Canvas tables can become Grid inputs.
- Assets have draft, in-progress, in-review, completed, and published statuses.
- Asset history currently supports restoring versions from the preceding seven days.

Content Creator's existing create workspace is the natural Canvas foundation, but it needs a clearer project/artifact model:

- A project or campaign container.
- Multiple typed assets rather than one final document.
- Immutable artifact versions beneath editable working copies.
- Status, owner, comments, approvals, and evidence per asset.
- Explicit “send to agent,” “attach as context,” “convert to batch,” and publication handoffs.
- Complete run snapshots including project context; Jasper's Agent Snapshot omits that context.

### Studio

Studio is Jasper's no-code agent-authoring surface. A creator describes the desired result, configures structured fields and instructions, selects context/model settings, supplies an example output, tests, and publishes privately or to the workspace.

The public task execution API supports agent discovery, explicit versions, synchronous or streamed runs, and context/tool configuration. Public documentation does not expose Studio authoring, editing, testing, or publication APIs. Studio's visible governance also does not document immutable versions, approval gates, signed digests, diffs, rollback, or release thresholds.

The planned Content Creator Studio should preserve its stronger controls:

- Schema-defined inputs and typed outputs.
- Immutable agent and Skill version pins.
- Test datasets and release thresholds.
- Review, approval, publication, deprecation, and revocation.
- Exact snapshot digests and audit events.
- Purpose-specific result renderers.
- Explicit model policy without silent provider fallback.

### Content Pipelines

Jasper presents Content Pipelines as the composition of governed context, reusable agents, scaled execution, editing, and downstream activation across five lifecycle stages: Plan, Create, Adapt, Activate, and Optimize.

Public documentation does not establish a first-class Pipeline resource with CRUD, a DAG schema, durable runs, pause/resume/cancel, approval nodes, retry lineage, or pipeline-level history. Content Creator should treat Jasper's term as product proof for the workflow model, not as proof of a durable pipeline API.

GeekAPI should own an explicit versioned `PipelineDefinition` containing:

- Stages and dependencies.
- Allowed agent and Skill versions.
- Input and output schemas.
- Approval gates.
- Retry and repair policy.
- Model and budget policy.
- Evidence and validation policy.
- Export and publication handoffs.

### ROI Calculator

Jasper's calculator asks for platform users, annual agency spend, bottleneck level, annual revenue, and participating marketing functions, plus company and contact information. It returns directional one-, two-, and three-year projections for ROI, gross and net value, productivity, revenue contribution, agency savings, payback, and time to value under conservative, expected, and upside scenarios.

The numerical equations, coefficients, adoption curves, labor assumptions, attribution factors, and source distribution are not published. Jasper explicitly describes the output as directional rather than a quote or guarantee.

Content Creator should use a transparent model:

```text
savedHours =
  workflowVolume * (baselineMinutes - assistedMinutes) / 60
  * adoptionRate * successfulUseRate

productivityValue =
  savedHours * loadedHourlyCost * redeploymentFactor

externalCostAvoided =
  externalSpend * replaceableShare * adoptionRate

netBenefit = grossBenefit - totalCostOfOwnership
roiPercent = netBenefit / totalCostOfOwnership * 100
```

All assumptions must be editable and sourced. Capacity created must remain separate from cash saved; revenue should be converted to attributable gross profit; overlapping benefits must be deduplicated; and projections should be reconciled against actual run, review, acceptance, publication, and performance telemetry.

### Customer Stories

Jasper's customer stories support the value of governed context and repeatable workflows, but they are vendor-published claims rather than controlled evidence:

- Bonterra reports reducing quarterly review-response work from more than 12 hours to under two using Grid, custom agents, Brand Voice, routing, and human escalation.
- Savista reports converting subject-matter-expert recordings into multi-channel campaigns with Knowledge and multiple Brand Voices.
- Webster First reports 9× organic traffic, 93% faster blog creation, and 4× monthly publishing.
- Cushman & Wakefield reports 10,000+ annual hours saved using Jasper API, proprietary data, self-service tools, and Knowledge.
- WalkMe reports 3,000+ hours saved, 3× content output, and 2.5× outbound reply rates using Brand Voice, Campaigns, Chat, and in-context editing.
- Mongoose Media reports 166% organic growth and 240 hours saved with a human writer, Jasper, and Surfer SEO.

These examples do not isolate Jasper causally and often omit measurement periods, denominators, baselines, cost assumptions, or concurrent process changes. They should inform workflow hypotheses, not serve as default ROI coefficients.

Content Creator should store evidence for its own customer outcomes:

- Metric definition, period, baseline, denominator, and source.
- Workflow and feature versions used.
- Generated, accepted, published, and rejected counts.
- Human review and edit time.
- Attribution method and confidence.
- Customer-reported, telemetry-measured, modeled, experimental, or independently audited status.

## Roadmap impact from the additional research

The revised dependency order is:

1. Stabilize the existing runtime.
2. Build the governed context plane: persistent Knowledge, run attachments, Style Guides, audiences, product truth, and connector provenance.
3. Build the versioned task-agent kernel and complete snapshots.
4. Add shared analysis primitives and reuse Geek SEO's GSC data.
5. Ship diagnostic, competitive, and content task agents.
6. Add Canvas multi-asset collaboration and handoffs.
7. Add Grid batch operations over durable pipeline runs.
8. Add transparent projected-versus-observed ROI measurement.

## Development sequence

### Phase 0: stabilize

- Restore endpoint compatibility and graceful degradation.
- Persist research planning.
- Implement reviewer-driven repair gates.
- Align stage contracts.
- Make idempotency durable.

### Phase 1A: governed context plane

- Separate persistent Knowledge Assets from run-scoped attachments.
- Add asynchronous multimodal ingestion and derived-artifact provenance.
- Add typed, versioned Style Guides with deterministic validation.
- Add audiences and locale as independent context dimensions.
- Add a governed Product IQ-style catalog with approved claims and disclaimers.
- Add one resolved `RunContextManifest` with exact versions, source freshness, and permissions.

### Phase 1B: task-agent kernel

- Add task-agent metadata and immutable schemas.
- Add durable runs and typed artifacts.
- Add artifact lineage.
- Add schema-driven forms.
- Add shared run/result shell.
- Add purpose-specific renderers.

### Phase 2: shared analytical primitives

- Versioned seven-dimension readiness rubric.
- Claim ledger and contradiction handling.
- Canonical entity graph.
- Query provenance and opportunity model.
- Project-scoped Google Search Console analytics through the existing Geek SEO integration.
- Expanded JSON-LD generation and validation.
- Multi-page competitor benchmark engine.

### Phase 3: first diagnostic release

Implement:

1. AI Readiness Score.
2. Fact Density Audit.
3. Entity Mapper.
4. Schema Markup.

These establish the scoring, claim, entity, and schema services used by later agents.

### Phase 4: planning and competitor intelligence

Implement:

1. Query Planner.
2. AI Readiness Comparison.
3. Gap Finder.
4. Competitor Audit.
5. Competitor Positioning.

### Phase 5: generated content applications

Implement:

1. Citable Claims.
2. FAQ Generator.
3. Comparison Brief.
4. Pillar Article.
5. Competitive Response.

### Phase 6: Custom Agent Studio

- End-user form builder.
- Context attachment.
- Dynamic instructions.
- Output contract and example.
- Model policy.
- Test datasets and thresholds.
- Private and admin-shared visibility.
- Existing approval, pinning, audit, and revocation lifecycle.

### Phase 7: pipelines and portfolio execution

- Artifact-compatible follow-on actions.
- Canvas projects with multiple typed, versioned assets and editorial handoffs.
- Grid-style work items with bulk row/column execution.
- Small-sample test mode.
- Cost and budget preview.
- Saved configurations.
- Scheduled audits.
- Competitor and readiness changes over time.
- Usage, acceptance, groundedness, edit-distance, schema-validity, and observed-outcome metrics.
- Transparent ROI projections reconciled against observed workflow telemetry.
- Evidence-aware customer outcome records.

## Validation requirements

- Cross-language JSON contract tests for every artifact.
- Golden fixtures for deterministic scoring.
- Multi-competitor and partial-crawl fixtures.
- Claim-to-source span verification.
- Contradiction tests.
- Entity alias and relation tests.
- Query provenance enforcement.
- SSRF-safe URL retrieval.
- JSON-LD syntax and visible-content consistency tests.
- Reviewer rejection and repair-loop tests.
- Durable retry and multi-instance idempotency tests.
- Exact-digest publication gates.
- E2E tests for forms, progress, cancellation, results, snapshots, handoffs, permissions, and stale evidence.

## Primary sources

### Platform

- [Jasper Agent Library](https://www.jasper.ai/agents)
- [Agent Library Help](https://help.jasper.ai/hc/en-us/articles/30482508933403-Agent-Library)
- [Using Agents API](https://developers.jasper.ai/docs/using-agents)
- [Jasper Studio](https://help.jasper.ai/hc/en-us/articles/36783295610395-Jasper-Studio)
- [Agent Snapshots](https://help.jasper.ai/hc/en-us/articles/39657086973083-Agent-Snapshots)
- [Jasper Canvas](https://help.jasper.ai/hc/en-us/articles/37817833127963-Jasper-Canvas)
- [Jasper Grid](https://help.jasper.ai/hc/en-us/articles/46746641765787-Jasper-Grid)
- [Content Pipelines](https://www.jasper.ai/content-pipelines)
- [Jasper IQ](https://help.jasper.ai/hc/en-us/articles/18618654325787-Jasper-IQ)
- [Knowledge Base](https://help.jasper.ai/hc/en-us/articles/18618707176347-Knowledge-Base)
- [Knowledge Connectors](https://help.jasper.ai/hc/en-us/articles/48810855221019-Knowledge-Connectors)
- [Style Guide](https://help.jasper.ai/hc/en-us/articles/25925092890011-Style-Guide)
- [Product IQ](https://help.jasper.ai/hc/en-us/articles/54277698302875-Product-IQ)
- [Introducing Product IQ](https://www.jasper.ai/blog/introducing-product-iq)
- [Google Search Console integration](https://help.jasper.ai/hc/en-us/articles/53942168370203-Integrations-Google-Search-Console)
- [Jasper ROI Calculator](https://www.jasper.ai/diagnostics/roi-calculator)
- [Jasper Customer Stories](https://www.jasper.ai/customer-stories)
- [Governance](https://www.jasper.ai/governance)
- [Permission Settings](https://help.jasper.ai/hc/en-us/articles/34717759798683-Permission-Settings)

### Agent details

- [AI Readiness Score](https://www.jasper.ai/agents/ai-readiness-score)
- [Entity Mapper](https://www.jasper.ai/agents/entity-mapper)
- [Fact Density Audit](https://www.jasper.ai/agents/fact-density-audit)
- [Schema Markup](https://www.jasper.ai/agents/schema-markup)
- [Query Planner](https://www.jasper.ai/agents/query-planner)
- [Comparison Brief](https://www.jasper.ai/agents/comparison-brief)
- [Citable Claims](https://www.jasper.ai/agents/citable-claims)
- [FAQ Generator](https://www.jasper.ai/agents/faq-generator)
- [Pillar Article](https://www.jasper.ai/agents/pillar-article)
- [Originate collection](https://www.jasper.ai/agent-tags/aeo-geo-originate)
- [Optimize collection](https://www.jasper.ai/agent-tags/aeo-geo-optimize)
- [Outrank collection](https://www.jasper.ai/agent-tags/aeo-geo-outrank)

## Final conclusion

The valuable Jasper pattern is not its agent names or marketing claims. It is the separation of:

- **Task application:** the specific job a marketer chooses.
- **Structured inputs:** the information needed for that job.
- **Governed context:** approved brand and organizational knowledge.
- **Execution:** tools, models, skills, and workflow.
- **Typed artifact:** a result with a clear purpose.
- **Workspace handoff:** edit, chain, batch, schedule, or publish.

Content Creator already has most of the secure execution foundation. The next development step is not to add fourteen more broad specialist personas. It is to make task-specific, independently runnable, evidence-backed applications a first-class layer over the existing governed runtime.

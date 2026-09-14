<!-- e6b2fc28-c800-43bc-84fe-4ec0d8c7f052 -->
---
todos:
  - id: "be-resolve-applicable"
    content: "GeekAPI: ResolveApplicableAsync + Generate/resolve use per-type subset"
    status: completed
  - id: "be-tests"
    content: "GeekAPI tests: pillar+email with SEO/AEO pinned"
    status: completed
  - id: "fe-compat"
    content: "phi: isCompatibleAgent vs primary; coverage labels; Outputs/Review copy"
    status: completed
isProject: false
---
# Per-format specialist applicability

## Verdict

No — removing SEO/AEO from **all** formats because they skip **some** Also drafts is wrong. They should stay selectable for the formats they cover (e.g. Pillar), and simply not ride along on Email/Social/Ads/PDF jobs.

Today that happens because the **frontend over-filters** and **Generate over-validates**, not because specialists are missing from the catalog.

```mermaid
flowchart LR
  select[Select Writing plus SEO]
  create[Create pins version IDs]
  pillar[Pillar job: Writing plus SEO]
  email[Email job: Writing only]
  select --> create --> pillar
  create --> email
```

## Why it works this way today

1. UI: [`isCompatibleAgent`](../src/app/agents/agent-contract.ts) requires `contentTypes.every(...)` — primary **and** every Also draft.
2. Preview: `POST /agents/resolve` in GeekAPI `GccV2AgentsController` calls `ResolveStableAsync` for **each** content type with the **full** selected set.
3. Generate: GeekAPI `GccV2Controller.Generate` does the same with pinned version IDs — any non-applicable specialist fails the whole create.

The correct model already exists for remix children: `ResolveChildAsync` in `GccV2AgentTeams.cs` keeps only agents (and skills) that apply to the child content type.

## Locked approach

- Create still pins one specialist selection (agent version IDs).
- Each job resolves the **applicable subset** of that pin for its content type (must still include exactly one producer for that type).
- Outputs shows a specialist if they apply to the **primary** format (producer must apply to primary; optional Marketing/SEO/AEO shown when they apply to primary), with a short note of which selected formats they cover vs skip.
- Do not hide SEO/AEO solely because an Also draft is Email/Social/Ads/PDF.

## Backend (GeekAPI)

In `GeekBackend/GeekAPI/Services/ContentCreatorV2/Generation/GccV2AgentTeams.cs`:

- Add `ResolveApplicableAsync(IReadOnlyList<Guid> selectedVersionIds, string contentType, …)` (or extend `ResolveAsync` with an `applicableSubset` mode):
  - Load published agents for that content type.
  - Intersect with selected version IDs (drop non-applicable; do **not** require every selected ID).
  - `Validate` the resulting members (exactly one producer for that type).
- Wire **Generate** (and any multi-type resolve preview that currently requires the full set) to use applicable-subset resolve per content type.
- Keep Create’s primary-type resolve as-is (pin full selection against primary).
- Add unit tests: pin Writing+SEO+AEO with content types `[pillar, email]` → pillar team includes SEO/AEO; email team is Writing (+ Marketing if selected and applicable); no throw.

In `GeekBackend/GeekAPI/Controllers/ContentCreatorV2/GccV2AgentsController.cs` `Resolve`:

- Resolve primary with full selection.
- For additional types, use applicable-subset resolve (validate only; response can still show the primary team snapshot for Review, plus optional `perContentType` digests if cheap).

## Frontend (content-creator-v2)

- Change compatibility in [`../src/app/agents/agent-contract.ts`](../src/app/agents/agent-contract.ts):
  - `isCompatibleAgent(agent, primaryType)` for picker visibility (or “applies to primary”).
  - Helper `formatsCoveredBy(agent, selectedTypes)` for labels.
- Update Outputs copy in [`../src/app/creates/new/new-create-form.tsx`](../src/app/creates/new/new-create-form.tsx): stop saying SEO/AEO disappear when any format is uncovered; say they apply only to covered formats and are omitted from the rest.
- Review “Immutable specialist team” can note omitted formats when Also drafts exclude a selected specialist (from coverage helper).
- Keep producer rule: exactly one producer that supports the primary.

## Out of scope

- Expanding SEO/AEO skill applicability to short-form types.
- Separate per-format pickers in the wizard.

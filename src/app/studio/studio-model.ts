import type {
  StudioAgentDraft,
  StudioDryRunResult,
  StudioFormField,
} from "@/app/studio/studio-types";

export function createEmptyStudioDraft(now = new Date().toISOString()): StudioAgentDraft {
  return {
    id: `studio-${crypto.randomUUID()}`,
    name: "Untitled custom agent",
    outcome: "Describe the marketing outcome this agent should produce.",
    visibility: "private",
    fields: [
      {
        id: "topic",
        label: "Topic",
        type: "shortText",
        required: true,
        placeholder: "What should this agent work on?",
      },
    ],
    instructionsTemplate:
      "You are a brand-safe marketing assistant.\nOutcome: {{outcome}}\nUse only attached approved context.",
    exampleOutput: "{\n  \"summary\": \"…\",\n  \"sections\": []\n}",
    allowedModel: "gpt-5.4",
    temperature: 0.2,
    contextKnowledgeIds: [],
    evaluationPrompt: "Output must be valid JSON matching the example shape.",
    testCases: [],
    minTestCases: 1,
    updatedAt: now,
    testStatus: "untested",
  };
}

export function upsertField(
  draft: StudioAgentDraft,
  field: StudioFormField,
): StudioAgentDraft {
  const exists = draft.fields.some((item) => item.id === field.id);
  return {
    ...draft,
    updatedAt: new Date().toISOString(),
    testStatus: "untested",
    fields: exists
      ? draft.fields.map((item) => (item.id === field.id ? field : item))
      : [...draft.fields, field],
  };
}

export function removeField(draft: StudioAgentDraft, fieldId: string): StudioAgentDraft {
  return {
    ...draft,
    updatedAt: new Date().toISOString(),
    testStatus: "untested",
    fields: draft.fields.filter((field) => field.id !== fieldId),
  };
}

export function buildInputSchema(draft: StudioAgentDraft) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of draft.fields) {
    properties[field.id] = field.type === "tags"
      ? { type: "array", items: { type: "string" } }
      : { type: "string" };
    if (field.required) required.push(field.id);
  }
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties,
  };
}

export function dryRunStudioDraft(
  draft: StudioAgentDraft,
  inputs: Record<string, string>,
): StudioDryRunResult {
  const missingFields = draft.fields
    .filter((field) => field.required && !inputs[field.id]?.trim())
    .map((field) => field.label);
  let rendered = draft.instructionsTemplate
    .replaceAll("{{outcome}}", draft.outcome)
    .replaceAll("{{agent.name}}", draft.name);
  for (const field of draft.fields) {
    rendered = rendered.replaceAll(`{{inputs.${field.id}}}`, inputs[field.id] ?? "");
  }
  const unresolved = [...rendered.matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]);
  const missingEvaluation = !draft.evaluationPrompt.trim();
  const valid = missingFields.length === 0
    && unresolved.length === 0
    && draft.exampleOutput.trim().length > 0
    && !missingEvaluation;
  return {
    valid,
    renderedInstructions: rendered,
    missingFields,
    evaluationPrompt: draft.evaluationPrompt,
    knowledgeAttachmentCount: draft.contextKnowledgeIds.length,
    message: valid
      ? draft.contextKnowledgeIds.length > 0
        ? `Dry-run passed. Evaluation criteria on file. ${draft.contextKnowledgeIds.length} knowledge attachment(s).`
        : "Dry-run passed. Evaluation criteria on file."
      : missingFields.length
        ? `Missing required fields: ${missingFields.join(", ")}.`
        : unresolved.length
          ? `Unresolved template tokens: ${unresolved.join(", ")}.`
          : draft.exampleOutput.trim().length === 0
            ? "Example output is required before the dry-run can pass."
            : "Evaluation prompt is required before the dry-run can pass.",
  };
}

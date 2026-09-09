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
  const valid = missingFields.length === 0 && unresolved.length === 0 && draft.exampleOutput.trim().length > 0;
  return {
    valid,
    renderedInstructions: rendered,
    missingFields,
    message: valid
      ? "Dry-run passed. Publish/share still requires the governed backend lifecycle."
      : missingFields.length
        ? `Missing required fields: ${missingFields.join(", ")}.`
        : unresolved.length
          ? `Unresolved template tokens: ${unresolved.join(", ")}.`
          : "Example output is required before the dry-run can pass.",
  };
}

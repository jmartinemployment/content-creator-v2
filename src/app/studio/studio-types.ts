export type StudioFieldType = "shortText" | "longText" | "select" | "tags";

export type StudioFormField = {
  id: string;
  label: string;
  type: StudioFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

export type StudioVisibility = "private" | "admin_shared";

export type StudioAgentDraft = {
  id: string;
  name: string;
  outcome: string;
  visibility: StudioVisibility;
  fields: StudioFormField[];
  instructionsTemplate: string;
  exampleOutput: string;
  allowedModel: string;
  temperature: number;
  contextKnowledgeIds: string[];
  evaluationPrompt: string;
  updatedAt: string;
  testStatus: "untested" | "passed" | "failed";
  lastTestMessage?: string;
};

export type StudioDryRunResult = {
  valid: boolean;
  renderedInstructions: string;
  missingFields: string[];
  message: string;
};

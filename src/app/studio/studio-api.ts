import type { StudioFormField, StudioVisibility } from "@/app/studio/studio-types";

export type StudioAgentSummary = {
  id: string;
  definitionId: string;
  displayName: string;
  description: string;
  versionId: string;
  version: string;
  state: string;
  digest: string;
  visibility: StudioVisibility;
  ownerUserId: string;
};

export type StudioAgentDetail = {
  contractVersion: string;
  agent: StudioAgentSummary;
  workflow: {
    instructionsTemplate?: string;
    exampleOutput?: string;
    temperature?: number;
    uiSchema?: { fields?: StudioFormField[] };
  };
  allowedModels?: string[];
};

export type StudioDryRunResponse = {
  valid: boolean;
  renderedInstructions: string;
  missingTokens: string[];
  validationErrors: string[];
  message: string;
};

async function studioFetch(path: string, init?: RequestInit) {
  const response = await fetch(`/api/gcc-v2/studio/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : null) || `Studio request failed (HTTP ${response.status}).`,
    );
  }
  return body;
}

export function listStudioAgents() {
  return studioFetch("agents") as Promise<{ agents: StudioAgentSummary[] }>;
}

export function createStudioAgent(input: {
  name: string;
  outcome: string;
  visibility: StudioVisibility;
}) {
  return studioFetch("agents", {
    method: "POST",
    body: JSON.stringify(input),
  }) as Promise<StudioAgentDetail>;
}

export function getStudioAgent(id: string) {
  return studioFetch(`agents/${encodeURIComponent(id)}`) as Promise<StudioAgentDetail>;
}

export function saveStudioDraft(
  id: string,
  draft: {
    name: string;
    outcome: string;
    visibility: StudioVisibility;
    fields: StudioFormField[];
    instructionsTemplate: string;
    exampleOutput: string;
    allowedModel: string;
    temperature: number;
    evaluationPrompt?: string;
  },
) {
  return studioFetch(`agents/${encodeURIComponent(id)}/draft`, {
    method: "PUT",
    body: JSON.stringify({
      ...draft,
      uiSchema: { fields: draft.fields },
    }),
  }) as Promise<StudioAgentDetail>;
}

export function dryRunStudioAgent(id: string, input: Record<string, string>) {
  return studioFetch(`agents/${encodeURIComponent(id)}/dry-run`, {
    method: "POST",
    body: JSON.stringify({ input }),
  }) as Promise<StudioDryRunResponse>;
}

export function publishStudioAgent(id: string) {
  return studioFetch(`agents/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    body: "{}",
  }) as Promise<StudioAgentDetail>;
}

export function detailToEditorState(detail: StudioAgentDetail) {
  const fields = detail.workflow.uiSchema?.fields ?? [];
  return {
    id: detail.agent.id,
    name: detail.agent.displayName,
    outcome: detail.agent.description,
    visibility: detail.agent.visibility,
    state: detail.agent.state,
    version: detail.agent.version,
    fields,
    instructionsTemplate: detail.workflow.instructionsTemplate ?? "",
    exampleOutput: detail.workflow.exampleOutput ?? "",
    allowedModel: detail.allowedModels?.[0] ?? "gpt-5.4",
    temperature: detail.workflow.temperature ?? 0.2,
  };
}

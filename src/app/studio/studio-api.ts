import type { StudioFormField, StudioTestCase, StudioVisibility } from "@/app/studio/studio-types";

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

export type StudioAuditEvent = {
  id: string;
  action: string;
  actor: string;
  atUtc: string;
  detail?: string;
  versionId?: string;
  version?: string;
};

export type StudioAgentDetail = {
  contractVersion: string;
  agent: StudioAgentSummary;
  workflow: {
    instructionsTemplate?: string;
    exampleOutput?: string;
    temperature?: number;
    evaluationPrompt?: string;
    contextKnowledgeIds?: string[];
    testCases?: StudioTestCase[];
    minTestCases?: number;
    uiSchema?: { fields?: StudioFormField[] };
  };
  allowedModels?: string[];
  evaluationThresholds?: { minTestCases?: number; dryRunRequired?: boolean };
  publishedVersion?: {
    versionId: string;
    version: string;
    digest: string;
    state?: string;
  };
  lifecycleVersion?: {
    versionId: string;
    version: string;
    digest: string;
    state: string;
  };
  audit?: StudioAuditEvent[];
  message?: string;
};

export type StudioDryRunResponse = {
  valid: boolean;
  renderedInstructions: string;
  missingTokens: string[];
  validationErrors: string[];
  evaluationPrompt?: string;
  knowledgeAttachmentCount?: number;
  message: string;
};

export type StudioEvaluateResponse = {
  valid: boolean;
  minTestCases: number;
  caseCount: number;
  passedCount: number;
  message: string;
  cases: Array<{ id: string; name: string; valid: boolean; message: string }>;
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
    contextKnowledgeIds?: string[];
    testCases?: StudioTestCase[];
    minTestCases?: number;
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

export function evaluateStudioAgent(id: string) {
  return studioFetch(`agents/${encodeURIComponent(id)}/evaluate`, {
    method: "POST",
    body: "{}",
  }) as Promise<StudioEvaluateResponse>;
}

export function publishStudioAgent(id: string) {
  return studioFetch(`agents/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    body: "{}",
  }) as Promise<StudioAgentDetail>;
}

export function deprecateStudioAgent(id: string) {
  return studioFetch(`agents/${encodeURIComponent(id)}/deprecate`, {
    method: "POST",
    body: "{}",
  }) as Promise<StudioAgentDetail>;
}

export function revokeStudioAgent(id: string) {
  return studioFetch(`agents/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
    body: "{}",
  }) as Promise<StudioAgentDetail>;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function normalizeTestCases(value: unknown): StudioTestCase[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as { id?: unknown; name?: unknown; input?: unknown };
    const id = typeof row.id === "string" && row.id.trim() ? row.id : `case-${index + 1}`;
    const name = typeof row.name === "string" && row.name.trim() ? row.name : `Case ${index + 1}`;
    const input: Record<string, string> = {};
    if (row.input && typeof row.input === "object" && !Array.isArray(row.input)) {
      for (const [key, raw] of Object.entries(row.input as Record<string, unknown>)) {
        if (typeof raw === "string") input[key] = raw;
        else if (raw != null) input[key] = String(raw);
      }
    }
    return [{ id, name, input }];
  });
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
    evaluationPrompt: detail.workflow.evaluationPrompt ?? "",
    contextKnowledgeIds: stringList(detail.workflow.contextKnowledgeIds),
    testCases: normalizeTestCases(detail.workflow.testCases),
    minTestCases: detail.workflow.minTestCases
      ?? detail.evaluationThresholds?.minTestCases
      ?? 1,
    publishedVersion: detail.publishedVersion ?? null,
    lifecycleVersion: detail.lifecycleVersion ?? null,
    audit: Array.isArray(detail.audit) ? detail.audit : [],
  };
}

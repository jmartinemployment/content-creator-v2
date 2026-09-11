import type {
  AppendVersionInput,
  AssetKind,
  CanvasProject,
  ProjectStatus,
} from "@/app/projects/project-types";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  updatedAt: string;
  owner: string;
  collaborators: string[];
  persistence: "server";
  assetCount: number;
};

async function projectsFetch(path: string, init?: RequestInit) {
  const response = await fetch(`/api/gcc-v2/projects${path}`, {
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
        : null) || `Projects request failed (HTTP ${response.status}).`,
    );
  }
  return body;
}

export async function listProjects() {
  const body = await projectsFetch("") as { projects?: ProjectSummary[] };
  return body.projects ?? [];
}

export async function getProject(id: string) {
  const body = await projectsFetch(`/${encodeURIComponent(id)}`) as { project: CanvasProject };
  return body.project;
}

export async function createProject(input: {
  name: string;
  description?: string;
  status?: ProjectStatus;
  seedDemo?: boolean;
}) {
  const body = await projectsFetch("", {
    method: "POST",
    body: JSON.stringify(input),
  }) as { project: CanvasProject };
  return body.project;
}

export async function createAsset(
  projectId: string,
  input: { title: string; kind: AssetKind; parentAssetIds?: string[] },
) {
  const body = await projectsFetch(`/${encodeURIComponent(projectId)}/assets`, {
    method: "POST",
    body: JSON.stringify(input),
  }) as { project: CanvasProject };
  return body.project;
}

export async function appendProjectAssetVersion(
  projectId: string,
  assetId: string,
  input: AppendVersionInput,
) {
  const body = await projectsFetch(
    `/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/versions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  ) as { project: CanvasProject };
  return body.project;
}

type EditorialTransitionInput = {
  createdAt: string;
  createdBy: string;
  summary: string;
  evidence: AppendVersionInput["evidence"];
  provenance: AppendVersionInput["provenance"];
};

export async function requestProjectAssetApproval(
  projectId: string,
  assetId: string,
  input: EditorialTransitionInput,
) {
  return appendProjectAssetVersion(projectId, assetId, {
    ...input,
    status: "in-review",
  });
}

export async function approveProjectAsset(
  projectId: string,
  assetId: string,
  input: EditorialTransitionInput,
) {
  return appendProjectAssetVersion(projectId, assetId, {
    ...input,
    status: "approved",
  });
}

export async function publishProjectAsset(
  projectId: string,
  assetId: string,
  input: EditorialTransitionInput,
) {
  return appendProjectAssetVersion(projectId, assetId, {
    ...input,
    status: "published",
  });
}

export async function addProjectAssetComment(
  projectId: string,
  assetId: string,
  input: { message: string; createdBy?: string },
) {
  const body = await projectsFetch(
    `/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  ) as { project: CanvasProject };
  return body.project;
}

export async function convertProjectAssetToGrid(
  projectId: string,
  assetId: string,
  input?: {
    capability?: "faq-generator" | "pillar-outline";
    createdBy?: string;
    targetGridId?: string;
  },
) {
  const body = await projectsFetch(
    `/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/to-grid`,
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    },
  ) as {
    project: CanvasProject;
    gridId: string;
    gridName: string;
    capability: string;
    rowCount: number;
    appended?: boolean;
  };
  return body;
}

export type SendToAgentCapability = "faq-generator" | "pillar-outline" | "citable-claims";

export async function sendProjectAssetToAgent(
  projectId: string,
  assetId: string,
  input?: { capabilityId?: SendToAgentCapability; createdBy?: string },
) {
  const body = await projectsFetch(
    `/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/to-agent`,
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    },
  ) as {
    project: CanvasProject;
    capabilityId: SendToAgentCapability;
    agentLabel: string;
    redirectPath: string;
  };
  return body;
}

export async function attachTaskArtifactToProject(
  projectId: string,
  input: {
    runId: string;
    artifactVersionId: string;
    title?: string;
    kind?: AssetKind;
  },
) {
  const body = await projectsFetch(
    `/${encodeURIComponent(projectId)}/assets/from-task-artifact`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  ) as { project: CanvasProject; assetId?: string };
  return body;
}

export async function attachGridRowsToProject(
  projectId: string,
  input: {
    gridId: string;
    rowIds?: string[];
    titlePrefix?: string;
    kind?: AssetKind;
  },
) {
  const body = await projectsFetch(
    `/${encodeURIComponent(projectId)}/assets/from-grid`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  ) as {
    project: CanvasProject;
    attachedCount: number;
    attached: Array<{ assetId: string; title: string; rowId: string }>;
  };
  return body;
}

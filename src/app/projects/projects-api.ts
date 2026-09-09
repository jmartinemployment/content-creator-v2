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

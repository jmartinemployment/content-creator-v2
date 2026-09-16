export type LibrarySavedConfig = {
  id: string;
  capabilityId: string;
  name: string;
  values: Record<string, string>;
  updatedAtUtc: string;
};

export type LibraryRecentEntry = {
  capabilityId: string;
  lastRunAtUtc: string;
};

export type TaskAgentLibraryState = {
  contractVersion: string;
  favorites: string[];
  recent: LibraryRecentEntry[];
  savedConfigs: LibrarySavedConfig[];
};

export async function fetchLibraryState(): Promise<TaskAgentLibraryState> {
  const response = await fetch("/api/gcc-v2/task-agents/library", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Library preferences unavailable (HTTP ${response.status}).`);
  }
  return response.json() as Promise<TaskAgentLibraryState>;
}

export async function putLibraryState(body: {
  favorites: string[];
  savedConfigs: LibrarySavedConfig[];
}): Promise<TaskAgentLibraryState> {
  const response = await fetch("/api/gcc-v2/task-agents/library", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Could not save library preferences (HTTP ${response.status}).`);
  }
  return response.json() as Promise<TaskAgentLibraryState>;
}

export function visibilityScopeFromFacets(facets: Record<string, unknown> | undefined): "public" | "workspace" | "custom" {
  if (!facets || typeof facets !== "object") return "public";
  if (facets.category === "studio") {
    return facets.visibility === "admin_shared" ? "workspace" : "custom";
  }
  return "public";
}

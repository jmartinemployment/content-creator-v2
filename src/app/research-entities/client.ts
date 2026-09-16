import type { ResearchEntity, ResearchEntityRole } from "./types";

async function entitiesFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api/gcc-v2/research-entities${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });
}

export async function listResearchEntities(role?: ResearchEntityRole): Promise<ResearchEntity[]> {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  const res = await entitiesFetch(query);
  if (!res.ok) return [];
  return (await res.json()) as ResearchEntity[];
}

export async function createResearchEntity(input: {
  name: string;
  role: ResearchEntityRole;
  primaryUrl?: string;
  notes?: string;
}): Promise<ResearchEntity | null> {
  const res = await entitiesFetch("", { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) return null;
  return (await res.json()) as ResearchEntity;
}

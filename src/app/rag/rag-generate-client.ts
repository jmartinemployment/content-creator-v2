import type { RagAdTemplate, RagGenerateRequest, RagGenerateResponse, RagGenerateStatus } from "./types";

async function ragFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api/rag/${path.replace(/^\//, "")}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });
}

export async function fetchRagStatus(): Promise<RagGenerateStatus | null> {
  const res = await ragFetch("status");
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as RagGenerateStatus;
}

export async function generateRagDraft(
  body: RagGenerateRequest,
): Promise<{ ok: true; data: RagGenerateResponse } | { ok: false; error: string; status: number }> {
  const res = await ragFetch("generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let error = `Generate failed (HTTP ${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) error = payload.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error, status: res.status };
  }
  return { ok: true, data: (await res.json()) as RagGenerateResponse };
}

export async function indexRagAdTemplates(
  templates: RagAdTemplate[],
): Promise<{ upserted: number; warning?: string | null } | null> {
  const res = await ragFetch("templates", {
    method: "POST",
    body: JSON.stringify(templates),
  });
  if (!res.ok) return null;
  return (await res.json()) as { upserted: number; warning?: string | null };
}

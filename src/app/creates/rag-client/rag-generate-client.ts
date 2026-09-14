import type { RagAdTemplate, RagGenerateRequest, RagGenerateResponse, RagGenerateStatus } from "./types";
import { type LoadResult, loadError, loadOk, loadUnauthorized, readLoadResult } from "@/app/lib/load-result";

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

export async function fetchRagStatus(): Promise<LoadResult<RagGenerateStatus>> {
  const res = await ragFetch("status");
  return readLoadResult(res, (body) => body as RagGenerateStatus);
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
): Promise<LoadResult<{ upserted: number; warning?: string | null }>> {
  const res = await ragFetch("templates", {
    method: "POST",
    body: JSON.stringify(templates),
  });
  if (res.status === 401) return loadUnauthorized();
  if (!res.ok) return loadError(`Template index failed (HTTP ${res.status})`, res.status);
  return loadOk((await res.json()) as { upserted: number; warning?: string | null });
}

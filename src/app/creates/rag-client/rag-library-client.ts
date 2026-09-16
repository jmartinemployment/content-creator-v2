import type { RagAdTemplate, RagLibraryStatus } from "./types";
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

/** Library readiness (query/pages). RAG does not generate drafts. */
export async function fetchRagStatus(): Promise<LoadResult<RagLibraryStatus>> {
  const res = await ragFetch("status");
  return readLoadResult(res, (body) => body as RagLibraryStatus);
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

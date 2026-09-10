import type { PipelineDefinition, PipelineSummary } from "@/app/pipelines/pipeline-types";

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = typeof body?.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(error);
  }
  return body as T;
}

export async function listPipelines(): Promise<PipelineSummary[]> {
  const response = await fetch("/api/gcc-v2/pipelines", { cache: "no-store" });
  const body = await readJson<{ pipelines?: PipelineSummary[] }>(response);
  return Array.isArray(body.pipelines) ? body.pipelines : [];
}

export async function getPipeline(id: string): Promise<PipelineDefinition> {
  const response = await fetch(`/api/gcc-v2/pipelines/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const body = await readJson<{ pipeline: PipelineDefinition }>(response);
  return body.pipeline;
}

export async function createAeoPipeline(name?: string): Promise<PipelineDefinition> {
  const response = await fetch("/api/gcc-v2/pipelines", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: name || "AEO content pipeline",
      useAeoTemplate: true,
      publish: true,
    }),
  });
  const body = await readJson<{ pipeline: PipelineDefinition }>(response);
  return body.pipeline;
}

export async function startPipelineRun(
  id: string,
  options?: {
    failStageKey?: string;
    input?: Record<string, unknown>;
    workItems?: ReadonlyArray<Record<string, unknown>>;
  },
): Promise<PipelineDefinition> {
  const response = await fetch(`/api/gcc-v2/pipelines/${encodeURIComponent(id)}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: options?.input ?? options?.workItems?.[0] ?? { topic: "Evidence Engine FAQ launch" },
      failStageKey: options?.failStageKey,
      workItems: options?.workItems,
    }),
  });
  const body = await readJson<{ pipeline: PipelineDefinition }>(response);
  return body.pipeline;
}

export async function transitionPipelineRun(
  runId: string,
  action: "pause" | "resume" | "cancel",
): Promise<PipelineDefinition> {
  const response = await fetch(
    `/api/gcc-v2/pipelines/runs/${encodeURIComponent(runId)}/${action}`,
    { method: "POST" },
  );
  const body = await readJson<{ pipeline: PipelineDefinition }>(response);
  return body.pipeline;
}

import type { Grid, GridRunMode, GridSummary } from "@/app/grid/grid-types";

export type GridDemoCapability = "faq-generator" | "pillar-outline";

async function gridsFetch(path: string, init?: RequestInit) {
  const response = await fetch(`/api/gcc-v2/grids${path}`, {
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
        : null) || `Grid request failed (HTTP ${response.status}).`,
    );
  }
  return body;
}

export async function listGrids() {
  const body = await gridsFetch("") as { grids?: GridSummary[] };
  return body.grids ?? [];
}

export async function getGrid(id: string) {
  const body = await gridsFetch(`/${encodeURIComponent(id)}`) as { grid: Grid };
  return body.grid;
}

export async function createGrid(input: {
  name?: string;
  description?: string;
  seedDemo?: boolean;
  capability?: GridDemoCapability;
}) {
  const body = await gridsFetch("", {
    method: "POST",
    body: JSON.stringify(input),
  }) as { grid: Grid };
  return body.grid;
}

export async function createGridRun(
  gridId: string,
  input: { mode: GridRunMode; sampleSize?: number },
) {
  const body = await gridsFetch(`/${encodeURIComponent(gridId)}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  }) as { grid: Grid };
  return body.grid;
}

export async function createGridRow(
  gridId: string,
  input: { topic: string },
) {
  const body = await gridsFetch(`/${encodeURIComponent(gridId)}/rows`, {
    method: "POST",
    body: JSON.stringify({ input: { topic: input.topic } }),
  }) as { grid: Grid };
  return body.grid;
}

export async function importGridRows(
  gridId: string,
  input: { text?: string; topics?: string[] },
) {
  const body = await gridsFetch(`/${encodeURIComponent(gridId)}/rows/import`, {
    method: "POST",
    body: JSON.stringify(input),
  }) as { grid: Grid; importedCount?: number };
  return body;
}

export async function putGridSchedule(
  gridId: string,
  input: {
    cadence: "none" | "daily" | "weekly" | "monthly";
    enabled: boolean;
    mode: GridRunMode;
    sampleSize?: number;
  },
) {
  const body = await gridsFetch(`/${encodeURIComponent(gridId)}/schedule`, {
    method: "PUT",
    body: JSON.stringify(input),
  }) as { grid: Grid };
  return body.grid;
}

export async function runDueGridSchedule(
  gridId: string,
  input?: { force?: boolean },
) {
  const body = await gridsFetch(`/${encodeURIComponent(gridId)}/schedule/run-due`, {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  }) as { grid: Grid; ran: boolean; reason?: string };
  return body;
}

export async function runDueGridSchedules(input?: { force?: boolean }) {
  const body = await gridsFetch(`/schedules/run-due`, {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  }) as {
    grids: GridSummary[];
    ranCount: number;
    skippedCount: number;
    results?: ReadonlyArray<{ gridId: string; name: string; ran: boolean; reason?: string }>;
  };
  return body;
}

export async function putGridPipeline(
  gridId: string,
  input: { pipelineDefinitionId: string | null },
) {
  const body = await gridsFetch(`/${encodeURIComponent(gridId)}/pipeline`, {
    method: "PUT",
    body: JSON.stringify(input),
  }) as { grid: Grid };
  return body.grid;
}

export async function startGridPipelineRun(
  gridId: string,
  input?: { mode?: GridRunMode; sampleSize?: number; pipelineDefinitionId?: string },
) {
  const body = await gridsFetch(`/${encodeURIComponent(gridId)}/pipeline-runs`, {
    method: "POST",
    body: JSON.stringify(input ?? { mode: "sample", sampleSize: 10 }),
  }) as {
    grid: Grid;
    pipelineRunId: string;
    workItemCount: number;
    pipeline: { id: string; name: string; status: string };
  };
  return body;
}

export async function putGridRoiProjection(
  gridId: string,
  input:
    | { runId: string; artifactVersionId: string }
    | { clear: true },
) {
  const body = await gridsFetch(`/${encodeURIComponent(gridId)}/roi-projection`, {
    method: "PUT",
    body: JSON.stringify(input),
  }) as { grid: Grid };
  return body.grid;
}

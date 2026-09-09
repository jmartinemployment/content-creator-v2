import type { Grid, GridRunMode, GridSummary } from "@/app/grid/grid-types";

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

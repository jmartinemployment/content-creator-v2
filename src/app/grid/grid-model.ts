import type { Grid, GridConfig, GridRow, GridRunMode } from "@/app/grid/grid-types";

export function estimateBudget(config: GridConfig, rowCount: number) {
  const creditsPerRow = config.creditsPerRow;
  return {
    creditsPerRow,
    rowCount,
    estimatedCredits: creditsPerRow * rowCount,
    note: config.executionNote,
  };
}

export function selectRowsForRun(
  rows: readonly GridRow[],
  mode: GridRunMode,
  sampleSize = 10,
): readonly GridRow[] {
  const ordered = [...rows].sort((a, b) => a.rowIndex - b.rowIndex);
  if (mode === "full") return ordered;
  return ordered.slice(0, Math.max(0, sampleSize));
}

export function inputPreview(row: GridRow, inputKey = "topic"): string {
  const value = row.input[inputKey];
  return typeof value === "string" && value.trim() ? value : "(empty input)";
}

export function outputPreview(row: GridRow): string {
  if (!row.output) return "—";
  const result = row.output.result;
  return typeof result === "string" && result.trim() ? result : JSON.stringify(row.output);
}

export function succeededCount(grid: Grid) {
  return grid.rows.filter((row) => row.status === "succeeded").length;
}

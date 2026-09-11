import type {
  Grid,
  GridConfig,
  GridRow,
  GridRunMode,
  GridSchedule,
  GridScheduleCadence,
} from "@/app/grid/grid-types";

export const defaultGridSchedule: GridSchedule = {
  cadence: "none",
  enabled: false,
  mode: "sample",
  sampleSize: 10,
  nextRunAt: null,
  lastRunAt: null,
};

export function estimateBudget(config: GridConfig, rowCount: number) {
  const creditsPerRow = config.creditsPerRow;
  return {
    creditsPerRow,
    rowCount,
    estimatedCredits: creditsPerRow * rowCount,
    note: config.executionNote,
  };
}

export function normalizeGridSchedule(raw: unknown): GridSchedule {
  if (!raw || typeof raw !== "object") return { ...defaultGridSchedule };
  const value = raw as Record<string, unknown>;
  const cadence = normalizeCadence(value.cadence);
  const mode = value.mode === "full" ? "full" : "sample";
  const sampleSize = Number.isFinite(Number(value.sampleSize)) && Number(value.sampleSize) > 0
    ? Math.floor(Number(value.sampleSize))
    : 10;
  const enabled = value.enabled === true && cadence !== "none";
  return {
    cadence,
    enabled,
    mode,
    sampleSize,
    nextRunAt: typeof value.nextRunAt === "string" && value.nextRunAt.trim() ? value.nextRunAt : null,
    lastRunAt: typeof value.lastRunAt === "string" && value.lastRunAt.trim() ? value.lastRunAt : null,
  };
}

export function readGridSchedule(config: GridConfig | null | undefined): GridSchedule {
  return normalizeGridSchedule(config?.schedule);
}

export function advanceScheduleNextRunAt(from: Date, cadence: GridScheduleCadence): Date | null {
  if (cadence === "none") return null;
  const next = new Date(from.getTime());
  if (cadence === "daily") {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (cadence === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export function scheduleIsDue(schedule: GridSchedule, now = new Date()): boolean {
  if (!schedule.enabled || schedule.cadence === "none" || !schedule.nextRunAt) return false;
  const dueAt = Date.parse(schedule.nextRunAt);
  return Number.isFinite(dueAt) && dueAt <= now.getTime();
}

export function scheduleLabel(schedule: GridSchedule): string {
  if (!schedule.enabled || schedule.cadence === "none") return "Not scheduled";
  const cadence = schedule.cadence;
  const mode = schedule.mode === "full" ? "all rows" : `sample (${schedule.sampleSize})`;
  return `${cadence} · ${mode}`;
}

function normalizeCadence(value: unknown): GridScheduleCadence {
  if (value === "daily" || value === "weekly" || value === "monthly") return value;
  return "none";
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

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/** Build a CSV that re-imports via first-column topic parsing. */
export function buildGridCsv(
  grid: Pick<Grid, "rows" | "config">,
  inputKey = "topic",
): string {
  const header = ["topic", "status", "rowIndex", "result", "error", "updatedAt"];
  const lines = [header.join(",")];
  const ordered = [...grid.rows].sort((a, b) => a.rowIndex - b.rowIndex);
  for (const row of ordered) {
    const topic = inputPreview(row, inputKey);
    const result = outputPreview(row);
    lines.push([
      escapeCsvField(topic === "(empty input)" ? "" : topic),
      escapeCsvField(row.status),
      String(row.rowIndex),
      escapeCsvField(result === "—" ? "" : result),
      escapeCsvField(row.error || ""),
      escapeCsvField(row.updatedAt || ""),
    ].join(","));
  }
  return `${lines.join("\n")}\n`;
}

/** Recover topics from an exported Grid CSV (first column, skipping header). */
export function parseGridCsvTopics(csv: string): string[] {
  const normalized = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const start = lines[0]?.toLowerCase().startsWith("topic") ? 1 : 0;
  const topics: string[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(start)) {
    if (!line.trim()) continue;
    const topic = firstCsvField(line).trim();
    if (!topic) continue;
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(topic);
  }
  return topics;
}

function firstCsvField(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith('"')) {
    let end = 1;
    while (end < trimmed.length) {
      if (trimmed[end] === '"' && trimmed[end + 1] === '"') {
        end += 2;
        continue;
      }
      if (trimmed[end] === '"') {
        return trimmed.slice(1, end).replaceAll('""', '"');
      }
      end += 1;
    }
    return trimmed.slice(1).replaceAll('""', '"');
  }
  const comma = trimmed.indexOf(",");
  return comma < 0 ? trimmed : trimmed.slice(0, comma).trim();
}

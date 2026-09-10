export type GridStatus = "draft" | "ready" | "running" | "complete";
export type GridRowStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";
export type GridRunMode = "sample" | "full";
export type GridRunStatus = "queued" | "running" | "succeeded" | "failed";
export type GridColumnKind = "input" | "agent" | "output";
export type GridScheduleCadence = "none" | "daily" | "weekly" | "monthly";

export type GridSchedule = Readonly<{
  cadence: GridScheduleCadence;
  enabled: boolean;
  mode: GridRunMode;
  sampleSize: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
}>;

export type GridColumn = Readonly<{
  key: string;
  kind: GridColumnKind;
  label: string;
  capability?: string;
}>;

export type GridConfig = Readonly<{
  columns: readonly GridColumn[];
  creditsPerRow: number;
  executionNote: string;
  schedule?: GridSchedule;
  pipelineDefinitionId?: string | null;
  lastPipelineRunId?: string | null;
  roiProjection?: Readonly<{
    runId: string;
    artifactVersionId: string;
    artifactType?: string;
    expectedRoiPercent?: number | null;
    attachedAtUtc?: string | null;
  }> | null;
}>;

export type GridRow = Readonly<{
  id: string;
  rowIndex: number;
  input: Readonly<Record<string, unknown>>;
  output: Readonly<Record<string, unknown>> | null;
  status: GridRowStatus;
  error: string;
  updatedAt: string;
}>;

export type GridBudgetPreview = Readonly<{
  creditsPerRow: number;
  rowCount: number;
  estimatedCredits: number;
  note: string;
}>;

export type GridHistoryEntry = Readonly<{
  actor: string;
  mode: GridRunMode;
  status: GridRunStatus;
  startedAt: string;
  durationMs: number;
  outputCount: number;
  estimatedCredits: number;
}>;

export type GridRun = Readonly<{
  id: string;
  mode: GridRunMode;
  sampleSize: number | null;
  status: GridRunStatus;
  actor: string;
  startedAt: string;
  completedAt: string | null;
  outputCount: number;
  budgetPreview: GridBudgetPreview;
  history: readonly GridHistoryEntry[];
}>;

export type Grid = Readonly<{
  id: string;
  name: string;
  description: string;
  status: GridStatus;
  updatedAt: string;
  owner: string;
  persistence: "server";
  config: GridConfig;
  rows: readonly GridRow[];
  runs: readonly GridRun[];
}>;

export type GridSummary = Readonly<{
  id: string;
  name: string;
  description: string;
  status: GridStatus;
  updatedAt: string;
  owner: string;
  rowCount: number;
  lastRunStatus: string | null;
  persistence: "server";
  schedule?: Readonly<{
    cadence: GridScheduleCadence;
    enabled: boolean;
    mode: GridRunMode;
    sampleSize: number;
    nextRunAt: string | null;
    lastRunAt: string | null;
    due: boolean;
  }>;
}>;

export const PIPELINE_LIFECYCLE_STAGES = [
  "plan",
  "create",
  "adapt",
  "activate",
  "optimize",
] as const;

export type PipelineLifecycleStage = (typeof PIPELINE_LIFECYCLE_STAGES)[number];
export type PipelineDefinitionStatus = "draft" | "published" | "deprecated";
export type PipelineRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "succeeded"
  | "failed"
  | "cancelled";
export type PipelineWorkItemStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "skipped";
export type PipelineStageAttemptStatus =
  | "pending"
  | "running"
  | "awaiting-approval"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "skipped";
export type PipelineStageKind = "task-agent" | "handoff" | "approval";

export type PipelineStage = Readonly<{
  key: string;
  lifecycle: PipelineLifecycleStage | string;
  kind: PipelineStageKind | string;
  displayName: string;
  capabilityId?: string | null;
  handoff?: string | null;
  dependsOn?: readonly string[];
}>;

export type PipelineStageAttempt = Readonly<{
  id: string;
  stageKey: string;
  lifecycleStage: string;
  kind: string;
  displayName: string;
  capabilityId: string | null;
  handoff: string | null;
  attemptNumber: number;
  status: PipelineStageAttemptStatus | string;
  output: unknown;
  error: string | null;
  startedAtUtc: string;
  completedAtUtc: string | null;
  taskRunId?: string | null;
  artifactVersionId?: string | null;
}>;

export type PipelineWorkItem = Readonly<{
  id: string;
  workItemIndex: number;
  status: PipelineWorkItemStatus | string;
  error: string | null;
  updatedAtUtc: string;
  stageAttempts: readonly PipelineStageAttempt[];
}>;

export type PipelineRun = Readonly<{
  id: string;
  definitionVersionNumber: number;
  definitionDigest: string;
  status: PipelineRunStatus | string;
  actorUserId: string;
  startedAtUtc: string;
  completedAtUtc: string | null;
  pausedAtUtc: string | null;
  error: string | null;
  history: unknown;
  workItems: readonly PipelineWorkItem[];
}>;

export type PipelineDefinition = Readonly<{
  id: string;
  name: string;
  description: string;
  status: PipelineDefinitionStatus | string;
  versionNumber: number;
  digest: string;
  stages: readonly PipelineStage[];
  policyJson?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  runs: readonly PipelineRun[];
}>;

export type PipelineSummary = Readonly<{
  id: string;
  name: string;
  description: string;
  status: PipelineDefinitionStatus | string;
  versionNumber: number;
  digest: string;
  updatedAtUtc: string;
  runCount: number;
}>;

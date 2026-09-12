export type SharedContextPin = {
  contextManifestId?: string | null;
  contextManifestDigest?: string | null;
};

export type TaskAgentRunEvent = {
  contractVersion: "gcc-task-agent-run-event.v1";
  kind: "snapshot" | "update";
  runId: string;
  seq: number;
  status: string;
  phase: string;
  progressPercent: number;
  terminalError: string | null;
  sharedContext: SharedContextPin | null;
  message: string | null;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("Task agent run event must be an object.");
  return value as Record<string, unknown>;
}

function text(source: Record<string, unknown>, key: string, required = false): string {
  const value = source[key];
  if (typeof value === "string") return value;
  if (required) throw new Error(`Task agent run event missing ${key}.`);
  return "";
}

function number(source: Record<string, unknown>, key: string, required = false): number {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (required) throw new Error(`Task agent run event missing ${key}.`);
  return 0;
}

function sharedContextPin(value: unknown): SharedContextPin | null {
  if (value === null || value === undefined) return null;
  const source = record(value);
  return {
    contextManifestId: text(source, "contextManifestId") || null,
    contextManifestDigest: text(source, "contextManifestDigest") || null,
  };
}

export function normalizeTaskAgentRunEvent(value: unknown): TaskAgentRunEvent {
  const source = record(value);
  if (source.contractVersion !== "gcc-task-agent-run-event.v1") {
    throw new Error("Unsupported task agent run event contract.");
  }
  const kind = text(source, "kind", true);
  if (kind !== "snapshot" && kind !== "update") {
    throw new Error("Task agent run event kind must be snapshot or update.");
  }
  return {
    contractVersion: "gcc-task-agent-run-event.v1",
    kind,
    runId: text(source, "runId", true),
    seq: number(source, "seq", true),
    status: text(source, "status", true),
    phase: text(source, "phase", true),
    progressPercent: number(source, "progressPercent"),
    terminalError: text(source, "terminalError") || null,
    sharedContext: sharedContextPin(source.sharedContext),
    message: text(source, "message") || null,
  };
}

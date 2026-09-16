import type { HubConnection } from "@microsoft/signalr";
import { createJobHubConnection } from "@/app/auth/job-hub";
import {
  normalizeTaskAgentRunEvent,
  type TaskAgentRunEvent,
} from "@/app/task-agents/task-agent-contract";

export function createTaskAgentRunHubConnection(): HubConnection {
  return createJobHubConnection();
}

export async function joinTaskAgentRun(connection: HubConnection, runId: string): Promise<void> {
  if (connection.state === "Disconnected") await connection.start();
  await connection.invoke("JoinTaskAgentRun", runId);
}

export async function leaveTaskAgentRun(connection: HubConnection, runId: string): Promise<void> {
  if (connection.state !== "Disconnected") await connection.invoke("LeaveTaskAgentRun", runId);
}

export function onTaskAgentRunEvent(
  connection: HubConnection,
  handler: (event: TaskAgentRunEvent) => void,
  onContractError: (error: Error) => void,
): () => void {
  const listener = (raw: unknown) => {
    try {
      handler(normalizeTaskAgentRunEvent(raw));
    } catch (cause) {
      onContractError(cause instanceof Error ? cause : new Error("Invalid task agent run event."));
    }
  };
  connection.on("TaskAgentRunEvent", listener);
  return () => connection.off("TaskAgentRunEvent", listener);
}

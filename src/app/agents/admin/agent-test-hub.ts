import type { HubConnection } from "@microsoft/signalr";
import { createJobHubConnection } from "@/app/auth/job-hub";
import { normalizeAgentTestEvent, type AgentTestEvent } from "@/app/agents/agent-contract";

export function createAgentTestHubConnection(): HubConnection {
  return createJobHubConnection();
}

export async function joinAgentTest(connection: HubConnection, runId: string): Promise<void> {
  if (connection.state === "Disconnected") await connection.start();
  await connection.invoke("JoinAgentTest", runId);
}

export async function leaveAgentTest(connection: HubConnection, runId: string): Promise<void> {
  if (connection.state !== "Disconnected") await connection.invoke("LeaveAgentTest", runId);
}

export function onAgentTestEvent(
  connection: HubConnection,
  handler: (event: AgentTestEvent) => void,
  onContractError: (error: Error) => void,
): () => void {
  const listener = (raw: unknown) => {
    try {
      handler(normalizeAgentTestEvent(raw));
    } catch (cause) {
      onContractError(cause instanceof Error ? cause : new Error("Invalid agent test event."));
    }
  };
  connection.on("AgentTestEvent", listener);
  return () => connection.off("AgentTestEvent", listener);
}

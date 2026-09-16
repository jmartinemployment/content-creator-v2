import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import type { GeneratedContentSet, ToolsGenerationJob } from "@/lib/types";
import { apiConfig } from "@/lib/config";

export type ToolsJobEvent = {
  jobId: string;
  projectId: string;
  kind: string;
  status: string;
  completed: number;
  total: number;
  error?: string | null;
  contentSet?: GeneratedContentSet | null;
};

function hubUrl(): string {
  const override = process.env.NEXT_PUBLIC_WORKFLOW_HUB_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return `${apiConfig.baseUrl}/hubs/workflow-realtime`;
}

async function hubAccessToken(): Promise<string> {
  const res = await fetch("/api/auth/hub-token", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not get hub token");
  const body = (await res.json()) as { accessToken?: string };
  if (!body.accessToken) throw new Error("Hub token missing");
  return body.accessToken;
}

export function mapToolsJobEvent(evt: ToolsJobEvent): ToolsGenerationJob {
  return {
    jobId: evt.jobId,
    projectId: evt.projectId,
    kind: evt.kind,
    status: evt.status,
    completed: evt.completed,
    total: evt.total,
    error: evt.error ?? null,
    contentSet: evt.contentSet ?? null,
  };
}

export function createWorkflowHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(hubUrl(), { accessTokenFactory: hubAccessToken })
    .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build();
}

export async function joinToolsJob(connection: HubConnection, jobId: string): Promise<void> {
  if (connection.state === HubConnectionState.Disconnected) {
    await connection.start();
  }
  await connection.invoke("JoinToolsJob", jobId);
}

export function onToolsJobEvent(
  connection: HubConnection,
  handler: (evt: ToolsJobEvent) => void,
): () => void {
  const listener = (raw: unknown) => handler(raw as ToolsJobEvent);
  connection.on("ToolsJobEvent", listener);
  return () => connection.off("ToolsJobEvent", listener);
}

export function onToolsJobHubReconnected(
  connection: HubConnection,
  getJobId: () => string,
): () => void {
  const handler = async () => {
    try {
      const jobId = getJobId();
      if (!jobId) return;
      await connection.invoke("JoinToolsJob", jobId);
    } catch {
      /* caller may surface connection errors separately */
    }
  };
  connection.onreconnected(handler);
  return () => connection.off("reconnected", handler);
}

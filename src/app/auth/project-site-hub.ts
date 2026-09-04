import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { apiConfig } from "@/app/auth/config";

export type ProjectSiteCrawlEvent = {
  runId: string;
  siteUrl: string;
  status: string;
  errorSummary?: string | null;
  pageCount?: number;
};

function hubUrl(): string {
  const override = process.env.NEXT_PUBLIC_GCC_V2_HUB_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return `${apiConfig.baseUrl}/hubs/gcc-v2-realtime`;
}

async function hubAccessToken(): Promise<string> {
  const res = await fetch("/api/auth/hub-token", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not get hub token");
  const body = (await res.json()) as { accessToken?: string };
  if (!body.accessToken) throw new Error("Hub token missing");
  return body.accessToken;
}

export function createProjectSiteHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(hubUrl(), { accessTokenFactory: hubAccessToken })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
    .configureLogging(LogLevel.Error)
    .build();
}

export async function joinProjectSiteCrawl(
  connection: HubConnection,
  runId: string,
): Promise<void> {
  if (connection.state === HubConnectionState.Disconnected) {
    await connection.start();
  }
  await connection.invoke("JoinProjectSiteCrawl", runId);
}

export function onProjectSiteCrawlEvent(
  connection: HubConnection,
  handler: (evt: ProjectSiteCrawlEvent) => void,
): () => void {
  const listener = (raw: unknown) => handler(raw as ProjectSiteCrawlEvent);
  connection.on("ProjectSiteCrawlEvent", listener);
  return () => connection.off("ProjectSiteCrawlEvent", listener);
}

export function onProjectSiteHubReconnected(
  connection: HubConnection,
  getRunId: () => string,
): () => void {
  const handler = async () => {
    try {
      const runId = getRunId();
      if (!runId) return;
      await connection.invoke("JoinProjectSiteCrawl", runId);
    } catch {
      /* caller may surface connection errors separately */
    }
  };
  connection.onreconnected(handler);
  return () => connection.off("reconnected", handler);
}

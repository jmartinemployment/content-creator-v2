import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { apiConfig } from "./config";
import type { IngestionEvent } from "@/app/brand-sources/context-contract";

function hubUrl(): string {
  const override = process.env.NEXT_PUBLIC_GCC_V2_HUB_URL?.trim();
  return override ? override.replace(/\/$/, "") : `${apiConfig.baseUrl}/hubs/gcc-v2-realtime`;
}

async function accessToken(): Promise<string> {
  const response = await fetch("/api/auth/hub-token", { cache: "no-store" });
  const body = await response.json().catch(() => null) as { accessToken?: string } | null;
  if (!response.ok || !body?.accessToken) throw new Error("Could not authorize ingestion updates.");
  return body.accessToken;
}

export function createContextIngestionConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(hubUrl(), { accessTokenFactory: accessToken })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
    .configureLogging(LogLevel.Error)
    .build();
}

export async function joinContextIngestion(connection: HubConnection, lastSeq: number): Promise<void> {
  if (connection.state === HubConnectionState.Disconnected) await connection.start();
  await connection.invoke("JoinContextIngestion", lastSeq);
}

export function onContextIngestionEvent(
  connection: HubConnection,
  handler: (event: IngestionEvent) => void,
): () => void {
  const listener = (event: unknown) => handler(event as IngestionEvent);
  connection.on("ContextIngestionEvent", listener);
  return () => connection.off("ContextIngestionEvent", listener);
}

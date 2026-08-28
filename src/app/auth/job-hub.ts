import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { apiConfig } from "@/app/auth/config";

/** Mirrors GeekAPI's GccV2JobEventDto (camelCase). */
export type GccV2JobEvent = {
  id: string;
  jobId: string;
  seq: number;
  type: string;
  payloadJson: string;
  createdAtUtc: string;
};

function hubUrl(): string {
  const override = process.env.NEXT_PUBLIC_GCC_V2_HUB_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return `${apiConfig.baseUrl}/hubs/gcc-v2-realtime`;
}

/** Route handler reads the httpOnly access-token cookie — SignalR JS can't read it directly. */
async function hubAccessToken(): Promise<string> {
  const res = await fetch("/api/auth/hub-token", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not get hub token");
  const body = (await res.json()) as { accessToken?: string };
  if (!body.accessToken) throw new Error("Hub token missing");
  return body.accessToken;
}

export function createJobHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(hubUrl(), { accessTokenFactory: hubAccessToken })
    .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build();
}

/**
 * Starts the connection if needed and joins a job's group. `JoinJob` on the server replays every
 * event after `lastSeq` before this resolves, so callers never need to poll to catch up.
 */
export async function joinJob(
  connection: HubConnection,
  jobId: string,
  lastSeq: number,
): Promise<void> {
  if (connection.state === HubConnectionState.Disconnected) {
    await connection.start();
  }
  await connection.invoke("JoinJob", jobId, lastSeq);
}

/** Re-join the job group after SignalR automatic reconnect (new connection id). */
export function onHubReconnected(
  connection: HubConnection,
  jobId: string,
  getLastSeq: () => number,
): () => void {
  const handler = async () => {
    try {
      await connection.invoke("JoinJob", jobId, getLastSeq());
    } catch {
      /* caller may surface connection errors separately */
    }
  };
  connection.onreconnected(handler);
  return () => connection.off("reconnected", handler);
}

export function onJobEvent(
  connection: HubConnection,
  handler: (evt: GccV2JobEvent) => void,
): () => void {
  const listener = (raw: unknown) => handler(raw as GccV2JobEvent);
  connection.on("JobEvent", listener);
  return () => connection.off("JobEvent", listener);
}

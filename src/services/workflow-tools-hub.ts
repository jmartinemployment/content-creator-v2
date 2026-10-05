import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { apiConfig } from "@/lib/config";

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

export function createWorkflowHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(hubUrl(), { accessTokenFactory: hubAccessToken })
    .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build();
}

/* ---------------------------------------------------------------------------
 * Content Creator generate.
 *
 * Generate moved off a held-open HTTP request because one run is partner extraction plus a
 * multi-call write per selected content type, which outlives any gateway between here and GeekAPI.
 * See plans/generate-async-signalr.md.
 * ------------------------------------------------------------------------ */

/** Overall job status. `resultJson` carries the aggregate once status is "ready". */
export type GccGenerateEvent = {
  jobId: string;
  createId: string;
  kind: string;
  status: "running" | "ready" | "failed" | string;
  error?: string | null;
  resultJson?: string | null;
  completedAtUtc?: string | null;
};

/** One per requested content type, sent the moment that type finishes. */
export type GccGenerateTypeEvent = {
  jobId: string;
  contentType: string;
  /** "warning": the piece was saved, and `error` names a gap it ships with (a partner it never
   *  named, a closing without the scheduler link). Not an outcome -- that arrived as "ready". */
  status: "ready" | "failed" | "warning" | string;
  artifact?: unknown;
  error?: string | null;
};

/**
 * One partner's readiness to ground a tool page, decided before anything is drafted.
 *
 * `coverage` is the operator-facing reason and separates the two causes that look identical in the
 * counts: an extraction *fault* ("the provider call threw") and a partner whose retrieved pages
 * genuinely carry nothing the schema covers. `pagesFailed > 0` is the fault.
 */
export type GccPartnerToolReadiness = {
  productName: string;
  host: string;
  ready: boolean;
  coverage: string;
  pagesAttempted: number;
  pagesFailed: number;
  populatedCategories: number;
  /**
   * How many categories `populatedCategories` is out of -- the number the gate counts across, sent
   * with the count. The page had "of 22" written into it and went on saying 22 after the schema
   * dropped to twenty. Absent on a run recorded before the server sent it.
   */
  totalCategories?: number;
  hasCapabilitySignal: boolean;
  /** The extraction was read from the bank rather than paid for on this run. */
  reused?: boolean;
  bankedAtUtc?: string | null;
};

/**
 * The tool pre-flight, sent BEFORE any tool page is drafted — the whole point is that it arrives
 * early enough to be acted on. Its own event because a type event's status is terminal
 * (`ready`/`failed`) and this is neither.
 */
export type GccGeneratePreflightEvent = {
  jobId: string;
  contentType: string;
  ready: number;
  total: number;
  partners: GccPartnerToolReadiness[];
};

export async function joinGccGenerate(connection: HubConnection, jobId: string): Promise<void> {
  if (connection.state === HubConnectionState.Disconnected) {
    await connection.start();
  }
  await connection.invoke("JoinGccGenerate", jobId);
}

export function onGccGenerateEvent(
  connection: HubConnection,
  handler: (evt: GccGenerateEvent) => void,
): () => void {
  const listener = (raw: unknown) => handler(raw as GccGenerateEvent);
  connection.on("GccGenerateEvent", listener);
  return () => connection.off("GccGenerateEvent", listener);
}

export function onGccGenerateTypeEvent(
  connection: HubConnection,
  handler: (evt: GccGenerateTypeEvent) => void,
): () => void {
  const listener = (raw: unknown) => handler(raw as GccGenerateTypeEvent);
  connection.on("GccGenerateTypeEvent", listener);
  return () => connection.off("GccGenerateTypeEvent", listener);
}

export function onGccGeneratePreflightEvent(
  connection: HubConnection,
  handler: (evt: GccGeneratePreflightEvent) => void,
): () => void {
  const listener = (raw: unknown) => handler(raw as GccGeneratePreflightEvent);
  connection.on("GccGeneratePreflightEvent", listener);
  return () => connection.off("GccGeneratePreflightEvent", listener);
}

/**
 * Rejoin after a dropped connection. The job group is per-connection, so a reconnect that does not
 * rejoin silently stops receiving events while looking perfectly healthy.
 *
 * A rejoin that fails is handed to `onRejoinRefused`, never swallowed. It was swallowed, on the
 * reasoning that the caller surfaces connection problems -- but the caller is told about a closed
 * connection, and this is an open one the job is no longer on. The hub refuses the join by name when
 * it does not hold the job (its store is in memory, so a restart loses every job), and a page that
 * is not told goes on showing a run it will never hear from again.
 */
export function onGccGenerateReconnected(
  connection: HubConnection,
  getJobId: () => string | null,
  onRejoinRefused: (jobId: string, error: unknown) => void,
): () => void {
  const handler = async () => {
    const jobId = getJobId();
    if (!jobId) return;
    try {
      await connection.invoke("JoinGccGenerate", jobId);
    } catch (err) {
      onRejoinRefused(jobId, err);
    }
  };
  connection.onreconnected(handler);
  return () => connection.off("reconnected", handler);
}

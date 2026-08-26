"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import {
  createJobHubConnection,
  joinJob,
  onJobEvent,
  type GccV2JobEvent,
} from "@/app/auth/job-hub";

type LogEntry = { seq: number; type: string; payload: unknown; atUtc: string };

type JobRunnerProps = {
  /**
   * When set, skips the "start dummy job" button and auto-connects to this job instead — used by
   * `/creates/[id]` right after Generate has already created the job. When omitted, renders the
   * original Phase 3 smoke-test flow (create a dummy job from scratch).
   */
  jobId?: string;
  /** Display-only — the job itself is already fully scoped by `jobId`. */
  createId?: string;
};

/**
 * Event-driven job viewer: create → generate → hub replay/stream → approve outline
 * → write/validate → done. No polling anywhere — all state comes from hub pushes.
 */
export function JobRunner({ jobId: initialJobId, createId }: JobRunnerProps = {}) {
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null);
  const [status, setStatus] = useState<string | null>(initialJobId ? "pending" : null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const connectionRef = useRef<HubConnection | null>(null);
  const lastSeqRef = useRef(0);

  const appendEvent = useCallback((evt: GccV2JobEvent) => {
    if (evt.seq <= lastSeqRef.current) return; // replay + live push can overlap
    lastSeqRef.current = evt.seq;

    let payload: unknown = evt.payloadJson;
    try {
      payload = JSON.parse(evt.payloadJson);
    } catch {
      // keep the raw string if it isn't JSON
    }

    setLog((prev) => [...prev, { seq: evt.seq, type: evt.type, payload, atUtc: evt.createdAtUtc }]);

    if (evt.type === "OutlineReady") setAwaitingApproval(true);
    if (evt.type === "OutlineApproved") {
      setAwaitingApproval(false);
      setStatus("running");
    }
    if (evt.type === "JobCompleted") {
      setAwaitingApproval(false);
      setStatus("ready");
    }
    if (evt.type === "JobCanceled") {
      setAwaitingApproval(false);
      setStatus("canceled");
    }
  }, []);

  const connectToJob = useCallback(
    async (id: string) => {
      let connection = connectionRef.current;
      if (!connection) {
        connection = createJobHubConnection();
        connectionRef.current = connection;
        onJobEvent(connection, appendEvent);
      }
      lastSeqRef.current = 0;
      setLog([]);
      await joinJob(connection, id, 0);
    },
    [appendEvent],
  );

  useEffect(() => {
    if (!initialJobId) return;
    connectToJob(initialJobId).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not connect to job");
    });
    // Intentionally only reruns if the job id itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId]);

  async function startJob() {
    setBusy(true);
    setError(null);
    setAwaitingApproval(false);
    try {
      const createRes = await fetch("/api/gcc-v2/creates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `Dummy job ${new Date().toLocaleTimeString()}`,
          contentType: "blog",
        }),
      });
      if (!createRes.ok) {
        const detail = (await createRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          detail?.error ||
            `create failed: HTTP ${createRes.status} — use /creates/new for the URL-first BrandKit flow`,
        );
      }
      const create = (await createRes.json()) as { id: string };

      const genRes = await fetch(`/api/gcc-v2/creates/${create.id}/generate`, { method: "POST" });
      if (!genRes.ok) throw new Error(`generate failed: HTTP ${genRes.status}`);
      const { jobId: newJobId } = (await genRes.json()) as { jobId: string };

      setJobId(newJobId);
      setStatus("pending");
      await connectToJob(newJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start job");
    } finally {
      setBusy(false);
    }
  }

  async function approveOutline() {
    if (!jobId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/approve-outline`, { method: "POST" });
      if (!res.ok) throw new Error(`approve failed: HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve outline");
    } finally {
      setBusy(false);
    }
  }

  async function cancelJob() {
    if (!jobId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(`cancel failed: HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel job");
    } finally {
      setBusy(false);
    }
  }

  const isTerminal = status === "ready" || status === "canceled";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--cc-line)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!initialJobId ? (
          <button
            type="button"
            onClick={startJob}
            disabled={busy}
            className="rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy && !jobId ? "Starting…" : "Start dummy job"}
          </button>
        ) : null}

        {awaitingApproval ? (
          <button
            type="button"
            onClick={approveOutline}
            disabled={busy}
            className="rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Approve outline
          </button>
        ) : null}

        {jobId && !isTerminal ? (
          <button
            type="button"
            onClick={cancelJob}
            disabled={busy}
            className="rounded-md border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold text-[var(--cc-ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {jobId ? (
        <p className="text-xs text-[var(--cc-muted)]">
          {createId ? `create ${createId} — ` : ""}job {jobId} — {status ?? "…"}
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {log.length > 0 ? (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md bg-black/5 p-2 text-xs">
          {log.map((entry) => (
            <li key={entry.seq} className="font-mono">
              <span className="text-[var(--cc-accent)]">#{entry.seq}</span>{" "}
              <span className="font-semibold">{entry.type}</span>{" "}
              <span className="text-[var(--cc-muted)]">{JSON.stringify(entry.payload)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

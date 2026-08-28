"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { HubConnection } from "@microsoft/signalr";
import { HubConnectionState } from "@microsoft/signalr";
import {
  createJobHubConnection,
  joinJob,
  onHubReconnected,
  onJobEvent,
  type GccV2JobEvent,
} from "@/app/auth/job-hub";
import {
  applyJobEventToSnapshot,
  sortJobs,
  type JobSnapshot,
} from "@/app/creates/job-snapshot";

type CreateJobHubContextValue = {
  jobs: JobSnapshot[];
  hubError: string | null;
  hubConnected: boolean;
  subscribeJobEvents: (handler: (evt: GccV2JobEvent) => void) => () => void;
  joinActiveJob: (jobId: string, lastSeq: number) => Promise<void>;
  /** One-shot fetch after operator action (retry) — not a poll loop. */
  reloadJob: (jobId: string) => Promise<void>;
  /** One-shot when spawn adds sibling jobs — event-driven, not interval. */
  reloadAllJobs: () => Promise<void>;
};

const CreateJobHubContext = createContext<CreateJobHubContextValue | null>(null);

export function useCreateJobHub(): CreateJobHubContextValue {
  const ctx = useContext(CreateJobHubContext);
  if (!ctx) throw new Error("useCreateJobHub must be used within CreateJobHubProvider");
  return ctx;
}

type CreateJobHubProviderProps = {
  createId: string;
  activeJobId: string;
  initialJobs: JobSnapshot[];
  children: ReactNode;
};

export function CreateJobHubProvider({
  createId,
  activeJobId,
  initialJobs,
  children,
}: CreateJobHubProviderProps) {
  const [jobs, setJobs] = useState<JobSnapshot[]>(() => sortJobs(initialJobs));
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubConnected, setHubConnected] = useState(false);

  const connectionRef = useRef<HubConnection | null>(null);
  const subscribersRef = useRef(new Set<(evt: GccV2JobEvent) => void>());
  const activeJobIdRef = useRef(activeJobId);
  const joinedJobIdRef = useRef<string | null>(null);
  const activeLastSeqRef = useRef(0);

  activeJobIdRef.current = activeJobId;

  const applyEventToJobs = useCallback((evt: GccV2JobEvent) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === evt.jobId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = applyJobEventToSnapshot(next[idx]!, evt);
      return sortJobs(next);
    });
  }, []);

  const fetchJob = useCallback(async (jobId: string): Promise<JobSnapshot | null> => {
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}`, { cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as JobSnapshot;
      return body?.id ? body : null;
    } catch {
      return null;
    }
  }, []);

  const ensureJobKnown = useCallback(
    async (jobId: string) => {
      let missing = false;
      setJobs((prev) => {
        missing = !prev.some((j) => j.id === jobId);
        return prev;
      });
      if (!missing) return;

      const fetched = await fetchJob(jobId);
      if (!fetched) return;
      setJobs((prev) => {
        if (prev.some((j) => j.id === jobId)) return prev;
        return sortJobs([...prev, fetched]);
      });
    },
    [fetchJob],
  );

  const reloadAllJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/gcc-v2/creates/${createId}/jobs`, { cache: "no-store" });
      if (!res.ok) {
        setHubError("Could not reload job list");
        return;
      }
      const body = (await res.json()) as JobSnapshot[];
      if (Array.isArray(body)) {
        setJobs(sortJobs(body));
        setHubError(null);
      }
    } catch {
      setHubError("Could not reload job list");
    }
  }, [createId]);

  const reloadJob = useCallback(
    async (jobId: string) => {
      const fetched = await fetchJob(jobId);
      if (!fetched) return;
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === jobId);
        if (idx === -1) return sortJobs([...prev, fetched]);
        const next = [...prev];
        next[idx] = fetched;
        return sortJobs(next);
      });
    },
    [fetchJob],
  );

  const dispatchEvent = useCallback(
    (evt: GccV2JobEvent) => {
      applyEventToJobs(evt);
      if (evt.type === "ImagePromptSpawnCompleted") {
        void reloadAllJobs();
      }
      void ensureJobKnown(evt.jobId);
      for (const sub of subscribersRef.current) sub(evt);
    },
    [applyEventToJobs, ensureJobKnown, reloadAllJobs],
  );

  const subscribeJobEvents = useCallback((handler: (evt: GccV2JobEvent) => void) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  const joinActiveJob = useCallback(async (jobId: string, lastSeq: number) => {
    activeLastSeqRef.current = lastSeq;
    const connection = connectionRef.current;
    if (!connection || connection.state === HubConnectionState.Disconnected) return;

    if (joinedJobIdRef.current && joinedJobIdRef.current !== jobId) {
      try {
        await connection.invoke("LeaveJob", joinedJobIdRef.current);
      } catch {
        /* best-effort */
      }
    }

    await joinJob(connection, jobId, lastSeq);
    joinedJobIdRef.current = jobId;
  }, []);

  useEffect(() => {
    setJobs(sortJobs(initialJobs));
  }, [initialJobs]);

  useEffect(() => {
    let cancelled = false;
    const connection = createJobHubConnection();
    connectionRef.current = connection;

    const offEvents = onJobEvent(connection, (evt) => {
      if (!cancelled) dispatchEvent(evt);
    });

    const offReconnected = onHubReconnected(
      connection,
      () => activeJobIdRef.current,
      () => activeLastSeqRef.current,
    );

    connection.onclose((err) => {
      if (cancelled) return;
      setHubConnected(false);
      if (err) setHubError("Lost connection to job stream — refresh the page.");
    });

    connection.onreconnected(() => {
      if (cancelled) return;
      setHubConnected(true);
      setHubError(null);
    });

    void (async () => {
      try {
        await connection.start();
        if (cancelled) return;
        setHubConnected(true);
        setHubError(null);
        await joinJob(connection, activeJobIdRef.current, 0);
        joinedJobIdRef.current = activeJobIdRef.current;
      } catch (err) {
        if (!cancelled) {
          setHubConnected(false);
          setHubError(err instanceof Error ? err.message : "Could not connect to job stream");
        }
      }
    })();

    return () => {
      cancelled = true;
      offEvents();
      offReconnected();
      void connection.stop();
      connectionRef.current = null;
      joinedJobIdRef.current = null;
    };
  }, [dispatchEvent]);

  const value = useMemo(
    () => ({
      jobs,
      hubError,
      hubConnected,
      subscribeJobEvents,
      joinActiveJob,
      reloadJob,
      reloadAllJobs,
    }),
    [hubConnected, hubError, jobs, joinActiveJob, reloadAllJobs, reloadJob, subscribeJobEvents],
  );

  return <CreateJobHubContext.Provider value={value}>{children}</CreateJobHubContext.Provider>;
}

"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { labelForContentType } from "@/app/creates/content-types";
import { useCreateJobHub } from "@/app/creates/create-job-hub-provider";
import type { JobSnapshot } from "@/app/creates/job-snapshot";
import {
  isJobQueued,
  isJobRunning,
  isJobStuckPending,
  jobProcessLabel,
  LoadingRow,
  LoadingSpinner,
} from "@/app/components/loading-indicator";

type CreateDraftTabsProps = {
  createId: string;
  activeJobId: string;
};

function isAwaitingGate(status: string): boolean {
  return status === "awaiting_brandkit_approval" || status === "awaiting_outline_approval";
}

function draftTabLabel(job: JobSnapshot): string {
  if (job.tabLabel?.trim()) return job.tabLabel.trim();
  return labelForContentType(job.contentType ?? "");
}

function truncateError(error: string, max = 80): string {
  const trimmed = error.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export function CreateDraftTabs({ createId, activeJobId }: CreateDraftTabsProps) {
  const { jobs, hubError, reloadJob, reloadAllJobs } = useCreateJobHub();
  const [retryBusy, setRetryBusy] = useState<string | null>(null);

  const notReadyCount = useMemo(() => jobs.filter((j) => j.status !== "ready").length, [jobs]);
  const runningJobs = useMemo(() => jobs.filter((j) => isJobRunning(j.status)), [jobs]);
  const queuedJobs = useMemo(() => jobs.filter((j) => isJobQueued(j.status)), [jobs]);
  const failedJobs = useMemo(() => jobs.filter((j) => j.status === "failed"), [jobs]);
  const awaitingJobs = useMemo(() => jobs.filter((j) => isAwaitingGate(j.status)), [jobs]);
  const stuckJobs = useMemo(
    () => queuedJobs.filter((j) => isJobStuckPending(j.updatedAtUtc)),
    [queuedJobs],
  );
  const activeJob = useMemo(() => jobs.find((j) => j.id === activeJobId), [jobs, activeJobId]);
  const activeRunning = activeJob ? isJobRunning(activeJob.status) : false;
  const siblingRunningCount = runningJobs.filter((j) => j.id !== activeJobId).length;

  const retryJob = useCallback(
    async (jobId: string) => {
      setRetryBusy(jobId);
      try {
        const res = await fetch(`/api/gcc-v2/jobs/${jobId}/retry`, { method: "POST" });
        if (!res.ok) return;
        await reloadJob(jobId);
      } finally {
        setRetryBusy(null);
      }
    },
    [reloadJob],
  );

  const retryAllStuck = useCallback(async () => {
    setRetryBusy("bulk");
    try {
      const res = await fetch(`/api/gcc-v2/creates/${createId}/retry-stuck-jobs`, { method: "POST" });
      if (!res.ok) return;
      await reloadAllJobs();
    } finally {
      setRetryBusy(null);
    }
  }, [createId, reloadAllJobs]);

  if (jobs.length === 0) return null;

  const showSiblingProgress = siblingRunningCount > 0 && !activeRunning;

  return (
    <>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Drafts for this create">
        {jobs.map((j) => {
          const active = j.id === activeJobId;
          const label = draftTabLabel(j);
          const running = isJobRunning(j.status);
          const failed = j.status === "failed";
          const stuck = isJobQueued(j.status) && isJobStuckPending(j.updatedAtUtc);
          const stageLabel = running ? jobProcessLabel(j.status, j.stage ?? null) : null;
          const tooltip = failed && j.error
            ? truncateError(j.error, 200)
            : stuck
              ? "Stuck in queue — retry"
              : (stageLabel ?? j.status);

          return (
            <Link
              key={j.id}
              href={`/creates/${createId}?jobId=${j.id}`}
              title={tooltip}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                failed
                  ? active
                    ? "bg-red-700 text-white"
                    : "border border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                  : stuck
                    ? active
                      ? "bg-amber-600 text-white"
                      : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    : active
                      ? "bg-[var(--cc-accent)] text-white"
                      : "border border-[var(--cc-line)] text-[var(--cc-ink)] hover:bg-black/5"
              }`}
            >
              {running ? <LoadingSpinner size="xs" /> : null}
              {label}
              <span className="opacity-70">· {j.status}</span>
              {failed && j.error ? (
                <span className="max-w-[8rem] truncate opacity-90">· {truncateError(j.error)}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {hubError ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {hubError}
        </p>
      ) : null}

      {showSiblingProgress ? (
        <LoadingRow
          className="mt-3 text-xs text-[var(--cc-ink)]"
          label={`${siblingRunningCount} other draft${siblingRunningCount === 1 ? "" : "s"} still generating — switch tabs to watch progress.`}
        />
      ) : null}

      {jobs.length > 1 && notReadyCount > 0 ? (
        <p className="mt-2 text-xs text-amber-800">
          {runningJobs.length > 0
            ? `${runningJobs.length} draft${runningJobs.length === 1 ? "" : "s"} generating`
            : null}
          {runningJobs.length > 0 && queuedJobs.length > 0 ? "; " : null}
          {queuedJobs.length > 0
            ? `${queuedJobs.length} draft${queuedJobs.length === 1 ? "" : "s"} queued (not started)`
            : null}
          {(runningJobs.length > 0 || queuedJobs.length > 0) && failedJobs.length > 0 ? "; " : null}
          {failedJobs.length > 0
            ? `${failedJobs.length} draft${failedJobs.length === 1 ? "" : "s"} failed — see tab errors`
            : null}
          {runningJobs.length === 0 && queuedJobs.length === 0 && failedJobs.length === 0 && awaitingJobs.length > 0
            ? `${awaitingJobs.length} awaiting approval`
            : null}
          {runningJobs.length === 0 &&
          queuedJobs.length === 0 &&
          failedJobs.length === 0 &&
          awaitingJobs.length === 0
            ? `${notReadyCount} draft${notReadyCount === 1 ? "" : "s"} not ready`
            : null}
          {" — Export skips jobs without a completed result."}
        </p>
      ) : null}

      {jobs.length > 1 && (failedJobs.length > 0 || stuckJobs.length > 0 || queuedJobs.some((j) => j.status === "running")) ? (
        <div className="mt-2 rounded-md border border-[var(--cc-line)] bg-black/[0.02] px-3 py-2 text-xs">
          <p className="font-medium text-[var(--cc-ink)]">Job status on this create</p>
          <ul className="mt-1 space-y-0.5 text-[var(--cc-muted)]">
            {jobs
              .filter((j) => j.status !== "ready" && !isAwaitingGate(j.status))
              .map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[var(--cc-ink)]">{draftTabLabel(j)}</span>
                  <span>· {j.status}</span>
                  {j.error ? <span className="text-red-700">· {truncateError(j.error, 120)}</span> : null}
                  {(j.status === "failed" || (isJobQueued(j.status) && isJobStuckPending(j.updatedAtUtc))) &&
                  j.id !== retryBusy ? (
                    <button
                      type="button"
                      className="text-[var(--cc-accent)] underline"
                      onClick={() => void retryJob(j.id)}
                    >
                      retry
                    </button>
                  ) : null}
                  {retryBusy === j.id ? <span>retrying…</span> : null}
                </li>
              ))}
          </ul>
          {stuckJobs.length > 1 ? (
            <button
              type="button"
              className="mt-2 text-[var(--cc-accent)] underline"
              disabled={retryBusy === "bulk"}
              onClick={() => void retryAllStuck()}
            >
              {retryBusy === "bulk" ? "Retrying stuck jobs…" : "Retry all stuck jobs on this create"}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

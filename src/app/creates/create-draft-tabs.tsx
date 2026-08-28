"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { labelForContentType } from "@/app/creates/content-types";
import {
  isJobProcessing,
  jobProcessLabel,
  LoadingRow,
  LoadingSpinner,
} from "@/app/components/loading-indicator";

type JobDto = { id: string; status: string; stage?: string; contentType?: string };

type CreateDraftTabsProps = {
  createId: string;
  activeJobId: string;
  initialJobs: JobDto[];
};

const GENERATE_TYPE_ORDER = ["pillar", "blog", "tool", "email", "social", "ads", "image-prompt"];

function sortJobs(jobs: JobDto[]): JobDto[] {
  return [...jobs].sort((a, b) => {
    const ai = GENERATE_TYPE_ORDER.indexOf((a.contentType ?? "").toLowerCase());
    const bi = GENERATE_TYPE_ORDER.indexOf((b.contentType ?? "").toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function isAwaitingGate(status: string): boolean {
  return status === "awaiting_brandkit_approval" || status === "awaiting_outline_approval";
}

export function CreateDraftTabs({ createId, activeJobId, initialJobs }: CreateDraftTabsProps) {
  const [jobs, setJobs] = useState<JobDto[]>(() => sortJobs(initialJobs));

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/gcc-v2/creates/${createId}/jobs`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as JobDto[];
      if (Array.isArray(body)) setJobs(sortJobs(body));
    } catch {
      /* keep last known list */
    }
  }, [createId]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const notReadyCount = useMemo(() => jobs.filter((j) => j.status !== "ready").length, [jobs]);
  const processingJobs = useMemo(() => jobs.filter((j) => isJobProcessing(j.status)), [jobs]);
  const awaitingJobs = useMemo(() => jobs.filter((j) => isAwaitingGate(j.status)), [jobs]);
  const activeJob = useMemo(() => jobs.find((j) => j.id === activeJobId), [jobs, activeJobId]);
  const activeProcessing = activeJob ? isJobProcessing(activeJob.status) : false;
  const siblingProcessingCount = processingJobs.filter((j) => j.id !== activeJobId).length;

  useEffect(() => {
    if (notReadyCount === 0) return;
    const id = window.setInterval(() => void refreshJobs(), 12_000);
    return () => window.clearInterval(id);
  }, [notReadyCount, refreshJobs]);

  if (jobs.length === 0) return null;

  const showSiblingProgress =
    siblingProcessingCount > 0 && !activeProcessing;

  return (
    <>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Drafts for this create">
        {jobs.map((j) => {
          const active = j.id === activeJobId;
          const label = labelForContentType(j.contentType ?? "");
          const processing = isJobProcessing(j.status);
          const stageLabel = processing ? jobProcessLabel(j.status, j.stage ?? null) : null;
          return (
            <Link
              key={j.id}
              href={`/creates/${createId}?jobId=${j.id}`}
              title={stageLabel ?? j.status}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                active
                  ? "bg-[var(--cc-accent)] text-white"
                  : "border border-[var(--cc-line)] text-[var(--cc-ink)] hover:bg-black/5"
              }`}
            >
              {processing ? <LoadingSpinner size="xs" /> : null}
              {label}
              <span className="opacity-70">· {j.status}</span>
            </Link>
          );
        })}
      </nav>

      {showSiblingProgress ? (
        <LoadingRow
          className="mt-3 text-xs text-[var(--cc-ink)]"
          label={`${siblingProcessingCount} other draft${siblingProcessingCount === 1 ? "" : "s"} still generating — switch tabs to watch progress.`}
        />
      ) : null}

      {jobs.length > 1 && notReadyCount > 0 ? (
        <p className="mt-2 text-xs text-amber-800">
          {processingJobs.length > 0
            ? `${processingJobs.length} draft${processingJobs.length === 1 ? "" : "s"} generating`
            : null}
          {processingJobs.length > 0 && awaitingJobs.length > 0 ? "; " : null}
          {awaitingJobs.length > 0
            ? `${awaitingJobs.length} awaiting approval`
            : null}
          {processingJobs.length === 0 && awaitingJobs.length === 0
            ? `${notReadyCount} draft${notReadyCount === 1 ? "" : "s"} not ready`
            : null}
          {" — Export skips jobs without a completed result."}
        </p>
      ) : null}
    </>
  );
}

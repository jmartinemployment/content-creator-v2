"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Canvas } from "@/app/creates/canvas";
import { CreateDraftTabs } from "@/app/creates/create-draft-tabs";
import { CreateJobHubProvider } from "@/app/creates/create-job-hub-provider";
import type { JobSnapshot } from "@/app/creates/job-snapshot";

type CreateDetailShellProps = {
  createId: string;
  jobId: string;
  title: string;
  initialJobs: JobSnapshot[];
};

function PartnerResearchWarningsBanner({ createId }: { createId: string }) {
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const key = `gcc-v2-research-warnings:${createId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        setWarnings(parsed);
      }
    } catch {
      // ignore malformed storage
    }
  }, [createId]);

  if (warnings.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <p className="font-medium">Some external research was skipped</p>
      <ul className="mt-1 list-disc pl-4">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

export function CreateDetailShell({ createId, jobId, title, initialJobs }: CreateDetailShellProps) {
  return (
    <CreateJobHubProvider createId={createId} activeJobId={jobId} initialJobs={initialJobs}>
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
        <div>
          <Link href="/creates" className="text-sm text-[var(--cc-accent)]">
            ← Your creates
          </Link>
          <p className="mt-2 text-sm font-medium tracking-wide text-[var(--cc-accent)]">
            Content Creator v2
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--cc-ink)]">{title}</h1>
          <PartnerResearchWarningsBanner createId={createId} />
          <p className="mt-2 text-sm text-[var(--cc-muted)]">
            Live Canvas — job status and content stream over the realtime hub (no polling).
          </p>
          {initialJobs.length > 0 ? (
            <CreateDraftTabs createId={createId} activeJobId={jobId} />
          ) : null}
          {initialJobs.length <= 1 ? (
            <p className="mt-3 text-xs text-[var(--cc-muted)]">
              Need tool, email, social, or ads drafts? Start a new brief and check types under Also
              draft — each checked type gets its own job tab here. Image prompts auto-spawn when each
              draft is ready.
            </p>
          ) : null}
        </div>

        <Canvas createId={createId} jobId={jobId} />
      </main>
    </CreateJobHubProvider>
  );
}

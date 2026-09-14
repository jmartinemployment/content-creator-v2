import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { CreateDetailShell } from "@/app/creates/create-detail-shell";
import type { JobSnapshot } from "@/app/creates/job-snapshot";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jobId?: string }>;
};

type CreateDto = { id: string; title: string; contentType: string };

export default async function CreateDetailPage({ params, searchParams }: PageProps) {
  await requireAccessToken();

  const { id } = await params;
  const { jobId: jobIdFromQuery } = await searchParams;

  let title: string | null = null;
  let metadataError: string | null = null;
  const createRes = await fetchGccV2(`creates/${id}`);
  if (createRes.ok) {
    const create = (await createRes.json()) as CreateDto;
    title = create.title;
  } else {
    metadataError = `Could not load create metadata (HTTP ${createRes.status}).`;
  }

  let jobs: JobSnapshot[] = [];
  let jobsError: string | null = null;
  const jobsRes = await fetchGccV2(`creates/${id}/jobs`);
  if (jobsRes.ok) {
    const body = (await jobsRes.json()) as JobSnapshot[];
    if (Array.isArray(body)) jobs = body;
  } else {
    jobsError = `Could not load jobs (HTTP ${jobsRes.status}).`;
  }

  if (jobIdFromQuery && !jobs.some((j) => j.id === jobIdFromQuery)) {
    const oneRes = await fetchGccV2(`jobs/${jobIdFromQuery}`);
    if (oneRes.ok) {
      const one = (await oneRes.json()) as JobSnapshot;
      jobs = [...jobs, one];
    }
  }

  let jobId = jobIdFromQuery ?? null;
  if (!jobId && jobs.length > 0) {
    jobId = jobs[0]!.id;
  }
  if (!jobId) {
    const jobRes = await fetchGccV2(`creates/${id}/latest-job`);
    if (jobRes.ok) {
      const job = (await jobRes.json()) as JobSnapshot;
      jobId = job.id;
      if (!jobs.some((j) => j.id === job.id)) jobs = [...jobs, job];
    }
  }

  if (!jobId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
        <Link href="/creates" className="text-sm text-[var(--cc-accent)]">
          ← Content library
        </Link>
        {metadataError ? (
          <p role="alert" className="text-sm text-red-600">
            {metadataError}
          </p>
        ) : null}
        {jobsError ? (
          <p role="alert" className="text-sm text-red-600">
            {jobsError}
          </p>
        ) : null}
        <p className="text-sm text-red-600">
          No draft was found for this item —{" "}
          <Link href="/creates/new" className="underline">
            start new content
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="contents">
      {metadataError || jobsError ? (
        <div className="mx-auto max-w-6xl px-6 pt-6" role="alert" aria-live="polite">
          {metadataError ? <p className="text-sm text-red-600">{metadataError}</p> : null}
          {jobsError ? <p className="text-sm text-red-600">{jobsError}</p> : null}
        </div>
      ) : null}
      <CreateDetailShell
        createId={id}
        jobId={jobId}
        title={title ?? "Untitled create"}
        initialJobs={jobs}
      />
    </main>
  );
}

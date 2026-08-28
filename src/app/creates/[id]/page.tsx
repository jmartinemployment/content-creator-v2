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

  let title = id;
  const createRes = await fetchGccV2(`creates/${id}`);
  if (createRes.ok) {
    const create = (await createRes.json()) as CreateDto;
    title = create.title;
  }

  let jobs: JobSnapshot[] = [];
  const jobsRes = await fetchGccV2(`creates/${id}/jobs`);
  if (jobsRes.ok) {
    const body = (await jobsRes.json()) as JobSnapshot[];
    if (Array.isArray(body)) jobs = body;
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
          ← Your creates
        </Link>
        <p className="text-sm text-red-600">
          No job found for this create —{" "}
          <Link href="/creates/new" className="underline">
            start a new brief
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <CreateDetailShell createId={id} jobId={jobId} title={title} initialJobs={jobs} />
  );
}

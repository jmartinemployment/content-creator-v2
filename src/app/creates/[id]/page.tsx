import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { Canvas } from "@/app/creates/canvas";
import { labelForContentType } from "@/app/creates/content-types";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jobId?: string }>;
};

type CreateDto = { id: string; title: string; contentType: string };
type JobDto = { id: string; status: string; stage: string; contentType?: string };

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

  let jobs: JobDto[] = [];
  const jobsRes = await fetchGccV2(`creates/${id}/jobs`);
  if (jobsRes.ok) {
    const body = (await jobsRes.json()) as JobDto[];
    if (Array.isArray(body)) jobs = body;
  }

  let jobId = jobIdFromQuery ?? null;
  if (!jobId && jobs.length > 0) {
    jobId = jobs[0]!.id;
  }
  if (!jobId) {
    const jobRes = await fetchGccV2(`creates/${id}/latest-job`);
    if (jobRes.ok) {
      const job = (await jobRes.json()) as JobDto;
      jobId = job.id;
      if (jobs.length === 0) jobs = [job];
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/creates" className="text-sm text-[var(--cc-accent)]">
          ← Your creates
        </Link>
        <p className="mt-2 text-sm font-medium tracking-wide text-[var(--cc-accent)]">
          Content Creator v2
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--cc-ink)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          Live Canvas for this create&apos;s job — no polling, everything below comes from the realtime
          hub.
        </p>
        {jobs.length > 0 ? (
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Drafts for this create">
            {jobs.map((j) => {
              const active = j.id === jobId;
              const label = labelForContentType(j.contentType ?? "");
              return (
                <Link
                  key={j.id}
                  href={`/creates/${id}?jobId=${j.id}`}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    active
                      ? "bg-[var(--cc-accent)] text-white"
                      : "border border-[var(--cc-line)] text-[var(--cc-ink)] hover:bg-black/5"
                  }`}
                >
                  {label}
                  <span className="ml-1 opacity-70">· {j.status}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}
        {jobs.length <= 1 ? (
          <p className="mt-3 text-xs text-[var(--cc-muted)]">
            Need tool, email, social, or ads drafts? Start a new brief and check types under Also
            draft — each checked type gets its own job tab here.
          </p>
        ) : null}
      </div>

      {jobId ? (
        <Canvas createId={id} jobId={jobId} />
      ) : (
        <p className="text-sm text-red-600">
          No job found for this create —{" "}
          <Link href="/creates/new" className="underline">
            start a new brief
          </Link>
          .
        </p>
      )}
    </main>
  );
}

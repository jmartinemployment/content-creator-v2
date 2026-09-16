import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { labelForContentType } from "@/app/creates/content-types";

type V2CreateSummary = {
  id: string;
  title: string;
  contentType: string;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
  jobContentTypes?: string[];
};

export default async function CreatesListPage() {
  await requireAccessToken();

  let creates: V2CreateSummary[] = [];
  let error: string | null = null;

  const res = await fetchGccV2("creates");
  if (res.ok) {
    creates = await res.json();
  } else {
    error = `Could not load your content (HTTP ${res.status}).`;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--cc-accent)]">Content</p>
          <h1 className="mt-1 text-3xl font-semibold text-[var(--cc-ink)]">Content library</h1>
          <p className="mt-2 text-sm text-[var(--cc-muted)]">
            Find drafts, continue reviews, and open finished work.
          </p>
        </div>
        <Link
          href="/creates/new"
          className="inline-flex rounded-lg bg-[var(--cc-accent)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          New content
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {creates.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-[var(--cc-line)] bg-white p-10 text-center">
          <p className="font-medium text-[var(--cc-ink)]">No content yet</p>
          <p className="mt-1 text-sm text-[var(--cc-muted)]">Start a guided workflow to fill your library.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {creates.map((c) => {
            const jobTypes =
              c.jobContentTypes && c.jobContentTypes.length > 0
                ? c.jobContentTypes
                : [c.contentType];
            return (
              <li key={c.id} className="rounded-xl border border-[var(--cc-line)] bg-white p-4">
                <Link href={`/creates/${c.id}`} className="font-semibold text-[var(--cc-ink)] hover:underline">
                  {c.title}
                </Link>
                <p className="mt-1 text-xs text-[var(--cc-muted)]">
                  {jobTypes.map((t) => labelForContentType(t)).join(" · ")} ·{" "}
                  {new Date(c.updatedAtUtc ?? c.createdAtUtc).toLocaleDateString()}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

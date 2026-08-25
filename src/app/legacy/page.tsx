import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";

type LegacyCreateSummary = {
  id: string;
  topic: string;
  contentType: string;
  status: string;
  department?: string;
  siteAnalysisProfileId?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export default async function LegacyCreatesPage() {
  await requireAccessToken();

  let creates: LegacyCreateSummary[] = [];
  let error: string | null = null;

  const res = await fetchGccV2("legacy/creates");
  if (res.ok) {
    creates = await res.json();
  } else {
    error = `Could not load v1 creates (HTTP ${res.status}).`;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/" className="text-sm text-[var(--cc-accent)]">
          ← Home
        </Link>
        <p className="mt-2 text-sm font-medium tracking-wide text-[var(--cc-accent)]">
          Content Creator v2
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--cc-ink)]">v1 creates (read-only)</h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          View-only mirror of your legacy Geek Content Creator creates — no migration, no edits from v2.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {creates.length === 0 && !error ? (
        <p className="text-sm text-[var(--cc-muted)]">No v1 creates found for this account.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {creates.map((c) => (
            <li key={c.id} className="rounded-lg border border-[var(--cc-line)] p-4">
              <Link href={`/legacy/${c.id}`} className="font-semibold text-[var(--cc-ink)] hover:underline">
                {c.topic}
              </Link>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                {c.contentType} · {c.status} · updated {new Date(c.updatedAtUtc).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

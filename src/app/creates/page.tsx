import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";

type V2CreateSummary = {
  id: string;
  title: string;
  contentType: string;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
};

export default async function CreatesListPage() {
  await requireAccessToken();

  let creates: V2CreateSummary[] = [];
  let error: string | null = null;

  const res = await fetchGccV2("creates");
  if (res.ok) {
    creates = await res.json();
  } else {
    error = `Could not load creates (HTTP ${res.status}).`;
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
        <h1 className="mt-2 text-2xl font-semibold text-[var(--cc-ink)]">Your creates</h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          v2 creates for this account — open one to view its Canvas or start a new brief.
        </p>
      </div>

      <Link
        href="/creates/new"
        className="inline-flex w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white"
      >
        New content brief
      </Link>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {creates.length === 0 && !error ? (
        <p className="text-sm text-[var(--cc-muted)]">No v2 creates yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {creates.map((c) => (
            <li key={c.id} className="rounded-lg border border-[var(--cc-line)] p-4">
              <Link href={`/creates/${c.id}`} className="font-semibold text-[var(--cc-ink)] hover:underline">
                {c.title}
              </Link>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                {c.contentType} · created {new Date(c.createdAtUtc).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

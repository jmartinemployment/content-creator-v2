import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";

type PageProps = { params: Promise<{ id: string }> };

type LegacyDetail = {
  source: string;
  readOnly: boolean;
  create: {
    id: string;
    topic: string;
    contentType: string;
    notes?: string | null;
    department?: string;
    briefJson?: string | null;
    researchJson?: string | null;
    status: string;
    siteAnalysisProfileId?: string | null;
    createdAtUtc: string;
    updatedAtUtc: string;
  };
  artifacts: Array<{
    id: string;
    type: string;
    name: string;
    status: string;
    latestVersionNumber?: number;
    bodyDocumentJson?: string | null;
  }>;
};

function prettyJson(raw: string | null | undefined): string {
  if (!raw) return "(empty)";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default async function LegacyCreateDetailPage({ params }: PageProps) {
  await requireAccessToken();
  const { id } = await params;

  const res = await fetchGccV2(`legacy/creates/${id}`);

  if (res.status === 404) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-red-600">v1 create not found.</p>
        <Link href="/legacy" className="mt-4 inline-block text-sm text-[var(--cc-accent)]">
          ← Back to v1 list
        </Link>
      </main>
    );
  }

  if (!res.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-red-600">Could not load v1 create (HTTP {res.status}).</p>
      </main>
    );
  }

  const data = (await res.json()) as LegacyDetail;
  const { create, artifacts } = data;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/legacy" className="text-sm text-[var(--cc-accent)]">
          ← v1 creates
        </Link>
        <p className="mt-2 text-xs uppercase tracking-wide text-amber-700">Read-only · v1</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--cc-ink)]">{create.topic}</h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          {create.contentType} · {create.status} · updated {new Date(create.updatedAtUtc).toLocaleString()}
        </p>
        {create.notes ? <p className="mt-2 text-sm text-[var(--cc-ink)]">{create.notes}</p> : null}
      </div>

      <section className="rounded-lg border border-[var(--cc-line)] p-4">
        <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Brief</h2>
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-black/5 p-3 text-xs">
          {prettyJson(create.briefJson)}
        </pre>
      </section>

      {create.researchJson ? (
        <section className="rounded-lg border border-[var(--cc-line)] p-4">
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Research</h2>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-black/5 p-3 text-xs">
            {prettyJson(create.researchJson)}
          </pre>
        </section>
      ) : null}

      <section className="rounded-lg border border-[var(--cc-line)] p-4">
        <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Artifacts ({artifacts.length})</h2>
        {artifacts.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--cc-muted)]">No artifacts on this create.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {artifacts.map((a) => (
              <li key={a.id} className="rounded-md bg-black/5 p-3">
                <p className="text-sm font-medium text-[var(--cc-ink)]">
                  {a.name} <span className="text-[var(--cc-muted)]">({a.type})</span>
                </p>
                <p className="text-xs text-[var(--cc-muted)]">
                  {a.status}
                  {a.latestVersionNumber ? ` · v${a.latestVersionNumber}` : ""}
                </p>
                {a.bodyDocumentJson ? (
                  <pre className="mt-2 max-h-48 overflow-auto text-xs">{prettyJson(a.bodyDocumentJson)}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-[var(--cc-muted)]">
        Historical v1 create — read-only. New work uses Content Creator v2 (<Link href="/creates" className="text-[var(--cc-accent)]">creates</Link>).
      </p>
    </main>
  );
}

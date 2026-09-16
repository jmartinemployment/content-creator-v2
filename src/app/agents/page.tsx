import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { normalizeAgentCatalog } from "@/app/agents/agent-contract";
import { shortDigest } from "@/app/skills/skill-contract";

export default async function AgentsPage() {
  await requireAccessToken();
  let catalog = null;
  let error: string | null = null;
  try {
    const response = await fetchGccV2("agents");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    catalog = normalizeAgentCatalog(await response.json());
  } catch (cause) {
    error = `Agent library is unavailable${cause instanceof Error ? ` (${cause.message})` : ""}.`;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Specialist teams</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--cc-ink)]">Agent Library</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--cc-muted)]">
            Published specialists collaborate through explicit contribution and review handoffs.
            Every run pins immutable agent versions, digests, and skills.
          </p>
        </div>
        <Link href="/agents/admin" className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-semibold">
          Admin workspace
        </Link>
      </div>
      {error ? <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {catalog ? (
        <>
          <p className="mt-6 text-xs text-[var(--cc-muted)]">Catalog {catalog.catalogVersion}</p>
          <section className="mt-4 grid gap-4 md:grid-cols-2">
            {catalog.agents.map((agent) => (
              <article key={agent.versionId || agent.id} className="rounded-xl border border-[var(--cc-line)] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-[var(--cc-ink)]">
                      <Link href={`/agents/${encodeURIComponent(agent.id)}`} className="hover:underline">{agent.name}</Link>
                    </h2>
                    <p className="mt-1 text-sm text-[var(--cc-muted)]">{agent.description}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {agent.participation.length
                      ? [...new Set(agent.participation.map((row) => row.role))].join(" · ")
                      : agent.role}
                  </span>
                </div>
                <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  <div><dt className="font-semibold">Specialty</dt><dd className="capitalize">{agent.specialty}</dd></div>
                  <div><dt className="font-semibold">Version</dt><dd>{agent.version}</dd></div>
                  <div><dt className="font-semibold">Immutable digest</dt><dd className="font-mono" title={agent.digest}>{shortDigest(agent.digest)}</dd></div>
                  <div><dt className="font-semibold">Responsibilities</dt><dd>{agent.participation.length ? [...agent.participation].sort((a, b) => a.order - b.order).map((row) => `${row.stage}: ${row.role}`).join(", ") : agent.supportedStages.join(", ") || "Backend assigned"}</dd></div>
                </dl>
                <div className="mt-4 flex gap-3 text-xs">
                  <Link href={`/agents/${encodeURIComponent(agent.id)}`} className="font-semibold text-[var(--cc-accent)] underline">Details</Link>
                  <Link href={`/skills?agentId=${encodeURIComponent(agent.id)}`} className="text-[var(--cc-accent)] underline">Assigned skills ({agent.skills.length || agent.skillIds.length})</Link>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}

import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";

type TaskAgentSummary = {
  id: string;
  definitionId: string;
  displayName: string;
  description: string;
  versionId: string;
  version: string;
  digest: string;
  workflowGroup: string;
  facets: Record<string, unknown>;
};

export default async function TaskAgentsPage() {
  await requireAccessToken();
  let agents: TaskAgentSummary[] = [];
  let error: string | null = null;
  try {
    const response = await fetchGccV2("task-agents");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { agents?: TaskAgentSummary[] };
    agents = body.agents ?? [];
  } catch (cause) {
    error = `Task-agent catalog is unavailable${cause instanceof Error ? ` (${cause.message})` : ""}.`;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Runnable applications</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--cc-ink)]">Task Agents</h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--cc-muted)]">
        Run a focused analysis and receive a durable, versioned result with evidence and provenance.
        These are user-facing tools; Agent Settings controls the internal specialists used by content generation.
      </p>
      {error ? <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {!error && agents.length === 0 ? (
        <p className="mt-6 rounded-lg border border-[var(--cc-line)] bg-white p-4 text-sm text-[var(--cc-muted)]">
          No task agents are published yet.
        </p>
      ) : null}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <article key={agent.versionId} className="rounded-xl border border-[var(--cc-line)] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--cc-ink)]">{agent.displayName}</h2>
                <p className="mt-2 text-sm text-[var(--cc-muted)]">{agent.description}</p>
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                {agent.workflowGroup}
              </span>
            </div>
            <p className="mt-4 text-xs text-[var(--cc-muted)]">
              Version {agent.version} · <span className="font-mono">{agent.digest.slice(0, 12)}</span>
            </p>
            <Link
              href={`/task-agents/${encodeURIComponent(agent.id)}`}
              className="mt-4 inline-flex rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Open agent
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}

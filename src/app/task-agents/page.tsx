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

const GROUP_LABELS: Record<string, string> = {
  diagnostic: "Diagnostics",
  intelligence: "Intelligence",
  originate: "Content",
  outrank: "Competitive content",
  analysis: "Analysis",
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

  const groups = agents.reduce<Record<string, TaskAgentSummary[]>>((acc, agent) => {
    const key = agent.workflowGroup || "analysis";
    (acc[key] ??= []).push(agent);
    return acc;
  }, {});

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <p className="text-sm font-medium text-[var(--cc-accent)]">Runnable applications</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-ink)] sm:text-4xl">
        Task Agents
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--cc-muted)]">
        Run a focused analysis and get a durable, versioned result with evidence.
        Agent Settings still governs the internal specialists used by content generation.
      </p>
      {error ? <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {!error && agents.length === 0 ? (
        <p className="mt-6 border border-[var(--cc-line)] bg-white px-4 py-5 text-sm text-[var(--cc-muted)]">
          No task agents are published yet.
        </p>
      ) : null}

      {Object.entries(groups).map(([group, entries]) => (
        <section key={group} className="mt-10">
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">
            {GROUP_LABELS[group] ?? group}
          </h2>
          <ul className="mt-3 divide-y divide-[var(--cc-line)] border-y border-[var(--cc-line)]">
            {entries.map((agent) => (
              <li key={agent.versionId} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 max-w-2xl border-l-2 border-[var(--cc-accent)] pl-4">
                  <h3 className="text-lg font-semibold text-[var(--cc-ink)]">{agent.displayName}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--cc-muted)]">{agent.description}</p>
                  <p className="mt-2 font-mono text-[0.7rem] text-[var(--cc-muted)]">
                    v{agent.version} · {agent.digest.slice(0, 12)}
                  </p>
                </div>
                <Link
                  href={`/task-agents/${encodeURIComponent(agent.id)}`}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)]"
                >
                  Open agent
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

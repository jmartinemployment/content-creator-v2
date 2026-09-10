import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";
import {
  TaskAgentLibrary,
  type TaskAgentLibraryItem,
} from "@/app/task-agents/task-agent-library";

export default async function TaskAgentsPage() {
  await requireAccessToken();
  let agents: TaskAgentLibraryItem[] = [];
  let error: string | null = null;
  try {
    const response = await fetchGccV2("task-agents");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { agents?: TaskAgentLibraryItem[] };
    agents = body.agents ?? [];
  } catch (cause) {
    error = `Task-agent catalog is unavailable${cause instanceof Error ? ` (${cause.message})` : ""}.`;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <p className="text-sm font-medium text-[var(--cc-accent)]">Agent Library</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-ink)] sm:text-4xl">
        Task Agents
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--cc-muted)]">
        Browse by outcome — Originate, Optimize, or Outrank — then run a durable, versioned result with evidence.
      </p>
      {error ? <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {!error && agents.length === 0 ? (
        <p className="mt-6 border border-[var(--cc-line)] bg-white px-4 py-5 text-sm text-[var(--cc-muted)]">
          No task agents are published yet.
        </p>
      ) : null}
      {!error && agents.length > 0 ? <TaskAgentLibrary agents={agents} /> : null}
    </main>
  );
}

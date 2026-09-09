"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createStudioAgent, listStudioAgents, type StudioAgentSummary } from "@/app/studio/studio-api";

export function StudioList() {
  const router = useRouter();
  const [agents, setAgents] = useState<StudioAgentSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void listStudioAgents()
      .then((body) => setAgents(body.agents ?? []))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load Studio agents."))
      .finally(() => setReady(true));
  }, []);

  async function onCreate() {
    setCreating(true);
    setError(null);
    try {
      const detail = await createStudioAgent({
        name: "Untitled custom agent",
        outcome: "Describe the marketing outcome this agent should produce.",
        visibility: "private",
      });
      router.push(`/studio/${detail.agent.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create Studio agent.");
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Custom Agent Studio</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--cc-ink)]">Studio</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--cc-muted)]">
            Author private custom task agents with a form builder, instructions template, example output, dry-run checks, and governed publish.
          </p>
        </div>
        <button
          type="button"
          disabled={!ready || creating}
          onClick={() => void onCreate()}
          className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New custom agent"}
        </button>
      </div>

      {error ? <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {!ready ? <p className="mt-8 text-sm text-[var(--cc-muted)]">Loading agents…</p> : null}
      {ready && agents.length === 0 && !error ? (
        <p className="mt-8 rounded-lg border border-[var(--cc-line)] bg-white p-4 text-sm text-[var(--cc-muted)]">
          No studio agents yet. Create one to design inputs, instructions, and an example output.
        </p>
      ) : null}

      <section className="mt-6 grid gap-4">
        {agents.map((agent) => (
          <article key={agent.versionId} className="rounded-xl border border-[var(--cc-line)] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--cc-ink)]">{agent.displayName}</h2>
                <p className="mt-2 text-sm text-[var(--cc-muted)]">{agent.description}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                {agent.visibility} · {agent.state}
              </span>
            </div>
            <p className="mt-4 text-xs text-[var(--cc-muted)]">
              Version {agent.version} · <span className="font-mono">{agent.digest.slice(0, 12)}</span>
            </p>
            <Link
              href={`/studio/${agent.id}`}
              className="mt-4 inline-flex rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold"
            >
              Open agent
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}

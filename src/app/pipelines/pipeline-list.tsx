"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createAeoPipeline, listPipelines } from "@/app/pipelines/pipeline-api";
import { PIPELINE_LIFECYCLE_STAGES } from "@/app/pipelines/pipeline-types";
import type { PipelineSummary } from "@/app/pipelines/pipeline-types";

export function PipelineList() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void listPipelines()
      .then(setPipelines)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load pipelines."))
      .finally(() => setReady(true));
  }, []);

  async function createTemplate() {
    setCreating(true);
    setError(null);
    try {
      const pipeline = await createAeoPipeline();
      router.push(`/pipelines/${pipeline.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create pipeline.");
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-muted)]">
          Geek Content Pipelines
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">
          Compose agent stages into durable runs
        </h1>
        <p className="mt-3 text-sm text-[var(--cc-muted)]">
          Plan → Create → Adapt → Activate → Optimize. Definitions pin task-agent versions and handoffs;
          runs keep work-item isolation and stage history server-owned.
        </p>
      </header>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Lifecycle stages">
        {PIPELINE_LIFECYCLE_STAGES.map((stage) => (
          <li
            key={stage}
            className="rounded-md border border-[var(--cc-line)] bg-white px-3 py-1.5 text-xs font-semibold capitalize text-[var(--cc-ink)]"
          >
            {stage}
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={creating}
          onClick={() => void createTemplate()}
          className="rounded-lg bg-[var(--cc-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create AEO pipeline template"}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {!ready ? (
        <p className="mt-8 text-sm text-[var(--cc-muted)]">Loading pipelines…</p>
      ) : pipelines.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--cc-muted)]">
          No pipelines yet. Create the AEO template to pin Query Planner → FAQ → Canvas → Publish → AI Readiness.
        </p>
      ) : (
        <ul className="mt-8 space-y-3" aria-label="Pipeline definitions">
          {pipelines.map((pipeline) => (
            <li key={pipeline.id}>
              <Link
                href={`/pipelines/${pipeline.id}`}
                className="block rounded-xl border border-[var(--cc-line)] bg-white px-4 py-4 hover:border-[var(--cc-accent)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--cc-ink)]">{pipeline.name}</h2>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-muted)]">
                    {pipeline.status} · v{pipeline.versionNumber}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--cc-muted)]">{pipeline.description}</p>
                <p className="mt-2 font-mono text-xs text-[var(--cc-muted)]">
                  {pipeline.digest.slice(0, 12)} · {pipeline.runCount} run{pipeline.runCount === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

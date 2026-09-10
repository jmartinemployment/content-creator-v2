"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getPipeline,
  startPipelineRun,
  transitionPipelineRun,
} from "@/app/pipelines/pipeline-api";
import { PIPELINE_LIFECYCLE_STAGES } from "@/app/pipelines/pipeline-types";
import type { PipelineDefinition, PipelineRun } from "@/app/pipelines/pipeline-types";

export function PipelineDetail({ pipelineId }: { pipelineId: string }) {
  const [pipeline, setPipeline] = useState<PipelineDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const next = await getPipeline(pipelineId);
    setPipeline(next);
  }

  useEffect(() => {
    void refresh()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load pipeline."))
  }, [pipelineId]);

  const latestRun: PipelineRun | null = useMemo(
    () => pipeline?.runs?.[0] ?? null,
    [pipeline],
  );

  async function runPipeline(failStageKey?: string) {
    setBusy(failStageKey ? "fail" : "run");
    setError(null);
    try {
      const next = await startPipelineRun(pipelineId, { failStageKey });
      setPipeline(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start pipeline run.");
    } finally {
      setBusy(null);
    }
  }

  async function transition(action: "pause" | "resume" | "cancel") {
    if (!latestRun) return;
    setBusy(action);
    setError(null);
    try {
      const next = await transitionPipelineRun(latestRun.id, action);
      setPipeline(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${action} run.`);
    } finally {
      setBusy(null);
    }
  }

  if (!pipeline && !error) {
    return <p className="p-8 text-sm text-[var(--cc-muted)]">Loading pipeline…</p>;
  }
  if (!pipeline) {
    return <p className="p-8 text-sm text-red-700">{error}</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs">
        <Link href="/pipelines" className="font-semibold text-[var(--cc-accent)] underline">
          ← Geek Content Pipelines
        </Link>
      </p>
      <header className="mt-4 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-muted)]">
          Geek Content Pipelines
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">
          {pipeline.name}
        </h1>
        <p className="mt-3 text-sm text-[var(--cc-muted)]">{pipeline.description}</p>
        <p className="mt-2 font-mono text-xs text-[var(--cc-muted)]">
          {pipeline.status} · v{pipeline.versionNumber} · {pipeline.digest.slice(0, 16)}
        </p>
      </header>

      <section className="mt-8" aria-label="Pipeline stages">
        <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Stage DAG</h2>
        <ol className="mt-3 space-y-2">
          {pipeline.stages.map((stage) => (
            <li
              key={stage.key}
              className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-[var(--cc-ink)]">{stage.displayName}</span>
                <span className="text-xs uppercase tracking-wide text-[var(--cc-muted)]">
                  {stage.lifecycle} · {stage.kind}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                {stage.capabilityId
                  ? `Capability ${stage.capabilityId}`
                  : stage.handoff
                    ? `Handoff ${stage.handoff}`
                    : stage.key}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-[var(--cc-muted)]">
          Lifecycle coverage: {PIPELINE_LIFECYCLE_STAGES.join(" → ")}
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy !== null || pipeline.status !== "published"}
          onClick={() => void runPipeline()}
          className="rounded-lg bg-[var(--cc-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "run" ? "Running…" : "Run pipeline"}
        </button>
        <button
          type="button"
          disabled={busy !== null || pipeline.status !== "published"}
          onClick={() => void runPipeline("create-faq")}
          className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--cc-ink)] disabled:opacity-50"
        >
          {busy === "fail" ? "Injecting…" : "Run with Create-stage failure"}
        </button>
        {latestRun && (latestRun.status === "running" || latestRun.status === "queued") ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void transition("cancel")}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50"
          >
            Cancel latest run
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {latestRun ? (
        <section className="mt-8" aria-label="Latest pipeline run">
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Latest run</h2>
          <p className="mt-1 text-sm text-[var(--cc-muted)]">
            {latestRun.status}
            {latestRun.error ? ` · ${latestRun.error}` : ""}
          </p>
          {(latestRun.workItems[0]?.stageAttempts ?? []).length ? (
            <ul className="mt-4 space-y-2" aria-label="Stage attempts">
              {latestRun.workItems[0].stageAttempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-3 text-sm"
                  data-testid={`pipeline-stage-${attempt.stageKey}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-[var(--cc-ink)]">{attempt.displayName}</span>
                    <span className="text-xs uppercase tracking-wide text-[var(--cc-muted)]">
                      {attempt.lifecycleStage} · {attempt.status}
                    </span>
                  </div>
                  {attempt.error ? (
                    <p className="mt-1 text-xs text-red-700">{attempt.error}</p>
                  ) : null}
                  {attempt.output && typeof attempt.output === "object" ? (
                    <p className="mt-1 text-xs text-[var(--cc-muted)]">
                      {String(
                        (attempt.output as { artifactType?: string }).artifactType
                          ?? (attempt.output as { summary?: string }).summary
                          ?? JSON.stringify(attempt.output).slice(0, 120),
                      )}
                      {(attempt.output as { summary?: string }).summary
                        && (attempt.output as { artifactType?: string }).artifactType
                        ? ` · ${(attempt.output as { summary?: string }).summary}`
                        : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <p className="mt-8 text-sm text-[var(--cc-muted)]">No runs yet.</p>
      )}
    </main>
  );
}

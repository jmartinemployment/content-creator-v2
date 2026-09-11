"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createGridRow,
  createGridRun,
  getGrid,
  importGridRows,
  putGridPipeline,
  putGridSchedule,
  runDueGridSchedule,
  startGridPipelineRun,
} from "@/app/grid/grid-api";
import {
  estimateBudget,
  inputPreview,
  outputPreview,
  readGridSchedule,
  scheduleIsDue,
  scheduleLabel,
  selectRowsForRun,
  succeededCount,
} from "@/app/grid/grid-model";
import type { Grid, GridRowStatus, GridRunMode, GridScheduleCadence } from "@/app/grid/grid-types";
import { listPipelines } from "@/app/pipelines/pipeline-api";
import type { PipelineSummary } from "@/app/pipelines/pipeline-types";
import {
  attachGridRowsToProject,
  listProjects,
  type ProjectSummary,
} from "@/app/projects/projects-api";

const rowStatusStyles: Record<GridRowStatus, string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  running: "border-amber-200 bg-amber-50 text-amber-800",
  succeeded: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-red-200 bg-red-50 text-red-800",
  skipped: "border-slate-200 bg-slate-50 text-slate-500",
};

export function GridDetail({ gridId }: { gridId: string }) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [importDraft, setImportDraft] = useState("");
  const [addingRow, setAddingRow] = useState(false);
  const [importingRows, setImportingRows] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const [scheduleCadence, setScheduleCadence] = useState<GridScheduleCadence>("none");
  const [scheduleMode, setScheduleMode] = useState<GridRunMode>("sample");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [pipelineBusy, setPipelineBusy] = useState(false);

  useEffect(() => {
    void getGrid(gridId)
      .then((next) => {
        setGrid(next);
        const schedule = readGridSchedule(next.config);
        setScheduleCadence(schedule.cadence);
        setScheduleMode(schedule.mode);
        setScheduleEnabled(schedule.enabled);
        setSelectedPipelineId(next.config.pipelineDefinitionId ?? "");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load grid."))
      .finally(() => setReady(true));
  }, [gridId]);

  useEffect(() => {
    void listProjects()
      .then((items) => {
        setProjects(items);
        setSelectedProjectId((current) => current || items[0]?.id || "");
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    void listPipelines()
      .then((items) => {
        const published = items.filter((item) => item.status === "published");
        setPipelines(published);
        setSelectedPipelineId((current) => current || published[0]?.id || "");
      })
      .catch(() => setPipelines([]));
  }, []);

  const samplePreview = useMemo(() => {
    if (!grid) return null;
    const rows = selectRowsForRun(grid.rows, "sample", 10);
    return estimateBudget(grid.config, rows.length);
  }, [grid]);

  const sampleSize = samplePreview?.rowCount ?? 0;
  const succeededRows = useMemo(
    () => (grid ? grid.rows.filter((row) => row.status === "succeeded") : []),
    [grid],
  );
  const schedule = useMemo(() => readGridSchedule(grid?.config), [grid]);
  const due = scheduleIsDue(schedule);
  const attachedPipelineId = grid?.config.pipelineDefinitionId ?? null;
  const lastPipelineRunId = grid?.config.lastPipelineRunId ?? null;
  const attachedPipeline = useMemo(
    () => pipelines.find((item) => item.id === attachedPipelineId) ?? null,
    [pipelines, attachedPipelineId],
  );

  if (!ready) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-[var(--cc-muted)]">Loading grid…</main>;
  }

  if (!grid) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold text-[var(--cc-accent)]">Batch</p>
        <h1 className="mt-2 text-2xl font-semibold">Grid not found</h1>
        <p className="mt-3 text-sm text-[var(--cc-muted)]">{error ?? "This grid is not available."}</p>
        <Link href="/grid" className="mt-6 inline-block text-sm font-semibold text-[var(--cc-accent)]">
          ← Back to Grid
        </Link>
      </main>
    );
  }

  const inputColumn = grid.config.columns.find((column) => column.kind === "input");
  const latestRun = grid.runs[0] ?? null;

  async function run(mode: "sample" | "full") {
    setRunning(true);
    setError(null);
    setAttachNotice(null);
    try {
      const updated = await createGridRun(grid!.id, {
        mode,
        sampleSize: mode === "sample" ? 10 : undefined,
      });
      setGrid(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start run.");
    } finally {
      setRunning(false);
    }
  }

  async function addRow() {
    const topic = topicDraft.trim();
    if (!topic) return;
    setAddingRow(true);
    setError(null);
    try {
      const updated = await createGridRow(grid!.id, { topic });
      setGrid(updated);
      setTopicDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add row.");
    } finally {
      setAddingRow(false);
    }
  }

  async function importRows() {
    const text = importDraft.trim();
    if (!text) return;
    setImportingRows(true);
    setError(null);
    setAttachNotice(null);
    try {
      const result = await importGridRows(grid!.id, { text });
      setGrid(result.grid);
      setImportDraft("");
      const count = result.importedCount ?? 0;
      setAttachNotice(
        `Imported ${count} topic${count === 1 ? "" : "s"} into the grid.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import topics.");
    } finally {
      setImportingRows(false);
    }
  }

  async function attachSucceeded() {
    if (!selectedProjectId || succeededRows.length === 0) return;
    setAttachBusy(true);
    setError(null);
    setAttachNotice(null);
    try {
      const result = await attachGridRowsToProject(selectedProjectId, {
        gridId: grid!.id,
        rowIds: succeededRows.map((row) => row.id),
      });
      setAttachNotice(
        `Attached ${result.attachedCount} row${result.attachedCount === 1 ? "" : "s"} to the project.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not attach rows to project.");
    } finally {
      setAttachBusy(false);
    }
  }

  async function saveSchedule() {
    setScheduleBusy(true);
    setError(null);
    setAttachNotice(null);
    try {
      const updated = await putGridSchedule(grid!.id, {
        cadence: scheduleCadence,
        enabled: scheduleEnabled && scheduleCadence !== "none",
        mode: scheduleMode,
        sampleSize: 10,
      });
      setGrid(updated);
      const next = readGridSchedule(updated.config);
      setScheduleCadence(next.cadence);
      setScheduleMode(next.mode);
      setScheduleEnabled(next.enabled);
      setAttachNotice(`Schedule saved: ${scheduleLabel(next)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save schedule.");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function fireDueSchedule() {
    setScheduleBusy(true);
    setError(null);
    setAttachNotice(null);
    try {
      const result = await runDueGridSchedule(grid!.id);
      setGrid(result.grid);
      const next = readGridSchedule(result.grid.config);
      setScheduleCadence(next.cadence);
      setScheduleMode(next.mode);
      setScheduleEnabled(next.enabled);
      const pipelineProjected = Boolean(result.grid.config.lastPipelineRunId)
        && String(result.reason ?? "").includes("pipeline");
      setAttachNotice(
        result.ran
          ? pipelineProjected
            ? `Scheduled pipeline projection completed (${result.grid.config.lastPipelineRunId}). Next run ${next.nextRunAt ?? "unset"}.`
            : `Scheduled ${next.mode} run completed. Next run ${next.nextRunAt ?? "unset"}.`
          : `Schedule not due yet (${result.reason ?? "not-due"}).`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run due schedule.");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function savePipelineAttachment() {
    setPipelineBusy(true);
    setError(null);
    setAttachNotice(null);
    try {
      const updated = await putGridPipeline(grid!.id, {
        pipelineDefinitionId: selectedPipelineId || null,
      });
      setGrid(updated);
      setSelectedPipelineId(updated.config.pipelineDefinitionId ?? "");
      setAttachNotice(
        updated.config.pipelineDefinitionId
          ? "Pipeline attached. Sample/full schedule runs will project rows as pipeline work items."
          : "Pipeline detached. Schedules return to grid TaskRun stubs.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not attach pipeline.");
    } finally {
      setPipelineBusy(false);
    }
  }

  async function projectPipeline(mode: GridRunMode) {
    setPipelineBusy(true);
    setError(null);
    setAttachNotice(null);
    try {
      const result = await startGridPipelineRun(grid!.id, {
        mode,
        sampleSize: mode === "sample" ? 10 : undefined,
        pipelineDefinitionId: attachedPipelineId || selectedPipelineId || undefined,
      });
      setGrid(result.grid);
      setSelectedPipelineId(result.grid.config.pipelineDefinitionId ?? selectedPipelineId);
      setAttachNotice(
        `Projected ${result.workItemCount} work item${result.workItemCount === 1 ? "" : "s"} into pipeline run ${result.pipelineRunId}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not project grid into pipeline.");
    } finally {
      setPipelineBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/grid" className="text-sm font-semibold text-[var(--cc-accent)] hover:underline">
        ← Grid
      </Link>

      <header className="mt-4 rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--cc-accent)]">
                Batch grid
              </p>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                TaskRun execution
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">{grid.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cc-muted)]">{grid.description}</p>
            <p className="mt-3 text-xs leading-5 text-[var(--cc-muted)]">{grid.config.executionNote}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={running || sampleSize === 0}
              onClick={() => void run("sample")}
              className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--cc-ink)] disabled:opacity-50"
            >
              {running ? "Running…" : `Run sample (${sampleSize})`}
            </button>
            <button
              type="button"
              disabled={running || grid.rows.length === 0}
              onClick={() => void run("full")}
              className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {running ? "Running…" : "Run all rows"}
            </button>
          </div>
        </div>
        {samplePreview ? (
          <p className="mt-4 text-sm text-[var(--cc-muted)]">
            Sample budget preview: {samplePreview.estimatedCredits} credits
            ({samplePreview.creditsPerRow}/row × {samplePreview.rowCount} rows)
          </p>
        ) : null}
        {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
        {attachNotice ? <p role="status" className="mt-4 text-sm text-[var(--cc-ink)]">{attachNotice}</p> : null}
      </header>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border border-[var(--cc-line)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cc-line)] px-5 py-4">
            <div>
              <h2 className="font-semibold text-[var(--cc-ink)]">Work items</h2>
              <p className="mt-0.5 text-xs text-[var(--cc-muted)]">
                {grid.rows.length} rows · {succeededCount(grid)} succeeded
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-b border-[var(--cc-line)] px-5 py-4">
            <label className="min-w-[16rem] flex-1">
              <span className="text-xs font-semibold text-[var(--cc-ink)]">New topic</span>
              <input
                aria-label="New grid topic"
                value={topicDraft}
                onChange={(event) => setTopicDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addRow();
                  }
                }}
                placeholder="Add another work-item topic…"
                className="mt-1 w-full rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--cc-accent)]"
              />
            </label>
            <button
              type="button"
              disabled={addingRow || topicDraft.trim().length === 0}
              onClick={() => void addRow()}
              className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {addingRow ? "Adding…" : "Add row"}
            </button>
          </div>
          <div className="border-b border-[var(--cc-line)] px-5 py-4">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--cc-ink)]">
                Paste topics (CSV / one per line)
              </span>
              <textarea
                aria-label="Paste grid topics"
                value={importDraft}
                onChange={(event) => setImportDraft(event.target.value)}
                rows={4}
                placeholder={"What is Evidence Engine?\nHow does citation verification work?\nCan grids reuse canvas assets?"}
                className="mt-1 w-full rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 font-mono text-sm outline-none focus:border-[var(--cc-accent)]"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={importingRows || importDraft.trim().length === 0}
                onClick={() => void importRows()}
                className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {importingRows ? "Importing…" : "Import topics"}
              </button>
              <p className="text-xs text-[var(--cc-muted)]">
                First CSV column becomes the topic. Duplicates are skipped.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f7f6] text-xs uppercase tracking-wide text-[var(--cc-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  {grid.config.columns.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-semibold">
                      {column.label}
                      {column.kind === "agent" && column.capability ? (
                        <span className="ml-2 font-normal normal-case text-[var(--cc-muted)]">
                          ({column.capability})
                        </span>
                      ) : null}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--cc-line)] align-top">
                    <td className="px-4 py-3 text-[var(--cc-muted)]">{row.rowIndex + 1}</td>
                    {grid.config.columns.map((column) => (
                      <td key={column.key} className="max-w-xs px-4 py-3 text-[var(--cc-ink)]">
                        {column.kind === "input"
                          ? inputPreview(row, inputColumn?.key ?? "topic")
                          : column.kind === "output"
                            ? outputPreview(row)
                            : column.capability ?? "agent"}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${rowStatusStyles[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">Latest run</h2>
            {latestRun ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Mode</dt>
                  <dd className="font-medium capitalize">{latestRun.mode}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Status</dt>
                  <dd className="font-medium capitalize">{latestRun.status}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Outputs</dt>
                  <dd className="font-medium">{latestRun.outputCount}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Est. credits</dt>
                  <dd className="font-medium">{latestRun.budgetPreview.estimatedCredits}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Actor</dt>
                  <dd className="font-medium font-mono text-xs">
                    {latestRun.actor === "schedule" ? "schedule" : latestRun.actor}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[var(--cc-muted)]">No runs yet. Start with a sample run.</p>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">ROI projection</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--cc-muted)]">
              Pin a directional roiProjection.v1 from the ROI Business Calculator. Schedules and
              pipeline Optimize stages can share the same business-case assumptions.
            </p>
            {grid.config.roiProjection?.artifactVersionId ? (
              <dl className="mt-4 space-y-2 text-sm" data-testid="grid-roi-projection">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Artifact</dt>
                  <dd className="font-mono text-xs">{grid.config.roiProjection.artifactType ?? "roiProjection.v1"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--cc-muted)]">Version</dt>
                  <dd className="font-mono text-xs">{grid.config.roiProjection.artifactVersionId}</dd>
                </div>
                {typeof grid.config.roiProjection.expectedRoiPercent === "number" ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--cc-muted)]">Expected ROI</dt>
                    <dd className="font-medium">
                      {grid.config.roiProjection.expectedRoiPercent.toFixed(1)}%
                      <span className="ml-1 text-xs font-normal text-[var(--cc-muted)]">(not cash)</span>
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[var(--cc-muted)]">
                No ROI projection pinned. Run{" "}
                <Link href="/task-agents/roi-business-calculator" className="font-semibold text-[var(--cc-accent)] underline">
                  ROI Business Calculator
                </Link>
                {" "}and choose Pin ROI on Grid.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">Pipeline projection</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--cc-muted)]">
              Attach a published Geek Content Pipeline so grid rows become durable WorkItems.
              Enabled schedules then start pipeline runs instead of orphaned cell stubs.
            </p>
            {pipelines.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--cc-muted)]">
                No published pipelines yet.{" "}
                <Link href="/pipelines" className="font-semibold text-[var(--cc-accent)] underline">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-[var(--cc-ink)]">
                  Pipeline
                  <select
                    aria-label="Attach pipeline to grid"
                    className="mt-1 block w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
                    value={selectedPipelineId}
                    onChange={(event) => setSelectedPipelineId(event.target.value)}
                  >
                    <option value="">None</option>
                    {pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-[var(--cc-ink)]" aria-live="polite">
                  {attachedPipeline
                    ? `Attached: ${attachedPipeline.name}`
                    : "No pipeline attached"}
                  {lastPipelineRunId ? ` · last run ${lastPipelineRunId}` : ""}
                </p>
                <button
                  type="button"
                  disabled={pipelineBusy}
                  onClick={() => void savePipelineAttachment()}
                  className="w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {pipelineBusy ? "Saving…" : "Save pipeline attachment"}
                </button>
                <button
                  type="button"
                  disabled={pipelineBusy || grid.rows.length === 0 || !(attachedPipelineId || selectedPipelineId)}
                  onClick={() => void projectPipeline("sample")}
                  className="w-full rounded-lg bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Project sample as work items
                </button>
                {attachedPipelineId ? (
                  <Link
                    href={`/pipelines/${encodeURIComponent(attachedPipelineId)}`}
                    className="inline-block text-xs font-semibold text-[var(--cc-accent)] underline"
                  >
                    Open pipeline
                  </Link>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">Schedule</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--cc-muted)]">
              Server-owned cadence for sample or full runs. Due runs are fired from this panel
              (cron can call the same run-due endpoint)
              {attachedPipelineId ? " and project into the attached pipeline." : "."}
            </p>
            <p className="mt-3 text-sm text-[var(--cc-ink)]" aria-live="polite">
              {scheduleLabel(schedule)}
              {schedule.nextRunAt ? ` · next ${new Date(schedule.nextRunAt).toLocaleString()}` : ""}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-[var(--cc-ink)]">
                Cadence
                <select
                  aria-label="Grid schedule cadence"
                  className="mt-1 block w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
                  value={scheduleCadence}
                  onChange={(event) => {
                    const value = event.target.value as GridScheduleCadence;
                    setScheduleCadence(value);
                    if (value === "none") setScheduleEnabled(false);
                  }}
                >
                  <option value="none">Off</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-[var(--cc-ink)]">
                Run mode
                <select
                  aria-label="Grid schedule run mode"
                  className="mt-1 block w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
                  value={scheduleMode}
                  onChange={(event) => setScheduleMode(event.target.value as GridRunMode)}
                >
                  <option value="sample">Sample (10)</option>
                  <option value="full">All rows</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--cc-ink)]">
                <input
                  type="checkbox"
                  aria-label="Enable grid schedule"
                  checked={scheduleEnabled && scheduleCadence !== "none"}
                  disabled={scheduleCadence === "none"}
                  onChange={(event) => setScheduleEnabled(event.target.checked)}
                />
                Enabled
              </label>
              <button
                type="button"
                disabled={scheduleBusy}
                onClick={() => void saveSchedule()}
                className="w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {scheduleBusy ? "Saving…" : "Save schedule"}
              </button>
              <button
                type="button"
                disabled={scheduleBusy || !schedule.enabled}
                onClick={() => void fireDueSchedule()}
                className="w-full rounded-lg bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {due ? "Run due now" : "Check / run if due"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">Attach to project</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--cc-muted)]">
              Copy succeeded row outputs into a Canvas project as draft report assets.
            </p>
            {projects.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--cc-muted)]">
                No projects yet.{" "}
                <Link href="/projects" className="font-semibold text-[var(--cc-accent)] underline">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-[var(--cc-ink)]">
                  Project
                  <select
                    aria-label="Attach grid rows to project"
                    className="mt-1 block w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={attachBusy || succeededRows.length === 0 || !selectedProjectId}
                  onClick={() => void attachSucceeded()}
                  className="w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {attachBusy
                    ? "Attaching…"
                    : `Attach succeeded (${succeededRows.length})`}
                </button>
                {selectedProjectId ? (
                  <Link
                    href={`/projects/${encodeURIComponent(selectedProjectId)}`}
                    className="inline-block text-xs font-semibold text-[var(--cc-accent)] underline"
                  >
                    Open project
                  </Link>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">History</h2>
            <ul aria-label="Grid run history" className="mt-4 space-y-3">
              {grid.runs.flatMap((runItem) => runItem.history).length === 0 ? (
                <li className="text-sm text-[var(--cc-muted)]">History appears after the first run.</li>
              ) : (
                grid.runs.flatMap((runItem) =>
                  runItem.history.map((entry, index) => (
                    <li key={`${runItem.id}-${index}`} className="text-sm">
                      <p className="font-medium text-[var(--cc-ink)]">
                        {entry.mode} · {entry.outputCount} outputs · {entry.estimatedCredits} credits
                        {entry.actor === "schedule" ? " · schedule" : ""}
                      </p>
                      <p className="mt-1 text-xs text-[var(--cc-muted)]">
                        {entry.status} · {entry.durationMs}ms · {new Date(entry.startedAt).toLocaleString()}
                        {entry.actor && entry.actor !== "schedule" ? ` · ${entry.actor}` : ""}
                      </p>
                    </li>
                  )),
                )
              )}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

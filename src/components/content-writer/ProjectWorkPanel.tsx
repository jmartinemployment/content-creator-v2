"use client";

import { useEffect, useState } from "react";
import {
  createTask,
  getTimeTotals,
  listTasks,
  listTime,
  logTime,
  updateTask,
  ApiError,
  GCC_TASK_STATUSES,
  GCC_TASK_STATUS_LABELS,
  type GccProject,
  type GccProjectTimeTotals,
  type GccTask,
  type GccTaskStatus,
  type GccTimeEntry,
} from "@/services/gcc-projects-api";

/** Today as "YYYY-MM-DD" in the operator's own timezone, which is the day they worked. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
}

/** "2026-09-21" → "21 Sep". Parsed as parts, never through Date, which would shift the day. */
function shortDate(value: string | null): string {
  if (!value) return "—";
  const [, month, day] = value.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return month && day ? `${day} ${months[month - 1]}` : "—";
}

/**
 * Minutes as hours and minutes: "90" reads as 1h 30m.
 *
 * Kept in minutes everywhere underneath — the decimal hour is the thing that starts arguments
 * about whether 0.1 is six minutes.
 */
function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    // An unknown or malformed currency is not worth losing the number over.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const STATUS_CLASS: Record<GccTaskStatus, string> = {
  todo: "bg-background text-muted",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
};

/**
 * A project's tasks and the time logged against them.
 *
 * One panel because neither half is usable alone: a task list you cannot log time against records
 * intentions, and time with nothing to attribute it to records only that someone was busy.
 */
export default function ProjectWorkPanel({ project }: { project: GccProject }) {
  const [tasks, setTasks] = useState<GccTask[] | null>(null);
  const [entries, setEntries] = useState<GccTimeEntry[] | null>(null);
  const [totals, setTotals] = useState<GccProjectTimeTotals | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [taskName, setTaskName] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskError, setTaskError] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);

  const [workDate, setWorkDate] = useState(today);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [billable, setBillable] = useState(true);
  const [entryTaskId, setEntryTaskId] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  // Bumped after every write, so the three reads below refresh together rather than each panel
  // half showing a different moment in the project's life.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const forProjectId = project.id;

    void (async () => {
      try {
        const [taskRows, entryRows, totalRows] = await Promise.all([
          listTasks(forProjectId),
          listTime(forProjectId),
          getTimeTotals(forProjectId),
        ]);
        if (cancelled) return;
        setTasks(taskRows);
        setEntries(entryRows);
        setTotals(totalRows);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError ? err.message : "Could not load tasks and time.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project.id, version]);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (taskName.trim().length === 0) return;
    setTaskError(null);
    setAddingTask(true);
    try {
      await createTask(project.id, {
        name: taskName,
        dueDate: taskDue || null,
        sortOrder: tasks?.length ?? 0,
      });
      setTaskName("");
      setTaskDue("");
      setVersion((v) => v + 1);
    } catch (err) {
      setTaskError(err instanceof ApiError ? err.message : "Could not add the task.");
    } finally {
      setAddingTask(false);
    }
  }

  async function handleStatus(task: GccTask, status: GccTaskStatus) {
    setTaskError(null);
    try {
      await updateTask(project.id, task.id, {
        name: task.name,
        status,
        description: task.description,
        assigneeUserId: task.assigneeUserId,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
        sortOrder: task.sortOrder,
      });
      setVersion((v) => v + 1);
    } catch (err) {
      setTaskError(err instanceof ApiError ? err.message : "Could not update the task.");
    }
  }

  async function handleLogTime(e: React.FormEvent) {
    e.preventDefault();
    const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    if (total <= 0) {
      setTimeError("Enter how long the work took.");
      return;
    }

    setTimeError(null);
    setLogging(true);
    try {
      await logTime(project.id, {
        workDate,
        minutes: total,
        billable,
        taskId: entryTaskId || null,
        description: entryNote.trim() || null,
      });
      setHours("");
      setMinutes("");
      setEntryNote("");
      setVersion((v) => v + 1);
    } catch (err) {
      // A 409 carries the reason — most often that the client has no rate, so billable time
      // cannot be logged. That sentence is the answer, so it is shown as written.
      setTimeError(
        err instanceof ApiError ? err.message : "Could not log the time.",
      );
    } finally {
      setLogging(false);
    }
  }

  const inputClass =
    "rounded-md border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  /** Minutes per task, so a task row can show what it has cost so far. */
  const minutesByTask = new Map<string, number>();
  for (const entry of entries ?? []) {
    if (!entry.taskId) continue;
    minutesByTask.set(entry.taskId, (minutesByTask.get(entry.taskId) ?? 0) + entry.minutes);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Tasks</h3>
          {tasks ? (
            <span className="text-sm text-muted">
              {tasks.filter((t) => t.status === "done").length} of {tasks.length} done
            </span>
          ) : null}
        </div>

        {loadError ? <p className="mt-3 text-sm text-red-600">{loadError}</p> : null}
        {!tasks && !loadError ? <p className="mt-3 text-sm text-muted">Loading…</p> : null}

        {tasks && tasks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No tasks yet. Add the first below — time can be logged against the project without one,
            but a task is how hours get attributed to a piece of work.
          </p>
        ) : null}

        {tasks && tasks.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {tasks.map((task) => {
              const logged = minutesByTask.get(task.id) ?? 0;
              return (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-3"
                >
                  <span className="flex-1 text-sm font-medium text-foreground">{task.name}</span>
                  {logged > 0 ? (
                    <span className="text-xs text-muted">{duration(logged)} logged</span>
                  ) : null}
                  {task.dueDate ? (
                    <span className="text-xs text-muted">Due {shortDate(task.dueDate)}</span>
                  ) : null}
                  <select
                    value={task.status}
                    onChange={(e) => void handleStatus(task, e.target.value as GccTaskStatus)}
                    className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${STATUS_CLASS[task.status]}`}
                  >
                    {GCC_TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {GCC_TASK_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        ) : null}

        {taskError ? <p className="mt-3 text-sm text-red-600">{taskError}</p> : null}

        <form onSubmit={handleAddTask} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-foreground">
            New task
            <input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Draft the pillar outline"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Due
            <input
              type="date"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={addingTask || taskName.trim().length === 0}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
          >
            {addingTask ? "Adding…" : "Add task"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Time</h3>
          {totals ? (
            <span className="flex flex-wrap items-baseline gap-3 text-sm">
              <span className="text-foreground">{duration(totals.totalMinutes)} total</span>
              <span className="text-muted">{duration(totals.billableMinutes)} billable</span>
              {/* One line per currency, never one number across them: a project whose client
                  changed currency has two real totals. */}
              {totals.billable.map((b) => (
                <span key={b.currency} className="font-medium text-brand">
                  {money(b.amount, b.currency)}
                </span>
              ))}
            </span>
          ) : null}
        </div>

        <form onSubmit={handleLogTime} className="mt-4 grid gap-3 sm:grid-cols-6">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
            Date
            <input
              type="date"
              required
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Hours
            <input
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="1"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Minutes
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="30"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
            Against
            <select
              value={entryTaskId}
              onChange={(e) => setEntryTaskId(e.target.value)}
              className={inputClass}
            >
              <option value="">The project</option>
              {(tasks ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-4">
            Note
            <input
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-normal text-foreground sm:col-span-2 sm:self-end sm:pb-2">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand focus:ring-2 focus:ring-brand/20"
            />
            Billable
          </label>

          <div className="sm:col-span-6">
            <button
              type="submit"
              disabled={logging}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
            >
              {logging ? "Logging…" : "Log time"}
            </button>
          </div>
        </form>

        {timeError ? <p className="mt-3 text-sm text-red-600">{timeError}</p> : null}

        {entries && entries.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-2">
            {entries.map((entry) => {
              const task = (tasks ?? []).find((t) => t.id === entry.taskId);
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 border-t border-border pt-2 text-sm"
                >
                  <span className="w-16 text-muted">{shortDate(entry.workDate)}</span>
                  <span className="font-medium text-foreground">{duration(entry.minutes)}</span>
                  <span className="flex-1 text-muted">
                    {task ? task.name : "Project"}
                    {entry.description ? ` — ${entry.description}` : ""}
                  </span>
                  {entry.billable && entry.rateSnapshot !== null && entry.currency ? (
                    <span className="text-xs text-brand">
                      {money((entry.minutes / 60) * entry.rateSnapshot, entry.currency)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">non-billable</span>
                  )}
                  {/* An invoiced entry cannot be changed at all — the database refuses it — so it
                      is marked rather than silently behaving differently from its neighbours. */}
                  {entry.invoicedAtUtc ? (
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                      invoiced
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {entries && entries.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No time logged against this project yet.</p>
        ) : null}
      </div>
    </div>
  );
}

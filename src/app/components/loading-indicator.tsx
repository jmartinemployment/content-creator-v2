"use client";

import type { ReactNode } from "react";

type SpinnerSize = "xs" | "sm" | "md";

const spinnerSizeClass: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border",
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
};

type LoadingSpinnerProps = {
  size?: SpinnerSize;
  className?: string;
};

/** Inline spinning ring — use inside buttons and status rows. */
export function LoadingSpinner({ size = "sm", className = "" }: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full border-[var(--cc-accent)] border-t-transparent ${spinnerSizeClass[size]} ${className}`}
    />
  );
}

type LoadingRowProps = {
  label: string;
  size?: SpinnerSize;
  className?: string;
};

/** Spinner + label for in-panel waits (crawl, hierarchy, first section, etc.). */
export function LoadingRow({ label, size = "sm", className = "" }: LoadingRowProps) {
  return (
    <p className={`flex items-center gap-2 text-sm text-[var(--cc-muted)] ${className}`}>
      <LoadingSpinner size={size} />
      <span>{label}</span>
    </p>
  );
}

type ButtonBusyLabelProps = {
  busy: boolean;
  busyLabel: string;
  idleLabel: ReactNode;
};

/** Button label that shows a spinner while an action is in flight. */
export function ButtonBusyLabel({ busy, busyLabel, idleLabel }: ButtonBusyLabelProps) {
  if (!busy) return <>{idleLabel}</>;
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <LoadingSpinner size="xs" />
      {busyLabel}
    </span>
  );
}

export function isJobProcessing(status: string): boolean {
  return status === "pending" || status === "running";
}

export function jobProcessLabel(status: string, stage: string | null): string | null {
  if (status === "pending") return "Starting job…";
  if (status !== "running") return null;

  switch (stage?.toLowerCase()) {
    case "plan":
      return "Planning outline…";
    case "write":
      return "Writing sections…";
    case "validate":
      return "Validating draft…";
    case "repair":
      return "Repairing issues…";
    case "done":
      return "Finishing up…";
    default:
      return "Generating content…";
  }
}

type ProcessBannerProps = {
  status: string;
  stage: string | null;
};

/** Prominent banner while a job is pending or running (PLAN / WRITE / VALIDATE / REPAIR). */
export function ProcessBanner({ status, stage }: ProcessBannerProps) {
  const label = jobProcessLabel(status, stage);
  if (!label) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-[var(--cc-accent)]/30 bg-[var(--cc-accent)]/5 px-4 py-3 text-sm text-[var(--cc-ink)]"
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size="md" />
      <div>
        <p className="font-medium">{label}</p>
        {stage ? <p className="text-xs text-[var(--cc-muted)]">Stage: {stage}</p> : null}
      </div>
    </div>
  );
}

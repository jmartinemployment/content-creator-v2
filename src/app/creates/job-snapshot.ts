import type { GccV2JobEvent } from "@/app/auth/job-hub";

export type JobSnapshot = {
  id: string;
  status: string;
  stage?: string;
  contentType?: string;
  error?: string | null;
  updatedAtUtc?: string | null;
  tabLabel?: string | null;
};

function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Derive tab/job-row updates from a hub JobEvent — no polling. */
export function applyJobEventToSnapshot(job: JobSnapshot, evt: GccV2JobEvent): JobSnapshot {
  const payload = parsePayload(evt.payloadJson);
  const at = evt.createdAtUtc;

  switch (evt.type) {
    case "JobFailed":
      return {
        ...job,
        status: "failed",
        error: typeof payload.error === "string" ? payload.error : "Job failed",
        updatedAtUtc: at,
      };
    case "JobCompleted":
      return { ...job, status: "ready", error: null, updatedAtUtc: at };
    case "JobCanceled":
      return { ...job, status: "canceled", updatedAtUtc: at };
    case "JobRetried":
      return { ...job, status: "pending", error: null, updatedAtUtc: at };
    case "JobStageChanged":
      return {
        ...job,
        stage: typeof payload.stage === "string" ? payload.stage : job.stage,
        status:
          job.status === "pending" || job.status === "failed" ? "running" : job.status,
        updatedAtUtc: at,
      };
    case "OutlineApproved":
      return { ...job, status: "running", updatedAtUtc: at };
    case "BrandKitReady":
      if (
        job.status === "ready"
        || job.status === "failed"
        || job.status === "canceled"
        || job.status === "running"
        || job.status === "awaiting_outline_approval"
      ) {
        return job;
      }
      return { ...job, status: "awaiting_brandkit_approval", updatedAtUtc: at };
    case "BrandKitAccepted":
      return { ...job, status: "awaiting_outline_approval", updatedAtUtc: at };
    case "BrandKitRejected":
      return { ...job, status: "awaiting_brandkit_approval", updatedAtUtc: at };
    default:
      return { ...job, updatedAtUtc: at };
  }
}

export const GENERATE_TYPE_ORDER = [
  "pillar",
  "blog",
  "tool",
  "comparison",
  "case-study",
  "guide",
  "alternatives",
  "tech-article",
  "listicle",
  "service",
  "local",
  "whitepaper",
  "linkedin-document",
  "email",
  "social",
  "ads",
  "image-prompt",
];

export function sortJobs<T extends { contentType?: string }>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const ai = GENERATE_TYPE_ORDER.indexOf((a.contentType ?? "").toLowerCase());
    const bi = GENERATE_TYPE_ORDER.indexOf((b.contentType ?? "").toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

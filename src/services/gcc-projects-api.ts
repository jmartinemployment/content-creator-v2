/**
 * Projects on GeekAPI's v1 surface (/api/geek-content-creator/projects).
 * Proxied via /api/cw, which forwards the user's Bearer token.
 *
 * A project belongs to exactly one client, has a schedule, and owns the work beneath it. It is not
 * the old keyword-plus-URL record: that one lived in a blob store, was deduped on target keyword,
 * and was deleted by the act of listing it.
 *
 * Every route here requires the content-creator.manage scope. A 403 from any of them means the
 * signed-in user's token predates that scope — signing in again fixes it.
 */

import { ApiError } from "./gcc-api";

const API_BASE = "/api/cw";
const PROJECTS = "/api/geek-content-creator/projects";

export { ApiError };

/** planned | active | on_hold | finished | cancelled. The database carries the same list. */
export type GccProjectStatus =
  | "planned"
  | "active"
  | "on_hold"
  | "finished"
  | "cancelled";

export const GCC_PROJECT_STATUSES: readonly GccProjectStatus[] = [
  "planned",
  "active",
  "on_hold",
  "finished",
  "cancelled",
];

/** How each status reads to an operator. The wire values stay snake_case. */
export const GCC_PROJECT_STATUS_LABELS: Record<GccProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  finished: "Finished",
  cancelled: "Cancelled",
};

export interface GccProject {
  id: string;
  clientId: string;
  name: string;
  code: string | null;
  description: string | null;
  status: GccProjectStatus;
  /** The site this engagement targets. */
  siteUrl: string | null;
  /** The Geek-Crawler-v2 crawl run for siteUrl — what content is grounded on. */
  projectSiteRunId: string | null;
  department: string | null;
  partnerUrls: string[];
  competitorUrls: string[];
  /** Calendar dates, "YYYY-MM-DD". Not instants — a due date has no time of day. */
  startDate: string;
  dueDate: string | null;
  /** Set exactly when status is "finished"; the database enforces the pair. */
  finishedDate: string | null;
  estimatedHours: number | null;
  budget: number | null;
  budgetCurrency: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface GccProjectLogEntry {
  id: number;
  projectId: string;
  occurredAtUtc: string;
  /** The token subject of whoever acted. */
  actorUserId: string;
  eventType: string;
  /** JSON describing the change. */
  payload: string;
}

async function projectsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(`Could not reach GeekAPI via ${API_BASE}.`, 0);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new ApiError(detail || response.statusText, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listProjects(clientId: string): Promise<GccProject[]> {
  return projectsRequest<GccProject[]>(
    `${PROJECTS}?clientId=${encodeURIComponent(clientId)}`,
  );
}

export function getProject(id: string): Promise<GccProject> {
  return projectsRequest<GccProject>(`${PROJECTS}/${encodeURIComponent(id)}`);
}

export function getProjectLog(id: string): Promise<GccProjectLogEntry[]> {
  return projectsRequest<GccProjectLogEntry[]>(
    `${PROJECTS}/${encodeURIComponent(id)}/log`,
  );
}

export interface CreateProjectInput {
  clientId: string;
  /**
   * Minted by the form when it opens, not by the server.
   *
   * It is what makes a second click of Create Project return the project the first click made
   * rather than a duplicate. A key already used under a different client is refused (409), so a
   * stale key can never hand back someone else's work.
   */
  idempotencyKey: string;
  name: string;
  startDate: string;
  code?: string | null;
  description?: string | null;
  siteUrl?: string | null;
  projectSiteRunId?: string | null;
  department?: string | null;
  partnerUrls?: string[];
  competitorUrls?: string[];
  dueDate?: string | null;
  estimatedHours?: number | null;
  budget?: number | null;
  budgetCurrency?: string | null;
}

export function createProject(input: CreateProjectInput): Promise<GccProject> {
  return projectsRequest<GccProject>(PROJECTS, {
    method: "POST",
    body: JSON.stringify({
      clientId: input.clientId,
      idempotencyKey: input.idempotencyKey,
      name: input.name.trim(),
      startDate: input.startDate,
      code: input.code ?? null,
      description: input.description ?? null,
      siteUrl: input.siteUrl ?? null,
      projectSiteRunId: input.projectSiteRunId ?? null,
      department: input.department ?? null,
      partnerUrls: input.partnerUrls ?? [],
      competitorUrls: input.competitorUrls ?? [],
      dueDate: input.dueDate ?? null,
      estimatedHours: input.estimatedHours ?? null,
      budget: input.budget ?? null,
      budgetCurrency: input.budgetCurrency ?? null,
    }),
  });
}

export type UpdateProjectInput = Omit<CreateProjectInput, "clientId" | "idempotencyKey">;

export function updateProject(id: string, input: UpdateProjectInput): Promise<GccProject> {
  return projectsRequest<GccProject>(`${PROJECTS}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({
      name: input.name.trim(),
      startDate: input.startDate,
      code: input.code ?? null,
      description: input.description ?? null,
      siteUrl: input.siteUrl ?? null,
      projectSiteRunId: input.projectSiteRunId ?? null,
      department: input.department ?? null,
      partnerUrls: input.partnerUrls ?? [],
      competitorUrls: input.competitorUrls ?? [],
      dueDate: input.dueDate ?? null,
      estimatedHours: input.estimatedHours ?? null,
      budget: input.budget ?? null,
      budgetCurrency: input.budgetCurrency ?? null,
    }),
  });
}

/**
 * Move a project to a new status.
 *
 * A finish date is required for "finished" and refused for anything else — the API and the
 * database both enforce that pairing, so there is no state where a project reads as finished
 * without saying when.
 */
export function changeProjectStatus(
  id: string,
  status: GccProjectStatus,
  finishedDate: string | null = null,
): Promise<GccProject> {
  return projectsRequest<GccProject>(`${PROJECTS}/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, finishedDate }),
  });
}

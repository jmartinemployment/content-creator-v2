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

const CLIENTS = "/api/geek-content-creator/clients";

/** Every part optional — plenty of real clients have only a country. */
export interface GccClientAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
}

/**
 * Per-client GeekBackend publish configuration.
 *
 * The env-var fields name environment variables the publish service reads at call time. The
 * secrets themselves are never stored or sent — that is what makes this safe to keep on the
 * client record.
 */
export interface GccClientPublishTarget {
  apiBaseUrl: string;
  /** camelCase of OAuthTokenEndpoint, which lowercases only the first letter. */
  oAuthTokenEndpoint: string;
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  defaultAuthorId: number | null;
  categoryStrategy: string | null;
}

export interface GccClient {
  id: string;
  name: string;
  notes: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  billingContactName: string | null;
  /** Stored, never derived from the contact email — so it is required even when identical. */
  billingEmail: string;
  contactAddress: GccClientAddress;
  billingAddress: GccClientAddress;
  /** Whole days; 0 is due on receipt. */
  paymentTermsDays: number;
  /** Null on purpose: a client with no rate cannot have billable time logged against it. */
  rate: number | null;
  currency: string;
  taxId: string | null;
  poReference: string | null;
  publishTarget: GccClientPublishTarget | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ClientDetailsInput {
  name: string;
  contactName: string;
  contactEmail: string;
  billingEmail: string;
  paymentTermsDays: number;
  currency: string;
  notes?: string | null;
  contactPhone?: string | null;
  billingContactName?: string | null;
  rate?: number | null;
  taxId?: string | null;
  poReference?: string | null;
}

function clientBody(input: ClientDetailsInput) {
  return {
    name: input.name.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim(),
    billingEmail: input.billingEmail.trim(),
    paymentTermsDays: input.paymentTermsDays,
    currency: input.currency.trim().toUpperCase(),
    notes: input.notes ?? null,
    contactPhone: input.contactPhone ?? null,
    billingContactName: input.billingContactName ?? null,
    rate: input.rate ?? null,
    taxId: input.taxId ?? null,
    poReference: input.poReference ?? null,
  };
}

export function listClients(): Promise<GccClient[]> {
  return projectsRequest<GccClient[]>(CLIENTS);
}

export function createClient(input: ClientDetailsInput): Promise<GccClient> {
  return projectsRequest<GccClient>(CLIENTS, {
    method: "POST",
    body: JSON.stringify(clientBody(input)),
  });
}

export function updateClient(id: string, input: ClientDetailsInput): Promise<GccClient> {
  return projectsRequest<GccClient>(`${CLIENTS}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ id, ...clientBody(input) }),
  });
}

/**
 * Delete a client.
 *
 * A client with projects is refused by the database. That is the intended answer: the alternative
 * is deleting the client's projects — their schedule, their log, and in time their hours — to make
 * a delete button work.
 */
export function deleteClient(id: string): Promise<void> {
  return projectsRequest<void>(`${CLIENTS}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** todo | in_progress | done. The database carries the same list. */
export type GccTaskStatus = "todo" | "in_progress" | "done";

export const GCC_TASK_STATUSES: readonly GccTaskStatus[] = ["todo", "in_progress", "done"];

export const GCC_TASK_STATUS_LABELS: Record<GccTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export interface GccTask {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: GccTaskStatus;
  assigneeUserId: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  sortOrder: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface GccTimeEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  userId: string;
  /** The day worked, "YYYY-MM-DD" — a timesheet date, not an instant. */
  workDate: string;
  minutes: number;
  description: string | null;
  billable: boolean;
  /** The client's rate when this was logged. A later rate change cannot move it. */
  rateSnapshot: number | null;
  currency: string | null;
  /** Once set the entry is frozen: the database refuses updates and deletes. */
  invoicedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Billable money is per currency and never summed across them. */
export interface GccBillableTotal {
  currency: string;
  minutes: number;
  amount: number;
}

export interface GccProjectTimeTotals {
  totalMinutes: number;
  billableMinutes: number;
  billable: GccBillableTotal[];
}

export function listTasks(projectId: string): Promise<GccTask[]> {
  return projectsRequest<GccTask[]>(`${PROJECTS}/${encodeURIComponent(projectId)}/tasks`);
}

export function createTask(
  projectId: string,
  input: {
    name: string;
    description?: string | null;
    assigneeUserId?: string | null;
    dueDate?: string | null;
    estimatedHours?: number | null;
    sortOrder?: number;
  },
): Promise<GccTask> {
  return projectsRequest<GccTask>(`${PROJECTS}/${encodeURIComponent(projectId)}/tasks`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      description: input.description ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
      dueDate: input.dueDate ?? null,
      estimatedHours: input.estimatedHours ?? null,
      sortOrder: input.sortOrder ?? 0,
    }),
  });
}

export function updateTask(
  projectId: string,
  taskId: string,
  input: {
    name: string;
    status: GccTaskStatus;
    description?: string | null;
    assigneeUserId?: string | null;
    dueDate?: string | null;
    estimatedHours?: number | null;
    sortOrder?: number;
  },
): Promise<GccTask> {
  return projectsRequest<GccTask>(
    `${PROJECTS}/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        name: input.name.trim(),
        status: input.status,
        description: input.description ?? null,
        assigneeUserId: input.assigneeUserId ?? null,
        dueDate: input.dueDate ?? null,
        estimatedHours: input.estimatedHours ?? null,
        sortOrder: input.sortOrder ?? 0,
      }),
    },
  );
}

export function listTime(projectId: string): Promise<GccTimeEntry[]> {
  return projectsRequest<GccTimeEntry[]>(`${PROJECTS}/${encodeURIComponent(projectId)}/time`);
}

export function getTimeTotals(projectId: string): Promise<GccProjectTimeTotals> {
  return projectsRequest<GccProjectTimeTotals>(
    `${PROJECTS}/${encodeURIComponent(projectId)}/time/totals`,
  );
}

/**
 * Log time against a project, and optionally one of its tasks.
 *
 * The user is never sent — GeekAPI takes it from the token, because a caller who could name the
 * user could log someone else's hours. A 409 means the write was refused with a reason worth
 * reading, most often that the client has no rate and so cannot have billable time logged.
 */
export function logTime(
  projectId: string,
  input: {
    workDate: string;
    minutes: number;
    billable: boolean;
    taskId?: string | null;
    description?: string | null;
  },
): Promise<GccTimeEntry> {
  return projectsRequest<GccTimeEntry>(`${PROJECTS}/${encodeURIComponent(projectId)}/time`, {
    method: "POST",
    body: JSON.stringify({
      workDate: input.workDate,
      minutes: input.minutes,
      billable: input.billable,
      taskId: input.taskId ?? null,
      description: input.description ?? null,
    }),
  });
}

/** planned | in_progress | delivered. The database carries the same list. */
export type GccDeliverableStatus = "planned" | "in_progress" | "delivered";

export const GCC_DELIVERABLE_STATUSES: readonly GccDeliverableStatus[] = [
  "planned",
  "in_progress",
  "delivered",
];

export const GCC_DELIVERABLE_STATUS_LABELS: Record<GccDeliverableStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  delivered: "Delivered",
};

export interface GccDeliverable {
  id: string;
  projectId: string;
  /** The create this deliverable is. One create, one deliverable. */
  createId: string;
  name: string;
  type: string;
  status: GccDeliverableStatus;
  dueDate: string | null;
  /** Set exactly when delivered; the database enforces the pair. */
  deliveredAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export function listDeliverables(projectId: string): Promise<GccDeliverable[]> {
  return projectsRequest<GccDeliverable[]>(
    `${PROJECTS}/${encodeURIComponent(projectId)}/deliverables`,
  );
}

/**
 * Record a deliverable on a project.
 *
 * A 409 means it was refused with a reason worth reading: the create belongs to another client, or
 * it is already a deliverable on some project. Neither is a fault to retry.
 */
export function createDeliverable(
  projectId: string,
  input: { createId: string; name: string; type?: string | null; dueDate?: string | null },
): Promise<GccDeliverable> {
  return projectsRequest<GccDeliverable>(
    `${PROJECTS}/${encodeURIComponent(projectId)}/deliverables`,
    {
      method: "POST",
      body: JSON.stringify({
        createId: input.createId,
        name: input.name.trim(),
        type: input.type ?? null,
        dueDate: input.dueDate ?? null,
      }),
    },
  );
}

export function changeDeliverableStatus(
  projectId: string,
  deliverableId: string,
  status: GccDeliverableStatus,
): Promise<GccDeliverable> {
  return projectsRequest<GccDeliverable>(
    `${PROJECTS}/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}/status`,
    { method: "PUT", body: JSON.stringify({ status }) },
  );
}

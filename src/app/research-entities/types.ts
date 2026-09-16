/**
 * Canonical partner/competitor entity shared by Create and task agents.
 * One company may have several indexed crawl pages; they all resolve to one entity.
 */
export type ResearchEntityRole = "partner" | "competitor";

export type ResearchEntity = {
  id: string;
  name: string;
  role: ResearchEntityRole;
  primaryUrl?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAtUtc: string;
  archivedAtUtc?: string | null;
};

/** A `ResearchEntity` reference carried on a generate/run request — id is optional for
 * entities created inline that haven't round-tripped through the API yet. */
export type ResearchEntityRef = {
  id?: string;
  name: string;
  role: ResearchEntityRole;
};

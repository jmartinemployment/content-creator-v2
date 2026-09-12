/**
 * Canonical partner/competitor entity, shared by the RAG writer (`/rag`) and every task
 * agent — see plans/make-content-creator-workable.md Milestone 1. One company may have
 * several indexed crawl pages; they all resolve to one entity record here. Replaces
 * free-text entity names and the hardcoded GeekAPI RagEntitySeedList.
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

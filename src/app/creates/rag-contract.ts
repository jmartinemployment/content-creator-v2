import type { ContentType } from "./content-types";

export type ModelPolicyPreset = "best-quality" | "o3-only" | "custom";

export type ModelPolicySelection = {
  version: "content-model-policy.v1";
  preset: ModelPolicyPreset;
  stageModels?: Record<string, string>;
  downgradeConfirmed?: boolean;
  downgradeReason?: "availability" | "quota" | "latency" | "cost" | "operator";
  operatorNote?: string;
};

export type ApprovedStageModels = Record<string, string[]>;

export type RagReadiness = {
  available: boolean;
  citeableGenerateAvailable?: boolean;
  graphRetrievalAvailable?: boolean;
  adTemplateIndexAvailable?: boolean;
  reason?: string | null;
  entitySeeds?: string[];
  modelPolicyVersion?: string | null;
  approvedStageModels?: ApprovedStageModels;
};

export type AgentExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "stopped"
  | "failed";

export type AgentStopReason =
  | "completed"
  | "max_turns"
  | "tool_budget_exhausted"
  | "token_budget_exhausted"
  | "stage_timeout"
  | "canceled"
  | "skill_activation_failed"
  | "tool_denied"
  | "evidence_failure"
  | "invalid_structured_output"
  | "incompatible_protocol"
  | "transient_upstream_failure";

export type ActivatedSkillProvenance = {
  skillId: string;
  versionId: string;
  name: string;
  version: string;
  packageDigest: string;
  resourcesRead?: Array<{ path: string; digest: string; byteCount?: number }>;
};

export type AgentToolSummary = {
  toolId: string;
  version: string;
  callCount: number;
  successCount: number;
  errorCount: number;
  durationMs?: number;
  resultCount?: number;
};

export type AgentBudget = {
  maxTurns: number;
  turnsUsed: number;
  maxToolCalls: number;
  toolCallsUsed: number;
  maxTokens: number;
  tokensUsed: number;
  maxDurationMs?: number;
  durationMs?: number;
  exhausted?: "turns" | "tool_calls" | "tokens" | "duration" | null;
};

export type AgentExecution = {
  protocolVersion: string;
  traceVersion: string;
  stage: string;
  /** Legacy execution label. Prefer catalogAgentId for identity and stageExecutionId for this run. */
  agentId: string;
  agentVersion: string;
  catalogAgentId?: string | null;
  agentVersionId?: string | null;
  agentDigest?: string | null;
  stageExecutionId?: string | null;
  teamRole?: "producer" | "contributor" | "reviewer" | string | null;
  specialty?: string | null;
  workflowVersion: string;
  promptVersion?: string | null;
  status: AgentExecutionStatus;
  attemptId: string;
  replacedAttemptId?: string | null;
  snapshotDigest: string;
  activatedSkills: ActivatedSkillProvenance[];
  tools: AgentToolSummary[];
  budget: AgentBudget;
  stopReason?: AgentStopReason | null;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
};

export type AgentTeamMemberProvenance = {
  catalogAgentId: string;
  agentVersionId: string;
  name: string;
  version: string;
  digest: string;
  role: "producer" | "contributor" | "reviewer" | string;
  specialty?: string | null;
  activatedSkills?: ActivatedSkillProvenance[];
};

export type AgentHandoffProvenance = {
  id?: string;
  fromCatalogAgentId: string;
  toCatalogAgentId: string;
  kind: "contribution" | "review" | string;
  stage?: string | null;
  status?: string | null;
  summary?: string | null;
  stageExecutionId?: string | null;
};

export type AgentTeamProvenance = {
  snapshotVersion?: string;
  catalogVersion?: string;
  snapshotDigest: string;
  selectedAgentIds?: string[];
  members: AgentTeamMemberProvenance[];
  handoffs?: AgentHandoffProvenance[];
};

export type RagProvenance = {
  modelUsed?: string | null;
  requestedModel?: string | null;
  effectiveModel?: string | null;
  modelPolicyVersion?: string | null;
  promptVersion?: string | null;
  retrievalStrategy?: string | null;
  retrievalMode?: string | null;
  evidenceIds?: string[];
  warnings?: string[];
  stage?: string | null;
  attemptId?: string | null;
  agentExecution?: AgentExecution | null;
  agentTeam?: AgentTeamProvenance | null;
  handoffs?: AgentHandoffProvenance[];
};

export type RagCitation = {
  pageId?: string | null;
  runId?: string | null;
  assetId?: string | null;
  assetVersionId?: string | null;
  resourceId?: string | null;
  url: string;
  title?: string | null;
  sectionTitle?: string | null;
  /** Create WRITE section key this citation supports (Canvas-ready). */
  sectionKey?: string | null;
  quote: string;
  crawlType?: string | null;
  /** SHA-256 of source text when provided. */
  sourceDigest?: string | null;
  /**
   * Provenance rights on the source page/chunk. Missing ≡ `unknown`.
   * Ship-ready requires `consented` | `licensed` on every displayed citation.
   */
  sourceRights?: "consented" | "licensed" | "unknown" | "prohibited" | string | null;
  /** True only after quote↔source verify succeeds. */
  verified?: boolean;
  coordinates?: {
    page?: number | null;
    slide?: number | null;
    sheet?: string | null;
    cellRange?: string | null;
    timeStartSeconds?: number | null;
    timeEndSeconds?: number | null;
    region?: string | null;
  } | null;
};

export type EvidenceIndexReadiness = {
  role: string;
  runId?: string | null;
  label?: string | null;
  indexed: boolean;
  detail?: string | null;
};

export type ResearchEntityRef = {
  entityId?: string | null;
  displayName: string;
  /** Role for this create request only (`partner` | `competitor`). */
  role: "partner" | "competitor" | string;
  primaryUrl?: string | null;
  stableKey?: string | null;
};

export type ResearchEvidenceManifest = {
  version?: string;
  ready?: boolean;
  sources?: Array<{
    pageId?: string | null;
    url: string;
    title?: string | null;
    crawlType?: string | null;
    authority?: string | null;
    freshness?: string | null;
  }>;
  verifiedCitations?: RagCitation[];
  candidateQuotes?: RagCitation[];
  evidenceGaps?: string[];
  conflicts?: string[];
  warnings?: string[];
  indexReadiness?: EvidenceIndexReadiness[];
  internalLinkOpportunities?: string[];
  assembledAtUtc?: string;
};

export type RagCapability =
  | "guided-outline"
  | "battlecard"
  | "ad-templates"
  | "slides"
  | "strategy-theme"
  | "visual-brief";

export function ragCapabilitiesFor(contentType: ContentType): RagCapability[] {
  if (contentType === "comparison" || contentType === "alternatives") {
    return ["battlecard", "guided-outline"];
  }
  if (contentType === "ads" || contentType === "social" || contentType === "email") {
    return ["ad-templates"];
  }
  if (contentType === "linkedin-document") return ["slides", "strategy-theme"];
  if (contentType === "image-prompt") return ["visual-brief"];
  return ["guided-outline"];
}

export function modelPolicyLabel(policy: ModelPolicySelection | null | undefined): string {
  if (!policy) return "Backend default";
  if (policy.preset === "o3-only") return "o3";
  if (policy.preset === "custom") return "Custom";
  return "gpt-4o-mini";
}

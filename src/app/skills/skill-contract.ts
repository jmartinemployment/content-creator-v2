export type SkillLifecycleStatus =
  | "quarantined"
  | "in_review"
  | "approved"
  | "rejected"
  | "published"
  | "deprecated";

export type SkillOrigin = "first-party" | "community";

export type SkillSource = {
  repositoryUrl: string;
  commit: string;
  path: string;
  discoveryUrl?: string | null;
};

export type SkillSummary = {
  id: string;
  versionId?: string;
  name: string;
  version: string;
  contribution: string;
  source: SkillSource;
  packageDigest: string;
  manifestDigest?: string | null;
  license: string;
  compatibility: string;
  reviewStatus: SkillLifecycleStatus | string;
  reviewer?: string | null;
  reviewedAtUtc?: string | null;
  publishedAtUtc?: string | null;
  supportedStages: string[];
  supportedContentTypes: string[];
  requestedTools: string[];
  activationMode?: string;
  assignedAgentIds?: string[];
  deprecatedAtUtc?: string | null;
  supersededByVersionId?: string | null;
  origin: SkillOrigin;
};

export type SkillBundle = {
  id: string;
  name: string;
  goal: string;
  skillIds: string[];
};

export type SkillCatalog = {
  catalogVersion: string;
  envelopeVersion?: string;
  selectionMode: string;
  customizationAvailable: boolean;
  skills: SkillSummary[];
  recommendedBundles: SkillBundle[];
};

export type ResolvedSkillSnapshot = {
  snapshotVersion: string;
  catalogVersion: string;
  snapshotDigest: string;
  resolvedAtUtc: string;
  signatureKeyId?: string | null;
  skills: SkillSummary[];
};

export type SkillReviewFinding = {
  id: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  scanner: string;
  rule: string;
  filePath?: string | null;
  line?: number | null;
  message: string;
  disposition?: "open" | "accepted" | "resolved" | "false_positive" | null;
  reviewerRationale?: string | null;
};

export type SkillFile = {
  path: string;
  mediaType: string;
  byteCount: number;
  digest: string;
  content?: string | null;
  executable: boolean;
};

export type SkillAuditEvent = {
  id: string;
  actor: string;
  action: string;
  atUtc: string;
  requestId?: string | null;
  beforeStatus?: string | null;
  afterStatus?: string | null;
  detail?: string | null;
};

export type AdminSkillDetail = SkillSummary & {
  findings: SkillReviewFinding[];
  files: SkillFile[];
  audit: SkillAuditEvent[];
};

export type SkillAdminWorkspace = {
  authorized: true;
  skills: AdminSkillDetail[];
};

const PROHIBITED_PARSE_PATTERN =
  /llama[\s_-]*(parse|cloud)|llama_parse|@llamaindex\/cloud|llama\s*cloud\s*api\s*key/i;

export function containsProhibitedParserReference(value: string): boolean {
  return PROHIBITED_PARSE_PATTERN.test(value);
}

export function assertSafeSkillImportFields(values: string[]): string | null {
  return values.some(containsProhibitedParserReference)
    ? "Hosted parsing services and parser plugins are prohibited. Import only inert Agent Skill files for the existing Markdown corpus."
    : null;
}

export function shortDigest(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

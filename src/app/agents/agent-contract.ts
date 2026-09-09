export type AgentLifecycleStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "deprecated"
  | "revoked";

export type AgentTeamRole = "producer" | "contributor" | "reviewer";
export type AgentSpecialty = "content" | "marketing" | "seo" | "aeo" | string;

export type AgentStageParticipation = {
  stage: string;
  role: AgentTeamRole;
  order: number;
};

export type AgentSkillPin = {
  id: string;
  versionId: string;
  version: string;
  digest: string;
  name?: string;
};

export type AgentSummary = {
  id: string;
  agentId?: string;
  versionId: string;
  name: string;
  description: string;
  objective: string;
  version: string;
  digest: string;
  role: AgentTeamRole;
  specialty: AgentSpecialty;
  status: AgentLifecycleStatus | string;
  supportedContentTypes: string[];
  supportedStages: string[];
  skillIds: string[];
  skills: AgentSkillPin[];
  participation: AgentStageParticipation[];
  tools: string[];
  models: string[];
  modelPolicyVersion: string;
  modelPolicy?: {
    version: string;
    allowedModels: string[];
  } | null;
  publishedAtUtc?: string | null;
  deprecatedAtUtc?: string | null;
  revokedAtUtc?: string | null;
};

export type AgentCatalog = {
  catalogVersion: string;
  agents: AgentSummary[];
};

export type AgentTestRun = {
  id: string;
  agentVersionId: string;
  versionDigest: string;
  scenario: "contract" | "rag-smoke" | string;
  status: string;
  progressPercent: number;
  phase: string;
  message?: string | null;
  resultJson?: string | null;
  error?: string | null;
  attemptCount: number;
  queuedAtUtc?: string | null;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  cancellationRequestedAtUtc?: string | null;
};

export type AgentTestEvent = {
  contractVersion: "gcc-agent-test-event.v1";
  testRunId: string;
  agentVersionId: string;
  versionDigest: string;
  status: string;
  progressPercent: number;
  phase: string;
  message?: string | null;
  attemptCount: number;
  queuedAtUtc: string;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  resultJson?: string | null;
  error?: string | null;
};

export type AgentAuditEvent = {
  id: string;
  action: string;
  actor: string;
  atUtc: string;
  detail?: string | null;
};

export type AgentReviewFinding = {
  id: string;
  severity: "info" | "low" | "medium" | "high" | "critical" | string;
  scanner: string;
  rule: string;
  message: string;
  blocking: boolean;
  disposition?: "open" | "resolved" | "accepted" | "false_positive" | string | null;
  reviewerRationale?: string | null;
};

export type AdminAgentDetail = AgentSummary & {
  instructions: string;
  tests: AgentTestRun[];
  findings: AgentReviewFinding[];
  audit: AgentAuditEvent[];
};

export type AgentAdminWorkspace = {
  authorized: true;
  agents: AdminAgentDetail[];
};

export type ResolvedAgentMember = AgentSummary & {
  pinnedSkills: AgentSkillPin[];
};

export type ResolvedAgentTeam = {
  snapshotVersion: string;
  catalogVersion: string;
  snapshotDigest: string;
  resolvedAtUtc?: string | null;
  selectedAgentIds: string[];
  agents: ResolvedAgentMember[];
  skills: AgentSkillPin[];
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent response must be an object.");
  }
  return value as Record<string, unknown>;
}

function text(source: Record<string, unknown>, key: string, required = false): string {
  const value = source[key];
  if (typeof value === "string") return value;
  if (required) throw new Error(`Agent response is missing ${key}.`);
  return "";
}

function texts(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Agent response field ${key} must be a string array.`);
  }
  return value as string[];
}

function participation(value: unknown): AgentStageParticipation[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Agent participation must be an array.");
  return value.map((item) => {
    const row = record(item);
    const role = text(row, "role", true);
    if (!["producer", "contributor", "reviewer"].includes(role)) {
      throw new Error(`Unknown agent participation role: ${role}.`);
    }
    if (typeof row.order !== "number") throw new Error("Agent participation order must be numeric.");
    return { stage: text(row, "stage", true), role: role as AgentTeamRole, order: row.order };
  });
}

function skillPins(value: unknown): AgentSkillPin[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Agent skills must be an array.");
  return value.map((item) => {
    const skill = record(item);
    return {
      id: text(skill, "id", true),
      versionId: text(skill, "versionId", true),
      version: text(skill, "version", true),
      digest: text(skill, "digest", true),
      name: text(skill, "name") || undefined,
    };
  });
}

export function normalizeAgent(value: unknown): AgentSummary {
  const source = record(value);
  const stages = participation(source.participation);
  const skills = skillPins(source.skills);
  const role = text(source, "role") || stages[0]?.role || "contributor";
  if (!["producer", "contributor", "reviewer"].includes(role)) {
    throw new Error(`Unknown agent role: ${role}.`);
  }
  return {
    id: text(source, "id", true),
    agentId: text(source, "agentId") || undefined,
    versionId: text(source, "versionId", true),
    name: text(source, "name", true),
    description: text(source, "description"),
    objective: text(source, "objective"),
    version: text(source, "version", true),
    digest: text(source, "digest", true),
    role: role as AgentTeamRole,
    specialty: text(source, "specialty") || text(source, "id", true),
    status: text(source, "status", true),
    supportedContentTypes: texts(source, "supportedContentTypes"),
    supportedStages: texts(source, "supportedStages"),
    skillIds: texts(source, "skillIds"),
    skills,
    participation: stages,
    tools: texts(source, "tools"),
    models: texts(source, "models"),
    modelPolicyVersion: text(source, "modelPolicyVersion"),
    modelPolicy: source.modelPolicy && typeof source.modelPolicy === "object"
      ? {
          version: text(record(source.modelPolicy), "version", true),
          allowedModels: texts(record(source.modelPolicy), "allowedModels"),
        }
      : null,
    publishedAtUtc: text(source, "publishedAtUtc") || null,
    deprecatedAtUtc: text(source, "deprecatedAtUtc") || null,
    revokedAtUtc: text(source, "revokedAtUtc") || null,
  };
}

export function normalizeAgentCatalog(value: unknown): AgentCatalog {
  const source = record(value);
  if (!Array.isArray(source.agents)) throw new Error("Agent catalog is missing agents.");
  return {
    catalogVersion: text(source, "catalogVersion", true),
    agents: source.agents.map(normalizeAgent),
  };
}

export function normalizeResolvedAgentTeam(value: unknown): ResolvedAgentTeam {
  const source = record(value);
  if (!Array.isArray(source.agents)) throw new Error("Resolved team is missing agents.");
  const rawAgents = source.agents;
  const agents = rawAgents.map((item) => {
    const member = record(item);
    return {
      ...normalizeAgent(member.agent ?? member),
      pinnedSkills: skillPins(member.pinnedSkills),
    };
  }).filter((agent) => agent.id);
  const selectedAgentIds = texts(source, "selectedAgentIds");
  return {
    snapshotVersion: text(source, "snapshotVersion", true),
    catalogVersion: text(source, "catalogVersion", true),
    snapshotDigest: text(source, "snapshotDigest", true),
    resolvedAtUtc: text(source, "resolvedAtUtc") || null,
    selectedAgentIds: selectedAgentIds.length ? selectedAgentIds : agents.map((agent) => agent.id),
    agents,
    skills: skillPins(source.skills),
  };
}

export function normalizeAgentTestRun(value: unknown): AgentTestRun {
  const source = record(value);
  const number = (key: string, fallback = 0) =>
    typeof source[key] === "number" ? source[key] as number : fallback;
  return {
    id: text(source, "id", true),
    agentVersionId: text(source, "agentVersionId", true),
    versionDigest: text(source, "versionDigest", true),
    scenario: text(source, "scenario", true),
    status: text(source, "status", true),
    progressPercent: number("progressPercent"),
    phase: text(source, "phase", true),
    resultJson: text(source, "resultJson") || null,
    error: text(source, "error") || null,
    attemptCount: number("attemptCount"),
    queuedAtUtc: text(source, "queuedAtUtc") || null,
    startedAtUtc: text(source, "startedAtUtc") || null,
    completedAtUtc: text(source, "completedAtUtc") || null,
    cancellationRequestedAtUtc: text(source, "cancellationRequestedAtUtc") || null,
  };
}

export function normalizeAgentTestEvent(value: unknown): AgentTestEvent {
  const source = record(value);
  if (source.contractVersion !== "gcc-agent-test-event.v1") {
    throw new Error("Unsupported agent test event contract.");
  }
  const run = normalizeAgentTestRun({
    ...source,
    id: source.testRunId,
    scenario: "contract",
  });
  return {
    contractVersion: "gcc-agent-test-event.v1",
    testRunId: run.id,
    agentVersionId: run.agentVersionId,
    versionDigest: run.versionDigest,
    status: run.status,
    progressPercent: run.progressPercent,
    phase: run.phase,
    message: text(source, "message") || null,
    attemptCount: run.attemptCount,
    queuedAtUtc: text(source, "queuedAtUtc", true),
    startedAtUtc: run.startedAtUtc,
    completedAtUtc: run.completedAtUtc,
    resultJson: run.resultJson,
    error: run.error,
  };
}

export function normalizeAgentAdminWorkspace(value: unknown): AgentAdminWorkspace {
  const source = record(value);
  if (source.authorized !== true || !Array.isArray(source.agents)) {
    throw new Error("Agent admin workspace contract is invalid.");
  }
  return {
    authorized: true,
    agents: source.agents.map((item) => {
      const agent = record(item);
      for (const field of ["agentId", "objective", "instructions", "modelPolicyVersion"]) {
        text(agent, field, true);
      }
      for (const field of ["skills", "participation", "tools", "models", "tests", "findings", "audit"]) {
        if (!Array.isArray(agent[field])) throw new Error(`Agent admin detail is missing exact ${field}.`);
      }
      return {
        ...normalizeAgent(agent),
        instructions: text(agent, "instructions", true),
        tests: (agent.tests as unknown[]).map(normalizeAgentTestRun),
        findings: (agent.findings as unknown[]).map((entry) => {
          const finding = record(entry);
          if (typeof finding.blocking !== "boolean") {
            throw new Error("Agent finding is missing blocking.");
          }
          return {
            id: text(finding, "id", true),
            severity: text(finding, "severity", true),
            scanner: text(finding, "scanner", true),
            rule: text(finding, "rule", true),
            message: text(finding, "message", true),
            blocking: finding.blocking,
            disposition: text(finding, "disposition") || null,
            reviewerRationale: text(finding, "reviewerRationale") || null,
          };
        }),
        audit: (agent.audit as unknown[]).map((entry) => {
          const event = record(entry);
          return {
            id: text(event, "id", true),
            action: text(event, "action", true),
            actor: text(event, "actor", true),
            atUtc: text(event, "atUtc", true),
            detail: text(event, "detail") || null,
          };
        }),
      };
    }),
  };
}

export function isCompatibleAgent(agent: AgentSummary, contentTypes: string[]): boolean {
  return agent.status.toLowerCase() === "published"
    && (agent.supportedContentTypes.length === 0
      || contentTypes.some((type) => agent.supportedContentTypes.includes(type)));
}

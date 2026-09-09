export type ContextLifecycle = "draft" | "in_review" | "approved" | "deprecated" | "revoked";
export type ContextKind =
  | "knowledge"
  | "brand-kit"
  | "audience"
  | "style-guide"
  | "product-schema"
  | "product";
export type IngestionState =
  | "queued"
  | "scanning"
  | "extracting"
  | "indexing"
  | "ready"
  | "failed"
  | "cancelled";

export type ContextFinding = {
  id: string;
  severity: "info" | "warning" | "blocking" | string;
  code?: string | null;
  message: string;
  disposition?: string | null;
};

export type ContextAuditEvent = {
  id: string;
  action: string;
  actor: string;
  atUtc: string;
  detail?: string | null;
};

export type ContextProvenance = {
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  sourceTimestampUtc?: string | null;
  parser?: string | null;
  parserVersion?: string | null;
  contentDigest?: string | null;
};

export type GovernedVersion = {
  id: string;
  versionNumber: number;
  lifecycle: ContextLifecycle | string;
  digest: string;
  createdAtUtc: string;
  createdBy?: string | null;
  freshness?: "fresh" | "stale" | "expired" | string | null;
  ingestionState?: IngestionState | string | null;
  extractionState?: string | null;
  indexState?: string | null;
  provenance?: ContextProvenance | null;
  findings?: ContextFinding[];
  audit?: ContextAuditEvent[];
  data?: Record<string, unknown> | null;
  productSchemaVersionId?: string | null;
  approvedClaims?: string[];
  prohibitedClaims?: string[];
  mandatoryDisclaimers?: string[];
};

export type GovernedCatalogItem = {
  id: string;
  kind?: ContextKind | string;
  name: string;
  description?: string | null;
  tags?: string[];
  retired?: boolean;
  currentVersionId?: string | null;
  versions: GovernedVersion[];
};

export type GovernedCatalogResponse = {
  items: GovernedCatalogItem[];
};

export type IngestionEvent = {
  id: string;
  jobId: string;
  seq: number;
  state: IngestionState | string;
  message: string;
  progressPercent?: number | null;
  createdAtUtc: string;
  assetId?: string | null;
};

export type ProductSelection = {
  productVersionId: string;
  selectedFieldIds: string[];
};

export type ContextSelectionRequest = {
  knowledgeAssetVersionIds: string[];
  runAttachmentIds: string[];
  audienceVersionId?: string;
  styleGuideVersionId?: string;
  productSelections: ProductSelection[];
  brandKitVersionId?: string;
  locale: string;
  runNotes?: string;
  webSearchEnabled: boolean;
  knowledgeSearchEnabled: boolean;
};

export type ResolvedContextEntry = {
  kind: ContextKind | "run-attachment" | string;
  stableId?: string | null;
  versionId?: string | null;
  name: string;
  versionNumber?: number | null;
  lifecycle?: string | null;
  digest?: string | null;
  inherited?: boolean;
  temporary?: boolean;
  freshness?: string | null;
  extractionState?: string | null;
  indexState?: string | null;
  provenance?: ContextProvenance | null;
};

export type ResolvedContextPreview = {
  effectiveEntries: ResolvedContextEntry[];
  inheritedEntries: ResolvedContextEntry[];
  warnings: ContextFinding[];
  blockingFindings: ContextFinding[];
  freshness: Array<{ versionId: string; status: string; message?: string | null }>;
  estimatedContextSize: number;
  agentCompatibility: Array<{
    agentId: string;
    compatible: boolean;
    message?: string | null;
  }>;
};

export type DirectUploadGrant = {
  uploadId: string;
  uploadUrl: string;
  method?: "PUT" | "POST";
  headers?: Record<string, string>;
  requiredHeaders?: Record<string, string>;
  expiresAtUtc: string;
  maxBytes: number;
};

export type UploadCompletion = {
  uploadId: string;
  attachmentId?: string | null;
  assetId?: string | null;
  versionId?: string | null;
  ingestionJobId: string;
  state: IngestionState | string;
};

export type RunContextManifest = {
  manifestId: string;
  digest: string;
  schemaVersion: string;
  signingKeyId: string;
  resolvedAtUtc: string;
  entries: ResolvedContextEntry[];
  warnings: ContextFinding[];
  validationFindings: ContextFinding[];
  originalJobId?: string | null;
  replacesJobId?: string | null;
};

export const EMPTY_CONTEXT_SELECTION: ContextSelectionRequest = {
  knowledgeAssetVersionIds: [],
  runAttachmentIds: [],
  productSelections: [],
  locale: "en-US",
  webSearchEnabled: true,
  knowledgeSearchEnabled: true,
};

function jsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      return stringList(JSON.parse(value));
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeVersion(value: unknown): GovernedVersion | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const versionNumber = typeof raw.versionNumber === "number" ? raw.versionNumber : 0;
  if (!id || versionNumber < 1) return null;
  const provenance = jsonObject(raw.provenance) ?? jsonObject(raw.provenanceJson);
  const data = jsonObject(raw.data)
    ?? jsonObject(raw.payloadJson)
    ?? jsonObject(raw.policyJson)
    ?? jsonObject(raw.definitionJson)
    ?? jsonObject(raw.fieldsJson)
    ?? jsonObject(raw.fieldValuesJson);
  // Product schemas may store fields as a top-level array.
  const schemaFields = Array.isArray(raw.fieldsJson)
    ? { fields: raw.fieldsJson }
    : typeof raw.fieldsJson === "string"
      ? (() => {
        try {
          const parsed = JSON.parse(raw.fieldsJson);
          return Array.isArray(parsed) ? { fields: parsed } : jsonObject(parsed);
        } catch {
          return null;
        }
      })()
      : null;
  return {
    id,
    versionNumber,
    lifecycle: String(raw.lifecycle ?? raw.lifecycleState ?? "draft"),
    digest: String(raw.digest ?? raw.canonicalSha256 ?? ""),
    createdAtUtc: String(raw.createdAtUtc ?? new Date(0).toISOString()),
    createdBy: typeof raw.createdBy === "string" ? raw.createdBy : null,
    freshness: typeof raw.freshness === "string" ? raw.freshness : null,
    ingestionState: typeof raw.ingestionState === "string" ? raw.ingestionState : null,
    extractionState: typeof raw.extractionState === "string" ? raw.extractionState : null,
    indexState: typeof raw.indexState === "string" ? raw.indexState : null,
    provenance: provenance as ContextProvenance | null,
    findings: Array.isArray(raw.findings) ? raw.findings as ContextFinding[] : [],
    audit: Array.isArray(raw.audit) ? raw.audit as ContextAuditEvent[] : [],
    data: data ?? schemaFields,
    productSchemaVersionId: typeof raw.productSchemaVersionId === "string"
      ? raw.productSchemaVersionId
      : null,
    approvedClaims: stringList(raw.approvedClaims ?? raw.approvedClaimsJson),
    prohibitedClaims: stringList(raw.prohibitedClaims ?? raw.prohibitedClaimsJson),
    mandatoryDisclaimers: stringList(raw.mandatoryDisclaimers ?? raw.mandatoryDisclaimersJson),
  };
}

export function normalizeCatalog(value: unknown): GovernedCatalogItem[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? ((value as { items?: unknown[]; results?: unknown[] }).items
        ?? (value as { results?: unknown[] }).results
        ?? [])
      : [];
  return rows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const raw = value as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    const name = typeof raw.name === "string" ? raw.name : "";
    if (!id || !name) return [];
    const versions = (Array.isArray(raw.versions) ? raw.versions : [])
      .map(normalizeVersion)
      .filter((version): version is GovernedVersion => version !== null);
    let tags: string[] = [];
    if (Array.isArray(raw.tags)) tags = raw.tags.filter((tag): tag is string => typeof tag === "string");
    else if (typeof raw.tagsJson === "string") {
      try {
        const parsed = JSON.parse(raw.tagsJson);
        if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === "string");
      } catch {
        tags = [];
      }
    }
    return [{
      id,
      kind: typeof raw.kind === "string" ? raw.kind : undefined,
      name,
      description: typeof raw.description === "string" ? raw.description : null,
      tags,
      retired: raw.retired === true || raw.isRetired === true,
      currentVersionId: typeof raw.currentVersionId === "string" ? raw.currentVersionId : null,
      versions,
    }];
  });
}

export function currentVersion(item: GovernedCatalogItem): GovernedVersion | null {
  return item.versions.find((version) => version.id === item.currentVersionId)
    ?? [...item.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]
    ?? null;
}

function normalizeFinding(value: unknown, index: number): ContextFinding {
  if (typeof value === "string") {
    return { id: `finding-${index}`, severity: "blocking", message: value };
  }
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(raw.id ?? `finding-${index}`),
    severity: String(raw.severity ?? "blocking"),
    code: typeof raw.code === "string" ? raw.code : null,
    message: String(raw.message ?? raw.code ?? "Context finding"),
    disposition: typeof raw.disposition === "string" ? raw.disposition : null,
  };
}

function normalizeResolvedEntry(value: unknown): ResolvedContextEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const kind = String(raw.kind ?? raw.contextKind ?? "");
  if (!kind) return null;
  const versionNumber = typeof raw.versionNumber === "number" ? raw.versionNumber : null;
  return {
    kind: kind.replaceAll("_", "-"),
    stableId: typeof raw.stableId === "string" ? raw.stableId : null,
    versionId: typeof raw.versionId === "string" ? raw.versionId : null,
    name: String(raw.name ?? `${kind.replaceAll("_", " ")}${versionNumber ? ` v${versionNumber}` : ""}`),
    versionNumber,
    lifecycle: typeof raw.lifecycle === "string"
      ? raw.lifecycle
      : typeof raw.lifecycleDecision === "string" ? raw.lifecycleDecision : null,
    digest: typeof raw.digest === "string"
      ? raw.digest
      : typeof raw.contentSha256 === "string" ? raw.contentSha256 : null,
    inherited: raw.inherited === true || raw.selectionSource === "owner_default",
    temporary: raw.temporary === true || kind === "run_attachment",
    freshness: typeof raw.freshness === "string"
      ? raw.freshness
      : typeof raw.freshnessDecision === "string" ? raw.freshnessDecision : null,
    extractionState: typeof raw.extractionState === "string" ? raw.extractionState : null,
    indexState: typeof raw.indexState === "string" ? raw.indexState : null,
    provenance: jsonObject(raw.provenance) as ContextProvenance | null,
  };
}

export function normalizeContextPreview(value: unknown): ResolvedContextPreview {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const entries = (input: unknown) => (Array.isArray(input) ? input : [])
    .map(normalizeResolvedEntry)
    .filter((entry): entry is ResolvedContextEntry => entry !== null);
  return {
    effectiveEntries: entries(raw.effectiveEntries),
    inheritedEntries: entries(raw.inheritedEntries),
    warnings: (Array.isArray(raw.warnings) ? raw.warnings : [])
      .map((finding, index) => ({ ...normalizeFinding(finding, index), severity: "warning" })),
    blockingFindings: (Array.isArray(raw.blockingFindings) ? raw.blockingFindings : [])
      .map(normalizeFinding),
    freshness: Array.isArray(raw.freshness)
      ? raw.freshness as ResolvedContextPreview["freshness"]
      : [],
    estimatedContextSize: typeof raw.estimatedContextSize === "number" ? raw.estimatedContextSize : 0,
    agentCompatibility: Array.isArray(raw.agentCompatibility)
      ? raw.agentCompatibility as ResolvedContextPreview["agentCompatibility"]
      : [],
  };
}

export function normalizeRunContextManifest(value: unknown): RunContextManifest {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    manifestId: String(raw.manifestId ?? raw.id ?? ""),
    digest: String(raw.digest ?? raw.sha256 ?? ""),
    schemaVersion: String(
      raw.schemaVersion === 1 ? "run-context-manifest.v1" : raw.schemaVersion ?? "",
    ),
    signingKeyId: String(raw.signingKeyId ?? ""),
    resolvedAtUtc: String(raw.resolvedAtUtc ?? ""),
    entries: (Array.isArray(raw.entries) ? raw.entries : [])
      .map(normalizeResolvedEntry)
      .filter((entry): entry is ResolvedContextEntry => entry !== null),
    warnings: (Array.isArray(raw.warnings) ? raw.warnings : [])
      .map((finding, index) => ({ ...normalizeFinding(finding, index), severity: "warning" })),
    validationFindings: (Array.isArray(raw.validationFindings) ? raw.validationFindings : [])
      .map(normalizeFinding),
    originalJobId: typeof raw.originalJobId === "string" ? raw.originalJobId : null,
    replacesJobId: typeof raw.replacesJobId === "string" ? raw.replacesJobId : null,
  };
}

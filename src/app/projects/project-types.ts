export type ProjectStatus = "planning" | "in-progress" | "review" | "complete";
export type AssetStatus = "draft" | "in-review" | "approved" | "published";
export type AssetKind = "brief" | "article" | "social" | "image" | "email" | "report";
export type ActivityKind = "created" | "versioned" | "handoff" | "review";

export type EvidenceReference = Readonly<{
  id: string;
  label: string;
  source: string;
}>;

export type AssetVersion = Readonly<{
  id: string;
  version: number;
  createdAt: string;
  createdBy: string;
  status: AssetStatus;
  summary: string;
  evidence: readonly EvidenceReference[];
  provenance: Readonly<{
    origin: "human" | "agent" | "mixed";
    agent?: string;
    model?: string;
    note: string;
    sourceRunId?: string;
    sourceArtifactVersionId?: string;
    artifactType?: string;
    digest?: string;
  }>;
}>;

export type ProjectAsset = Readonly<{
  id: string;
  title: string;
  kind: AssetKind;
  parentAssetIds: readonly string[];
  versions: readonly AssetVersion[];
}>;

export type ProjectActivity = Readonly<{
  id: string;
  kind: ActivityKind;
  actor: string;
  occurredAt: string;
  message: string;
}>;

export type CanvasProject = Readonly<{
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  updatedAt: string;
  owner: string;
  collaborators: readonly string[];
  assets: readonly ProjectAsset[];
  activity: readonly ProjectActivity[];
  persistence: "session-draft" | "server";
}>;

export type AppendVersionInput = Readonly<
  Omit<AssetVersion, "id" | "version">
>;

export type AssetLineage = Readonly<{
  asset: ProjectAsset;
  parents: readonly ProjectAsset[];
  children: readonly ProjectAsset[];
}>;

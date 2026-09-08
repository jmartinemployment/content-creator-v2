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
};

export type RagCitation = {
  pageId?: string | null;
  url: string;
  title?: string | null;
  sectionTitle?: string | null;
  quote: string;
  crawlType?: string | null;
  verified?: boolean;
};

export type ResearchEvidenceManifest = {
  ready?: boolean;
  sources?: Array<{
    pageId?: string | null;
    url: string;
    title?: string | null;
    crawlType?: string | null;
    authority?: string | null;
    freshness?: string | null;
  }>;
  evidenceGaps?: string[];
  conflicts?: string[];
  warnings?: string[];
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
  if (policy.preset === "o3-only") return "o3 only";
  if (policy.preset === "custom") return "Custom";
  return "Best quality";
}

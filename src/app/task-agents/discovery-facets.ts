/** Jasper-parity discovery facets for the fourteen purpose-built task agents. */
export type TaskAgentDiscoveryFacets = {
  workflow: "originate" | "optimize" | "outrank";
  marketingFunction: string[];
  contentType: string[];
  funnelStage: string[];
  process: string[];
};

export const TASK_AGENT_DISCOVERY_FACETS: Record<string, TaskAgentDiscoveryFacets> = {
  "ai-readiness": {
    workflow: "optimize",
    marketingFunction: ["aeo", "seo"],
    contentType: ["page", "article"],
    funnelStage: ["awareness", "consideration"],
    process: ["audit", "score"],
  },
  "fact-density": {
    workflow: "optimize",
    marketingFunction: ["aeo", "content"],
    contentType: ["page", "article"],
    funnelStage: ["awareness", "consideration"],
    process: ["audit"],
  },
  "entity-mapper": {
    workflow: "optimize",
    marketingFunction: ["aeo", "seo"],
    contentType: ["page", "topic"],
    funnelStage: ["awareness"],
    process: ["audit", "map"],
  },
  "schema-markup": {
    workflow: "optimize",
    marketingFunction: ["seo", "aeo"],
    contentType: ["page", "article", "faq"],
    funnelStage: ["awareness", "consideration"],
    process: ["markup", "publish-prep"],
  },
  "query-planner": {
    workflow: "originate",
    marketingFunction: ["seo", "aeo", "content"],
    contentType: ["query", "brief"],
    funnelStage: ["awareness", "consideration"],
    process: ["plan"],
  },
  "ai-readiness-comparison": {
    workflow: "optimize",
    marketingFunction: ["aeo", "competitive"],
    contentType: ["page", "comparison"],
    funnelStage: ["consideration"],
    process: ["compare", "audit"],
  },
  "content-gap": {
    workflow: "outrank",
    marketingFunction: ["aeo", "competitive", "content"],
    contentType: ["page", "gap-report"],
    funnelStage: ["consideration"],
    process: ["gap-find", "audit"],
  },
  "competitor-audit": {
    workflow: "outrank",
    marketingFunction: ["competitive", "aeo"],
    contentType: ["audit", "page"],
    funnelStage: ["consideration", "decision"],
    process: ["audit"],
  },
  "competitor-positioning": {
    workflow: "outrank",
    marketingFunction: ["competitive", "brand"],
    contentType: ["positioning", "narrative"],
    funnelStage: ["consideration", "decision"],
    process: ["position"],
  },
  "citable-claims": {
    workflow: "originate",
    marketingFunction: ["content", "aeo"],
    contentType: ["claims", "article"],
    funnelStage: ["awareness", "consideration"],
    process: ["originate", "optimize"],
  },
  "faq-generator": {
    workflow: "originate",
    marketingFunction: ["content", "aeo", "seo"],
    contentType: ["faq"],
    funnelStage: ["awareness", "consideration"],
    process: ["originate"],
  },
  "comparison-brief": {
    workflow: "originate",
    marketingFunction: ["competitive", "content"],
    contentType: ["brief", "comparison"],
    funnelStage: ["consideration", "decision"],
    process: ["originate", "brief"],
  },
  "pillar-outline": {
    workflow: "originate",
    marketingFunction: ["content", "seo", "aeo"],
    contentType: ["pillar", "outline"],
    funnelStage: ["awareness"],
    process: ["originate", "plan"],
  },
  "pillar-article": {
    workflow: "originate",
    marketingFunction: ["content", "seo", "aeo"],
    contentType: ["pillar", "article"],
    funnelStage: ["awareness"],
    process: ["originate", "draft"],
  },
  "competitive-response": {
    workflow: "outrank",
    marketingFunction: ["competitive", "content"],
    contentType: ["response", "article"],
    funnelStage: ["consideration", "decision"],
    process: ["respond", "originate"],
  },
  "competitor-page": {
    workflow: "outrank",
    marketingFunction: ["competitive", "aeo"],
    contentType: ["page", "audit"],
    funnelStage: ["consideration"],
    process: ["audit"],
  },
};

export function resolveDiscoveryFacets(
  capabilityId: string,
  facets: Record<string, unknown> | null | undefined,
): TaskAgentDiscoveryFacets | null {
  const fallback = TASK_AGENT_DISCOVERY_FACETS[capabilityId];
  if (!fallback) return null;
  const workflow = typeof facets?.workflow === "string" ? facets.workflow : fallback.workflow;
  if (workflow !== "originate" && workflow !== "optimize" && workflow !== "outrank") {
    return fallback;
  }
  const asStringArray = (value: unknown, backup: string[]) =>
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
      ? (value as string[])
      : backup;
  return {
    workflow,
    marketingFunction: asStringArray(facets?.marketingFunction, fallback.marketingFunction),
    contentType: asStringArray(facets?.contentType, fallback.contentType),
    funnelStage: asStringArray(facets?.funnelStage, fallback.funnelStage),
    process: asStringArray(facets?.process, fallback.process),
  };
}

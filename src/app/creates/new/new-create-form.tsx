"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BRIEF_VERSION,
  BUYING_STAGES,
  PRIMARY_INTENTS,
  TONES_OF_VOICE,
  type BuyingStage,
  type PrimaryIntent,
  type ToneOfVoice,
} from "../brief-catalog";
import {
  alsoDraftOptionsFor,
  labelForContentType,
  requiresCitationEvidenceGate,
  type ContentType,
  type PrimaryDraftType,
  PRIMARY_DRAFT_TYPES,
} from "../content-types";
import {
  isCrawlRunInProgress,
  isCrawlRunReady,
  normalizeCrawlPage,
  normalizeSiteUrl,
  siteSectionForApi,
  siteSectionFromCrawlPages,
  type SiteSectionContext,
} from "../site-section";
import {
  createProjectSiteHubConnection,
  joinProjectSiteCrawl,
  onProjectSiteCrawlEvent,
  onProjectSiteHubReconnected,
  type ProjectSiteCrawlEvent,
} from "@/app/auth/project-site-hub";
import {
  normalizeSiteHierarchy,
  SiteHierarchyPanel,
  type SiteHierarchy,
} from "./site-hierarchy-panel";
import { ButtonBusyLabel, LoadingRow } from "@/app/components/loading-indicator";
import { fetchRagStatus } from "@/app/creates/rag-client/rag-library-client";
import { loadAdTemplates } from "@/app/creates/rag-client/ad-templates";
import type { RagAdTemplate } from "@/app/creates/rag-client/types";
import {
  ragCapabilitiesFor,
  type ModelPolicySelection,
  type RagReadiness,
} from "../rag-contract";
import { shortDigest, type ResolvedSkillSnapshot } from "@/app/skills/skill-contract";
import {
  formatsCoveredBy,
  formatsSkippedBy,
  isCompatibleAgent,
  normalizeAgentCatalog,
  normalizeResolvedAgentTeam,
  type AgentCatalog,
  type ResolvedAgentTeam,
} from "@/app/agents/agent-contract";
import {
  EMPTY_CONTEXT_SELECTION,
  normalizeContextPreview,
  type ContextSelectionRequest,
  type ResolvedContextPreview,
} from "@/app/brand-sources/context-contract";
import { humanizeContextBlocks } from "./humanize-context-blocks";
import { ContextSelector } from "./context-selector";
import {
  clearNewCreateDraft,
  consumeNewCreateResumeIntent,
  draftHasProgress,
  loadNewCreateDraft,
  saveNewCreateDraft,
  type NewCreateDraftV1,
  type NewCreateWizardStep,
} from "./new-create-draft";

/** Empty optional GUID fields must be omitted so Generate can auto-create brand kit / skip gates. */
function sanitizeContextSelection(selection: ContextSelectionRequest): ContextSelectionRequest {
  const trimOrUndef = (value?: string) => {
    const next = value?.trim();
    return next ? next : undefined;
  };
  return {
    ...selection,
    knowledgeAssetVersionIds: selection.knowledgeAssetVersionIds.filter(Boolean),
    runAttachmentIds: selection.runAttachmentIds.filter(Boolean),
    productSelections: selection.productSelections.filter((p) => Boolean(p.productVersionId)),
    brandKitVersionId: trimOrUndef(selection.brandKitVersionId),
    audienceVersionId: trimOrUndef(selection.audienceVersionId),
    styleGuideVersionId: trimOrUndef(selection.styleGuideVersionId),
    visualGuidelineVersionId: trimOrUndef(selection.visualGuidelineVersionId),
    runNotes: trimOrUndef(selection.runNotes),
  };
}

const selectClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const inputClass = selectClass;
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";

const CRAWL_WAIT_MS = 15 * 60 * 1000;

type Step = NewCreateWizardStep;

const WIZARD_STEPS = [
  { key: "source", label: "Source" },
  { key: "goal", label: "Content goal" },
  { key: "audience", label: "Audience & direction" },
  { key: "research", label: "Research" },
  { key: "outputs", label: "Outputs" },
  { key: "review", label: "Review" },
] as const;

const FORMAT_GROUPS = [
  {
    label: "Articles & authority",
    values: ["blog", "pillar", "guide", "tech-article", "listicle", "whitepaper"],
  },
  {
    label: "Product & conversion",
    values: ["tool", "comparison", "alternatives", "case-study", "service", "local"],
  },
  {
    label: "Campaign content",
    values: ["email", "social", "ads", "image-prompt"],
  },
  {
    label: "Documents",
    values: ["linkedin-document"],
  },
] as const;

const RESTORABLE_STEPS = new Set<Step>([
  "source",
  "goal",
  "audience",
  "research",
  "outputs",
  "review",
]);

async function loadSectionFromCrawlRun(
  runId: string,
  resolvedSiteUrl: string,
): Promise<SiteSectionContext> {
  const res = await fetch(`/api/gcc-v2/project-site/runs/${encodeURIComponent(runId)}/pages`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Could not load crawl pages (HTTP ${res.status})`,
    );
  }
  const rawPages = (body.pages ?? body.Pages ?? []) as Record<string, unknown>[];
  const pages = rawPages.map(normalizeCrawlPage).filter((p): p is NonNullable<typeof p> => p !== null);
  const section = siteSectionFromCrawlPages(runId, resolvedSiteUrl, pages);
  if (section.relatedPages.length === 0) {
    throw new Error(
      "This crawl has no site pages yet — wait for the crawl to finish or start a new one.",
    );
  }
  return section;
}

type PartnerToolRow = {
  name: string;
  url?: string | null;
  source: string;
};

type PartnerToolsPreflight = {
  createId: string;
  matchedHeading?: string | null;
  matchTopic?: string | null;
  path?: string[] | null;
  toolCount: number;
  toolsFound: boolean;
  tools: PartnerToolRow[];
  message?: string;
  externalResearchNote?: string | null;
  partnerResearchWarnings?: string[];
  siteHierarchy?: SiteHierarchy | null;
};

/**
 * `Name | https://… | perk` — one partner per line. The optional third field carries an
 * affiliate perk (discount code, extended trial, bonus). Perks are negotiated with the vendor and
 * appear nowhere on their site, so no crawl can ever extract them; they are operator-asserted and
 * travel labelled as such, never as verified evidence.
 */
function parseOperatorTools(text: string): Array<{ name?: string; url: string; perk?: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length === 1) {
        return parts[0] ? { url: parts[0] } : null;
      }
      const [name, url, ...rest] = parts;
      if (!url) return null;
      const perk = rest.join(" | ").trim();
      return {
        ...(name ? { name } : {}),
        url,
        ...(perk ? { perk } : {}),
      };
    })
    .filter((row): row is { name?: string; url: string; perk?: string } => row !== null);
}

function primaryDraftHelperCopy(primary: PrimaryDraftType): string {
  switch (primary) {
    case "tool":
      return "Long-form tool pages require an indexed partner crawl run. One keyword overview plus a full page per partner tool from supplied URLs. Optionally add pillar/blog under Also draft.";
    case "comparison":
      return "Side-by-side evaluation — outline gets one section per option. Named partners/competitors require indexed crawl runs (fail closed) before PLAN.";
    case "alternatives":
      return "Narrative alternatives page (one section per partner tool). Named partners require an indexed partner crawl run before PLAN. Use Tool page under Also draft for full partner pages.";
    case "case-study":
      return "Proof-led story: context, challenge, approach, implementation, results, and lessons. Optional FAQ when PAA questions are available.";
    case "guide":
      return "Step-by-step how-to with prerequisites and numbered steps. Uses site hierarchy headings when available.";
    case "local":
      return "Local landing page grounded in project site and Geek-Crawler local runs (crawlType: local). Start local crawls in Geek-Crawler — not inline here.";
    case "whitepaper":
      return "Long-form report (export-only — HTML in whitepapers/ folder). Higher word floor at VALIDATE.";
    case "tech-article":
      return "Architecture and implementation depth — article-like WRITE path with TechnicalArticle JSON-LD.";
    case "listicle":
      return "Ranked or numbered picks with blurbs and a verdict section — blog-like WRITE path.";
    case "service":
      return "Commercial service page: shorter target length, CTA clarity emphasized at VALIDATE.";
    case "blog":
      return "Blog-style long-form with citeable section coverage at VALIDATE. Check another long-form under Also draft to write both.";
    case "ads":
    case "social":
    case "email":
      return "Short-form drafting — no section citation-coverage gate. Partner-driven ads still require an indexed partner run when partner URLs are listed.";
    case "linkedin-document":
      return "A slide-oriented PDF with connected strategy themes. No long-form citation-coverage gate.";
    case "image-prompt":
      return "A specialized visual brief grounded in brand and topic evidence. No long-form citation-coverage gate. Ready parent Creates (all types including Tool — tools = partners) auto-spawn H1/hero + per-H2 image-prompt siblings.";
    default:
      return "Long-form WRITE path (default Pillar). Check other long-form types under Also draft to write both. Re-Purpose on Canvas remixes any ready draft tab into channel packs — not image prompts. Image prompts auto-spawn (H1 + H2) for every parent type including Tool.";
  }
}

const RAG_CAPABILITY_LABELS = {
  "guided-outline": "Guided evidence outline",
  battlecard: "Partner / competitor battlecard",
  "ad-templates": "Short-form template variations",
  slides: "Slide preview",
  "strategy-theme": "GraphRAG strategy themes",
  "visual-brief": "Evidence-grounded visual brief",
} as const;

type NewCreateFormProps = {
  initialTopic?: string;
  initialContentType?: ContentType;
  initialTools?: string;
  initialCompetitors?: string;
  initialNotes?: string;
};

type SavedProjectSite = {
  runId: string;
  siteUrl: string;
  status: string;
  completedAtUtc?: string | null;
};

export function NewCreateForm({
  initialTopic = "",
  initialContentType = "pillar",
  initialTools = "",
  initialCompetitors = "",
  initialNotes = "",
}: NewCreateFormProps) {
  const router = useRouter();
  const crawlAbortRef = useRef<AbortController | null>(null);
  const hubRef = useRef<ReturnType<typeof createProjectSiteHubConnection> | null>(null);

  const [step, setStep] = useState<Step>("source");
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [forceRecrawl, setForceRecrawl] = useState(false);
  const [analyzingLabel, setAnalyzingLabel] = useState<string | null>(null);

  const [projectSiteCrawlRunId, setProjectSiteCrawlRunId] = useState<string | null>(null);
  const [section, setSection] = useState<SiteSectionContext | null>(null);

  const [title, setTitle] = useState(initialTopic);
  const [primaryDraft, setPrimaryDraft] = useState<PrimaryDraftType>(initialContentType);
  const [alsoDrafts, setAlsoDrafts] = useState<Set<ContentType>>(() => new Set());
  const [targetKeyword, setTargetKeyword] = useState("");
  const [operatorToolsText, setOperatorToolsText] = useState(initialTools);
  const [paaQuestionsText, setPaaQuestionsText] = useState("");
  const [competitorUrlsText, setCompetitorUrlsText] = useState(initialCompetitors);
  const [writingNotes, setWritingNotes] = useState(initialNotes);
  const [primaryIntent, setPrimaryIntent] = useState<PrimaryIntent | "">("");
  const [buyingStage, setBuyingStage] = useState<BuyingStage | "">("");
  const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice | "">("");
  const [ragStatus, setRagStatus] = useState<RagReadiness | null>(null);
  const [ragStatusLoading, setRagStatusLoading] = useState(true);
  const [ragStatusError, setRagStatusError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RagAdTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [savedProjectSitesError, setSavedProjectSitesError] = useState<string | null>(null);
  const [targetEntities, setTargetEntities] = useState<string[]>([]);
  const [conceptInput, setConceptInput] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [modelPolicy, setModelPolicy] = useState<ModelPolicySelection>({
    version: "content-model-policy.v1",
    preset: "best-quality",
  });
  const [contextSelection, setContextSelection] = useState<ContextSelectionRequest>(EMPTY_CONTEXT_SELECTION);
  const [contextPreview, setContextPreview] = useState<ResolvedContextPreview | null>(null);
  const [contextUploadProcessing, setContextUploadProcessing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCreateId, setPendingCreateId] = useState<string | null>(null);
  const [toolsPreflight, setToolsPreflight] = useState<PartnerToolsPreflight | null>(null);
  const ensureCreateIdInflight = useRef<Promise<string> | null>(null);
  const [siteHierarchy, setSiteHierarchy] = useState<SiteHierarchy | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [resolvedSkills, setResolvedSkills] = useState<ResolvedSkillSnapshot | null>(null);
  const [resolvedSkillsLoading, setResolvedSkillsLoading] = useState(false);
  const [resolvedSkillsError, setResolvedSkillsError] = useState<string | null>(null);
  const [agentCatalog, setAgentCatalog] = useState<AgentCatalog | null>(null);
  const [agentCatalogError, setAgentCatalogError] = useState<string | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [resolvedTeam, setResolvedTeam] = useState<ResolvedAgentTeam | null>(null);
  const [resolvedTeamLoading, setResolvedTeamLoading] = useState(false);
  const [resolvedTeamError, setResolvedTeamError] = useState<string | null>(null);
  const [savedProjectSites, setSavedProjectSites] = useState<SavedProjectSite[]>([]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [restoredDraftNotice, setRestoredDraftNotice] = useState(false);

  useEffect(() => {
    return () => {
      crawlAbortRef.current?.abort();
      void hubRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resumeFromQuery = params.get("resume") === "1";
    const resumeFromFlag = consumeNewCreateResumeIntent();
    const shouldResume = resumeFromQuery || resumeFromFlag;
    const draft = shouldResume ? loadNewCreateDraft() : null;

    if (draft && draftHasProgress(draft)) {
      const nextStep = RESTORABLE_STEPS.has(draft.step) ? draft.step : "source";
      setStep(nextStep === "analyzing" ? "source" : nextStep);
      setSiteUrlInput(draft.siteUrlInput);
      setSiteUrl(draft.siteUrl);
      setForceRecrawl(Boolean(draft.forceRecrawl));
      setProjectSiteCrawlRunId(draft.projectSiteCrawlRunId);
      setSection(draft.section);
      setTitle(draft.title);
      setPrimaryDraft(draft.primaryDraft);
      setAlsoDrafts(new Set(draft.alsoDrafts));
      setTargetKeyword(draft.targetKeyword);
      setOperatorToolsText(draft.operatorToolsText);
      setPaaQuestionsText(draft.paaQuestionsText);
      setCompetitorUrlsText(draft.competitorUrlsText);
      setWritingNotes(draft.writingNotes);
      setPrimaryIntent(draft.primaryIntent);
      setBuyingStage(draft.buyingStage);
      setToneOfVoice(draft.toneOfVoice);
      setTargetEntities(draft.targetEntities);
      setSelectedTemplateIds(draft.selectedTemplateIds);
      setModelPolicy(draft.modelPolicy);
      setContextSelection(draft.contextSelection);
      setPendingCreateId(draft.pendingCreateId);
      setSiteHierarchy(draft.siteHierarchy);
      setSelectedAgentIds(draft.selectedAgentIds);
      setRestoredDraftNotice(true);
    } else {
      clearNewCreateDraft();
    }

    if (resumeFromQuery) {
      const url = new URL(window.location.href);
      url.searchParams.delete("resume");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }

    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    const draft: NewCreateDraftV1 = {
      version: 1,
      step,
      siteUrlInput,
      siteUrl,
      forceRecrawl,
      projectSiteCrawlRunId,
      section,
      title,
      primaryDraft,
      alsoDrafts: Array.from(alsoDrafts),
      targetKeyword,
      operatorToolsText,
      paaQuestionsText,
      competitorUrlsText,
      writingNotes,
      primaryIntent,
      buyingStage,
      toneOfVoice,
      targetEntities,
      selectedTemplateIds,
      modelPolicy,
      contextSelection,
      pendingCreateId,
      siteHierarchy,
      selectedAgentIds,
    };
    if (!draftHasProgress(draft)) {
      clearNewCreateDraft();
      return;
    }
    saveNewCreateDraft(draft);
  }, [
    draftHydrated,
    step,
    siteUrlInput,
    siteUrl,
    forceRecrawl,
    projectSiteCrawlRunId,
    section,
    title,
    primaryDraft,
    alsoDrafts,
    targetKeyword,
    operatorToolsText,
    paaQuestionsText,
    competitorUrlsText,
    writingNotes,
    primaryIntent,
    buyingStage,
    toneOfVoice,
    targetEntities,
    selectedTemplateIds,
    modelPolicy,
    contextSelection,
    pendingCreateId,
    siteHierarchy,
    selectedAgentIds,
  ]);

  useEffect(() => {
    let cancelled = false;
    void loadAdTemplates().then((loaded) => {
      if (cancelled) return;
      setTemplatesLoading(false);
      if (loaded.status === "ok") {
        setTemplates(loaded.data);
        setTemplatesError(null);
        return;
      }
      if (loaded.status === "unauthorized") {
        setTemplates([]);
        setTemplatesError("Sign in to load ad templates.");
        return;
      }
      setTemplates([]);
      setTemplatesError(loaded.error);
    });
    void fetchRagStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.status === "ok") {
          setRagStatus(status.data);
          setRagStatusError(null);
          return;
        }
        if (status.status === "unauthorized") {
          setRagStatus(null);
          setRagStatusError("Sign in to check research readiness.");
          return;
        }
        setRagStatus(null);
        setRagStatusError(status.error);
      })
      .finally(() => {
        if (!cancelled) setRagStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/gcc-v2/project-site/runs", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setSavedProjectSitesError("Sign in to load saved project sites.");
          setSavedProjectSites([]);
          return;
        }
        if (!response.ok) {
          setSavedProjectSitesError(`Could not load saved project sites (HTTP ${response.status}).`);
          setSavedProjectSites([]);
          return;
        }
        const body = await response.json().catch(() => null);
        setSavedProjectSitesError(null);
        setSavedProjectSites(Array.isArray(body) ? (body as SavedProjectSite[]) : []);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setSavedProjectSites([]);
        setSavedProjectSitesError(
          cause instanceof Error ? cause.message : "Could not load saved project sites.",
        );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/gcc-v2/agents", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const catalog = normalizeAgentCatalog(body);
        setAgentCatalog(catalog);
        setSelectedAgentIds((current) => {
          if (current.length) return current;
          const producer = catalog.agents.find((agent) => agent.role === "producer" && agent.status.toLowerCase() === "published");
          return producer ? [producer.id] : [];
        });
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setAgentCatalog(null);
          setAgentCatalogError(cause instanceof Error ? cause.message : "Could not load specialists");
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (step !== "review") return;
    const contentTypes = [
      primaryDraft,
      ...alsoDraftOptionsFor(primaryDraft)
        .map((option) => option.value)
        .filter((value) => alsoDrafts.has(value)),
    ];
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      setResolvedSkillsLoading(true);
      setResolvedSkillsError(null);
    });
    void fetch(`/api/gcc-v2/skills/resolve?contentTypes=${encodeURIComponent(contentTypes.join(","))}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as ResolvedSkillSnapshot | { error?: string } | null;
        if (!response.ok) throw new Error(body && "error" in body ? body.error : `HTTP ${response.status}`);
        setResolvedSkills(body as ResolvedSkillSnapshot);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setResolvedSkills(null);
          setResolvedSkillsError(cause instanceof Error ? cause.message : "Could not resolve skills");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvedSkillsLoading(false);
      });
    return () => controller.abort();
  }, [alsoDrafts, primaryDraft, step]);

  useEffect(() => {
    if (step !== "review") return;
    // Catalog fetch failed: skip client resolve; Create/Generate use the backend default team.
    if (!agentCatalog && agentCatalogError) {
      void Promise.resolve().then(() => {
        setResolvedTeam(null);
        setResolvedTeamError(null);
        setResolvedTeamLoading(false);
      });
      return;
    }
    if (!agentCatalog) return;
    const contentTypes = [
      primaryDraft,
      ...alsoDraftOptionsFor(primaryDraft)
        .map((option) => option.value)
        .filter((value) => alsoDrafts.has(value)),
    ];
    const compatible = agentCatalog.agents.filter((agent) =>
      isCompatibleAgent(agent, primaryDraft),
    );
    const selected = selectedAgentIds.filter((id) => compatible.some((agent) => agent.id === id));
    const producerCount = compatible.filter((agent) => agent.role === "producer" && selected.includes(agent.id)).length;
    if (producerCount !== 1) {
      void Promise.resolve().then(() => {
        setResolvedTeam(null);
        setResolvedTeamError("Select exactly one compatible producer.");
      });
      return;
    }
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      setResolvedTeamLoading(true);
      setResolvedTeamError(null);
    });
    void fetch("/api/gcc-v2/agents/resolve", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedAgentIds: selected, contentTypes }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
        setResolvedTeam(normalizeResolvedAgentTeam(body));
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setResolvedTeam(null);
          setResolvedTeamError(cause instanceof Error ? cause.message : "Could not resolve specialist team");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvedTeamLoading(false);
      });
    return () => controller.abort();
  }, [agentCatalog, agentCatalogError, alsoDrafts, primaryDraft, selectedAgentIds, step]);


  useEffect(() => {
    if (step !== "review") return;
    if (pendingCreateId ?? toolsPreflight?.createId) return;
    let cancelled = false;
    void ensureCreateId().catch((cause) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : "Could not prepare this create for attachments.");
      }
    });
    return () => { cancelled = true; };
    // ensureCreateId closes over latest wizard fields; re-run when entering Review without an id.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional Review entry ensure
  }, [step, pendingCreateId, toolsPreflight?.createId]);

  const loadSiteHierarchyFromRun = useCallback(async (runId: string) => {
    setHierarchyLoading(true);
    setHierarchyError(null);
    try {
      const res = await fetch(
        `/api/gcc-v2/project-site/runs/${encodeURIComponent(runId)}/site-hierarchy`,
        { cache: "no-store" },
      );
      const body = (await res.json().catch(() => null)) as {
        siteHierarchy?: unknown;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error || `hierarchy failed: HTTP ${res.status}`);
      }
      const normalized = normalizeSiteHierarchy(body?.siteHierarchy);
      setSiteHierarchy(normalized);
      if (!normalized) {
        setHierarchyError("Mobile hierarchy was not attached from the project-site crawl.");
      }
    } catch (err) {
      setSiteHierarchy(null);
      setHierarchyError(err instanceof Error ? err.message : "Could not load site hierarchy");
    } finally {
      setHierarchyLoading(false);
    }
  }, []);

  const applyReadyCrawl = useCallback(async (runId: string, resolvedSiteUrl: string) => {
    setAnalyzingLabel("Loading pages from this site…");
    const loaded = await loadSectionFromCrawlRun(runId, resolvedSiteUrl);
    setProjectSiteCrawlRunId(runId);
    setSiteUrl(resolvedSiteUrl);
    setSection(loaded);
    setStep("goal");
    setAnalyzingLabel("Loading mobile site hierarchy…");
    setBusy(false);
    void loadSiteHierarchyFromRun(runId).finally(() => setAnalyzingLabel(null));
    // Promotion to the source library is no longer driven from here. Completing a project-site crawl
    // is what promotes and indexes it, server-side (GccV2ProjectSiteCrawlService), so crawls finishing
    // via API, retry or stall recovery reach the corpus too — and a failure is logged rather than
    // discarded with the wizard advancing regardless.
  }, [loadSiteHierarchyFromRun]);

  const waitForCrawlComplete = useCallback(
    async (
      runId: string,
      resolvedSiteUrl: string,
      signal: AbortSignal,
    ): Promise<void> => {
      const started = Date.now();
      return new Promise((resolve, reject) => {
        const connection = createProjectSiteHubConnection();
        hubRef.current = connection;

        const cleanup = () => {
          offEvent();
          offReconnect();
          void connection.stop();
          hubRef.current = null;
        };

        const finishReady = () => {
          cleanup();
          resolve();
        };

        const finishError = (message: string) => {
          cleanup();
          reject(new Error(message));
        };

        const handleEvent = (evt: ProjectSiteCrawlEvent) => {
          if (evt.runId !== runId) return;
          if (isCrawlRunReady(evt.status)) {
            void applyReadyCrawl(runId, resolvedSiteUrl).then(finishReady).catch(reject);
            return;
          }
          if (/^failed$/i.test(evt.status)) {
            finishError(evt.errorSummary || "Project-site crawl failed.");
            return;
          }
          setAnalyzingLabel(
            typeof evt.pageCount === "number" && evt.pageCount > 0
              ? `Crawling… ${evt.pageCount} page(s) so far`
              : "Crawling project site…",
          );
          if (Date.now() - started > CRAWL_WAIT_MS) {
            finishError("Project-site crawl timed out — try again.");
          }
        };

        const offEvent = onProjectSiteCrawlEvent(connection, handleEvent);
        const offReconnect = onProjectSiteHubReconnected(connection, () => runId, () => {
          setError("Live updates disconnected — refresh.");
        });

        signal.addEventListener(
          "abort",
          () => {
            cleanup();
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );

        void (async () => {
          try {
            await joinProjectSiteCrawl(connection, runId);
            const snapRes = await fetch(
              `/api/gcc-v2/project-site/runs/${encodeURIComponent(runId)}`,
              { cache: "no-store", signal },
            );
            const snap = (await snapRes.json().catch(() => ({}))) as ProjectSiteCrawlEvent;
            if (isCrawlRunReady(snap.status)) {
              await applyReadyCrawl(runId, resolvedSiteUrl);
              finishReady();
            } else if (/^failed$/i.test(snap.status ?? "")) {
              finishError(snap.errorSummary || "Project-site crawl failed.");
            }
          } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) {
              cleanup();
              reject(err);
            }
          }
        })();
      });
    },
    [applyReadyCrawl],
  );

  async function resolveSite(force: boolean) {
    setError(null);
    const normalized = normalizeSiteUrl(siteUrlInput);
    if (!normalized) {
      setError("Enter a site URL or domain (required).");
      return;
    }

    crawlAbortRef.current?.abort();
    const ac = new AbortController();
    crawlAbortRef.current = ac;

    setBusy(true);
    setStep("analyzing");
    setAnalyzingLabel(force ? "Starting a new crawl…" : "Looking up existing crawl…");
    setSection(null);
    setProjectSiteCrawlRunId(null);
    setSiteHierarchy(null);
    setHierarchyError(null);
    setToolsPreflight(null);

    try {
      if (!force) {
        const latestRes = await fetch(
          `/api/gcc-v2/project-site/runs/latest?siteUrl=${encodeURIComponent(normalized)}`,
          { cache: "no-store", signal: ac.signal },
        );
        if (latestRes.ok) {
          const latest = (await latestRes.json()) as { runId?: string; status?: string };
          if (latest.runId) {
            if (isCrawlRunReady(latest.status)) {
              await applyReadyCrawl(latest.runId, normalized);
              return;
            }
            if (isCrawlRunInProgress(latest.status)) {
              setProjectSiteCrawlRunId(latest.runId);
              setSiteUrl(normalized);
              setAnalyzingLabel("Resuming project-site crawl…");
              await waitForCrawlComplete(latest.runId, normalized, ac.signal);
              return;
            }
          }
        }
      }

      setAnalyzingLabel("Starting project-site crawl…");
      const crawlRes = await fetch("/api/gcc-v2/project-site/crawl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteUrl: normalized }),
        signal: ac.signal,
      });
      const crawlBody = await crawlRes.json().catch(() => ({}));
      if (!crawlRes.ok) {
        throw new Error(
          typeof crawlBody.error === "string"
            ? crawlBody.error
            : `Crawl start failed (HTTP ${crawlRes.status})`,
        );
      }

      const runId = String(crawlBody.runId ?? crawlBody.RunId ?? "").trim();
      if (!runId) throw new Error("Crawl start returned no runId");

      setProjectSiteCrawlRunId(runId);
      setSiteUrl(normalized);
      setAnalyzingLabel("Crawling project site…");
      await waitForCrawlComplete(runId, normalized, ac.signal);
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        setStep("source");
        setAnalyzingLabel(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Project-site crawl failed");
      setStep("source");
      setAnalyzingLabel(null);
    } finally {
      setBusy(false);
    }
  }

  function buildBriefPayload() {
    const also = alsoDraftOptionsFor(primaryDraft)
      .map((o) => o.value)
      .filter((v) => alsoDrafts.has(v));
    const contentTypes = [primaryDraft, ...also];
    const operatorTools = parseOperatorTools(operatorToolsText);
    const selectedTemplates = templates.filter((template) =>
      selectedTemplateIds.includes(template.id),
    );
    return {
      contentTypes,
      brief: {
        briefVersion: BRIEF_VERSION,
        title: title.trim(),
        primaryDraft,
        contentTypes,
        primaryIntent,
        buyingStage,
        toneOfVoice,
        targetEntities,
        ragCapabilities: ragCapabilitiesFor(primaryDraft),
        modelPolicy,
        ...(selectedTemplates.length > 0
          ? {
              ragAdTemplates: selectedTemplates,
              ragAdTemplateIds: selectedTemplates.map((template) => template.id),
            }
          : {}),
        operatorTools,
        paaQuestions: paaQuestionsText,
        competitorUrls: competitorUrlsText,
        ...(writingNotes.trim() ? { writingNotes: writingNotes.trim() } : {}),
        selectedAgentIds,
        // Prefer early mobile crawl so preflight does not re-fetch (avoids cold-start fail + twin noise).
        ...(siteHierarchy ? { siteHierarchy } : {}),
      },
    };
  }

  async function ensureCreateId(): Promise<string> {
    const existing = pendingCreateId ?? toolsPreflight?.createId ?? null;
    if (existing) {
      if (!pendingCreateId) setPendingCreateId(existing);
      return existing;
    }
    if (ensureCreateIdInflight.current) return ensureCreateIdInflight.current;
    if (!projectSiteCrawlRunId || !section || !section.relatedPages.length) {
      throw new Error("Resolve a project site URL with crawled pages first.");
    }
    if (!title.trim()) throw new Error("Title is required");
    const work = (async () => {
      const createRes = await fetch("/api/gcc-v2/creates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          contentType: primaryDraft,
          siteUrl,
          siteSection: siteSectionForApi(section),
          ...(effectiveSelectedAgentIds.length > 0
            ? { selectedAgentIds: effectiveSelectedAgentIds }
            : {}),
          contextSelection: sanitizeContextSelection(contextSelection),
        }),
      });
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `create failed: HTTP ${createRes.status}`);
      }
      const create = (await createRes.json()) as { id: string };
      setPendingCreateId(create.id);
      setToolsPreflight((current) => (current ? { ...current, createId: create.id } : current));
      return create.id;
    })();
    ensureCreateIdInflight.current = work;
    try {
      return await work;
    } finally {
      if (ensureCreateIdInflight.current === work) ensureCreateIdInflight.current = null;
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (
      contextUploadProcessing
      || (contextSelection.runAttachmentIds.length > 0 && contextPreview == null)
      || (contextPreview?.blockingFindings.length ?? 0) > 0
    ) {
      setError(
        contextSelection.runAttachmentIds.length > 0 && contextPreview == null
          ? "Attachments are on this run. Check context (or remove them) before continuing."
          : "Resolve context blockers and wait for uploads before creating content.",
      );
      return;
    }
    if (!projectSiteCrawlRunId || !section || !section.relatedPages.length) {
      setError("Resolve a project site URL with crawled pages first.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (modelPolicy.preset !== "best-quality" && !modelPolicy.downgradeConfirmed) {
      setError("Confirm the model-policy quality tradeoff before continuing.");
      return;
    }
    if (!producerSelectionReady || !teamReady) {
      setError(usingBackendDefaultTeam
        ? "Could not prepare the default specialist team. Retry when the agent service recovers."
        : "Select and resolve exactly one specialist producer before continuing.");
      return;
    }

    setBusy(true);
    try {
      const createId = await ensureCreateId();
      const { brief } = buildBriefPayload();

      const preRes = await fetch(`/api/gcc-v2/creates/${createId}/partner-tools/preflight`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          projectSiteCrawlRunId,
          ...(effectiveSelectedAgentIds.length > 0
            ? { selectedAgentIds: effectiveSelectedAgentIds }
            : {}),
        }),
      });
      if (!preRes.ok) {
        const body = (await preRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `tool preflight failed: HTTP ${preRes.status}`);
      }
      const preflight = (await preRes.json()) as PartnerToolsPreflight;
      setPendingCreateId(createId);
      const hierarchyFromPre =
        normalizeSiteHierarchy(preflight.siteHierarchy) ?? siteHierarchy;
      if (hierarchyFromPre) setSiteHierarchy(hierarchyFromPre);
      setToolsPreflight({
        ...preflight,
        createId,
        siteHierarchy: hierarchyFromPre,
      });
      if (preflight.toolsFound && preflight.tools.length > 0) {
        setStep("review");
      } else {
        await confirmAndGenerate(createId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve partner tools");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndGenerate(createId = pendingCreateId) {
    if (!createId || !projectSiteCrawlRunId) {
      setError("Something went wrong while preparing your content. Return to Review and try again.");
      return;
    }
    if (ragStatusLoading || !ragStatus?.available) {
      setError(
        ragStatus?.reason ||
          "Research must be ready before this content can start.",
      );
      return;
    }
    if (!producerSelectionReady || !teamReady) {
      setError(usingBackendDefaultTeam
        ? "Could not prepare the default specialist team. Retry when the agent service recovers."
        : "Select and resolve exactly one specialist producer before continuing.");
      return;
    }
    if (contextUploadProcessing) {
      setError("Wait for uploads to finish before starting generation.");
      return;
    }
    if (contextSelection.runAttachmentIds.length > 0 && contextPreview == null) {
      setError("Attachments are selected. Check context (or remove them) before Confirm — skipping Check does not drop attachments.");
      return;
    }
    if ((contextPreview?.blockingFindings.length ?? 0) > 0) {
      setError("Resolve context blockers before starting generation.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { contentTypes, brief } = buildBriefPayload();
      const selection = sanitizeContextSelection(contextSelection);
      // Confirm always re-runs the same resolve Check uses so blockers cannot hide behind a skipped Check.
      const resolveRes = await fetch("/api/gcc-v2/context/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          createId,
          selection,
          selectedAgentIds: effectiveSelectedAgentIds,
          rawBriefJson: JSON.stringify(brief),
        }),
      });
      const resolveBody = await resolveRes.json().catch(() => null);
      if (!resolveRes.ok) {
        throw new Error(resolveBody?.error || `Context preflight failed (HTTP ${resolveRes.status}).`);
      }
      const livePreview = normalizeContextPreview(resolveBody);
      setContextPreview(livePreview);
      if (livePreview.blockingFindings.length > 0) {
        throw new Error(
          `Context resolution blocked generation. Blockers: ${humanizeContextBlocks(
            livePreview.blockingFindings.map((f) => f.message),
          ).join("; ")}`,
        );
      }
      const genRes = await fetch(`/api/gcc-v2/creates/${createId}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          projectSiteCrawlRunId,
          contentTypes,
          partnerToolsConfirmed: true,
          modelPolicy,
          ...(effectiveSelectedAgentIds.length > 0
            ? { selectedAgentIds: effectiveSelectedAgentIds }
            : {}),
          contextSelection: selection,
        }),
      });
      if (!genRes.ok) {
        const body = (await genRes.json().catch(() => null)) as {
          error?: string;
          preview?: { blockingFindings?: unknown; warnings?: unknown };
          Preview?: { BlockingFindings?: unknown; Warnings?: unknown };
        } | null;
        const blockingRaw =
          body?.preview?.blockingFindings
          ?? body?.Preview?.BlockingFindings
          ?? [];
        const warningRaw =
          body?.preview?.warnings
          ?? body?.Preview?.Warnings
          ?? [];
        // Gateway timeouts can drop a successful GeekAPI 202; recover if jobs already exist.
        if (genRes.status === 502 || genRes.status === 504) {
          const jobsRes = await fetch(`/api/gcc-v2/creates/${createId}/jobs`, { cache: "no-store" });
          const jobsBody = (await jobsRes.json().catch(() => null)) as
            | { id?: string; jobs?: Array<{ id?: string }> }
            | Array<{ id?: string }>
            | null;
          const jobs = Array.isArray(jobsBody)
            ? jobsBody
            : Array.isArray(jobsBody?.jobs)
              ? jobsBody.jobs
              : [];
          const recoveredJobId = jobs.map((job) => job.id).find((id): id is string => Boolean(id));
          if (recoveredJobId) {
            clearNewCreateDraft();
            router.push(`/creates/${createId}?jobId=${recoveredJobId}`);
            return;
          }
        }
        const blockerText = Array.isArray(blockingRaw) && blockingRaw.length
          ? ` Blockers: ${blockingRaw.map((b) => typeof b === "string" ? b : JSON.stringify(b)).join("; ")}`
          : "";
        throw new Error((body?.error || `generate failed: HTTP ${genRes.status}`) + blockerText);
      }
      const data = (await genRes.json()) as {
        jobId?: string;
        jobIds?: string[];
        partnerResearchWarnings?: string[];
      };
      const jobId = data.jobId ?? data.jobIds?.[0];
      if (!jobId) throw new Error("generate returned no jobId");
      if (data.partnerResearchWarnings && data.partnerResearchWarnings.length > 0) {
        sessionStorage.setItem(
          `gcc-v2-research-warnings:${createId}`,
          JSON.stringify(data.partnerResearchWarnings),
        );
      }
      clearNewCreateDraft();
      router.push(`/creates/${createId}?jobId=${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start job");
      setBusy(false);
    }
  }

  async function recheckTools() {
    if (!pendingCreateId || !projectSiteCrawlRunId) return;
    setError(null);
    setBusy(true);
    try {
      const { brief } = buildBriefPayload();
      const preRes = await fetch(`/api/gcc-v2/creates/${pendingCreateId}/partner-tools/preflight`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          projectSiteCrawlRunId,
          ...(effectiveSelectedAgentIds.length > 0
            ? { selectedAgentIds: effectiveSelectedAgentIds }
            : {}),
        }),
      });
      if (!preRes.ok) {
        const body = (await preRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `tool preflight failed: HTTP ${preRes.status}`);
      }
      const preflight = (await preRes.json()) as PartnerToolsPreflight;
      const hierarchyFromPre =
        normalizeSiteHierarchy(preflight.siteHierarchy) ?? siteHierarchy;
      if (hierarchyFromPre) setSiteHierarchy(hierarchyFromPre);
      setToolsPreflight({
        ...preflight,
        createId: pendingCreateId,
        siteHierarchy: hierarchyFromPre,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not re-check tools");
    } finally {
      setBusy(false);
    }
  }

  const currentStep = step === "analyzing" ? "source" : step;
  const currentIndex = WIZARD_STEPS.findIndex((item) => item.key === currentStep);
  const selectedContentTypes = [
    primaryDraft,
    ...alsoDraftOptionsFor(primaryDraft)
      .map((option) => option.value)
      .filter((value) => alsoDrafts.has(value)),
  ];
  const compatibleAgents = (agentCatalog?.agents ?? []).filter((agent) =>
    isCompatibleAgent(agent, primaryDraft),
  );
  const producerAgents = compatibleAgents.filter((agent) => agent.role === "producer");
  const optionalAgents = compatibleAgents.filter((agent) =>
    agent.role !== "producer" && ["marketing", "seo", "aeo"].includes(agent.specialty),
  );
  const selectedProducerCount = producerAgents.filter((agent) => selectedAgentIds.includes(agent.id)).length;
  // Phase 0: catalog failure must not block create — backend ResolveAsync(null) picks the default published team.
  const usingBackendDefaultTeam = Boolean(agentCatalogError) && !agentCatalog;
  const producerSelectionReady = selectedProducerCount === 1 || usingBackendDefaultTeam;
  const teamReady = Boolean(resolvedTeam) || usingBackendDefaultTeam;
  // Keep specialists that still apply to the primary; Also drafts omit non-applicable members at Generate.
  const effectiveSelectedAgentIds = usingBackendDefaultTeam
    ? []
    : selectedAgentIds.filter((id) => compatibleAgents.some((agent) => agent.id === id));
  const attachmentsAwaitingCheck =
    contextSelection.runAttachmentIds.length > 0 && (
      contextPreview == null
      || contextPreview.blockingFindings.some((finding) =>
        /run_attachment:.*:(processing|not_ready|not_finalized|failed)$/.test(finding.message))
    );
  const contextBlocked = (contextPreview?.blockingFindings.length ?? 0) > 0;
  const confirmContextBlocked =
    contextUploadProcessing || attachmentsAwaitingCheck || contextBlocked;
  const creationBlockers = [
    contextUploadProcessing ? "An attachment is still being processed." : null,
    attachmentsAwaitingCheck && contextPreview == null
      ? "Attachments are on this run. Wait until they are ready (or remove them) before Confirm — clearing Check does not ignore them."
      : null,
    ...humanizeContextBlocks(
      (contextPreview?.blockingFindings.map((finding) => finding.message) ?? [])
        .filter((message): message is string => Boolean(message)),
    ),
    resolvedSkillsLoading
      ? "The approved instruction bundle is still loading."
      : !resolvedSkills
        ? resolvedSkillsError || "The approved instruction bundle is unavailable."
        : null,
    usingBackendDefaultTeam
      ? null
      : resolvedTeamLoading
        ? "The selected agent team is still loading."
        : !resolvedTeam
          ? resolvedTeamError || "The selected agent team is unavailable."
          : null,
    ragStatusLoading
      ? "Research and generation availability is still being checked."
      : !ragStatus?.available
        ? ragStatus?.reason || "Research and generation are temporarily unavailable."
        : null,
  ].filter((message): message is string => Boolean(message));

  function addConcept(value = conceptInput) {
    const concept = value.trim();
    if (!concept) return;
    setTargetEntities((current) =>
      current.some((item) => item.toLowerCase() === concept.toLowerCase())
        ? current
        : [...current, concept],
    );
    setConceptInput("");
  }

  function handleConceptKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addConcept();
    }
  }

  function goNext(next: Exclude<Step, "analyzing">) {
    setError(null);
    if (step === "goal" && !title.trim()) {
      setError("Add a working title before continuing.");
      return;
    }
    setStep(next);
  }

  const guidedWorkflow = (
    <div className="overflow-hidden rounded-2xl border border-[var(--cc-line)] bg-white shadow-sm">
      <div className="border-b border-[var(--cc-line)] px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between text-xs font-medium text-[var(--cc-muted)]">
          <span>Step {Math.max(1, currentIndex + 1)} of {WIZARD_STEPS.length}</span>
          <span>{WIZARD_STEPS[Math.max(0, currentIndex)]?.label}</span>
        </div>
        <ol className="mt-3 grid grid-cols-6 gap-1" aria-label="Creation progress">
          {WIZARD_STEPS.map((item, index) => (
            <li key={item.key}>
              <div
                className={`h-1.5 rounded-full ${
                  index <= currentIndex ? "bg-[var(--cc-accent)]" : "bg-slate-200"
                }`}
              />
              <span className="mt-2 hidden text-[11px] text-[var(--cc-muted)] lg:block">
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="px-4 py-6 sm:px-8 sm:py-8">
        {(step === "source" || step === "analyzing") && (
          <section className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold text-[var(--cc-accent)]">Source</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">
              Where should we learn about your brand?
            </h2>
            <p className="mt-2 text-sm text-[var(--cc-muted)]">
              We use your website to understand your offering, voice, and internal links.
            </p>
            {savedProjectSitesError ? (
              <p role="status" aria-live="polite" className="mt-2 text-xs text-amber-800">
                {savedProjectSitesError} Enter a URL below to continue.
              </p>
            ) : null}
            {savedProjectSites.length ? (
              <div className={`${fieldClass} mt-6`}>
                <label className={labelClass} htmlFor="savedSite">Previously analyzed sites</label>
                <select
                  id="savedSite"
                  aria-label="Previously analyzed sites"
                  className={inputClass}
                  value={savedProjectSites.some((site) => site.siteUrl === siteUrlInput) ? siteUrlInput : ""}
                  onChange={(event) => {
                    setSiteUrlInput(event.target.value);
                    setForceRecrawl(false);
                  }}
                  disabled={busy || step === "analyzing"}
                >
                  <option value="">Enter another website below</option>
                  {savedProjectSites.map((site) => (
                    <option key={site.runId} value={site.siteUrl}>{site.siteUrl}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--cc-muted)]">Choose one to reuse its latest completed research without uploading it again.</p>
              </div>
            ) : null}
            <div className={`${fieldClass} ${savedProjectSites.length ? "mt-4" : "mt-6"}`}>
              <label className={labelClass} htmlFor="siteUrl">Project site URL</label>
              <input
                id="siteUrl"
                className={inputClass}
                value={siteUrlInput}
                onChange={(event) => setSiteUrlInput(event.target.value)}
                placeholder="example.com"
                disabled={busy || step === "analyzing"}
                required
              />
            </div>
            <details className="mt-4 rounded-lg border border-[var(--cc-line)] bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-[var(--cc-ink)]">
                Advanced source settings
              </summary>
              <label className="mt-3 flex items-center gap-2 text-sm text-[var(--cc-muted)]">
                <input
                  type="checkbox"
                  checked={forceRecrawl}
                  onChange={(event) => setForceRecrawl(event.target.checked)}
                  disabled={busy || step === "analyzing"}
                />
                Refresh the source instead of using the latest saved scan
              </label>
            </details>
            <div className={`${fieldClass} mt-6`}>
              <label className={labelClass} htmlFor="operatorTools">Partner tool URLs (required)</label>
              <p className="mb-1.5 text-xs text-[var(--cc-muted)]">
                The partner tools you implement and recommend. Format: <span className="font-medium">Name | https://… | perk</span> (one per line). The perk is optional — a discount code, extended trial or bonus your audience can use.
                <br />
                Partner evidence is what a draft is built from, so an indexed partner crawl run is always required.
              </p>
              <textarea
                id="operatorTools"
                className={`${inputClass} min-h-24`}
                value={operatorToolsText}
                onChange={(event) => setOperatorToolsText(event.target.value)}
                placeholder={"ApprovalMax | https://www.approvalmax.com | 20% off the first year with code GEEK20\nPlooto | https://www.plooto.com"}
              />
            </div>
            <div className={`${fieldClass} mt-5`}>
              <label className={labelClass} htmlFor="competitorUrls">Competitor page URLs (optional)</label>
              <p className="mb-1.5 text-xs text-[var(--cc-muted)]">
                Rival consultancies, or publishers competing for the same search results. One URL per line. Leave empty if the piece names none — competitors sharpen positioning but are never required to draft.
              </p>
              <textarea
                id="competitorUrls"
                className={`${inputClass} min-h-24`}
                value={competitorUrlsText}
                onChange={(event) => setCompetitorUrlsText(event.target.value)}
                placeholder={"https://rival-consultancy.example/services\nhttps://review-site.example/best-tools"}
              />
            </div>
            {step === "source" && siteUrlInput.trim() && !operatorToolsText.trim() ? (
              <p role="status" className="mt-4 text-xs text-amber-800">
                Add at least one partner tool URL to continue. A draft is built from partner evidence,
                so Create cannot proceed without one.
              </p>
            ) : null}
            {step === "analyzing" && analyzingLabel ? (
              <div className="mt-4"><LoadingRow label={analyzingLabel} /></div>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={busy || !siteUrlInput.trim() || !operatorToolsText.trim()}
                onClick={() => void resolveSite(forceRecrawl)}
                className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <ButtonBusyLabel busy={step === "analyzing" || busy} busyLabel="Learning from your site…" idleLabel="Continue" />
              </button>
              {step === "analyzing" ? (
                <button
                  type="button"
                  onClick={() => {
                    crawlAbortRef.current?.abort();
                    setStep("source");
                    setAnalyzingLabel(null);
                    setBusy(false);
                  }}
                  className="rounded-lg border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </section>
        )}

        {step === "goal" && section && (
          <section className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold text-[var(--cc-accent)]">Content goal</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">What do you want to create?</h2>
            <p className="mt-2 text-sm text-[var(--cc-muted)]">
              Choose the main format and give it a clear working title.
            </p>
            <div className="mt-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-900">
              Using {section.relatedPages.length} page{section.relatedPages.length === 1 ? "" : "s"} from{" "}
              <span className="font-semibold">{siteUrl}</span>
              <button
                type="button"
                onClick={() => {
                  setStep("source");
                }}
                className="ml-2 font-semibold underline"
              >
                Change site
              </button>
            </div>
            <div className={`${fieldClass} mt-6`}>
              <label className={labelClass} htmlFor="title">Working title</label>
              <input
                id="title"
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. A practical guide to reliable content operations"
                required
              />
            </div>
            <div className={`${fieldClass} mt-5`}>
              <label className={labelClass} htmlFor="primaryDraft">Main format</label>
              <select
                id="primaryDraft"
                className={selectClass}
                value={primaryDraft}
                onChange={(event) => {
                  setPrimaryDraft(event.target.value as PrimaryDraftType);
                  setAlsoDrafts(new Set());
                }}
              >
                {FORMAT_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.values.map((value) => {
                      const format = PRIMARY_DRAFT_TYPES.find((item) => item.value === value)!;
                      return <option key={format.value} value={format.value}>{format.label}</option>;
                    })}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-[var(--cc-muted)]">{primaryDraftHelperCopy(primaryDraft)}</p>
              <p className="text-xs text-[var(--cc-muted)]">
                {requiresCitationEvidenceGate(primaryDraft)
                  ? "Citeable VALIDATE: body sections need quote-verified citations (or ship-ready stays false)."
                  : "No long-form section citation-coverage gate for this format."}
              </p>
            </div>
            <div className="mt-7 flex justify-between">
              <button type="button" onClick={() => setStep("source")} className="text-sm font-semibold text-[var(--cc-muted)]">Back</button>
              <button type="button" onClick={() => goNext("audience")} className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white">Continue</button>
            </div>
          </section>
        )}

        {step === "audience" && (
          <section className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold text-[var(--cc-accent)]">Audience &amp; direction</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">Who is this for?</h2>
            <p className="mt-2 text-sm text-[var(--cc-muted)]">
              Add as much direction as you have. Optional fields can be left open.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="primaryIntent">Goal</label>
                <select id="primaryIntent" className={selectClass} value={primaryIntent} onChange={(event) => setPrimaryIntent(event.target.value as PrimaryIntent | "")}>
                  <option value="">Choose a goal…</option>
                  {PRIMARY_INTENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="buyingStage">Journey stage</label>
                <select id="buyingStage" className={selectClass} value={buyingStage} onChange={(event) => setBuyingStage(event.target.value as BuyingStage | "")}>
                  <option value="">Choose a stage…</option>
                  {BUYING_STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="toneOfVoice">Voice</label>
                <select id="toneOfVoice" className={selectClass} value={toneOfVoice} onChange={(event) => setToneOfVoice(event.target.value as ToneOfVoice | "")}>
                  <option value="">Choose a voice…</option>
                  {TONES_OF_VOICE.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>
            <div className={`${fieldClass} mt-6`}>
              <label className={labelClass} htmlFor="keyConcept">Key concepts to emphasize</label>
              <div className="flex gap-2">
                <input
                  id="keyConcept"
                  className={`${inputClass} min-w-0 flex-1`}
                  value={conceptInput}
                  onChange={(event) => setConceptInput(event.target.value)}
                  onKeyDown={handleConceptKeyDown}
                  placeholder="Type a concept and press Enter"
                />
                <button type="button" onClick={() => addConcept()} className="rounded-md border border-[var(--cc-line)] px-3 text-sm font-semibold">Add</button>
              </div>
              {targetEntities.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {targetEntities.map((concept) => (
                    <button
                      type="button"
                      key={concept}
                      onClick={() => setTargetEntities((current) => current.filter((item) => item !== concept))}
                      className="rounded-full bg-[var(--cc-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--cc-accent)]"
                      aria-label={`Remove ${concept}`}
                    >
                      {concept} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-7 flex justify-between">
              <button type="button" onClick={() => setStep("goal")} className="text-sm font-semibold text-[var(--cc-muted)]">Back</button>
              <button type="button" onClick={() => goNext("research")} className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white">Continue</button>
            </div>
          </section>
        )}

        {step === "research" && (
          <section className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold text-[var(--cc-accent)]">Research</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">Shape the research</h2>
            <p className="mt-2 text-sm text-[var(--cc-muted)]">
              Sharpen the brief with keywords and questions. Partner and competitor URLs were captured on the first step.
            </p>
            <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${ragStatus?.available ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900"}`} aria-label="Research readiness">
              <span className="font-semibold">
                {ragStatusLoading ? "Checking research availability…" : ragStatus?.available ? "Research library is ready" : "Research library is temporarily unavailable"}
              </span>
              {!ragStatusLoading && (ragStatusError || !ragStatus?.available) ? (
                <p className="mt-1 text-xs" aria-live="polite">{ragStatusError || ragStatus?.reason || "Try again in a moment."}</p>
              ) : null}
            </div>
            <div className={`${fieldClass} mt-6`}>
              <label className={labelClass} htmlFor="targetKeyword">Primary search phrase</label>
              <input id="targetKeyword" className={inputClass} value={targetKeyword} onChange={(event) => setTargetKeyword(event.target.value)} placeholder="e.g. reliable content workflow" />
            </div>
            <div className={`${fieldClass} mt-5`}>
              <label className={labelClass} htmlFor="paaQuestions">Questions to answer</label>
              <textarea id="paaQuestions" className={`${inputClass} min-h-24`} value={paaQuestionsText} onChange={(event) => setPaaQuestionsText(event.target.value)} placeholder={"One question per line\nHow does the workflow improve quality?"} />
            </div>
            <details className="mt-5 rounded-lg border border-[var(--cc-line)] bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-ink)]">Writing notes</summary>
              <div className={`${fieldClass} mt-4`}>
                <label className={labelClass} htmlFor="writingNotes">Notes carried into the brief</label>
                <textarea
                  id="writingNotes"
                  className={`${inputClass} min-h-20`}
                  value={writingNotes}
                  onChange={(event) => setWritingNotes(event.target.value)}
                  placeholder="Claims, angle, or notes carried from a task-agent result"
                />
              </div>
            </details>
            <details className="mt-3 rounded-lg border border-[var(--cc-line)] bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-ink)]">Technical source details</summary>
              <div className="mt-4">
                {hierarchyLoading ? <LoadingRow label="Inspecting source structure…" /> : <SiteHierarchyPanel hierarchy={siteHierarchy} />}
                {hierarchyError && !siteHierarchy ? <p className="mt-2 text-xs text-amber-800">{hierarchyError}</p> : null}
              </div>
            </details>
            <div className="mt-7 flex justify-between">
              <button type="button" onClick={() => setStep("audience")} className="text-sm font-semibold text-[var(--cc-muted)]">Back</button>
              <button type="button" onClick={() => goNext("outputs")} className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white">Continue</button>
            </div>
          </section>
        )}

        {step === "outputs" && (
          <section className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold text-[var(--cc-accent)]">Outputs</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">What else should we prepare?</h2>
            <p className="mt-2 text-sm text-[var(--cc-muted)]">
              Your main {PRIMARY_DRAFT_TYPES.find((item) => item.value === primaryDraft)?.label.toLowerCase()} is included. Add any companion formats.
            </p>
            <fieldset className="mt-6">
              <legend className={labelClass}>Additional full drafts</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {alsoDraftOptionsFor(primaryDraft).map((option) => (
                  <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${alsoDrafts.has(option.value) ? "border-[var(--cc-accent)] bg-[var(--cc-accent)]/5" : "border-[var(--cc-line)]"}`}>
                    <input
                      type="checkbox"
                      checked={alsoDrafts.has(option.value)}
                      onChange={() => setAlsoDrafts((current) => {
                        const next = new Set(current);
                        if (next.has(option.value)) next.delete(option.value);
                        else next.add(option.value);
                        return next;
                      })}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-6">
              <legend className={labelClass}>Specialist agent team</legend>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                Choose exactly one producer for the main format. Add Marketing, SEO, and AEO when they
                apply to that format — they stay on this create even if an Also draft does not use them.
                Those specialists run only on formats they cover.
              </p>
              {agentCatalogError ? (
                <p role="status" className="mt-2 text-xs text-amber-800">
                  Specialists unavailable ({agentCatalogError}). You can continue — the backend will
                  pin its default published team when this create starts.
                </p>
              ) : null}
              {!agentCatalog && !agentCatalogError ? <p className="mt-2 text-xs">Loading published specialists…</p> : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {producerAgents.map((agent) => (
                  <label key={agent.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${selectedAgentIds.includes(agent.id) ? "border-[var(--cc-accent)] bg-blue-50" : "border-[var(--cc-line)]"}`}>
                    <input
                      type="radio"
                      name="producer-agent"
                      aria-label={`${agent.name} producer`}
                      checked={selectedAgentIds.includes(agent.id)}
                      onChange={() => setSelectedAgentIds((current) => [
                        agent.id,
                        ...current.filter((id) => !producerAgents.some((producer) => producer.id === id)),
                      ])}
                    />
                    <span><strong>{agent.name}</strong><span className="block text-xs capitalize text-[var(--cc-muted)]">{agent.specialty} producer · {agent.version}</span></span>
                  </label>
                ))}
                {optionalAgents.map((agent) => {
                  const covered = formatsCoveredBy(agent, selectedContentTypes);
                  const skipped = formatsSkippedBy(agent, selectedContentTypes);
                  const coverage = skipped.length === 0
                    ? `Applies to all selected formats`
                    : `Applies to ${covered.map(labelForContentType).join(", ") || "none"} · skips ${skipped.map(labelForContentType).join(", ")}`;
                  return (
                  <label key={agent.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${selectedAgentIds.includes(agent.id) ? "border-[var(--cc-accent)] bg-blue-50" : "border-[var(--cc-line)]"}`}>
                    <input
                      type="checkbox"
                      aria-label={`${agent.name} ${agent.role}`}
                      checked={selectedAgentIds.includes(agent.id)}
                      onChange={() => setSelectedAgentIds((current) =>
                        current.includes(agent.id) ? current.filter((id) => id !== agent.id) : [...current, agent.id],
                      )}
                    />
                    <span>
                      <strong>{agent.name}</strong>
                      <span className="block text-xs capitalize text-[var(--cc-muted)]">{agent.specialty} {agent.role} · {agent.version}</span>
                      <span className="mt-1 block text-xs text-[var(--cc-muted)]">{coverage}</span>
                    </span>
                  </label>
                  );
                })}
              </div>
              {agentCatalog && producerAgents.length === 0 ? <p role="alert" className="mt-2 text-xs text-red-700">No compatible published producer is available for these outputs.</p> : null}
            </fieldset>
            {ragCapabilitiesFor(primaryDraft).includes("ad-templates") ? (
              <fieldset className="mt-6">
                <legend className={labelClass}>Optional campaign structures</legend>
                {templatesLoading ? (
                  <p className="mt-2 text-xs text-[var(--cc-muted)]">Loading templates…</p>
                ) : null}
                {templatesError ? (
                  <p role="status" aria-live="polite" className="mt-2 text-xs text-amber-800">
                    {templatesError}
                  </p>
                ) : null}
                {!templatesLoading && !templatesError && templates.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--cc-muted)]">None yet.</p>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {templates.map((template) => (
                    <label key={template.id} className="flex cursor-pointer gap-3 rounded-lg border border-[var(--cc-line)] p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.includes(template.id)}
                        onChange={() => setSelectedTemplateIds((current) => current.includes(template.id) ? current.filter((id) => id !== template.id) : [...current, template.id])}
                      />
                      <span><span className="block font-semibold">{template.name}</span><span className="text-xs text-[var(--cc-muted)]">{[template.channel, template.framework].filter(Boolean).join(" · ")}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <div className="mt-7 flex justify-between">
              <button type="button" onClick={() => setStep("research")} className="text-sm font-semibold text-[var(--cc-muted)]">Back</button>
              <button type="button" disabled={!producerSelectionReady} onClick={() => goNext("review")} className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Review</button>
            </div>
            {!producerSelectionReady ? (
              <p role="alert" className="mt-3 text-right text-xs text-amber-800">
                {producerAgents.length === 0
                  ? "No published content producer supports all selected formats."
                  : "Select exactly one content producer to continue."}
              </p>
            ) : null}
          </section>
        )}

        {step === "review" && (
          <section className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold text-[var(--cc-accent)]">Review</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--cc-ink)]">
              {toolsPreflight?.toolsFound ? "Confirm the partners we found" : "Ready to create"}
            </h2>
            {toolsPreflight?.toolsFound ? (
              <>
                <p className="mt-2 text-sm text-[var(--cc-muted)]">
                  These partners will be researched and included where they support your content.
                </p>
                <ul className="mt-5 divide-y divide-[var(--cc-line)] rounded-lg border border-[var(--cc-line)]">
                  {toolsPreflight.tools.map((tool) => (
                    <li key={`${tool.source}-${tool.name}-${tool.url ?? ""}`} className="p-3 text-sm">
                      <span className="font-semibold text-[var(--cc-ink)]">{tool.name}</span>
                      {tool.url ? <span className="ml-2 text-xs text-[var(--cc-muted)]">{tool.url}</span> : null}
                    </li>
                  ))}
                </ul>
                <details className="mt-4 rounded-lg border border-[var(--cc-line)] bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Edit partner destinations</summary>
                  <textarea className={`${inputClass} mt-3 min-h-20 w-full`} value={operatorToolsText} onChange={(event) => setOperatorToolsText(event.target.value)} />
                  <button type="button" disabled={busy} onClick={() => void recheckTools()} className="mt-3 rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-semibold">
                    <ButtonBusyLabel busy={busy} busyLabel="Checking…" idleLabel="Check again" />
                  </button>
                </details>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-[var(--cc-line)] bg-slate-50 p-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--cc-muted)]">Title</dt><dd className="mt-1 font-semibold">{title}</dd></div>
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--cc-muted)]">Main format</dt><dd className="mt-1 font-semibold">{PRIMARY_DRAFT_TYPES.find((item) => item.value === primaryDraft)?.label}</dd></div>
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--cc-muted)]">Source</dt><dd className="mt-1 text-sm">{siteUrl}</dd></div>
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--cc-muted)]">Quality</dt><dd className="mt-1 text-sm font-semibold">{modelPolicy.preset === "best-quality" ? "Best available" : "Custom"}</dd></div>
                  {targetEntities.length ? <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-[var(--cc-muted)]">Key concepts</dt><dd className="mt-1 text-sm">{targetEntities.join(", ")}</dd></div> : null}
                </dl>
              </div>
            )}

            <ContextSelector
              createId={pendingCreateId ?? toolsPreflight?.createId ?? null}
              ensureCreateId={ensureCreateId}
              rawBriefJson={JSON.stringify(buildBriefPayload().brief)}
              value={contextSelection}
              selectedAgentIds={selectedAgentIds}
              onChange={setContextSelection}
              onPreviewChange={setContextPreview}
              onProcessingChange={setContextUploadProcessing}
            />

            <details className="mt-5 rounded-lg border border-[var(--cc-line)] bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-ink)]">
                  Advanced run settings · Quality: {modelPolicy.preset === "best-quality" ? "Best available" : "Custom"}
                </summary>
                <fieldset className="mt-4 flex flex-col gap-3">
                  <legend className="sr-only">Quality routing</legend>
                  <label className="flex gap-2 text-sm">
                    <input type="radio" name="model-policy" checked={modelPolicy.preset === "best-quality"} onChange={() => setModelPolicy({ version: "content-model-policy.v1", preset: "best-quality" })} />
                    <span><strong>Best available (recommended)</strong><span className="block text-xs text-[var(--cc-muted)]">Use the strongest approved routing for each stage.</span></span>
                  </label>
                  <label className="flex gap-2 text-sm">
                    <input type="radio" name="model-policy" checked={modelPolicy.preset === "o3-only"} onChange={() => setModelPolicy({ version: "content-model-policy.v1", preset: "o3-only" })} />
                    <span><strong>Faster run</strong><span className="block text-xs text-[var(--cc-muted)]">May reduce strategic depth and whole-document synthesis.</span></span>
                  </label>
                  {ragStatus?.approvedStageModels && Object.keys(ragStatus.approvedStageModels).length > 0 ? (
                    <label className="flex gap-2 text-sm">
                      <input
                        type="radio"
                        name="model-policy"
                        checked={modelPolicy.preset === "custom"}
                        onChange={() => setModelPolicy({
                          version: "content-model-policy.v1",
                          preset: "custom",
                          stageModels: Object.fromEntries(Object.entries(ragStatus.approvedStageModels ?? {}).map(([stageName, models]) => [stageName, models[0] ?? ""])),
                        })}
                      />
                      <span><strong>Choose routing</strong><span className="block text-xs text-[var(--cc-muted)]">Select an approved model for each stage.</span></span>
                    </label>
                  ) : null}
                  {modelPolicy.preset === "custom" && ragStatus?.approvedStageModels ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(ragStatus.approvedStageModels).map(([stageName, models]) => (
                        <label key={stageName} className="flex flex-col gap-1 text-xs">
                          <span className="font-medium capitalize">{stageName}</span>
                          <select className={selectClass} value={modelPolicy.stageModels?.[stageName] ?? models[0] ?? ""} onChange={(event) => setModelPolicy((current) => ({ ...current, stageModels: { ...current.stageModels, [stageName]: event.target.value } }))}>
                            {models.map((model) => <option key={model} value={model}>{model}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {modelPolicy.preset !== "best-quality" ? (
                    <label className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modelPolicy.downgradeConfirmed === true}
                          onChange={(event) => setModelPolicy((current) => ({ ...current, downgradeConfirmed: event.target.checked, downgradeReason: current.downgradeReason ?? "operator" }))}
                        />
                        I understand the quality tradeoff.
                      </span>
                    </label>
                  ) : null}
                </fieldset>
            </details>

            <section className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950" aria-label="Resolved specialist team">
              <strong>Immutable specialist team</strong>
              <p className="mt-1 text-xs">
                Pinned against the main format. Generate keeps the applicable subset on each Also draft
                (specialists that do not cover a format are omitted there only).
              </p>
              {usingBackendDefaultTeam ? (
                <p role="status" className="mt-2 text-xs text-amber-900">
                  Specialist catalog is temporarily unavailable. Create will pin the backend&apos;s default published team.
                </p>
              ) : null}
              {resolvedTeamLoading ? <p className="mt-2 text-xs">Resolving team…</p> : null}
              {resolvedTeamError ? <p role="alert" className="mt-2 text-xs text-red-800">{resolvedTeamError}</p> : null}
              {resolvedTeam ? (
                <div className="mt-3 rounded-md bg-white/70 p-3">
                  <p className="font-mono text-xs">Team {shortDigest(resolvedTeam.snapshotDigest)} · catalog {resolvedTeam.catalogVersion}</p>
                  <ol className="mt-2 space-y-2 text-xs">
                    {resolvedTeam.agents.map((agent) => {
                      const catalogAgent = agentCatalog?.agents.find(
                        (row) => row.id === agent.id || row.versionId === agent.versionId,
                      );
                      const skipped = catalogAgent
                        ? formatsSkippedBy(catalogAgent, selectedContentTypes)
                        : [];
                      return (
                      <li key={agent.versionId || agent.id}>
                        <strong>{agent.name} {agent.version}</strong> · <span className="capitalize">{agent.specialty}</span> · <span className="font-mono">{shortDigest(agent.digest)}</span>
                        <span className="block">
                          Responsibilities: {agent.participation.length
                            ? [...agent.participation].sort((a, b) => a.order - b.order).map((row) => `${row.stage}: ${row.role}`).join(", ")
                            : `${agent.supportedStages.join(", ")}: ${agent.role}`}
                        </span>
                        <span className="block">Pinned skills: {agent.pinnedSkills.map((skill) => `${skill.name || skill.id} ${skill.version} (${shortDigest(skill.digest)})`).join(", ") || "none"}</span>
                        {skipped.length > 0 ? (
                          <span className="block text-[var(--cc-muted)]">
                            Omitted from Also drafts: {skipped.map(labelForContentType).join(", ")}
                          </span>
                        ) : null}
                      </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}
            </section>

            <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950" aria-label="Immutable resolved skill bundle">
              <strong>Approved skills are selected automatically.</strong>{" "}
              This preview is resolved by the backend. Job creation persists a signed, immutable
              snapshot so retries use the same reviewed instructions and resources. Operators cannot
              install or inject runtime skills.{" "}
              <Link href="/skills" className="font-semibold underline">See governed catalog</Link>
              {resolvedSkillsLoading ? <p className="mt-2 text-xs">Resolving immutable bundle…</p> : null}
              {resolvedSkillsError ? <p role="alert" className="mt-2 text-xs text-red-800">Bundle unavailable: {resolvedSkillsError}</p> : null}
              {resolvedSkills ? (
                <div className="mt-3 rounded-md bg-white/70 p-3">
                  <p className="font-mono text-xs">
                    Snapshot {shortDigest(resolvedSkills.snapshotDigest)} · catalog {resolvedSkills.catalogVersion}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {resolvedSkills.skills.map((skill) => (
                      <li key={skill.versionId ?? `${skill.id}-${skill.version}`}>
                        <strong>{skill.name} {skill.version}</strong> ·{" "}
                        <span className="font-mono">{shortDigest(skill.packageDigest)}</span> ·{" "}
                        {skill.supportedStages.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => { setToolsPreflight(null); setStep("outputs"); }} className="text-sm font-semibold text-[var(--cc-muted)]">Back</button>
              {toolsPreflight?.toolsFound ? (
                <button
                  type="button"
                  disabled={busy || confirmContextBlocked || resolvedSkillsLoading || !resolvedSkills || (!usingBackendDefaultTeam && (resolvedTeamLoading || !resolvedTeam)) || ragStatusLoading || !ragStatus?.available}
                  onClick={() => void confirmAndGenerate()}
                  className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <ButtonBusyLabel busy={busy} busyLabel="Starting…" idleLabel="Confirm partners & create" />
                </button>
              ) : (
                <form onSubmit={onSubmit}>
                  <button
                    type="submit"
                    disabled={busy || confirmContextBlocked || resolvedSkillsLoading || !resolvedSkills || (!usingBackendDefaultTeam && (resolvedTeamLoading || !resolvedTeam)) || ragStatusLoading || !ragStatus?.available}
                    className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <ButtonBusyLabel busy={busy} busyLabel="Preparing your workspace…" idleLabel="Create content" />
                  </button>
                </form>
              )}
            </div>
            {creationBlockers.length ? (
              <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Creation is waiting on:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {creationBlockers.map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        )}

        {error ? <p role="alert" className="mx-auto mt-5 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );

  function discardRestoredDraft() {
    clearNewCreateDraft();
    setRestoredDraftNotice(false);
    setStep("source");
    setSiteUrlInput("");
    setSiteUrl("");
    setForceRecrawl(false);
    setProjectSiteCrawlRunId(null);
    setSection(null);
    setTitle(initialTopic);
    setPrimaryDraft(initialContentType);
    setAlsoDrafts(new Set());
    setTargetKeyword("");
    setOperatorToolsText(initialTools);
    setPaaQuestionsText("");
    setCompetitorUrlsText(initialCompetitors);
    setWritingNotes(initialNotes);
    setPrimaryIntent("");
    setBuyingStage("");
    setToneOfVoice("");
    setTargetEntities([]);
    setSelectedTemplateIds([]);
    setModelPolicy({ version: "content-model-policy.v1", preset: "best-quality" });
    setContextSelection(EMPTY_CONTEXT_SELECTION);
    setContextPreview(null);
    setPendingCreateId(null);
    setToolsPreflight(null);
    setSiteHierarchy(null);
    setSelectedAgentIds([]);
    setError(null);
  }

  return (
    <>
      {restoredDraftNotice ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950"
        >
          <p>Restored your Create draft after Geek IQ. Everything you entered is still here.</p>
          <button
            type="button"
            onClick={discardRestoredDraft}
            className="font-semibold underline"
          >
            Start over
          </button>
        </div>
      ) : null}
      {guidedWorkflow}
    </>
  );
}

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
import { fetchRagStatus } from "@/app/rag/rag-generate-client";
import { DEFAULT_AD_TEMPLATES, loadAdTemplates } from "@/app/rag/ad-templates";
import type { RagAdTemplate } from "@/app/rag/types";
import {
  ragCapabilitiesFor,
  type ModelPolicySelection,
  type RagReadiness,
} from "../rag-contract";
import { shortDigest, type ResolvedSkillSnapshot } from "@/app/skills/skill-contract";
import {
  isCompatibleAgent,
  normalizeAgentCatalog,
  normalizeResolvedAgentTeam,
  type AgentCatalog,
  type ResolvedAgentTeam,
} from "@/app/agents/agent-contract";

const selectClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const inputClass = selectClass;
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";

const CRAWL_WAIT_MS = 15 * 60 * 1000;
/** Persist in-progress new-create wizard so a hard refresh resumes instead of wiping state. */
const NEW_CREATE_DRAFT_KEY = "gcc-v2-new-create-draft";

type Step =
  | "source"
  | "analyzing"
  | "goal"
  | "audience"
  | "research"
  | "outputs"
  | "review"
  // Kept only while the previous renderer remains as an unreachable migration fallback.
  | "url"
  | "brief"
  | "tools";

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
    values: ["email", "social", "ads", "linkedin-document", "image-prompt"],
  },
] as const;

type NewCreateDraft = {
  siteUrlInput: string;
  siteUrl: string;
  step: Step;
  projectSiteCrawlRunId: string | null;
  title: string;
  primaryDraft: PrimaryDraftType;
  alsoDrafts: ContentType[];
  targetKeyword: string;
  operatorToolsText: string;
  paaQuestionsText: string;
  competitorUrlsText: string;
  primaryIntent: PrimaryIntent | "";
  buyingStage: BuyingStage | "";
  toneOfVoice: ToneOfVoice | "";
  targetEntities: string[];
  selectedTemplateIds: string[];
  modelPolicy: ModelPolicySelection;
  selectedAgentIds: string[];
  pendingCreateId: string | null;
};

function readNewCreateDraft(): NewCreateDraft | null {
  try {
    const raw = sessionStorage.getItem(NEW_CREATE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NewCreateDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    const rawStep = parsed.step as string | undefined;
    const step: Step =
      rawStep === "analyzing" ||
      rawStep === "source" ||
      rawStep === "goal" ||
      rawStep === "audience" ||
      rawStep === "research" ||
      rawStep === "outputs" ||
      rawStep === "review"
        ? rawStep
        : rawStep === "brief"
          ? "goal"
          : rawStep === "tools"
            ? "review"
            : "source";
    return {
      siteUrlInput: typeof parsed.siteUrlInput === "string" ? parsed.siteUrlInput : "",
      siteUrl: typeof parsed.siteUrl === "string" ? parsed.siteUrl : "",
      step,
      projectSiteCrawlRunId:
        typeof parsed.projectSiteCrawlRunId === "string" ? parsed.projectSiteCrawlRunId : null,
      title: typeof parsed.title === "string" ? parsed.title : "",
      primaryDraft:
        typeof parsed.primaryDraft === "string" &&
        PRIMARY_DRAFT_TYPES.some((t) => t.value === parsed.primaryDraft)
          ? (parsed.primaryDraft as PrimaryDraftType)
          : "pillar",
      alsoDrafts: Array.isArray(parsed.alsoDrafts)
        ? parsed.alsoDrafts.filter((v): v is ContentType => typeof v === "string")
        : [],
      targetKeyword: typeof parsed.targetKeyword === "string" ? parsed.targetKeyword : "",
      operatorToolsText: typeof parsed.operatorToolsText === "string" ? parsed.operatorToolsText : "",
      paaQuestionsText: typeof parsed.paaQuestionsText === "string" ? parsed.paaQuestionsText : "",
      competitorUrlsText:
        typeof parsed.competitorUrlsText === "string" ? parsed.competitorUrlsText : "",
      primaryIntent: (parsed.primaryIntent as PrimaryIntent | "") || "",
      buyingStage: (parsed.buyingStage as BuyingStage | "") || "",
      toneOfVoice: (parsed.toneOfVoice as ToneOfVoice | "") || "",
      targetEntities: Array.isArray(parsed.targetEntities)
        ? parsed.targetEntities.filter((value): value is string => typeof value === "string")
        : [],
      selectedTemplateIds: Array.isArray(parsed.selectedTemplateIds)
        ? parsed.selectedTemplateIds.filter((value): value is string => typeof value === "string")
        : [],
      modelPolicy:
        parsed.modelPolicy?.preset === "o3-only" || parsed.modelPolicy?.preset === "custom"
          ? parsed.modelPolicy
          : { version: "content-model-policy.v1", preset: "best-quality" },
      selectedAgentIds: Array.isArray(parsed.selectedAgentIds)
        ? parsed.selectedAgentIds.filter((value): value is string => typeof value === "string")
        : [],
      pendingCreateId: typeof parsed.pendingCreateId === "string" ? parsed.pendingCreateId : null,
    };
  } catch {
    return null;
  }
}

function writeNewCreateDraft(draft: NewCreateDraft): void {
  try {
    sessionStorage.setItem(NEW_CREATE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* private mode / quota */
  }
}

function clearNewCreateDraft(): void {
  try {
    sessionStorage.removeItem(NEW_CREATE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

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

function parseOperatorTools(text: string): Array<{ name?: string; url: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf("|");
      if (pipe >= 0) {
        const name = line.slice(0, pipe).trim();
        const url = line.slice(pipe + 1).trim();
        if (!url) return null;
        return name ? { name, url } : { url };
      }
      return { url: line };
    })
    .filter((row): row is { name?: string; url: string } => row !== null);
}

function primaryDraftHelperCopy(primary: PrimaryDraftType): string {
  switch (primary) {
    case "tool":
      return "Long-form tool pages: one keyword overview plus a full page per partner tool from supplied URLs. Optionally add pillar/blog under Also draft for a use-case article to ground the overview.";
    case "comparison":
      return "Side-by-side evaluation — outline gets one section per option (from partner tools and competitor URLs). Missing external crawls warn and skip; generate continues.";
    case "alternatives":
      return "Narrative alternatives page (one section per partner tool). Does not auto-spawn partner tool jobs — use Tool page under Also draft for full partner pages.";
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
      return "Blog-style long-form. Check another long-form under Also draft to write both. Re-Purpose remixes ready drafts into channel packs.";
    case "ads":
    case "social":
    case "email":
      return "Short-form drafting with verified evidence, optional approved templates, and variations available in your workspace.";
    case "linkedin-document":
      return "Slide-oriented drafting with connected strategy themes; your workspace preserves PDF and caption workflows.";
    case "image-prompt":
      return "A specialized visual brief grounded in the same brand, topic, and source evidence as prose jobs.";
    default:
      return "Long-form WRITE path (default Pillar). Check other long-form types under Also draft to write both. Re-Purpose on Canvas remixes any ready draft tab into channel packs — not image prompts.";
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
};

export function NewCreateForm({
  initialTopic = "",
  initialContentType = "pillar",
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
  const [operatorToolsText, setOperatorToolsText] = useState("");
  const [paaQuestionsText, setPaaQuestionsText] = useState("");
  const [competitorUrlsText, setCompetitorUrlsText] = useState("");
  const [primaryIntent, setPrimaryIntent] = useState<PrimaryIntent | "">("");
  const [buyingStage, setBuyingStage] = useState<BuyingStage | "">("");
  const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice | "">("");
  const [ragStatus, setRagStatus] = useState<RagReadiness | null>(null);
  const [ragStatusLoading, setRagStatusLoading] = useState(true);
  const [targetEntities, setTargetEntities] = useState<string[]>([]);
  const [conceptInput, setConceptInput] = useState("");
  const [templates, setTemplates] = useState<RagAdTemplate[]>(DEFAULT_AD_TEMPLATES);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [modelPolicy, setModelPolicy] = useState<ModelPolicySelection>({
    version: "content-model-policy.v1",
    preset: "best-quality",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCreateId, setPendingCreateId] = useState<string | null>(null);
  const [toolsPreflight, setToolsPreflight] = useState<PartnerToolsPreflight | null>(null);
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
  const restoredRef = useRef(false);

  useEffect(() => {
    return () => {
      crawlAbortRef.current?.abort();
      void hubRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setTemplates(loadAdTemplates());
    });
    void fetchRagStatus()
      .then((status) => {
        if (!cancelled) setRagStatus(status);
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
        if (!controller.signal.aborted) setAgentCatalogError(cause instanceof Error ? cause.message : "Could not load specialists");
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
    if (step !== "review" || !agentCatalog) return;
    const contentTypes = [
      primaryDraft,
      ...alsoDraftOptionsFor(primaryDraft)
        .map((option) => option.value)
        .filter((value) => alsoDrafts.has(value)),
    ];
    const compatible = agentCatalog.agents.filter((agent) => isCompatibleAgent(agent, contentTypes));
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
  }, [agentCatalog, alsoDrafts, primaryDraft, selectedAgentIds, step]);

  useEffect(() => {
    // Wait until session draft hydrate finishes — otherwise the empty initial state clears a saved draft.
    if (!restoredRef.current) return;
    if (step === "source" && !siteUrlInput.trim() && !projectSiteCrawlRunId) {
      clearNewCreateDraft();
      return;
    }
    writeNewCreateDraft({
      siteUrlInput,
      siteUrl,
      step,
      projectSiteCrawlRunId,
      title,
      primaryDraft,
      alsoDrafts: [...alsoDrafts],
      targetKeyword,
      operatorToolsText,
      paaQuestionsText,
      competitorUrlsText,
      primaryIntent,
      buyingStage,
      toneOfVoice,
      targetEntities,
      selectedTemplateIds,
      modelPolicy,
      selectedAgentIds,
      pendingCreateId,
    });
  }, [
    step,
    siteUrlInput,
    siteUrl,
    projectSiteCrawlRunId,
    title,
    primaryDraft,
    alsoDrafts,
    targetKeyword,
    operatorToolsText,
    paaQuestionsText,
    competitorUrlsText,
    primaryIntent,
    buyingStage,
    toneOfVoice,
    targetEntities,
    selectedTemplateIds,
    modelPolicy,
    selectedAgentIds,
    pendingCreateId,
  ]);

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
        const offReconnect = onProjectSiteHubReconnected(connection, () => runId);

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

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = readNewCreateDraft();
    if (!draft) return;

    const resolvedUrl = draft.siteUrl || normalizeSiteUrl(draft.siteUrlInput) || "";
    const resumeStep = draft.step;
    const runId = draft.projectSiteCrawlRunId;
    const ac = new AbortController();
    crawlAbortRef.current = ac;

    void (async () => {
      // Session storage is an external browser system. Restore after hydration, then resume any
      // external crawl work without forcing a synchronous cascade from the Effect body.
      await Promise.resolve();
      if (ac.signal.aborted) return;
      setSiteUrlInput(draft.siteUrlInput);
      setSiteUrl(draft.siteUrl);
      setTitle(draft.title);
      setPrimaryDraft(draft.primaryDraft);
      setAlsoDrafts(new Set(draft.alsoDrafts));
      setTargetKeyword(draft.targetKeyword);
      setOperatorToolsText(draft.operatorToolsText);
      setPaaQuestionsText(draft.paaQuestionsText);
      setCompetitorUrlsText(draft.competitorUrlsText);
      setPrimaryIntent(draft.primaryIntent);
      setBuyingStage(draft.buyingStage);
      setToneOfVoice(draft.toneOfVoice);
      setTargetEntities(draft.targetEntities);
      setSelectedTemplateIds(draft.selectedTemplateIds);
      setModelPolicy(draft.modelPolicy);
      setSelectedAgentIds(draft.selectedAgentIds);
      setPendingCreateId(draft.pendingCreateId);

      if (!runId || !resolvedUrl) {
        setStep("source");
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const snapRes = await fetch(`/api/gcc-v2/project-site/runs/${encodeURIComponent(runId)}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const snap = (await snapRes.json().catch(() => ({}))) as {
          status?: string;
          errorSummary?: string | null;
        };

        if (!snapRes.ok) {
          setStep("source");
          setProjectSiteCrawlRunId(null);
          setAnalyzingLabel(null);
          return;
        }

        if (isCrawlRunReady(snap.status)) {
          await applyReadyCrawl(runId, resolvedUrl);
          if (
            resumeStep === "audience" ||
            resumeStep === "research" ||
            resumeStep === "outputs" ||
            (resumeStep === "review" && !draft.pendingCreateId)
          ) {
            setStep(resumeStep);
          }
          if (resumeStep === "review" && draft.pendingCreateId) {
            setAnalyzingLabel("Restoring partner tools…");
            const also = alsoDraftOptionsFor(draft.primaryDraft)
              .map((o) => o.value)
              .filter((v) => draft.alsoDrafts.includes(v));
            const brief = {
              briefVersion: BRIEF_VERSION,
              title: draft.title.trim(),
              primaryDraft: draft.primaryDraft,
              contentTypes: [draft.primaryDraft, ...also],
              primaryIntent: draft.primaryIntent,
              buyingStage: draft.buyingStage,
              toneOfVoice: draft.toneOfVoice,
              targetEntities: draft.targetEntities,
              modelPolicy: draft.modelPolicy,
              operatorTools: parseOperatorTools(draft.operatorToolsText),
              paaQuestions: draft.paaQuestionsText,
              competitorUrls: draft.competitorUrlsText,
              selectedAgentIds: draft.selectedAgentIds,
            };
            const preRes = await fetch(
              `/api/gcc-v2/creates/${draft.pendingCreateId}/partner-tools/preflight`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  targetKeyword: draft.targetKeyword.trim() || undefined,
                  brief,
                  projectSiteCrawlRunId: runId,
                }),
                signal: ac.signal,
              },
            );
            if (preRes.ok) {
              const preflight = (await preRes.json()) as PartnerToolsPreflight;
              const hierarchyFromPre = normalizeSiteHierarchy(preflight.siteHierarchy);
              if (hierarchyFromPre) setSiteHierarchy(hierarchyFromPre);
              setToolsPreflight({
                ...preflight,
                createId: draft.pendingCreateId,
                siteHierarchy: hierarchyFromPre,
              });
              setStep("review");
            }
            setAnalyzingLabel(null);
          }
          return;
        }

        if (isCrawlRunInProgress(snap.status)) {
          setProjectSiteCrawlRunId(runId);
          setSiteUrl(resolvedUrl);
          setStep("analyzing");
          setAnalyzingLabel("Resuming project-site crawl…");
          await waitForCrawlComplete(runId, resolvedUrl, ac.signal);
          return;
        }

        setStep("source");
        setProjectSiteCrawlRunId(null);
        setAnalyzingLabel(null);
        if (snap.errorSummary) setError(snap.errorSummary);
      } catch (err) {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Could not resume create draft");
        setStep("source");
        setAnalyzingLabel(null);
      } finally {
        setBusy(false);
      }
    })();
  }, [applyReadyCrawl, waitForCrawlComplete]);

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
        selectedAgentIds,
        // Prefer early mobile crawl so preflight does not re-fetch (avoids cold-start fail + twin noise).
        ...(siteHierarchy ? { siteHierarchy } : {}),
      },
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

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
    if (selectedProducerCount !== 1 || !resolvedTeam) {
      setError("Select and resolve exactly one specialist producer before continuing.");
      return;
    }

    setBusy(true);
    try {
      const createRes = await fetch("/api/gcc-v2/creates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          contentType: primaryDraft,
          siteUrl,
          siteSection: siteSectionForApi(section),
          selectedAgentIds,
        }),
      });
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `create failed: HTTP ${createRes.status}`);
      }
      const create = (await createRes.json()) as { id: string };
      const { brief } = buildBriefPayload();

      const preRes = await fetch(`/api/gcc-v2/creates/${create.id}/partner-tools/preflight`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          projectSiteCrawlRunId,
          selectedAgentIds,
        }),
      });
      if (!preRes.ok) {
        const body = (await preRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `tool preflight failed: HTTP ${preRes.status}`);
      }
      const preflight = (await preRes.json()) as PartnerToolsPreflight;
      setPendingCreateId(create.id);
      const hierarchyFromPre =
        normalizeSiteHierarchy(preflight.siteHierarchy) ?? siteHierarchy;
      if (hierarchyFromPre) setSiteHierarchy(hierarchyFromPre);
      setToolsPreflight({
        ...preflight,
        createId: create.id,
        siteHierarchy: hierarchyFromPre,
      });
      if (preflight.toolsFound && preflight.tools.length > 0) {
        setStep("review");
      } else {
        await confirmAndGenerate(create.id);
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
    if (ragStatusLoading || !ragStatus?.available || ragStatus.citeableGenerateAvailable === false) {
      setError(
        ragStatus?.reason ||
          "Research must be ready before this content can start.",
      );
      return;
    }
    if (selectedProducerCount !== 1 || !resolvedTeam) {
      setError("Select and resolve exactly one specialist producer before continuing.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { contentTypes, brief } = buildBriefPayload();
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
          selectedAgentIds,
        }),
      });
      if (!genRes.ok) {
        const body = (await genRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `generate failed: HTTP ${genRes.status}`);
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
          selectedAgentIds,
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
    isCompatibleAgent(agent, selectedContentTypes),
  );
  const producerAgents = compatibleAgents.filter((agent) => agent.role === "producer");
  const optionalAgents = compatibleAgents.filter((agent) =>
    agent.role !== "producer" && ["marketing", "seo", "aeo"].includes(agent.specialty),
  );
  const selectedProducerCount = producerAgents.filter((agent) => selectedAgentIds.includes(agent.id)).length;

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
            <div className={`${fieldClass} mt-6`}>
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
            {step === "analyzing" && analyzingLabel ? (
              <div className="mt-4"><LoadingRow label={analyzingLabel} /></div>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={busy || !siteUrlInput.trim()}
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
                  setSection(null);
                  setProjectSiteCrawlRunId(null);
                }}
                className="ml-2 font-semibold underline"
              >
                Change
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
              We will verify source material and citations automatically. Add optional focus below.
            </p>
            <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${ragStatus?.available && ragStatus.citeableGenerateAvailable !== false ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900"}`} aria-label="Research readiness">
              <span className="font-semibold">
                {ragStatusLoading ? "Checking research availability…" : ragStatus?.available && ragStatus.citeableGenerateAvailable !== false ? "Research is ready" : "Research is temporarily unavailable"}
              </span>
              {!ragStatusLoading && (!ragStatus?.available || ragStatus.citeableGenerateAvailable === false) ? (
                <p className="mt-1 text-xs">{ragStatus?.reason || "Try again in a moment."}</p>
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
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-ink)]">Additional research sources</summary>
              <div className={`${fieldClass} mt-4`}>
                <label className={labelClass} htmlFor="competitorUrls">Reference page URLs</label>
                <textarea id="competitorUrls" className={`${inputClass} min-h-20`} value={competitorUrlsText} onChange={(event) => setCompetitorUrlsText(event.target.value)} placeholder="One URL per line" />
              </div>
              <div className={`${fieldClass} mt-4`}>
                <label className={labelClass} htmlFor="operatorTools">Partner destination URLs</label>
                <textarea id="operatorTools" className={`${inputClass} min-h-20`} value={operatorToolsText} onChange={(event) => setOperatorToolsText(event.target.value)} placeholder="Name | https://example.com" />
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
                Choose exactly one producer. Add any compatible Marketing, SEO, and AEO contributors or reviewers.
              </p>
              {agentCatalogError ? <p role="alert" className="mt-2 text-xs text-red-700">Specialists unavailable: {agentCatalogError}</p> : null}
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
                {optionalAgents.map((agent) => (
                  <label key={agent.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${selectedAgentIds.includes(agent.id) ? "border-[var(--cc-accent)] bg-blue-50" : "border-[var(--cc-line)]"}`}>
                    <input
                      type="checkbox"
                      aria-label={`${agent.name} ${agent.role}`}
                      checked={selectedAgentIds.includes(agent.id)}
                      onChange={() => setSelectedAgentIds((current) =>
                        current.includes(agent.id) ? current.filter((id) => id !== agent.id) : [...current, agent.id],
                      )}
                    />
                    <span><strong>{agent.name}</strong><span className="block text-xs capitalize text-[var(--cc-muted)]">{agent.specialty} {agent.role} · {agent.version}</span></span>
                  </label>
                ))}
              </div>
              {agentCatalog && producerAgents.length === 0 ? <p role="alert" className="mt-2 text-xs text-red-700">No compatible published producer is available for these outputs.</p> : null}
            </fieldset>
            {ragCapabilitiesFor(primaryDraft).includes("ad-templates") ? (
              <fieldset className="mt-6">
                <legend className={labelClass}>Optional campaign structures</legend>
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
              <button type="button" disabled={selectedProducerCount !== 1} onClick={() => goNext("review")} className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Review</button>
            </div>
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
              <p className="mt-1 text-xs">The backend resolves stable catalog IDs to immutable versions and pinned skills before execution IDs are created.</p>
              {resolvedTeamLoading ? <p className="mt-2 text-xs">Resolving team…</p> : null}
              {resolvedTeamError ? <p role="alert" className="mt-2 text-xs text-red-800">{resolvedTeamError}</p> : null}
              {resolvedTeam ? (
                <div className="mt-3 rounded-md bg-white/70 p-3">
                  <p className="font-mono text-xs">Team {shortDigest(resolvedTeam.snapshotDigest)} · catalog {resolvedTeam.catalogVersion}</p>
                  <ol className="mt-2 space-y-2 text-xs">
                    {resolvedTeam.agents.map((agent) => (
                      <li key={agent.versionId || agent.id}>
                        <strong>{agent.name} {agent.version}</strong> · <span className="capitalize">{agent.specialty}</span> · <span className="font-mono">{shortDigest(agent.digest)}</span>
                        <span className="block">
                          Responsibilities: {agent.participation.length
                            ? [...agent.participation].sort((a, b) => a.order - b.order).map((row) => `${row.stage}: ${row.role}`).join(", ")
                            : `${agent.supportedStages.join(", ")}: ${agent.role}`}
                        </span>
                        <span className="block">Pinned skills: {agent.pinnedSkills.map((skill) => `${skill.name || skill.id} ${skill.version} (${shortDigest(skill.digest)})`).join(", ") || "none"}</span>
                      </li>
                    ))}
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
              <button type="button" onClick={() => { setToolsPreflight(null); setPendingCreateId(null); setStep("outputs"); }} className="text-sm font-semibold text-[var(--cc-muted)]">Back</button>
              {toolsPreflight?.toolsFound ? (
                <button
                  type="button"
                  disabled={busy || resolvedSkillsLoading || !resolvedSkills || resolvedTeamLoading || !resolvedTeam || ragStatusLoading || !ragStatus?.available || ragStatus.citeableGenerateAvailable === false}
                  onClick={() => void confirmAndGenerate()}
                  className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <ButtonBusyLabel busy={busy} busyLabel="Starting…" idleLabel="Confirm partners & create" />
                </button>
              ) : (
                <form onSubmit={onSubmit}>
                  <button
                    type="submit"
                    disabled={busy || resolvedSkillsLoading || !resolvedSkills || resolvedTeamLoading || !resolvedTeam || ragStatusLoading || !ragStatus?.available || ragStatus.citeableGenerateAvailable === false}
                    className="rounded-lg bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <ButtonBusyLabel busy={busy} busyLabel="Preparing your workspace…" idleLabel="Create content" />
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {error ? <p role="alert" className="mx-auto mt-5 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );

  // Keep the prior renderer available as a short-lived deployment rollback path.
  const guidedWorkflowEnabled =
    process.env.NEXT_PUBLIC_GUIDED_CREATE_WORKFLOW !== "false";
  if (guidedWorkflowEnabled) {
    return guidedWorkflow;
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2 text-xs text-[var(--cc-muted)]">
        {(
          [
            ["url", "1. Site URL"],
            ["brief", "2. Brief"],
            ["tools", "3. Confirm tools"],
          ] as const
        ).map(([key, label]) => (
          <li
            key={key}
            className={`rounded-full px-2.5 py-1 ${
              step === key || (step === "analyzing" && key === "url")
                ? "bg-[var(--cc-accent)]/15 font-semibold text-[var(--cc-accent)]"
                : "bg-black/5"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {(step === "url" || step === "analyzing") && (
        <div className="flex flex-col gap-4">
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="siteUrl">
              Project site URL
            </label>
            <input
              id="siteUrl"
              className={inputClass}
              value={siteUrlInput}
              onChange={(e) => setSiteUrlInput(e.target.value)}
              placeholder="https://example.com or example.com"
              disabled={busy || step === "analyzing"}
              required
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Required. We crawl this domain and use its pages for BrandKit and internal links —
              then you fill the brief.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--cc-ink)]">
            <input
              type="checkbox"
              checked={forceRecrawl}
              onChange={(e) => setForceRecrawl(e.target.checked)}
              disabled={busy || step === "analyzing"}
            />
            Force new crawl (ignore existing complete run)
          </label>

          {step === "analyzing" && analyzingLabel ? (
            <LoadingRow label={analyzingLabel} />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !siteUrlInput.trim()}
              onClick={() => void resolveSite(forceRecrawl)}
              className="w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ButtonBusyLabel
                busy={step === "analyzing" || busy}
                busyLabel="Working…"
                idleLabel="Continue"
              />
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
                className="rounded-md border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold text-[var(--cc-ink)]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      )}

      {step === "brief" && section && (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="rounded-md border border-[var(--cc-line)] bg-black/[0.02] px-3 py-2 text-sm">
            <p className="text-[var(--cc-ink)]">
              Writing for: <span className="font-medium">{siteUrl}</span>
            </p>
            <p className="mt-1 text-xs text-[var(--cc-muted)]">
              {section.relatedPages.length} page
              {section.relatedPages.length === 1 ? "" : "s"} from this crawl for links and grounding
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("source");
                setSection(null);
                setProjectSiteCrawlRunId(null);
                setSiteHierarchy(null);
                setHierarchyError(null);
                setToolsPreflight(null);
              }}
              className="mt-2 text-xs font-semibold text-[var(--cc-accent)] underline"
            >
              Change URL
            </button>
          </div>

          {hierarchyLoading ? (
            <LoadingRow label="Loading mobile site hierarchy…" />
          ) : (
            <SiteHierarchyPanel hierarchy={siteHierarchy} />
          )}
          {hierarchyError && !siteHierarchy ? (
            <p className="text-xs text-amber-800">{hierarchyError}</p>
          ) : null}

          <section
            className={`rounded-lg border p-4 ${
              ragStatus?.available && ragStatus.citeableGenerateAvailable !== false
                ? "border-green-200 bg-green-50/60"
                : "border-amber-200 bg-amber-50"
            }`}
            aria-label="Research and evidence readiness"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--cc-ink)]">
                Research &amp; evidence
              </h2>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">
                {ragStatusLoading
                  ? "Checking…"
                  : ragStatus?.available && ragStatus.citeableGenerateAvailable !== false
                    ? "Ready"
                    : "Blocked"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--cc-muted)]">
              The persisted job uses hybrid RAG evidence through PLAN, WRITE, and validation. Citation
              verification and quality gates remain enabled for every model policy.
            </p>
            {!ragStatusLoading &&
            (!ragStatus?.available || ragStatus.citeableGenerateAvailable === false) ? (
              <p className="mt-2 text-xs font-medium text-amber-900">
                {ragStatus?.reason || "Citeable RAG is not ready. Generation may be rejected by the backend."}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {ragCapabilitiesFor(primaryDraft).map((capability) => (
                <span key={capability} className="rounded-full bg-white px-2 py-1 text-[var(--cc-ink)]">
                  {RAG_CAPABILITY_LABELS[capability]}
                </span>
              ))}
              <span className="rounded-full bg-white px-2 py-1 text-[var(--cc-ink)]">
                {ragStatus?.graphRetrievalAvailable ? "GraphRAG ready" : "Hybrid retrieval"}
              </span>
            </div>
          </section>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best CRMs for small teams"
              required
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="primaryDraft">
              Primary draft
            </label>
            <select
              id="primaryDraft"
              className={selectClass}
              value={primaryDraft}
              onChange={(e) => {
                const next = e.target.value as PrimaryDraftType;
                setPrimaryDraft(next);
                setAlsoDrafts(new Set());
              }}
            >
              {PRIMARY_DRAFT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--cc-muted)]">
              {primaryDraftHelperCopy(primaryDraft)}
            </p>
          </div>

          {(ragStatus?.entitySeeds?.length ?? 0) > 0 ? (
            <fieldset className={fieldClass}>
              <legend className={labelClass}>Target entities</legend>
              <div className="flex flex-wrap gap-2">
                {ragStatus!.entitySeeds!.map((entity) => (
                  <label
                    key={entity}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--cc-line)] bg-white px-3 py-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={targetEntities.includes(entity)}
                      onChange={() =>
                        setTargetEntities((current) =>
                          current.includes(entity)
                            ? current.filter((value) => value !== entity)
                            : [...current, entity],
                        )
                      }
                    />
                    {entity}
                  </label>
                ))}
              </div>
              <p className="text-xs text-[var(--cc-muted)]">
                Entity seeds focus retrieval; they do not replace the full brief or source evidence.
              </p>
            </fieldset>
          ) : null}

          {ragCapabilitiesFor(primaryDraft).includes("ad-templates") ? (
            <fieldset className={fieldClass}>
              <legend className={labelClass}>Short-form evidence templates</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((template) => (
                  <label
                    key={template.id}
                    className="flex cursor-pointer gap-2 rounded-md border border-[var(--cc-line)] bg-white p-3 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTemplateIds.includes(template.id)}
                      onChange={() =>
                        setSelectedTemplateIds((current) =>
                          current.includes(template.id)
                            ? current.filter((value) => value !== template.id)
                            : [...current, template.id],
                        )
                      }
                    />
                    <span>
                      <span className="block font-semibold text-[var(--cc-ink)]">{template.name}</span>
                      <span className="text-[var(--cc-muted)]">
                        {[template.channel, template.framework].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <details className="rounded-lg border border-[var(--cc-line)] bg-black/[0.02] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-ink)]">
              Advanced model policy — {modelPolicy.preset === "best-quality"
                ? "Best quality"
                : modelPolicy.preset === "o3-only"
                  ? "o3 only"
                  : "Custom"}
            </summary>
            <fieldset className="mt-3 flex flex-col gap-3">
              <legend className="sr-only">Model policy</legend>
              <label className="flex gap-2 text-sm">
                <input
                  type="radio"
                  name="model-policy"
                  value="best-quality"
                  checked={modelPolicy.preset === "best-quality"}
                  onChange={() =>
                    setModelPolicy({ version: "content-model-policy.v1", preset: "best-quality" })
                  }
                />
                <span>
                  <strong>Best quality (recommended)</strong>
                  <span className="block text-xs text-[var(--cc-muted)]">
                    o1-pro for deep strategy and synthesis; o3 for evidence work and drafting.
                  </span>
                </span>
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="radio"
                  name="model-policy"
                  value="o3-only"
                  checked={modelPolicy.preset === "o3-only"}
                  onChange={() =>
                    setModelPolicy({ version: "content-model-policy.v1", preset: "o3-only" })
                  }
                />
                <span>
                  <strong>o3 only</strong>
                  <span className="block text-xs text-[var(--cc-muted)]">
                    Lower latency/cost, but may reduce strategic depth and whole-document synthesis.
                  </span>
                </span>
              </label>
              {ragStatus?.approvedStageModels &&
              Object.keys(ragStatus.approvedStageModels).length > 0 ? (
                <label className="flex gap-2 text-sm">
                  <input
                    type="radio"
                    name="model-policy"
                    value="custom"
                    checked={modelPolicy.preset === "custom"}
                    onChange={() =>
                      setModelPolicy({
                        version: "content-model-policy.v1",
                        preset: "custom",
                        stageModels: Object.fromEntries(
                          Object.entries(ragStatus.approvedStageModels ?? {}).map(
                            ([policyStage, models]) => [policyStage, models[0] ?? ""],
                          ),
                        ),
                      })
                    }
                  />
                  <span>
                    <strong>Custom approved models</strong>
                    <span className="block text-xs text-[var(--cc-muted)]">
                      Choose only models the backend policy approves for each stage.
                    </span>
                  </span>
                </label>
              ) : null}

              {modelPolicy.preset === "custom" && ragStatus?.approvedStageModels ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(ragStatus.approvedStageModels).map(([policyStage, models]) => (
                    <label key={policyStage} className="flex flex-col gap-1 text-xs">
                      <span className="font-medium uppercase text-[var(--cc-muted)]">{policyStage}</span>
                      <select
                        aria-label={`${policyStage} model`}
                        className={selectClass}
                        value={modelPolicy.stageModels?.[policyStage] ?? models[0] ?? ""}
                        onChange={(event) =>
                          setModelPolicy((current) => ({
                            ...current,
                            stageModels: {
                              ...current.stageModels,
                              [policyStage]: event.target.value,
                            },
                          }))
                        }
                      >
                        {models.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : null}

              {modelPolicy.preset !== "best-quality" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Confirm model downgrade</p>
                  <p className="mt-1">
                    Evidence, citation verification, and validation standards stay unchanged. Only the
                    requested model policy changes.
                  </p>
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={modelPolicy.downgradeConfirmed === true}
                      onChange={(event) =>
                        setModelPolicy((current) => ({
                          ...current,
                          downgradeConfirmed: event.target.checked,
                          downgradeReason: current.downgradeReason ?? "operator",
                        }))
                      }
                    />
                    I understand and accept the quality tradeoff.
                  </label>
                  <select
                    aria-label="Model downgrade reason"
                    className={`${selectClass} mt-2`}
                    value={modelPolicy.downgradeReason ?? "operator"}
                    onChange={(event) =>
                      setModelPolicy((current) => ({
                        ...current,
                        downgradeReason: event.target.value as ModelPolicySelection["downgradeReason"],
                      }))
                    }
                  >
                    <option value="operator">Operator choice</option>
                    <option value="availability">Availability</option>
                    <option value="quota">Quota</option>
                    <option value="latency">Latency</option>
                    <option value="cost">Cost</option>
                  </select>
                </div>
              ) : null}
            </fieldset>
          </details>

          <fieldset className={fieldClass}>
            <legend className={labelClass}>Also draft</legend>
            <div className="flex flex-wrap gap-3 pt-1">
              {alsoDraftOptionsFor(primaryDraft).map((o) => {
                const checked = alsoDrafts.has(o.value);
                return (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 text-sm text-[var(--cc-ink)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setAlsoDrafts((prev) => {
                          const next = new Set(prev);
                          if (next.has(o.value)) next.delete(o.value);
                          else next.add(o.value);
                          return next;
                        });
                      }}
                    />
                    {o.label}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-[var(--cc-muted)]">
              Each checked type gets its own WRITE job. Image prompts auto-queue when that job
              finishes (§3.1 — pillar/blog get hero + per H2; tool/email/social/ads get one each) —
              not listed here.
            </p>
          </fieldset>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="targetKeyword">
              Target keyword
            </label>
            <input
              id="targetKeyword"
              className={inputClass}
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g. best crm for small teams"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="operatorTools">
              Partner tool URLs
            </label>
            <textarea
              id="operatorTools"
              className={`${inputClass} min-h-[88px] font-mono text-xs`}
              value={operatorToolsText}
              onChange={(e) => setOperatorToolsText(e.target.value)}
              placeholder={
                "Optional — Name | URL (excerpt destinations only)\nBotPenguin | https://botpenguin.com/\nManyChat | https://manychat.com/"
              }
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Optional. Destination pages for weave excerpts — not the tool list. Tools come from
              the site hierarchy for this use case. Prefer Name | URL.
            </p>
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="paaQuestions">
              People Also Ask
            </label>
            <textarea
              id="paaQuestions"
              className={`${inputClass} min-h-[88px] font-mono text-xs`}
              value={paaQuestionsText}
              onChange={(e) => setPaaQuestionsText(e.target.value)}
              placeholder={"Optional — one question per line\nWhat is the best CRM for small teams?\nHow much does CRM software cost?"}
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Operator-curated PAA questions become the FAQ section (People Also Ask) in pillar/blog
              outlines. Never auto-filled from SERP uploads.
            </p>
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="competitorUrls">
              Competitor page URLs
            </label>
            <textarea
              id="competitorUrls"
              className={`${inputClass} min-h-[72px] font-mono text-xs`}
              value={competitorUrlsText}
              onChange={(e) => setCompetitorUrlsText(e.target.value)}
              placeholder={"Optional — one absolute URL per line\nhttps://competitor.com/alternative-guide"}
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Optional rival pages for polite crawl — differentiation notes only. Never used as inline
              CTAs or outline must-mentions.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="primaryIntent">
                Intent
              </label>
              <select
                id="primaryIntent"
                className={selectClass}
                value={primaryIntent}
                onChange={(e) => setPrimaryIntent(e.target.value as PrimaryIntent | "")}
              >
                <option value="">Select…</option>
                {PRIMARY_INTENTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="buyingStage">
                Buying stage
              </label>
              <select
                id="buyingStage"
                className={selectClass}
                value={buyingStage}
                onChange={(e) => setBuyingStage(e.target.value as BuyingStage | "")}
              >
                <option value="">Select…</option>
                {BUYING_STAGES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="toneOfVoice">
                Tone of voice
              </label>
              <select
                id="toneOfVoice"
                className={selectClass}
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value as ToneOfVoice | "")}
              >
                <option value="">Select…</option>
                {TONES_OF_VOICE.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <ButtonBusyLabel busy={busy} busyLabel="Finding tools…" idleLabel="Find partner tools" />
          </button>
        </form>
      )}

      {step === "tools" && toolsPreflight && (
        <div className="flex flex-col gap-4">
          <SiteHierarchyPanel hierarchy={toolsPreflight.siteHierarchy ?? siteHierarchy} />

          <div className={fieldClass}>
            <h2 className="text-base font-semibold text-[var(--cc-ink)]">Confirm partner tools</h2>
            <p className="text-sm text-[var(--cc-muted)]">
              {toolsPreflight.message ??
                (toolsPreflight.toolsFound
                  ? `Found ${toolsPreflight.toolCount} partner tool(s). Each gets a full tool page from its supplied URL, plus a keyword overview page linking to them on-site.`
                  : "No partner tools found.")}
            </p>
            {toolsPreflight.externalResearchNote ? (
              <p className="rounded-md border border-[var(--cc-line)] bg-[var(--cc-surface)] px-3 py-2 text-xs text-[var(--cc-muted)]">
                <span className="font-medium text-[var(--cc-ink)]">External research — </span>
                {toolsPreflight.externalResearchNote}
              </p>
            ) : null}
            {toolsPreflight.partnerResearchWarnings && toolsPreflight.partnerResearchWarnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-medium">Some partner research was skipped</p>
                <ul className="mt-1 list-disc pl-4">
                  {toolsPreflight.partnerResearchWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-[var(--cc-muted)]">
              Destination URLs (Name | URL) are fetched for excerpts when weaving tool text into a
              paragraph.
            </p>
            {toolsPreflight.matchedHeading ? (
              <p className="text-xs text-[var(--cc-muted)]">
                Matched site heading:{" "}
                <span className="font-medium text-[var(--cc-ink)]">{toolsPreflight.matchedHeading}</span>
                {toolsPreflight.matchTopic ? ` (via “${toolsPreflight.matchTopic}”)` : null}
                {toolsPreflight.path && toolsPreflight.path.length > 0 ? (
                  <>
                    <br />
                    Path:{" "}
                    <span className="font-medium text-[var(--cc-ink)]">
                      {toolsPreflight.path.join(" › ")}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          {toolsPreflight.tools.length > 0 ? (
            <ul className="flex flex-col gap-2 rounded-md border border-[var(--cc-line)] bg-white p-3 text-sm">
              {toolsPreflight.tools.map((t) => (
                <li key={`${t.source}-${t.name}-${t.url ?? ""}`} className="flex flex-col gap-0.5">
                  <span className="font-medium text-[var(--cc-ink)]">{t.name}</span>
                  <span className="text-xs text-[var(--cc-muted)]">
                    {t.source === "crawl" ? "From site crawl" : "Pasted"}
                    {t.url ? (
                      <>
                        {" · "}
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--cc-accent)] underline-offset-2 hover:underline"
                        >
                          {t.url}
                        </a>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No crawl or pasted partner tools resolved. You can add URLs on the brief step and re-check,
              or continue without partner tools (drafts may invent fewer product links).
            </p>
          )}

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="operatorToolsRecheck">
              Partner tool URLs (edit &amp; re-check)
            </label>
            <textarea
              id="operatorToolsRecheck"
              className={`${inputClass} min-h-[88px] font-mono text-xs`}
              value={operatorToolsText}
              onChange={(e) => setOperatorToolsText(e.target.value)}
              placeholder={
                "Optional — Name | URL for excerpts\nBotPenguin | https://botpenguin.com/"
              }
              disabled={busy}
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Attaches excerpt destinations to crawl tools. Does not add new tools.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void recheckTools()}
              className="rounded-md border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--cc-ink)] disabled:opacity-60"
            >
              <ButtonBusyLabel busy={busy} busyLabel="Checking…" idleLabel="Re-check tools" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("goal");
                setError(null);
              }}
              className="rounded-md border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--cc-ink)] disabled:opacity-60"
            >
              Back to brief
            </button>
            <button
              type="button"
              disabled={
                busy ||
                ragStatusLoading ||
                !ragStatus?.available ||
                ragStatus.citeableGenerateAvailable === false
              }
              onClick={() => void confirmAndGenerate()}
              className="rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ButtonBusyLabel
                busy={busy}
                busyLabel="Starting…"
                idleLabel={
                  toolsPreflight.toolsFound
                    ? "Confirm tools & generate"
                    : "Continue without partner tools"
                }
              />
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

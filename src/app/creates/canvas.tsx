"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type GccV2JobEvent } from "@/app/auth/job-hub";
import type {
  AiVisibilitySnapshotView,
  BrandKitReadyView,
  CanvasSection,
  OutlineSectionView,
  OutlineView,
  AgentExecution,
  SectionEventPayload,
  SectionNode,
  ValidationReportView,
} from "@/app/creates/canvas-types";
import { SECTION_EVENT_TYPES } from "@/app/creates/canvas-types";
import {
  canRemoveSection,
  insertAdvanceSection,
  isProblemLocked,
  isRoleLocked,
  OUTLINE_ROLE_OPTIONS,
  removeSectionAt,
  supportsAdvanceOutlineRows,
} from "@/app/creates/outline-editor";
import { listOutstandingBlockers } from "@/app/creates/validation-blockers";
import {
  ButtonBusyLabel,
  isJobProcessing,
  LoadingRow,
  ProcessBanner,
} from "@/app/components/loading-indicator";
import {
  canRepurposeContentType,
  REPURPOSE_CHANNELS,
} from "@/app/creates/repurpose-channels";
import { isCmsPublishType, isLongFormContentType, labelForContentType } from "@/app/creates/content-types";
import { useCreateJobHub } from "@/app/creates/create-job-hub-provider";
import { SectionCitations } from "@/app/creates/rag-citations";
import { WorkspaceSection, canvasSectionsToPlain, type CanvasAction } from "@/app/creates/workspace-section";
import { WorkspaceTabs, type WorkspaceTab } from "@/app/creates/workspace-tabs";
import {
  modelPolicyLabel,
  type AgentHandoffProvenance,
  type AgentTeamProvenance,
  type ApprovedStageModels,
  type ModelPolicySelection,
  type RagCitation,
  type RagProvenance,
  type ResearchEvidenceManifest,
} from "@/app/creates/rag-contract";

type LogEntry = { seq: number; type: string; payload: unknown; atUtc: string };

type CanvasProps = {
  createId: string;
  jobId: string;
};

type PublishResult = {
  status: string;
  slug?: string | null;
  publicUrl?: string | null;
  externalPostId?: number | null;
  isPublished?: boolean;
  warning?: string | null;
  error?: string | null;
};

/** `CmsPublished` job-event payload (see `GccV2CmsPublishService`). */
type CmsPublishedPayload = {
  status: string;
  slug?: string | null;
  publicUrl?: string | null;
  externalPostId?: number | null;
  isPublished?: boolean;
};

const SECTION_EVENT_TYPE_SET: ReadonlySet<string> = new Set(SECTION_EVENT_TYPES);

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function upsertAgentExecution(
  current: AgentExecution[],
  execution: AgentExecution,
): AgentExecution[] {
  const index = current.findIndex((item) => item.attemptId === execution.attemptId);
  if (index < 0) return [...current, execution];
  const next = [...current];
  next[index] = execution;
  return next;
}

async function callCanvasAction(
  createId: string,
  jobId: string,
  action: CanvasAction,
  body: { sectionKey: string; text?: string; instruction?: string },
): Promise<void> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/canvas/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, jobId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${action} failed: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
}

async function fetchAiVisibility(createId: string): Promise<AiVisibilitySnapshotView> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/ai-visibility`);
  if (!res.ok) {
    throw new Error(`AI visibility fetch failed: HTTP ${res.status}`);
  }
  return (await res.json()) as AiVisibilitySnapshotView;
}

async function refreshAiVisibility(createId: string): Promise<AiVisibilitySnapshotView> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/ai-visibility/refresh`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return {
      ready: false,
      createId,
      message: data?.error ?? `Refresh failed: HTTP ${res.status}`,
    };
  }
  const data = (await res.json().catch(() => null)) as AiVisibilitySnapshotView | null;
  return data ?? { ready: false, createId, message: "Empty refresh response" };
}

async function callPublish(
  createId: string,
  jobId: string,
  isPublished: boolean,
): Promise<PublishResult> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId, isPublished }),
  });
  const data = (await res.json().catch(() => null)) as PublishResult | null;
  if (!res.ok) {
    return {
      status: data?.status ?? "failed",
      error: data?.error ?? `Publish failed: HTTP ${res.status}`,
    };
  }
  return data ?? { status: "failed", error: "Empty publish response" };
}

type ExportSummary = {
  exportedCount: number;
  totalJobs: number;
  skipped: { jobId: string; contentType: string; reason: string }[];
};

type LinkedInCarouselArtifact = {
  slug: string;
  generatedAtUtc?: string;
  pdfBase64?: string;
  caption: string;
  hashtags?: string[];
  suggestedFilename: string;
  slides: Array<{
    index: number;
    role: string;
    title: string;
    subtitle?: string | null;
    bullets?: string[];
  }>;
};

type ParsedJobResult = {
  sourceAttributionHtml: string | null;
  citations: RagCitation[];
  sectionCitations: Record<string, RagCitation[]>;
  provenance: RagProvenance | null;
  evidenceManifest: ResearchEvidenceManifest | null;
  modelPolicy: ModelPolicySelection | null;
  approvedStageModels: ApprovedStageModels;
  linkedInCarousel: LinkedInCarouselArtifact | null;
  agentExecutions: AgentExecution[];
  agentTeam: AgentTeamProvenance | null;
  handoffs: AgentHandoffProvenance[];
};

function parseJobResult(resultJson: string | null | undefined): ParsedJobResult {
  const empty: ParsedJobResult = {
    sourceAttributionHtml: null,
    citations: [],
    sectionCitations: {},
    provenance: null,
    evidenceManifest: null,
    modelPolicy: null,
    approvedStageModels: {},
    linkedInCarousel: null,
    agentExecutions: [],
    agentTeam: null,
    handoffs: [],
  };
  if (!resultJson?.trim()) return empty;
  try {
    const parsed = JSON.parse(resultJson) as {
      sourceAttributionHtml?: string | null;
      toolPageKind?: string | null;
      citations?: RagCitation[] | null;
      sectionCitations?: Record<string, RagCitation[]> | null;
      provenance?: RagProvenance | null;
      evidenceManifest?: ResearchEvidenceManifest | null;
      modelPolicy?: ModelPolicySelection | null;
      approvedStageModels?: ApprovedStageModels | null;
      linkedInCarousel?: LinkedInCarouselArtifact | null;
      agentExecutions?: AgentExecution[] | null;
      agentTeam?: AgentTeamProvenance | null;
      handoffs?: AgentHandoffProvenance[] | null;
    };
    const html = parsed.sourceAttributionHtml?.trim();
    return {
      sourceAttributionHtml:
        parsed.toolPageKind?.toLowerCase() === "partner" && html ? html : null,
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      sectionCitations: parsed.sectionCitations ?? {},
      provenance: parsed.provenance ?? null,
      evidenceManifest: parsed.evidenceManifest ?? null,
      modelPolicy: parsed.modelPolicy ?? null,
      approvedStageModels: parsed.approvedStageModels ?? {},
      linkedInCarousel: parsed.linkedInCarousel ?? null,
      agentExecutions: Array.isArray(parsed.agentExecutions) ? parsed.agentExecutions : [],
      agentTeam: parsed.agentTeam ?? parsed.provenance?.agentTeam ?? null,
      handoffs: Array.isArray(parsed.handoffs)
        ? parsed.handoffs
        : Array.isArray(parsed.provenance?.handoffs)
          ? parsed.provenance.handoffs
          : [],
    };
  } catch {
    return empty;
  }
}

type ExportCommitResult = {
  commitSha?: string;
  commitUrl?: string;
  filePaths?: string[];
  exportSummary?: ExportSummary;
  error?: string;
};

function parseExportSummary(header: string | null): ExportSummary | null {
  if (!header) return null;
  try {
    return JSON.parse(header) as ExportSummary;
  } catch {
    return null;
  }
}

async function downloadHtmlExport(createId: string): Promise<ExportSummary | null> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/export/html`);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Export failed: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
  const summary = parseExportSummary(res.headers.get("X-GccV2-Export-Summary"));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${createId}-html-export.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
  return summary;
}

async function commitHtmlExport(createId: string): Promise<ExportCommitResult> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/export/html/commit`, { method: "POST" });
  const data = (await res.json().catch(() => null)) as ExportCommitResult | { title?: string; detail?: string } | null;
  if (!res.ok) {
    const message =
      (data && "detail" in data && typeof data.detail === "string" ? data.detail : null)
      ?? (data && "error" in data && typeof data.error === "string" ? data.error : null)
      ?? `Commit failed: HTTP ${res.status}`;
    return { error: message };
  }
  return (data as ExportCommitResult) ?? { error: "Empty commit response" };
}

type FixReadinessResult = {
  shipReady?: boolean;
  outstandingIssues?: boolean;
  seoScore?: number;
  geoScore?: number;
  polishScore?: number;
  polishShipReady?: boolean;
  guardrailRestructureCount?: number;
  guardrailRestructurePhrases?: string[];
  seoChecks?: ValidationReportView["seoChecks"];
  geoChecks?: ValidationReportView["geoChecks"];
  overlapHits?: ValidationReportView["overlapHits"];
  error?: string;
};

async function callFixReadiness(createId: string, jobId: string): Promise<FixReadinessResult> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/validate/fix-readiness`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  const data = (await res.json().catch(() => null)) as FixReadinessResult | { detail?: string; error?: string } | null;
  if (!res.ok) {
    const message =
      (data && "detail" in data && typeof data.detail === "string" ? data.detail : null)
      ?? (data && "error" in data && typeof data.error === "string" ? data.error : null)
      ?? `Fix readiness failed: HTTP ${res.status}`;
    return { error: message };
  }
  return (data as FixReadinessResult) ?? { error: "Empty fix-readiness response" };
}

/**
 * Phase 5 Canvas: streamed WRITE/REPAIR sections in the main column (no polling — everything comes
 * from `SectionDrafted`/`SectionRepaired`/... hub events), SEO/polish scores + named OverlapGate
 * hits in the right rail from `ValidationReport`, outline approval, and per-section
 * rewrite/expand/re-tone actions against the sync Canvas API.
 */
export function Canvas({ createId, jobId }: CanvasProps) {
  const { subscribeJobEvents, joinActiveJob, hubError, jobs } = useCreateJobHub();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("canvas");
  const [status, setStatus] = useState<string>("pending");
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [awaitingBrandkit, setAwaitingBrandkit] = useState(false);
  const [awaitingOutlineApproval, setAwaitingOutlineApproval] = useState(false);
  const [brandKit, setBrandKit] = useState<BrandKitReadyView | null>(null);
  const [kitCompanyName, setKitCompanyName] = useState("");
  const [kitDescription, setKitDescription] = useState("");
  const [kitPositioning, setKitPositioning] = useState("");
  const [kitTagline, setKitTagline] = useState("");
  const [kitNotice, setKitNotice] = useState<string | null>(null);
  const [outline, setOutline] = useState<OutlineView | null>(null);
  const [editableSections, setEditableSections] = useState<OutlineSectionView[]>([]);
  const [sections, setSections] = useState<Map<string, CanvasSection>>(new Map());
  const [report, setReport] = useState<ValidationReportView | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [copyAllDone, setCopyAllDone] = useState(false);
  const [pendingSectionKey, setPendingSectionKey] = useState<string | null>(null);
  const [pendingInstruction, setPendingInstruction] = useState<Record<string, string>>({});
  const [transformBusy, setTransformBusy] = useState(false);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [transformVariants, setTransformVariants] = useState<
    Array<{ channel: string; title: string; body: string; headline?: string | null }>
  >([]);
  const [carouselBusy, setCarouselBusy] = useState(false);
  const [carouselError, setCarouselError] = useState<string | null>(null);
  const [carouselResult, setCarouselResult] = useState<{
    slug: string;
    slideCount: number;
    caption: string;
    pdfBase64?: string;
    suggestedFilename: string;
    generatedAtUtc?: string;
  } | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [publishBusy, setPublishBusy] = useState<"draft" | "live" | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [exportBusy, setExportBusy] = useState<"zip" | "commit" | null>(null);
  const [exportResult, setExportResult] = useState<ExportCommitResult | null>(null);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [highlightSectionKey, setHighlightSectionKey] = useState<string | null>(null);
  const [aiVisibility, setAiVisibility] = useState<AiVisibilitySnapshotView | null>(null);
  const [aiVisibilityBusy, setAiVisibilityBusy] = useState(false);
  const [aiVisibilityError, setAiVisibilityError] = useState<string | null>(null);
  const [jobHydrating, setJobHydrating] = useState(true);
  const [contentType, setContentType] = useState<string>("blog");
  const [sourceAttributionHtml, setSourceAttributionHtml] = useState<string | null>(null);
  const [jobCitations, setJobCitations] = useState<RagCitation[]>([]);
  const [provenance, setProvenance] = useState<RagProvenance | null>(null);
  const [evidenceManifest, setEvidenceManifest] = useState<ResearchEvidenceManifest | null>(null);
  const [modelPolicy, setModelPolicy] = useState<ModelPolicySelection | null>(null);
  const [approvedStageModels, setApprovedStageModels] = useState<ApprovedStageModels>({});
  const [retryModel, setRetryModel] = useState("");
  const [retryReason, setRetryReason] = useState("availability");
  const [retryConfirmed, setRetryConfirmed] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [agentExecutions, setAgentExecutions] = useState<AgentExecution[]>([]);
  const [agentTeam, setAgentTeam] = useState<AgentTeamProvenance | null>(null);
  const [handoffs, setHandoffs] = useState<AgentHandoffProvenance[]>([]);

  const lastSeqRef = useRef(0);
  const statusRef = useRef(status);
  const workspaceTabTouchedRef = useRef(false);
  /** True while the operator has unsaved outline edits — blocks hub OutlineReady from clobbering them. */
  const outlineDirtyRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const applyParsedJobResult = useCallback((resultJson: string | null | undefined) => {
    const parsed = parseJobResult(resultJson);
    setSourceAttributionHtml(parsed.sourceAttributionHtml);
    setJobCitations(parsed.citations);
    setProvenance(parsed.provenance);
    setEvidenceManifest(parsed.evidenceManifest);
    setModelPolicy(parsed.modelPolicy);
    setApprovedStageModels(parsed.approvedStageModels);
    setAgentExecutions(parsed.agentExecutions);
    setAgentTeam(parsed.agentTeam);
    setHandoffs(parsed.handoffs);
    if (parsed.linkedInCarousel) {
      setCarouselResult({
        slug: parsed.linkedInCarousel.slug,
        slideCount: parsed.linkedInCarousel.slides.length,
        caption: parsed.linkedInCarousel.caption,
        pdfBase64: parsed.linkedInCarousel.pdfBase64,
        suggestedFilename: parsed.linkedInCarousel.suggestedFilename,
        generatedAtUtc: parsed.linkedInCarousel.generatedAtUtc,
      });
    } else {
      setCarouselResult(null);
    }
    const stageModels =
      parsed.approvedStageModels[parsed.provenance?.stage ?? ""] ??
      Object.values(parsed.approvedStageModels)[0] ??
      [];
    setRetryModel((current) => current || stageModels[0] || "");
    setSections((current) => {
      if (Object.keys(parsed.sectionCitations).length === 0) return current;
      const next = new Map(current);
      for (const [sectionKey, citations] of Object.entries(parsed.sectionCitations)) {
        const section = next.get(sectionKey);
        if (section) next.set(sectionKey, { ...section, citations });
      }
      return next;
    });
  }, []);

  const applySectionEvent = useCallback((payload: SectionEventPayload) => {
    const section = safeParse(payload.documentJson) as SectionNode | null;
    if (!section) return;
    setSections((prev) => {
      const next = new Map(prev);
      next.set(payload.sectionKey, {
        sectionKey: payload.sectionKey,
        heading: payload.heading,
        job: payload.job ?? null,
        section,
        wordCount: payload.wordCount,
        usedFallbackStub: payload.usedFallbackStub,
        citations: payload.citations ?? [],
        provenance:
          (payload.provenance || payload.agentExecution
            ? { ...(payload.provenance ?? {}), agentExecution: payload.agentExecution ?? payload.provenance?.agentExecution }
            : null) ??
          (payload.modelUsed || payload.retrievalStrategy || payload.evidenceIds
            ? {
                modelUsed: payload.modelUsed,
                retrievalStrategy: payload.retrievalStrategy,
                evidenceIds: payload.evidenceIds,
              }
            : null),
      });
      return next;
    });
    setPendingSectionKey((current) => (current === payload.sectionKey ? null : current));
  }, []);

  const runAiVisibilityRefresh = useCallback(async () => {
    setAiVisibilityBusy(true);
    setAiVisibilityError(null);
    try {
      const snapshot = await refreshAiVisibility(createId);
      setAiVisibility(snapshot);
      if (!snapshot.ready) setAiVisibilityError(snapshot.message);
    } catch (err) {
      setAiVisibilityError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setAiVisibilityBusy(false);
    }
  }, [createId]);

  const appendEvent = useCallback(
    (evt: GccV2JobEvent) => {
      if (evt.jobId !== jobId) return;
      if (evt.seq <= lastSeqRef.current) return;
      lastSeqRef.current = evt.seq;

      const payload = safeParse(evt.payloadJson) ?? evt.payloadJson;
      setLog((prev) => [...prev, { seq: evt.seq, type: evt.type, payload, atUtc: evt.createdAtUtc }]);

      switch (evt.type) {
        case "JobStageChanged":
          setStage((payload as { stage?: string })?.stage ?? null);
          break;
        case "AgentStageStarted":
        case "AgentToolCompleted":
        case "SkillActivated":
        case "AgentStageCompleted": {
          const execution = (payload as { execution?: AgentExecution })?.execution;
          if (execution?.attemptId) {
            setAgentExecutions((current) => upsertAgentExecution(current, execution));
            setProvenance((current) => ({
              ...(current ?? {}),
              stage: execution.stage,
              attemptId: execution.attemptId,
              agentExecution: execution,
            }));
          }
          break;
        }
        case "AgentTeamResolved": {
          const team = (payload as { team?: AgentTeamProvenance }).team ?? payload as AgentTeamProvenance;
          if (team?.snapshotDigest) setAgentTeam(team);
          break;
        }
        case "AgentContributionCompleted":
        case "AgentReviewCompleted":
        case "AgentHandoff": {
          const handoff = (payload as { handoff?: AgentHandoffProvenance }).handoff ?? payload as AgentHandoffProvenance;
          if (handoff?.fromCatalogAgentId && handoff?.toCatalogAgentId) {
            setHandoffs((current) => handoff.id && current.some((item) => item.id === handoff.id) ? current : [...current, handoff]);
          }
          break;
        }
        case "BrandKitReady": {
          const kit = payload as BrandKitReadyView;
          setBrandKit(kit);
          setKitCompanyName(kit.companyName ?? "");
          setKitDescription(kit.companyDescription ?? "");
          setKitPositioning(kit.positioningOneLiner ?? "");
          setKitTagline(kit.tagline ?? "");
          setKitNotice(null);
          // Replay-safe: hub events are immutable — BrandKitReady still says provisional after Accept.
          // Do not re-enter the gate once the job has moved on.
          const current = statusRef.current;
          if (
            current === "awaiting_outline_approval" ||
            current === "running" ||
            current === "ready" ||
            current === "failed" ||
            current === "canceled"
          ) {
            break;
          }
          setAwaitingBrandkit(true);
          setAwaitingOutlineApproval(false);
          setStatus("awaiting_brandkit_approval");
          if (!workspaceTabTouchedRef.current) setActiveTab("brief");
          break;
        }
        case "BrandKitAccepted":
          setAwaitingBrandkit(false);
          setAwaitingOutlineApproval(true);
          setStatus("awaiting_outline_approval");
          if (!workspaceTabTouchedRef.current) setActiveTab("outline");
          setKitNotice(null);
          break;
        case "BrandKitRejected":
          setAwaitingBrandkit(true);
          setAwaitingOutlineApproval(false);
          setStatus("awaiting_brandkit_approval");
          setKitNotice(
            "Acceptance cleared — edit description/positioning if needed, then Accept to continue.",
          );
          if (!workspaceTabTouchedRef.current) setActiveTab("brief");
          setError(null);
          break;
        case "OutlineReady": {
          if (outlineDirtyRef.current) break;
          const next = payload as OutlineView;
          setOutline(next);
          if (next.provenance) setProvenance(next.provenance);
          if (next.evidenceManifest) setEvidenceManifest(next.evidenceManifest);
          setEditableSections(
            (next.sections ?? []).map((s) => ({
              ...s,
              hierarchyChildHeadings: s.hierarchyChildHeadings ?? [],
            })),
          );
          break;
        }
        case "OutlineApproved":
          setAwaitingOutlineApproval(false);
          setAwaitingBrandkit(false);
          setStatus("running");
          break;
        case "ValidationReport":
          setReport(payload as ValidationReportView);
          break;
        case "ValidationInvalidated":
          setReport(null);
          break;
        case "JobCompleted": {
          const p = payload as { status?: string };
          setStatus(p?.status ?? "ready");
          setAwaitingOutlineApproval(false);
          setAwaitingBrandkit(false);
          void runAiVisibilityRefresh();
          void (async () => {
            try {
              const res = await fetch(`/api/gcc-v2/jobs/${jobId}`, { cache: "no-store" });
              if (!res.ok) return;
              const job = (await res.json()) as { resultJson?: string | null };
              applyParsedJobResult(job.resultJson);
            } catch {
              /* best-effort */
            }
          })();
          break;
        }
        case "JobCanceled":
          setStatus("canceled");
          setAwaitingOutlineApproval(false);
          setAwaitingBrandkit(false);
          break;
        case "JobFailed":
          setStatus("failed");
          setError((payload as { error?: string })?.error ?? "Job failed");
          setAwaitingOutlineApproval(false);
          setAwaitingBrandkit(false);
          break;
        case "CmsPublished": {
          const p = payload as CmsPublishedPayload;
          setPublishResult({
            status: p.status,
            slug: p.slug,
            publicUrl: p.publicUrl,
            externalPostId: p.externalPostId,
            isPublished: p.isPublished,
          });
          void runAiVisibilityRefresh();
          break;
        }
        case "CmsPublishFailed":
          setPublishResult({
            status: "failed",
            error: (payload as { error?: string })?.error ?? "Publish failed",
          });
          break;
        default:
          if (SECTION_EVENT_TYPE_SET.has(evt.type)) {
            applySectionEvent(payload as SectionEventPayload);
          }
      }
    },
    [applyParsedJobResult, applySectionEvent, jobId, runAiVisibilityRefresh],
  );

  useEffect(() => {
    lastSeqRef.current = 0;
    void Promise.resolve().then(() => {
      setSourceAttributionHtml(null);
      setJobCitations([]);
      setProvenance(null);
      setEvidenceManifest(null);
      setModelPolicy(null);
      setApprovedStageModels({});
      setAgentExecutions([]);
      setAgentTeam(null);
      setHandoffs([]);
    });
    void joinActiveJob(jobId, 0);
  }, [jobId, joinActiveJob]);

  useEffect(() => {
    return subscribeJobEvents(appendEvent);
  }, [appendEvent, subscribeJobEvents]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/gcc-v2/creates/${createId}`, { cache: "no-store" });
        if (!res.ok) return;
        const create = (await res.json()) as { siteUrl?: string | null };
        if (!cancelled && create.siteUrl) setSiteUrl(create.siteUrl);
      } catch {
        /* ignore — Writing for banner is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/gcc-v2/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) return;
        const job = (await res.json()) as {
          status?: string;
          stage?: string | null;
          contentType?: string;
          resultJson?: string | null;
        };
        if (cancelled) return;
        if (job.status) setStatus(job.status);
        if (job.stage) setStage(job.stage);
        if (job.contentType) setContentType(job.contentType.trim().toLowerCase());
        applyParsedJobResult(job.resultJson);
        if (job.status === "awaiting_brandkit_approval") {
          setAwaitingBrandkit(true);
          setAwaitingOutlineApproval(false);
          if (!workspaceTabTouchedRef.current) setActiveTab("brief");
        } else if (job.status === "awaiting_outline_approval") {
          setAwaitingBrandkit(false);
          setAwaitingOutlineApproval(true);
          if (!workspaceTabTouchedRef.current) setActiveTab("outline");
        }
      } catch {
        /* hub events remain primary */
      } finally {
        if (!cancelled) setJobHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyParsedJobResult, jobId]);

  const orderedSections = useMemo(() => Array.from(sections.values()), [sections]);

  useEffect(() => {
    let cancelled = false;
    fetchAiVisibility(createId)
      .then((snapshot) => {
        if (!cancelled) setAiVisibility(snapshot);
      })
      .catch((err) => {
        if (!cancelled) setAiVisibilityError(err instanceof Error ? err.message : "Could not load AI visibility");
      });
    return () => {
      cancelled = true;
    };
  }, [createId]);

  async function persistOutline(): Promise<boolean> {
    if (editableSections.length === 0) return true;
    const body = {
      sections: editableSections.map((s) => ({
        key: s.key,
        heading: s.heading,
        job: s.job,
        hierarchyChildHeadings: s.hierarchyChildHeadings ?? [],
      })),
      hierarchyChildHeadings: outline?.hierarchyChildHeadings ?? [],
    };
    const res = await fetch(`/api/gcc-v2/jobs/${jobId}/outline`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(detail?.error || `save outline failed: HTTP ${res.status}`);
    }
    const saved = (await res.json()) as OutlineView;
    outlineDirtyRef.current = false;
    setOutline(saved);
    setEditableSections(
      (saved.sections ?? []).map((s) => ({
        ...s,
        hierarchyChildHeadings: s.hierarchyChildHeadings ?? [],
      })),
    );
    return true;
  }

  async function saveOutline() {
    if (editableSections.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await persistOutline();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save outline");
    } finally {
      setBusy(false);
    }
  }

  async function approveOutline() {
    setBusy(true);
    setError(null);
    try {
      if (editableSections.length > 0) {
        await persistOutline();
      }
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/approve-outline`, { method: "POST" });
      if (!res.ok) throw new Error(`approve failed: HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save and approve outline");
    } finally {
      setBusy(false);
    }
  }

  async function acceptBrandKit() {
    setBusy(true);
    setError(null);
    setKitNotice(null);
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/accept-brandkit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: kitCompanyName.trim() || null,
          companyDescription: kitDescription.trim() || null,
          positioningOneLiner: kitPositioning.trim() || null,
          tagline: kitTagline.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `accept brand kit failed: HTTP ${res.status}`);
      }
      setAwaitingBrandkit(false);
      setAwaitingOutlineApproval(true);
      setStatus("awaiting_outline_approval");
      setActiveTab("outline");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept brand kit");
    } finally {
      setBusy(false);
    }
  }

  async function rejectBrandKit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/reject-brandkit`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `reject brand kit failed: HTTP ${res.status}`);
      }
      setAwaitingBrandkit(true);
      setAwaitingOutlineApproval(false);
      setStatus("awaiting_brandkit_approval");
      setKitNotice(
        "Acceptance cleared — edit description/positioning if needed, then Accept to continue.",
      );
      setActiveTab("brief");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject brand kit");
    } finally {
      setBusy(false);
    }
  }

  function addAdvanceOutlineSection() {
    outlineDirtyRef.current = true;
    setEditableSections((prev) => insertAdvanceSection(prev));
  }

  function removeOutlineSection(index: number) {
    outlineDirtyRef.current = true;
    setEditableSections((prev) => removeSectionAt(prev, index));
  }

  async function regenerateOutline() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/regenerate-outline`, { method: "POST" });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error || `regenerate outline failed: HTTP ${res.status}`);
      }
      const next = (await res.json()) as OutlineView;
      if (!next?.sections?.length) {
        throw new Error("Regenerate returned an empty outline");
      }
      outlineDirtyRef.current = false;
      setOutline(next);
      setEditableSections(
        next.sections.map((s) => ({
          ...s,
          hierarchyChildHeadings: s.hierarchyChildHeadings ?? [],
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate outline");
    } finally {
      setBusy(false);
    }
  }

  async function copyAllSections() {
    const text = canvasSectionsToPlain(orderedSections);
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyAllDone(true);
      window.setTimeout(() => setCopyAllDone(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy to clipboard");
    }
  }

  async function cancelJob() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(`cancel failed: HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel job");
    } finally {
      setBusy(false);
    }
  }

  async function runLinkedInCarousel() {
    setCarouselBusy(true);
    setCarouselError(null);
    try {
      const res = await fetch(`/api/gcc-v2/creates/${createId}/transform/linkedin-carousel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Carousel failed: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
      }
      const data = (await res.json()) as {
        slug?: string;
        slideCount?: number;
        caption?: string;
        pdfBase64?: string;
        suggestedFilename?: string;
        generatedAtUtc?: string;
      };
      if (!data.pdfBase64) throw new Error("Carousel response missing PDF.");
      setCarouselResult({
        slug: data.slug ?? "carousel",
        slideCount: data.slideCount ?? 0,
        caption: data.caption ?? "",
        pdfBase64: data.pdfBase64,
        suggestedFilename: data.suggestedFilename ?? data.slug ?? "carousel",
        generatedAtUtc: data.generatedAtUtc,
      });
    } catch (err) {
      setCarouselError(err instanceof Error ? err.message : "Carousel failed");
    } finally {
      setCarouselBusy(false);
    }
  }

  function downloadCarouselPdf() {
    if (!carouselResult?.pdfBase64) return;
    const bytes = Uint8Array.from(atob(carouselResult.pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${carouselResult.suggestedFilename}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCarouselCaption() {
    if (!carouselResult?.caption) return;
    try {
      await navigator.clipboard.writeText(carouselResult.caption);
      setCaptionCopied(true);
      window.setTimeout(() => setCaptionCopied(false), 2000);
    } catch (err) {
      setCarouselError(err instanceof Error ? err.message : "Could not copy caption");
    }
  }

  async function runTransform() {
    setTransformBusy(true);
    setTransformError(null);
    try {
      const res = await fetch(`/api/gcc-v2/creates/${createId}/transform`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId,
          channels: [...REPURPOSE_CHANNELS],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Re-Purpose failed: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
      }
      const data = (await res.json()) as {
        variants?: Array<{ channel: string; title: string; body: string; headline?: string | null }>;
      };
      setTransformVariants(data.variants ?? []);
    } catch (err) {
      setTransformError(err instanceof Error ? err.message : "Re-Purpose failed");
    } finally {
      setTransformBusy(false);
    }
  }

  async function runPublish(isPublished: boolean) {
    setPublishBusy(isPublished ? "live" : "draft");
    try {
      const result = await callPublish(createId, jobId, isPublished);
      setPublishResult(result);
    } catch (err) {
      setPublishResult({
        status: "failed",
        error: err instanceof Error ? err.message : "Publish failed",
      });
    } finally {
      setPublishBusy(null);
    }
  }

  async function runExportZip() {
    setExportBusy("zip");
    setExportResult(null);
    setExportSummary(null);
    try {
      const summary = await downloadHtmlExport(createId);
      setExportSummary(summary);
    } catch (err) {
      setExportResult({ error: err instanceof Error ? err.message : "Export failed" });
    } finally {
      setExportBusy(null);
    }
  }

  async function runExportCommit() {
    setExportBusy("commit");
    setExportResult(null);
    setExportSummary(null);
    try {
      const result = await commitHtmlExport(createId);
      setExportResult(result);
      if (result.exportSummary) setExportSummary(result.exportSummary);
    } catch (err) {
      setExportResult({ error: err instanceof Error ? err.message : "Commit failed" });
    } finally {
      setExportBusy(null);
    }
  }

  async function runFixReadiness() {
    setReadinessBusy(true);
    setReadinessError(null);
    try {
      const result = await callFixReadiness(createId, jobId);
      if (result.error) {
        setReadinessError(result.error);
        return;
      }
      setReport((prev) =>
        prev
          ? {
              ...prev,
              shipReady: result.shipReady ?? prev.shipReady,
              outstandingIssues: result.outstandingIssues ?? prev.outstandingIssues,
              seoScore: result.seoScore ?? prev.seoScore,
              geoScore: result.geoScore ?? prev.geoScore,
              polishScore: result.polishScore ?? prev.polishScore,
              polishShipReady: result.polishShipReady ?? prev.polishShipReady,
              guardrailRestructureCount:
                result.guardrailRestructureCount ?? prev.guardrailRestructureCount,
              guardrailRestructurePhrases:
                result.guardrailRestructurePhrases ?? prev.guardrailRestructurePhrases,
              seoChecks: result.seoChecks ?? prev.seoChecks,
              geoChecks: result.geoChecks ?? prev.geoChecks,
              overlapHits: result.overlapHits ?? prev.overlapHits,
            }
          : prev,
      );
    } catch (err) {
      setReadinessError(err instanceof Error ? err.message : "Fix readiness failed");
    } finally {
      setReadinessBusy(false);
    }
  }

  const hasReadinessFailures =
    (report?.seoChecks?.some((c) => !c.passed) ?? false)
    || (report?.geoChecks?.some((c) => !c.passed) ?? false);

  const outstandingBlockers = useMemo(
    () => (report ? listOutstandingBlockers(report) : []),
    [report],
  );

  async function runCanvasAction(
    sectionKey: string,
    action: CanvasAction,
    instructionOverride?: string,
  ) {
    setPendingSectionKey(sectionKey);
    setError(null);
    try {
      await callCanvasAction(createId, jobId, action, {
        sectionKey,
        instruction: instructionOverride ?? (pendingInstruction[sectionKey]?.trim() || undefined),
      });
      // The Canvas endpoint also emits a job event (SectionRewritten/Expanded/Retoned) which will
      // update this section again via the hub — this direct clear just avoids a stuck spinner if
      // that event is delayed.
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
      setPendingSectionKey((current) => (current === sectionKey ? null : current));
    }
  }

  async function saveExactSection(sectionKey: string, exactContent: string) {
    setPendingSectionKey(sectionKey);
    setError(null);
    try {
      const res = await fetch(`/api/gcc-v2/creates/${createId}/canvas/section`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, sectionKey, exactContent }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        sectionKey?: string;
        heading?: string;
        job?: string | null;
        section?: SectionNode;
        wordCount?: number;
        usedFallbackStub?: boolean;
        citations?: RagCitation[];
        provenance?: RagProvenance | null;
      } | null;
      if (!res.ok || !data?.section) {
        throw new Error(data?.error || `save content failed: HTTP ${res.status}`);
      }
      setSections((previous) => {
        const current = previous.get(sectionKey);
        if (!current) return previous;
        const next = new Map(previous);
        next.set(sectionKey, {
          ...current,
          heading: data.heading ?? current.heading,
          job: data.job ?? current.job,
          section: data.section!,
          wordCount: data.wordCount ?? current.wordCount,
          usedFallbackStub: data.usedFallbackStub ?? false,
          citations: data.citations ?? current.citations,
          provenance: data.provenance ?? current.provenance,
        });
        return next;
      });
      setReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save section content");
      throw err;
    } finally {
      setPendingSectionKey((current) => (current === sectionKey ? null : current));
    }
  }

  function scrollToSection(sectionKey: string) {
    setActiveTab("canvas");
    setHighlightSectionKey(sectionKey);
    window.setTimeout(() => {
      document.getElementById(`section-card-${sectionKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    window.setTimeout(() => {
      setHighlightSectionKey((current) => (current === sectionKey ? null : current));
    }, 4000);
  }

  function prepareOverlapFix(sectionKey: string, repairHint: string) {
    setPendingInstruction((prev) => ({ ...prev, [sectionKey]: repairHint }));
    scrollToSection(sectionKey);
  }

  async function retryFailedStageWithModel() {
    if (!retryModel || !retryConfirmed) return;
    setRetryBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/retry-model`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: provenance?.stage ?? stage,
          model: retryModel,
          reason: retryReason,
          confirmed: true,
          replacedAttemptId: provenance?.attemptId ?? undefined,
        }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error || `model retry failed: HTTP ${res.status}`);
      }
      setStatus("pending");
      setRetryConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retry the failed stage");
    } finally {
      setRetryBusy(false);
    }
  }

  const isTerminal = status === "ready" || status === "canceled" || status === "failed";
  const canRepurpose = status === "ready" && canRepurposeContentType(contentType);
  const canLinkedInCarousel = status === "ready" && isLongFormContentType(contentType);
  const repurposeSourceLabel = labelForContentType(contentType);
  const showBrandKitPanel = awaitingBrandkit || status === "awaiting_brandkit_approval";
  // BrandKit Accept must complete before outline Approve — never show both gates together.
  const showOutlinePanel =
    !showBrandKitPanel &&
    awaitingOutlineApproval &&
    (outline !== null || editableSections.length > 0);
  const showApproveOutline = !showBrandKitPanel && awaitingOutlineApproval;
  const showAddAdvanceOutline = showOutlinePanel && supportsAdvanceOutlineRows(contentType);
  const retryStage = provenance?.stage ?? stage ?? "";
  const retryModels =
    approvedStageModels[retryStage] ??
    approvedStageModels[retryStage.toLowerCase()] ??
    Object.values(approvedStageModels)[0] ??
    [];
  const currentAgentExecution =
    provenance?.agentExecution ?? agentExecutions[agentExecutions.length - 1] ?? null;
  const reviewCount =
    outstandingBlockers.length
    + (report?.overlapHits.length ?? 0)
    + (report?.seoChecks?.filter((check) => !check.passed).length ?? 0)
    + (report?.geoChecks?.filter((check) => !check.passed).length ?? 0);
  const assetCount =
    jobs.length + transformVariants.length + (carouselResult ? 1 : 0) + (publishResult ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {siteUrl ? (
          <p className="text-sm text-[var(--cc-ink)]">
            Writing for: <span className="font-medium">{siteUrl}</span>
          </p>
        ) : null}
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          status === "ready" ? "bg-green-50 text-green-700" : status === "failed" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
        }`}>
          {status === "ready" ? "Ready" : status === "failed" ? "Needs attention" : "In progress"}
        </span>
        {orderedSections.length > 0 ? (
          <button
            type="button"
            onClick={() => void copyAllSections()}
            className="ml-auto rounded-md border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-ink)]"
          >
            {copyAllDone ? "Copied" : "Copy draft"}
          </button>
        ) : null}
        {!isTerminal ? (
          <button
            type="button"
            onClick={cancelJob}
            disabled={busy}
            className="rounded-md border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {hubError ? <p className="text-xs text-red-600" role="alert">{hubError}</p> : null}
      {jobHydrating ? <LoadingRow label="Connecting to job…" /> : null}

      <WorkspaceTabs
        active={activeTab}
        onChange={(tab) => {
          workspaceTabTouchedRef.current = true;
          setActiveTab(tab);
        }}
        reviewCount={reviewCount}
        assetCount={assetCount}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-4">
        {activeTab === "canvas" ? <ProcessBanner status={status} stage={stage} /> : null}

        {activeTab === "brief" && showBrandKitPanel ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4">
            <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Brand kit awaiting approval</h2>
            <p className="mt-1 text-xs text-[var(--cc-muted)]">
              Grounded from this site&apos;s Geek-SEO crawl — edit if needed, then Accept before writing.
            </p>
            {kitNotice ? <p className="mt-2 text-xs text-amber-800">{kitNotice}</p> : null}
            {brandKit ? (
              <div className="mt-3 flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-[var(--cc-ink)]" htmlFor="kit-company">
                    Company
                  </label>
                  <input
                    id="kit-company"
                    className="rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]"
                    value={kitCompanyName}
                    onChange={(e) => setKitCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <span className="font-medium text-[var(--cc-ink)]">Website: </span>
                  <span className="text-[var(--cc-muted)]">{brandKit.website || "—"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-[var(--cc-ink)]" htmlFor="kit-tagline">
                    Tagline
                  </label>
                  <input
                    id="kit-tagline"
                    className="rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]"
                    value={kitTagline}
                    onChange={(e) => setKitTagline(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-[var(--cc-ink)]" htmlFor="kit-description">
                    Description
                  </label>
                  <textarea
                    id="kit-description"
                    className="min-h-[88px] rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]"
                    value={kitDescription}
                    onChange={(e) => setKitDescription(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-[var(--cc-ink)]" htmlFor="kit-positioning">
                    Positioning
                  </label>
                  <textarea
                    id="kit-positioning"
                    className="min-h-[72px] rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]"
                    value={kitPositioning}
                    onChange={(e) => setKitPositioning(e.target.value)}
                  />
                </div>
                <div>
                  <p className="font-medium text-[var(--cc-ink)]">
                    Voice evidence from crawl — not a picker ({brandKit.voiceSampleCount ?? 0})
                  </p>
                  {brandKit.voiceSamplePreviews && brandKit.voiceSamplePreviews.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-2">
                      {brandKit.voiceSamplePreviews.map((s, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-[var(--cc-line)] bg-black/[0.02] px-2.5 py-2 text-xs whitespace-pre-wrap text-[var(--cc-muted)]"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : (
              <LoadingRow label="Loading brand kit summary…" className="mt-2" />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void acceptBrandKit()}
                disabled={busy}
                className="rounded-md bg-[var(--cc-accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                <ButtonBusyLabel busy={busy} busyLabel="Accepting…" idleLabel="Accept brand kit" />
              </button>
              <button
                type="button"
                onClick={() => void rejectBrandKit()}
                disabled={busy}
                className="rounded-md border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-60"
              >
                <ButtonBusyLabel busy={busy} busyLabel="Clearing…" idleLabel="Clear acceptance" />
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "outline" && showOutlinePanel ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Outline awaiting approval</h2>
              <button
                type="button"
                onClick={() => void saveOutline()}
                disabled={busy || editableSections.length === 0}
                className="ml-auto rounded-md border border-[var(--cc-line)] px-3 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-60"
              >
                <ButtonBusyLabel busy={busy} busyLabel="Saving…" idleLabel="Save" />
              </button>
              <button
                type="button"
                onClick={() => void regenerateOutline()}
                disabled={busy}
                className="rounded-md border border-[var(--cc-line)] px-3 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-60"
              >
                <ButtonBusyLabel busy={busy} busyLabel="Regenerating…" idleLabel="Regenerate" />
              </button>
              {showApproveOutline ? (
                <button
                  type="button"
                  onClick={() => void approveOutline()}
                  disabled={busy}
                  className="rounded-md bg-[var(--cc-accent)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  <ButtonBusyLabel busy={busy} busyLabel="Approving…" idleLabel="Save & approve" />
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-[var(--cc-muted)]">
              Shape the order and purpose of the draft before writing. Required points apply only to
              that section. Save keeps the outline editable; Save &amp; approve continues generation.
              {showAddAdvanceOutline ? (
                <>
                  {" "}
                  Adding an Advance section typically adds ~500–700 words at write — the preferred fix for
                  thin Pillar drafts before approve.
                </>
              ) : null}
            </p>
            {showAddAdvanceOutline ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={addAdvanceOutlineSection}
                  disabled={busy}
                  className="rounded-md border border-[var(--cc-line)] px-3 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-60"
                >
                  Add core section
                </button>
              </div>
            ) : null}
            <ol className="mt-3 flex flex-col gap-3">
              {editableSections.map((s, i) => (
                <li key={s.key || i} className="flex flex-col gap-1.5 rounded-md border border-[var(--cc-line)] p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      aria-label={`Outline section ${i + 1} heading`}
                      value={s.heading}
                      onChange={(e) => {
                        outlineDirtyRef.current = true;
                        const heading = e.target.value;
                        setEditableSections((prev) =>
                          prev.map((row, idx) => (idx === i ? { ...row, heading } : row)),
                        );
                      }}
                      placeholder={
                        s.job === "advance" && !s.heading.trim()
                          ? "e.g. How … or Next steps for …"
                          : undefined
                      }
                      className="min-w-0 flex-1 rounded-md border border-[var(--cc-line)] px-2 py-1.5 text-sm text-[var(--cc-ink)]"
                    />
                    {canRemoveSection(s, i) ? (
                      <button
                        type="button"
                        onClick={() => removeOutlineSection(i)}
                        disabled={busy}
                        className="rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs font-semibold text-[var(--cc-muted)] disabled:opacity-60"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--cc-muted)]">
                    <span>Purpose</span>
                    <select
                      aria-label={`Outline section ${i + 1} purpose`}
                      value={isProblemLocked(i) ? "problem" : s.job}
                      disabled={isRoleLocked(s, i)}
                      onChange={(e) => {
                        outlineDirtyRef.current = true;
                        const job = e.target.value;
                        setEditableSections((prev) =>
                          prev.map((row, idx) => (idx === i ? { ...row, job } : row)),
                        );
                      }}
                      className="rounded-md border border-[var(--cc-line)] bg-white px-2 py-1 text-xs text-[var(--cc-ink)] disabled:opacity-60"
                    >
                      {OUTLINE_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {isProblemLocked(i) ? (
                      <span>The opening establishes context once.</span>
                    ) : null}
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[var(--cc-muted)]">
                    <span>Required points (one per line)</span>
                    <textarea
                      aria-label={`Outline section ${i + 1} must mention`}
                      rows={Math.min(6, Math.max(2, s.hierarchyChildHeadings.length + 1))}
                      value={s.hierarchyChildHeadings.join("\n")}
                      onChange={(e) => {
                        outlineDirtyRef.current = true;
                        const hierarchyChildHeadings = e.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean);
                        setEditableSections((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, hierarchyChildHeadings } : row,
                          ),
                        );
                      }}
                      className="rounded-md border border-[var(--cc-line)] px-2 py-1.5 font-mono text-xs text-[var(--cc-ink)]"
                      placeholder="Sub-topics or partner tools for this section only"
                    />
                  </label>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {activeTab === "canvas" && orderedSections.length === 0 &&
        !awaitingOutlineApproval &&
        !awaitingBrandkit &&
        status !== "awaiting_brandkit_approval" ? (
          isJobProcessing(status) ? (
            <LoadingRow label="Waiting for the first section to be drafted…" />
          ) : (
            <p className="text-sm text-[var(--cc-muted)]">
              Waiting for the first section to be drafted…
            </p>
          )
        ) : null}

        {activeTab === "canvas" ? orderedSections.map((section) => (
          <WorkspaceSection
            key={section.sectionKey}
            item={section}
            highlighted={highlightSectionKey === section.sectionKey}
            instruction={pendingInstruction[section.sectionKey] ?? ""}
            pending={pendingSectionKey === section.sectionKey}
            onInstructionChange={(value) =>
              setPendingInstruction((previous) => ({ ...previous, [section.sectionKey]: value }))
            }
            onAction={(action) => void runCanvasAction(section.sectionKey, action)}
            onSaveExact={(exactContent) => saveExactSection(section.sectionKey, exactContent)}
          />
        )) : null}

        {activeTab === "canvas" && jobCitations.length > 0 ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4">
            <SectionCitations citations={jobCitations} />
          </div>
        ) : null}

        {activeTab === "canvas" && sourceAttributionHtml ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4">
            <h2 className="text-lg font-semibold text-[var(--cc-ink)]">Sources</h2>
            <div
              className="prose prose-sm mt-3 max-w-none text-[var(--cc-ink)]"
              dangerouslySetInnerHTML={{ __html: sourceAttributionHtml }}
            />
          </div>
        ) : null}

        {activeTab === "outline" && !showOutlinePanel ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4">
            <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Approved outline</h2>
            {editableSections.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {editableSections.map((section, index) => (
                  <li key={section.key} className="flex gap-3 rounded-md bg-black/[0.025] p-3 text-sm">
                    <span className="text-[var(--cc-muted)]">{index + 1}</span>
                    <div>
                      <p className="font-medium text-[var(--cc-ink)]">{section.heading}</p>
                      <p className="text-xs text-[var(--cc-muted)]">
                        {OUTLINE_ROLE_OPTIONS.find((option) => option.value === section.job)?.label ?? section.job}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-[var(--cc-muted)]">The outline will appear when planning completes.</p>
            )}
          </div>
        ) : null}

        {activeTab === "assets" ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4">
            <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Drafts and generated outputs</h2>
            <p className="mt-1 text-xs text-[var(--cc-muted)]">
              Every draft, image prompt, and companion output for this content item stays together here.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {jobs.map((job) => (
                <li key={job.id} className="rounded-md border border-[var(--cc-line)] p-3 text-xs">
                  <p className="font-semibold text-[var(--cc-ink)]">
                    {job.tabLabel?.trim() || labelForContentType(job.contentType ?? "draft")}
                  </p>
                  <p className="mt-1 text-[var(--cc-muted)]">
                    {job.status === "ready" ? "Ready" : job.status === "failed" ? "Needs attention" : "In progress"}
                    {job.id === jobId ? " · Active draft" : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {activeTab === "review" ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4 lg:hidden">
            <p className="text-sm text-[var(--cc-muted)]">Quality checks and repair actions are shown below.</p>
          </div>
        ) : null}

        {activeTab === "brief" && !showBrandKitPanel ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4">
            <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Content brief</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Format</dt>
                <dd className="font-medium text-[var(--cc-ink)]">{repurposeSourceLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--cc-muted)]">Writing for</dt>
                <dd className="font-medium text-[var(--cc-ink)]">{siteUrl || "Current project"}</dd>
              </div>
              {brandKit?.companyName ? (
                <div>
                  <dt className="text-xs text-[var(--cc-muted)]">Company</dt>
                  <dd className="font-medium text-[var(--cc-ink)]">{brandKit.companyName}</dd>
                </div>
              ) : null}
              {brandKit?.positioningOneLiner ? (
                <div>
                  <dt className="text-xs text-[var(--cc-muted)]">Positioning</dt>
                  <dd className="text-[var(--cc-ink)]">{brandKit.positioningOneLiner}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 text-xs text-[var(--cc-muted)]">
              The current backend read contract does not return the complete persisted brief, so this view shows the brief context available on the create and active job.
            </p>
          </div>
        ) : null}

      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-[var(--cc-line)] p-4">
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">
            {activeTab === "canvas" ? "Draft context" : activeTab === "outline" ? "Planning context" : activeTab === "assets" ? "Output context" : activeTab === "review" ? "Review context" : "Brief context"}
          </h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            {activeTab === "canvas"
              ? `${orderedSections.length} section${orderedSections.length === 1 ? "" : "s"} · ${jobCitations.length} verified citation${jobCitations.length === 1 ? "" : "s"}`
              : activeTab === "outline"
                ? `${editableSections.length} planned section${editableSections.length === 1 ? "" : "s"}`
                : activeTab === "assets"
                  ? `${assetCount} draft or output item${assetCount === 1 ? "" : "s"}`
                  : activeTab === "review"
                    ? reviewCount > 0 ? `${reviewCount} item${reviewCount === 1 ? "" : "s"} to review` : "No open quality issues"
                    : evidenceManifest ? `${evidenceManifest.sources?.length ?? 0} research source(s)` : "Brief and brand context"}
          </p>
          <details className="mt-3 border-t border-[var(--cc-line)] pt-3 text-xs">
            <summary className="cursor-pointer font-semibold text-[var(--cc-ink)]">Technical details</summary>
          <div className="mt-2 flex flex-col gap-1 text-[var(--cc-muted)]">
            <p className="font-mono">Job {jobId}</p>
            <p>Status: {status}{stage ? ` · Stage: ${stage}` : ""}</p>
            <p>Policy: {modelPolicyLabel(modelPolicy)}</p>
            <p>
              Model: {provenance?.effectiveModel || provenance?.modelUsed || "Awaiting backend provenance"}
            </p>
            <p>
              Retrieval: {provenance?.retrievalStrategy || provenance?.retrievalMode || "Awaiting manifest"}
            </p>
            {provenance?.modelPolicyVersion ? <p>Policy version: {provenance.modelPolicyVersion}</p> : null}
            {provenance?.promptVersion ? <p>Prompt version: {provenance.promptVersion}</p> : null}
            {agentTeam ? (
              <div className="mt-2 rounded-md border border-violet-200 bg-violet-50 p-2 text-violet-950">
                <p className="font-semibold">Specialist team ({agentTeam.members.length})</p>
                <p className="font-mono">Team snapshot {agentTeam.snapshotDigest}</p>
                <ul className="mt-1 space-y-1">
                  {agentTeam.members.map((member) => (
                    <li key={member.agentVersionId}>
                      <strong>{member.name} {member.version}</strong> · {member.role}{member.specialty ? ` · ${member.specialty}` : ""}
                      <span className="block font-mono">Catalog {member.catalogAgentId} · version {member.agentVersionId} · {member.digest}</span>
                      <span className="block">Activated skills: {member.activatedSkills?.map((skill) => `${skill.name} ${skill.version}`).join(", ") || "none recorded"}</span>
                    </li>
                  ))}
                </ul>
                {handoffs.length ? (
                  <ol className="mt-2 border-t border-violet-200 pt-2">
                    {handoffs.map((handoff, index) => (
                      <li key={handoff.id ?? `${handoff.fromCatalogAgentId}-${handoff.toCatalogAgentId}-${index}`}>
                        <span className="capitalize">{handoff.kind}</span>: {handoff.fromCatalogAgentId} → {handoff.toCatalogAgentId}{handoff.status ? ` · ${handoff.status}` : ""}
                        {handoff.summary ? <span className="block">{handoff.summary}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ) : null}
            {currentAgentExecution ? (
              <div className={`mt-2 rounded-md border p-2 ${
                currentAgentExecution.budget.exhausted || (currentAgentExecution.stopReason && currentAgentExecution.stopReason !== "completed")
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-[var(--cc-line)] bg-slate-50"
              }`}>
                <p>
                  Agent: <strong>{currentAgentExecution.catalogAgentId || currentAgentExecution.agentId}</strong> {currentAgentExecution.agentVersion} ·{" "}
                  {currentAgentExecution.status}
                </p>
                <p className="font-mono">Version {currentAgentExecution.agentVersionId || "legacy/unavailable"} · digest {currentAgentExecution.agentDigest || "legacy/unavailable"}</p>
                <p className="font-mono">Stage execution {currentAgentExecution.stageExecutionId || currentAgentExecution.attemptId}</p>
                <p>Protocol: {currentAgentExecution.protocolVersion} · workflow {currentAgentExecution.workflowVersion}</p>
                <p className="font-mono">Attempt {currentAgentExecution.attemptId}{currentAgentExecution.replacedAttemptId ? ` replaces ${currentAgentExecution.replacedAttemptId}` : ""}</p>
                <p className="font-mono">Immutable snapshot {currentAgentExecution.snapshotDigest}</p>
                <p>
                  Activated skills: {currentAgentExecution.activatedSkills.map((skill) => `${skill.name} ${skill.version}`).join(", ") || "none"}
                </p>
                <p>
                  Tools: {currentAgentExecution.tools.map((tool) => `${tool.toolId} ×${tool.callCount} (${tool.errorCount} errors)`).join(", ") || "none"}
                </p>
                <p>
                  Budget: {currentAgentExecution.budget.turnsUsed}/{currentAgentExecution.budget.maxTurns} turns ·{" "}
                  {currentAgentExecution.budget.toolCallsUsed}/{currentAgentExecution.budget.maxToolCalls} tools ·{" "}
                  {currentAgentExecution.budget.tokensUsed}/{currentAgentExecution.budget.maxTokens} tokens
                </p>
                {currentAgentExecution.stopReason ? <p className="font-semibold">Stop reason: {currentAgentExecution.stopReason.replaceAll("_", " ")}</p> : null}
                {currentAgentExecution.budget.exhausted ? <p className="font-semibold">Budget exhausted: {currentAgentExecution.budget.exhausted.replaceAll("_", " ")}</p> : null}
              </div>
            ) : null}
            {agentExecutions.length > 1 ? (
              <details className="mt-2">
                <summary className="cursor-pointer">Immutable attempt lineage ({agentExecutions.length}) / retries</summary>
                <ol className="mt-1 list-decimal pl-4">
                  {agentExecutions.map((execution) => (
                    <li key={execution.attemptId}>
                      {execution.stage} · <span className="font-mono">{execution.attemptId}</span> · {execution.status}
                      {execution.stopReason ? ` · ${execution.stopReason.replaceAll("_", " ")}` : ""}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
            {evidenceManifest ? (
              <>
                <p>
                  Evidence: {evidenceManifest.sources?.length ?? 0} source(s) ·{" "}
                  {evidenceManifest.ready === false ? "gaps require review" : "ready"}
                </p>
                {[...(evidenceManifest.evidenceGaps ?? []), ...(evidenceManifest.conflicts ?? []), ...(evidenceManifest.warnings ?? [])].length > 0 ? (
                  <ul className="mt-1 list-disc pl-4 text-amber-800">
                    {[...(evidenceManifest.evidenceGaps ?? []), ...(evidenceManifest.conflicts ?? []), ...(evidenceManifest.warnings ?? [])].map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </div>
            <details className="mt-3">
              <summary className="cursor-pointer">Event log ({log.length})</summary>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md bg-black/5 p-2 font-mono">
                {log.map((entry) => (
                  <li key={entry.seq}>
                    <span className="text-[var(--cc-accent)]">#{entry.seq}</span>{" "}
                    <span className="font-semibold">{entry.type}</span>{" "}
                    <span className="text-[var(--cc-muted)]">{JSON.stringify(entry.payload)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </details>

          {status === "failed" && retryModels.length > 0 ? (
            <div className="mt-3 border-t border-[var(--cc-line)] pt-3 text-xs">
              <p className="font-semibold text-[var(--cc-ink)]">Change model / retry failed stage</p>
              <p className="mt-1 text-[var(--cc-muted)]">
                Retries only {retryStage || "the failed stage"}. Approved output is preserved; evidence
                and validation standards do not change.
              </p>
              <select
                aria-label="Retry model"
                value={retryModel || retryModels[0]}
                onChange={(event) => setRetryModel(event.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--cc-line)] bg-white px-2 py-1.5"
              >
                {retryModels.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
              <select
                aria-label="Retry reason"
                value={retryReason}
                onChange={(event) => setRetryReason(event.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--cc-line)] bg-white px-2 py-1.5"
              >
                <option value="availability">Availability</option>
                <option value="quota">Quota</option>
                <option value="latency">Latency</option>
                <option value="cost">Cost</option>
                <option value="operator">Operator choice</option>
              </select>
              <label className="mt-2 flex gap-2 text-amber-900">
                <input
                  type="checkbox"
                  checked={retryConfirmed}
                  onChange={(event) => setRetryConfirmed(event.target.checked)}
                />
                Confirm the model tradeoff and regenerate this stage.
              </label>
              <button
                type="button"
                disabled={!retryConfirmed || retryBusy}
                onClick={() => void retryFailedStageWithModel()}
                className="mt-2 rounded-md bg-[var(--cc-accent)] px-3 py-1.5 font-semibold text-white disabled:opacity-50"
              >
                <ButtonBusyLabel busy={retryBusy} busyLabel="Retrying…" idleLabel="Retry stage" />
              </button>
            </div>
          ) : null}
        </div>

        <div className={`${activeTab === "review" ? "" : "hidden"} rounded-lg border border-[var(--cc-line)] p-4`}>
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Validation</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            SEO and GEO scores are an AI-visibility readiness checklist — advisory only, not a content
            quality grade. Export is never blocked by low scores.
          </p>
          {report ? (
            <div className="mt-2 flex flex-col gap-2 text-xs text-[var(--cc-muted)]">
              <p>
                Ship ready:{" "}
                <span className={report.shipReady ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
                  {report.shipReady ? "yes" : "no"}
                </span>
              </p>
              <p>Editorial verdict: {report.reviewVerdict}</p>
              {report.reviewNotes ? <p>Notes: {report.reviewNotes}</p> : null}
              <p>SEO score: {report.seoScore}</p>
              <p>
                Polish score: {report.polishScore} ({report.polishShipReady ? "ship-ready" : "not ship-ready"})
              </p>
              {typeof report.geoScore === "number" ? (
                <p>
                  GEO score (AI-visibility): {report.geoScore}{" "}
                  <span className="text-[var(--cc-muted)]">— advisory, does not block ship-ready</span>
                </p>
              ) : null}
              {report.geoChecks && report.geoChecks.some((c) => !c.passed) ? (
                <div className="rounded-md bg-blue-50 p-2 text-blue-900">
                  <p className="font-semibold">GEO fixes</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {report.geoChecks
                      .filter((c) => !c.passed)
                      .map((c) => (
                        <li key={c.id}>
                          <span className="font-medium">{c.label}:</span> {c.fixHint ?? c.detail}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              {report.seoChecks && report.seoChecks.some((c) => !c.passed) ? (
                <div className="rounded-md bg-blue-50 p-2 text-blue-900">
                  <p className="font-semibold">SEO fixes</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {report.seoChecks
                      .filter((c) => !c.passed)
                      .map((c) => (
                        <li key={c.id}>
                          <span className="font-medium">{c.label}:</span> {c.fixHint ?? c.detail}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              {typeof report.guardrailFlaggedCount === "number" ? (
                <p>Guardrail auto-fixes: {report.guardrailFlaggedCount}</p>
              ) : null}
              {report.guardrailRestructureCount ? (
                <div className="rounded-md bg-amber-50 p-2 text-amber-900">
                  <p className="font-semibold">
                    Guardrail restructure flags ({report.guardrailRestructureCount})
                  </p>
                  <ul className="mt-1 list-disc pl-4">
                    {(report.guardrailRestructurePhrases ?? []).map((phrase) => (
                      <li key={phrase}>{phrase}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {report.outstandingIssues ? (
                <div className="rounded-md bg-amber-50 p-2 text-amber-900">
                  <p className="font-semibold">Outstanding issues remain after repair</p>
                  {outstandingBlockers.length > 0 ? (
                    <ul className="mt-1 list-disc pl-4">
                      {outstandingBlockers.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1">Ship ready is still no — see overlap hits and scores above.</p>
                  )}
                </div>
              ) : null}
              {status === "ready" && hasReadinessFailures ? (
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={readinessBusy}
                    onClick={() => void runFixReadiness()}
                    className="rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-50"
                  >
                    <ButtonBusyLabel
                      busy={readinessBusy}
                      busyLabel="Fixing readiness…"
                      idleLabel="Fix readiness"
                    />
                  </button>
                  {readinessError ? <p className="text-red-600">{readinessError}</p> : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--cc-muted)]">No validation report yet.</p>
          )}
        </div>

        <div className={`${activeTab === "review" ? "" : "hidden"} rounded-lg border border-[var(--cc-line)] p-4`}>
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">
            Overlap hits {report ? `(${report.overlapHits.length})` : ""}
          </h2>
          {report && report.overlapHits.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-3 text-xs">
              {report.overlapHits.map((hit, i) => (
                <li key={i} className="rounded-md bg-red-50 p-2 text-red-900">
                  <p className="font-semibold">
                    {hit.headingA} ↔ {hit.headingB}
                  </p>
                  <p className="mt-1">{hit.sharedClaim}</p>
                  <p className="mt-1 text-red-700">{hit.repairHint}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => scrollToSection(hit.sectionKeyA)}
                      className="rounded-md border border-red-200 bg-white px-2 py-1 font-medium"
                    >
                      Focus {hit.headingA}
                    </button>
                    <button
                      type="button"
                      onClick={() => prepareOverlapFix(hit.sectionKeyB, hit.repairHint)}
                      className="rounded-md bg-red-900 px-2 py-1 font-medium text-white"
                    >
                      Repair {hit.headingB}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-[var(--cc-muted)]">No duplicate problem/solution pairs detected.</p>
          )}
        </div>

        <div className={`${activeTab === "assets" ? "" : "hidden"} rounded-lg border border-[var(--cc-line)] p-4`}>
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Re-Purpose</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Remix the active <span className="font-medium text-[var(--cc-ink)]">{repurposeSourceLabel}</span>{" "}
            tab into LinkedIn, X, email, blog pack, and Meta/Google ads — same channel pack for every
            generate type. Image prompts are separate jobs (§3.1 auto-spawn) — not part of Re-Purpose.
          </p>
          {!canRepurposeContentType(contentType) ? (
            <p className="mt-2 text-xs text-amber-800">
              Switch to a generate draft tab (pillar, blog, tool, email, social, or ads) to
              Re-Purpose.
            </p>
          ) : status !== "ready" ? (
            <p className="mt-2 text-xs text-[var(--cc-muted)]">
              Re-Purpose unlocks when this {repurposeSourceLabel} draft is ready.
            </p>
          ) : (
            <button
              type="button"
              disabled={transformBusy || !canRepurpose}
              onClick={() => void runTransform()}
              className="mt-3 rounded-md bg-[var(--cc-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <ButtonBusyLabel busy={transformBusy} busyLabel="Re-purposing…" idleLabel="Re-Purpose" />
            </button>
          )}
          {transformError ? <p className="mt-2 text-xs text-red-600">{transformError}</p> : null}
          {transformVariants.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3 text-xs">
              {transformVariants.map((v, i) => (
                <li key={i} className="rounded-md bg-black/5 p-2">
                  <p className="font-semibold text-[var(--cc-ink)]">
                    {v.channel} — {v.title}
                  </p>
                  {v.headline ? <p className="text-[var(--cc-muted)]">{v.headline}</p> : null}
                  <p className="mt-1 whitespace-pre-wrap">{v.body}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={`${activeTab === "assets" ? "" : "hidden"} rounded-lg border border-[var(--cc-line)] p-4`}>
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">LinkedIn carousel</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Turn this ready long-form draft into a swipeable PDF (1080×1350 portrait) plus a feed
            caption. Upload the PDF to LinkedIn as a document post.
          </p>
          {!isLongFormContentType(contentType) ? (
            <p className="mt-2 text-xs text-amber-800">
              Switch to a long-form tab (pillar, blog, case study, guide, etc.) to generate a carousel.
            </p>
          ) : status !== "ready" ? (
            <p className="mt-2 text-xs text-[var(--cc-muted)]">
              Carousel unlocks when this {repurposeSourceLabel} draft is ready.
            </p>
          ) : (
            <button
              type="button"
              disabled={carouselBusy || !canLinkedInCarousel}
              onClick={() => void runLinkedInCarousel()}
              className="mt-3 rounded-md bg-[var(--cc-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <ButtonBusyLabel
                busy={carouselBusy}
                busyLabel="Generating…"
                idleLabel={carouselResult?.pdfBase64 ? "Regenerate PDF" : carouselResult ? "Generate downloadable PDF" : "Generate carousel PDF"}
              />
            </button>
          )}
          {carouselError ? <p className="mt-2 text-xs text-red-600">{carouselError}</p> : null}
          {carouselResult ? (
            <div className="mt-3 space-y-2 text-xs">
              <p className="text-[var(--cc-muted)]">
                {carouselResult.slideCount} slides · {carouselResult.suggestedFilename}.pdf
              </p>
              <div className="flex flex-wrap gap-2">
                {carouselResult.pdfBase64 ? (
                  <button
                    type="button"
                    onClick={downloadCarouselPdf}
                    className="rounded-md bg-[var(--cc-accent)] px-2 py-1 font-medium text-white"
                  >
                    Download PDF
                  </button>
                ) : (
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">
                    This older artifact has no persisted PDF bytes. Generate it once to make the download durable.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void copyCarouselCaption()}
                  className="rounded-md border border-[var(--cc-line)] px-2 py-1 text-[var(--cc-ink)]"
                >
                  {captionCopied ? "Caption copied" : "Copy caption"}
                </button>
              </div>
              <p className="whitespace-pre-wrap rounded-md bg-black/5 p-2 text-[var(--cc-ink)]">
                {carouselResult.caption}
              </p>
            </div>
          ) : null}
        </div>

        <div className={`${activeTab === "assets" ? "" : "hidden"} rounded-lg border border-[var(--cc-line)] p-4`}>
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Export</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Download or commit finished drafts for all jobs on this create — pillar, blog, tool, email,
            social, ads, and image prompts — into geekatyourspot&apos;s content-writer-output folder.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exportBusy !== null}
              onClick={() => void runExportZip()}
              className="rounded-md bg-[var(--cc-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <ButtonBusyLabel
                busy={exportBusy === "zip"}
                busyLabel="Exporting…"
                idleLabel="Export .html (.zip)"
              />
            </button>
            <button
              type="button"
              disabled={exportBusy !== null}
              onClick={() => void runExportCommit()}
              className="rounded-md border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-50"
            >
              <ButtonBusyLabel
                busy={exportBusy === "commit"}
                busyLabel="Committing…"
                idleLabel="Commit to geekatyourspot"
              />
            </button>
          </div>
          {exportSummary ? (
            <p className="mt-3 text-xs text-[var(--cc-muted)]">
              Exported {exportSummary.exportedCount} of {exportSummary.totalJobs} job
              {exportSummary.totalJobs === 1 ? "" : "s"}
              {exportSummary.skipped.length > 0
                ? ` (${exportSummary.skipped.length} skipped: ${exportSummary.skipped
                    .map((s) => {
                      const tab = jobs.find((j) => j.id === s.jobId);
                      const label = tab?.tabLabel?.trim() || tab?.contentType || s.contentType;
                      return label;
                    })
                    .join(", ")})`
                : ""}
              .
            </p>
          ) : null}
          {exportResult ? (
            <div className="mt-3 flex flex-col gap-1 text-xs">
              {exportResult.error ? <p className="text-red-600">{exportResult.error}</p> : null}
              {exportResult.commitUrl ? (
                <p>
                  <a
                    href={exportResult.commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--cc-accent)] underline"
                  >
                    View commit
                  </a>
                </p>
              ) : null}
              {exportResult.filePaths && exportResult.filePaths.length > 0 ? (
                <p className="text-[var(--cc-muted)]">
                  {exportResult.filePaths.length} file(s) committed.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {isCmsPublishType(contentType) ? (
        <div className={`${activeTab === "assets" ? "" : "hidden"} rounded-lg border border-[var(--cc-line)] p-4`}>
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Publish to site</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Sync this {labelForContentType(contentType)} draft into the Geek blog CMS. Draft keeps it
            unpublished; live makes it public immediately. Republish updates the same CMS post.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={publishBusy !== null || status !== "ready"}
              onClick={() => void runPublish(false)}
              className="rounded-md border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-50"
            >
              <ButtonBusyLabel
                busy={publishBusy === "draft"}
                busyLabel="Publishing…"
                idleLabel="Publish to CMS (draft)"
              />
            </button>
            <button
              type="button"
              disabled={publishBusy !== null || status !== "ready"}
              onClick={() => void runPublish(true)}
              className="rounded-md bg-[var(--cc-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <ButtonBusyLabel
                busy={publishBusy === "live"}
                busyLabel="Publishing…"
                idleLabel="Publish live"
              />
            </button>
          </div>

          {publishResult ? (
            <div className="mt-3 flex flex-col gap-1 text-xs">
              <p>
                Status:{" "}
                <span
                  className={
                    publishResult.status === "failed"
                      ? "font-semibold text-red-600"
                      : "font-semibold text-green-700"
                  }
                >
                  {publishResult.status}
                </span>
              </p>
              {publishResult.slug ? <p className="text-[var(--cc-muted)]">Slug: {publishResult.slug}</p> : null}
              {publishResult.publicUrl ? (
                <p>
                  <a
                    href={publishResult.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--cc-accent)] underline"
                  >
                    {publishResult.publicUrl}
                  </a>
                </p>
              ) : null}
              {publishResult.warning ? (
                <p className="rounded-md bg-amber-50 p-2 text-amber-900">{publishResult.warning}</p>
              ) : null}
              {publishResult.error ? <p className="text-red-600">{publishResult.error}</p> : null}
            </div>
          ) : null}
        </div>
        ) : null}

        <div className={`${activeTab === "review" ? "" : "hidden"} rounded-lg border border-[var(--cc-line)] p-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--cc-ink)]">AI visibility</h2>
            <button
              type="button"
              disabled={aiVisibilityBusy}
              onClick={() => void runAiVisibilityRefresh()}
              className="rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-50"
            >
              <ButtonBusyLabel busy={aiVisibilityBusy} busyLabel="Refreshing…" idleLabel="Refresh" />
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Readiness for AI answer engines (dual SEO/GEO score) + where this piece is published —
            not a live ChatGPT/Perplexity citation tracker.
          </p>

          {aiVisibilityError ? <p className="mt-2 text-xs text-red-600">{aiVisibilityError}</p> : null}

          {aiVisibility && aiVisibility.ready ? (
            <div className="mt-3 flex flex-col gap-2 text-xs text-[var(--cc-muted)]">
              <p className="text-base font-semibold text-[var(--cc-ink)]">
                Score: {aiVisibility.score}
                <span className="ml-2 text-xs font-normal text-[var(--cc-muted)]">
                  (SEO {aiVisibility.report?.seoScore ?? "—"} / GEO {aiVisibility.report?.geoScore ?? "—"})
                </span>
              </p>

              {aiVisibility.report?.geoChecks && aiVisibility.report.geoChecks.some((c) => !c.passed) ? (
                <ul className="flex flex-col gap-1">
                  {aiVisibility.report.geoChecks
                    .filter((c) => !c.passed)
                    .map((c) => (
                      <li key={c.id}>
                        <span className="font-medium text-[var(--cc-ink)]">{c.label}:</span>{" "}
                        {c.fixHint ?? c.detail}
                      </li>
                    ))}
                </ul>
              ) : (
                <p>All GEO checks pass.</p>
              )}

              <div className="mt-1 border-t border-[var(--cc-line)] pt-2">
                <p className="font-semibold text-[var(--cc-ink)]">Published URLs</p>
                {aiVisibility.report?.publishedUrls && aiVisibility.report.publishedUrls.length > 0 ? (
                  <ul className="mt-1 flex flex-col gap-1">
                    {aiVisibility.report.publishedUrls.map((u, i) => (
                      <li key={i}>
                        <span className="rounded-full bg-black/5 px-2 py-0.5">{u.channel}</span>{" "}
                        {u.publicUrl ? (
                          <a
                            href={u.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--cc-accent)] underline"
                          >
                            {u.publicUrl}
                          </a>
                        ) : (
                          <span>{u.status}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">Not published yet.</p>
                )}
              </div>
            </div>
          ) : aiVisibility && !aiVisibility.ready ? (
            <p className="mt-2 text-xs text-[var(--cc-muted)]">{aiVisibility.message}</p>
          ) : (
            <LoadingRow label="Loading AI visibility…" className="mt-2 text-xs" />
          )}
        </div>
      </aside>
    </div>
    </div>
  );
}

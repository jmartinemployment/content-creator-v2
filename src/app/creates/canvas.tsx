"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { type GccV2JobEvent } from "@/app/auth/job-hub";
import type {
  AiVisibilitySnapshotView,
  BrandKitReadyView,
  CanvasSection,
  ContentRun,
  OutlineSectionView,
  OutlineView,
  ParagraphNode,
  SectionEventPayload,
  SectionNode,
  ValidationReportView,
} from "@/app/creates/canvas-types";
import { SECTION_EVENT_TYPES } from "@/app/creates/canvas-types";
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
import { isCmsPublishType, labelForContentType } from "@/app/creates/content-types";
import { useCreateJobHub } from "@/app/creates/create-job-hub-provider";

type LogEntry = { seq: number; type: string; payload: unknown; atUtc: string };

type CanvasProps = {
  createId: string;
  jobId: string;
};

type CanvasAction = "rewrite" | "expand" | "re-tone";

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

function runsToPlain(runs: ContentRun[]): string {
  return runs.map((r) => r.text).join("");
}

function paragraphToPlain(p: ParagraphNode): string {
  if (p.type === "list") {
    return p.items.map((item) => `• ${runsToPlain(item)}`).join("\n");
  }
  return runsToPlain(p.runs);
}

function normalizeHeadingText(text: string): string {
  return text.trim().replace(/:+$/, "").trim().toLowerCase();
}

function headingsEqual(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  return normalizeHeadingText(a) === normalizeHeadingText(b);
}

/** Models often repeat an H2 as an all-bold paragraph or nested child with the same text. */
function paragraphRepeatsHeading(paragraph: ParagraphNode, heading: string): boolean {
  if (paragraph.type !== "text" || paragraph.runs.length === 0) return false;
  if (!paragraph.runs.every((run) => run.bold)) return false;
  return headingsEqual(paragraphToPlain(paragraph), heading);
}

function sectionToPlain(
  section: SectionNode,
  options: { depth?: number; rootHeading?: string } = {},
): string {
  const depth = options.depth ?? 0;
  const rootHeading = options.rootHeading ?? (depth === 0 ? section.heading : undefined);
  const parts: string[] = [];
  if (depth > 0 && section.heading) parts.push(section.heading);
  for (const p of section.paragraphs) {
    if (depth === 0 && rootHeading && paragraphRepeatsHeading(p, rootHeading)) continue;
    parts.push(paragraphToPlain(p));
  }
  for (const child of section.children) {
    if (rootHeading && headingsEqual(child.heading, rootHeading)) continue;
    parts.push(sectionToPlain(child, { depth: depth + 1, rootHeading }));
  }
  return parts.filter(Boolean).join("\n\n");
}

function canvasSectionsToPlain(sections: CanvasSection[]): string {
  return sections
    .map((s) => {
      const displayHeading = s.section.heading || s.heading;
      const body = sectionToPlain(s.section, { rootHeading: displayHeading });
      return body.startsWith(displayHeading) ? body : `${displayHeading}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}

function runText(run: ContentRun): ReactNode {
  let node: ReactNode = run.text;
  if (run.bold) node = <strong>{node}</strong>;
  if (run.italic) node = <em>{node}</em>;
  if (run.href) node = <a href={run.href} className="underline">{node}</a>;
  return node;
}

function ParagraphView({ paragraph, index }: { paragraph: ParagraphNode; index: number }) {
  if (paragraph.type === "list") {
    const Tag = paragraph.ordered ? "ol" : "ul";
    return (
      <Tag className={paragraph.ordered ? "list-decimal pl-5" : "list-disc pl-5"}>
        {paragraph.items.map((runs, i) => (
          <li key={i}>
            {runs.map((run, j) => (
              <Fragment key={j}>{runText(run)} </Fragment>
            ))}
          </li>
        ))}
      </Tag>
    );
  }

  return (
    <p key={index} className="leading-relaxed">
      {paragraph.runs.map((run, i) => (
        <Fragment key={i}>{runText(run)} </Fragment>
      ))}
    </p>
  );
}

function SectionBody({
  section,
  depth,
  rootHeading,
}: {
  section: SectionNode;
  depth: number;
  rootHeading?: string;
}) {
  const HeadingTag = (section.tag && /^h[1-6]$/.test(section.tag) ? section.tag : "h3") as
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";
  const cardHeading = rootHeading ?? (depth === 0 ? section.heading : undefined);
  const visibleParagraphs = section.paragraphs.filter(
    (p) => !(depth === 0 && cardHeading && paragraphRepeatsHeading(p, cardHeading)),
  );
  const visibleChildren = section.children.filter(
    (child) => !(cardHeading && headingsEqual(child.heading, cardHeading)),
  );

  return (
    <div className={depth > 0 ? "mt-4 border-l-2 border-[var(--cc-line)] pl-4" : undefined}>
      {depth > 0 ? (
        <HeadingTag className="text-base font-semibold text-[var(--cc-ink)]">{section.heading}</HeadingTag>
      ) : null}
      <div className="mt-2 flex flex-col gap-2 text-sm text-[var(--cc-ink)]">
        {visibleParagraphs.map((p, i) => (
          <ParagraphView key={i} paragraph={p} index={i} />
        ))}
      </div>
      {visibleChildren.map((child, i) => (
        <SectionBody key={i} section={child} depth={depth + 1} rootHeading={cardHeading} />
      ))}
    </div>
  );
}

async function callCanvasAction(
  createId: string,
  action: CanvasAction,
  body: { sectionKey: string; text?: string; instruction?: string },
): Promise<void> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/canvas/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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
  seoChecks?: ValidationReportView["seoChecks"];
  geoChecks?: ValidationReportView["geoChecks"];
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
  const { subscribeJobEvents, joinActiveJob, hubError } = useCreateJobHub();
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
  const [publishBusy, setPublishBusy] = useState<"draft" | "live" | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [exportBusy, setExportBusy] = useState<"zip" | "commit" | null>(null);
  const [exportResult, setExportResult] = useState<ExportCommitResult | null>(null);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [aiVisibility, setAiVisibility] = useState<AiVisibilitySnapshotView | null>(null);
  const [aiVisibilityBusy, setAiVisibilityBusy] = useState(false);
  const [aiVisibilityError, setAiVisibilityError] = useState<string | null>(null);
  const [jobHydrating, setJobHydrating] = useState(true);
  const [contentType, setContentType] = useState<string>("blog");

  const lastSeqRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  /** True while the operator has unsaved outline edits — blocks hub OutlineReady from clobbering them. */
  const outlineDirtyRef = useRef(false);

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
      });
      return next;
    });
    setPendingSectionKey((current) => (current === payload.sectionKey ? null : current));
  }, []);

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
          break;
        }
        case "BrandKitAccepted":
          setAwaitingBrandkit(false);
          setAwaitingOutlineApproval(true);
          setStatus("awaiting_outline_approval");
          setKitNotice(null);
          break;
        case "BrandKitRejected":
          setAwaitingBrandkit(true);
          setAwaitingOutlineApproval(false);
          setStatus("awaiting_brandkit_approval");
          setKitNotice(
            "Acceptance cleared — edit description/positioning if needed, then Accept to continue.",
          );
          setError(null);
          break;
        case "OutlineReady": {
          if (outlineDirtyRef.current) break;
          const next = payload as OutlineView;
          setOutline(next);
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
        case "JobCompleted": {
          const p = payload as { status?: string };
          setStatus(p?.status ?? "ready");
          setAwaitingOutlineApproval(false);
          setAwaitingBrandkit(false);
          void runAiVisibilityRefresh();
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
    [applySectionEvent, jobId],
  );

  useEffect(() => {
    lastSeqRef.current = 0;
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
        };
        if (cancelled) return;
        if (job.status) setStatus(job.status);
        if (job.stage) setStage(job.stage);
        if (job.contentType) setContentType(job.contentType.trim().toLowerCase());
        if (job.status === "awaiting_brandkit_approval") {
          setAwaitingBrandkit(true);
          setAwaitingOutlineApproval(false);
        } else if (job.status === "awaiting_outline_approval") {
          setAwaitingBrandkit(false);
          setAwaitingOutlineApproval(true);
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
  }, [jobId]);

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

  async function loadAiVisibility() {
    try {
      const snapshot = await fetchAiVisibility(createId);
      setAiVisibility(snapshot);
      setAiVisibilityError(null);
    } catch (err) {
      setAiVisibilityError(err instanceof Error ? err.message : "Could not load AI visibility");
    }
  }

  async function runAiVisibilityRefresh() {
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
  }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject brand kit");
    } finally {
      setBusy(false);
    }
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
              seoChecks: result.seoChecks ?? prev.seoChecks,
              geoChecks: result.geoChecks ?? prev.geoChecks,
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

  async function runCanvasAction(sectionKey: string, action: CanvasAction) {
    setPendingSectionKey(sectionKey);
    setError(null);
    try {
      await callCanvasAction(createId, action, {
        sectionKey,
        instruction: pendingInstruction[sectionKey]?.trim() || undefined,
      });
      // The Canvas endpoint also emits a job event (SectionRewritten/Expanded/Retoned) which will
      // update this section again via the hub — this direct clear just avoids a stuck spinner if
      // that event is delayed.
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
      setPendingSectionKey((current) => (current === sectionKey ? null : current));
    }
  }

  const isTerminal = status === "ready" || status === "canceled" || status === "failed";
  const canRepurpose = status === "ready" && canRepurposeContentType(contentType);
  const repurposeSourceLabel = labelForContentType(contentType);
  const showBrandKitPanel = awaitingBrandkit || status === "awaiting_brandkit_approval";
  // BrandKit Accept must complete before outline Approve — never show both gates together.
  const showOutlinePanel =
    !showBrandKitPanel &&
    awaitingOutlineApproval &&
    (outline !== null || editableSections.length > 0);
  const showApproveOutline = !showBrandKitPanel && awaitingOutlineApproval;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        {siteUrl ? (
          <p className="text-sm text-[var(--cc-ink)]">
            Writing for: <span className="font-medium">{siteUrl}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--cc-line)] p-3 text-xs text-[var(--cc-muted)]">
          <span className="rounded-full bg-black/5 px-2 py-1 font-mono">job {jobId}</span>
          <span className="rounded-full bg-black/5 px-2 py-1">status: {status}</span>
          {stage ? <span className="rounded-full bg-black/5 px-2 py-1">stage: {stage}</span> : null}

          {showApproveOutline ? (
            <button
              type="button"
              onClick={approveOutline}
              disabled={busy}
              className="ml-auto rounded-md bg-[var(--cc-accent)] px-3 py-1.5 font-semibold text-white disabled:opacity-60"
            >
              <ButtonBusyLabel busy={busy} busyLabel="Saving…" idleLabel="Save & approve outline" />
            </button>
          ) : null}

          {orderedSections.length > 0 ? (
            <button
              type="button"
              onClick={() => void copyAllSections()}
              className={`rounded-md border border-[var(--cc-line)] px-3 py-1.5 font-semibold text-[var(--cc-ink)] ${
                showApproveOutline ? "" : "ml-auto"
              }`}
            >
              {copyAllDone ? "Copied" : "Copy all"}
            </button>
          ) : null}

          {!isTerminal ? (
            <button
              type="button"
              onClick={cancelJob}
              disabled={busy}
              className={`rounded-md border border-[var(--cc-line)] px-3 py-1.5 font-semibold text-[var(--cc-ink)] disabled:opacity-60 ${
                showApproveOutline || orderedSections.length > 0 ? "" : "ml-auto"
              }`}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        {hubError ? (
          <p className="text-xs text-red-600" role="alert">
            {hubError}
          </p>
        ) : null}

        {jobHydrating ? <LoadingRow label="Connecting to job…" /> : null}

        <ProcessBanner status={status} stage={stage} />

        {showBrandKitPanel ? (
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

        {showOutlinePanel ? (
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
            </div>
            <p className="mt-2 text-xs text-[var(--cc-muted)]">
              Assign each section a role (<strong>problem</strong> establishes the pain once;{" "}
              <strong>advance</strong> moves past it). Must-mentions apply only to that section at write
              time. <strong>Save</strong> persists edits; <strong>Save &amp; approve outline</strong> in the
              bar above continues generation.
            </p>
            <ol className="mt-3 flex flex-col gap-3">
              {editableSections.map((s, i) => (
                <li key={s.key || i} className="flex flex-col gap-1.5 rounded-md border border-[var(--cc-line)] p-2">
                  <input
                    type="text"
                    value={s.heading}
                    onChange={(e) => {
                      outlineDirtyRef.current = true;
                      const heading = e.target.value;
                      setEditableSections((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, heading } : row)),
                      );
                    }}
                    className="rounded-md border border-[var(--cc-line)] px-2 py-1.5 text-sm text-[var(--cc-ink)]"
                  />
                  <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--cc-muted)]">
                    <span>Role</span>
                    <select
                      value={s.job}
                      onChange={(e) => {
                        outlineDirtyRef.current = true;
                        const job = e.target.value;
                        setEditableSections((prev) =>
                          prev.map((row, idx) => (idx === i ? { ...row, job } : row)),
                        );
                      }}
                      className="rounded-md border border-[var(--cc-line)] bg-white px-2 py-1 text-xs text-[var(--cc-ink)]"
                    >
                      <option value="problem">problem</option>
                      <option value="advance">advance</option>
                      <option value="faq">faq</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[var(--cc-muted)]">
                    <span>Must mention (one per line)</span>
                    <textarea
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

        {orderedSections.length === 0 &&
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

        {orderedSections.map((s) => {
          const displayHeading = s.section.heading || s.heading;
          return (
          <div key={s.sectionKey} className="rounded-lg border border-[var(--cc-line)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--cc-ink)]">{displayHeading}</h2>
              {s.job ? (
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-[var(--cc-muted)]">
                  {s.job}
                </span>
              ) : null}
              <span className="text-xs text-[var(--cc-muted)]">{s.wordCount} words</span>
              {s.usedFallbackStub ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  fallback stub
                </span>
              ) : null}
            </div>

            <SectionBody section={s.section} depth={0} rootHeading={displayHeading} />

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--cc-line)] pt-3">
              <input
                type="text"
                placeholder="Optional instruction…"
                value={pendingInstruction[s.sectionKey] ?? ""}
                onChange={(e) =>
                  setPendingInstruction((prev) => ({ ...prev, [s.sectionKey]: e.target.value }))
                }
                className="min-w-0 flex-1 rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs"
              />
              {(["rewrite", "expand", "re-tone"] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => runCanvasAction(s.sectionKey, action)}
                  disabled={pendingSectionKey === s.sectionKey}
                  className="rounded-md border border-[var(--cc-line)] px-3 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-60"
                >
                  <ButtonBusyLabel
                    busy={pendingSectionKey === s.sectionKey}
                    busyLabel="Working…"
                    idleLabel={action}
                  />
                </button>
              ))}
            </div>
          </div>
          );
        })}

        <details className="rounded-lg border border-[var(--cc-line)] p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-[var(--cc-ink)]">
            Event log ({log.length})
          </summary>
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
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-[var(--cc-line)] p-4">
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
                <p className="font-semibold text-amber-700">Outstanding issues remain after repair.</p>
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

        <div className="rounded-lg border border-[var(--cc-line)] p-4">
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-[var(--cc-muted)]">No duplicate problem/solution pairs detected.</p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--cc-line)] p-4">
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

        <div className="rounded-lg border border-[var(--cc-line)] p-4">
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
                ? ` (${exportSummary.skipped.length} skipped — still running or no result yet)`
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
        <div className="rounded-lg border border-[var(--cc-line)] p-4">
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

        <div className="rounded-lg border border-[var(--cc-line)] p-4">
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
  );
}

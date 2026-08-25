"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { HubConnection } from "@microsoft/signalr";
import {
  createJobHubConnection,
  joinJob,
  onJobEvent,
  type GccV2JobEvent,
} from "@/app/auth/job-hub";
import type {
  AiVisibilitySnapshotView,
  CanvasSection,
  ContentRun,
  OutlineView,
  ParagraphNode,
  SectionEventPayload,
  SectionNode,
  ValidationReportView,
} from "@/app/creates/canvas-types";
import { SECTION_EVENT_TYPES } from "@/app/creates/canvas-types";

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

function SectionBody({ section, depth }: { section: SectionNode; depth: number }) {
  const HeadingTag = (section.tag && /^h[1-6]$/.test(section.tag) ? section.tag : "h3") as
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";

  return (
    <div className={depth > 0 ? "mt-4 border-l-2 border-[var(--cc-line)] pl-4" : undefined}>
      {depth > 0 ? (
        <HeadingTag className="text-base font-semibold text-[var(--cc-ink)]">{section.heading}</HeadingTag>
      ) : null}
      <div className="mt-2 flex flex-col gap-2 text-sm text-[var(--cc-ink)]">
        {section.paragraphs.map((p, i) => (
          <ParagraphView key={i} paragraph={p} index={i} />
        ))}
      </div>
      {section.children.map((child, i) => (
        <SectionBody key={i} section={child} depth={depth + 1} />
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

async function callPublish(createId: string, isPublished: boolean): Promise<PublishResult> {
  const res = await fetch(`/api/gcc-v2/creates/${createId}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ isPublished }),
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

/**
 * Phase 5 Canvas: streamed WRITE/REPAIR sections in the main column (no polling — everything comes
 * from `SectionDrafted`/`SectionRepaired`/... hub events), SEO/polish scores + named OverlapGate
 * hits in the right rail from `ValidationReport`, outline approval, and per-section
 * rewrite/expand/re-tone actions against the sync Canvas API.
 */
export function Canvas({ createId, jobId }: CanvasProps) {
  const [status, setStatus] = useState<string>("pending");
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [outline, setOutline] = useState<OutlineView | null>(null);
  const [sections, setSections] = useState<Map<string, CanvasSection>>(new Map());
  const [report, setReport] = useState<ValidationReportView | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingSectionKey, setPendingSectionKey] = useState<string | null>(null);
  const [pendingInstruction, setPendingInstruction] = useState<Record<string, string>>({});
  const [transformBusy, setTransformBusy] = useState(false);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [transformVariants, setTransformVariants] = useState<
    Array<{ channel: string; title: string; body: string; headline?: string | null }>
  >([]);
  const [publishBusy, setPublishBusy] = useState<"draft" | "live" | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [aiVisibility, setAiVisibility] = useState<AiVisibilitySnapshotView | null>(null);
  const [aiVisibilityBusy, setAiVisibilityBusy] = useState(false);
  const [aiVisibilityError, setAiVisibilityError] = useState<string | null>(null);

  const connectionRef = useRef<HubConnection | null>(null);
  const lastSeqRef = useRef(0);

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
      if (evt.seq <= lastSeqRef.current) return;
      lastSeqRef.current = evt.seq;

      const payload = safeParse(evt.payloadJson) ?? evt.payloadJson;
      setLog((prev) => [...prev, { seq: evt.seq, type: evt.type, payload, atUtc: evt.createdAtUtc }]);

      switch (evt.type) {
        case "JobStageChanged":
          setStage((payload as { stage?: string })?.stage ?? null);
          break;
        case "OutlineReady":
          setOutline(payload as OutlineView);
          setAwaitingApproval(true);
          break;
        case "OutlineApproved":
          setAwaitingApproval(false);
          setStatus("running");
          break;
        case "ValidationReport":
          setReport(payload as ValidationReportView);
          break;
        case "JobCompleted": {
          const p = payload as { status?: string };
          setStatus(p?.status ?? "ready");
          setAwaitingApproval(false);
          void runAiVisibilityRefresh();
          break;
        }
        case "JobCanceled":
          setStatus("canceled");
          setAwaitingApproval(false);
          break;
        case "JobFailed":
          setStatus("failed");
          setError((payload as { error?: string })?.error ?? "Job failed");
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
    [applySectionEvent],
  );

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      const connection = createJobHubConnection();
      connectionRef.current = connection;
      onJobEvent(connection, appendEvent);
      try {
        await joinJob(connection, jobId, 0);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not connect to job");
      }
    }
    connect();
    return () => {
      cancelled = true;
      connectionRef.current?.stop();
      connectionRef.current = null;
    };
    // Reconnect only when the job identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function approveOutline() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gcc-v2/jobs/${jobId}/approve-outline`, { method: "POST" });
      if (!res.ok) throw new Error(`approve failed: HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve outline");
    } finally {
      setBusy(false);
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
        body: JSON.stringify({ channels: ["linkedin", "x", "email"] }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`transform failed: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
      }
      const data = (await res.json()) as {
        variants?: Array<{ channel: string; title: string; body: string; headline?: string | null }>;
      };
      setTransformVariants(data.variants ?? []);
    } catch (err) {
      setTransformError(err instanceof Error ? err.message : "Transform failed");
    } finally {
      setTransformBusy(false);
    }
  }

  async function runPublish(isPublished: boolean) {
    setPublishBusy(isPublished ? "live" : "draft");
    try {
      const result = await callPublish(createId, isPublished);
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--cc-line)] p-3 text-xs text-[var(--cc-muted)]">
          <span className="rounded-full bg-black/5 px-2 py-1 font-mono">job {jobId}</span>
          <span className="rounded-full bg-black/5 px-2 py-1">status: {status}</span>
          {stage ? <span className="rounded-full bg-black/5 px-2 py-1">stage: {stage}</span> : null}

          {awaitingApproval ? (
            <button
              type="button"
              onClick={approveOutline}
              disabled={busy}
              className="ml-auto rounded-md bg-[var(--cc-accent)] px-3 py-1.5 font-semibold text-white disabled:opacity-60"
            >
              Approve outline
            </button>
          ) : null}

          {!isTerminal ? (
            <button
              type="button"
              onClick={cancelJob}
              disabled={busy}
              className={`rounded-md border border-[var(--cc-line)] px-3 py-1.5 font-semibold text-[var(--cc-ink)] disabled:opacity-60 ${
                awaitingApproval ? "" : "ml-auto"
              }`}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        {awaitingApproval && outline ? (
          <div className="rounded-lg border border-[var(--cc-line)] p-4">
            <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Outline awaiting approval</h2>
            <ol className="mt-2 flex flex-col gap-1 text-sm text-[var(--cc-muted)]">
              {outline.sections.map((s) => (
                <li key={s.key}>
                  {s.heading} <span className="text-xs">({s.job})</span>
                  {s.hierarchyChildHeadings.length > 0 ? (
                    <ul className="ml-4 mt-0.5 list-disc text-xs text-[var(--cc-muted)]/80">
                      {s.hierarchyChildHeadings.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {orderedSections.length === 0 && !awaitingApproval ? (
          <p className="text-sm text-[var(--cc-muted)]">
            Waiting for the first section to be drafted…
          </p>
        ) : null}

        {orderedSections.map((s) => (
          <div key={s.sectionKey} className="rounded-lg border border-[var(--cc-line)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--cc-ink)]">{s.heading}</h2>
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

            <SectionBody section={s.section} depth={0} />

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
                  {pendingSectionKey === s.sectionKey ? "Working…" : action}
                </button>
              ))}
            </div>
          </div>
        ))}

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
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Channel transform</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Repurpose the completed draft into LinkedIn, X, and email snippets (sync — no job poll).
          </p>
          <button
            type="button"
            disabled={transformBusy || status !== "ready"}
            onClick={() => void runTransform()}
            className="mt-3 rounded-md bg-[var(--cc-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {transformBusy ? "Transforming…" : "Run transform"}
          </button>
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
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Publish to CMS</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Sync this draft into the Geek blog CMS. Draft keeps it unpublished; live makes it public
            immediately.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={publishBusy !== null || status !== "ready"}
              onClick={() => void runPublish(false)}
              className="rounded-md border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-50"
            >
              {publishBusy === "draft" ? "Publishing…" : "Publish to CMS (draft)"}
            </button>
            <button
              type="button"
              disabled={publishBusy !== null || status !== "ready"}
              onClick={() => void runPublish(true)}
              className="rounded-md bg-[var(--cc-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {publishBusy === "live" ? "Publishing…" : "Publish live"}
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

        <div className="rounded-lg border border-[var(--cc-line)] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--cc-ink)]">AI visibility</h2>
            <button
              type="button"
              disabled={aiVisibilityBusy}
              onClick={() => void runAiVisibilityRefresh()}
              className="rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-50"
            >
              {aiVisibilityBusy ? "Refreshing…" : "Refresh"}
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
            <p className="mt-2 text-xs text-[var(--cc-muted)]">Loading…</p>
          )}
        </div>
      </aside>
    </div>
  );
}

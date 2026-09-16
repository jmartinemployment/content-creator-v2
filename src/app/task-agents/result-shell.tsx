"use client";

import Link from "next/link";
import {
  createPrefillFromArtifactPayload,
  createPrefillSearchParams,
} from "@/app/creates/create-prefill";
import type { ContentType } from "@/app/creates/content-types";
import { TaskAgentResultRenderer } from "@/app/task-agents/result-renderers";

export type ResultLineageNode = {
  artifactVersionId: string;
  versionNumber?: number;
  digest?: string;
  parents?: Array<{
    parentArtifactVersionId: string;
    relationship?: string;
    createdAtUtc?: string;
  }>;
  children?: Array<{
    childArtifactVersionId: string;
    relationship?: string;
    createdAtUtc?: string;
  }>;
};

export type ResultNextAction = {
  /** Task-agent follow-on. Omit when only `create` is set. */
  capabilityId?: string;
  label: string;
  artifactType?: string;
  relationship?: string;
  /** M3: deep-link into Create with a content type (+ topic from artifact when known). */
  create?: {
    contentType: string;
  };
};

export type ResultChangeOverTime = {
  available: boolean;
  priorRunId?: string | null;
  priorCompletedAtUtc?: string | null;
  subjectKey?: string | null;
  currentOverall?: number | null;
  priorOverall?: number | null;
  overallDelta?: number | null;
  dimensions?: Array<{
    dimension: string;
    current?: number | null;
    prior?: number | null;
    delta?: number | null;
  }>;
  findings?: Array<{
    key: string;
    change: string;
    currentPriority?: string | null;
    priorPriority?: string | null;
    summary?: string;
  }>;
  message?: string;
};

export type ResultShellModel = {
  contractVersion: string;
  identity: { displayName: string; objective: string; capabilityId?: string };
  progress: { status: string; phase: string; progressPercent: number };
  sharedContext?: {
    contextManifestId?: string | null;
    contextManifestDigest?: string | null;
  } | null;
  lineage?: ResultLineageNode[];
  nextActions?: ResultNextAction[];
  compatibleNextActions?: unknown;
  changeOverTime?: ResultChangeOverTime | null;
  artifacts: Array<{
    id: string;
    artifactType: string;
    versions: Array<{
      id: string;
      payloadJson: string;
      evidenceJson: string;
      citationsJson: string;
      digest: string;
      validationState: string;
      parents?: ResultLineageNode["parents"];
    }>;
  }>;
  snapshot?: {
    taskAgentVersionDigest?: string;
    inputDigest?: string;
    sourceSnapshotDigest?: string;
    rootRunId?: string;
    retryOfRunId?: string | null;
  };
  rerun: {
    capabilityId: string;
    versionId: string;
    retryOfRunId: string;
    parentArtifactVersionIds?: string[];
  };
};

const FALLBACK_NEXT: Record<string, ResultNextAction[]> = {
  "ai-readiness": [
    { label: "Write blog in Create", create: { contentType: "blog" } },
    { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
    { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
    { capabilityId: "citable-claims", label: "Citable Claims", artifactType: "claimLedger.v1" },
  ],
  "faq-generator": [
    { label: "Write FAQ blog in Create", create: { contentType: "blog" } },
    { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
  ],
  "citable-claims": [
    { label: "Write citeable blog in Create", create: { contentType: "blog" } },
    { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
  ],
  "query-planner": [
    { label: "Write blog in Create", create: { contentType: "blog" } },
    { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
    { capabilityId: "pillar-outline", label: "Pillar Article Outline", artifactType: "pillarOutline.v1" },
  ],
  "comparison-brief": [
    { label: "Write comparison in Create", create: { contentType: "comparison" } },
    { capabilityId: "competitive-response", label: "Competitive Response", artifactType: "competitiveResponse.v1" },
    { capabilityId: "citable-claims", label: "Citable Claims", artifactType: "claimLedger.v1" },
  ],
  "pillar-outline": [
    { label: "Write pillar in Create", create: { contentType: "pillar" } },
    { capabilityId: "pillar-article", label: "Pillar Article", artifactType: "pillarArticle.v1" },
    { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
    { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
  ],
  "pillar-article": [
    { label: "Continue pillar in Create", create: { contentType: "pillar" } },
    { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
    { capabilityId: "comparison-brief", label: "Comparison Brief", artifactType: "comparisonBrief.v1" },
    { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
  ],
  "competitive-response": [
    { label: "Write alternatives in Create", create: { contentType: "alternatives" } },
    { capabilityId: "citable-claims", label: "Citable Claims", artifactType: "claimLedger.v1" },
    { capabilityId: "comparison-brief", label: "Comparison Brief", artifactType: "comparisonBrief.v1" },
  ],
  "content-gap": [
    { label: "Write blog in Create", create: { contentType: "blog" } },
  ],
};

function shortId(value: string | undefined | null) {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function hrefForNextAction(
  action: ResultNextAction,
  opts: { fromArtifactId?: string; fromRunId: string; payload: Record<string, unknown> | null },
): string | null {
  if (action.create) {
    const prefill = {
      ...createPrefillFromArtifactPayload(opts.payload),
      contentType: action.create.contentType as ContentType,
    };
    return `/creates/new?${createPrefillSearchParams(prefill).toString()}`;
  }
  if (!action.capabilityId) return null;
  if (opts.fromArtifactId) {
    return `/task-agents/${encodeURIComponent(action.capabilityId)}?fromArtifactVersionId=${encodeURIComponent(opts.fromArtifactId)}&fromRunId=${encodeURIComponent(opts.fromRunId)}&lineageRelationship=derived-from`;
  }
  return `/task-agents/${encodeURIComponent(action.capabilityId)}`;
}

function resolveNextActions(result: ResultShellModel): ResultNextAction[] {
  const capabilityId = result.rerun.capabilityId || result.identity.capabilityId || "";
  const fallback = FALLBACK_NEXT[capabilityId] ?? [];
  const server = Array.isArray(result.nextActions) ? result.nextActions : [];
  if (server.length === 0) return fallback;

  // Server actions used to wipe Create handoffs — merge Create entries from fallback/API.
  const createTypes = new Set(
    server
      .map((action) => action.create?.contentType)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  const missingCreate = fallback.filter(
    (action) => action.create && !createTypes.has(action.create.contentType),
  );
  return [...missingCreate, ...server];
}

type TaskAgentResultShellProps = {
  result: ResultShellModel;
  rendererKind?: string;
  rendererArtifactType?: string;
  onRerun: () => void;
};

export function TaskAgentResultShell({
  result,
  rendererKind,
  rendererArtifactType,
  onRerun,
}: TaskAgentResultShellProps) {
  const artifact = result.artifacts[0];
  const artifactVersion = artifact?.versions.at(-1);
  const payload = artifactVersion
    ? JSON.parse(artifactVersion.payloadJson) as Record<string, unknown>
    : null;
  const lineageNodes = result.lineage?.length
    ? result.lineage
    : (artifactVersion
      ? [{
        artifactVersionId: artifactVersion.id,
        digest: artifactVersion.digest,
        versionNumber: artifact?.versions.length,
        parents: artifactVersion.parents,
      }]
      : []);
  const current = lineageNodes.at(-1);
  const parents = current?.parents ?? [];
  const nextActions = resolveNextActions(result);
  const fromArtifactId = artifactVersion?.id;
  const contextDigest = result.sharedContext?.contextManifestDigest;
  const payloadWarnings = Array.isArray(payload?.warnings)
    ? payload.warnings.filter((entry): entry is string => typeof entry === "string")
    : [];
  const staleEvidenceWarning = payloadWarnings.find((warning) =>
    /stale/i.test(warning) && /evidence/i.test(warning)
  );


  if (!artifact || !artifactVersion || !payload) {
    return (
      <p role="status" className="mt-5 rounded-lg border border-[var(--cc-line)] bg-white p-5 text-sm text-[var(--cc-muted)]">
        This run finished without a typed artifact.
      </p>
    );
  }

  return (
    <section
      aria-label="Task result"
      className="ta-result mt-6 overflow-hidden rounded-2xl border border-[var(--cc-line)] bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]"
    >
      <header className="border-b border-[var(--cc-line)] px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-sm font-medium text-[var(--cc-accent)]">Result</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--cc-ink)] sm:text-3xl">
              {result.identity.displayName}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--cc-muted)]">
              {result.identity.objective}
            </p>
          </div>
          <button
            type="button"
            onClick={onRerun}
            className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold text-[var(--cc-ink)] transition hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)]"
          >
            Run again
          </button>
        </div>
        {staleEvidenceWarning ? (
          <p
            role="status"
            data-testid="stale-evidence-warning"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            {staleEvidenceWarning} Do not treat these findings as fresh until evidence is refreshed.
          </p>
        ) : null}
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="border-b border-[var(--cc-line)] px-5 py-6 sm:px-7 lg:border-b-0 lg:border-r">
          {result.changeOverTime?.available ? (
            <div
              className="mb-5 border-l-2 border-[var(--cc-accent)] pl-3"
              data-testid="change-over-time"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-muted)]">
                Since last run
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--cc-ink)]">
                {typeof result.changeOverTime.overallDelta === "number"
                  ? `${result.changeOverTime.overallDelta > 0 ? "+" : ""}${result.changeOverTime.overallDelta} overall`
                  : (result.changeOverTime.findings?.length
                    ? "Findings changed"
                    : "Compared")}
                {typeof result.changeOverTime.priorOverall === "number"
                  ? ` · was ${result.changeOverTime.priorOverall}`
                  : ""}
              </p>
              {result.changeOverTime.message ? (
                <p className="mt-1 text-xs text-[var(--cc-muted)]">{result.changeOverTime.message}</p>
              ) : null}
              {result.changeOverTime.findings?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-[var(--cc-muted)]" data-testid="change-over-time-findings">
                  {result.changeOverTime.findings.slice(0, 5).map((finding) => (
                    <li key={`${finding.change}-${finding.key}`}>
                      <span className="font-semibold text-[var(--cc-ink)]">{finding.change}</span>
                      {finding.summary ? ` · ${finding.summary}` : ""}
                      {finding.change === "priorityChanged"
                        && finding.priorPriority
                        && finding.currentPriority
                        ? ` (${finding.priorPriority} → ${finding.currentPriority})`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <TaskAgentResultRenderer
            kind={rendererKind}
            artifactType={rendererArtifactType ?? artifact.artifactType}
            payload={payload}
            digest={artifactVersion.digest}
            validationState={artifactVersion.validationState}
          />
        </div>

        <aside
          aria-label="Provenance"
          className="bg-[color-mix(in_srgb,var(--cc-paper)_88%,white)] px-5 py-6 sm:px-6"
        >
          <h3 className="text-sm font-semibold text-[var(--cc-ink)]">Provenance</h3>
          <ol className="ta-lineage mt-4 space-y-0" data-testid="artifact-lineage">
            {parents.length === 0 ? (
              <li className="ta-lineage-step">
                <span className="ta-lineage-dot" aria-hidden="true" />
                <p className="text-xs font-semibold text-[var(--cc-ink)]">Origin</p>
                <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-[var(--cc-muted)]">
                  {shortId(artifactVersion.id)}
                </p>
              </li>
            ) : (
              parents.map((parent, index) => (
                <li key={parent.parentArtifactVersionId} className="ta-lineage-step">
                  <span className="ta-lineage-dot" aria-hidden="true" />
                  <p className="text-xs font-semibold text-[var(--cc-ink)]">
                    {index + 1}. Parent · {parent.relationship || "derived-from"}
                  </p>
                  <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-[var(--cc-muted)]">
                    {shortId(parent.parentArtifactVersionId)}
                  </p>
                </li>
              ))
            )}
            <li className="ta-lineage-step" data-current="true">
              <span className="ta-lineage-dot" aria-hidden="true" />
              <p className="text-xs font-semibold text-[var(--cc-accent)]">
                {parents.length + 1}. This artifact
              </p>
              <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-[var(--cc-muted)]">
                {shortId(artifactVersion.digest)}
              </p>
            </li>
          </ol>

          <dl className="mt-6 space-y-3 border-t border-[var(--cc-line)] pt-4 text-xs">
            {contextDigest ? (
              <div>
                <dt className="font-semibold text-[var(--cc-ink)]">Context digest</dt>
                <dd className="mt-1 break-all font-mono text-[0.7rem] text-[var(--cc-muted)]" data-testid="result-context-digest">
                  {contextDigest}
                </dd>
              </div>
            ) : null}
            {result.snapshot?.rootRunId ? (
              <div>
                <dt className="font-semibold text-[var(--cc-ink)]">Root run</dt>
                <dd className="mt-1 font-mono text-[0.7rem] text-[var(--cc-muted)]" data-testid="result-root-run-id">
                  {shortId(result.snapshot.rootRunId)}
                </dd>
              </div>
            ) : null}
            {result.snapshot?.retryOfRunId ? (
              <div>
                <dt className="font-semibold text-[var(--cc-ink)]">Retry of</dt>
                <dd className="mt-1 font-mono text-[0.7rem] text-[var(--cc-muted)]">
                  {shortId(result.snapshot.retryOfRunId)}
                </dd>
              </div>
            ) : null}
            {result.snapshot?.inputDigest ? (
              <div>
                <dt className="font-semibold text-[var(--cc-ink)]">Input digest</dt>
                <dd className="mt-1 font-mono text-[0.7rem] text-[var(--cc-muted)]" data-testid="result-input-digest">
                  {shortId(result.snapshot.inputDigest)}
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>

      <footer className="border-t border-[var(--cc-line)] px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cc-ink)]">Continue with</h3>
            <p className="mt-1 max-w-xl text-xs text-[var(--cc-muted)]">
              Open Create for a citeable draft, or a compatible task agent that accepts this artifact.
            </p>
          </div>
        </div>
        {nextActions.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" data-testid="next-actions">
            {nextActions.map((action) => {
              const href = hrefForNextAction(action, {
                fromArtifactId,
                fromRunId: result.rerun.retryOfRunId,
                payload,
              });
              if (!href) return null;
              const key = action.create
                ? `create:${action.create.contentType}:${action.label}`
                : action.capabilityId ?? action.label;
              return (
                <li key={key}>
                  <Link
                    href={href}
                    className="inline-flex min-h-11 items-center rounded-lg border border-[var(--cc-line)] bg-[var(--cc-paper)] px-3.5 py-2 text-sm font-semibold text-[var(--cc-ink)] transition hover:border-[var(--cc-accent)] hover:bg-white hover:text-[var(--cc-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)]"
                  >
                    {action.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-[var(--cc-muted)]">No compatible follow-on agents are declared for this result.</p>
        )}
      </footer>
    </section>
  );
}

"use client";

import Link from "next/link";
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
  capabilityId: string;
  label: string;
  artifactType?: string;
  relationship?: string;
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
    { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
    { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
    { capabilityId: "citable-claims", label: "Citable Claims", artifactType: "claimLedger.v1" },
  ],
  "faq-generator": [
    { capabilityId: "schema-markup", label: "Schema Markup", artifactType: "schemaMarkup.v1" },
  ],
  "citable-claims": [
    { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
  ],
  "query-planner": [
    { capabilityId: "faq-generator", label: "FAQ Generator", artifactType: "faqSet.v1" },
    { capabilityId: "pillar-outline", label: "Pillar Article Outline", artifactType: "pillarOutline.v1" },
  ],
};

function shortId(value: string | undefined | null) {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function resolveNextActions(result: ResultShellModel): ResultNextAction[] {
  if (Array.isArray(result.nextActions) && result.nextActions.length > 0) {
    return result.nextActions;
  }
  const capabilityId = result.rerun.capabilityId || result.identity.capabilityId || "";
  return FALLBACK_NEXT[capabilityId] ?? [];
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
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="border-b border-[var(--cc-line)] px-5 py-6 sm:px-7 lg:border-b-0 lg:border-r">
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
                <dd className="mt-1 font-mono text-[0.7rem] text-[var(--cc-muted)]">
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
              Open a compatible agent that can accept this artifact type. The new run keeps a derived-from link.
            </p>
          </div>
        </div>
        {nextActions.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" data-testid="next-actions">
            {nextActions.map((action) => {
              const href = fromArtifactId
                ? `/task-agents/${encodeURIComponent(action.capabilityId)}?fromArtifactVersionId=${encodeURIComponent(fromArtifactId)}&fromRunId=${encodeURIComponent(result.rerun.retryOfRunId)}&lineageRelationship=derived-from`
                : `/task-agents/${encodeURIComponent(action.capabilityId)}`;
              return (
                <li key={action.capabilityId}>
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

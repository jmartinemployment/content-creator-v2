"use client";

type ArtifactPayload = Record<string, unknown>;

type ResultRendererProps = {
  kind?: string;
  artifactType?: string;
  payload: ArtifactPayload;
  digest?: string;
  validationState?: string;
};

function ScorecardView({ payload }: { payload: ArtifactPayload }) {
  const score = payload.overallScore;
  const numeric = typeof score === "number" ? score : Number(score);
  const dimensions = Array.isArray(payload.dimensions) ? payload.dimensions : [];
  const fixes = Array.isArray(payload.prioritizedFixes) ? payload.prioritizedFixes : [];
  return (
    <div className="mt-2">
      <p className="text-sm text-[var(--cc-muted)]">Overall readiness</p>
      <p className="mt-1 font-semibold tabular-nums tracking-tight text-[var(--cc-ink)]" style={{ fontSize: "clamp(2.75rem, 6vw, 4.5rem)", lineHeight: 1 }}>
        {Number.isFinite(numeric) ? numeric : "—"}
      </p>
      {dimensions.length ? (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2" aria-label="Readiness dimensions">
          {dimensions.map((entry) => {
            const row = entry as { dimension?: string; score?: number | null; explanation?: string };
            const dimScore = typeof row.score === "number" ? row.score : Number(row.score);
            return (
              <li key={row.dimension} className="border-l-2 border-[var(--cc-line)] pl-3 text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{row.dimension}</span>
                <span className="ml-2 tabular-nums text-[var(--cc-muted)]">
                  {Number.isFinite(dimScore) ? dimScore : "—"}
                </span>
                {row.explanation ? (
                  <span className="mt-0.5 block text-xs text-[var(--cc-muted)]">{row.explanation}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {fixes.length ? (
        <ul className="mt-6 space-y-2" aria-label="Prioritized fixes">
          {fixes.slice(0, 5).map((fix, index) => {
            if (typeof fix === "string") {
              return (
                <li key={fix} className="border-l-2 border-[var(--cc-accent)] pl-3 text-sm">
                  <span className="font-semibold text-[var(--cc-ink)]">{fix}</span>
                </li>
              );
            }
            const row = fix as { title?: string; summary?: string };
            return (
              <li key={row.title || row.summary || index} className="border-l-2 border-[var(--cc-accent)] pl-3 text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{row.title || "Fix"}</span>
                {row.summary ? <span className="mt-0.5 block text-[var(--cc-muted)]">{row.summary}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ClaimAuditView({ payload }: { payload: ArtifactPayload }) {
  const score = payload.overallScore;
  const numeric = typeof score === "number" ? score : Number(score);
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const claims = Array.isArray(payload.claims) ? payload.claims : [];
  const unsupportedIds = new Set(
    (Array.isArray(payload.unsupportedClaimIds) ? payload.unsupportedClaimIds : [])
      .filter((id): id is string => typeof id === "string"),
  );
  const unsupported = claims.filter((claim) => {
    const row = claim as { claimId?: string; verificationStatus?: string };
    return row.verificationStatus === "unsupported"
      || (row.claimId != null && unsupportedIds.has(row.claimId));
  });

  return (
    <div className="mt-2">
      <p className="text-sm text-[var(--cc-muted)]">Fact density</p>
      <p className="mt-1 font-semibold tabular-nums tracking-tight text-[var(--cc-ink)]" style={{ fontSize: "clamp(2.75rem, 6vw, 4.5rem)", lineHeight: 1 }}>
        {Number.isFinite(numeric) ? numeric : "—"}
      </p>
      {unsupported.length ? (
        <aside
          aria-label="Unsupported claims"
          className="mt-5 border-l-2 border-amber-600 bg-amber-50/70 px-3 py-3"
          data-testid="unsupported-claims"
        >
          <p className="text-sm font-semibold text-amber-950">Unsupported specific claims</p>
          <ul className="mt-2 space-y-2">
            {unsupported.slice(0, 8).map((claim) => {
              const row = claim as { claimId?: string; text?: string; claimText?: string };
              return (
                <li key={row.claimId || row.text || row.claimText} className="text-sm text-amber-950/90">
                  {row.text || row.claimText}
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}
      {sections.length ? (
        <ul className="mt-6 space-y-3" aria-label="Section density">
          {sections.map((section) => {
            const row = section as {
              sectionId?: string;
              heading?: string;
              score?: number | null;
              specificFactCount?: number;
              supportedFactCount?: number;
              sentenceCount?: number;
            };
            const sectionScore = typeof row.score === "number" ? row.score : Number(row.score);
            return (
              <li key={row.sectionId || row.heading} className="border-l-2 border-[var(--cc-accent)]/40 pl-3 text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{row.heading || "Section"}</span>
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                  {[
                    Number.isFinite(sectionScore) ? `score ${sectionScore}` : null,
                    row.specificFactCount != null ? `${row.specificFactCount} specific` : null,
                    row.supportedFactCount != null ? `${row.supportedFactCount} supported` : null,
                    row.sentenceCount != null ? `${row.sentenceCount} sentences` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function EntityGraphView({ payload }: { payload: ArtifactPayload }) {
  const entities = Array.isArray(payload.entities) ? payload.entities : [];
  const relationships = Array.isArray(payload.relationships) ? payload.relationships : [];
  const nameById = new Map(
    entities.map((entry) => {
      const row = entry as { entityId?: string; canonicalName?: string };
      return [row.entityId ?? "", row.canonicalName ?? row.entityId ?? ""] as const;
    }),
  );

  return (
    <div className="mt-4">
      <ul className="space-y-4" aria-label="Canonical entities">
        {entities.map((entry) => {
          const row = entry as {
            entityId?: string;
            canonicalName?: string;
            entityType?: string;
            confidence?: number;
            aliases?: string[];
          };
          return (
            <li key={row.entityId || row.canonicalName} className="border-l-2 border-[var(--cc-accent)] pl-3">
              <p className="font-semibold text-[var(--cc-ink)]">{row.canonicalName}</p>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                {[row.entityType, row.confidence != null ? `confidence ${row.confidence}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {Array.isArray(row.aliases) && row.aliases.length ? (
                <p className="mt-1 text-xs text-[var(--cc-muted)]">
                  Aliases: {row.aliases.join(", ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {relationships.length ? (
        <ul className="mt-6 space-y-2" aria-label="Entity relationships">
          {relationships.map((entry) => {
            const row = entry as {
              relationshipId?: string;
              sourceEntityId?: string;
              targetEntityId?: string;
              relation?: string;
              confidence?: number;
            };
            const source = nameById.get(row.sourceEntityId ?? "") || row.sourceEntityId;
            const target = nameById.get(row.targetEntityId ?? "") || row.targetEntityId;
            return (
              <li key={row.relationshipId || `${source}-${target}`} className="text-sm text-[var(--cc-ink)]">
                <span className="font-semibold">{source}</span>
                <span className="mx-2 text-[var(--cc-muted)]">{row.relation || "related to"}</span>
                <span className="font-semibold">{target}</span>
                {row.confidence != null ? (
                  <span className="ml-2 text-xs text-[var(--cc-muted)]">{row.confidence}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function JsonLdView({ payload }: { payload: ArtifactPayload }) {
  const nodes = Array.isArray(payload.jsonLd) ? payload.jsonLd : [];
  const validation = Array.isArray(payload.validation) ? payload.validation : [];
  return (
    <div className="mt-4 space-y-5">
      {validation.length ? (
        <ul className="space-y-2" aria-label="Schema validation">
          {validation.map((entry, index) => {
            const row = entry as {
              code?: string;
              schemaType?: string;
              valid?: boolean;
              detail?: string;
            };
            return (
              <li
                key={`${row.code || "finding"}-${index}`}
                className={`border-l-2 pl-3 text-sm ${row.valid === false ? "border-amber-600" : "border-[var(--cc-accent)]/40"}`}
                data-schema-valid={row.valid === false ? "false" : "true"}
              >
                <span className="font-semibold text-[var(--cc-ink)]">
                  {row.schemaType || "Schema"}{row.code ? ` · ${row.code}` : ""}
                </span>
                {row.detail ? (
                  <span className="mt-0.5 block text-[var(--cc-muted)]">{row.detail}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {nodes.length ? (
        <ul className="space-y-3" aria-label="Generated JSON-LD">
          {nodes.map((node, index) => {
            const row = node as { "@type"?: string; name?: string };
            const typeLabel = Array.isArray(row["@type"])
              ? row["@type"].join(", ")
              : row["@type"] || "Node";
            return (
              <li key={`${typeLabel}-${index}`} className="rounded-lg border border-[var(--cc-line)] bg-[var(--cc-paper)]">
                <p className="border-b border-[var(--cc-line)] px-3 py-2 text-sm font-semibold text-[var(--cc-ink)]">
                  {typeLabel}{row.name ? ` · ${row.name}` : ""}
                </p>
                <pre className="max-h-48 overflow-auto p-3 font-mono text-[0.7rem] leading-relaxed text-[var(--cc-ink)]">
                  {JSON.stringify(node, null, 2)}
                </pre>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--cc-muted)]">No JSON-LD nodes were generated from visible content.</p>
      )}
    </div>
  );
}

function FaqListView({ payload }: { payload: ArtifactPayload }) {
  const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
  return (
    <ul className="mt-4 space-y-5">
      {pairs.map((pair) => {
        const row = pair as { question?: string; answer?: string; verificationStatus?: string };
        return (
          <li key={row.question} className="border-b border-[var(--cc-line)] pb-5 last:border-b-0 last:pb-0">
            <p className="font-semibold text-[var(--cc-ink)]">{row.question}</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--cc-muted)]">{row.answer}</p>
            {row.verificationStatus ? (
              <p className="mt-2 text-xs text-[var(--cc-muted)]">{row.verificationStatus}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ClaimLedgerView({ payload }: { payload: ArtifactPayload }) {
  const claims = Array.isArray(payload.claims) ? payload.claims : [];
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((entry): entry is string => typeof entry === "string")
    : [];
  const contradictionWarnings = warnings.filter((warning) =>
    warning.toLowerCase().includes("possible contradiction"),
  );
  const hasPossible = claims.some((claim) => {
    const row = claim as { contradictionState?: string };
    return row.contradictionState === "possible";
  });

  return (
    <div className="mt-4">
      {hasPossible || contradictionWarnings.length ? (
        <aside
          aria-label="Possible contradictions"
          className="mb-5 border-l-2 border-amber-600 bg-amber-50/70 px-3 py-3"
          data-testid="contradiction-summary"
        >
          <p className="text-sm font-semibold text-amber-950">Possible contradictions</p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-amber-950/80">
            These claims share a subject but disagree on quantity or polarity. Review before citing.
          </p>
          {contradictionWarnings.length ? (
            <ul className="mt-2 space-y-1 text-xs text-amber-950/90">
              {contradictionWarnings.map((warning) => (
                <li key={warning} className="font-mono text-[0.7rem] leading-relaxed">
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      ) : null}
      <ul className="space-y-4">
        {claims.map((claim) => {
          const row = claim as {
            claimId?: string;
            claimText?: string;
            claimType?: string;
            verificationStatus?: string;
            contradictionState?: string;
          };
          const contradiction = row.contradictionState || "none";
          const border =
            contradiction === "possible"
              ? "border-amber-600"
              : contradiction === "unknown"
                ? "border-[var(--cc-line)]"
                : "border-[var(--cc-accent)]/40";
          return (
            <li
              key={row.claimId || row.claimText}
              className={`border-l-2 ${border} pl-3`}
              data-contradiction={contradiction}
            >
              <p className="font-semibold text-[var(--cc-ink)]">{row.claimText}</p>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                {[row.claimType, row.verificationStatus].filter(Boolean).join(" · ")}
              </p>
              {contradiction === "possible" ? (
                <p className="mt-1 text-xs font-medium text-amber-900">Possible contradiction</p>
              ) : null}
              {contradiction === "unknown" ? (
                <p className="mt-1 text-xs text-[var(--cc-muted)]">Contradiction not assessed</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QueryPlanView({ payload }: { payload: ArtifactPayload }) {
  const methodology = payload.methodology;
  const disclaimer = typeof methodology === "object"
    && methodology !== null
    && "demandDisclaimer" in methodology
    && typeof (methodology as { demandDisclaimer?: unknown }).demandDisclaimer === "string"
    ? (methodology as { demandDisclaimer: string }).demandDisclaimer
    : null;
  const queries = Array.isArray(payload.queries) ? payload.queries : [];
  return (
    <>
      {disclaimer ? (
        <p className="mt-3 max-w-prose rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {disclaimer}
        </p>
      ) : null}
      {queries.length ? (
        <ol className="mt-5 list-decimal space-y-2 pl-5">
          {queries.map((entry) => {
            const row = entry as { query?: string; origin?: string; priorityTier?: string };
            return (
              <li key={row.query} className="text-sm text-[var(--cc-ink)]">
                <span className="font-semibold">{row.query}</span>
                {row.origin || row.priorityTier ? (
                  <span className="ml-2 text-[var(--cc-muted)]">
                    {[row.origin, row.priorityTier].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </>
  );
}

function OutlineView({ payload }: { payload: ArtifactPayload }) {
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  return (
    <ol className="mt-4 list-decimal space-y-3 pl-5">
      {sections.map((section) => {
        const row = section as { heading?: string; objective?: string };
        return (
          <li key={row.heading} className="text-sm">
            <span className="font-semibold text-[var(--cc-ink)]">{row.heading}</span>
            {row.objective ? <span className="mt-1 block text-[var(--cc-muted)]">{row.objective}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function resolveKind(kind: string | undefined, payload: ArtifactPayload): string {
  if (kind) return kind;
  if (Array.isArray(payload.jsonLd)) return "json-ld";
  if (Array.isArray(payload.entities)) return "entity-graph";
  if (Array.isArray(payload.unsupportedClaimIds) || (
    Array.isArray(payload.claims)
    && Array.isArray(payload.sections)
    && "overallScore" in payload
  )) {
    return "claim-audit";
  }
  if ("overallScore" in payload) return "scorecard";
  if ("pairs" in payload) return "faq-list";
  if ("claims" in payload) return "claim-ledger";
  if ("sections" in payload) return "outline";
  if (typeof payload.methodology === "object" && payload.methodology !== null) return "query-plan";
  return "json";
}

export function TaskAgentResultRenderer({
  kind,
  artifactType,
  payload,
  digest,
  validationState,
}: ResultRendererProps) {
  const resolved = resolveKind(kind, payload);
  return (
    <div data-result-renderer={resolved} data-artifact-type={artifactType ?? ""}>
      <p className="text-xs text-[var(--cc-muted)]">
        <span className="font-medium text-[var(--cc-ink)]">{artifactType || "artifact"}</span>
        {" · "}
        {validationState || "valid"}
        {digest ? (
          <>
            {" · "}
            <span className="font-mono">{digest.slice(0, 12)}</span>
          </>
        ) : null}
      </p>
      {resolved === "scorecard" ? <ScorecardView payload={payload} /> : null}
      {resolved === "claim-audit" ? <ClaimAuditView payload={payload} /> : null}
      {resolved === "entity-graph" ? <EntityGraphView payload={payload} /> : null}
      {resolved === "json-ld" ? <JsonLdView payload={payload} /> : null}
      {resolved === "faq-list" ? <FaqListView payload={payload} /> : null}
      {resolved === "claim-ledger" ? <ClaimLedgerView payload={payload} /> : null}
      {resolved === "query-plan" ? <QueryPlanView payload={payload} /> : null}
      {resolved === "outline" ? <OutlineView payload={payload} /> : null}
      {resolved === "json" ? (
        <p className="mt-4 text-sm text-[var(--cc-muted)]">
          No purpose renderer is registered for this artifact yet.
        </p>
      ) : null}
      <details className="mt-6 rounded-lg border border-[var(--cc-line)] bg-[var(--cc-paper)] open:bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--cc-ink)]">
          Inspect payload JSON
        </summary>
        <pre className="max-h-[24rem] overflow-auto border-t border-[var(--cc-line)] bg-slate-950 p-4 text-xs text-slate-100">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

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
  const hasOverall = score !== null && score !== undefined && Number.isFinite(numeric);
  const dimensions = Array.isArray(payload.dimensions) ? payload.dimensions : [];
  const fixes = Array.isArray(payload.prioritizedFixes) ? payload.prioritizedFixes : [];
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((entry): entry is string => typeof entry === "string")
    : [];
  return (
    <div className="mt-2">
      <p className="text-sm text-[var(--cc-muted)]">Overall readiness</p>
      <p
        className="mt-1 font-semibold tabular-nums tracking-tight text-[var(--cc-ink)]"
        style={{ fontSize: "clamp(2.75rem, 6vw, 4.5rem)", lineHeight: 1 }}
        data-testid="readiness-overall-score"
      >
        {hasOverall ? numeric : "—"}
      </p>
      {!hasOverall ? (
        <p className="mt-2 text-sm text-[var(--cc-muted)]" data-testid="readiness-partial-overall">
          Overall score omitted — source marked partial or dimensions lack evidence.
        </p>
      ) : null}
      {warnings.length ? (
        <ul className="mt-4 space-y-1" aria-label="Readiness warnings" data-testid="readiness-warnings">
          {warnings.map((warning) => (
            <li key={warning} className="text-sm text-amber-900">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
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
    <ul className="mt-4 space-y-5" aria-label="FAQ pairs">
      {pairs.map((pair) => {
        const row = asEntry(pair);
        const citations = Array.isArray(row.citations) ? row.citations : [];
        const status = typeof row.verificationStatus === "string" ? row.verificationStatus : "";
        return (
          <li
            key={String(row.pairId || row.question)}
            className="border-b border-[var(--cc-line)] pb-5 last:border-b-0 last:pb-0"
            data-verification={status || undefined}
          >
            <p className="font-semibold text-[var(--cc-ink)]">{String(row.question || "")}</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--cc-muted)]">
              {String(row.answer || "")}
            </p>
            {status ? (
              <p className="mt-2 text-xs text-[var(--cc-muted)]">{status}</p>
            ) : null}
            {citations.length ? (
              <ul className="mt-3 space-y-2" aria-label="FAQ citations" data-testid="faq-citations">
                {citations.map((entry) => {
                  const cite = asEntry(entry);
                  const quote = typeof cite.quote === "string" ? cite.quote : "";
                  if (!quote) return null;
                  return (
                    <li
                      key={String(cite.evidenceId || quote)}
                      className="border-l-2 border-[var(--cc-accent)]/40 pl-3 text-xs text-[var(--cc-muted)]"
                    >
                      <span className="font-medium text-[var(--cc-ink)]">Evidence</span>
                      <blockquote className="mt-1 max-w-prose leading-relaxed">“{quote}”</blockquote>
                      {typeof cite.url === "string" && cite.url ? (
                        <span className="mt-1 block font-mono text-[0.65rem]">{cite.url}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : status === "unverifiable" ? (
              <p className="mt-2 text-xs text-[var(--cc-muted)]" data-testid="faq-no-citation">
                No evidence quote — pair is unverifiable from supplied sources.
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ClaimLedgerView({ payload }: { payload: ArtifactPayload }) {
  const claims = Array.isArray(payload.claims) ? payload.claims : [];
  const warnings = stringWarnings(payload);
  const contradictionWarnings = warnings.filter((warning) =>
    warning.toLowerCase().includes("possible contradiction"),
  );
  const hasPossible = claims.some((claim) => asEntry(claim).contradictionState === "possible");
  const evidenceById = new Map<string, string>();
  const provenance = asEntry(payload.provenance);
  if (Array.isArray(provenance.evidence)) {
    for (const entry of provenance.evidence) {
      const row = asEntry(entry);
      if (typeof row.evidenceId === "string" && typeof row.quote === "string" && row.quote) {
        evidenceById.set(row.evidenceId, row.quote);
      }
    }
  }

  return (
    <div className="mt-4">
      {warnings.length ? (
        <ul className="mb-4 space-y-1 text-sm text-amber-900" aria-label="Claim ledger warnings" data-testid="claim-ledger-warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
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
      <ul className="space-y-4" aria-label="Citable claims">
        {claims.map((claim) => {
          const row = asEntry(claim);
          const contradiction = typeof row.contradictionState === "string"
            ? row.contradictionState
            : "none";
          const border =
            contradiction === "possible"
              ? "border-amber-600"
              : contradiction === "unknown"
                ? "border-[var(--cc-line)]"
                : "border-[var(--cc-accent)]/40";
          const evidenceIds = Array.isArray(row.evidenceIds)
            ? row.evidenceIds.map(String)
            : [];
          const evidenceQuotes = evidenceIds
            .map((id) => evidenceById.get(id))
            .filter((quote): quote is string => Boolean(quote));
          return (
            <li
              key={String(row.claimId || row.claimText)}
              className={`border-l-2 ${border} pl-3`}
              data-contradiction={contradiction}
            >
              <p className="font-semibold text-[var(--cc-ink)]">{String(row.claimText || "")}</p>
              <p className="mt-1 text-xs text-[var(--cc-muted)]">
                {[row.claimType, row.verificationStatus].filter(Boolean).map(String).join(" · ")}
              </p>
              {typeof row.attribution === "string" && row.attribution ? (
                <p className="mt-2 text-xs text-[var(--cc-ink)]" data-testid="claim-attribution">
                  Attribution: {row.attribution}
                </p>
              ) : null}
              {evidenceQuotes.length ? (
                <ul className="mt-2 space-y-1" aria-label="Claim evidence" data-testid="claim-evidence">
                  {evidenceQuotes.map((quote) => (
                    <li key={quote} className="text-xs leading-relaxed text-[var(--cc-muted)]">
                      “{quote}”
                    </li>
                  ))}
                </ul>
              ) : null}
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

function hypothesisItems(value: unknown): Array<{ text: string; disclaimer?: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = asEntry(entry);
    if (typeof row.text !== "string" || !row.text) return [];
    return [{
      text: row.text,
      disclaimer: typeof row.disclaimer === "string" ? row.disclaimer : undefined,
    }];
  });
}

function stringWarnings(payload: ArtifactPayload): string[] {
  return Array.isArray(payload.warnings)
    ? payload.warnings.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function ComparisonBriefView({ payload }: { payload: ArtifactPayload }) {
  const criteria = Array.isArray(payload.criteria) ? payload.criteria : [];
  const differentiators = hypothesisItems(payload.differentiators);
  const proofRequirements = hypothesisItems(payload.proofRequirements);
  const positioningAngles = hypothesisItems(payload.positioningAngles);
  const verdict = asEntry(payload.recommendedVerdict);
  const warnings = stringWarnings(payload);

  return (
    <div className="mt-4 space-y-6">
      <p className="text-sm text-[var(--cc-muted)]">
        <span className="font-semibold text-[var(--cc-ink)]">{String(payload.subjectName || "Subject")}</span>
        {" vs "}
        <span className="font-semibold text-[var(--cc-ink)]">{String(payload.competitorName || "Competitor")}</span>
      </p>
      {criteria.length ? (
        <ul className="space-y-4" aria-label="Comparison criteria">
          {criteria.map((entry) => {
            const row = asEntry(entry);
            const subjectSignals = Array.isArray(row.subjectSignals)
              ? row.subjectSignals.map(String)
              : [];
            const competitorSignals = Array.isArray(row.competitorSignals)
              ? row.competitorSignals.map(String)
              : [];
            return (
              <li key={String(row.criterion)} className="border-l-2 border-[var(--cc-accent)]/40 pl-3 text-sm">
                <p className="font-semibold text-[var(--cc-ink)]">{String(row.criterion)}</p>
                {typeof row.summary === "string" && row.summary ? (
                  <p className="mt-1 text-[var(--cc-muted)]">{row.summary}</p>
                ) : null}
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-[var(--cc-ink)]">Subject</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--cc-muted)]">
                      {subjectSignals.map((signal) => <li key={signal}>{signal}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--cc-ink)]">Competitor</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--cc-muted)]">
                      {competitorSignals.map((signal) => <li key={signal}>{signal}</li>)}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {differentiators.length ? (
        <aside className="border-l-2 border-amber-600 bg-amber-50/70 px-3 py-3" data-testid="brief-differentiators">
          <p className="text-sm font-semibold text-amber-950">Differentiators</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-950/90">
            {differentiators.map((item) => (
              <li key={item.text}>
                {item.text}
                {item.disclaimer ? <span className="mt-1 block text-xs opacity-80">{item.disclaimer}</span> : null}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
      {proofRequirements.length ? (
        <aside className="border-l-2 border-amber-600 bg-amber-50/70 px-3 py-3" data-testid="brief-proof-requirements">
          <p className="text-sm font-semibold text-amber-950">Proof requirements</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-950/90">
            {proofRequirements.map((item) => <li key={item.text}>{item.text}</li>)}
          </ul>
        </aside>
      ) : null}
      {positioningAngles.length ? (
        <aside className="border-l-2 border-amber-600 bg-amber-50/70 px-3 py-3" data-testid="brief-positioning-angles">
          <p className="text-sm font-semibold text-amber-950">Positioning angles</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-950/90">
            {positioningAngles.map((item) => <li key={item.text}>{item.text}</li>)}
          </ul>
        </aside>
      ) : null}
      {typeof verdict.framing === "string" && verdict.framing ? (
        <div className="border-l-2 border-[var(--cc-accent)] pl-3" data-testid="brief-verdict">
          <p className="text-sm font-semibold text-[var(--cc-ink)]">Recommended framing</p>
          <p className="mt-1 text-sm text-[var(--cc-ink)]">{verdict.framing}</p>
          {typeof verdict.disclaimer === "string" && verdict.disclaimer ? (
            <p className="mt-2 text-xs text-[var(--cc-muted)]">{verdict.disclaimer}</p>
          ) : null}
        </div>
      ) : null}
      {warnings.length ? (
        <ul className="space-y-1 text-xs text-[var(--cc-muted)]" aria-label="Comparison warnings" data-testid="comparison-brief-warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function ResponsePlanView({ payload }: { payload: ArtifactPayload }) {
  const contentAngles = hypothesisItems(payload.contentAngles);
  const proofPoints = Array.isArray(payload.requiredProofPoints) ? payload.requiredProofPoints : [];
  const sections = Array.isArray(payload.outlineSections) ? payload.outlineSections : [];
  const warnings = stringWarnings(payload);

  return (
    <div className="mt-4 space-y-6">
      <div>
        <p className="text-sm text-[var(--cc-muted)]">Selected mode</p>
        <p className="mt-1 font-semibold text-[var(--cc-ink)]" data-testid="response-mode">
          {String(payload.selectedMode || "—")}
        </p>
        {typeof payload.rationale === "string" && payload.rationale ? (
          <p className="mt-2 max-w-prose text-sm text-[var(--cc-muted)]">{payload.rationale}</p>
        ) : null}
      </div>
      {contentAngles.length ? (
        <aside className="border-l-2 border-amber-600 bg-amber-50/70 px-3 py-3" data-testid="response-content-angles">
          <p className="text-sm font-semibold text-amber-950">Content angles</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-950/90">
            {contentAngles.map((item) => (
              <li key={item.text}>
                {item.text}
                {item.disclaimer ? <span className="mt-1 block text-xs opacity-80">{item.disclaimer}</span> : null}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
      {proofPoints.length ? (
        <ul className="space-y-3" aria-label="Required proof points">
          {proofPoints.map((entry) => {
            const row = asEntry(entry);
            return (
              <li key={String(row.proofId || row.statement)} className="border-l-2 border-[var(--cc-accent)]/40 pl-3 text-sm">
                <p className="font-semibold text-[var(--cc-ink)]">{String(row.statement)}</p>
                <p className="mt-1 text-xs text-[var(--cc-muted)]">
                  {[row.proofId, row.origin].filter(Boolean).map(String).join(" · ")}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
      {sections.length ? (
        <ol className="list-decimal space-y-3 pl-5" aria-label="Response outline">
          {sections.map((entry) => {
            const row = asEntry(entry);
            return (
              <li key={String(row.heading)} className="text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{String(row.heading)}</span>
                {typeof row.objective === "string" && row.objective ? (
                  <span className="mt-1 block text-[var(--cc-muted)]">{row.objective}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {warnings.length ? (
        <ul className="space-y-1 text-xs text-[var(--cc-muted)]" aria-label="Response warnings" data-testid="response-plan-warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function OutlineView({ payload }: { payload: ArtifactPayload }) {
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const plan = Array.isArray(payload.supportingContentPlan) ? payload.supportingContentPlan : [];
  const warnings = stringWarnings(payload);

  return (
    <div className="mt-4 space-y-6">
      {typeof payload.topic === "string" && payload.topic ? (
        <p className="text-sm text-[var(--cc-muted)]">
          Topic <span className="font-semibold text-[var(--cc-ink)]">{payload.topic}</span>
        </p>
      ) : null}
      <ol className="list-decimal space-y-3 pl-5" aria-label="Pillar outline sections">
        {sections.map((section) => {
          const row = asEntry(section);
          const related = Array.isArray(row.relatedQueries)
            ? row.relatedQueries.map(String)
            : [];
          return (
            <li key={String(row.sectionId || row.heading)} className="text-sm">
              <span className="font-semibold text-[var(--cc-ink)]">{String(row.heading)}</span>
              {typeof row.objective === "string" && row.objective ? (
                <span className="mt-1 block text-[var(--cc-muted)]">{row.objective}</span>
              ) : null}
              {typeof row.answerFirstPrompt === "string" && row.answerFirstPrompt ? (
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                  Answer first: {row.answerFirstPrompt}
                </span>
              ) : null}
              {related.length ? (
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                  Related: {related.join(" · ")}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {plan.length ? (
        <aside className="border-l-2 border-amber-600 bg-amber-50/70 px-3 py-3" data-testid="supporting-content-plan">
          <p className="text-sm font-semibold text-amber-950">Supporting content plan</p>
          <ul className="mt-2 space-y-3 text-sm text-amber-950/90">
            {plan.map((entry) => {
              const row = asEntry(entry);
              return (
                <li key={String(row.title)}>
                  <span className="font-semibold">{String(row.title)}</span>
                  {typeof row.contentType === "string" ? (
                    <span className="ml-2 text-xs opacity-80">{row.contentType}</span>
                  ) : null}
                  {typeof row.rationale === "string" && row.rationale ? (
                    <span className="mt-1 block text-xs opacity-90">{row.rationale}</span>
                  ) : null}
                  {typeof row.disclaimer === "string" && row.disclaimer ? (
                    <span className="mt-1 block text-xs opacity-70">{row.disclaimer}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}
      {warnings.length ? (
        <ul className="space-y-1 text-xs text-[var(--cc-muted)]" aria-label="Outline warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function PillarArticleView({ payload }: { payload: ArtifactPayload }) {
  const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const plan = Array.isArray(payload.supportingContentPlan) ? payload.supportingContentPlan : [];
  const warnings = stringWarnings(payload);
  const groundedCount = sections.filter((section) => asEntry(section).grounded === true).length;

  return (
    <div className="mt-4 space-y-6">
      {typeof payload.title === "string" && payload.title ? (
        <p className="text-sm text-[var(--cc-muted)]">
          Title <span className="font-semibold text-[var(--cc-ink)]">{payload.title}</span>
        </p>
      ) : null}
      <p className="text-sm text-[var(--cc-muted)]" data-testid="pillar-grounded-count">
        {groundedCount} of {sections.length} sections grounded in supplied source
      </p>
      <pre
        className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-[var(--cc-line)] bg-[var(--cc-paper)] p-4 text-sm leading-relaxed text-[var(--cc-ink)]"
        data-testid="pillar-article-markdown"
      >
        {markdown || "No markdown draft was produced."}
      </pre>
      {plan.length ? (
        <aside className="border-l-2 border-amber-600 bg-amber-50/70 px-3 py-3" data-testid="supporting-content-plan">
          <p className="text-sm font-semibold text-amber-950">Supporting content plan</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-950/90">
            {plan.map((entry) => {
              const row = asEntry(entry);
              return (
                <li key={String(row.title)}>
                  <span className="font-semibold">{String(row.title)}</span>
                  {typeof row.contentType === "string" ? (
                    <span className="ml-2 text-xs opacity-80">{row.contentType}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}
      {warnings.length ? (
        <ul className="space-y-1 text-xs text-[var(--cc-muted)]" aria-label="Pillar article warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function asEntry(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function scoreLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? String(numeric) : "—";
}

function ScoreMatrixView({ payload }: { payload: ArtifactPayload }) {
  const subject = asEntry(payload.subject);
  const competitors = Array.isArray(payload.competitors) ? payload.competitors : [];
  const deltas = Array.isArray(payload.dimensionDeltas) ? payload.dimensionDeltas : [];
  const fixes = Array.isArray(payload.prioritizedFixes) ? payload.prioritizedFixes : [];
  const warnings = stringWarnings(payload);

  return (
    <div className="mt-2 space-y-6">
      {warnings.length ? (
        <ul className="space-y-1 text-sm text-amber-900" aria-label="Comparison warnings" data-testid="score-matrix-warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-[var(--cc-muted)]">Subject readiness</p>
          <p
            className="mt-1 font-semibold tabular-nums tracking-tight text-[var(--cc-ink)]"
            style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1 }}
            data-testid="score-matrix-subject-score"
          >
            {scoreLabel(subject.overallScore)}
          </p>
        </div>
        <ul className="space-y-2" aria-label="Competitor readiness scores">
          {competitors.map((entry) => {
            const row = asEntry(entry);
            return (
              <li key={String(row.sourceId || row.competitorId)} className="border-l-2 border-[var(--cc-line)] pl-3 text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">
                  {String(row.competitorName || row.competitorId || "Competitor")}
                </span>
                <span className="ml-2 tabular-nums text-[var(--cc-muted)]">
                  {scoreLabel(row.overallScore)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {deltas.length ? (
        <ul className="space-y-3" aria-label="Dimension deltas">
          {deltas.map((entry) => {
            const row = asEntry(entry);
            const delta = typeof row.deltaVsBestCompetitor === "number"
              ? row.deltaVsBestCompetitor
              : Number(row.deltaVsBestCompetitor);
            return (
              <li key={String(row.dimension)} className="border-l-2 border-[var(--cc-accent)]/40 pl-3 text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{String(row.dimension)}</span>
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                  Subject {scoreLabel(row.subjectScore)}
                  {" · best competitor "}
                  {scoreLabel(row.bestCompetitorScore)}
                  {Number.isFinite(delta) ? ` · delta ${delta > 0 ? "+" : ""}${delta}` : ""}
                </span>
                {typeof row.summary === "string" && row.summary ? (
                  <span className="mt-1 block text-[var(--cc-muted)]">{row.summary}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {fixes.length ? (
        <ul className="space-y-2" aria-label="Comparison fixes">
          {fixes.slice(0, 6).map((fix) => (
            <li key={String(fix)} className="border-l-2 border-[var(--cc-accent)] pl-3 text-sm text-[var(--cc-ink)]">
              {String(fix)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GapReportView({ payload }: { payload: ArtifactPayload }) {
  const gaps = Array.isArray(payload.gaps) ? payload.gaps : [];
  const dimensions = Array.isArray(payload.dimensions) ? payload.dimensions : [];
  const warnings = stringWarnings(payload);
  return (
    <div className="mt-4 space-y-6">
      {warnings.length ? (
        <ul className="space-y-1 text-sm text-amber-900" aria-label="Gap report warnings" data-testid="gap-report-warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      {gaps.length ? (
        <ul className="space-y-3" aria-label="Content gaps">
          {gaps.map((entry) => {
            const row = asEntry(entry);
            const status = String(row.status || "");
            return (
              <li
                key={String(row.gapId || row.signal)}
                className={`border-l-2 pl-3 text-sm ${status === "supportedGap" ? "border-amber-600" : "border-[var(--cc-line)]"}`}
                data-gap-status={status || "unknown"}
              >
                <span className="font-semibold text-[var(--cc-ink)]">
                  {String(row.dimension || "Gap")}
                  {row.signal ? ` · ${String(row.signal)}` : ""}
                </span>
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                  {[status, row.confidence].filter(Boolean).join(" · ")}
                </span>
                {typeof row.opportunity === "string" && row.opportunity ? (
                  <span className="mt-1 block text-[var(--cc-muted)]">{row.opportunity}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--cc-muted)]">No comparative gaps were detected from the supplied pages.</p>
      )}
      {dimensions.length ? (
        <ul className="space-y-2" aria-label="Coverage by dimension">
          {dimensions.map((entry) => {
            const row = asEntry(entry);
            const subject = row.subjectCoverage;
            const subjectLabel = subject === true ? "covered" : subject === false ? "missing" : "unknown";
            return (
              <li key={String(row.dimension)} className="text-sm text-[var(--cc-ink)]">
                <span className="font-semibold">{String(row.dimension)}</span>
                <span className="ml-2 text-xs text-[var(--cc-muted)]">
                  subject {subjectLabel}
                  {" · competitors "}
                  {String(row.competitorCoverageCount ?? "—")}/{String(row.competitorPageCount ?? "—")}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function AuditReportView({ payload }: { payload: ArtifactPayload }) {
  const actions = Array.isArray(payload.prioritizedActions) ? payload.prioritizedActions : [];
  const pageAnalyses = Array.isArray(payload.pageAnalyses) ? payload.pageAnalyses : [];
  const contentGap = asEntry(payload.contentGap);
  const gapCount = Array.isArray(contentGap.gaps) ? contentGap.gaps.length : 0;
  const warnings = stringWarnings(payload);

  return (
    <div className="mt-4 space-y-6">
      {warnings.length ? (
        <ul className="space-y-1 text-sm text-amber-900" aria-label="Audit warnings" data-testid="audit-report-warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      <p className="text-sm text-[var(--cc-muted)]">
        {pageAnalyses.length} competitor page{pageAnalyses.length === 1 ? "" : "s"} analyzed
        {gapCount ? ` · ${gapCount} comparative gap${gapCount === 1 ? "" : "s"}` : ""}
      </p>
      {actions.length ? (
        <ol className="list-decimal space-y-3 pl-5" aria-label="Prioritized actions">
          {actions.map((entry) => {
            const row = asEntry(entry);
            return (
              <li key={String(row.actionId || row.action)} className="text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{String(row.action)}</span>
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                  {[row.priority, row.dimension, row.origin].filter(Boolean).join(" · ")}
                </span>
                {typeof row.rationale === "string" && row.rationale ? (
                  <span className="mt-1 block text-[var(--cc-muted)]">{row.rationale}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-[var(--cc-muted)]">No prioritized actions were produced.</p>
      )}
    </div>
  );
}

function PositioningMapView({ payload }: { payload: ArtifactPayload }) {
  const attributes = Array.isArray(payload.attributeMap) ? payload.attributeMap : [];
  const gaps = Array.isArray(payload.perceptionGaps) ? payload.perceptionGaps : [];
  const hypotheses = Array.isArray(payload.messagingHypotheses) ? payload.messagingHypotheses : [];
  const warnings = stringWarnings(payload);

  return (
    <div className="mt-4 space-y-6">
      {warnings.length ? (
        <ul className="space-y-1 text-sm text-amber-900" aria-label="Positioning warnings" data-testid="positioning-warnings">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      {attributes.length ? (
        <ul className="space-y-3" aria-label="Positioning attributes">
          {attributes.map((entry) => {
            const row = asEntry(entry);
            return (
              <li key={String(row.attributeId || row.attribute)} className="border-l-2 border-[var(--cc-accent)]/40 pl-3 text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{String(row.attribute)}</span>
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                  {[row.party, row.competitorName || row.competitorId].filter(Boolean).join(" · ")}
                </span>
                {Array.isArray(row.signals) && row.signals.length ? (
                  <span className="mt-1 block text-[var(--cc-muted)]">
                    {row.signals.filter((signal): signal is string => typeof signal === "string").join("; ")}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {gaps.length ? (
        <ul className="space-y-3" aria-label="Perception gaps">
          {gaps.map((entry) => {
            const row = asEntry(entry);
            return (
              <li key={String(row.gapId || row.attribute)} className="border-l-2 border-amber-600 pl-3 text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{String(row.attribute)}</span>
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">{String(row.status || "")}</span>
                {typeof row.summary === "string" && row.summary ? (
                  <span className="mt-1 block text-[var(--cc-muted)]">{row.summary}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {hypotheses.length ? (
        <aside
          aria-label="Messaging hypotheses"
          className="border-l-2 border-[var(--cc-line)] bg-[var(--cc-paper)] px-3 py-3"
          data-testid="messaging-hypotheses"
        >
          <p className="text-sm font-semibold text-[var(--cc-ink)]">Messaging hypotheses</p>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Generated only — not measured market perception, demand, or ranking.
          </p>
          <ul className="mt-3 space-y-2">
            {hypotheses.map((entry) => {
              const row = asEntry(entry);
              return (
                <li key={String(row.hypothesisId || row.message)} className="text-sm text-[var(--cc-ink)]">
                  {String(row.message)}
                  {row.targetQuery ? (
                    <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                      Target query: {String(row.targetQuery)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

function CompetitorReportView({ payload }: { payload: ArtifactPayload }) {
  const dimensions = Array.isArray(payload.dimensions) ? payload.dimensions : [];
  const opportunities = Array.isArray(payload.opportunities) ? payload.opportunities : [];
  return (
    <div className="mt-4 space-y-6">
      {typeof payload.competitorId === "string" && payload.competitorId ? (
        <p className="text-sm text-[var(--cc-muted)]">Competitor {payload.competitorId}</p>
      ) : null}
      <ul className="space-y-3" aria-label="Competitor dimensions">
        {dimensions.map((entry) => {
          const row = asEntry(entry);
          const present = row.present;
          const presentLabel = present === true ? "present" : present === false ? "absent" : "unknown";
          return (
            <li key={String(row.dimension)} className="border-l-2 border-[var(--cc-accent)]/40 pl-3 text-sm">
              <span className="font-semibold text-[var(--cc-ink)]">{String(row.dimension)}</span>
              <span className="ml-2 text-xs text-[var(--cc-muted)]">{presentLabel}</span>
              {typeof row.summary === "string" && row.summary ? (
                <span className="mt-1 block text-[var(--cc-muted)]">{row.summary}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {opportunities.length ? (
        <ul className="space-y-2" aria-label="Competitor opportunities">
          {opportunities.map((entry) => (
            <li key={String(entry)} className="border-l-2 border-[var(--cc-accent)] pl-3 text-sm text-[var(--cc-ink)]">
              {String(entry)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
  if (payload.subject && Array.isArray(payload.dimensionDeltas)) return "score-matrix";
  if (Array.isArray(payload.gaps) && Array.isArray(payload.dimensions)) return "gap-report";
  if (Array.isArray(payload.prioritizedActions)) return "audit-report";
  if (Array.isArray(payload.attributeMap) || Array.isArray(payload.perceptionGaps)) {
    return "positioning-map";
  }
  if (Array.isArray(payload.opportunities) && Array.isArray(payload.dimensions)) {
    return "competitor-report";
  }
  if (Array.isArray(payload.criteria) && payload.recommendedVerdict) return "comparison-brief";
  if (
    typeof payload.selectedMode === "string"
    && (Array.isArray(payload.outlineSections) || Array.isArray(payload.contentAngles))
  ) {
    return "response-plan";
  }
  if ("overallScore" in payload) return "scorecard";
  if ("pairs" in payload) return "faq-list";
  if ("claims" in payload) return "claim-ledger";
  if (typeof payload.markdown === "string" && Array.isArray(payload.sections)) {
    return "pillar-article";
  }
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
      {resolved === "score-matrix" ? <ScoreMatrixView payload={payload} /> : null}
      {resolved === "gap-report" ? <GapReportView payload={payload} /> : null}
      {resolved === "audit-report" ? <AuditReportView payload={payload} /> : null}
      {resolved === "positioning-map" ? <PositioningMapView payload={payload} /> : null}
      {resolved === "competitor-report" ? <CompetitorReportView payload={payload} /> : null}
      {resolved === "faq-list" ? <FaqListView payload={payload} /> : null}
      {resolved === "claim-ledger" ? <ClaimLedgerView payload={payload} /> : null}
      {resolved === "query-plan" ? <QueryPlanView payload={payload} /> : null}
      {resolved === "comparison-brief" ? <ComparisonBriefView payload={payload} /> : null}
      {resolved === "response-plan" ? <ResponsePlanView payload={payload} /> : null}
      {resolved === "outline" ? <OutlineView payload={payload} /> : null}
      {resolved === "pillar-article" ? <PillarArticleView payload={payload} /> : null}
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

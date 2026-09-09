"use client";

type ArtifactPayload = Record<string, unknown>;

type ResultRendererProps = {
  kind?: string;
  artifactType?: string;
  payload: ArtifactPayload;
  digest?: string;
};

function ScorecardView({ payload }: { payload: ArtifactPayload }) {
  return (
    <p className="mt-6 text-5xl font-bold text-[var(--cc-accent)]">
      {String(payload.overallScore ?? "—")}
    </p>
  );
}

function FaqListView({ payload }: { payload: ArtifactPayload }) {
  const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
  return (
    <ul className="mt-6 space-y-4">
      {pairs.map((pair) => {
        const row = pair as { question?: string; answer?: string; verificationStatus?: string };
        return (
          <li key={row.question} className="rounded-lg border border-[var(--cc-line)] p-4">
            <p className="font-semibold text-[var(--cc-ink)]">{row.question}</p>
            <p className="mt-2 text-sm text-[var(--cc-muted)]">{row.answer}</p>
            {row.verificationStatus ? (
              <p className="mt-2 text-xs uppercase tracking-wide text-[var(--cc-muted)]">
                {row.verificationStatus}
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
  return (
    <ul className="mt-6 space-y-4">
      {claims.map((claim) => {
        const row = claim as { claimText?: string; claimType?: string; verificationStatus?: string };
        return (
          <li key={row.claimText} className="rounded-lg border border-[var(--cc-line)] p-4">
            <p className="font-semibold text-[var(--cc-ink)]">{row.claimText}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-[var(--cc-muted)]">
              {[row.claimType, row.verificationStatus].filter(Boolean).join(" · ")}
            </p>
          </li>
        );
      })}
    </ul>
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
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{disclaimer}</p>
      ) : null}
      {queries.length ? (
        <ul className="mt-6 space-y-2">
          {queries.map((entry) => {
            const row = entry as { query?: string; origin?: string };
            return (
              <li key={row.query} className="rounded-lg border border-[var(--cc-line)] p-3 text-sm">
                <strong>{row.query}</strong>
                {row.origin ? <span className="ml-2 text-[var(--cc-muted)]">· {row.origin}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}

function OutlineView({ payload }: { payload: ArtifactPayload }) {
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  return (
    <ul className="mt-6 space-y-3">
      {sections.map((section) => {
        const row = section as { heading?: string; objective?: string };
        return (
          <li key={row.heading} className="rounded-lg border border-[var(--cc-line)] p-4">
            <p className="font-semibold">{row.heading}</p>
            {row.objective ? <p className="mt-1 text-sm text-[var(--cc-muted)]">{row.objective}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function resolveKind(kind: string | undefined, payload: ArtifactPayload): string {
  if (kind) return kind;
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
}: ResultRendererProps) {
  const resolved = resolveKind(kind, payload);
  return (
    <div data-result-renderer={resolved} data-artifact-type={artifactType ?? ""}>
      {digest ? (
        <p className="text-xs text-[var(--cc-muted)]">
          {artifactType} · valid · <span className="font-mono">{digest.slice(0, 12)}</span>
        </p>
      ) : null}
      {resolved === "scorecard" ? <ScorecardView payload={payload} /> : null}
      {resolved === "faq-list" ? <FaqListView payload={payload} /> : null}
      {resolved === "claim-ledger" ? <ClaimLedgerView payload={payload} /> : null}
      {resolved === "query-plan" ? <QueryPlanView payload={payload} /> : null}
      {resolved === "outline" ? <OutlineView payload={payload} /> : null}
      {resolved !== "scorecard"
        && resolved !== "faq-list"
        && resolved !== "claim-ledger"
        && resolved !== "query-plan"
        && resolved !== "outline" ? (
        <p className="mt-4 text-sm text-[var(--cc-muted)]">Rendered with the generic JSON shell.</p>
      ) : null}
      <pre className="mt-6 max-h-[36rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

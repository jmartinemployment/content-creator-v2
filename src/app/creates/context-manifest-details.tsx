"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  normalizeRunContextManifest,
  type RunContextManifest,
} from "@/app/brand-sources/context-contract";

type ContextManifestDetailsProps = {
  createId: string;
  jobId: string;
  jobStatus: string;
};

function coordinateLabel(entry: RunContextManifest["entries"][number]): string | null {
  const provenance = entry.provenance;
  if (!provenance) return null;
  return [provenance.parser, provenance.parserVersion, provenance.sourceTimestampUtc]
    .filter(Boolean)
    .join(" · ") || null;
}

export function ContextManifestDetails({ createId, jobId, jobStatus }: ContextManifestDetailsProps) {
  const router = useRouter();
  const [manifest, setManifest] = useState<RunContextManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"retry" | "refresh" | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/gcc-v2/jobs/${encodeURIComponent(jobId)}/context-manifest`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error || `Manifest unavailable (HTTP ${response.status}).`);
      return;
    }
    setManifest(normalizeRunContextManifest(body));
  }, [jobId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function run(action: "retry" | "refresh") {
    setBusy(action);
    setError(null);
    const url = action === "retry"
      ? `/api/gcc-v2/jobs/${encodeURIComponent(jobId)}/retry`
      : `/api/gcc-v2/jobs/${encodeURIComponent(jobId)}/refresh-context-and-rerun`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "retry" ? { retainContextManifest: true } : {}),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error || `${action === "retry" ? "Retry" : "Refresh"} failed (HTTP ${response.status}).`);
      setBusy(null);
      return;
    }
    const nextJobId = body?.jobId as string | undefined;
    if (nextJobId && nextJobId !== jobId) {
      router.push(`/creates/${encodeURIComponent(createId)}?jobId=${encodeURIComponent(nextJobId)}`);
      return;
    }
    setBusy(null);
    await load();
  }

  return (
    <section className="mt-3 border-t border-[var(--cc-line)] pt-3 text-xs" aria-label="Context manifest">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-[var(--cc-ink)]">Governed context manifest</h3><button type="button" onClick={() => void load()} className="text-[var(--cc-accent)] underline">Refresh details</button></div>
      {error ? <p role="alert" className="mt-2 rounded bg-red-50 p-2 text-red-800">{error}</p> : null}
      {manifest ? <>
        <dl className="mt-2 grid gap-1 text-[var(--cc-muted)]">
          <div><dt className="inline font-semibold text-[var(--cc-ink)]">Manifest ID: </dt><dd className="inline font-mono">{manifest.manifestId}</dd></div>
          <div><dt className="inline font-semibold text-[var(--cc-ink)]">Digest: </dt><dd className="inline break-all font-mono">{manifest.digest}</dd></div>
          <div><dt className="inline font-semibold text-[var(--cc-ink)]">Contract: </dt><dd className="inline">{manifest.schemaVersion} · signing key {manifest.signingKeyId}</dd></div>
          <div><dt className="inline font-semibold text-[var(--cc-ink)]">Resolved: </dt><dd className="inline">{new Date(manifest.resolvedAtUtc).toLocaleString()}</dd></div>
          {manifest.originalJobId ? <div><dt className="inline font-semibold text-[var(--cc-ink)]">Retry lineage: </dt><dd className="inline font-mono">{manifest.originalJobId} → {jobId} (same manifest)</dd></div> : null}
          {manifest.replacesJobId ? <div><dt className="inline font-semibold text-[var(--cc-ink)]">Refresh lineage: </dt><dd className="inline font-mono">{manifest.replacesJobId} → {jobId} (new manifest)</dd></div> : null}
        </dl>
        <ul className="mt-3 space-y-2">
          {manifest.entries.map((entry) => <li key={`${entry.kind}-${entry.versionId}`} className="rounded-md bg-slate-50 p-2"><div><strong>{entry.name}</strong> · {entry.kind} · version {entry.versionNumber ?? "?"}</div><div className="text-[var(--cc-muted)]">{entry.lifecycle ?? "resolved"}{entry.freshness ? ` · ${entry.freshness}` : ""}{entry.temporary ? " · temporary/run only" : " · persistent"}{entry.extractionState ? ` · extraction ${entry.extractionState}` : ""}{entry.indexState ? ` · index ${entry.indexState}` : ""}</div><div className="break-all font-mono text-[var(--cc-muted)]">{entry.versionId}{entry.digest ? ` · ${entry.digest}` : ""}</div>{coordinateLabel(entry) ? <div className="text-[var(--cc-muted)]">Provenance: {coordinateLabel(entry)}</div> : null}</li>)}
        </ul>
        {manifest.warnings.length ? <ul className="mt-2 list-disc rounded bg-amber-50 p-3 pl-7 text-amber-900">{manifest.warnings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul> : null}
        {manifest.validationFindings.length ? <ul className="mt-2 list-disc rounded bg-red-50 p-3 pl-7 text-red-900">{manifest.validationFindings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul> : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy !== null || jobStatus !== "failed"} onClick={() => void run("retry")} className="rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 font-semibold disabled:opacity-40">{busy === "retry" ? "Retrying…" : "Retry with original context"}</button>
          <button type="button" disabled={busy !== null} onClick={() => void run("refresh")} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-950 disabled:opacity-40">{busy === "refresh" ? "Resolving new context…" : "Refresh context & rerun"}</button>
        </div>
        <p className="mt-2 text-[var(--cc-muted)]">Retry preserves this exact manifest. Refresh creates a new manifest and explicit job lineage; revoked context is never silently replaced.</p>
      </> : !error ? <p className="mt-2 text-[var(--cc-muted)]">Loading exact manifest…</p> : null}
    </section>
  );
}

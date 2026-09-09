"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ButtonBusyLabel } from "@/app/components/loading-indicator";
import {
  createContextIngestionConnection,
  joinContextIngestion,
  onContextIngestionEvent,
} from "@/app/auth/context-ingestion-hub";
import {
  currentVersion,
  normalizeCatalog,
  type ContextKind,
  type GovernedCatalogItem,
  type GovernedVersion,
  type IngestionEvent,
} from "./context-contract";
import { uploadContextFile } from "./direct-upload";

const CATALOGS = [
  { kind: "knowledge", path: "knowledge", label: "Knowledge" },
  { kind: "brand-kit", path: "brand-kits", label: "Brand Kits" },
  { kind: "audience", path: "audiences", label: "Audiences" },
  { kind: "style-guide", path: "style-guides", label: "Style Guides" },
  { kind: "product", path: "products", label: "Products" },
] as const;

type CatalogDefinition = (typeof CATALOGS)[number];

function statusClass(status: string): string {
  if (status === "approved" || status === "ready") return "bg-emerald-50 text-emerald-800";
  if (status === "revoked" || status === "failed") return "bg-red-50 text-red-800";
  if (status === "deprecated" || status === "stale" || status === "expired") return "bg-amber-50 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

function VersionDetail({ version }: { version: GovernedVersion }) {
  return (
    <div className="mt-4 grid gap-4 border-t border-[var(--cc-line)] pt-4 text-xs sm:grid-cols-2">
      <div><dt className="font-semibold">Immutable digest</dt><dd className="break-all font-mono">{version.digest}</dd></div>
      <div><dt className="font-semibold">Created</dt><dd>{new Date(version.createdAtUtc).toLocaleString()}</dd></div>
      <div><dt className="font-semibold">Freshness</dt><dd>{version.freshness ?? "Not reported"}</dd></div>
      <div><dt className="font-semibold">Ingestion</dt><dd>{version.ingestionState ?? "Not applicable"}</dd></div>
      <div><dt className="font-semibold">Extraction</dt><dd>{version.extractionState ?? "Not applicable"}</dd></div>
      <div><dt className="font-semibold">Index</dt><dd>{version.indexState ?? "Not applicable"}</dd></div>
      {version.provenance ? (
        <div className="sm:col-span-2">
          <dt className="font-semibold">Provenance</dt>
          <dd>
            {version.provenance.sourceUrl ? (
              <a className="text-[var(--cc-accent)] underline" href={version.provenance.sourceUrl} target="_blank" rel="noreferrer">
                {version.provenance.sourceLabel || version.provenance.sourceUrl}
              </a>
            ) : version.provenance.sourceLabel || "Private upload"}
            {version.provenance.parser ? ` · ${version.provenance.parser} ${version.provenance.parserVersion ?? ""}` : ""}
          </dd>
        </div>
      ) : null}
      {version.findings?.length ? (
        <div className="sm:col-span-2">
          <dt className="font-semibold">Findings</dt>
          <dd><ul className="mt-1 list-disc pl-4">{version.findings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul></dd>
        </div>
      ) : null}
      {version.audit?.length ? (
        <div className="sm:col-span-2">
          <dt className="font-semibold">Audit history</dt>
          <dd><ol className="mt-1 space-y-1">{version.audit.map((entry) => <li key={entry.id}>{entry.action} · {entry.actor} · {new Date(entry.atUtc).toLocaleString()}</li>)}</ol></dd>
        </div>
      ) : null}
    </div>
  );
}

export function CatalogWorkspace() {
  const [active, setActive] = useState<CatalogDefinition>(CATALOGS[0]);
  const [items, setItems] = useState<GovernedCatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ingestionEvents, setIngestionEvents] = useState<IngestionEvent[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const ingestionLastSeq = useRef(0);

  const loadCatalog = useCallback(async (definition: CatalogDefinition) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/gcc-v2/${definition.path}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      const next = normalizeCatalog(body);
      setItems(next);
      setSelectedId(next[0]?.id ?? null);
      setSelectedVersionId(next[0] ? currentVersion(next[0])?.id ?? null : null);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Catalog unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadCatalog(active));
  }, [active, loadCatalog]);

  useEffect(() => {
    if (!showActivity) return;
    const connection = createContextIngestionConnection();
    const removeEvent = onContextIngestionEvent(connection, (event) => {
      ingestionLastSeq.current = Math.max(ingestionLastSeq.current, event.seq);
      setIngestionEvents((current) => [...current.filter((item) => item.id !== event.id), event]
        .sort((a, b) => b.seq - a.seq));
    });
    const rejoin = async () => {
      try {
        await connection.invoke("JoinContextIngestion", ingestionLastSeq.current);
      } catch {
        setError("Live ingestion updates disconnected. Reconnect catch-up will retry automatically.");
      }
    };
    connection.onreconnected(rejoin);
    void joinContextIngestion(connection, ingestionLastSeq.current).catch(() => {
      setError("Live ingestion updates are unavailable. Use Refresh history for a one-time catch-up.");
    });
    return () => {
      removeEvent();
      connection.off("reconnected", rejoin);
      void connection.stop();
    };
  }, [showActivity]);

  async function loadActivity() {
    setShowActivity(true);
    setError(null);
    const response = await fetch("/api/gcc-v2/context/ingestion/events", { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error || `Ingestion activity unavailable (HTTP ${response.status}).`);
      return;
    }
    const events = (Array.isArray(body) ? body : body?.events ?? []) as IngestionEvent[];
    ingestionLastSeq.current = Math.max(ingestionLastSeq.current, ...events.map((event) => event.seq), 0);
    setIngestionEvents(events.sort((a, b) => b.seq - a.seq));
  }

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedVersion = selected?.versions.find((version) => version.id === selectedVersionId)
    ?? (selected ? currentVersion(selected) : null);
  const filtered = useMemo(() => items.filter((item) => {
    const version = currentVersion(item);
    const matchesQuery = `${item.name} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (lifecycle === "all" || version?.lifecycle === lifecycle);
  }), [items, lifecycle, query]);

  async function lifecycleAction(action: string) {
    if (!selected || !selectedVersion) return;
    setActionBusy(action);
    setNotice(null);
    try {
      const lifecyclePath = active.kind === "knowledge"
        ? `${active.path}/${encodeURIComponent(selected.id)}/${action}`
        : `${active.path}/versions/${encodeURIComponent(selectedVersion.id)}/${action}`;
      const response = await fetch(`/api/gcc-v2/${lifecyclePath}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId: selectedVersion.id }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      setNotice(`${selected.name} ${action === "review" ? "submitted for review" : `${action}d`}.`);
      await loadCatalog(active);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lifecycle action failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function createDraft() {
    const name = window.prompt(`Name this ${active.label.toLowerCase()} record:`);
    if (!name?.trim()) return;
    setActionBusy("create");
    const response = await fetch(`/api/gcc-v2/${active.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: "", data: {} }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error || `Draft creation failed (HTTP ${response.status}).`);
    else {
      setNotice(`${name.trim()} draft created.`);
      await loadCatalog(active);
    }
    setActionBusy(null);
  }

  async function uploadKnowledge(file: File) {
    setActionBusy("upload");
    setNotice(null);
    try {
      const completion = await uploadContextFile(
        file,
        { kind: "knowledge", assetId: selected?.id },
        setNotice,
      );
      setNotice(`Upload verified. Ingestion job ${completion.ingestionJobId} is ${completion.state}.`);
      await loadCatalog(active);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Governed context</p>
          <h1 className="mt-2 text-3xl font-bold">Brand &amp; Sources</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--cc-muted)]">Versioned, owner-scoped context with review, provenance, freshness, and ingestion state.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadActivity()} className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-semibold">Connections &amp; activity</button>
          <button type="button" disabled={actionBusy !== null} onClick={() => void createDraft()} className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <ButtonBusyLabel busy={actionBusy === "create"} busyLabel="Creating…" idleLabel="New draft" />
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--cc-line)]" role="tablist" aria-label="Brand and source catalogs">
        {CATALOGS.map((definition) => (
          <button key={definition.kind} type="button" role="tab" aria-selected={active.kind === definition.kind && !showActivity} onClick={() => { setShowActivity(false); setActive(definition); }} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${active.kind === definition.kind && !showActivity ? "border-[var(--cc-accent)] text-[var(--cc-accent)]" : "border-transparent text-[var(--cc-muted)]"}`}>
            {definition.label}
          </button>
        ))}
      </div>

      {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p> : null}

      {showActivity ? (
        <section className="mt-6">
          <h2 className="text-xl font-bold">Ingestion activity</h2>
          <p className="mt-1 text-sm text-[var(--cc-muted)]">Live updates arrive over the platform connection. This history is loaded only on entry or manual refresh.</p>
          <button type="button" onClick={() => void loadActivity()} className="mt-3 rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-semibold">Refresh history</button>
          <ol className="mt-4 space-y-2">
            {ingestionEvents.map((event) => <li key={event.id} className="rounded-lg border border-[var(--cc-line)] bg-white p-4 text-sm"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(event.state)}`}>{event.state}</span><strong className="ml-2">{event.message}</strong><span className="mt-1 block text-xs text-[var(--cc-muted)]">Job {event.jobId} · sequence {event.seq} · {new Date(event.createdAtUtc).toLocaleString()}</span></li>)}
          </ol>
        </section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
          <section>
            <div className="flex gap-2">
              <input aria-label={`Search ${active.label}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${active.label.toLowerCase()}`} className="min-w-0 flex-1 rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm" />
              <select aria-label="Lifecycle filter" value={lifecycle} onChange={(event) => setLifecycle(event.target.value)} className="rounded-md border border-[var(--cc-line)] bg-white px-2 text-sm"><option value="all">All states</option><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option><option value="deprecated">Deprecated</option><option value="revoked">Revoked</option></select>
            </div>
            {active.kind === "knowledge" ? <label className="mt-3 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-[var(--cc-accent)] bg-teal-50 px-3 py-3 text-sm font-semibold text-[var(--cc-accent)]">Upload source<input type="file" className="sr-only" disabled={actionBusy !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadKnowledge(file); }} /></label> : null}
            {loading ? <p className="mt-4 text-sm text-[var(--cc-muted)]">Loading catalog…</p> : null}
            <ul className="mt-3 space-y-2">{filtered.map((item) => { const version = currentVersion(item); return <li key={item.id}><button type="button" onClick={() => { setSelectedId(item.id); setSelectedVersionId(version?.id ?? null); }} className={`w-full rounded-lg border bg-white p-4 text-left ${selectedId === item.id ? "border-[var(--cc-accent)] ring-1 ring-[var(--cc-accent)]" : "border-[var(--cc-line)]"}`}><span className="font-semibold">{item.name}</span><span className="mt-1 block text-xs text-[var(--cc-muted)]">{item.description || "No description"}</span>{version ? <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${statusClass(version.lifecycle)}`}>v{version.versionNumber} · {version.lifecycle}</span> : null}</button></li>; })}</ul>
          </section>

          <section className="rounded-xl border border-[var(--cc-line)] bg-white p-5">
            {selected && selectedVersion ? <>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{selected.name}</h2><p className="mt-1 text-sm text-[var(--cc-muted)]">{selected.description || "No description provided."}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(selectedVersion.lifecycle)}`}>{selectedVersion.lifecycle}</span></div>
              <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-semibold">Exact version<select aria-label="Exact version" className="mt-1 block rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm" value={selectedVersion.id} onChange={(event) => setSelectedVersionId(event.target.value)}>{[...selected.versions].sort((a, b) => b.versionNumber - a.versionNumber).map((version) => <option key={version.id} value={version.id}>Version {version.versionNumber} · {version.lifecycle}</option>)}</select></label>{active.kind !== "brand-kit" ? ["review", "approve", "deprecate", "revoke"].map((action) => <button key={action} type="button" disabled={actionBusy !== null || selectedVersion.lifecycle === "revoked"} onClick={() => void lifecycleAction(action)} className="rounded-md border border-[var(--cc-line)] px-3 py-2 text-xs font-semibold capitalize disabled:opacity-40">{actionBusy === action ? "Working…" : action}</button>) : null}</div>
              {selected.versions.length > 1 ? <p className="mt-3 text-xs text-[var(--cc-muted)]">Compare versions by selecting an immutable revision. Approved content is never edited in place.</p> : null}
              <dl><VersionDetail version={selectedVersion} /></dl>
            </> : <p className="text-sm text-[var(--cc-muted)]">Select a catalog record to inspect its exact version.</p>}
          </section>
        </div>
      )}
    </main>
  );
}

export type { ContextKind };

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeCatalog,
  normalizeContextPreview,
  type ContextSelectionRequest,
  type GovernedCatalogItem,
  type ResolvedContextPreview,
} from "@/app/brand-sources/context-contract";
import { uploadContextFile } from "@/app/brand-sources/direct-upload";

type ContextSelectorProps = {
  createId?: string | null;
  value: ContextSelectionRequest;
  selectedAgentIds: string[];
  onChange: (selection: ContextSelectionRequest) => void;
  onPreviewChange: (preview: ResolvedContextPreview | null) => void;
  onProcessingChange: (processing: boolean) => void;
};

type Catalogs = {
  knowledge: GovernedCatalogItem[];
  brandKits: GovernedCatalogItem[];
  audiences: GovernedCatalogItem[];
  styleGuides: GovernedCatalogItem[];
  products: GovernedCatalogItem[];
};

const EMPTY_CATALOGS: Catalogs = {
  knowledge: [],
  brandKits: [],
  audiences: [],
  styleGuides: [],
  products: [],
};

function approvedOptions(items: GovernedCatalogItem[]) {
  return items.flatMap((item) => item.versions
    .filter((version) => version.lifecycle === "approved" || version.lifecycle === "deprecated")
    .map((version) => ({ item, version })));
}

export function ContextSelector({
  createId,
  value,
  selectedAgentIds,
  onChange,
  onPreviewChange,
  onProcessingChange,
}: ContextSelectorProps) {
  const [catalogs, setCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [loading, setLoading] = useState(true);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResolvedContextPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const entries = [
      ["knowledge", "knowledge"],
      ["brandKits", "brand-kits"],
      ["audiences", "audiences"],
      ["styleGuides", "style-guides"],
      ["products", "products"],
    ] as const;
    void Promise.all(entries.map(async ([key, path]) => {
      const response = await fetch(`/api/gcc-v2/${path}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`${path}: ${body?.error || `HTTP ${response.status}`}`);
      return [key, normalizeCatalog(body)] as const;
    })).then((results) => {
      setCatalogs(Object.fromEntries(results) as Catalogs);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Context catalogs unavailable.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => onProcessingChange(uploadBusy), [onProcessingChange, uploadBusy]);

  const knowledgeOptions = useMemo(() => approvedOptions(catalogs.knowledge), [catalogs.knowledge]);
  const brandKitOptions = useMemo(() => approvedOptions(catalogs.brandKits), [catalogs.brandKits]);
  const audienceOptions = useMemo(() => approvedOptions(catalogs.audiences), [catalogs.audiences]);
  const styleOptions = useMemo(() => approvedOptions(catalogs.styleGuides), [catalogs.styleGuides]);
  const productOptions = useMemo(() => approvedOptions(catalogs.products), [catalogs.products]);

  const resolveContext = useCallback(async () => {
    setPreflightBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/gcc-v2/context/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          createId: createId || undefined,
          selection: value,
          selectedAgentIds,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `Context preflight failed (HTTP ${response.status}).`);
      const next = normalizeContextPreview(body);
      setPreview(next);
      onPreviewChange(next);
    } catch (cause) {
      setPreview(null);
      onPreviewChange(null);
      setError(cause instanceof Error ? cause.message : "Context preflight failed.");
    } finally {
      setPreflightBusy(false);
    }
  }, [createId, onPreviewChange, selectedAgentIds, value]);

  async function uploadAttachment(file: File) {
    if (!createId) return;
    setUploadBusy(true);
    setError(null);
    try {
      const completion = await uploadContextFile(file, { kind: "attachment", createId }, setUploadMessage);
      if (!completion.attachmentId) throw new Error("Upload completed without an attachment ID.");
      onChange({ ...value, runAttachmentIds: [...value.runAttachmentIds, completion.attachmentId] });
      setUploadMessage(`${file.name} is ${completion.state}. Run context must be checked again after ingestion.`);
      setPreview(null);
      onPreviewChange(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Attachment upload failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  function setSingle(field: "brandKitVersionId" | "audienceVersionId" | "styleGuideVersionId", next: string) {
    onChange({ ...value, [field]: next || undefined });
    setPreview(null);
    onPreviewChange(null);
  }

  return (
    <section className="mt-5 rounded-xl border border-teal-200 bg-teal-50/40 p-5" aria-label="Run context">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-bold text-[var(--cc-ink)]">Run context</h3><p className="mt-1 text-xs text-[var(--cc-muted)]">Choose immutable versions. The server rechecks ownership, lifecycle, freshness, and compatibility.</p></div>
        <a href="/brand-sources" className="text-xs font-semibold text-[var(--cc-accent)] underline">Manage Brand &amp; Sources</a>
      </div>
      {loading ? <p className="mt-4 text-sm text-[var(--cc-muted)]">Loading governed catalogs…</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-800">{error}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {([
          ["Brand Kit", "brandKitVersionId", brandKitOptions],
          ["Audience", "audienceVersionId", audienceOptions],
          ["Style Guide", "styleGuideVersionId", styleOptions],
        ] as const).map(([label, field, options]) => (
          <label key={field} className="text-xs font-semibold">{label}
            <select aria-label={label} value={value[field] ?? ""} onChange={(event) => setSingle(field, event.target.value)} className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal">
              <option value="">Use owner/create default</option>
              {options.map(({ item, version }) => <option key={version.id} value={version.id}>{item.name} · v{version.versionNumber}{version.lifecycle === "deprecated" ? " (deprecated)" : ""}</option>)}
            </select>
          </label>
        ))}
        <label className="text-xs font-semibold">Locale
          <input aria-label="Context locale" value={value.locale} onChange={(event) => onChange({ ...value, locale: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal" />
        </label>
      </div>

      <fieldset className="mt-4"><legend className="text-xs font-semibold">Knowledge</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{knowledgeOptions.map(({ item, version }) => <label key={version.id} className="flex gap-2 rounded-md border border-[var(--cc-line)] bg-white p-3 text-xs"><input type="checkbox" aria-label={`${item.name} version ${version.versionNumber}`} checked={value.knowledgeAssetVersionIds.includes(version.id)} onChange={() => onChange({ ...value, knowledgeAssetVersionIds: value.knowledgeAssetVersionIds.includes(version.id) ? value.knowledgeAssetVersionIds.filter((id) => id !== version.id) : [...value.knowledgeAssetVersionIds, version.id] })} /><span><strong>{item.name}</strong><span className="block text-[var(--cc-muted)]">Version {version.versionNumber} · {version.freshness ?? version.lifecycle}</span></span></label>)}</div></fieldset>

      <fieldset className="mt-4"><legend className="text-xs font-semibold">Products</legend><div className="mt-2 flex flex-wrap gap-2">{productOptions.map(({ item, version }) => <label key={version.id} className="flex gap-2 rounded-full border border-[var(--cc-line)] bg-white px-3 py-2 text-xs"><input type="checkbox" aria-label={`${item.name} product version ${version.versionNumber}`} checked={value.productSelections.some((selection) => selection.productVersionId === version.id)} onChange={() => onChange({ ...value, productSelections: value.productSelections.some((selection) => selection.productVersionId === version.id) ? value.productSelections.filter((selection) => selection.productVersionId !== version.id) : [...value.productSelections, { productVersionId: version.id, selectedFieldIds: [] }] })} />{item.name} v{version.versionNumber}</label>)}</div></fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex gap-2 rounded-md bg-white p-3 text-xs"><input type="checkbox" checked={value.webSearchEnabled} onChange={(event) => onChange({ ...value, webSearchEnabled: event.target.checked })} /><span><strong>Web search</strong><span className="block text-[var(--cc-muted)]">Optional current public research.</span></span></label>
        <label className="flex gap-2 rounded-md bg-white p-3 text-xs"><input type="checkbox" checked={value.knowledgeSearchEnabled} onChange={(event) => onChange({ ...value, knowledgeSearchEnabled: event.target.checked })} /><span><strong>Knowledge search</strong><span className="block text-[var(--cc-muted)]">Search only manifest-approved revisions.</span></span></label>
      </div>

      <label className="mt-4 block text-xs font-semibold">Run notes<textarea aria-label="Run context notes" value={value.runNotes ?? ""} onChange={(event) => onChange({ ...value, runNotes: event.target.value })} className="mt-1 min-h-16 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal" /></label>

      <div className="mt-4 rounded-lg border border-dashed border-teal-300 bg-white p-4">
        <p className="text-xs font-semibold">Temporary attachments · this run only</p>
        <p className="mt-1 text-xs text-[var(--cc-muted)]">Attachments never become persistent Knowledge automatically.</p>
        {createId ? <label className="mt-2 inline-flex cursor-pointer rounded-md border border-[var(--cc-line)] px-3 py-2 text-xs font-semibold">Choose attachment<input type="file" className="sr-only" disabled={uploadBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); }} /></label> : <p className="mt-2 text-xs text-amber-800">Save the create from this review step before adding a run attachment.</p>}
        {uploadMessage ? <p role="status" className="mt-2 text-xs">{uploadMessage}</p> : null}
        {value.runAttachmentIds.length ? <ul className="mt-2 list-disc pl-4 text-xs">{value.runAttachmentIds.map((id) => <li key={id} className="font-mono">{id}</li>)}</ul> : null}
      </div>

      <button type="button" disabled={preflightBusy || uploadBusy || loading} onClick={() => void resolveContext()} className="mt-4 rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{preflightBusy ? "Checking context…" : "Check context"}</button>

      {preview ? <div className="mt-4 rounded-lg border border-[var(--cc-line)] bg-white p-4" aria-label="Effective context preflight">
        <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">Effective context preflight</h4><span className="text-xs text-[var(--cc-muted)]">{preview.estimatedContextSize.toLocaleString()} estimated units</span></div>
        {[...preview.inheritedEntries, ...preview.effectiveEntries].length ? <ul className="mt-2 space-y-1 text-xs">{[...preview.inheritedEntries, ...preview.effectiveEntries].map((entry) => <li key={`${entry.kind}-${entry.versionId}`}><strong>{entry.name}</strong> · v{entry.versionNumber ?? "?"} · {entry.lifecycle ?? "resolved"}{entry.inherited ? " · inherited" : ""}{entry.temporary ? " · temporary" : ""}{entry.freshness ? ` · ${entry.freshness}` : ""}</li>)}</ul> : <p className="mt-2 text-xs text-[var(--cc-muted)]">Only the persisted brief and platform defaults are effective.</p>}
        {preview.warnings.length ? <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900"><strong>Warnings</strong><ul className="mt-1 list-disc pl-4">{preview.warnings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul></div> : null}
        {preview.blockingFindings.length ? <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-900"><strong>Generation blocked</strong><ul className="mt-1 list-disc pl-4">{preview.blockingFindings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul></div> : <p className="mt-3 text-xs font-semibold text-emerald-700">Context is eligible for manifest resolution.</p>}
        {preview.agentCompatibility.length ? <ul className="mt-3 text-xs">{preview.agentCompatibility.map((agent) => <li key={agent.agentId}>{agent.agentId}: {agent.compatible ? "compatible" : agent.message || "not compatible"}</li>)}</ul> : null}
      </div> : null}
    </section>
  );
}

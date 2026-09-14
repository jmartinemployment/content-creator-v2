"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  geekIqEmptyFieldCopy,
  geekIqKnowledgeEmptyCopy,
  geekIqProductsEmptyCopy,
  shouldShowGeekIqFullEmptyState,
  type GeekIqSingleSelectField,
} from "./geek-iq-catalog-ui";
import {
  normalizeCatalog,
  normalizeContextPreview,
  type ContextSelectionRequest,
  type GovernedCatalogItem,
  type ResolvedContextPreview,
} from "@/app/brand-sources/context-contract";
import { uploadContextFile } from "@/app/brand-sources/direct-upload";
import {
  normalizeProductSchemaPolicy,
  type ProductSchemaField,
} from "@/app/brand-sources/product-policy";

type ContextSelectorProps = {
  createId?: string | null;
  /** Creates a create id when attachments need one and Review opened without a save step. */
  ensureCreateId?: () => Promise<string>;
  /** Draft brief JSON persisted on first resolve when no brief exists yet. */
  rawBriefJson?: string | null;
  value: ContextSelectionRequest;
  selectedAgentIds: string[];
  onChange: (selection: ContextSelectionRequest) => void;
  onPreviewChange: (preview: ResolvedContextPreview | null) => void;
  onProcessingChange: (processing: boolean) => void;
  /** Defaults to create-flow resolve. Use task-agent endpoint when createId is absent. */
  resolvePath?: string;
  allowAttachments?: boolean;
  checkLabel?: string;
};

type AttachmentStatusRow = {
  id: string;
  name: string;
  state: string;
};

type Catalogs = {
  knowledge: GovernedCatalogItem[];
  brandKits: GovernedCatalogItem[];
  audiences: GovernedCatalogItem[];
  styleGuides: GovernedCatalogItem[];
  visualGuidelines: GovernedCatalogItem[];
  products: GovernedCatalogItem[];
  productSchemas: GovernedCatalogItem[];
};

const EMPTY_CATALOGS: Catalogs = {
  knowledge: [],
  brandKits: [],
  audiences: [],
  styleGuides: [],
  visualGuidelines: [],
  products: [],
  productSchemas: [],
};

function approvedOptions(items: GovernedCatalogItem[]) {
  return items.flatMap((item) => item.versions
    .filter((version) => version.lifecycle === "approved" || version.lifecycle === "deprecated")
    .map((version) => ({ item, version })));
}

function schemaFieldsForProduct(
  productVersion: { productSchemaVersionId?: string | null },
  schemas: GovernedCatalogItem[],
): ProductSchemaField[] {
  const schemaVersionId = productVersion.productSchemaVersionId;
  if (!schemaVersionId) return [];
  for (const item of schemas) {
    const version = item.versions.find((entry) => entry.id === schemaVersionId);
    if (version) return normalizeProductSchemaPolicy(version.data).fields;
  }
  return [];
}

export function ContextSelector({
  createId,
  ensureCreateId,
  rawBriefJson,
  value,
  selectedAgentIds,
  onChange,
  onPreviewChange,
  onProcessingChange,
  resolvePath,
  allowAttachments = true,
  checkLabel,
}: ContextSelectorProps) {
  const [catalogs, setCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [loading, setLoading] = useState(true);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [ensuringCreate, setEnsuringCreate] = useState(false);
  const [activeCreateId, setActiveCreateId] = useState<string | null>(createId ?? null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentStatuses, setAttachmentStatuses] = useState<Record<string, AttachmentStatusRow>>({});
  const attachmentStatusesRef = useRef(attachmentStatuses);
  attachmentStatusesRef.current = attachmentStatuses;
  const [preview, setPreview] = useState<ResolvedContextPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveCreateId(createId ?? null);
  }, [createId]);

  useEffect(() => {
    const controller = new AbortController();
    const entries = [
      ["knowledge", "knowledge"],
      ["brandKits", "brand-kits"],
      ["audiences", "audiences"],
      ["styleGuides", "style-guides"],
      ["visualGuidelines", "visual-guidelines"],
      ["products", "products"],
      ["productSchemas", "product-schemas"],
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

  useEffect(() => {
    const pending = value.runAttachmentIds.some((id) => {
      const state = (attachmentStatuses[id]?.state ?? "queued").toLowerCase();
      return state !== "ready" && state !== "failed";
    });
    onProcessingChange(uploadBusy || ensuringCreate || pending);
  }, [attachmentStatuses, ensuringCreate, onProcessingChange, uploadBusy, value.runAttachmentIds]);

  const knowledgeOptions = useMemo(() => approvedOptions(catalogs.knowledge), [catalogs.knowledge]);
  const brandKitOptions = useMemo(() => approvedOptions(catalogs.brandKits), [catalogs.brandKits]);
  const audienceOptions = useMemo(() => approvedOptions(catalogs.audiences), [catalogs.audiences]);
  const styleOptions = useMemo(() => approvedOptions(catalogs.styleGuides), [catalogs.styleGuides]);
  const visualOptions = useMemo(() => approvedOptions(catalogs.visualGuidelines), [catalogs.visualGuidelines]);
  const productOptions = useMemo(() => approvedOptions(catalogs.products), [catalogs.products]);

  const catalogCounts = useMemo(() => ({
    brandKits: brandKitOptions.length,
    audiences: audienceOptions.length,
    styleGuides: styleOptions.length,
    visualGuidelines: visualOptions.length,
    knowledge: knowledgeOptions.length,
    products: productOptions.length,
  }), [
    audienceOptions.length,
    brandKitOptions.length,
    knowledgeOptions.length,
    productOptions.length,
    styleOptions.length,
    visualOptions.length,
  ]);
  const fullEmptyState = !loading && shouldShowGeekIqFullEmptyState(catalogCounts);

  const canCheckContext = Boolean(resolvePath || activeCreateId || ensureCreateId);

  const resolveCreateId = useCallback(async (): Promise<string> => {
    if (activeCreateId) return activeCreateId;
    if (!ensureCreateId) {
      throw new Error("Save or continue until this create exists before attaching files.");
    }
    setEnsuringCreate(true);
    setUploadMessage("Preparing this create…");
    try {
      const id = await ensureCreateId();
      setActiveCreateId(id);
      return id;
    } finally {
      setEnsuringCreate(false);
    }
  }, [activeCreateId, ensureCreateId]);

  const resolveContext = useCallback(async () => {
    const endpoint = resolvePath
      ?? (activeCreateId || ensureCreateId ? "/api/gcc-v2/context/resolve" : null);
    if (!endpoint) {
      setError("Context is checked automatically when the create is saved.");
      return;
    }
    setPreflightBusy(true);
    setError(null);
    try {
      const taskAgent = endpoint.includes("resolve-task-agent");
      const ensuredId = taskAgent ? null : await resolveCreateId();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          taskAgent
            ? { selection: value, selectedAgentIds }
            : {
              createId: ensuredId || undefined,
              selection: value,
              selectedAgentIds,
              ...(rawBriefJson ? { rawBriefJson } : {}),
            },
        ),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `Context preflight failed (HTTP ${response.status}).`);
      const next = normalizeContextPreview(taskAgent ? (body?.preview ?? body) : body);
      setPreview(next);
      onPreviewChange(next);
    } catch (cause) {
      setPreview(null);
      onPreviewChange(null);
      setError(cause instanceof Error ? cause.message : "Context preflight failed.");
    } finally {
      setPreflightBusy(false);
    }
  }, [activeCreateId, ensureCreateId, onPreviewChange, rawBriefJson, resolveCreateId, resolvePath, selectedAgentIds, value]);

  useEffect(() => {
    const ids = value.runAttachmentIds;
    if (!activeCreateId || ids.length === 0) return;
    let cancelled = false;
    const poll = async () => {
      const nextRows: Record<string, AttachmentStatusRow> = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const response = await fetch(
            `/api/gcc-v2/creates/${encodeURIComponent(activeCreateId)}/attachments/${encodeURIComponent(id)}`,
            { cache: "no-store" },
          );
          const body = await response.json().catch(() => null) as {
            safeFileName?: string;
            ingestionState?: string;
          } | null;
          if (!response.ok || !body || cancelled) return;
          nextRows[id] = {
            id,
            name: body.safeFileName || id,
            state: body.ingestionState ?? "queued",
          };
        } catch {
          /* keep polling */
        }
      }));
      if (cancelled || Object.keys(nextRows).length === 0) return;
      let becameReady = false;
      for (const [id, row] of Object.entries(nextRows)) {
        const previous = (attachmentStatusesRef.current[id]?.state ?? "").toLowerCase();
        if (previous !== "ready" && row.state.toLowerCase() === "ready") becameReady = true;
      }
      setAttachmentStatuses((current) => ({ ...current, ...nextRows }));
      if (becameReady) void resolveContext();
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeCreateId, resolveContext, value.runAttachmentIds]);

  async function uploadAttachment(file: File) {
    setUploadBusy(true);
    setError(null);
    try {
      const id = await resolveCreateId();
      const completion = await uploadContextFile(file, { kind: "attachment", createId: id }, setUploadMessage);
      if (!completion.attachmentId) throw new Error("Upload completed without an attachment ID.");
      setAttachmentStatuses((current) => ({
        ...current,
        [completion.attachmentId!]: {
          id: completion.attachmentId!,
          name: file.name,
          state: completion.state || "queued",
        },
      }));
      onChange({ ...value, runAttachmentIds: [...value.runAttachmentIds, completion.attachmentId] });
      setUploadMessage(`${file.name} is ${completion.state}. Waiting until ingestion is ready…`);
      // Keep Confirm blocked: pending gate treats missing ready preflight as blocked.
      setPreview(null);
      onPreviewChange(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Attachment upload failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function addAttachmentFromUrl() {
    const url = attachmentUrl.trim();
    if (!url) {
      setError("Enter a public http(s) URL to attach to this run.");
      return;
    }
    setUploadBusy(true);
    setError(null);
    setUploadMessage(null);
    try {
      const id = await resolveCreateId();
      const response = await fetch(`/api/gcc-v2/creates/${id}/attachments/from-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || `URL attachment failed (HTTP ${response.status}).`);
      }
      const attachmentId = typeof body?.attachmentId === "string" ? body.attachmentId : null;
      if (!attachmentId) throw new Error("URL attach completed without an attachment ID.");
      setAttachmentStatuses((current) => ({
        ...current,
        [attachmentId]: {
          id: attachmentId,
          name: body?.title || body?.safeFileName || body?.finalUrl || url,
          state: body?.state ?? "queued",
        },
      }));
      onChange({ ...value, runAttachmentIds: [...value.runAttachmentIds, attachmentId] });
      setAttachmentUrl("");
      setUploadMessage(
        `${body?.title || body?.finalUrl || url} is ${body?.state ?? "queued"}. Waiting until ingestion is ready…`,
      );
      setPreview(null);
      onPreviewChange(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "URL attachment failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    setUploadBusy(true);
    setError(null);
    try {
      const id = await resolveCreateId();
      const response = await fetch(
        `/api/gcc-v2/creates/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" },
      );
      if (!response.ok && response.status !== 404) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Remove failed (HTTP ${response.status}).`);
      }
      onChange({
        ...value,
        runAttachmentIds: value.runAttachmentIds.filter((entry) => entry !== attachmentId),
      });
      setAttachmentStatuses((current) => {
        const next = { ...current };
        delete next[attachmentId];
        return next;
      });
      setUploadMessage("Attachment removed from this run.");
      await resolveContext();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove attachment.");
    } finally {
      setUploadBusy(false);
    }
  }

  function setSingle(field: "brandKitVersionId" | "audienceVersionId" | "styleGuideVersionId" | "visualGuidelineVersionId", next: string) {
    onChange({ ...value, [field]: next || undefined });
    setPreview(null);
    onPreviewChange(null);
  }

  function toggleProduct(versionId: string, fields: ProductSchemaField[]) {
    const selected = value.productSelections.some((selection) => selection.productVersionId === versionId);
    onChange({
      ...value,
      productSelections: selected
        ? value.productSelections.filter((selection) => selection.productVersionId !== versionId)
        : [
          ...value.productSelections,
          { productVersionId: versionId, selectedFieldIds: fields.map((field) => field.id) },
        ],
    });
    setPreview(null);
    onPreviewChange(null);
  }

  function toggleProductField(versionId: string, fieldId: string, availableFieldIds: string[]) {
    const existing = value.productSelections.find((selection) => selection.productVersionId === versionId);
    if (!existing) return;
    const current = existing.selectedFieldIds.length ? existing.selectedFieldIds : availableFieldIds;
    const nextIds = current.includes(fieldId)
      ? current.filter((id) => id !== fieldId)
      : [...current, fieldId];
    onChange({
      ...value,
      productSelections: value.productSelections.map((selection) =>
        (selection.productVersionId === versionId
          ? { ...selection, selectedFieldIds: nextIds }
          : selection)),
    });
    setPreview(null);
    onPreviewChange(null);
  }

  return (
    <section className="mt-5 rounded-xl border border-teal-200 bg-teal-50/40 p-5" aria-label="Geek IQ">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-[var(--cc-ink)]">Geek IQ</h3>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            How this run should represent the organization — Brand Voice, Audience, Style Guide, Visual Guidelines,
            Knowledge, and Products. Independent of the task inputs above.
          </p>
        </div>
        <a href="/brand-sources" className="text-xs font-semibold text-[var(--cc-accent)] underline">
          {fullEmptyState ? "Set up Geek IQ" : "Manage Geek IQ"}
        </a>
      </div>
      {loading ? <p className="mt-4 text-sm text-[var(--cc-muted)]">Loading Geek IQ catalogs…</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-800">{error}</p> : null}

      {!loading && fullEmptyState ? (
        <div
          className="mt-4 rounded-lg border border-teal-200 bg-white p-4"
          aria-label="Geek IQ empty state"
          data-testid="geek-iq-empty-state"
        >
          <p className="text-sm text-[var(--cc-ink)]">
            No approved Geek IQ items yet. Catalogs are optional for this run — Locale, search, notes, and Check
            still work. Selectors unlock after you approve Brand Voice, Audience, Style, Visual, Knowledge, or
            Products.
          </p>
          <a
            href="/brand-sources"
            className="mt-3 inline-flex rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Set up Geek IQ
          </a>
        </div>
      ) : null}

      {!loading && !fullEmptyState ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="geek-iq-catalog-fields">
            {([
              ["Brand Voice", "brandKitVersionId", brandKitOptions],
              ["Audience", "audienceVersionId", audienceOptions],
              ["Style Guide", "styleGuideVersionId", styleOptions],
              ["Visual Guidelines", "visualGuidelineVersionId", visualOptions],
            ] as const).map(([label, field, options]) => (
              options.length > 0 ? (
                <label key={field} className="text-xs font-semibold">{label}
                  <select
                    aria-label={label}
                    value={value[field] ?? ""}
                    onChange={(event) => setSingle(field, event.target.value)}
                    className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal"
                  >
                    <option value="">Use saved default</option>
                    {options.map(({ item, version }) => (
                      <option key={version.id} value={version.id}>
                        {item.name} · v{version.versionNumber}
                        {version.lifecycle === "deprecated" ? " (deprecated)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <GeekIqEmptyFieldNote key={field} field={field} />
              )
            ))}
            <label className="text-xs font-semibold">Locale
              <input aria-label="Context locale" value={value.locale} onChange={(event) => onChange({ ...value, locale: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal" />
            </label>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold">Additional approved sources</legend>
            {knowledgeOptions.length ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {knowledgeOptions.map(({ item, version }) => (
                  <label key={version.id} className="flex gap-2 rounded-md border border-[var(--cc-line)] bg-white p-3 text-xs">
                    <input
                      type="checkbox"
                      aria-label={`${item.name} version ${version.versionNumber}`}
                      checked={value.knowledgeAssetVersionIds.includes(version.id)}
                      onChange={() => onChange({
                        ...value,
                        knowledgeAssetVersionIds: value.knowledgeAssetVersionIds.includes(version.id)
                          ? value.knowledgeAssetVersionIds.filter((id) => id !== version.id)
                          : [...value.knowledgeAssetVersionIds, version.id],
                      })}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <span className="block text-[var(--cc-muted)]">Version {version.versionNumber} · {version.freshness ?? version.lifecycle}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <GeekIqCatalogNote copy={geekIqKnowledgeEmptyCopy()} />
            )}
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold">Products</legend>
            {productOptions.length ? (
              <div className="mt-2 space-y-3">
                {productOptions.map(({ item, version }) => {
                  const fields = schemaFieldsForProduct(version, catalogs.productSchemas);
                  const selection = value.productSelections.find((entry) => entry.productVersionId === version.id);
                  const selectedFieldIds = selection
                    ? (selection.selectedFieldIds.length ? selection.selectedFieldIds : fields.map((field) => field.id))
                    : [];
                  return (
                    <div key={version.id} className="rounded-md border border-[var(--cc-line)] bg-white p-3">
                      <label className="flex gap-2 text-xs">
                        <input
                          type="checkbox"
                          aria-label={`${item.name} product version ${version.versionNumber}`}
                          checked={Boolean(selection)}
                          onChange={() => toggleProduct(version.id, fields)}
                        />
                        <span>
                          <strong>{item.name}</strong>
                          <span className="block text-[var(--cc-muted)]">Version {version.versionNumber}</span>
                        </span>
                      </label>
                      {selection && fields.length ? (
                        <div className="mt-2 grid gap-1 sm:grid-cols-2" aria-label={`${item.name} product fields`}>
                          {fields.map((field) => (
                            <label key={field.id} className="flex gap-2 text-xs text-[var(--cc-muted)]">
                              <input
                                type="checkbox"
                                aria-label={`${item.name} field ${field.label}`}
                                checked={selectedFieldIds.includes(field.id)}
                                onChange={() => toggleProductField(
                                  version.id,
                                  field.id,
                                  fields.map((entry) => entry.id),
                                )}
                              />
                              {field.label}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <GeekIqCatalogNote copy={geekIqProductsEmptyCopy()} />
            )}
          </fieldset>
        </>
      ) : null}

      {!loading && fullEmptyState ? (
        <label className="mt-4 block text-xs font-semibold">Locale
          <input aria-label="Context locale" value={value.locale} onChange={(event) => onChange({ ...value, locale: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal" />
        </label>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex gap-2 rounded-md bg-white p-3 text-xs">
          <input type="checkbox" checked={value.webSearchEnabled} onChange={(event) => onChange({ ...value, webSearchEnabled: event.target.checked })} />
          <span><strong>Web search</strong><span className="block text-[var(--cc-muted)]">Optional current public research.</span></span>
        </label>
        <label className="flex gap-2 rounded-md bg-white p-3 text-xs">
          <input type="checkbox" checked={value.knowledgeSearchEnabled} onChange={(event) => onChange({ ...value, knowledgeSearchEnabled: event.target.checked })} />
          <span><strong>Search additional sources</strong><span className="block text-[var(--cc-muted)]">{fullEmptyState ? "Uses approved Knowledge once you add items in Geek IQ." : "Search only the approved references selected above."}</span></span>
        </label>
      </div>

      <label className="mt-4 block text-xs font-semibold">
        Run notes
        <textarea aria-label="Run context notes" value={value.runNotes ?? ""} onChange={(event) => onChange({ ...value, runNotes: event.target.value })} className="mt-1 min-h-16 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal" />
      </label>

      <div className="mt-4 rounded-lg border border-dashed border-teal-300 bg-white p-4">
        <p className="text-xs font-semibold">Temporary attachments · this run only</p>
        <p className="mt-1 text-xs text-[var(--cc-muted)]">Attachments never become persistent Knowledge automatically.</p>
        {!allowAttachments ? (
          <p className="mt-2 text-xs text-[var(--cc-muted)]">Task-agent runs pin approved catalog context only. Use create-flow jobs for temporary attachments.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {ensuringCreate ? (
              <p role="status" className="text-xs text-[var(--cc-muted)]">Preparing this create…</p>
            ) : null}
            <label className="inline-flex cursor-pointer rounded-md border border-[var(--cc-line)] px-3 py-2 text-xs font-semibold">
              Choose attachment
              <input
                type="file"
                className="sr-only"
                disabled={uploadBusy || ensuringCreate}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAttachment(file);
                }}
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[16rem] flex-1 text-xs font-semibold">
                Attachment URL
                <input
                  type="url"
                  aria-label="Attachment URL"
                  value={attachmentUrl}
                  disabled={uploadBusy || ensuringCreate}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                  placeholder="https://example.com/brief"
                  className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <button
                type="button"
                disabled={uploadBusy || ensuringCreate || !attachmentUrl.trim()}
                onClick={() => void addAttachmentFromUrl()}
                className="rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Add URL to this run
              </button>
            </div>
          </div>
        )}
        {uploadMessage ? <p role="status" className="mt-2 text-xs">{uploadMessage}</p> : null}
        {value.runAttachmentIds.length ? (
          <ul className="mt-2 space-y-1 text-xs">
            {value.runAttachmentIds.map((id) => {
              const row = attachmentStatuses[id];
              const state = (row?.state ?? "queued").toLowerCase();
              const label = row?.name || id;
              return (
                <li key={id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{label}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      state === "ready"
                        ? "bg-emerald-100 text-emerald-900"
                        : state === "failed"
                          ? "bg-red-100 text-red-900"
                          : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {state}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--cc-muted)]">{id.slice(0, 8)}…</span>
                  <button
                    type="button"
                    className="rounded border border-[var(--cc-line)] px-2 py-0.5 text-[11px] font-semibold"
                    disabled={uploadBusy || ensuringCreate}
                    onClick={() => void removeAttachment(id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {!canCheckContext ? (
        <p className="mt-4 text-xs text-[var(--cc-muted)]">
          Context will be checked automatically when you create the content. Manual recheck is available after the create is saved.
        </p>
      ) : value.runAttachmentIds.length > 0 ? (
        <p className="mt-4 text-xs text-amber-900">
          Attachments stay on this run until you remove them. Skipping Check does not ignore them — Check context (or remove) before Confirm.
        </p>
      ) : (
        <p className="mt-4 text-xs text-[var(--cc-muted)]">
          Check is optional when nothing is attached. Confirm still verifies context before generation starts.
        </p>
      )}
      <button
        type="button"
        disabled={!canCheckContext || preflightBusy || uploadBusy || ensuringCreate || loading}
        onClick={() => void resolveContext()}
        className="mt-4 rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {preflightBusy
          ? "Checking context…"
          : (checkLabel ?? (canCheckContext ? "Check context" : "Check after save"))}
      </button>

      {preview ? (
        <div className="mt-4 rounded-lg border border-[var(--cc-line)] bg-white p-4" aria-label="Effective context preflight">
          <div className="flex flex-wrap justify-between gap-2">
            <h4 className="font-semibold">Effective context preflight</h4>
            <span className="text-xs text-[var(--cc-muted)]">{preview.estimatedContextSize.toLocaleString()} estimated units</span>
          </div>
          {[...preview.inheritedEntries, ...preview.effectiveEntries].length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {[...preview.inheritedEntries, ...preview.effectiveEntries].map((entry) => (
                <li key={`${entry.kind}-${entry.versionId}`}>
                  <strong>{entry.name}</strong> · v{entry.versionNumber ?? "?"} · {entry.lifecycle ?? "resolved"}
                  {entry.inherited ? " · inherited" : ""}
                  {entry.temporary ? " · temporary" : ""}
                  {entry.freshness ? ` · ${entry.freshness}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-[var(--cc-muted)]">Only the persisted brief and platform defaults are effective.</p>
          )}
          {preview.warnings.length ? (
            <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Warnings</strong>
              <ul className="mt-1 list-disc pl-4">{preview.warnings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul>
            </div>
          ) : null}
          {preview.blockingFindings.length ? (
            <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-900">
              <strong>Generation blocked</strong>
              <ul className="mt-1 list-disc pl-4">{preview.blockingFindings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul>
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-emerald-700">Context is eligible for manifest resolution.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function GeekIqCatalogNote({
  copy,
}: {
  copy: { label: string; note: string; href: string; linkLabel: string };
}) {
  return (
    <p className="mt-2 text-xs text-[var(--cc-muted)]" data-testid={`geek-iq-empty-note-${copy.label}`}>
      {copy.note}{" "}
      <a href={copy.href} className="font-semibold text-[var(--cc-accent)] underline">{copy.linkLabel}</a>
    </p>
  );
}

function GeekIqEmptyFieldNote({ field }: { field: GeekIqSingleSelectField }) {
  const copy = geekIqEmptyFieldCopy(field);
  return (
    <div className="text-xs" data-testid={`geek-iq-empty-field-${field}`}>
      <p className="font-semibold text-[var(--cc-ink)]">{copy.label}</p>
      <p className="mt-1 text-[var(--cc-muted)]">
        {copy.note}{" "}
        <a href={copy.href} className="font-semibold text-[var(--cc-accent)] underline">{copy.linkLabel}</a>
      </p>
    </div>
  );
}

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
import {
  EMPTY_STYLE_GUIDE_POLICY,
  linesFromMultiline,
  normalizeStyleGuidePolicy,
  validateStyleGuidePolicy,
  type StyleGuidePolicy,
  type StyleGuideTermKind,
  type StyleGuideTermRule,
} from "./style-guide-policy";
import {
  EMPTY_PRODUCT_SCHEMA,
  emptyProductSchemaField,
  normalizeProductFieldValues,
  normalizeProductSchemaPolicy,
  validateProductDraft,
  validateProductSchemaPolicy,
  type ProductSchemaPolicy,
  type ProductVersionDraft,
} from "./product-policy";

const CATALOGS = [
  { kind: "knowledge", path: "knowledge", label: "Approved Sources" },
  { kind: "brand-kit", path: "brand-kits", label: "Brand Kits" },
  { kind: "audience", path: "audiences", label: "Audiences" },
  { kind: "style-guide", path: "style-guides", label: "Style Guides" },
  { kind: "product-schema", path: "product-schemas", label: "Product Schemas" },
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

function GrammarToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="rounded border-[var(--cc-line)]"
      />
      {label}
    </label>
  );
}

function StyleGuidePolicyEditor({
  policy,
  busy,
  onChange,
  onSave,
}: {
  policy: StyleGuidePolicy;
  busy: boolean;
  onChange: (next: StyleGuidePolicy) => void;
  onSave: () => void;
}) {
  const updateRule = (index: number, patch: Partial<StyleGuideTermRule>) => {
    onChange({
      ...policy,
      termRules: policy.termRules.map((rule, ruleIndex) =>
        (ruleIndex === index ? { ...rule, ...patch } : rule)),
    });
  };

  return (
    <section aria-label="Style Guide policy" className="mt-6 space-y-4 border-t border-[var(--cc-line)] pt-4">
      <div>
        <h3 className="text-sm font-semibold">Typed style policy</h3>
        <p className="mt-1 text-xs text-[var(--cc-muted)]">
          Grammar preferences guide generation. Term rules are validated deterministically after drafting.
          Saving always creates a new immutable version.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <GrammarToggle
          label="Oxford comma"
          checked={policy.grammar.oxfordComma !== false}
          onChange={(oxfordComma) => onChange({ ...policy, grammar: { ...policy.grammar, oxfordComma } })}
        />
        <GrammarToggle
          label="Prefer active voice"
          checked={policy.grammar.preferActiveVoice !== false}
          onChange={(preferActiveVoice) => onChange({
            ...policy,
            grammar: { ...policy.grammar, preferActiveVoice },
          })}
        />
        <GrammarToggle
          label="Allow em dashes"
          checked={policy.grammar.allowEmDash !== false}
          onChange={(allowEmDash) => onChange({ ...policy, grammar: { ...policy.grammar, allowEmDash } })}
        />
        <GrammarToggle
          label="Sentence-case headings"
          checked={policy.grammar.sentenceCaseHeadings !== false}
          onChange={(sentenceCaseHeadings) => onChange({
            ...policy,
            grammar: { ...policy.grammar, sentenceCaseHeadings },
          })}
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-muted)]">Term rules</h4>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--cc-accent)]"
            onClick={() => onChange({
              ...policy,
              termRules: [
                ...policy.termRules,
                {
                  id: `rule-${policy.termRules.length + 1}`,
                  kind: "prohibit",
                  match: "",
                  replacement: null,
                  caseSensitive: false,
                },
              ],
            })}
          >
            Add rule
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {policy.termRules.map((rule, index) => (
            <li key={rule.id ?? index} className="grid gap-2 rounded-md border border-[var(--cc-line)] p-3 sm:grid-cols-[140px_1fr_1fr_auto]">
              <label className="text-xs font-semibold">
                Kind
                <select
                  aria-label={`Term rule ${index + 1} kind`}
                  className="mt-1 block w-full rounded-md border border-[var(--cc-line)] bg-white px-2 py-1.5 text-sm"
                  value={rule.kind}
                  onChange={(event) => updateRule(index, { kind: event.target.value as StyleGuideTermKind })}
                >
                  <option value="prohibit">Prohibit</option>
                  <option value="replace">Replace</option>
                  <option value="capitalize">Capitalize</option>
                  <option value="abbreviation">Abbreviation</option>
                  <option value="firstMention">First mention</option>
                </select>
              </label>
              <label className="text-xs font-semibold">
                Match
                <input
                  aria-label={`Term rule ${index + 1} match`}
                  className="mt-1 block w-full rounded-md border border-[var(--cc-line)] bg-white px-2 py-1.5 text-sm"
                  value={rule.match}
                  onChange={(event) => updateRule(index, { match: event.target.value })}
                />
              </label>
              <label className="text-xs font-semibold">
                Replacement
                <input
                  aria-label={`Term rule ${index + 1} replacement`}
                  className="mt-1 block w-full rounded-md border border-[var(--cc-line)] bg-white px-2 py-1.5 text-sm"
                  value={rule.replacement ?? ""}
                  disabled={rule.kind === "prohibit" || rule.kind === "capitalize"}
                  onChange={(event) => updateRule(index, { replacement: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="self-end text-xs font-semibold text-red-700"
                onClick={() => onChange({
                  ...policy,
                  termRules: policy.termRules.filter((_, ruleIndex) => ruleIndex !== index),
                })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label className="block text-xs font-semibold">
        Required phrases (one per line)
        <textarea
          aria-label="Required phrases"
          className="mt-1 min-h-20 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
          value={policy.requiredPhrases.join("\n")}
          onChange={(event) => onChange({
            ...policy,
            requiredPhrases: linesFromMultiline(event.target.value),
          })}
        />
      </label>

      <label className="block text-xs font-semibold">
        Additional prohibited phrases (one per line)
        <textarea
          aria-label="Prohibited phrases"
          className="mt-1 min-h-20 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
          value={policy.prohibitedPhrases.join("\n")}
          onChange={(event) => onChange({
            ...policy,
            prohibitedPhrases: linesFromMultiline(event.target.value),
          })}
        />
      </label>

      <label className="block text-xs font-semibold">
        Custom instructions
        <textarea
          aria-label="Custom instructions"
          className="mt-1 min-h-24 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
          value={policy.customInstructions}
          onChange={(event) => onChange({ ...policy, customInstructions: event.target.value })}
        />
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="rounded-md bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        <ButtonBusyLabel busy={busy} busyLabel="Saving version…" idleLabel="Save as new version" />
      </button>
    </section>
  );
}

function ProductSchemaEditor({
  policy,
  busy,
  onChange,
  onSave,
}: {
  policy: ProductSchemaPolicy;
  busy: boolean;
  onChange: (next: ProductSchemaPolicy) => void;
  onSave: () => void;
}) {
  const updateField = (index: number, patch: Partial<ProductSchemaPolicy["fields"][number]>) => {
    onChange({
      ...policy,
      fields: policy.fields.map((field, fieldIndex) =>
        (fieldIndex === index ? { ...field, ...patch } : field)),
    });
  };

  return (
    <section aria-label="Product Schema fields" className="mt-6 space-y-4 border-t border-[var(--cc-line)] pt-4">
      <div>
        <h3 className="text-sm font-semibold">Schema fields</h3>
        <p className="mt-1 text-xs text-[var(--cc-muted)]">
          Define the shared Product IQ attributes. Products bind values to these immutable field IDs.
        </p>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs font-semibold text-[var(--cc-accent)]"
          onClick={() => onChange({
            ...policy,
            fields: [...policy.fields, emptyProductSchemaField(policy.fields.length)],
          })}
        >
          Add field
        </button>
      </div>
      <ul className="space-y-2">
        {policy.fields.map((field, index) => (
          <li key={field.id} className="grid gap-2 rounded-md border border-[var(--cc-line)] p-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              Label
              <input
                aria-label={`Schema field ${index + 1} label`}
                className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-2 py-1.5 text-sm"
                value={field.label}
                onChange={(event) => updateField(index, { label: event.target.value })}
              />
            </label>
            <label className="text-xs font-semibold">
              Key
              <input
                aria-label={`Schema field ${index + 1} key`}
                className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-2 py-1.5 text-sm"
                value={field.key}
                onChange={(event) => updateField(index, { key: event.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(event) => updateField(index, { required: event.target.checked })}
              />
              Required
              <button
                type="button"
                className="ml-auto text-xs font-semibold text-red-700"
                onClick={() => onChange({
                  ...policy,
                  fields: policy.fields.filter((_, fieldIndex) => fieldIndex !== index),
                })}
              >
                Remove
              </button>
            </label>
            <p className="sm:col-span-2 font-mono text-[10px] text-[var(--cc-muted)]">id {field.id}</p>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="rounded-md bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        <ButtonBusyLabel busy={busy} busyLabel="Saving version…" idleLabel="Save as new version" />
      </button>
    </section>
  );
}

function ProductRecordEditor({
  draft,
  schemaOptions,
  schema,
  busy,
  onChange,
  onSave,
}: {
  draft: ProductVersionDraft;
  schemaOptions: Array<{ versionId: string; label: string }>;
  schema: ProductSchemaPolicy | null;
  busy: boolean;
  onChange: (next: ProductVersionDraft) => void;
  onSave: () => void;
}) {
  return (
    <section aria-label="Product IQ record" className="mt-6 space-y-4 border-t border-[var(--cc-line)] pt-4">
      <div>
        <h3 className="text-sm font-semibold">Product values &amp; claims</h3>
        <p className="mt-1 text-xs text-[var(--cc-muted)]">
          Bind this product to an approved schema version, then author field values and claim gates.
        </p>
      </div>
      <label className="block text-xs font-semibold">
        Product Schema version
        <select
          aria-label="Product Schema version"
          className="mt-1 block w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
          value={draft.productSchemaVersionId}
          onChange={(event) => onChange({ ...draft, productSchemaVersionId: event.target.value })}
        >
          <option value="">Select approved schema version</option>
          {schemaOptions.map((option) => (
            <option key={option.versionId} value={option.versionId}>{option.label}</option>
          ))}
        </select>
      </label>
      {schema ? (
        <ul className="space-y-2">
          {schema.fields.map((field) => (
            <li key={field.id}>
              <label className="block text-xs font-semibold">
                {field.label}{field.required ? " *" : ""}
                <input
                  aria-label={`Product field ${field.label}`}
                  className="mt-1 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
                  value={draft.fieldValues[field.id] ?? ""}
                  onChange={(event) => onChange({
                    ...draft,
                    fieldValues: { ...draft.fieldValues, [field.id]: event.target.value },
                  })}
                />
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--cc-muted)]">Choose a schema version to edit field values.</p>
      )}
      <label className="block text-xs font-semibold">
        Approved claims (one per line)
        <textarea
          aria-label="Approved claims"
          className="mt-1 min-h-20 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
          value={draft.approvedClaims.join("\n")}
          onChange={(event) => onChange({
            ...draft,
            approvedClaims: linesFromMultiline(event.target.value),
          })}
        />
      </label>
      <label className="block text-xs font-semibold">
        Prohibited claims (one per line)
        <textarea
          aria-label="Prohibited claims"
          className="mt-1 min-h-20 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
          value={draft.prohibitedClaims.join("\n")}
          onChange={(event) => onChange({
            ...draft,
            prohibitedClaims: linesFromMultiline(event.target.value),
          })}
        />
      </label>
      <label className="block text-xs font-semibold">
        Mandatory disclaimers (one per line)
        <textarea
          aria-label="Mandatory disclaimers"
          className="mt-1 min-h-20 w-full rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
          value={draft.mandatoryDisclaimers.join("\n")}
          onChange={(event) => onChange({
            ...draft,
            mandatoryDisclaimers: linesFromMultiline(event.target.value),
          })}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="rounded-md bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        <ButtonBusyLabel busy={busy} busyLabel="Saving version…" idleLabel="Save as new version" />
      </button>
    </section>
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
  const [stylePolicy, setStylePolicy] = useState<StyleGuidePolicy>(EMPTY_STYLE_GUIDE_POLICY);
  const [productSchemaPolicy, setProductSchemaPolicy] = useState<ProductSchemaPolicy>({
    ...EMPTY_PRODUCT_SCHEMA,
    fields: [emptyProductSchemaField()],
  });
  const [productDraft, setProductDraft] = useState<ProductVersionDraft>({
    productSchemaVersionId: "",
    fieldValues: {},
    approvedClaims: [],
    prohibitedClaims: [],
    mandatoryDisclaimers: [],
  });
  const [productSchemaCatalog, setProductSchemaCatalog] = useState<GovernedCatalogItem[]>([]);
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
      if (definition.kind === "product") {
        const schemaResponse = await fetch("/api/gcc-v2/product-schemas", { cache: "no-store" });
        const schemaBody = await schemaResponse.json().catch(() => null);
        if (schemaResponse.ok) setProductSchemaCatalog(normalizeCatalog(schemaBody));
      }
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

  useEffect(() => {
    if (active.kind !== "style-guide") return;
    setStylePolicy(normalizeStyleGuidePolicy(selectedVersion?.data));
  }, [active.kind, selectedVersion?.id, selectedVersion?.data]);

  useEffect(() => {
    if (active.kind !== "product-schema") return;
    const normalized = normalizeProductSchemaPolicy(selectedVersion?.data);
    setProductSchemaPolicy(normalized.fields.length
      ? normalized
      : { ...EMPTY_PRODUCT_SCHEMA, fields: [emptyProductSchemaField()] });
  }, [active.kind, selectedVersion?.id, selectedVersion?.data]);

  const approvedSchemaOptions = useMemo(() => productSchemaCatalog.flatMap((item) =>
    item.versions
      .filter((version) => version.lifecycle === "approved")
      .map((version) => ({
        versionId: version.id,
        label: `${item.name} · v${version.versionNumber}`,
        schema: normalizeProductSchemaPolicy(version.data),
      }))), [productSchemaCatalog]);

  const selectedProductSchema = useMemo(() => {
    const match = approvedSchemaOptions.find((option) =>
      option.versionId === productDraft.productSchemaVersionId);
    return match?.schema ?? null;
  }, [approvedSchemaOptions, productDraft.productSchemaVersionId]);

  useEffect(() => {
    if (active.kind !== "product") return;
    const schemaVersionId = selectedVersion?.productSchemaVersionId
      ?? approvedSchemaOptions[0]?.versionId
      ?? "";
    const schema = approvedSchemaOptions.find((option) => option.versionId === schemaVersionId)?.schema
      ?? EMPTY_PRODUCT_SCHEMA;
    setProductDraft({
      productSchemaVersionId: schemaVersionId,
      fieldValues: normalizeProductFieldValues(selectedVersion?.data, schema.fields),
      approvedClaims: selectedVersion?.approvedClaims ?? [],
      prohibitedClaims: selectedVersion?.prohibitedClaims ?? [],
      mandatoryDisclaimers: selectedVersion?.mandatoryDisclaimers ?? [],
    });
  }, [
    active.kind,
    approvedSchemaOptions,
    selectedVersion?.id,
    selectedVersion?.data,
    selectedVersion?.productSchemaVersionId,
    selectedVersion?.approvedClaims,
    selectedVersion?.prohibitedClaims,
    selectedVersion?.mandatoryDisclaimers,
  ]);

  useEffect(() => {
    if (active.kind !== "product" || !selectedProductSchema) return;
    setProductDraft((current) => ({
      ...current,
      fieldValues: normalizeProductFieldValues(current.fieldValues, selectedProductSchema.fields),
    }));
  }, [active.kind, selectedProductSchema]);

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
    setError(null);
    try {
      const response = await fetch(`/api/gcc-v2/${active.path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: "" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `Draft creation failed (HTTP ${response.status}).`);
      const catalogId = typeof body?.id === "string" ? body.id : null;
      if ((active.kind === "style-guide" || active.kind === "product-schema") && catalogId) {
        const payload = active.kind === "style-guide"
          ? EMPTY_STYLE_GUIDE_POLICY
          : { ...EMPTY_PRODUCT_SCHEMA, fields: [emptyProductSchemaField()] };
        const versionResponse = await fetch(`/api/gcc-v2/${active.path}/${encodeURIComponent(catalogId)}/versions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ payload, schemaVersion: 1, locale: "en" }),
        });
        const versionBody = await versionResponse.json().catch(() => null);
        if (!versionResponse.ok) {
          throw new Error(versionBody?.error || `Version create failed (HTTP ${versionResponse.status}).`);
        }
      }
      setNotice(`${name.trim()} draft created.`);
      await loadCatalog(active);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Draft creation failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function saveStyleGuideVersion() {
    if (!selected) return;
    const validation = validateStyleGuidePolicy(stylePolicy);
    if (validation) {
      setError(validation);
      return;
    }
    setActionBusy("save-style");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/gcc-v2/${active.path}/${encodeURIComponent(selected.id)}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: stylePolicy, schemaVersion: 1, locale: "en" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      setNotice(`Saved ${selected.name} as a new Style Guide version.`);
      await loadCatalog(active);
      if (typeof body?.id === "string") setSelectedVersionId(body.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Style Guide version save failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function saveProductSchemaVersion() {
    if (!selected) return;
    const validation = validateProductSchemaPolicy(productSchemaPolicy);
    if (validation) {
      setError(validation);
      return;
    }
    setActionBusy("save-schema");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/gcc-v2/${active.path}/${encodeURIComponent(selected.id)}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: productSchemaPolicy, schemaVersion: 1 }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      setNotice(`Saved ${selected.name} as a new Product Schema version.`);
      await loadCatalog(active);
      if (typeof body?.id === "string") setSelectedVersionId(body.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product Schema version save failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function saveProductVersion() {
    if (!selected || !selectedProductSchema) return;
    const validation = validateProductDraft(productDraft, selectedProductSchema);
    if (validation) {
      setError(validation);
      return;
    }
    setActionBusy("save-product");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/gcc-v2/${active.path}/${encodeURIComponent(selected.id)}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payload: productDraft.fieldValues,
          schemaVersion: 1,
          productSchemaVersionId: productDraft.productSchemaVersionId,
          approvedClaims: productDraft.approvedClaims,
          prohibitedClaims: productDraft.prohibitedClaims,
          mandatoryDisclaimers: productDraft.mandatoryDisclaimers,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      setNotice(`Saved ${selected.name} as a new Product version.`);
      await loadCatalog(active);
      if (typeof body?.id === "string") setSelectedVersionId(body.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product version save failed.");
    } finally {
      setActionBusy(null);
    }
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
          <h1 className="mt-2 text-3xl font-bold">Brand &amp; Source Library</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--cc-muted)]">Manage optional reusable references and brand guidance. Project websites selected during creation are researched automatically and do not need to be uploaded again.</p>
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
            {active.kind === "knowledge" ? <label className="mt-3 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-[var(--cc-accent)] bg-teal-50 px-3 py-3 text-sm font-semibold text-[var(--cc-accent)]">Upload additional reference<input type="file" className="sr-only" disabled={actionBusy !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadKnowledge(file); }} /></label> : null}
            {loading ? <p className="mt-4 text-sm text-[var(--cc-muted)]">Loading catalog…</p> : null}
            <ul className="mt-3 space-y-2">{filtered.map((item) => { const version = currentVersion(item); return <li key={item.id}><button type="button" onClick={() => { setSelectedId(item.id); setSelectedVersionId(version?.id ?? null); }} className={`w-full rounded-lg border bg-white p-4 text-left ${selectedId === item.id ? "border-[var(--cc-accent)] ring-1 ring-[var(--cc-accent)]" : "border-[var(--cc-line)]"}`}><span className="font-semibold">{item.name}</span><span className="mt-1 block text-xs text-[var(--cc-muted)]">{item.description || "No description"}</span>{version ? <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${statusClass(version.lifecycle)}`}>v{version.versionNumber} · {version.lifecycle}</span> : null}</button></li>; })}</ul>
          </section>

          <section className="rounded-xl border border-[var(--cc-line)] bg-white p-5">
            {selected && selectedVersion ? <>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{selected.name}</h2><p className="mt-1 text-sm text-[var(--cc-muted)]">{selected.description || "No description provided."}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(selectedVersion.lifecycle)}`}>{selectedVersion.lifecycle}</span></div>
              <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-semibold">Exact version<select aria-label="Exact version" className="mt-1 block rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm" value={selectedVersion.id} onChange={(event) => setSelectedVersionId(event.target.value)}>{[...selected.versions].sort((a, b) => b.versionNumber - a.versionNumber).map((version) => <option key={version.id} value={version.id}>Version {version.versionNumber} · {version.lifecycle}</option>)}</select></label>{active.kind !== "brand-kit" ? ["review", "approve", "deprecate", "revoke"].map((action) => <button key={action} type="button" disabled={actionBusy !== null || selectedVersion.lifecycle === "revoked"} onClick={() => void lifecycleAction(action)} className="rounded-md border border-[var(--cc-line)] px-3 py-2 text-xs font-semibold capitalize disabled:opacity-40">{actionBusy === action ? "Working…" : action}</button>) : null}</div>
              {selected.versions.length > 1 ? <p className="mt-3 text-xs text-[var(--cc-muted)]">Compare versions by selecting an immutable revision. Approved content is never edited in place.</p> : null}
              <dl><VersionDetail version={selectedVersion} /></dl>
              {active.kind === "style-guide" ? (
                <StyleGuidePolicyEditor
                  policy={stylePolicy}
                  busy={actionBusy === "save-style"}
                  onChange={setStylePolicy}
                  onSave={() => void saveStyleGuideVersion()}
                />
              ) : null}
              {active.kind === "product-schema" ? (
                <ProductSchemaEditor
                  policy={productSchemaPolicy}
                  busy={actionBusy === "save-schema"}
                  onChange={setProductSchemaPolicy}
                  onSave={() => void saveProductSchemaVersion()}
                />
              ) : null}
              {active.kind === "product" ? (
                <ProductRecordEditor
                  draft={productDraft}
                  schemaOptions={approvedSchemaOptions}
                  schema={selectedProductSchema}
                  busy={actionBusy === "save-product"}
                  onChange={setProductDraft}
                  onSave={() => void saveProductVersion()}
                />
              ) : null}
            </> : <p className="text-sm text-[var(--cc-muted)]">Select a catalog record to inspect its exact version.</p>}
          </section>
        </div>
      )}
    </main>
  );
}

export type { ContextKind };

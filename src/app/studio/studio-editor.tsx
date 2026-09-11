"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  currentVersion,
  normalizeCatalog,
  type GovernedCatalogItem,
} from "@/app/brand-sources/context-contract";
import {
  deprecateStudioAgent,
  detailToEditorState,
  dryRunStudioAgent,
  evaluateStudioAgent,
  getStudioAgent,
  publishStudioAgent,
  revokeStudioAgent,
  saveStudioDraft,
  type StudioAuditEvent,
} from "@/app/studio/studio-api";
import { buildInputSchema } from "@/app/studio/studio-model";
import type { StudioFieldType, StudioFormField, StudioTestCase, StudioVisibility } from "@/app/studio/studio-types";

type EditorState = {
  id: string;
  name: string;
  outcome: string;
  visibility: StudioVisibility;
  state: string;
  version: string;
  fields: StudioFormField[];
  instructionsTemplate: string;
  exampleOutput: string;
  allowedModel: string;
  temperature: number;
  evaluationPrompt: string;
  contextKnowledgeIds: string[];
  testCases: StudioTestCase[];
  minTestCases: number;
  publishedVersion: { versionId: string; version: string; digest: string; state?: string } | null;
  lifecycleVersion: { versionId: string; version: string; digest: string; state: string } | null;
  audit: StudioAuditEvent[];
};

function fieldIdFromLabel(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "field";
}

export function StudioEditor({ draftId }: { draftId: string }) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sampleInputs, setSampleInputs] = useState<Record<string, string>>({});
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<StudioFieldType>("shortText");
  const [saving, setSaving] = useState(false);
  const [dryRunPassed, setDryRunPassed] = useState(false);
  const [suitePassed, setSuitePassed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<GovernedCatalogItem[]>([]);

  useEffect(() => {
    void getStudioAgent(draftId)
      .then((detail) => {
        const next = detailToEditorState(detail);
        setEditor(next);
        setDryRunPassed(false);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load Studio agent."));
  }, [draftId]);

  useEffect(() => {
    void fetch("/api/gcc-v2/knowledge", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Knowledge catalog failed (HTTP ${response.status}).`);
        return response.json();
      })
      .then((body) => setKnowledgeItems(normalizeCatalog(body)))
      .catch(() => setKnowledgeItems([]));
  }, []);

  const approvedKnowledge = useMemo(
    () => knowledgeItems.flatMap((item) => {
      const version = currentVersion(item);
      if (!version || (version.lifecycle !== "approved" && version.lifecycle !== "deprecated")) {
        return [];
      }
      return [{
        versionId: version.id,
        label: `${item.name} v${version.versionNumber}`,
      }];
    }),
    [knowledgeItems],
  );

  const schemaPreview = useMemo(
    () => (editor ? JSON.stringify(buildInputSchema({
      id: editor.id,
      name: editor.name,
      outcome: editor.outcome,
      visibility: editor.visibility,
      fields: editor.fields,
      instructionsTemplate: editor.instructionsTemplate,
      exampleOutput: editor.exampleOutput,
      allowedModel: editor.allowedModel,
      temperature: editor.temperature,
      contextKnowledgeIds: editor.contextKnowledgeIds,
      evaluationPrompt: editor.evaluationPrompt,
      testCases: editor.testCases,
      minTestCases: editor.minTestCases,
      updatedAt: "",
      testStatus: "untested",
    }), null, 2) : ""),
    [editor],
  );

  async function persist(next: EditorState) {
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    setDryRunPassed(false);
    setSuitePassed(false);
    try {
      const detail = await saveStudioDraft(next.id, {
        name: next.name,
        outcome: next.outcome,
        visibility: next.visibility,
        fields: next.fields,
        instructionsTemplate: next.instructionsTemplate,
        exampleOutput: next.exampleOutput,
        allowedModel: next.allowedModel,
        temperature: next.temperature,
        evaluationPrompt: next.evaluationPrompt,
        contextKnowledgeIds: next.contextKnowledgeIds,
        testCases: next.testCases,
        minTestCases: next.minTestCases,
      });
      setEditor(detailToEditorState(detail));
      setStatusMessage(`Draft saved as ${detail.agent.version}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function onDryRun() {
    if (!editor) return;
    setError(null);
    setStatusMessage(null);
    try {
      await persist(editor);
      const result = await dryRunStudioAgent(editor.id, sampleInputs);
      setDryRunPassed(result.valid);
      setSuitePassed(false);
      setStatusMessage(result.message);
      if (!result.valid) setError(result.message);
    } catch (cause) {
      setDryRunPassed(false);
      setSuitePassed(false);
      setError(cause instanceof Error ? cause.message : "Dry-run failed.");
    }
  }

  async function onEvaluateSuite() {
    if (!editor) return;
    setError(null);
    setStatusMessage(null);
    try {
      await persist(editor);
      const result = await evaluateStudioAgent(editor.id);
      setSuitePassed(result.valid);
      setDryRunPassed(result.valid);
      setStatusMessage(result.message);
      if (!result.valid) setError(result.message);
    } catch (cause) {
      setSuitePassed(false);
      setDryRunPassed(false);
      setError(cause instanceof Error ? cause.message : "Test suite failed.");
    }
  }

  function addTestCaseFromSample() {
    if (!editor) return;
    const nextCase: StudioTestCase = {
      id: `case-${crypto.randomUUID().slice(0, 8)}`,
      name: `Case ${editor.testCases.length + 1}`,
      input: { ...sampleInputs },
    };
    setEditor({ ...editor, testCases: [...editor.testCases, nextCase] });
    setDryRunPassed(false);
    setSuitePassed(false);
  }

  async function onPublish() {
    if (!editor) return;
    setPublishing(true);
    setError(null);
    try {
      const detail = await publishStudioAgent(editor.id);
      setEditor(detailToEditorState(detail));
      setDryRunPassed(false);
      setSuitePassed(false);
      setStatusMessage(
        detail.message
          ?? (detail.publishedVersion
            ? `Published ${detail.publishedVersion.version}. Successor draft ${detail.agent.version} is ready.`
            : `Published ${detail.agent.version}.`),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  async function onDeprecate() {
    if (!editor) return;
    setLifecycleBusy(true);
    setError(null);
    try {
      const detail = await deprecateStudioAgent(editor.id);
      setEditor(detailToEditorState(detail));
      setStatusMessage(
        detail.lifecycleVersion
          ? `Deprecated ${detail.lifecycleVersion.version}.`
          : "Published version deprecated.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deprecate failed.");
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function onRevoke() {
    if (!editor) return;
    setLifecycleBusy(true);
    setError(null);
    try {
      const detail = await revokeStudioAgent(editor.id);
      setEditor(detailToEditorState(detail));
      setStatusMessage(
        detail.lifecycleVersion
          ? `Revoked ${detail.lifecycleVersion.version}.`
          : "Version revoked.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revoke failed.");
    } finally {
      setLifecycleBusy(false);
    }
  }

  if (error && !editor) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>
        <Link href="/studio" className="mt-4 inline-block text-sm font-semibold text-[var(--cc-accent)] underline">← Studio</Link>
      </main>
    );
  }

  if (!editor) {
    return <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-[var(--cc-muted)]">Loading agent…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/studio" className="text-sm font-semibold text-[var(--cc-accent)] underline">← Studio</Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Custom agent</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--cc-ink)]">{editor.name}</h1>
      <p className="mt-2 text-xs text-[var(--cc-muted)]">
        {editor.state} · version {editor.version} · {editor.visibility}
      </p>

      <section className="mt-6 grid gap-5 rounded-xl border border-[var(--cc-line)] bg-white p-5">
        <label className="block text-sm font-semibold" htmlFor="studioName">Agent name</label>
        <input
          id="studioName"
          value={editor.name}
          onChange={(event) => setEditor({ ...editor, name: event.target.value })}
          className="w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
        />
        <label className="block text-sm font-semibold" htmlFor="studioOutcome">Desired outcome</label>
        <textarea
          id="studioOutcome"
          value={editor.outcome}
          onChange={(event) => setEditor({ ...editor, outcome: event.target.value })}
          rows={3}
          className="w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
        />
        <label className="block text-sm font-semibold" htmlFor="studioVisibility">Visibility</label>
        <select
          id="studioVisibility"
          value={editor.visibility}
          onChange={(event) => setEditor({
            ...editor,
            visibility: event.target.value as StudioVisibility,
          })}
          className="w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
        >
          <option value="private">private</option>
          <option value="admin_shared">admin_shared</option>
        </select>
      </section>

      <section className="mt-5 rounded-xl border border-[var(--cc-line)] bg-white p-5">
        <h2 className="text-lg font-bold">Form builder</h2>
        <ul className="mt-4 space-y-3">
          {editor.fields.map((field) => (
            <li key={field.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--cc-line)] p-3">
              <div>
                <p className="font-semibold">{field.label}</p>
                <p className="text-xs text-[var(--cc-muted)]">{field.type} · {field.required ? "required" : "optional"} · {`{{inputs.${field.id}}}`}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditor({
                  ...editor,
                  fields: editor.fields.filter((item) => item.id !== field.id),
                })}
                className="rounded-lg border border-[var(--cc-line)] px-3 py-1.5 text-xs font-semibold"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            aria-label="New field label"
            value={newFieldLabel}
            onChange={(event) => setNewFieldLabel(event.target.value)}
            placeholder="Field label"
            className="min-w-[12rem] flex-1 rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
          />
          <select
            aria-label="New field type"
            value={newFieldType}
            onChange={(event) => setNewFieldType(event.target.value as StudioFieldType)}
            className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
          >
            <option value="shortText">shortText</option>
            <option value="longText">longText</option>
            <option value="select">select</option>
            <option value="tags">tags</option>
          </select>
          <button
            type="button"
            disabled={!newFieldLabel.trim()}
            onClick={() => {
              const id = fieldIdFromLabel(newFieldLabel);
              setEditor({
                ...editor,
                fields: [
                  ...editor.fields.filter((field) => field.id !== id),
                  {
                    id,
                    label: newFieldLabel.trim(),
                    type: newFieldType,
                    required: true,
                  },
                ],
              });
              setNewFieldLabel("");
            }}
            className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add field
          </button>
        </div>
        <pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{schemaPreview}</pre>
      </section>

      <section className="mt-5 rounded-xl border border-[var(--cc-line)] bg-white p-5">
        <label className="block text-sm font-semibold" htmlFor="studioInstructions">Instructions template</label>
        <textarea
          id="studioInstructions"
          value={editor.instructionsTemplate}
          onChange={(event) => setEditor({ ...editor, instructionsTemplate: event.target.value })}
          rows={8}
          className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
        />
        <label className="mt-5 block text-sm font-semibold" htmlFor="studioExample">Example output</label>
        <textarea
          id="studioExample"
          value={editor.exampleOutput}
          onChange={(event) => setEditor({ ...editor, exampleOutput: event.target.value })}
          rows={6}
          className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
        />
        <label className="mt-5 block text-sm font-semibold" htmlFor="studioEvaluation">Evaluation prompt</label>
        <textarea
          id="studioEvaluation"
          value={editor.evaluationPrompt}
          onChange={(event) => setEditor({ ...editor, evaluationPrompt: event.target.value })}
          rows={4}
          className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 font-mono text-sm"
          placeholder="Criteria a dry-run or reviewer should check against the example output."
        />
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Approved knowledge attachments</legend>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Optional. Select up to 10 approved Knowledge versions to pin on this agent definition.
          </p>
          {approvedKnowledge.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--cc-muted)]">No approved Knowledge versions are available.</p>
          ) : (
            <ul className="mt-3 space-y-2" aria-label="Approved knowledge attachments">
              {approvedKnowledge.map((item) => {
                const checked = editor.contextKnowledgeIds.includes(item.versionId);
                return (
                  <li key={item.versionId}>
                    <label className="flex items-center gap-2 text-sm text-[var(--cc-ink)]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const nextIds = event.target.checked
                            ? [...editor.contextKnowledgeIds, item.versionId].slice(0, 10)
                            : editor.contextKnowledgeIds.filter((id) => id !== item.versionId);
                          setEditor({ ...editor, contextKnowledgeIds: nextIds });
                        }}
                      />
                      <span>{item.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold" htmlFor="studioModel">Allowed model</label>
            <input
              id="studioModel"
              value={editor.allowedModel}
              onChange={(event) => setEditor({ ...editor, allowedModel: event.target.value })}
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="studioTemperature">Temperature</label>
            <input
              id="studioTemperature"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={editor.temperature}
              onChange={(event) => setEditor({ ...editor, temperature: Number(event.target.value) })}
              className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void persist(editor)}
          className="mt-5 rounded-lg border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
      </section>

      <section className="mt-5 rounded-xl border border-[var(--cc-line)] bg-white p-5">
        <h2 className="text-lg font-bold">Dry-run test</h2>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          Sample inputs are validated against the saved draft schema, instruction template, and evaluation prompt.
          Save at least {editor.minTestCases} suite case(s), then run the suite before publish.
        </p>
        <div className="mt-4 space-y-3">
          {editor.fields.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-semibold" htmlFor={`sample-${field.id}`}>{field.label}</label>
              <input
                id={`sample-${field.id}`}
                value={sampleInputs[field.id] ?? ""}
                onChange={(event) => setSampleInputs((current) => ({ ...current, [field.id]: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void onDryRun()}
            className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Run dry-run
          </button>
          <button
            type="button"
            onClick={addTestCaseFromSample}
            className="rounded-lg border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold"
          >
            Add sample as test case
          </button>
          <button
            type="button"
            onClick={() => void onEvaluateSuite()}
            className="rounded-lg border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold"
          >
            Run test suite
          </button>
          <button
            type="button"
            disabled={!suitePassed || publishing || editor.state === "published"}
            onClick={() => void onPublish()}
            className="rounded-lg border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {editor.state === "published" ? "Published" : publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
        {editor.testCases.length ? (
          <ul className="mt-4 space-y-2" aria-label="Studio test cases" data-testid="studio-test-cases">
            {editor.testCases.map((item) => (
              <li key={item.id} className="border-l-2 border-[var(--cc-line)] pl-3 text-sm">
                <span className="font-semibold text-[var(--cc-ink)]">{item.name}</span>
                <span className="mt-1 block text-xs text-[var(--cc-muted)]">
                  {Object.entries(item.input).map(([key, value]) => `${key}=${value}`).join(" · ") || "empty input"}
                </span>
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-red-700 underline"
                  onClick={() => {
                    setEditor({
                      ...editor,
                      testCases: editor.testCases.filter((entry) => entry.id !== item.id),
                    });
                    setDryRunPassed(false);
                    setSuitePassed(false);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[var(--cc-muted)]" data-testid="studio-test-cases-empty">
            No suite cases yet. Add the sample as a test case, then run the suite.
          </p>
        )}
        <p className="mt-3 text-sm" data-testid="studio-dry-run-status">
          Status:{" "}
          <span className="font-semibold">
            {suitePassed ? "passed" : dryRunPassed ? "dry-run passed" : editor.state}
          </span>
          {statusMessage ? ` · ${statusMessage}` : ""}
        </p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="mt-5 rounded-xl border border-[var(--cc-line)] bg-white p-5">
        <h2 className="text-lg font-bold">Lifecycle</h2>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          Deprecate or revoke the latest published Studio version. Successor drafts stay editable.
        </p>
        <p className="mt-3 text-sm" data-testid="studio-lifecycle-status">
          Published:{" "}
          <span className="font-semibold">
            {editor.publishedVersion
              ? `${editor.publishedVersion.version} (${editor.publishedVersion.state ?? "published"})`
              : editor.lifecycleVersion
                ? `${editor.lifecycleVersion.version} (${editor.lifecycleVersion.state})`
                : "none"}
          </span>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={lifecycleBusy || !editor.publishedVersion}
            onClick={() => void onDeprecate()}
            className="rounded-lg border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Deprecate published
          </button>
          <button
            type="button"
            disabled={
              lifecycleBusy
              || !(editor.publishedVersion || editor.lifecycleVersion?.state === "deprecated")
            }
            onClick={() => void onRevoke()}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50"
          >
            Revoke
          </button>
        </div>
        {editor.audit.length ? (
          <ol className="mt-5 space-y-2" aria-label="Studio audit history" data-testid="studio-audit-history">
            {editor.audit.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-slate-50 p-3 text-xs text-[var(--cc-muted)]">
                <strong className="text-[var(--cc-ink)]">{entry.action}</strong>
                {" · "}
                {entry.actor}
                {" · "}
                {entry.atUtc}
                {entry.detail ? <p className="mt-1">{entry.detail}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-[var(--cc-muted)]">No lifecycle events yet.</p>
        )}
      </section>
    </main>
  );
}

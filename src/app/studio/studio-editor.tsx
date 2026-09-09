"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  detailToEditorState,
  dryRunStudioAgent,
  getStudioAgent,
  publishStudioAgent,
  saveStudioDraft,
} from "@/app/studio/studio-api";
import { buildInputSchema } from "@/app/studio/studio-model";
import type { StudioFieldType, StudioFormField, StudioVisibility } from "@/app/studio/studio-types";

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
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    void getStudioAgent(draftId)
      .then((detail) => {
        const next = detailToEditorState(detail);
        setEditor(next);
        setDryRunPassed(false);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load Studio agent."));
  }, [draftId]);

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
      contextKnowledgeIds: [],
      evaluationPrompt: "",
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
      setStatusMessage(result.message);
      if (!result.valid) setError(result.message);
    } catch (cause) {
      setDryRunPassed(false);
      setError(cause instanceof Error ? cause.message : "Dry-run failed.");
    }
  }

  async function onPublish() {
    if (!editor) return;
    setPublishing(true);
    setError(null);
    try {
      const detail = await publishStudioAgent(editor.id);
      setEditor(detailToEditorState(detail));
      setStatusMessage(`Published ${detail.agent.version}. Runnable from Task Agents.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publish failed.");
    } finally {
      setPublishing(false);
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
          Sample inputs are validated against the saved draft schema and instruction template.
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
            disabled={!dryRunPassed || publishing || editor.state === "published"}
            onClick={() => void onPublish()}
            className="rounded-lg border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {editor.state === "published" ? "Published" : publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
        <p className="mt-3 text-sm" data-testid="studio-dry-run-status">
          Status: <span className="font-semibold">{dryRunPassed ? "passed" : editor.state}</span>
          {statusMessage ? ` · ${statusMessage}` : ""}
        </p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}
      </section>
    </main>
  );
}

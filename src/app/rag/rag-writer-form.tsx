"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DEFAULT_AD_TEMPLATES, loadAdTemplates, saveAdTemplates } from "./ad-templates";
import { RAG_SAMPLE_TOPICS, RAG_WRITING_INTENTS } from "./intents";
import { fetchRagStatus, generateRagDraft, indexRagAdTemplates } from "./rag-generate-client";
import { GuidedRagWriter } from "./guided-rag-writer";
import type {
  RagAdTemplate,
  RagGenerateResponse,
  RagGenerateStatus,
  RagWritingIntent,
} from "./types";

const fieldClass = "flex flex-col gap-1.5";
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const inputClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)] outline-none focus:border-[var(--cc-accent)]";
const selectClass = inputClass;

type Props = {
  initialTopic?: string;
  initialIntent?: RagWritingIntent;
};

export function RagWriterForm({ initialTopic = "", initialIntent }: Props) {
  const [status, setStatus] = useState<RagGenerateStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [intent, setIntent] = useState<RagWritingIntent>(
    initialIntent ?? "Technical Article",
  );
  const [topic, setTopic] = useState(initialTopic);
  const [entitySeeds, setEntitySeeds] = useState<string[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [freeEntity, setFreeEntity] = useState("");
  const [templates, setTemplates] = useState<RagAdTemplate[]>(DEFAULT_AD_TEMPLATES);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [result, setResult] = useState<RagGenerateResponse | null>(null);
  const [guidedMode, setGuidedMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setTemplates(loadAdTemplates());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchRagStatus();
        if (cancelled) return;
        if (!s) {
          setStatusError("Could not load RAG status — sign in and retry.");
          return;
        }
        setStatus(s);
        setEntitySeeds(s.entitySeeds ?? []);
      } catch {
        if (!cancelled) setStatusError("RAG status request failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const intentMeta = useMemo(
    () => RAG_WRITING_INTENTS.find((i) => i.value === intent),
    [intent],
  );

  const available = status?.available === true;
  const guidedAvailable =
    available && status?.citeableGenerateAvailable !== false;
  const isShort = intentMeta?.family === "short";
  const isLong = intentMeta?.family === "long";
  const isSlides = intentMeta?.family === "slides";

  function toggleEntity(name: string) {
    setSelectedEntities((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name].slice(0, 12),
    );
  }

  function addFreeEntity() {
    const t = freeEntity.trim();
    if (!t) return;
    setSelectedEntities((prev) =>
      prev.includes(t) ? prev : [...prev, t].slice(0, 12),
    );
    setFreeEntity("");
  }

  function toggleTemplate(id: string) {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3),
    );
  }

  function addTemplate() {
    const body = newTemplateBody.trim();
    const name = newTemplateName.trim() || "Custom template";
    if (body.length < 8) return;
    const next: RagAdTemplate = {
      id: crypto.randomUUID().slice(0, 12),
      name,
      channel: "custom",
      framework: "custom",
      body,
    };
    const merged = [...templates, next].slice(0, 40);
    setTemplates(merged);
    saveAdTemplates(merged);
    void indexRagAdTemplates([next]);
    setSelectedTemplateIds((prev) => [...prev, next.id].slice(0, 3));
    setNewTemplateBody("");
    setNewTemplateName("");
  }

  function applySample() {
    if (intentMeta?.family === "short") setTopic(RAG_SAMPLE_TOPICS.shortForm);
    else if (intentMeta?.family === "battlecard") setTopic(RAG_SAMPLE_TOPICS.battlecard);
    else if (intentMeta?.family === "slides") setTopic(RAG_SAMPLE_TOPICS.slides);
    else setTopic(RAG_SAMPLE_TOPICS.technical);
  }

  function onGenerate() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const adTemplates = isShort
        ? templates.filter((t) => selectedTemplateIds.includes(t.id))
        : undefined;
      const res = await generateRagDraft({
        writingIntent: intent,
        topic: topic.trim(),
        targetEntities: selectedEntities.length > 0 ? selectedEntities : undefined,
        adTemplates: adTemplates && adTemplates.length > 0 ? adTemplates : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
      if (res.data.softDisabled) {
        setError(
          res.data.warnings?.[0] ??
            "RAG generate is soft-disabled — existing create WRITE / research path still works.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {statusError ? <p className="text-sm text-red-600">{statusError}</p> : null}

      {status && !available ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">RAG generate unavailable</p>
          <p className="mt-1 text-amber-900/90">
            {status.reason ??
              "Geek-Crawler-Rag is not configured. Use the existing create → generate research path as fallback."}
          </p>
        </div>
      ) : null}

      {status?.available ? (
        <p className="text-xs text-[var(--cc-muted)]">
          Writer models: long-form{" "}
          <span className="font-medium text-[var(--cc-ink)]">
            {status.longFormModel ?? "o3"}
          </span>
          {" · "}
          short-form{" "}
          <span className="font-medium text-[var(--cc-ink)]">
            {status.shortFormModel ?? "gpt-4o"}
          </span>
          {" · "}
          GraphRAG {status.graphRetrievalAvailable ? "on" : "soft-off"}
          {" · "}
          Ad-template index {status.adTemplateIndexAvailable ? "on" : "soft-off (local templates OK)"}
          {" · "}
          Citeable workflow {status.citeableGenerateAvailable ? "on" : "soft-off"}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="ragIntent">
            Writing intent
          </label>
          <select
            id="ragIntent"
            className={selectClass}
            value={intent}
            onChange={(e) => {
              const next = e.target.value as RagWritingIntent;
              setIntent(next);
              if (
                next !== "Technical Article" &&
                next !== "Case Study"
              ) {
                setGuidedMode(false);
              }
            }}
          >
            {RAG_WRITING_INTENTS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
          {intentMeta ? (
            <p className="text-xs text-[var(--cc-muted)]">{intentMeta.help}</p>
          ) : null}
          {isLong ? (
            <p className="text-xs text-[var(--cc-muted)]">
              D3: long-form generate uses GeekAPI o1/o3 routing when enabled.
            </p>
          ) : null}
          {isSlides && status && !status.graphRetrievalAvailable ? (
            <p className="text-xs text-amber-800">
              GraphRAG not enabled yet — outline still generates from parent hybrid + theme sources.
            </p>
          ) : null}
        </div>

        <div className="flex items-end">
          <button
            type="button"
            className="text-sm font-medium text-[var(--cc-accent)] underline-offset-2 hover:underline"
            onClick={applySample}
          >
            Use sample topic
          </button>
        </div>
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="ragTopic">
          Topic
        </label>
        <textarea
          id="ragTopic"
          className={`${inputClass} min-h-[72px]`}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What should the draft cover?"
        />
      </div>

      <div className={fieldClass}>
        <span className={labelClass}>Target entities (optional)</span>
        <p className="text-xs text-[var(--cc-muted)]">
          Seed list until a shared entities API exists — free-text also allowed.
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {entitySeeds.slice(0, 16).map((name) => {
            const on = selectedEntities.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleEntity(name)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  on
                    ? "border-[var(--cc-accent)] bg-[var(--cc-accent)] text-white"
                    : "border-[var(--cc-line)] text-[var(--cc-ink)]"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className={`${inputClass} flex-1`}
            value={freeEntity}
            onChange={(e) => setFreeEntity(e.target.value)}
            placeholder="Add entity name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFreeEntity();
              }
            }}
          />
          <button
            type="button"
            className="rounded-md border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold"
            onClick={addFreeEntity}
          >
            Add
          </button>
        </div>
      </div>

      {isShort ? (
        <div className={fieldClass}>
          <span className={labelClass}>Ad templates (few-shot)</span>
          <p className="text-xs text-[var(--cc-muted)]">
            Owned here — pick up to 3 exemplars. Rag indexes them later; until then bodies are sent
            with generate.
          </p>
          <div className="mt-1 flex flex-col gap-2">
            {templates.map((t) => {
              const on = selectedTemplateIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTemplate(t.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    on
                      ? "border-[var(--cc-accent)] bg-teal-50"
                      : "border-[var(--cc-line)] bg-white"
                  }`}
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-xs text-[var(--cc-muted)]">
                    {[t.channel, t.framework].filter(Boolean).join(" · ")}
                  </span>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--cc-muted)]">{t.body}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              className={inputClass}
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Template name"
            />
            <input
              className={inputClass}
              value={newTemplateBody}
              onChange={(e) => setNewTemplateBody(e.target.value)}
              placeholder="Paste exemplar copy"
            />
            <button
              type="button"
              className="rounded-md border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold"
              onClick={addTemplate}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      {isLong ? (
        <label className="flex items-start gap-2 rounded-md border border-[var(--cc-line)] bg-white p-3 text-sm">
          <input
            type="checkbox"
            checked={guidedMode}
            onChange={(event) => {
              setGuidedMode(event.target.checked);
              setResult(null);
              setError(null);
            }}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold text-[var(--cc-ink)]">
              Guided outline → sections
            </span>
            <span className="mt-1 block text-xs text-[var(--cc-muted)]">
              Plan first, edit the outline, then draft or retry each section
              with independently verified citations.
            </span>
          </span>
        </label>
      ) : null}

      {guidedMode && isLong ? (
        <GuidedRagWriter
          intent={intent}
          topic={topic}
          targetEntities={selectedEntities}
          disabled={!guidedAvailable}
        />
      ) : (
        <button
          type="button"
          disabled={pending || topic.trim().length < 3 || !available}
          onClick={onGenerate}
          className="inline-flex w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate from RAG"}
        </button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!guidedMode && result && !result.softDisabled ? (
        <ResultPanel result={result} />
      ) : null}
    </div>
  );
}

function ResultPanel({ result }: { result: RagGenerateResponse }) {
  return (
    <section className="flex flex-col gap-4 border-t border-[var(--cc-line)] pt-6">
      <h2 className="text-lg font-semibold text-[var(--cc-ink)]">Draft</h2>
      <p className="text-xs text-[var(--cc-muted)]">
        Intent: {result.intent}
        {result.modelUsed ? ` · model: ${result.modelUsed}` : null}
        {result.retrievalMode ? ` · retrieval: ${result.retrievalMode}` : null}
      </p>

      {result.battlecard ? (
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <h3 className="font-semibold">Partner summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-[var(--cc-ink)]">
              {result.battlecard.partnerSummary}
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Competitor summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-[var(--cc-ink)]">
              {result.battlecard.competitorSummary}
            </p>
          </div>
          {result.battlecard.differentiators?.length ? (
            <div>
              <h3 className="font-semibold">Differentiators</h3>
              <ul className="mt-1 list-disc pl-5">
                {result.battlecard.differentiators.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.battlecard.risks?.length ? (
            <div>
              <h3 className="font-semibold">Risks</h3>
              <ul className="mt-1 list-disc pl-5">
                {result.battlecard.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {result.variations && result.variations.length > 0 ? (
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
          {result.variations.map((v, i) => (
            <li key={`${i}-${v.slice(0, 24)}`} className="whitespace-pre-wrap">
              {v}
            </li>
          ))}
        </ol>
      ) : null}

      {!result.battlecard && (!result.variations || result.variations.length === 0) && result.content ? (
        <pre className="whitespace-pre-wrap rounded-md border border-[var(--cc-line)] bg-white p-4 text-sm leading-relaxed text-[var(--cc-ink)]">
          {result.content}
        </pre>
      ) : null}

      {result.appliedTemplates && result.appliedTemplates.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-ink)]">Templates applied</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {result.appliedTemplates.map((t) => (
              <li key={t.id}>
                {t.name}
                {t.framework ? ` (${t.framework})` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.themeSources && result.themeSources.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-ink)]">Theme sources</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {result.themeSources.map((t, i) => (
              <li key={`${t.label}-${i}`}>
                <span className="font-medium">{t.label}</span>
                {t.relationship ? (
                  <span className="ml-2 text-xs text-[var(--cc-muted)]">{t.relationship}</span>
                ) : null}
                {t.url ? (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs text-[var(--cc-accent)] underline-offset-2 hover:underline"
                  >
                    source
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.warnings && result.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Warnings</p>
          <ul className="mt-1 list-disc pl-5">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.citations && result.citations.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-ink)]">Citations</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {result.citations.map((c, i) => (
              <li key={`${c.url}-${i}`} className="text-sm">
                <blockquote className="border-l-2 border-[var(--cc-accent)] pl-3 text-[var(--cc-ink)]">
                  <p className="italic">&ldquo;{c.quote}&rdquo;</p>
                </blockquote>
                <p className="mt-1 text-xs text-[var(--cc-muted)]">
                  {c.url.startsWith("http") ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--cc-accent)] underline-offset-2 hover:underline"
                    >
                      {c.title || c.url}
                    </a>
                  ) : (
                    <span>{c.title || c.url}</span>
                  )}
                  {[c.sectionTitle, c.crawlType].filter(Boolean).length > 0
                    ? ` · ${[c.sectionTitle, c.crawlType].filter(Boolean).join(" · ")}`
                    : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-[var(--cc-ink)]">Sources</h3>
        {result.sources.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--cc-muted)]">No source URLs returned.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {result.sources.map((s) => (
              <li key={`${s.kind}-${s.crawlType}-${s.url}`} className="text-sm">
                {s.url.startsWith("template://") ? (
                  <span className="font-medium text-[var(--cc-ink)]">{s.title || s.url}</span>
                ) : (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--cc-accent)] underline-offset-2 hover:underline"
                  >
                    {s.title || s.url}
                  </a>
                )}
                <span className="ml-2 text-xs text-[var(--cc-muted)]">
                  {[s.kind, s.entity, s.crawlType].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

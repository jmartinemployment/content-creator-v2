"use client";

import { useMemo, useState } from "react";
import { parseSavedSerp, ApiError } from "@/services/gcc-api";
import {
  buildCuratedSerpSeed,
  curatedSerpHasQuestions,
  type CuratedSerpSeed,
  type PaaCandidate,
  type SavedSerpParseResult,
} from "@/lib/content-creator/serp-lens";

/**
 * Pick the questions a pillar's FAQ section answers, from a saved Google results page.
 *
 * **This used to curate four things and three of them went nowhere.** Organic titles, organic URLs
 * and related searches were written to the brief and read by nothing -- zero references across every
 * `.cs` file in GeekAPI, v1 and v2 -- along with three provenance fields recording when a SERP
 * nobody read was captured. `.cursor/rules/no-unwired-code.mdc` had listed it since 2026-09-27
 * ("SERP ingest changed nothing"). Removed 2026-10-03, `plans/remove-unwired-code.md` Phase 1.
 *
 * The questions are the half that does something: they become the pillar's FAQ section
 * (`GccGenerateService:2407`) and license headings against PAA (`:3120`). So the panel is named for
 * that now -- "SERP ingest" described where the data came from, not what it is for, which is why its
 * output looked inert when three quarters of it was.
 */
export function SerpIngestPanel({
  gapTopic,
  onCurated,
}: {
  gapTopic: string;
  onCurated: (seed: CuratedSerpSeed | null) => void;
}) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<SavedSerpParseResult | null>(null);
  const [selectedPaa, setSelectedPaa] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runParse(content: string) {
    setError(null);
    setBusy(true);
    try {
      const result = await parseSavedSerp(content, gapTopic);
      setParsed(result);
      // Pre-checked on the parser's own relevance call, so the common case is confirm-and-go. The
      // weak ones are listed and unchecked rather than hidden -- the operator overrules the parser,
      // not the other way round.
      setSelectedPaa(
        new Set(
          result.peopleAlsoAsk
            .map((q, i) => (q.likelyRelevant ? i : -1))
            .filter((i) => i >= 0),
        ),
      );
      onCurated(null);
    } catch (e: unknown) {
      setParsed(null);
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "SERP parse failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function onFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRaw(text);
      void runParse(text);
    };
    reader.onerror = () => setError("Could not read file");
    reader.readAsText(file);
  }

  const curatedPreview = useMemo(
    () => (parsed ? buildCuratedSerpSeed(parsed, selectedPaa) : null),
    [parsed, selectedPaa],
  );

  function confirm() {
    // Never merge an empty result. A curatedPreview can exist with every question unchecked, and
    // seeding the brief with nothing would read as a confirmed-empty FAQ rather than no FAQ.
    if (!curatedPreview || !curatedSerpHasQuestions(curatedPreview)) {
      setError("Select at least one question before confirming — an empty set is never merged.");
      return;
    }
    setError(null);
    onCurated(curatedPreview);
  }

  const canConfirm = !!curatedPreview && curatedSerpHasQuestions(curatedPreview);

  return (
    <div className="mt-4 space-y-3 rounded-md border border-[var(--gcc-line)] bg-[var(--gcc-surface-muted,#f8faf9)] p-4">
      <p className="text-sm font-semibold text-foreground">FAQ questions from a saved results page</p>
      <p className="text-xs text-[var(--gcc-muted)]">
        Run the keyword search in your browser, save the results page, and upload it. The People Also
        Ask questions you confirm become the pillar&rsquo;s FAQ section &mdash; a pillar with no
        questions here gets no FAQ. Prefer <strong>page 1</strong>; page 2 usually has no PAA.
      </p>

      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-md border border-[var(--gcc-line)] bg-white px-3 py-1.5 text-xs font-semibold">
          Upload .html / .txt
          <input
            type="file"
            accept=".html,.htm,.txt,text/html,text/plain"
            className="hidden"
            onChange={(e) => onFile(e.target.files)}
          />
        </label>
        <button
          type="button"
          disabled={busy || !raw.trim()}
          onClick={() => void runParse(raw)}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white"
        >
          {busy ? "Parsing…" : "Parse pasted HTML"}
        </button>
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={4}
        placeholder="Or paste saved Google results HTML / text here"
        className="w-full rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 text-xs font-mono"
      />

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {parsed ? (
        <div className="space-y-4 text-sm">
          {parsed.parseWarning ? (
            <p className="text-xs text-amber-800">{parsed.parseWarning}</p>
          ) : null}
          {parsed.missingPaaLikelyPage2 ? (
            <p className="text-xs text-amber-800">
              No PAA extracted — if this was page 2, upload page 1 as well.
            </p>
          ) : null}

          <CandidateList
            title="People Also Ask"
            items={parsed.peopleAlsoAsk.map(
              (q: PaaCandidate) =>
                `${q.question}${q.likelyRelevant ? "" : " (unchecked — weak relevance)"}`,
            )}
            selected={selectedPaa}
            onToggle={(i) => setSelectedPaa((prev) => toggleSet(prev, i))}
          />

          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm questions for this brief
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CandidateList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: string[];
  selected: Set<number>;
  onToggle: (i: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-[var(--gcc-muted)]">None extracted</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-medium">
        {title}{" "}
        <span className="font-normal text-[var(--gcc-muted)]">
          ({selected.size}/{items.length} selected)
        </span>
      </p>
      <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
        {items.map((label, i) => (
          <li key={`${title}-${i}`}>
            <label className="flex cursor-pointer gap-2">
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() => onToggle(i)}
              />
              <span>{label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function toggleSet(prev: Set<number>, i: number): Set<number> {
  const next = new Set(prev);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  return next;
}

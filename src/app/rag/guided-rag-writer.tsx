"use client";

import { useMemo, useState } from "react";
import { generateRagDraft } from "./rag-generate-client";
import { SectionCitations } from "@/app/creates/rag-citations";
import type {
  RagCitation,
  RagGenerateRequest,
  RagOutlineSection,
  RagWritingIntent,
} from "./types";

type GuidedSection = RagOutlineSection & {
  content?: string;
  citations?: RagCitation[];
  error?: string;
  status?: "idle" | "writing" | "done";
};

type Props = {
  intent: RagWritingIntent;
  topic: string;
  targetEntities: string[];
  disabled?: boolean;
};

export function GuidedRagWriter({
  intent,
  topic,
  targetEntities,
  disabled = false,
}: Props) {
  const [sections, setSections] = useState<GuidedSection[]>([]);
  const [outlineBusy, setOutlineBusy] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assembledDraft = useMemo(
    () =>
      sections
        .filter((section) => section.content)
        .map((section) => `## ${section.heading}\n\n${section.content}`)
        .join("\n\n"),
    [sections],
  );

  const requestBase = (): Pick<
    RagGenerateRequest,
    "writingIntent" | "topic" | "targetEntities"
  > => ({
    writingIntent: intent,
    topic: topic.trim(),
    targetEntities: targetEntities.length > 0 ? targetEntities : undefined,
  });

  async function generateOutline() {
    setOutlineBusy(true);
    setError(null);
    try {
      const response = await generateRagDraft({
        ...requestBase(),
        generationStage: "outline",
      });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      if (response.data.softDisabled) {
        setError(
          response.data.warnings?.join(" ") ||
            "Guided generation requires the citeable RAG workflow.",
        );
        return;
      }
      const outline = response.data.outline ?? [];
      if (outline.length === 0) {
        setError("RAG returned no outline sections.");
        return;
      }
      setSections(
        outline.map((section, index) => ({
          ...section,
          key: section.key || `section-${index + 1}`,
          status: "idle",
        })),
      );
    } finally {
      setOutlineBusy(false);
    }
  }

  function updateSection(
    index: number,
    field: "heading" | "brief",
    value: string,
  ) {
    setSections((current) =>
      current.map((section, i) =>
        i === index ? { ...section, [field]: value } : section,
      ),
    );
  }

  async function writeSection(
    index: number,
    snapshot: GuidedSection[] = sections,
  ): Promise<GuidedSection[]> {
    const section = snapshot[index];
    if (!section) return snapshot;

    const writing = snapshot.map((item, i) =>
      i === index ? { ...item, status: "writing" as const, error: undefined } : item,
    );
    setSections(writing);

    const response = await generateRagDraft({
      ...requestBase(),
      generationStage: "section",
      outline: writing.map(({ key, heading, brief }) => ({ key, heading, brief })),
      sectionKey: section.key,
      sectionHeading: section.heading,
      sectionBrief: section.brief,
      completedSectionSummaries: writing
        .filter((item, i) => i !== index && item.content)
        .map(
          (item) =>
            `${item.heading}: ${item.content!.replace(/\s+/g, " ").slice(0, 500)}`,
        ),
    });

    let next: GuidedSection[];
    if (!response.ok) {
      next = writing.map((item, i) =>
        i === index
          ? { ...item, status: "idle", error: response.error }
          : item,
      );
    } else if (response.data.softDisabled || !response.data.content) {
      next = writing.map((item, i) =>
        i === index
          ? {
              ...item,
              status: "idle",
              error:
                response.data.warnings?.join(" ") ||
                "No section content returned.",
            }
          : item,
      );
    } else {
      next = writing.map((item, i) =>
        i === index
          ? {
              ...item,
              status: "done",
              content: response.data.content!,
              citations: response.data.citations ?? [],
              error: undefined,
            }
          : item,
      );
    }
    setSections(next);
    return next;
  }

  async function writeAllSections() {
    setAllBusy(true);
    setError(null);
    try {
      let working = sections;
      for (let index = 0; index < working.length; index += 1) {
        if (working[index]?.content) continue;
        working = await writeSection(index, working);
        if (working[index]?.error) break;
      }
    } finally {
      setAllBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--cc-line)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--cc-ink)]">
            Guided outline → sections
          </h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            RAG retrieves full page Markdown and verifies quotes separately for
            every section.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || outlineBusy || topic.trim().length < 3}
          onClick={() => void generateOutline()}
          className="rounded-md bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {outlineBusy
            ? "Planning…"
            : sections.length > 0
              ? "Regenerate outline"
              : "Generate outline"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {sections.length > 0 ? (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              type="button"
              disabled={allBusy || sections.some((s) => s.status === "writing")}
              onClick={() => void writeAllSections()}
              className="rounded-md border border-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-[var(--cc-accent)] disabled:opacity-50"
            >
              {allBusy ? "Writing sections…" : "Write all remaining"}
            </button>
          </div>

          {sections.map((section, index) => (
            <article
              key={`${section.key}-${index}`}
              className="rounded-md border border-[var(--cc-line)] p-3"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="flex flex-col gap-2">
                  <input
                    aria-label={`Section ${index + 1} heading`}
                    value={section.heading}
                    onChange={(event) =>
                      updateSection(index, "heading", event.target.value)
                    }
                    className="rounded-md border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold"
                  />
                  <textarea
                    aria-label={`Section ${index + 1} brief`}
                    value={section.brief}
                    onChange={(event) =>
                      updateSection(index, "brief", event.target.value)
                    }
                    className="min-h-[64px] rounded-md border border-[var(--cc-line)] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    allBusy ||
                    section.status === "writing" ||
                    !section.heading.trim()
                  }
                  onClick={() => void writeSection(index)}
                  className="h-fit rounded-md border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {section.status === "writing"
                    ? "Writing…"
                    : section.content
                      ? "Rewrite"
                      : "Write section"}
                </button>
              </div>

              {section.error ? (
                <p className="mt-2 text-sm text-red-600">{section.error}</p>
              ) : null}
              {section.content ? (
                <div className="mt-3">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--cc-ink)]">
                    {section.content}
                  </pre>
                  <SectionCitations citations={section.citations ?? []} />
                </div>
              ) : null}
            </article>
          ))}

          {assembledDraft ? (
            <div className="border-t border-[var(--cc-line)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[var(--cc-ink)]">
                  Assembled draft
                </h3>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(assembledDraft)}
                  className="text-sm font-semibold text-[var(--cc-accent)]"
                >
                  Copy Markdown
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-md bg-[var(--cc-paper)] p-4 text-sm leading-relaxed">
                {assembledDraft}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

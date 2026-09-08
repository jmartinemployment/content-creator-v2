"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ButtonBusyLabel } from "@/app/components/loading-indicator";
import { SectionCitations } from "@/app/creates/rag-citations";
import type {
  CanvasSection,
  ContentRun,
  ParagraphNode,
  SectionNode,
} from "@/app/creates/canvas-types";

export type CanvasAction = "rewrite" | "expand" | "re-tone";

function runsToPlain(runs: ContentRun[]): string {
  return runs.map((run) => run.text).join("");
}

function paragraphToPlain(paragraph: ParagraphNode): string {
  return paragraph.type === "list"
    ? paragraph.items.map((item) => `• ${runsToPlain(item)}`).join("\n")
    : runsToPlain(paragraph.runs);
}

export function sectionRootBodyToPlain(section: SectionNode): string {
  return section.paragraphs.map(paragraphToPlain).filter(Boolean).join("\n\n");
}

function normalizedHeading(text: string): string {
  return text.trim().replace(/:+$/, "").trim().toLowerCase();
}

function headingsEqual(a: string, b: string): boolean {
  return Boolean(a.trim() && b.trim() && normalizedHeading(a) === normalizedHeading(b));
}

function paragraphRepeatsHeading(paragraph: ParagraphNode, heading: string): boolean {
  return (
    paragraph.type === "text"
    && paragraph.runs.length > 0
    && paragraph.runs.every((run) => run.bold)
    && headingsEqual(paragraphToPlain(paragraph), heading)
  );
}

function sectionToPlain(
  section: SectionNode,
  options: { depth?: number; rootHeading?: string } = {},
): string {
  const depth = options.depth ?? 0;
  const rootHeading = options.rootHeading ?? (depth === 0 ? section.heading : undefined);
  const parts: string[] = [];
  if (depth > 0 && section.heading) parts.push(section.heading);
  for (const paragraph of section.paragraphs) {
    if (depth === 0 && rootHeading && paragraphRepeatsHeading(paragraph, rootHeading)) continue;
    parts.push(paragraphToPlain(paragraph));
  }
  for (const child of section.children) {
    if (rootHeading && headingsEqual(child.heading, rootHeading)) continue;
    parts.push(sectionToPlain(child, { depth: depth + 1, rootHeading }));
  }
  return parts.filter(Boolean).join("\n\n");
}

export function canvasSectionsToPlain(sections: CanvasSection[]): string {
  return sections
    .map((item) => {
      const heading = item.section.heading || item.heading;
      const body = sectionToPlain(item.section, { rootHeading: heading });
      return body.startsWith(heading) ? body : `${heading}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}

function runText(run: ContentRun): ReactNode {
  let node: ReactNode = run.text;
  if (run.bold) node = <strong>{node}</strong>;
  if (run.italic) node = <em>{node}</em>;
  if (run.href) node = <a href={run.href} className="underline">{node}</a>;
  return node;
}

function ParagraphView({ paragraph }: { paragraph: ParagraphNode }) {
  if (paragraph.type === "list") {
    const Tag = paragraph.ordered ? "ol" : "ul";
    return (
      <Tag className={paragraph.ordered ? "list-decimal pl-5" : "list-disc pl-5"}>
        {paragraph.items.map((runs, index) => (
          <li key={index}>
            {runs.map((run, runIndex) => <Fragment key={runIndex}>{runText(run)} </Fragment>)}
          </li>
        ))}
      </Tag>
    );
  }
  return (
    <p className="leading-relaxed">
      {paragraph.runs.map((run, index) => <Fragment key={index}>{runText(run)} </Fragment>)}
    </p>
  );
}

function SectionBody({
  section,
  depth,
  rootHeading,
}: {
  section: SectionNode;
  depth: number;
  rootHeading?: string;
}) {
  const HeadingTag = (section.tag && /^h[1-6]$/.test(section.tag) ? section.tag : "h3") as
    | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const cardHeading = rootHeading ?? (depth === 0 ? section.heading : undefined);
  const paragraphs = section.paragraphs.filter(
    (paragraph) => !(depth === 0 && cardHeading && paragraphRepeatsHeading(paragraph, cardHeading)),
  );
  const children = section.children.filter(
    (child) => !(cardHeading && headingsEqual(child.heading, cardHeading)),
  );
  return (
    <div className={depth > 0 ? "mt-4 border-l-2 border-[var(--cc-line)] pl-4" : undefined}>
      {depth > 0 ? (
        <HeadingTag className="text-base font-semibold text-[var(--cc-ink)]">{section.heading}</HeadingTag>
      ) : null}
      <div className="mt-2 flex flex-col gap-2 text-sm text-[var(--cc-ink)]">
        {paragraphs.map((paragraph, index) => <ParagraphView key={index} paragraph={paragraph} />)}
      </div>
      {children.map((child, index) => (
        <SectionBody key={index} section={child} depth={depth + 1} rootHeading={cardHeading} />
      ))}
    </div>
  );
}

export function WorkspaceSection({
  item,
  highlighted,
  instruction,
  pending,
  onInstructionChange,
  onAction,
  onSaveExact,
}: {
  item: CanvasSection;
  highlighted: boolean;
  instruction: string;
  pending: boolean;
  onInstructionChange: (value: string) => void;
  onAction: (action: CanvasAction) => void;
  onSaveExact: (exactContent: string) => Promise<void>;
}) {
  const heading = item.section.heading || item.heading;
  const [editing, setEditing] = useState(false);
  const [exactContent, setExactContent] = useState(() => sectionRootBodyToPlain(item.section));

  async function saveExactContent() {
    await onSaveExact(exactContent);
    setEditing(false);
  }

  return (
    <article
      id={`section-card-${item.sectionKey}`}
      className={`rounded-lg border p-4 ${
        highlighted
          ? "border-[var(--cc-accent)] ring-2 ring-[var(--cc-accent)]/30"
          : "border-[var(--cc-line)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-[var(--cc-ink)]">{heading}</h2>
        {item.job ? (
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-[var(--cc-muted)]">
            {item.job === "problem" ? "Opening context" : item.job === "advance" ? "Core section" : item.job === "faq" ? "Common questions" : item.job}
          </span>
        ) : null}
        <span className="text-xs text-[var(--cc-muted)]">{item.wordCount} words</span>
        {item.usedFallbackStub ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            Draft needs review
          </span>
        ) : null}
      </div>
      <SectionBody section={item.section} depth={0} rootHeading={heading} />
      <SectionCitations citations={item.citations} />
      <div className="mt-3 border-t border-[var(--cc-line)] pt-3">
        {editing ? (
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`exact-section-${item.sectionKey}`}
              className="text-xs font-semibold text-[var(--cc-ink)]"
            >
              Edit section content directly
            </label>
            <p className="text-xs text-[var(--cc-muted)]">
              This saves your text exactly without an AI rewrite. The heading, citations, evidence,
              and nested subsections stay attached; validation will require a fresh review.
            </p>
            <textarea
              id={`exact-section-${item.sectionKey}`}
              aria-label={`Exact content for ${heading}`}
              rows={Math.min(24, Math.max(8, exactContent.split("\n").length + 2))}
              maxLength={100000}
              value={exactContent}
              onChange={(event) => setExactContent(event.target.value)}
              className="w-full rounded-md border border-[var(--cc-line)] px-3 py-2 text-sm text-[var(--cc-ink)]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || !exactContent.trim()}
                onClick={() => void saveExactContent()}
                className="rounded-md bg-[var(--cc-accent)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                <ButtonBusyLabel busy={pending} busyLabel="Saving…" idleLabel="Save content" />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setExactContent(sectionRootBodyToPlain(item.section));
                  setEditing(false);
                }}
                className="rounded-md border border-[var(--cc-line)] px-3 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setExactContent(sectionRootBodyToPlain(item.section));
              setEditing(true);
            }}
            className="rounded-md border border-[var(--cc-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--cc-ink)]"
          >
            Edit content
          </button>
        )}
      </div>
      <div className="mt-3 border-t border-[var(--cc-line)] pt-3">
        <p className="text-xs font-semibold text-[var(--cc-ink)]">Guide a revision</p>
        <p className="mt-1 text-xs text-[var(--cc-muted)]">
          Add an instruction, then ask AI to rewrite, expand, or adjust the tone.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label={`Revision instruction for ${heading}`}
            placeholder="Describe what should change…"
            value={instruction}
            onChange={(event) => onInstructionChange(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs"
          />
          {(["rewrite", "expand", "re-tone"] as const).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              disabled={pending}
              className="rounded-md border border-[var(--cc-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--cc-ink)] disabled:opacity-60"
            >
              <ButtonBusyLabel
                busy={pending}
                busyLabel="Working…"
                idleLabel={action === "re-tone" ? "Adjust tone" : action === "rewrite" ? "Rewrite" : "Expand"}
              />
            </button>
          ))}
        </div>
      </div>
      {item.provenance ? (
        <details className="mt-3 text-xs text-[var(--cc-muted)]">
          <summary className="cursor-pointer">Section technical details</summary>
          <p className="mt-1">
            Model: {item.provenance.effectiveModel || item.provenance.modelUsed || "—"} · Retrieval:{" "}
            {item.provenance.retrievalStrategy || item.provenance.retrievalMode || "—"} ·{" "}
            {item.provenance.evidenceIds?.length ?? 0} evidence item(s)
          </p>
        </details>
      ) : null}
    </article>
  );
}

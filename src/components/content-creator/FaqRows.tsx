"use client";

import { useId } from "react";
import { emptyFaqRow, faqRowHasNoAnswer, type FaqRow } from "@/lib/content-creator/brief-catalog";

/**
 * The rows of one FAQ box of the brief: a question, and the operator's own answer to it (2026-10-13).
 *
 * One editor for all three boxes, "People Also Ask (direct entry, optional)", "Blog FAQ (optional)"
 * and each tool's "Tool page FAQ", so a question is entered the same way wherever it is asked. Until
 * then each box was a list of questions typed one per line, and GeekAPI searched the partners' sites
 * for each answer. Jeff supplies the answer now: nothing is searched, the writer says his answer in
 * the Brief's voice, and a question with no answer is left off the page and reported. So a row that
 * asks a question and has no answer says so here, before a run does.
 *
 * Built as a tool's rows are (`EvidenceRows` in NicheFramingPanel): the same boxes, the same "Row"
 * number and "Remove" above each row, the same kind of button under the last. With no rows there is
 * only the button.
 *
 * It holds nothing of its own. The rows are the brief's, handed in and handed back on every change,
 * and nothing is saved until the operator clicks Save. Each panel prints the box's name and hint in
 * its own manner; `label` is that name again, for a screen reader to say which box the rows are in.
 */
export default function FaqRows({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: FaqRow[];
  onChange: (next: FaqRow[]) => void;
}) {
  const id = useId();

  function patchRow(index: number, next: Partial<FaqRow>) {
    onChange(rows.map((row, i) => (i === index ? editedRow(row, next) : row)));
  }
  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }
  function addRow() {
    onChange([...rows, emptyFaqRow()]);
  }

  return (
    <div role="group" aria-label={label} className="font-normal">
      {rows.length > 0 ? (
        <ol className="mt-2 space-y-3">
          {rows.map((row, index) => {
            const noAnswerId = `${id}-${rowNumber(row)}-no-answer`;
            const noAnswer = faqRowHasNoAnswer(row);
            const noQuestion = row.question.trim().length === 0 && row.answer.trim().length > 0;
            return (
              <li key={rowNumber(row)} className="border border-[var(--gcc-border)] p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Row {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
                <label className="mt-2 block">
                  <span className="text-xs text-foreground">Question</span>
                  <input
                    type="text"
                    value={row.question}
                    onChange={(e) => patchRow(index, { question: e.target.value })}
                    placeholder="Does it sync with QuickBooks Online?"
                    className={boxClass}
                  />
                </label>
                <label className="mt-2 block">
                  <span className="text-xs text-foreground">Answer</span>
                  <textarea
                    value={row.answer}
                    onChange={(e) => patchRow(index, { answer: e.target.value })}
                    rows={3}
                    placeholder="Yes. Payments sync to QuickBooks Online within the hour, with no export file."
                    aria-describedby={noAnswer ? noAnswerId : undefined}
                    className={boxClass}
                  />
                </label>
                {noAnswer ? (
                  <p
                    id={noAnswerId}
                    className="mt-1 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-2 py-1 text-xs text-foreground"
                  >
                    No answer entered. This question is left off the page until it has one.
                  </p>
                ) : null}
                {/* An answer is written under its question, so one with no question has no place on
                    the page: GeekAPI reads a row with no question as no row. */}
                {noQuestion ? (
                  <p className="mt-1 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-2 py-1 text-xs text-foreground">
                    No question entered. This answer is left off the page until it has one.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      <button
        type="button"
        onClick={addRow}
        className="mt-2 text-xs font-medium text-brand hover:underline"
      >
        Add a question
      </button>
    </div>
  );
}

/** The boxes of a tool's rows in NicheFramingPanel, so a FAQ row looks like a row of the same form. */
const boxClass =
  "mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground";

/**
 * A row's identity while the form is open, for React's key. A row is stored by its place in its
 * list, and a box keyed by place keeps what the browser holds for the row that was there before a
 * row above it was removed, such as the height its answer box was dragged to. So each row object is
 * numbered when it is first seen, as a tool's rows are in NicheFramingPanel.
 */
const rowNumbers = new WeakMap<FaqRow, number>();
let nextRowNumber = 0;

function rowNumber(row: FaqRow): number {
  const known = rowNumbers.get(row);
  if (known !== undefined) return known;
  const assigned = nextRowNumber;
  nextRowNumber += 1;
  rowNumbers.set(row, assigned);
  return assigned;
}

/** An edited row is a new object; it keeps the number of the one it replaces. */
function editedRow(row: FaqRow, next: Partial<FaqRow>): FaqRow {
  const edited = { ...row, ...next };
  rowNumbers.set(edited, rowNumber(row));
  return edited;
}

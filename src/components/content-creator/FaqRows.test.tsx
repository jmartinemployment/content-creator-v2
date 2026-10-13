import assert from "node:assert/strict";
import { test } from "node:test";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FaqRows from "@/components/content-creator/FaqRows";
import type { FaqRow } from "@/lib/content-creator/brief-catalog";

/**
 * The rows of one FAQ box of the brief (2026-10-13): a question and the operator's own answer to it.
 * The same editor is under "People Also Ask (direct entry, optional)", "Blog FAQ (optional)" and
 * each tool's "Tool page FAQ". Rendered with its rows held by the test as a panel holds them.
 */

const NO_ANSWER = "No answer entered. This question is left off the page until it has one.";
const QUESTION_EXAMPLE = "Does it sync with QuickBooks Online?";
const ANSWER_EXAMPLE = "Yes. Payments sync to QuickBooks Online within the hour, with no export file.";

/** The editor with its rows held as a panel holds them; `held.current` is what the brief would hold. */
function open(initial: FaqRow[]): { held: { current: FaqRow[] } } {
  const held = { current: initial };
  function Held() {
    const [rows, setRows] = useState(initial);
    return (
      <FaqRows
        label="Blog FAQ (optional)"
        rows={rows}
        onChange={(next) => {
          held.current = next;
          setRows(next);
        }}
      />
    );
  }
  render(<Held />);
  return { held };
}

const questions = () => (screen.queryAllByLabelText("Question") as HTMLInputElement[]).map((el) => el.value);
const answers = () => (screen.queryAllByLabelText("Answer") as HTMLTextAreaElement[]).map((el) => el.value);
const rowsShown = () => screen.queryAllByRole("listitem");

test("with no rows there is the button to add a question, and nothing else", (t) => {
  t.after(cleanup);
  open([]);

  assert.ok(screen.getByRole("button", { name: "Add a question" }));
  assert.deepEqual(rowsShown(), []);
  assert.equal(screen.queryByRole("button", { name: "Remove" }), null);
  assert.equal(screen.queryByLabelText("Question"), null);
  assert.equal(screen.queryByLabelText("Answer"), null);
  // The rows are named for the box they are in, for a screen reader.
  assert.ok(screen.getByRole("group", { name: "Blog FAQ (optional)" }));
});

test("a row is a one-line question, a three-line answer and a way to remove it, each box labelled", (t) => {
  t.after(cleanup);
  open([{ question: "How long does a rollout take?", answer: "Two to four weeks." }]);

  const question = screen.getByLabelText("Question") as HTMLInputElement;
  const answer = screen.getByLabelText("Answer") as HTMLTextAreaElement;
  assert.equal(question.tagName, "INPUT");
  assert.equal(question.type, "text");
  assert.equal(question.value, "How long does a rollout take?");
  assert.equal(question.placeholder, QUESTION_EXAMPLE);
  assert.equal(answer.tagName, "TEXTAREA");
  assert.equal(answer.rows, 3);
  assert.equal(answer.value, "Two to four weeks.");
  assert.equal(answer.placeholder, ANSWER_EXAMPLE);
  // An answer is prose: not the fixed-width face the questions were typed in, one per line.
  assert.doesNotMatch(answer.className, /font-mono/);
  assert.doesNotMatch(question.className, /font-mono/);
  assert.ok(screen.getByRole("button", { name: "Remove" }));
});

test("a row with a question and no answer says it is left off the page, and a row with both does not", (t) => {
  t.after(cleanup);
  open([
    { question: "How long does a rollout take?", answer: "Two to four weeks." },
    { question: "What does it cost to run?", answer: "" },
    // An answer of spaces is no answer.
    { question: "Who signs it off?", answer: "   " },
    // No question is asked by these two, so no question is left off a page.
    { question: "", answer: "An answer waiting for its question." },
    { question: "", answer: "" },
  ]);

  const said = rowsShown().map((row) => row.textContent?.includes(NO_ANSWER) ?? false);
  assert.deepEqual(said, [false, true, true, false, false]);
  assert.equal(screen.getAllByText(NO_ANSWER).length, 2);

  // The sentence is tied to the answer box it is about, and goes when the answer is typed.
  const unanswered = screen.getAllByLabelText("Answer")[1] as HTMLTextAreaElement;
  const note = screen.getAllByText(NO_ANSWER)[0];
  assert.equal(unanswered.getAttribute("aria-describedby"), note.id);
  fireEvent.change(unanswered, { target: { value: "About $400 a month." } });
  assert.deepEqual(
    rowsShown().map((row) => row.textContent?.includes(NO_ANSWER) ?? false),
    [false, false, true, false, false],
  );
  assert.equal((screen.getAllByLabelText("Answer")[1] as HTMLTextAreaElement).getAttribute("aria-describedby"), null);
});

test("a question is added as the last row, and what is typed in it is the brief's", (t) => {
  t.after(cleanup);
  const { held } = open([{ question: "How long does a rollout take?", answer: "Two to four weeks." }]);

  fireEvent.click(screen.getByRole("button", { name: "Add a question" }));
  assert.deepEqual(questions(), ["How long does a rollout take?", ""]);
  assert.deepEqual(answers(), ["Two to four weeks.", ""]);
  // A row nothing is typed in says nothing: there is no question to leave off a page.
  assert.equal(screen.queryByText(NO_ANSWER), null);

  fireEvent.change(screen.getAllByLabelText("Question")[1], { target: { value: "What does it cost to run?" } });
  assert.equal(screen.getAllByText(NO_ANSWER).length, 1);
  fireEvent.change(screen.getAllByLabelText("Answer")[1], { target: { value: "About $400 a month. " } });

  // Held as typed, spaces and all; a Save trims it.
  assert.deepEqual(held.current, [
    { question: "How long does a rollout take?", answer: "Two to four weeks." },
    { question: "What does it cost to run?", answer: "About $400 a month. " },
  ]);
  assert.equal(screen.queryByText(NO_ANSWER), null);
});

test("removing a row takes that question and its answer, and the rows below keep theirs", (t) => {
  t.after(cleanup);
  const { held } = open([
    { question: "How long does a rollout take?", answer: "Two to four weeks." },
    { question: "What does it cost to run?", answer: "" },
    { question: "Who signs it off?", answer: "The controller." },
  ]);

  fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

  assert.deepEqual(questions(), ["What does it cost to run?", "Who signs it off?"]);
  assert.deepEqual(answers(), ["", "The controller."]);
  assert.deepEqual(held.current, [
    { question: "What does it cost to run?", answer: "" },
    { question: "Who signs it off?", answer: "The controller." },
  ]);
  // The sentence stays with the row it was under, which is the first row now.
  assert.deepEqual(
    rowsShown().map((row) => row.textContent?.includes(NO_ANSWER) ?? false),
    [true, false],
  );

  fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  assert.deepEqual(held.current, []);
  assert.deepEqual(rowsShown(), []);
  assert.ok(screen.getByRole("button", { name: "Add a question" }));
});

test("an answer typed with no question says it is left off the page, and a row with both says nothing", (t) => {
  t.after(cleanup);
  open([
    { question: "", answer: "Yes, within the hour." },
    { question: "Does it sync?", answer: "Yes." },
  ]);

  const shown = rowsShown();
  assert.equal(shown.length, 2);
  assert.ok(shown[0].textContent?.includes("No question entered. This answer is left off the page until it has one."));
  assert.ok(!shown[0].textContent?.includes(NO_ANSWER));
  assert.ok(!shown[1].textContent?.includes("No question entered."));
  assert.ok(!shown[1].textContent?.includes(NO_ANSWER));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NicheFramingPanel from "@/components/content-creator/NicheFramingPanel";
import {
  emptyNicheFraming,
  emptyNicheFramingSet,
  type NicheFraming,
} from "@/lib/content-creator/brief-catalog";

/**
 * The table of rows in the brief's niche framing: each row names the partner it is for (Jeff,
 * 2026-10-11: "Row 1 is not associated with vendor/partner X"). Rendered against a project with two
 * partners, with the brief held by the test as the brief panel holds it.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ALL = "";

function installProject(partnerUrls: string[]): void {
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith(`/projects/${PROJECT_ID}`)) {
      return new Response(JSON.stringify({ id: PROJECT_ID, partnerUrls }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not answered by the test", { status: 500 });
  };
}

function framing(): NicheFraming {
  return {
    ...emptyNicheFraming(),
    coreProblem: "Cash arrives whenever the customer gets round to paying.",
    evidence: [{ problem: "Invoices go out late.", solution: "Scheduled invoicing.", terms: ["invoicing"] }],
    painPoints: "Invoices go out late.",
    perTool: {
      "upflow.io": {
        ...emptyNicheFramingSet(),
        evidence: [
          { problem: "Reminders are sent by hand.", solution: "Automated reminder sequences.", terms: [] },
        ],
        painPoints: "Reminders are sent by hand.",
      },
    },
  };
}

/** The panel with its brief held as `ContentBriefPanel` holds it; `saved.current` is what a Save would send. */
function open(initial: NicheFraming): { saved: { current: NicheFraming } } {
  const saved = { current: initial };
  function Held() {
    const [value, setValue] = useState(initial);
    return (
      <NicheFramingPanel
        projectId={PROJECT_ID}
        value={value}
        onChange={(next) => {
          saved.current = next;
          setValue(next);
        }}
      />
    );
  }
  render(<Held />);
  return { saved };
}

const PROBLEM = "Tax forms, vendor details and compliance records are stored inconsistently.";
const TERMS = "supplier onboarding, W-9 W-8, tax compliance";

function problemsInTableOrder(): string[] {
  return (screen.getAllByPlaceholderText(PROBLEM) as HTMLTextAreaElement[]).map((el) => el.value);
}

/** The partner chosen on each row, in table order. The last dropdown on the page is the paste's. */
function rowPartners(): HTMLSelectElement[] {
  const all = screen.getAllByRole("combobox") as HTMLSelectElement[];
  return all.slice(0, all.length - 1);
}

async function partnersLoaded(): Promise<void> {
  await waitFor(() => assert.ok(screen.getAllByText("Chaserhq — chaserhq.com").length > 0));
}

test("each row shows the partner it is for, and every partner of the project can be chosen", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  open(framing());
  await partnersLoaded();

  assert.deepEqual(problemsInTableOrder(), ["Invoices go out late.", "Reminders are sent by hand."]);
  assert.deepEqual(rowPartners().map((s) => s.value), [ALL, "upflow.io"]);
  assert.deepEqual(
    [...rowPartners()[0].options].map((o) => o.text),
    ["All partners", "Chaserhq — chaserhq.com", "Upflow — upflow.io"],
  );
});

test("choosing a partner on a row gives the row to that partner and leaves it where it is in the table", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  fireEvent.change(rowPartners()[0], { target: { value: "upflow.io" } });

  assert.deepEqual(saved.current.evidence, []);
  assert.equal(saved.current.painPoints, "");
  assert.deepEqual(
    saved.current.perTool["upflow.io"].evidence.map((r) => r.problem),
    ["Reminders are sent by hand.", "Invoices go out late."],
  );
  // Stored after Upflow's other row, shown where it was: the row does not move under the cursor.
  assert.deepEqual(problemsInTableOrder(), ["Invoices go out late.", "Reminders are sent by hand."]);
  assert.deepEqual(rowPartners().map((s) => s.value), ["upflow.io", "upflow.io"]);

  // And it is still the first row once its text is edited.
  fireEvent.change(screen.getAllByPlaceholderText(PROBLEM)[0], { target: { value: "Invoices go out a week late." } });
  assert.deepEqual(problemsInTableOrder(), ["Invoices go out a week late.", "Reminders are sent by hand."]);
  assert.equal(saved.current.perTool["upflow.io"].evidence[1].problem, "Invoices go out a week late.");
  assert.equal(
    saved.current.perTool["upflow.io"].painPoints,
    "Reminders are sent by hand.\n\nInvoices go out a week late.",
  );
});

test("a new row is last and takes the partner of the row above it", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  fireEvent.click(screen.getByRole("button", { name: "+ Add a row" }));

  assert.deepEqual(problemsInTableOrder(), ["Invoices go out late.", "Reminders are sent by hand.", ""]);
  assert.deepEqual(rowPartners().map((s) => s.value), [ALL, "upflow.io", "upflow.io"]);
  assert.equal(saved.current.perTool["upflow.io"].evidence.length, 2);

  // Given to Chaserhq, it stays last in the table though Chaserhq is the project's first partner.
  fireEvent.change(rowPartners()[2], { target: { value: "chaserhq.com" } });
  fireEvent.change(screen.getAllByPlaceholderText(PROBLEM)[2], { target: { value: "Nobody chases." } });
  assert.deepEqual(problemsInTableOrder(), ["Invoices go out late.", "Reminders are sent by hand.", "Nobody chases."]);
  assert.deepEqual(saved.current.perTool["chaserhq.com"].evidence.map((r) => r.problem), ["Nobody chases."]);
  assert.equal(saved.current.perTool["upflow.io"].evidence.length, 1);
});

test("with no rows yet, the first row is for all partners", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(emptyNicheFraming());
  await partnersLoaded();

  fireEvent.click(screen.getByRole("button", { name: "+ Add a row" }));

  assert.deepEqual(rowPartners().map((s) => s.value), [ALL]);
  assert.equal(saved.current.evidence.length, 1);
});

test("removing a row takes it from the partner it was under", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);

  assert.deepEqual(problemsInTableOrder(), ["Invoices go out late."]);
  assert.deepEqual(saved.current.perTool["upflow.io"].evidence, []);
  assert.equal(saved.current.perTool["upflow.io"].painPoints, "");
  assert.equal(saved.current.evidence.length, 1);
});

test("pasted rows go to the partner chosen for the paste", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  const all = screen.getAllByRole("combobox") as HTMLSelectElement[];
  const pasteFor = all[all.length - 1];
  // Until one is chosen it is the last row's partner.
  assert.equal(pasteFor.value, "upflow.io");

  fireEvent.change(pasteFor, { target: { value: "chaserhq.com" } });
  fireEvent.change(screen.getByPlaceholderText(/^International vendors are paid manually/), {
    target: { value: "Nobody chases.\tAutomated chasing by email and SMS.\tchasing, reminders\nDisputes stall.\tA payment portal." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Make rows" }));

  assert.deepEqual(
    saved.current.perTool["chaserhq.com"].evidence,
    [
      { problem: "Nobody chases.", solution: "Automated chasing by email and SMS.", terms: ["chasing", "reminders"] },
      { problem: "Disputes stall.", solution: "A payment portal.", terms: [] },
    ],
  );
  assert.equal(saved.current.perTool["chaserhq.com"].painPoints, "Nobody chases.\n\nDisputes stall.");
  assert.equal(saved.current.perTool["upflow.io"].evidence.length, 1);
  assert.equal(saved.current.evidence.length, 1);
  assert.deepEqual(problemsInTableOrder(), [
    "Invoices go out late.",
    "Reminders are sent by hand.",
    "Nobody chases.",
    "Disputes stall.",
  ]);
});

test("a second search term can be typed, comma and all", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  const terms = () => screen.getAllByPlaceholderText(TERMS)[0] as HTMLInputElement;
  assert.equal(terms().value, "invoicing");

  fireEvent.change(terms(), { target: { value: "invoicing," } });
  assert.equal(terms().value, "invoicing,");
  assert.deepEqual(saved.current.evidence[0].terms, ["invoicing"]);

  fireEvent.change(terms(), { target: { value: "invoicing, payment links" } });
  assert.equal(terms().value, "invoicing, payment links");
  assert.deepEqual(saved.current.evidence[0].terms, ["invoicing", "payment links"]);
});

test("a partner's own section has no second table of rows", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  open(framing());
  await partnersLoaded();

  fireEvent.click(screen.getByRole("button", { name: /Upflow/ }));

  // Its own problem, pitch and questions are there; its row is only in the table above.
  assert.ok(screen.getByText("Upflow's own"));
  assert.ok(screen.getByText("Tool page FAQ"));
  assert.equal(screen.getAllByRole("button", { name: "+ Add a row" }).length, 1);
  assert.deepEqual(problemsInTableOrder(), ["Invoices go out late.", "Reminders are sent by hand."]);
});

test("a row saved under a host that is no longer a partner is shown and says so", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com"]);
  open(framing());
  await partnersLoaded();

  assert.deepEqual(problemsInTableOrder(), ["Invoices go out late.", "Reminders are sent by hand."]);
  assert.deepEqual(
    [...rowPartners()[1].options].map((o) => o.text),
    ["All partners", "Chaserhq — chaserhq.com", "upflow.io — not a partner of this project"],
  );
  assert.equal(rowPartners()[1].value, "upflow.io");
});

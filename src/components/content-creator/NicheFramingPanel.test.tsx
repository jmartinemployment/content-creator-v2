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
 * The brief's niche framing: one section a tool, holding everything researched for it (Jeff,
 * 2026-10-12: "incorporate the new section into old or accordian section and add the Sales pitch to
 * each tool"). Rendered against a project with two partners, with the brief held by the test as the
 * brief panel holds it.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

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

/** The research as it is entered now: one problem for the category, the rest under each tool. */
function framing(): NicheFraming {
  return {
    ...emptyNicheFraming(),
    coreProblem: "Cash arrives whenever the customer gets round to paying.",
    perTool: {
      "upflow.io": {
        ...emptyNicheFramingSet(),
        coreProblem: "Collections run on memory.",
        automationToPitch: "Get paid without chasing.",
        faqQuestions: "Does it sync with QuickBooks?",
        evidence: [
          { problem: "Reminders are sent by hand.", solution: "Automated reminder sequences.", terms: ["reminders"] },
          { problem: "Disputes stall payment.", solution: "A payment portal.", terms: [] },
        ],
        painPoints: "Reminders are sent by hand.\n\nDisputes stall payment.",
      },
    },
  };
}

/** A brief saved when a row could be for every partner. */
function framingWithARowForAllPartners(): NicheFraming {
  return {
    ...framing(),
    evidence: [{ problem: "Invoices go out late.", solution: "Scheduled invoicing.", terms: ["invoicing"] }],
    painPoints: "Invoices go out late.",
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

const FAILURE = "Tax forms, vendor details and compliance records are stored inconsistently.";
const TERMS = "supplier onboarding, W-9 W-8, tax compliance";
const HOOK = /^Stop rebuilding the forecast every Monday/;
const PAIN_POINT = /^Fractional CFOs lose twenty hours a month/;

function failuresShown(): string[] {
  return (screen.queryAllByPlaceholderText(FAILURE) as HTMLTextAreaElement[]).map((el) => el.value);
}

function section(name: RegExp): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

async function partnersLoaded(): Promise<void> {
  await waitFor(() => assert.ok(screen.getByRole("button", { name: /Chaserhq/ })));
}

test("a tool's section holds its pain point, its rows, its hook and its FAQ, in the research's order", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  open(framing());
  await partnersLoaded();

  // Closed, nothing of a tool's is on the page: there is no table of every tool's rows above.
  assert.deepEqual(failuresShown(), []);
  assert.equal(screen.queryByRole("button", { name: "+ Add a row" }), null);

  fireEvent.click(section(/Upflow/));

  assert.deepEqual(failuresShown(), ["Reminders are sent by hand.", "Disputes stall payment."]);
  assert.equal((screen.getByPlaceholderText(PAIN_POINT) as HTMLTextAreaElement).value, "Collections run on memory.");
  assert.equal((screen.getByPlaceholderText(HOOK) as HTMLTextAreaElement).value, "Get paid without chasing.");
  const labels = ["Core pain point", "Where small businesses fail, and the tool’s remedy", "The marketing/sales hook to pitch", "Tool page FAQ"]
    .map((label) => screen.getByText(label));
  for (let i = 1; i < labels.length; i += 1) {
    assert.ok(
      labels[i - 1].compareDocumentPosition(labels[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      `${labels[i].textContent} comes after ${labels[i - 1].textContent}`,
    );
  }
});

test("the hook typed in a tool's section is saved as that tool's pitch, and no other's", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  fireEvent.click(section(/Chaserhq/));
  fireEvent.change(screen.getByPlaceholderText(HOOK), { target: { value: "Never chase an invoice again." } });

  assert.equal(saved.current.perTool["chaserhq.com"].automationToPitch, "Never chase an invoice again.");
  assert.equal(saved.current.perTool["upflow.io"].automationToPitch, "Get paid without chasing.");
  assert.equal(saved.current.automationToPitch, "");
});

test("a closed section says what the tool has: its rows, whether it has a hook, its searches", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  open(framing());
  await partnersLoaded();

  assert.match(section(/Chaserhq/).textContent ?? "", /no rows · no hook · 1 search$/);
  assert.match(section(/Upflow/).textContent ?? "", /2 rows · hook · 3 searches$/);
});

test("a row added in a tool's section is that tool's, and is last", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  fireEvent.click(section(/Chaserhq/));
  fireEvent.click(screen.getByRole("button", { name: "+ Add a row" }));
  fireEvent.change(screen.getByPlaceholderText(FAILURE), { target: { value: "Nobody chases." } });

  assert.deepEqual(saved.current.perTool["chaserhq.com"].evidence.map((r) => r.problem), ["Nobody chases."]);
  assert.equal(saved.current.perTool["chaserhq.com"].painPoints, "Nobody chases.");
  assert.equal(saved.current.perTool["upflow.io"].evidence.length, 2);
  assert.deepEqual(saved.current.evidence, []);
});

test("removing a row takes it from that tool, and the row below keeps what was typed in it", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  fireEvent.click(section(/Upflow/));
  fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

  assert.deepEqual(failuresShown(), ["Disputes stall payment."]);
  assert.deepEqual(saved.current.perTool["upflow.io"].evidence.map((r) => r.problem), ["Disputes stall payment."]);
  assert.equal(saved.current.perTool["upflow.io"].painPoints, "Disputes stall payment.");
  // The first row's terms box is the second row's now, not the removed row's left behind.
  assert.equal((screen.getByPlaceholderText(TERMS) as HTMLInputElement).value, "");
});

test("research pasted in a tool's section makes rows for that tool", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  fireEvent.click(section(/Chaserhq/));
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
  assert.equal(saved.current.perTool["upflow.io"].evidence.length, 2);
  assert.deepEqual(failuresShown(), ["Nobody chases.", "Disputes stall."]);
});

test("a second search term can be typed, comma and all", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framing());
  await partnersLoaded();

  fireEvent.click(section(/Upflow/));
  const terms = () => screen.getAllByPlaceholderText(TERMS)[0] as HTMLInputElement;
  assert.equal(terms().value, "reminders");

  fireEvent.change(terms(), { target: { value: "reminders," } });
  assert.equal(terms().value, "reminders,");
  assert.deepEqual(saved.current.perTool["upflow.io"].evidence[0].terms, ["reminders"]);

  fireEvent.change(terms(), { target: { value: "reminders, payment links" } });
  assert.equal(terms().value, "reminders, payment links");
  assert.deepEqual(saved.current.perTool["upflow.io"].evidence[0].terms, ["reminders", "payment links"]);
});

test("a brief with no row for all partners shows no rows under the category", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  open(framing());
  await partnersLoaded();

  assert.equal(screen.queryByText("Rows saved for all partners"), null);
  assert.equal(screen.queryByText("Where they fail, and what the vendor does about it"), null);
});

test("a row saved for all partners is still shown, under the category, and can be given to a tool", async (t) => {
  t.after(cleanup);
  installProject(["https://www.chaserhq.com", "https://upflow.io"]);
  const { saved } = open(framingWithARowForAllPartners());
  await partnersLoaded();

  assert.ok(screen.getByText("Rows saved for all partners"));
  assert.deepEqual(failuresShown(), ["Invoices go out late."]);
  // One can be given away or removed; none can be added.
  assert.equal(screen.queryByRole("button", { name: "+ Add a row" }), null);
  const giveTo = screen.getByRole("combobox") as HTMLSelectElement;
  assert.deepEqual(
    [...giveTo.options].map((o) => o.text),
    ["All partners", "Chaserhq — chaserhq.com", "Upflow — upflow.io"],
  );

  fireEvent.change(giveTo, { target: { value: "chaserhq.com" } });

  assert.deepEqual(saved.current.evidence, []);
  assert.equal(saved.current.painPoints, "");
  assert.deepEqual(saved.current.perTool["chaserhq.com"].evidence.map((r) => r.problem), ["Invoices go out late."]);
  assert.equal(screen.queryByText("Rows saved for all partners"), null);
  assert.match(section(/Chaserhq/).textContent ?? "", /1 row · no hook · 2 searches$/);
});

test("what is saved under a host that is no longer a partner is shown, says so, and can be given to a partner", async (t) => {
  t.after(cleanup);
  // Upflow's address was changed to getupflow.com in the Profile; the brief still files it under upflow.io.
  installProject(["https://www.chaserhq.com", "https://getupflow.com"]);
  const { saved } = open(framing());
  await partnersLoaded();

  const stranded = section(/upflow\.io — not a partner of this project/);
  assert.match(stranded.textContent ?? "", /2 rows · hook · used by no page$/);
  assert.match(section(/Getupflow/).textContent ?? "", /no rows · no hook · 1 search$/);

  fireEvent.click(stranded);
  // All of it is there to read, not only the rows.
  assert.equal((screen.getByPlaceholderText(PAIN_POINT) as HTMLTextAreaElement).value, "Collections run on memory.");
  assert.equal((screen.getByPlaceholderText(HOOK) as HTMLTextAreaElement).value, "Get paid without chasing.");
  assert.deepEqual(failuresShown(), ["Reminders are sent by hand.", "Disputes stall payment."]);

  const give = screen.getByRole("button", { name: "Give" }) as HTMLButtonElement;
  assert.equal(give.disabled, true);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "getupflow.com" } });
  fireEvent.click(give);

  assert.equal(saved.current.perTool["upflow.io"], undefined);
  assert.deepEqual(saved.current.perTool["getupflow.com"], framing().perTool["upflow.io"]);
  assert.equal(screen.queryByRole("button", { name: /not a partner of this project/ }), null);
  assert.match(section(/Getupflow/).textContent ?? "", /2 rows · hook · 3 searches$/);
});

test("no host is called not a partner before the project's partners are known", async (t) => {
  t.after(cleanup);
  let answer: (response: Response) => void = () => {};
  globalThis.fetch = () => new Promise<Response>((resolve) => { answer = resolve; });
  open(framing());

  assert.equal(screen.queryByRole("button", { name: /not a partner of this project/ }), null);
  assert.equal(screen.queryByText(/declares no partner URLs/), null);

  answer(new Response(JSON.stringify({ id: PROJECT_ID, partnerUrls: ["https://upflow.io"] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: /Upflow/ })));
  assert.equal(screen.queryByRole("button", { name: /not a partner of this project/ }), null);
});

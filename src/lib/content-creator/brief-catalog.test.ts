import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALL_PARTNERS,
  contentBriefMissingFields,
  derivePainPoints,
  emptyEvidenceRow,
  emptyNicheFraming,
  emptyNicheFramingSet,
  evidenceRowHasAny,
  giveToolEntriesTo,
  hostsWithNoPartner,
  migrateBrief,
  moveEvidenceRow,
  nicheFramingSetHasAny,
  partnerQuestions,
  withEvidenceRows,
  taxonomyFirstLevel,
  taxonomyPathNamesNoDepartment,
} from "./brief-catalog";

describe("the taxonomy path's first level is the department, checked as GeekAPI checks it", () => {
  it("a department is accepted whatever its case, spacing or the separator after it", () => {
    for (const path of [
      "Accounting->Cash Flow Forecasting->Automated Accounts Receivable",
      "Accounting-> Accounts Payable-> Automated Payment Execution",
      "accounting",
      "Customer Service > Returns",
      "Human Resource \u203a Onboarding",
      "Accounting \u2192 Cash Flow Forecasting \u2192 Accounts Receivable",
      "  SALES  ->  Pipeline",
    ]) {
      assert.equal(taxonomyPathNamesNoDepartment(path), false, path);
    }
  });

  it("a first level that is not one of the five is named", () => {
    assert.equal(taxonomyPathNamesNoDepartment("Finance Ops -> Receivables"), true);
    assert.equal(taxonomyFirstLevel("Finance Ops -> Receivables"), "Finance Ops");
    assert.equal(taxonomyPathNamesNoDepartment("Human Resources -> Onboarding"), true);
    // A separator nothing splits on leaves one level, and that level is not a department.
    assert.equal(taxonomyPathNamesNoDepartment("Accounting / Accounts Payable"), true);
  });

  it("an empty path is not refused: the page is filed as it was", () => {
    assert.equal(taxonomyPathNamesNoDepartment(""), false);
    assert.equal(taxonomyPathNamesNoDepartment("   "), false);
    assert.equal(taxonomyPathNamesNoDepartment(" -> "), false);
  });

  it("Generate is off for a brief whose path names no department, and says which five it may be", () => {
    const complete = {
      primaryIntent: "commercial_investigation",
      buyingStage: "consideration",
      audienceSegment: "in_market",
      audienceNotes: "Finance leads at 20 to 200 person firms.",
      angle: "problem_solution",
      toneOfVoice: "consultant_professional",
    };

    const filed = migrateBrief({ ...complete, nicheFraming: { taxonomyPath: "Accounting -> Accounts Payable" } });
    assert.deepEqual(contentBriefMissingFields(filed), []);

    const unfiled = migrateBrief({ ...complete, nicheFraming: { taxonomyPath: "Finance -> Accounts Payable" } });
    assert.deepEqual(contentBriefMissingFields(unfiled), [
      "a department as the taxonomy path's first level (Accounting, Customer Service, Human Resource, Marketing, Sales)",
    ]);

    const none = migrateBrief({ ...complete });
    assert.deepEqual(contentBriefMissingFields(none), []);
  });
});

describe("partnerQuestions — what each partner's crawl is searched with, in GeekAPI's order", () => {
  const category = {
    ...emptyNicheFramingSet(),
    coreProblem: "The uncontrolled handoff between an approved invoice and the moment cash leaves.",
    evidence: [
      { problem: "Approval is informal.", solution: "Approval workflows route each bill.", terms: ["approval workflow"] },
      { problem: "Payments are executed ad hoc.", solution: "", terms: [] },
    ],
  };

  it("a tool with nothing of its own gets the category's core problem, then one search per row", () => {
    const q = partnerQuestions(category, undefined);
    assert.deepEqual(
      q.map((x) => [x.kind, x.source, x.need, x.keyword]),
      [
        ["core", "category", category.coreProblem, ""],
        ["row", "category", "Approval workflows route each bill.", "approval workflow"],
        ["row", "category", "Payments are executed ad hoc.", ""],
      ],
      "a row with no solution searches on its problem; no terms means the need text is searched",
    );
  });

  it("a tool's pain point is searched beside the category's problem, both; a row restating a problem replaces that row in place; other rows are added", () => {
    const tool = {
      ...emptyNicheFramingSet(),
      coreProblem: "Global payments across entities.",
      evidence: [
        { problem: "approval is informal.", solution: "Entity-specific approval routing.", terms: ["multi-entity"] },
        { problem: "Cannot reconcile global payments.", solution: "Automated payment reconciliation.", terms: ["payment reconciliation", "sub-ledger"] },
      ],
    };
    const q = partnerQuestions(category, tool);
    assert.deepEqual(
      q.map((x) => [x.kind, x.source, x.need, x.keyword]),
      [
        ["core", "tool", "Global payments across entities.", ""],
        // Not an OR: the category's problem is searched for on this tool's site too (2026-10-12).
        ["core", "category", category.coreProblem, ""],
        ["row", "tool", "Entity-specific approval routing.", "multi-entity"],
        ["row", "category", "Payments are executed ad hoc.", ""],
        ["row", "tool", "Automated payment reconciliation.", "payment reconciliation sub-ledger"],
      ],
    );
  });

  it("one statement typed in both boxes is one search", () => {
    const tool = { ...emptyNicheFramingSet(), coreProblem: `  ${category.coreProblem.toUpperCase()} ` };
    const cores = partnerQuestions(category, tool).filter((q) => q.kind === "core");
    assert.deepEqual(cores.map((q) => q.source), ["tool"]);
  });

  it("a tool with a pain point and no category problem is searched with its own", () => {
    const tool = { ...emptyNicheFramingSet(), coreProblem: "Global payments across entities." };
    assert.deepEqual(
      partnerQuestions(emptyNicheFramingSet(), tool).map((q) => [q.kind, q.source, q.need]),
      [["core", "tool", "Global payments across entities."]],
    );
  });

  it("nothing in either set means no searches from the framing", () => {
    assert.deepEqual(partnerQuestions(emptyNicheFramingSet(), undefined), []);
  });
});

describe("rows are the one place a failure is entered", () => {
  it("a brief saved with pain-point paragraphs and no rows loads them as rows", () => {
    const brief = migrateBrief({
      nicheFraming: { painPoints: "Invoices sit in inboxes.\n\nApproval is informal.\n\nThe owner is the bottleneck." },
    });
    assert.deepEqual(
      brief.nicheFraming.evidence.map((r) => r.problem),
      ["Invoices sit in inboxes.", "Approval is informal.", "The owner is the bottleneck."],
    );
    assert.equal(brief.nicheFraming.evidence[0]?.solution, "");
  });

  it("the writer's pain points are derived from the rows' problems, one paragraph each", () => {
    assert.equal(
      derivePainPoints([
        { problem: "Approval is informal.", solution: "x", terms: [] },
        { problem: "  ", solution: "y", terms: [] },
        { problem: "Payments are executed ad hoc.", solution: "", terms: ["runs"] },
      ]),
      "Approval is informal.\n\nPayments are executed ad hoc.",
    );
  });
});

describe("a row belongs to one partner or to all of them, and a tool's entries are filed under its host", () => {
  const row = (problem: string, solution = "") => ({ problem, solution, terms: [] as string[] });
  const framing = () => ({
    ...emptyNicheFraming(),
    coreProblem: "Cash arrives whenever the customer gets round to paying.",
    evidence: [row("Invoices go out late.", "Scheduled invoicing.")],
    painPoints: "Invoices go out late.",
    perTool: {
      "upflow.io": {
        ...emptyNicheFramingSet(),
        coreProblem: "Collections run on memory.",
        automationToPitch: "A collections workflow.",
        faqQuestions: "Does it sync with QuickBooks?",
        evidence: [row("Reminders are sent by hand.", "Automated reminder sequences.")],
        painPoints: "Reminders are sent by hand.",
      },
      "gone.example": { ...emptyNicheFramingSet(), evidence: [row("A row under a removed partner.")] },
    },
  });
  const partners = ["chaserhq.com", "upflow.io"];

  it("a host that is not a partner is listed when the brief holds anything under it, rows or not", () => {
    assert.deepEqual(hostsWithNoPartner(framing(), partners), ["gone.example"]);

    // Its pain point alone is something saved: it was hidden while only a host's rows were listed.
    const f = {
      ...framing(),
      perTool: {
        "old.example": { ...emptyNicheFramingSet(), coreProblem: "x" },
        "blank.example": emptyNicheFramingSet(),
      },
    };
    assert.deepEqual(hostsWithNoPartner(f, partners), ["old.example"]);
    assert.deepEqual(hostsWithNoPartner(framing(), [...partners, "gone.example"]), []);
  });

  it("giving a row to a partner moves it into that partner's own rows, after its last, and nowhere else", () => {
    const before = framing();
    const moved = before.evidence[0];
    const after = moveEvidenceRow(before, { owner: ALL_PARTNERS, index: 0 }, "upflow.io");

    assert.deepEqual(after.evidence, []);
    assert.equal(after.painPoints, "");
    assert.deepEqual(
      after.perTool["upflow.io"].evidence.map((r) => r.problem),
      ["Reminders are sent by hand.", "Invoices go out late."],
    );
    assert.equal(after.perTool["upflow.io"].painPoints, "Reminders are sent by hand.\n\nInvoices go out late.");
    // The same row, not a copy: the form keeps a row's place in the table by the object.
    assert.equal(after.perTool["upflow.io"].evidence[1], moved);
    // What the partner's section holds besides rows is untouched.
    assert.equal(after.perTool["upflow.io"].coreProblem, "Collections run on memory.");
    assert.equal(after.perTool["upflow.io"].automationToPitch, "A collections workflow.");
    assert.equal(after.perTool["upflow.io"].faqQuestions, "Does it sync with QuickBooks?");
    assert.equal(after.coreProblem, before.coreProblem);
    assert.deepEqual(after.perTool["gone.example"], before.perTool["gone.example"]);
  });

  it("giving a row to a partner with no entry yet makes one, and back to all partners empties it", () => {
    const toChaser = moveEvidenceRow(framing(), { owner: ALL_PARTNERS, index: 0 }, "chaserhq.com");
    assert.deepEqual(toChaser.perTool["chaserhq.com"].evidence.map((r) => r.problem), ["Invoices go out late."]);
    assert.equal(toChaser.perTool["chaserhq.com"].painPoints, "Invoices go out late.");

    const back = moveEvidenceRow(toChaser, { owner: "chaserhq.com", index: 0 }, ALL_PARTNERS);
    assert.deepEqual(back.evidence.map((r) => r.problem), ["Invoices go out late."]);
    assert.equal(back.painPoints, "Invoices go out late.");
    assert.deepEqual(back.perTool["chaserhq.com"].evidence, []);
    assert.equal(nicheFramingSetHasAny(back.perTool["chaserhq.com"]), false);
  });

  it("a row left with its owner, or a place that holds no row, changes nothing", () => {
    const f = framing();
    assert.equal(moveEvidenceRow(f, { owner: ALL_PARTNERS, index: 0 }, ALL_PARTNERS), f);
    assert.equal(moveEvidenceRow(f, { owner: "upflow.io", index: 7 }, ALL_PARTNERS), f);
  });

  it("replacing one owner's rows derives that owner's pain points and no other's", () => {
    const f = withEvidenceRows(framing(), "upflow.io", [row("Disputes stall payment."), row("  ")]);
    assert.equal(f.perTool["upflow.io"].painPoints, "Disputes stall payment.");
    assert.equal(f.painPoints, "Invoices go out late.");

    const g = withEvidenceRows(framing(), ALL_PARTNERS, [row("Nobody owns the ledger.")]);
    assert.equal(g.painPoints, "Nobody owns the ledger.");
    assert.equal(g.perTool["upflow.io"].painPoints, "Reminders are sent by hand.");
  });

  it("a partner's row is searched on that partner's site and on no other's", () => {
    const f = moveEvidenceRow(framing(), { owner: ALL_PARTNERS, index: 0 }, "upflow.io");
    const needs = (host: string) => partnerQuestions(f, f.perTool[host]).map((q) => q.need);

    assert.deepEqual(needs("upflow.io"), [
      "Collections run on memory.",
      "Cash arrives whenever the customer gets round to paying.",
      "Automated reminder sequences.",
      "Scheduled invoicing.",
    ]);
    // Chaserhq is searched with the core problem alone: the row is no longer every partner's.
    assert.deepEqual(needs("chaserhq.com"), ["Cash arrives whenever the customer gets round to paying."]);
  });

  it("a host's entries given to a partner with none of its own move whole, and the host is dropped", () => {
    const before = framing();
    const after = giveToolEntriesTo(before, "upflow.io", "chaserhq.com");

    assert.equal(after.perTool["upflow.io"], undefined);
    assert.deepEqual(after.perTool["chaserhq.com"], before.perTool["upflow.io"]);
    // The same rows, not copies, and nothing else in the brief is touched.
    assert.equal(after.perTool["chaserhq.com"].evidence[0], before.perTool["upflow.io"].evidence[0]);
    assert.deepEqual(after.evidence, before.evidence);
    assert.deepEqual(after.perTool["gone.example"], before.perTool["gone.example"]);
  });

  it("a partner keeps the pain point and the hook it has; rows and questions are added after its own", () => {
    const before = {
      ...framing(),
      perTool: {
        ...framing().perTool,
        "chaserhq.com": {
          ...emptyNicheFramingSet(),
          coreProblem: "Nobody owns the chase.",
          faqQuestions: "Does it sync with QuickBooks?\nIs there a free plan?",
          evidence: [row("Nobody chases.", "Automated chasing.")],
          painPoints: "Nobody chases.",
        },
      },
    };
    const after = giveToolEntriesTo(before, "upflow.io", "chaserhq.com");
    const given = after.perTool["chaserhq.com"];

    assert.equal(given.coreProblem, "Nobody owns the chase.");
    // It had no hook, so it takes the one given.
    assert.equal(given.automationToPitch, "A collections workflow.");
    assert.deepEqual(given.evidence.map((r) => r.problem), ["Nobody chases.", "Reminders are sent by hand."]);
    assert.equal(given.painPoints, "Nobody chases.\n\nReminders are sent by hand.");
    // A question it already asks is not asked twice.
    assert.equal(given.faqQuestions, "Does it sync with QuickBooks?\nIs there a free plan?");
    // The pain point it did not take stays where it was, still shown, and nothing else does.
    assert.deepEqual(after.perTool["upflow.io"], { ...emptyNicheFramingSet(), coreProblem: "Collections run on memory." });
    assert.deepEqual(hostsWithNoPartner(after, ["chaserhq.com"]), ["upflow.io", "gone.example"]);
  });

  it("giving a host's entries to itself, to all partners or from a host that holds none changes nothing", () => {
    const f = framing();
    assert.equal(giveToolEntriesTo(f, "upflow.io", "upflow.io"), f);
    assert.equal(giveToolEntriesTo(f, "upflow.io", ALL_PARTNERS), f);
    assert.equal(giveToolEntriesTo(f, "nobody.example", "chaserhq.com"), f);
  });

  it("nothing new is saved: a brief with a moved row reads back as the same rows", () => {
    const f = moveEvidenceRow(framing(), { owner: ALL_PARTNERS, index: 0 }, "upflow.io");
    const read = migrateBrief(JSON.parse(JSON.stringify({ nicheFraming: f }))).nicheFraming;
    assert.deepEqual(read.evidence, []);
    assert.deepEqual(read.perTool["upflow.io"].evidence, f.perTool["upflow.io"].evidence);
    assert.deepEqual(Object.keys(read.perTool["upflow.io"]).sort(), Object.keys(emptyNicheFramingSet()).sort());
  });
});

/**
 * The brief's evidence rows (Geek-Crawler-Rag `plans/retrieval-from-the-brief.md`, 2026-10-08):
 * one retrieval question per failure. Read back explicitly on load, like every other field, because
 * `migrateBrief` rebuilds from the empty brief and a field not read here is saved once and wiped on
 * the next load.
 */
describe("brief evidence rows", () => {
  it("reads rows back for the category and per tool, dropping blank rows", () => {
    const brief = migrateBrief({
      nicheFraming: {
        coreProblem: "A problem.",
        evidence: [
          { problem: "Approval is informal.", solution: "Approval workflows route bills.", terms: ["approval workflow"] },
          { problem: "", solution: "", terms: [] },
        ],
        perTool: {
          "tipalti.com": {
            evidence: [
              {
                problem: "Cannot reconcile global payments.",
                solution: "Automated payment reconciliation syncs with the ERP.",
                terms: "payment reconciliation, multi-entity",
              },
            ],
          },
        },
      },
    });

    assert.equal(brief.nicheFraming.evidence.length, 1);
    assert.deepEqual(brief.nicheFraming.evidence[0], {
      problem: "Approval is informal.",
      solution: "Approval workflows route bills.",
      terms: ["approval workflow"],
    });
    const tipalti = brief.nicheFraming.perTool["tipalti.com"];
    assert.ok(tipalti);
    assert.deepEqual(tipalti.evidence[0]?.terms, ["payment reconciliation", "multi-entity"], "a comma string is terms too");
  });

  it("a brief saved before rows existed loads with none", () => {
    const brief = migrateBrief({ nicheFraming: { coreProblem: "A problem." } });
    assert.deepEqual(brief.nicheFraming.evidence, []);
  });

  it("rows alone make a set framing, and a blank row does not", () => {
    assert.equal(evidenceRowHasAny(emptyEvidenceRow()), false);
    assert.equal(nicheFramingSetHasAny(emptyNicheFramingSet()), false);
    assert.equal(
      nicheFramingSetHasAny({
        ...emptyNicheFramingSet(),
        evidence: [{ problem: "", solution: "", terms: ["W-9"] }],
      }),
      true,
    );
  });
});

describe("FAQ fields (2026-10-08): the blog's questions on the brief, a tool's questions in its own entry", () => {
  it("reads blogFaqQuestions as lines or an array, and a tool's faqQuestions the same way", () => {
    const brief = migrateBrief({
      blogFaqQuestions: ["How long does a rollout take?", "What does it cost to run?"],
      nicheFraming: {
        perTool: {
          "tipalti.com": { faqQuestions: "Does it sync with QuickBooks Online?\n\nCan a bookkeeper schedule a payment?" },
        },
      },
    });
    assert.equal(brief.blogFaqQuestions, "How long does a rollout take?\nWhat does it cost to run?");
    assert.equal(
      brief.nicheFraming.perTool["tipalti.com"]?.faqQuestions,
      "Does it sync with QuickBooks Online?\n\nCan a bookkeeper schedule a payment?",
    );
    assert.equal(brief.nicheFraming.faqQuestions, "", "the category carries no tool FAQ");
  });

  it("a tool's FAQ questions alone make its entry an override, and the searches are unchanged by them", () => {
    const tool = { ...emptyNicheFramingSet(), faqQuestions: "Does it fly?" };
    assert.equal(nicheFramingSetHasAny(tool), true);
    assert.deepEqual(partnerQuestions(emptyNicheFramingSet(), tool), []);
  });

  it("a brief saved before the fields existed loads with them empty", () => {
    const brief = migrateBrief({ paaQuestions: "What is AI implementation?" });
    assert.equal(brief.blogFaqQuestions, "");
    assert.equal(brief.nicheFraming.faqQuestions, "");
  });
});

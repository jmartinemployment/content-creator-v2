import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALL_PARTNERS,
  briefAsSaved,
  briefFingerprint,
  contentBriefMissingFields,
  derivePainPoints,
  emptyContentBrief,
  emptyEvidenceRow,
  emptyFaqRow,
  emptyNicheFraming,
  emptyNicheFramingSet,
  evidenceRowHasAny,
  faqRowHasNoAnswer,
  faqRowsFromStored,
  faqRowsToSaved,
  faqRowsWithNoAnswer,
  faqRowsWithQuestion,
  giveToolEntriesTo,
  hostsWithNoPartner,
  migrateBrief,
  moveEvidenceRow,
  nicheFramingSetHasAny,
  parseBriefJson,
  partnerQuestions,
  withEvidenceRows,
  taxonomyFirstLevel,
  taxonomyPathNamesNoDepartment,
  type FaqRow,
} from "./brief-catalog";
import { briefToJson } from "@/services/gcc-api";

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
  const faq = (question: string, answer = ""): FaqRow => ({ question, answer });
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
        faqQuestions: [faq("Does it sync with QuickBooks?", "Yes, both ways.")],
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
    assert.deepEqual(after.perTool["upflow.io"].faqQuestions, [faq("Does it sync with QuickBooks?", "Yes, both ways.")]);
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
          faqQuestions: [faq("Does it sync with QuickBooks?", "Yes, both ways."), faq("Is there a free plan?", "No.")],
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
    // A question it already asks, with the same answer, is not asked twice.
    assert.deepEqual(given.faqQuestions, [
      faq("Does it sync with QuickBooks?", "Yes, both ways."),
      faq("Is there a free plan?", "No."),
    ]);
    // The pain point it did not take stays where it was, still shown, and nothing else does.
    assert.deepEqual(after.perTool["upflow.io"], { ...emptyNicheFramingSet(), coreProblem: "Collections run on memory." });
    assert.deepEqual(hostsWithNoPartner(after, ["chaserhq.com"]), ["upflow.io", "gone.example"]);
  });

  it("a host's FAQ rows are given with their answers, after the partner's own", () => {
    const before = {
      ...framing(),
      perTool: {
        "old.example": {
          ...emptyNicheFramingSet(),
          faqQuestions: [
            faq("  Does it send reminders?  ", "Yes, on a schedule you set."),
            faq("Is there a free plan?", "This answer is the host's."),
            faq("Does it take card payments?"),
            // Typed with no question yet: given as it is, so nothing typed is lost.
            faq("", "An answer waiting for its question."),
            emptyFaqRow(),
          ],
        },
        "chaserhq.com": {
          ...emptyNicheFramingSet(),
          faqQuestions: [faq("Is there a free plan?", "No."), faq("Does it send reminders?", "Yes, on a schedule you set.")],
        },
      },
    };
    const after = giveToolEntriesTo(before, "old.example", "chaserhq.com");

    assert.deepEqual(after.perTool["chaserhq.com"].faqQuestions, [
      // The partner's own rows first, each with the answer it had.
      faq("Is there a free plan?", "No."),
      faq("Does it send reminders?", "Yes, on a schedule you set."),
      // Then the questions it did not ask, a question with no answer among them.
      faq("Does it take card payments?"),
      faq("", "An answer waiting for its question."),
    ]);
    // A question both ask with two different answers: the partner's stays, and the host's row stays
    // under the host, still shown, for the operator to choose between.
    assert.deepEqual(after.perTool["old.example"].faqQuestions, [faq("Is there a free plan?", "This answer is the host's.")]);
    assert.deepEqual(hostsWithNoPartner(after, ["chaserhq.com"]), ["old.example"]);
  });

  it("a partner that asks a question and has no answer takes the answer given with it", () => {
    const before = {
      ...framing(),
      perTool: {
        "old.example": { ...emptyNicheFramingSet(), faqQuestions: [faq("Is there a free plan?", "No, there is a trial.")] },
        "chaserhq.com": { ...emptyNicheFramingSet(), faqQuestions: [faq("Is there a free plan?"), faq("Does it sync?", "Yes.")] },
      },
    };
    const after = giveToolEntriesTo(before, "old.example", "chaserhq.com");

    assert.deepEqual(after.perTool["chaserhq.com"].faqQuestions, [
      faq("Is there a free plan?", "No, there is a trial."),
      faq("Does it sync?", "Yes."),
    ]);
    assert.equal(after.perTool["old.example"], undefined);
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

/**
 * The three FAQ boxes (2026-10-13): the pillar's People Also Ask, the blog's FAQ and each tool
 * page's FAQ are rows of a question and the operator's own answer. A brief saved before then holds
 * questions alone, one per line or as an array, and must load as rows with no answer; what a Save
 * writes is always the array of rows GeekAPI reads.
 */
describe("a FAQ box is rows of a question and its answer, whatever shape the brief was saved in", () => {
  const LINES = "Does it sync with QuickBooks Online?\n\n  Can a bookkeeper schedule a payment?  \r\n";
  const QUESTIONS = ["Does it sync with QuickBooks Online?", "  Can a bookkeeper schedule a payment?  ", "", 7];
  const ROWS = [
    { question: "Does it sync with QuickBooks Online?", answer: "  Yes, within the hour.  " },
    { question: "  Can a bookkeeper schedule a payment?  " },
    // Neither a question nor an answer: dropped. A value that is not text counts as empty.
    { question: "", answer: "   " },
    { question: 7, answer: null },
    // An answer with no question yet is kept, so nothing typed is lost.
    { question: 12, answer: "An answer waiting for its question." },
    null,
  ];
  const UNANSWERED: FaqRow[] = [
    { question: "Does it sync with QuickBooks Online?", answer: "" },
    { question: "Can a bookkeeper schedule a payment?", answer: "" },
  ];
  const ANSWERED: FaqRow[] = [
    { question: "Does it sync with QuickBooks Online?", answer: "Yes, within the hour." },
    { question: "Can a bookkeeper schedule a payment?", answer: "" },
    { question: "", answer: "An answer waiting for its question." },
  ];

  /** One stored value, saved in each of the three boxes at once. */
  function loaded(stored: unknown) {
    const brief = migrateBrief({
      paaQuestions: stored,
      blogFaqQuestions: stored,
      nicheFraming: { perTool: { "Tipalti.com": { faqQuestions: stored } } },
    });
    return {
      "People Also Ask": brief.paaQuestions,
      "Blog FAQ": brief.blogFaqQuestions,
      "Tool page FAQ": brief.nicheFraming.perTool["tipalti.com"]?.faqQuestions,
    };
  }

  it("questions typed one per line load as rows with no answer, in each of the three boxes", () => {
    assert.deepEqual(loaded(LINES), {
      "People Also Ask": UNANSWERED,
      "Blog FAQ": UNANSWERED,
      "Tool page FAQ": UNANSWERED,
    });
  });

  it("an array of questions loads as rows with no answer, in each of the three boxes", () => {
    assert.deepEqual(loaded(QUESTIONS), {
      "People Also Ask": UNANSWERED,
      "Blog FAQ": UNANSWERED,
      "Tool page FAQ": UNANSWERED,
    });
  });

  it("an array of rows loads with its answers, in each of the three boxes", () => {
    assert.deepEqual(loaded(ROWS), {
      "People Also Ask": ANSWERED,
      "Blog FAQ": ANSWERED,
      "Tool page FAQ": ANSWERED,
    });
  });

  it("a box that was never saved, or holds something that is no list, loads with no rows", () => {
    for (const stored of [undefined, null, "", "  \n ", [], 7, { question: "Not a list?" }]) {
      assert.deepEqual(faqRowsFromStored(stored), [], JSON.stringify(stored));
    }
    const brief = migrateBrief({ audienceNotes: "A brief saved before any of the boxes existed." });
    assert.deepEqual(brief.paaQuestions, []);
    assert.deepEqual(brief.blogFaqQuestions, []);
    assert.deepEqual(brief.nicheFraming.faqQuestions, [], "the category carries no tool FAQ");
  });

  it("a Save writes each box as an array of a question and its answer, trimmed, a row with neither left out", () => {
    const typed: FaqRow[] = [
      { question: "  Does it sync with QuickBooks Online?  ", answer: "  Yes, within the hour.\n" },
      { question: "Can a bookkeeper schedule a payment?", answer: "   " },
      { question: "   ", answer: "An answer waiting for its question." },
      emptyFaqRow(),
      { question: "  ", answer: "\n" },
    ];
    const brief = {
      ...emptyContentBrief(),
      paaQuestions: typed,
      blogFaqQuestions: typed,
      nicheFraming: {
        ...emptyNicheFraming(),
        perTool: { "tipalti.com": { ...emptyNicheFramingSet(), coreProblem: "Global payments.", faqQuestions: typed } },
      },
    };

    const saved = JSON.parse(briefToJson(brief)) as {
      paaQuestions: unknown;
      blogFaqQuestions: unknown;
      nicheFraming: { perTool: Record<string, { coreProblem: unknown; faqQuestions: unknown }> };
    };

    assert.deepEqual(saved.paaQuestions, ANSWERED);
    assert.deepEqual(saved.blogFaqQuestions, ANSWERED);
    assert.deepEqual(saved.nicheFraming.perTool["tipalti.com"].faqQuestions, ANSWERED);
    // Nothing else of the brief is changed by a Save, and the form's own copy is left as typed.
    assert.equal(saved.nicheFraming.perTool["tipalti.com"].coreProblem, "Global payments.");
    assert.equal(brief.paaQuestions, typed);
    assert.deepEqual(briefAsSaved(brief).paaQuestions, faqRowsToSaved(typed));
  });

  it("what was saved reads back as the same rows", () => {
    const brief = {
      ...emptyContentBrief(),
      paaQuestions: ANSWERED,
      blogFaqQuestions: UNANSWERED,
      nicheFraming: {
        ...emptyNicheFraming(),
        perTool: { "tipalti.com": { ...emptyNicheFramingSet(), faqQuestions: ANSWERED } },
      },
    };
    const read = parseBriefJson(briefToJson(brief));
    assert.ok(read);
    assert.deepEqual(read.paaQuestions, ANSWERED);
    assert.deepEqual(read.blogFaqQuestions, UNANSWERED);
    assert.deepEqual(read.nicheFraming.perTool["tipalti.com"].faqQuestions, ANSWERED);
  });

  it("a brief saved with lines and the same brief as rows with no answer say the same thing", () => {
    // Opening a brief saved before 2026-10-13 is not an unsaved change, and neither is a row that
    // was added and not typed in.
    const old = migrateBrief({ paaQuestions: "What is AI implementation?", blogFaqQuestions: ["What does it cost?"] });
    const opened = {
      ...old,
      paaQuestions: [...old.paaQuestions, emptyFaqRow()],
      blogFaqQuestions: [{ question: "What does it cost? ", answer: "" }],
    };
    assert.equal(briefFingerprint(opened, "ai implementation"), briefFingerprint(old, "ai implementation"));

    const answered = { ...old, paaQuestions: [{ question: "What is AI implementation?", answer: "Putting a model to work." }] };
    assert.notEqual(briefFingerprint(answered, "ai implementation"), briefFingerprint(old, "ai implementation"));
  });

  it("a row with a question counts as asked, and one with a question and no answer as unanswered", () => {
    const rows: FaqRow[] = [
      { question: "Does it sync?", answer: "Yes." },
      { question: "Is there a free plan?", answer: "  " },
      { question: " ", answer: "An answer waiting for its question." },
      emptyFaqRow(),
    ];
    assert.deepEqual(faqRowsWithQuestion(rows).map((r) => r.question), ["Does it sync?", "Is there a free plan?"]);
    assert.deepEqual(faqRowsWithNoAnswer(rows).map((r) => r.question), ["Is there a free plan?"]);
    assert.deepEqual(rows.map(faqRowHasNoAnswer), [false, true, false, false]);
  });

  it("a tool's FAQ rows alone make its entry something saved, a blank row does not, and the searches are unchanged by them", () => {
    const tool = { ...emptyNicheFramingSet(), faqQuestions: [{ question: "Does it fly?", answer: "" }] };
    assert.equal(nicheFramingSetHasAny(tool), true);
    assert.equal(nicheFramingSetHasAny({ ...emptyNicheFramingSet(), faqQuestions: [{ question: "", answer: "It does." }] }), true);
    assert.equal(nicheFramingSetHasAny({ ...emptyNicheFramingSet(), faqQuestions: [emptyFaqRow()] }), false);
    // Nothing is searched for a FAQ question: the answer is the operator's.
    assert.deepEqual(partnerQuestions(emptyNicheFramingSet(), tool), []);
  });
});

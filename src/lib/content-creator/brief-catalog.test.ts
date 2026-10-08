import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  derivePainPoints,
  emptyEvidenceRow,
  emptyNicheFramingSet,
  evidenceRowHasAny,
  migrateBrief,
  nicheFramingSetHasAny,
  parseEvidenceRows,
  partnerQuestions,
} from "./brief-catalog";

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

  it("a tool's core problem replaces the category's; a row restating a problem replaces that row in place; other rows are added", () => {
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
        ["row", "tool", "Entity-specific approval routing.", "multi-entity"],
        ["row", "category", "Payments are executed ad hoc.", ""],
        ["row", "tool", "Automated payment reconciliation.", "payment reconciliation sub-ledger"],
      ],
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

describe("parseEvidenceRows — pasted research becomes rows for review", () => {
  it("reads a tab- or pipe-separated table, dropping the header, with a trailing comma list as terms", () => {
    const rows = parseEvidenceRows(
      "Your problem\tTipalti solution\tTerms\n" +
        "International vendors are paid manually through bank wires.\tGlobal payments through Mass Payments: 200+ countries, 120 currencies.\tglobal payments, mass payments\n" +
        "Finance staff chase vendors for onboarding information. | Self-service supplier portal and embedded payee onboarding.\n",
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.problem, "International vendors are paid manually through bank wires.");
    assert.equal(rows[0]?.solution, "Global payments through Mass Payments: 200+ countries, 120 currencies.");
    assert.deepEqual(rows[0]?.terms, ["global payments", "mass payments"]);
    assert.equal(rows[1]?.problem, "Finance staff chase vendors for onboarding information.");
    assert.deepEqual(rows[1]?.terms, []);
  });

  it("reads a research answer's multi-space columns and joins the middle cells into the solution", () => {
    const rows = parseEvidenceRows(
      "Tax forms are stored inconsistently.    Supplier onboarding and tax compliance    Collects W-9 and W-8 forms through self-service onboarding.    W-9 W-8, supplier onboarding, tax compliance",
    );
    const [row] = rows;
    assert.equal(row?.problem, "Tax forms are stored inconsistently.");
    assert.equal(row?.solution, "Supplier onboarding and tax compliance Collects W-9 and W-8 forms through self-service onboarding.");
    assert.deepEqual(row?.terms, ["W-9 W-8", "supplier onboarding", "tax compliance"]);
  });

  it("reads blank-line blocks: problem, solution, optional terms", () => {
    const rows = parseEvidenceRows(
      "Cannot reconcile global payments.\nAutomated payment reconciliation syncs with the ERP.\npayment reconciliation, multi-entity\n\n" +
        "Outgrows SMB bill pay.\nPrebuilt integrations extend the existing accounting system.",
    );
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0]?.terms, ["payment reconciliation", "multi-entity"]);
    assert.equal(rows[1]?.solution, "Prebuilt integrations extend the existing accounting system.");
    assert.deepEqual(rows[1]?.terms, []);
  });

  it("ignores text that fits neither shape rather than guessing", () => {
    assert.deepEqual(parseEvidenceRows("just one line of prose"), []);
    assert.deepEqual(parseEvidenceRows(""), []);
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
    assert.equal(
      nicheFramingSetHasAny({ coreProblem: "", painPoints: "", automationToPitch: "", evidence: [] }),
      false,
    );
    assert.equal(
      nicheFramingSetHasAny({
        coreProblem: "",
        painPoints: "",
        automationToPitch: "",
        evidence: [{ problem: "", solution: "", terms: ["W-9"] }],
      }),
      true,
    );
  });
});

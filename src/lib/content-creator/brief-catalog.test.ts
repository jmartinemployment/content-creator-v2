import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyEvidenceRow,
  evidenceRowHasAny,
  migrateBrief,
  nicheFramingSetHasAny,
} from "./brief-catalog";

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

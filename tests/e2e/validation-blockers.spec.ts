import { expect, test } from "@playwright/test";
import { listOutstandingBlockers } from "../../src/app/creates/validation-blockers";
import type { ValidationReportView } from "../../src/app/creates/canvas-types";

function baseReport(overrides: Partial<ValidationReportView> = {}): ValidationReportView {
  return {
    shipReady: false,
    reviewVerdict: "rejected",
    seoScore: 80,
    polishScore: 90,
    polishShipReady: true,
    overlapHits: [],
    outstandingIssues: true,
    ...overrides,
  };
}

test("outstanding blockers surface RAG and reviewer issues", () => {
  const blockers = listOutstandingBlockers(baseReport({
    validation: {
      approved: false,
      unsupportedClaimCount: 1,
      issues: [{
        sectionTitle: "Evidence",
        category: "unsupportedClaim",
        detail: "The claim is unsupported.",
        repairInstruction: "Remove or cite the claim.",
      }],
    },
  }));

  expect(blockers).toContain("RAG / reviewer · Evidence: The claim is unsupported.");
});

test("outstanding blockers fall back to review notes when structured issues are absent", () => {
  const blockers = listOutstandingBlockers(baseReport({
    reviewNotes: '[Section: "Evidence"] Cite the claim.',
  }));

  expect(blockers).toContain('[Section: "Evidence"] Cite the claim.');
});

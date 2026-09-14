import assert from "node:assert/strict";
import test from "node:test";
import {
  createPrefillFromArtifactPayload,
  createPrefillSearchParams,
} from "../../src/app/creates/create-prefill";

test("createPrefillFromArtifactPayload maps tools competitors and claims", () => {
  const prefill = createPrefillFromArtifactPayload({
    title: "Invoice approvals",
    operatorTools: [{ name: "ApprovalMax", url: "https://approvalmax.com" }],
    competitorUrls: ["https://rival.example"],
    claims: [{ claim: "ApprovalMax automates invoice workflows." }],
  });
  assert.equal(prefill.topic, "Invoice approvals");
  assert.match(prefill.tools ?? "", /ApprovalMax/);
  assert.equal(prefill.competitors, "https://rival.example");
  assert.match(prefill.notes ?? "", /Claims to ground/);
});

test("createPrefillSearchParams encodes create handoff query", () => {
  const params = createPrefillSearchParams({
    contentType: "comparison",
    topic: "AP tools",
    tools: "ApprovalMax | https://approvalmax.com",
    competitors: "https://rival.example",
  });
  assert.equal(params.get("contentType"), "comparison");
  assert.equal(params.get("topic"), "AP tools");
  assert.match(params.get("tools") ?? "", /ApprovalMax/);
  assert.equal(params.get("competitors"), "https://rival.example");
});

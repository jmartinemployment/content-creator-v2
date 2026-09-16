import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "phase-u",
  "generate.section.v1.json",
);

describe("Phase U shared generate contract fixture", () => {
  it("exposes identical canonical request/response field names", () => {
    const payload = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      schemaVersion: string;
      request: Record<string, unknown>;
      response: Record<string, unknown>;
      requiredRequestFields: string[];
      requiredResponseFields: string[];
    };

    assert.equal(payload.schemaVersion, "phase-u-generate-contract.v1");
    assert.equal(payload.request.generationStage, "section");
    assert.equal(
      (payload.request.canonicalBrief as { version: string }).version,
      "gcc-v2-generation-brief.v1",
    );
    assert.equal(payload.request.modelPolicyVersion, "content-model-policy.v1");
    assert.equal(payload.response.intent, "blog");
    assert.equal(
      (payload.response.provenance as { generationStage: string }).generationStage,
      "section",
    );

    for (const field of payload.requiredRequestFields) {
      assert.ok(field in payload.request, `missing request field ${field}`);
    }
    for (const field of payload.requiredResponseFields) {
      assert.ok(field in payload.response, `missing response field ${field}`);
    }
  });
});

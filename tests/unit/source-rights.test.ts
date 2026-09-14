import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeSourceRights,
  sourceRightsBlocksShip,
  sourceRightsGapLabel,
} from "../../src/app/creates/source-rights";

describe("sourceRights", () => {
  it("treats missing as unknown and blocks ship", () => {
    assert.equal(normalizeSourceRights(undefined), "unknown");
    assert.equal(normalizeSourceRights(null), "unknown");
    assert.equal(normalizeSourceRights(""), "unknown");
    assert.equal(sourceRightsBlocksShip(undefined), true);
    assert.equal(sourceRightsBlocksShip("prohibited"), true);
    assert.equal(sourceRightsBlocksShip("consented"), false);
    assert.equal(sourceRightsBlocksShip("licensed"), false);
  });

  it("formats Appendix B-style gap strings", () => {
    assert.equal(
      sourceRightsGapLabel({
        url: "https://example.com",
        quote: "q",
        sectionKey: "intro",
        sourceRights: "unknown",
      }),
      "sourceRights 'unknown' on citation for section 'intro'",
    );
  });
});

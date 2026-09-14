import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  connectorOAuthUnavailableError,
  stubNotConnectedNotice,
} from "../../src/app/lib/connector-stubs";

describe("connector stub notices", () => {
  it("never uses Connected wording for stubs", () => {
    const notice = stubNotConnectedNotice("GSC", "property sc-domain:example.test");
    assert.match(notice, /Stub \(not connected\)/);
    assert.doesNotMatch(notice, /^Connected /);
  });

  it("fails closed with an explicit OAuth unavailable error", () => {
    assert.match(connectorOAuthUnavailableError("Drive"), /Stub connectors are not allowed/);
  });
});

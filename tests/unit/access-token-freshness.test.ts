import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAccessTokenFresh,
  readAccessTokenExpiryUnix,
} from "../../src/app/auth/tokens";

function jwtWithExp(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${header}.${payload}.sig`;
}

describe("access token freshness", () => {
  it("reads JWT exp", () => {
    const exp = 1_700_000_000;
    assert.equal(readAccessTokenExpiryUnix(jwtWithExp(exp)), exp);
  });

  it("treats near-expiry JWT as stale", () => {
    const now = 1_700_000_000;
    assert.equal(isAccessTokenFresh(jwtWithExp(now + 30), now), false);
    assert.equal(isAccessTokenFresh(jwtWithExp(now + 120), now), true);
  });

  it("treats opaque tokens as fresh when non-empty", () => {
    assert.equal(isAccessTokenFresh("not-a-jwt"), true);
    assert.equal(isAccessTokenFresh(""), false);
  });
});

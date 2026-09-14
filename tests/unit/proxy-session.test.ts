import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const proxyPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/proxy.ts",
);

describe("proxy session policy (source contract)", () => {
  const source = readFileSync(proxyPath, "utf8");

  it("clears cookies only on 400/401/403", () => {
    assert.match(source, /status === 400 \|\| res\.status === 401 \|\| res\.status === 403/);
    assert.match(source, /cookieOpts\.clear/);
  });

  it("preserves refresh on network / 5xx but drops stale access", () => {
    assert.match(source, /5xx \/ other: preserve refresh/);
    assert.match(source, /Drop stale access/);
    assert.match(source, /isAccessTokenFresh/);
  });

  it("refreshes when access is missing or stale", () => {
    assert.match(source, /accessFresh/);
    assert.match(source, /if \(accessFresh\) return NextResponse\.next\(\)/);
  });

  it("retries token fetch at most once", () => {
    assert.match(source, /One bounded retry/);
    assert.match(source, /AbortSignal\.timeout/);
  });

  it("keeps matcher limited to gcc-v2 routes", () => {
    assert.match(source, /"\/creates\/:path\*"/);
    assert.match(source, /"\/api\/gcc-v2\/:path\*"/);
    assert.doesNotMatch(source, /"\/content-creator/);
  });
});

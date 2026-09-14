import assert from "node:assert/strict";
import { describe, it, mock, afterEach } from "node:test";
import {
  loadError,
  loadOk,
  loadUnauthorized,
  readLoadResult,
  type LoadResult,
} from "../../src/app/lib/load-result";

describe("LoadResult helpers", () => {
  it("distinguishes ok empty from error", () => {
    const empty: LoadResult<string[]> = loadOk([]);
    const err = loadError("boom", 500);
    assert.equal(empty.status, "ok");
    if (empty.status === "ok") assert.deepEqual(empty.data, []);
    assert.equal(err.status, "error");
    if (err.status === "error") {
      assert.equal(err.error, "boom");
      assert.equal(err.httpStatus, 500);
    }
  });

  it("maps 401 to unauthorized", async () => {
    const res = new Response(null, { status: 401 });
    const result = await readLoadResult(res, () => []);
    assert.equal(result.status, "unauthorized");
  });

  it("maps non-401 failure to error (not empty ok)", async () => {
    const res = new Response(JSON.stringify({ error: "upstream down" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
    const result = await readLoadResult(res, () => [] as string[]);
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.match(result.error, /upstream down|503/);
      assert.equal(result.httpStatus, 503);
    }
  });

  it("maps 200 body to ok data", async () => {
    const res = new Response(JSON.stringify([{ id: "1" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const result = await readLoadResult(res, (body) => body as { id: string }[]);
    assert.equal(result.status, "ok");
    if (result.status === "ok") assert.equal(result.data[0]?.id, "1");
  });
});

describe("rag-client injected non-401 failures", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.reset();
  });

  it("loadAdTemplates returns error not []", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "templates unavailable" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const { loadAdTemplates } = await import("../../src/app/creates/rag-client/ad-templates");
    const result = await loadAdTemplates();
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.match(result.error, /templates unavailable|502/);
    }
  });

  it("fetchRagStatus returns error not null-shaped ok", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "rag down" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const { fetchRagStatus } = await import("../../src/app/creates/rag-client/rag-generate-client");
    const result = await fetchRagStatus();
    assert.equal(result.status, "error");
    if (result.status === "error") assert.equal(result.httpStatus, 503);
  });

  it("indexRagAdTemplates returns error not null", async () => {
    globalThis.fetch = (async () =>
      new Response("nope", { status: 500 })) as typeof fetch;

    const { indexRagAdTemplates } = await import("../../src/app/creates/rag-client/rag-generate-client");
    const result = await indexRagAdTemplates([]);
    assert.equal(result.status, "error");
    if (result.status === "error") assert.equal(result.httpStatus, 500);
  });

  it("loadUnauthorized helper is distinct", () => {
    assert.equal(loadUnauthorized().status, "unauthorized");
  });
});

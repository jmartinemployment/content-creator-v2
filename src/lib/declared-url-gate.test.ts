import test from "node:test";
import assert from "node:assert/strict";
import { gateDeclaredUrls, describeVerdict, type IndexAnswer } from "./declared-url-gate.ts";

const indexed = { indexed: true };
const notIndexed = { indexed: false };

function answers(rows: Record<string, IndexAnswer>) {
  return rows;
}

test("an empty list blocks nothing", () => {
  assert.deepEqual(gateDeclaredUrls([], answers({})), { ok: true });
});

test("every URL indexed is allowed", () => {
  const verdict = gateDeclaredUrls(
    ["https://a.test", "https://b.test"],
    answers({ "https://a.test": indexed, "https://b.test": indexed }),
  );
  assert.deepEqual(verdict, { ok: true });
});

test("one unindexed URL blocks, and only that URL is named", () => {
  const verdict = gateDeclaredUrls(
    ["https://a.test", "https://b.test"],
    answers({ "https://a.test": indexed, "https://b.test": notIndexed }),
  );
  assert.deepEqual(verdict, { ok: false, reason: "unindexed", urls: ["https://b.test"] });
});

test("a URL nobody has asked about blocks as unchecked, not as unindexed", () => {
  // fd5c920's rule: the check not running is not a verdict about the URL. It still blocks --
  // an answer never obtained is not evidence that a crawl exists.
  const verdict = gateDeclaredUrls(
    ["https://a.test", "https://b.test"],
    answers({ "https://a.test": indexed }),
  );
  assert.deepEqual(verdict, { ok: false, reason: "unchecked", urls: ["https://b.test"] });
});

test("with both present the unindexed URL is reported, because it is the actionable half", () => {
  const verdict = gateDeclaredUrls(
    ["https://a.test", "https://b.test", "https://c.test"],
    answers({ "https://a.test": indexed, "https://b.test": notIndexed }),
  );
  assert.deepEqual(verdict, { ok: false, reason: "unindexed", urls: ["https://b.test"] });
});

test("the same URL entered twice is named once", () => {
  const verdict = gateDeclaredUrls(
    ["https://a.test", "https://a.test"],
    answers({ "https://a.test": notIndexed }),
  );
  assert.deepEqual(verdict, { ok: false, reason: "unindexed", urls: ["https://a.test"] });
});

test("partner and competitor are the same rule", () => {
  // Not a tautology: it is the assertion that there is one implementation. A second copy for
  // competitors is exactly how the two came to differ everywhere else in this pipeline.
  const rows = answers({ "https://x.test": notIndexed });
  assert.deepEqual(gateDeclaredUrls(["https://x.test"], rows), gateDeclaredUrls(["https://x.test"], rows));
});

test("the refusal says what to do about it", () => {
  const unindexed = gateDeclaredUrls(["https://a.test"], answers({ "https://a.test": notIndexed }));
  assert.equal(
    describeVerdict(unindexed, "Partner URLs"),
    "Partner URLs: no crawl exists for https://a.test. Crawl and index it, then try again.",
  );

  const unchecked = gateDeclaredUrls(["https://a.test"], answers({}));
  assert.equal(
    describeVerdict(unchecked, "Competitor URLs"),
    "Competitor URLs: the index could not be reached, so https://a.test could not be checked.",
  );

  assert.equal(describeVerdict({ ok: true }, "Partner URLs"), null);
});

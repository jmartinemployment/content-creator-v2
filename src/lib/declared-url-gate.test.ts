import test from "node:test";
import assert from "node:assert/strict";
import { unindexedUrls, type IndexAnswer } from "./declared-url-gate.ts";

const yes = { usable: true };
const no = { usable: false };

function answers(rows: Record<string, IndexAnswer>) {
  return rows;
}

test("an empty list blocks nothing", () => {
  assert.deepEqual(unindexedUrls([], answers({})), []);
});

test("every URL indexed is allowed", () => {
  const blocked = unindexedUrls(
    ["https://a.test", "https://b.test"],
    answers({ "https://a.test": yes, "https://b.test": yes }),
  );
  assert.deepEqual(blocked, []);
});

test("an unindexed URL blocks, and only that URL is named", () => {
  const blocked = unindexedUrls(
    ["https://a.test", "https://b.test"],
    answers({ "https://a.test": yes, "https://b.test": no }),
  );
  assert.deepEqual(blocked, ["https://b.test"]);
});

test("no answer is not evidence", () => {
  // One question, one answer. A URL nobody could get an answer for cannot be written from, and the
  // operator does the same thing about it as about one that came back red.
  const blocked = unindexedUrls(["https://a.test"], answers({}));
  assert.deepEqual(blocked, ["https://a.test"]);
});

test("the same URL entered twice is named once", () => {
  const blocked = unindexedUrls(
    ["https://a.test", "https://a.test"],
    answers({ "https://a.test": no }),
  );
  assert.deepEqual(blocked, ["https://a.test"]);
});

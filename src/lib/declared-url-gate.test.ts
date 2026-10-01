import test from "node:test";
import assert from "node:assert/strict";
import { unindexedUrls, usableUrls, type IndexAnswer } from "./declared-url-gate.ts";

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

test("the usable list is what the project is saved with", () => {
  const rows = answers({ "https://a.test": yes, "https://b.test": no, "https://c.test": yes });
  const urls = ["https://a.test", "https://b.test", "https://c.test"];

  assert.deepEqual(usableUrls(urls, rows), ["https://a.test", "https://c.test"]);
  assert.deepEqual(unindexedUrls(urls, rows), ["https://b.test"]);
});

test("every entered URL lands in exactly one of the two lists", () => {
  // One definition of usable, partitioned. Two independently computed notions of "fine" is how the
  // count rule and the block rule came to disagree about the same URL.
  const rows = answers({ "https://a.test": yes, "https://b.test": no });
  const urls = ["https://a.test", "https://b.test", "https://unanswered.test"];

  const usable = usableUrls(urls, rows);
  const blocked = unindexedUrls(urls, rows);

  assert.deepEqual([...usable, ...blocked].sort(), [...urls].sort());
  assert.deepEqual(
    usable.filter((u) => blocked.includes(u)),
    [],
  );
});

test("a sixth URL with no crawl does not cost the five that have one", () => {
  // The defect this exists to stop: the floor was counted on declared URLs while a separate rule
  // required every declared URL to be usable, so an extra bad URL disabled a project that already
  // met the floor.
  const urls = [
    "https://p1.test",
    "https://p2.test",
    "https://p3.test",
    "https://p4.test",
    "https://p5.test",
    "https://p6.test",
  ];
  const rows = answers({
    "https://p1.test": yes,
    "https://p2.test": yes,
    "https://p3.test": yes,
    "https://p4.test": yes,
    "https://p5.test": yes,
    "https://p6.test": no,
  });

  assert.equal(usableUrls(urls, rows).length, 5);
  assert.deepEqual(unindexedUrls(urls, rows), ["https://p6.test"]);
});

test("duplicates are not counted twice toward the floor", () => {
  const rows = answers({ "https://a.test": yes });

  assert.deepEqual(usableUrls(["https://a.test", "https://a.test"], rows), ["https://a.test"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { declaredUrls, unindexedUrls, usableUrls, type IndexAnswer } from "./declared-url-gate.ts";

const yes = { usable: true };
const no = { usable: false };

function answers(rows: Record<string, IndexAnswer>) {
  return rows;
}

test("an empty list names nothing", () => {
  assert.deepEqual(unindexedUrls([], answers({})), []);
});

test("every URL usable names nothing", () => {
  const named = unindexedUrls(
    ["https://a.test", "https://b.test"],
    answers({ "https://a.test": yes, "https://b.test": yes }),
  );
  assert.deepEqual(named, []);
});

test("a URL without a usable crawl is named, and only that URL", () => {
  const named = unindexedUrls(
    ["https://a.test", "https://b.test"],
    answers({ "https://a.test": yes, "https://b.test": no }),
  );
  assert.deepEqual(named, ["https://b.test"]);
});

test("no answer is not evidence", () => {
  // One question, one answer. A URL nobody could get an answer for cannot be written from yet, and
  // it is named the same way as one that came back amber.
  const named = unindexedUrls(["https://a.test"], answers({}));
  assert.deepEqual(named, ["https://a.test"]);
});

test("the same URL entered twice is named once", () => {
  const named = unindexedUrls(
    ["https://a.test", "https://a.test"],
    answers({ "https://a.test": no }),
  );
  assert.deepEqual(named, ["https://a.test"]);
});

test("every declared URL lands in exactly one of usable and unindexed", () => {
  // One definition of usable, partitioned. Two independently computed notions of "fine" is how a
  // count rule and a block rule once came to disagree about the same URL.
  const rows = answers({ "https://a.test": yes, "https://b.test": no });
  const urls = ["https://a.test", "https://b.test", "https://unanswered.test"];

  const usable = usableUrls(urls, rows);
  const named = unindexedUrls(urls, rows);

  assert.deepEqual([...usable, ...named].sort(), [...urls].sort());
  assert.deepEqual(
    usable.filter((u) => named.includes(u)),
    [],
  );
});

test("the project is saved with every declared URL, indexed or not", () => {
  // What changed on 2026-10-09. A sixth partner with no crawl used to be dropped from the project
  // without a word; now it is saved like the other five, and Generate is what names it.
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

  assert.deepEqual(declaredUrls(urls), urls);
  assert.equal(usableUrls(urls, rows).length, 5);
  assert.deepEqual(unindexedUrls(urls, rows), ["https://p6.test"]);
});

test("a URL typed twice is saved once", () => {
  assert.deepEqual(declaredUrls(["https://a.test", "https://a.test"]), ["https://a.test"]);
});

test("the same URL in a different case is one URL, kept in its first spelling", () => {
  // The server compares hosts without regard to case, so the form must count the same five it will.
  assert.deepEqual(declaredUrls(["https://a.test", "https://A.test"]), ["https://a.test"]);
  assert.deepEqual(
    unindexedUrls(["https://a.test", "https://A.test"], answers({ "https://a.test": no })),
    ["https://a.test"],
  );
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkSeed, checkSeedBatch, MAX_SEEDS_PER_REQUEST } from "./crawl-seeds.ts";

/**
 * These pin the rules to GeekCrawlerSeedNormalizer's, because the client cannot call the server's
 * validator and therefore holds a copy.
 *
 * A copy that drifts is worse than no copy: accept something the server rejects and the operator is
 * told a URL is fine when the crawl will refuse it; reject something the server accepts and a URL
 * is silently dropped. When the C# changes, these fail — that is the whole point of them.
 *
 * Source of truth: GeekApplication/Models/GeekCrawler/GeekCrawlerSeedNormalizer.cs
 * (TryNormalizeSeedUrl, IsAllowedCrawlUri, StripListPrefix) and GeekCrawlerCaps.MaxSeedsPerRequest.
 */
describe("seed admission mirrors the server", () => {
  test("cap matches GeekCrawlerCaps.MaxSeedsPerRequest", () => {
    assert.equal(MAX_SEEDS_PER_REQUEST, 25);
  });

  test("a missing scheme becomes https, not a rejection", () => {
    assert.equal(checkSeed("geekatyourspot.com").url, "https://geekatyourspot.com");
    assert.equal(checkSeed("//example.com/x").url, "https://example.com/x");
  });

  test("list prefixes are stripped, matching StripListPrefix", () => {
    for (const raw of ["- example.com", "* example.com", "+ example.com", "1. example.com"]) {
      assert.equal(checkSeed(raw).url, "https://example.com", raw);
    }
  });

  test("trailing slash is dropped only on the root path", () => {
    assert.equal(checkSeed("https://example.com/").url, "https://example.com");
    assert.equal(checkSeed("https://example.com/tools/").url, "https://example.com/tools/");
  });

  test("query is kept, fragment is dropped — GetLeftPart(UriPartial.Query)", () => {
    assert.equal(checkSeed("https://example.com/a?b=1#frag").url, "https://example.com/a?b=1");
  });

  test("only http and https, and the reason names the scheme", () => {
    // The verdict alone is not enough. Reporting a scheme problem as a host problem is a correct
    // rejection with a misleading reason, which sends the operator to the wrong part of the line.
    for (const raw of ["ftp://example.com", "file:///etc/passwd", "gopher://example.com"]) {
      assert.match(checkSeed(raw).reason ?? "", /Only http and https schemes/, raw);
    }
  });

  test("a bare host that merely contains a colon is not mistaken for a scheme", () => {
    assert.equal(checkSeed("example.com:443/x").url, "https://example.com/x");
  });

  test("only ports 80 and 443", () => {
    assert.equal(checkSeed("https://example.com:443/x").reason, null);
    assert.equal(checkSeed("http://example.com:80/x").reason, null);
    assert.match(checkSeed("http://example.com:8080/x").reason ?? "", /Port 8080/);
  });

  test("loopback and metadata hosts are refused", () => {
    for (const raw of ["http://localhost/x", "http://api.localhost/x", "http://metadata.google.internal/x"]) {
      assert.match(checkSeed(raw).reason ?? "", /Loopback and metadata/, raw);
    }
  });

  test("private, loopback, link-local and metadata IPs are refused", () => {
    for (const host of ["10.0.0.1", "127.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1"]) {
      assert.match(checkSeed(`http://${host}/x`).reason ?? "", /Private, loopback/, host);
    }
  });

  test("a public IP literal is allowed", () => {
    assert.equal(checkSeed("http://8.8.8.8/x").reason, null);
  });

  test("a dotless host is refused", () => {
    assert.match(checkSeed("http://intranet/x").reason ?? "", /public DNS name or public IP/);
  });
});

describe("batch reporting", () => {
  test("every bad line is reported, not just the first", () => {
    // The server stops at the first failure and rejects the batch; this is why the copy exists.
    const batch = checkSeedBatch(
      ["https://good-one.example/a", "http://localhost/x", "https://good-two.example/b", "ftp://nope.example"].join("\n"),
    );

    assert.equal(batch.rejected.length, 2);
    assert.deepEqual(batch.accepted, ["https://good-one.example/a", "https://good-two.example/b"]);
    assert.ok(batch.rejected.every((r) => r.reason && r.raw));
  });

  test("duplicates are reported and sent once", () => {
    const batch = checkSeedBatch(["example.com/a", "https://example.com/a", "example.com/b"].join("\n"));
    assert.deepEqual(batch.accepted, ["https://example.com/a", "https://example.com/b"]);
    assert.equal(batch.duplicates.length, 1);
  });

  test("the cap counts non-blank raw lines, as the server does", () => {
    const lines = Array.from({ length: MAX_SEEDS_PER_REQUEST + 1 }, (_, i) => `https://e${i}.example`);
    assert.ok(checkSeedBatch(lines.join("\n")).capError);
    assert.equal(checkSeedBatch(lines.slice(0, MAX_SEEDS_PER_REQUEST).join("\n")).capError, null);
  });

  test("blank lines are skipped, not rejected", () => {
    const batch = checkSeedBatch("example.com\n\n   \nexample.org\n");
    assert.equal(batch.rejected.length, 0);
    assert.equal(batch.accepted.length, 2);
  });
});

"use client";

import { useState } from "react";
import { checkHostsIndexed, type HostIndexed } from "@/services/gcc-api";

/**
 * Whether an index exists for each entered URL. Green yes, red no.
 *
 * One check, because it subsumes the rest: a URL that will not parse was never crawled, so no index
 * can exist for it, and it lands red alongside a well-formed URL that was never crawled. The
 * operator does the same thing about both.
 */
/** One URL per line; blanks dropped. Parsing only — validity is the index's answer. */
function parseLines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

function IndexReport({
  urls,
  results,
  checking,
  error,
}: {
  urls: string[];
  results: Record<string, HostIndexed>;
  checking: boolean;
  error: string | null;
}) {
  if (urls.length === 0) return null;
  if (checking) return <p className="text-xs text-[var(--gcc-muted)]">Checking the index…</p>;
  if (error) return <p className="text-xs text-red-600">{error}</p>;

  const seen = urls.filter((u) => results[u] !== undefined);
  if (seen.length === 0) return null;

  return (
    <div className="space-y-1 text-xs">
      {seen.map((u) => {
        const r = results[u];
        return (
          <p key={u} className={r.indexed ? "text-green-700" : "text-red-600"}>
            <span className="font-mono">{u}</span> —{" "}
            {r.indexed ? "indexed" : "no index — crawl it first"}
          </p>
        );
      })}
    </div>
  );
}

export function SiteAnalyzerClient() {
  // Partner and competitor URLs are entered here and checked against the RAG index. They are never
  // crawled from this page -- crawling them is Geek-Crawler's job. Deleted in 2367b08 when v1's
  // client was restored wholesale over the file that carried them; restored here.
  const [partnerSeeds, setPartnerSeeds] = useState("");
  const [competitorSeeds, setCompetitorSeeds] = useState("");
  const [indexed, setIndexed] = useState<Record<string, HostIndexed>>({});
  const [checkingIndex, setCheckingIndex] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  const partnerUrls = parseLines(partnerSeeds);
  const competitorUrls = parseLines(competitorSeeds);

  async function checkIndex(urls: string[]) {
    const pending = urls.filter((u) => indexed[u] === undefined);
    if (pending.length === 0) return;
    setCheckingIndex(true);
    setIndexError(null);
    try {
      const rows = await checkHostsIndexed(pending);
      setIndexed((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.url] = r;
        return next;
      });
    } catch (e) {
      // The check failing is not a verdict on the URL. Leave it unmarked rather than red.
      setIndexError(e instanceof Error ? e.message : "Could not reach the index.");
    } finally {
      setCheckingIndex(false);
    }
  }

  const [domain, setDomain] = useState("");
  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="geekatyourspot.com"
            className="flex-1 rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 text-sm"
            onBlur={() => void checkIndex(parseLines(domain))}
          />
        </div>



        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--gcc-ink)]">Partner URLs</span>
            <span className="text-xs text-[var(--gcc-muted)]">Products you sell or recommend.</span>
            <textarea
              value={partnerSeeds}
              onChange={(e) => setPartnerSeeds(e.target.value)}
              onBlur={() => void checkIndex(partnerUrls)}
                rows={5}
              placeholder={"https://partner.example/pricing\nhttps://partner.example/docs"}
              className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
            />
            <IndexReport
              urls={partnerUrls}
              results={indexed}
              checking={checkingIndex}
              error={indexError}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--gcc-ink)]">Competitor URLs</span>
            <span className="text-xs text-[var(--gcc-muted)]">
              Rivals writing on the same topics.
            </span>
            <textarea
              value={competitorSeeds}
              onChange={(e) => setCompetitorSeeds(e.target.value)}
              onBlur={() => void checkIndex(competitorUrls)}
                rows={5}
              placeholder={"https://rival.example/services\nhttps://rival.example/about"}
              className="rounded-md border border-[var(--gcc-line)] bg-white px-3 py-2 font-mono text-xs"
            />
            <IndexReport
              urls={competitorUrls}
              results={indexed}
              checking={checkingIndex}
              error={indexError}
            />
          </label>
        </div>
        <p className="text-xs text-[var(--gcc-muted)]">
          One URL per line. Checked against the index when you leave the field.
        </p>
      </div>


    </div>
  );
}

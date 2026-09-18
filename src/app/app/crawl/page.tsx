import { SiteAnalyzerClient } from "./crawl-client";

export default function SiteAnalyzerPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display text-3xl font-semibold">Project site</h1>
      <p className="mt-2 text-[var(--gcc-muted)]">
        Enter the site you are writing for. Content Creator does not crawl it — Geek-Crawler does.
        This checks whether usable evidence already exists and, if it does, opens the workflow
        against that crawl.
      </p>
      <SiteAnalyzerClient />
    </div>
  );
}

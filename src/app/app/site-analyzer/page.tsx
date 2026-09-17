import { SiteAnalyzerClient } from "./site-analyzer-client";

export default function SiteAnalyzerPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display text-3xl font-semibold">Crawl site</h1>
      <p className="mt-2 text-[var(--gcc-muted)]">
        Point at a site and crawl it. The crawl is what grounds a draft in your own pages.
      </p>
      <SiteAnalyzerClient />
    </div>
  );
}

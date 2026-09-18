import Link from "next/link";

/*
  Flat navy ground, no gradient bloom. geekatyourspot.com builds its sections as
  solid bg-[#0b162a] with no gradients or texture; matching that is what makes
  this subdomain read as the same property.

  Orange appears exactly twice: the one primary action, and the gap marker in the
  heading tree — which is the product's actual subject, not decoration.
*/

const tree: { level: string; label: string; depth: number; gap?: boolean }[] = [
  { level: "H1", label: "Commercial roof repair", depth: 0 },
  { level: "H2", label: "Flat roof systems we service", depth: 1 },
  { level: "H3", label: "TPO and EPDM membranes", depth: 2 },
  { level: "H2", label: "Service areas", depth: 1 },
  { level: "H2", label: "What storm damage repair costs", depth: 1, gap: true },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--gcc-navy)] text-white">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-baseline gap-2.5">
          <a
            href="https://geekatyourspot.com/"
            className="text-sm text-white/55 transition hover:text-white/80"
          >
            Geek @ Your Spot
          </a>
          <span aria-hidden className="text-white/25">
            /
          </span>
          <p className="font-display text-sm font-semibold tracking-tight">
            Content Creator
          </p>
        </div>
        {/* Plain <a>: Next Link soft-nav fetches /api/auth/start and breaks OAuth redirects. */}
        <a
          href="/api/auth/start"
          className="text-sm font-medium text-white/70 transition hover:text-white"
        >
          Sign in
        </a>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-14 px-6 pb-20 pt-12 sm:px-10 lg:flex-row lg:items-center lg:gap-20 lg:px-16">
        <div className="lg:max-w-xl lg:flex-1">
          <h1 className="text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Write from the gaps in your own site.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
            Crawl a site, see which questions its headings never answer, then
            draft into those gaps — grounded in text the crawl actually verified.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="/api/auth/start"
              className="inline-flex items-center justify-center rounded-md bg-[var(--gcc-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--gcc-accent-deep)]"
            >
              Sign in to start
            </a>
            <Link
              href="/app/crawl"
              className="inline-flex items-center justify-center rounded-md border border-white/25 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/45 hover:text-white"
            >
              Open the app
            </Link>
          </div>
        </div>

        <figure className="w-full max-w-md lg:flex-1">
          <div className="rounded-lg bg-[var(--gcc-navy-raised)] p-5 sm:p-6">
            <ul className="flex flex-col gap-px">
              {tree.map((node) => (
                <li
                  key={`${node.level}-${node.label}`}
                  style={{ marginLeft: `${node.depth * 1.25}rem` }}
                  className={`flex items-baseline gap-3 border-l-2 py-2 pl-3 text-sm ${
                    node.gap
                      ? "border-[var(--gcc-accent)] text-white"
                      : "border-transparent text-white/60"
                  }`}
                >
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      node.gap ? "text-[var(--gcc-accent)]" : "text-white/35"
                    }`}
                  >
                    {node.gap ? "none" : node.level}
                  </span>
                  <span className={node.gap ? "font-medium" : ""}>
                    {node.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <figcaption className="mt-4 max-w-sm text-sm leading-relaxed text-white/45">
            Four headings cover the service. Nothing on the site answers what the
            repair costs — so that is what gets written next.
          </figcaption>
        </figure>
      </main>
    </div>
  );
}

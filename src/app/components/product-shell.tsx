"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const primaryNav = [
  { href: "/", label: "Dashboard", glyph: "⌂" },
  { href: "/creates", label: "Content", glyph: "▤" },
  { href: "/skills", label: "Skills", glyph: "✦" },
] as const;

const futureNav = [
  { label: "Assets", glyph: "◇" },
  { label: "Brand & Sources", glyph: "◉" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--cc-paper)] md:grid md:grid-cols-[244px_1fr]">
      <aside className="hidden border-r border-[var(--cc-line)] bg-white md:flex md:min-h-screen md:flex-col md:p-4">
        <Link href="/" className="flex items-center gap-3 px-2 py-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--cc-accent)] text-lg font-bold text-white">
            C
          </span>
          <span>
            <span className="block text-sm font-bold text-[var(--cc-ink)]">Content Creator</span>
            <span className="block text-xs text-[var(--cc-muted)]">Content workspace</span>
          </span>
        </Link>

        <Link
          href="/creates/new"
          className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-[var(--cc-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--cc-accent-hover)]"
        >
          <span aria-hidden>＋</span> New content
        </Link>

        <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Main navigation">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive(pathname, item.href)
                  ? "bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]"
                  : "text-[var(--cc-muted)] hover:bg-black/[0.03] hover:text-[var(--cc-ink)]"
              }`}
            >
              <span className="w-5 text-center text-base" aria-hidden>{item.glyph}</span>
              {item.label}
            </Link>
          ))}
          {futureNav.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--cc-muted)]/70"
              title="Coming in a later workspace update"
            >
              <span className="w-5 text-center text-base" aria-hidden>{item.glyph}</span>
              <span>{item.label}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--cc-line)] pt-3">
          <Link
            href="/legacy"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--cc-muted)] hover:text-[var(--cc-ink)]"
          >
            <span className="w-5 text-center" aria-hidden>↺</span>
            Archive
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--cc-muted)] hover:text-[var(--cc-ink)]">
              <span className="w-5 text-center" aria-hidden>↪</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--cc-line)] bg-white/95 px-4 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2 font-bold text-[var(--cc-ink)]">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--cc-accent)] text-white">C</span>
            Content Creator
          </Link>
          <Link href="/creates/new" className="rounded-md bg-[var(--cc-accent)] px-3 py-1.5 text-sm font-semibold text-white">
            New
          </Link>
        </header>
        {children}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[var(--cc-line)] bg-white px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
        aria-label="Mobile navigation"
      >
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 text-xs font-medium ${
              isActive(pathname, item.href) ? "text-[var(--cc-accent)]" : "text-[var(--cc-muted)]"
            }`}
          >
            <span className="text-lg" aria-hidden>{item.glyph}</span>
            {item.label}
          </Link>
        ))}
        <Link
          href="/legacy"
          className={`flex flex-col items-center gap-0.5 text-xs font-medium ${
            pathname.startsWith("/legacy") ? "text-[var(--cc-accent)]" : "text-[var(--cc-muted)]"
          }`}
        >
          <span className="text-lg" aria-hidden>↺</span>
          Archive
        </Link>
      </nav>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * One entry, because there is one place to start. `/app/workflow` is the picker and
 * `/app/projects/[id]` is the workspace it opens, so both belong to the same nav item — a second link
 * to a route you only ever arrive at by choosing a project would have nothing to point at.
 */
const nav: { href: string; label: string; owns: string[] }[] = [
  { href: "/app/workflow", label: "Projects", owns: ["/app/workflow", "/app/projects"] },
];

/**
 * The app's own navbar, carrying the parent property's logo.
 *
 * Content Creator is a subdomain of geekatyourspot.com and has to read as the same property, so the
 * mark is the parent's — `/images/GeekAtYourSpot.svg`, saved into `public/` rather than hotlinked so
 * the app does not depend on the marketing site being up.
 *
 * A top bar rather than the sidebar it replaces: the sidebar held one nav item and 220px of horizontal
 * space, and the project workspace wants that width. Nav this small does not need a column.
 */
export function AppNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(item: (typeof nav)[number]) {
    return item.owns.some(
      (base) => pathname === base || pathname.startsWith(`${base}/`),
    );
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-[#025E73] text-white">
      <div className="mx-auto flex h-16 w-full max-w-[1800px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/app/workflow" className="flex shrink-0 items-center" aria-label="Geek @ Your Spot">
          {/* Sized to the SVG's own 124×51 ratio so it is never stretched. */}
          <Image
            src="/GeekAtYourSpot.svg"
            alt="Geek @ Your Spot logo"
            width={124}
            height={51}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item) ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item)
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 lg:flex">
          <Link href="/" className="text-xs text-white/50 transition-colors hover:text-white/80">
            Marketing site
          </Link>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu"
          className="ml-auto rounded-md p-2 text-white/80 hover:bg-white/10 lg:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {open ? (
        <nav className="border-t border-white/10 px-4 pb-3 sm:px-6 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item) ? "page" : undefined}
              className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                isActive(item) ? "bg-white/15 text-white" : "text-white/75"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
            <Link href="/" className="px-3 py-2 text-xs text-white/50">
              Marketing site
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="px-3 py-2 text-sm text-white/70">
                Sign out
              </button>
            </form>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

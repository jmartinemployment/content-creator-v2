"use client";

import { AppNavbar } from "@/components/AppNavbar";

/**
 * Top navbar over full-width content.
 *
 * This was a 220px sidebar holding a single nav item. The project workspace is a two-column layout in
 * its own right, so a navigation column was spending horizontal space the content wanted — and nav this
 * small does not need a column. `AppSidebar` is kept in the tree for now rather than deleted, since
 * nothing else references it and removing a component is not what this change is for.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--gcc-paper)] text-[var(--gcc-ink)]">
      <AppNavbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}

"use client";

import { AppNavbar } from "@/components/AppNavbar";

/**
 * Top navbar over full-width content.
 *
 * This was a 220px sidebar holding a single nav item. The project workspace is a two-column layout in
 * its own right, so a navigation column was spending horizontal space the content wanted — and nav this
 * small does not need a column. `AppSidebar` was kept in the tree at the time and deleted on
 * 2026-10-03 (`a5ea3d7`) once nothing imported it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <AppNavbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}

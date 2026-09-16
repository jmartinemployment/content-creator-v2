"use client";

export const WORKSPACE_TABS = ["canvas", "outline", "assets", "review", "brief"] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

const TAB_LABELS: Record<WorkspaceTab, string> = {
  canvas: "Canvas",
  outline: "Outline",
  assets: "Assets",
  review: "Review",
  brief: "Brief",
};

export function WorkspaceTabs({
  active,
  onChange,
  reviewCount = 0,
  assetCount = 0,
}: {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  reviewCount?: number;
  assetCount?: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Content workspace"
      className="flex gap-1 overflow-x-auto border-b border-[var(--cc-line)]"
    >
      {WORKSPACE_TABS.map((tab) => {
        const count = tab === "review" ? reviewCount : tab === "assets" ? assetCount : 0;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => onChange(tab)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap ${
              active === tab
                ? "border-[var(--cc-accent)] text-[var(--cc-ink)]"
                : "border-transparent text-[var(--cc-muted)] hover:text-[var(--cc-ink)]"
            }`}
          >
            {TAB_LABELS[tab]}
            {count > 0 ? (
              <span className="ml-1.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px]">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

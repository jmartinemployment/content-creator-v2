import type { RagAdTemplate } from "./types";

const STORAGE_KEY = "gcc-v2-rag-ad-templates";

export const DEFAULT_AD_TEMPLATES: RagAdTemplate[] = [
  {
    id: "pas-linkedin",
    name: "PAS LinkedIn",
    channel: "linkedin",
    framework: "PAS",
    body: "Problem: RevOps teams drown in duplicate CRM contacts.\nAgitate: Bad data slows every campaign and burns SDR time.\nSolution: Sync once with clear ownership rules — launch cleaner sequences this week.",
  },
  {
    id: "aida-paid",
    name: "AIDA paid social",
    channel: "paid-social",
    framework: "AIDA",
    body: "Attention: Duplicate contacts are killing your attribution.\nInterest: See how mid-market teams keep CRM + MAP in sync.\nDesire: Cleaner funnels, fewer wasted sends.\nAction: Book a 15-min partner walkthrough.",
  },
  {
    id: "benefit-blurb",
    name: "Benefit blurb",
    channel: "web",
    framework: "benefit",
    body: "Ship partner onboarding in days, not quarters — prebuilt CRM sync patterns your customers already trust.",
  },
];

export function loadAdTemplates(): RagAdTemplate[] {
  if (typeof window === "undefined") return DEFAULT_AD_TEMPLATES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AD_TEMPLATES;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_AD_TEMPLATES;
    return parsed
      .filter((t): t is RagAdTemplate => !!t && typeof t === "object" && typeof (t as RagAdTemplate).body === "string")
      .map((t) => ({
        id: String(t.id || crypto.randomUUID().slice(0, 12)),
        name: String(t.name || "Untitled"),
        channel: t.channel ? String(t.channel) : undefined,
        framework: t.framework ? String(t.framework) : undefined,
        body: String(t.body),
      }));
  } catch {
    return DEFAULT_AD_TEMPLATES;
  }
}

export function saveAdTemplates(templates: RagAdTemplate[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, 40)));
}

export type VisualGuidelinePalette = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  background?: string | null;
  text?: string | null;
};

export type VisualGuidelineTypography = {
  displayFont?: string | null;
  bodyFont?: string | null;
  minBodySizePx?: number | null;
};

export type VisualGuidelineLogoUsage = {
  clearSpaceRatio?: number | null;
  allowedBackgrounds: string[];
  prohibitedTreatments: string[];
};

export type VisualGuidelineLayout = {
  maxContentWidthPx?: number | null;
  preferFullBleedHero?: boolean | null;
  cornerRadiusPx?: number | null;
};

export type VisualGuidelineImagery = {
  styleNotes: string;
  prohibitedMotifs: string[];
};

export type VisualGuidelinePolicy = {
  schemaVersion: 1;
  palette: VisualGuidelinePalette;
  typography: VisualGuidelineTypography;
  logoUsage: VisualGuidelineLogoUsage;
  layout: VisualGuidelineLayout;
  imagery: VisualGuidelineImagery;
  customInstructions: string;
};

export const EMPTY_VISUAL_GUIDELINE_POLICY: VisualGuidelinePolicy = {
  schemaVersion: 1,
  palette: {
    primary: null,
    secondary: null,
    accent: null,
    background: null,
    text: null,
  },
  typography: {
    displayFont: null,
    bodyFont: null,
    minBodySizePx: 16,
  },
  logoUsage: {
    clearSpaceRatio: 0.5,
    allowedBackgrounds: [],
    prohibitedTreatments: [],
  },
  layout: {
    maxContentWidthPx: 1200,
    preferFullBleedHero: true,
    cornerRadiusPx: 8,
  },
  imagery: {
    styleNotes: "",
    prohibitedMotifs: [],
  },
  customInstructions: "",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asBool(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function linesFromMultiline(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function multilineFromLines(lines: string[]): string {
  return lines.join("\n");
}

export function normalizeVisualGuidelinePolicy(value: unknown): VisualGuidelinePolicy {
  const raw = asRecord(value) ?? {};
  const palette = asRecord(raw.palette) ?? {};
  const typography = asRecord(raw.typography) ?? {};
  const logoUsage = asRecord(raw.logoUsage) ?? {};
  const layout = asRecord(raw.layout) ?? {};
  const imagery = asRecord(raw.imagery) ?? {};
  return {
    schemaVersion: 1,
    palette: {
      primary: asString(palette.primary),
      secondary: asString(palette.secondary),
      accent: asString(palette.accent),
      background: asString(palette.background),
      text: asString(palette.text),
    },
    typography: {
      displayFont: asString(typography.displayFont),
      bodyFont: asString(typography.bodyFont),
      minBodySizePx: asNumber(typography.minBodySizePx)
        ?? EMPTY_VISUAL_GUIDELINE_POLICY.typography.minBodySizePx,
    },
    logoUsage: {
      clearSpaceRatio: asNumber(logoUsage.clearSpaceRatio)
        ?? EMPTY_VISUAL_GUIDELINE_POLICY.logoUsage.clearSpaceRatio,
      allowedBackgrounds: asStringList(logoUsage.allowedBackgrounds),
      prohibitedTreatments: asStringList(logoUsage.prohibitedTreatments),
    },
    layout: {
      maxContentWidthPx: asNumber(layout.maxContentWidthPx)
        ?? EMPTY_VISUAL_GUIDELINE_POLICY.layout.maxContentWidthPx,
      preferFullBleedHero: asBool(layout.preferFullBleedHero)
        ?? EMPTY_VISUAL_GUIDELINE_POLICY.layout.preferFullBleedHero,
      cornerRadiusPx: asNumber(layout.cornerRadiusPx)
        ?? EMPTY_VISUAL_GUIDELINE_POLICY.layout.cornerRadiusPx,
    },
    imagery: {
      styleNotes: typeof imagery.styleNotes === "string" ? imagery.styleNotes : "",
      prohibitedMotifs: asStringList(imagery.prohibitedMotifs),
    },
    customInstructions: typeof raw.customInstructions === "string"
      ? raw.customInstructions
      : "",
  };
}

export function validateVisualGuidelinePolicy(policy: VisualGuidelinePolicy): string | null {
  const colors = Object.entries(policy.palette);
  for (const [key, value] of colors) {
    if (value && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
      && !/^[a-zA-Z][\w-]*$/.test(value)) {
      return `Palette ${key} must be a hex color or named token.`;
    }
  }
  const minSize = policy.typography.minBodySizePx;
  if (minSize != null && (minSize < 8 || minSize > 72)) {
    return "Minimum body size must be between 8 and 72.";
  }
  const ratio = policy.logoUsage.clearSpaceRatio;
  if (ratio != null && (ratio < 0 || ratio > 4)) {
    return "Logo clear-space ratio must be between 0 and 4.";
  }
  return null;
}

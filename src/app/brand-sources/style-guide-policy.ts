export type StyleGuideGrammar = {
  oxfordComma?: boolean | null;
  preferActiveVoice?: boolean | null;
  allowEmDash?: boolean | null;
  sentenceCaseHeadings?: boolean | null;
};

export type StyleGuideTermKind =
  | "prohibit"
  | "replace"
  | "capitalize"
  | "abbreviation"
  | "firstMention";

export type StyleGuideTermRule = {
  id?: string;
  kind: StyleGuideTermKind;
  match: string;
  replacement?: string | null;
  caseSensitive?: boolean | null;
  note?: string | null;
};

export type StyleGuidePolicy = {
  schemaVersion: 1;
  grammar: StyleGuideGrammar;
  termRules: StyleGuideTermRule[];
  prohibitedPhrases: string[];
  requiredPhrases: string[];
  customInstructions: string;
};

export const EMPTY_STYLE_GUIDE_POLICY: StyleGuidePolicy = {
  schemaVersion: 1,
  grammar: {
    oxfordComma: true,
    preferActiveVoice: true,
    allowEmDash: true,
    sentenceCaseHeadings: true,
  },
  termRules: [],
  prohibitedPhrases: [],
  requiredPhrases: [],
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

function asBool(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

const TERM_KINDS = new Set<StyleGuideTermKind>([
  "prohibit",
  "replace",
  "capitalize",
  "abbreviation",
  "firstMention",
]);

function normalizeTermRule(value: unknown, index: number): StyleGuideTermRule | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const kindRaw = typeof raw.kind === "string" ? raw.kind : "";
  if (!TERM_KINDS.has(kindRaw as StyleGuideTermKind)) return null;
  const match = typeof raw.match === "string" ? raw.match.trim() : "";
  if (!match) return null;
  const replacement = typeof raw.replacement === "string" ? raw.replacement.trim() : "";
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `rule-${index + 1}`,
    kind: kindRaw as StyleGuideTermKind,
    match,
    replacement: replacement || null,
    caseSensitive: asBool(raw.caseSensitive),
    note: typeof raw.note === "string" ? raw.note : null,
  };
}

export function normalizeStyleGuidePolicy(value: unknown): StyleGuidePolicy {
  const raw = asRecord(value) ?? {};
  const grammarRaw = asRecord(raw.grammar) ?? {};
  return {
    schemaVersion: 1,
    grammar: {
      oxfordComma: asBool(grammarRaw.oxfordComma) ?? EMPTY_STYLE_GUIDE_POLICY.grammar.oxfordComma,
      preferActiveVoice: asBool(grammarRaw.preferActiveVoice)
        ?? EMPTY_STYLE_GUIDE_POLICY.grammar.preferActiveVoice,
      allowEmDash: asBool(grammarRaw.allowEmDash) ?? EMPTY_STYLE_GUIDE_POLICY.grammar.allowEmDash,
      sentenceCaseHeadings: asBool(grammarRaw.sentenceCaseHeadings)
        ?? EMPTY_STYLE_GUIDE_POLICY.grammar.sentenceCaseHeadings,
    },
    termRules: (Array.isArray(raw.termRules) ? raw.termRules : [])
      .map(normalizeTermRule)
      .filter((rule): rule is StyleGuideTermRule => rule !== null),
    prohibitedPhrases: asStringList(raw.prohibitedPhrases),
    requiredPhrases: asStringList(raw.requiredPhrases),
    customInstructions: typeof raw.customInstructions === "string"
      ? raw.customInstructions
      : "",
  };
}

export function validateStyleGuidePolicy(policy: StyleGuidePolicy): string | null {
  const prohibited = new Set(
    [
      ...policy.prohibitedPhrases,
      ...policy.termRules
        .filter((rule) => rule.kind === "prohibit")
        .map((rule) => rule.match),
    ].map((value) => value.toLowerCase()),
  );
  for (const phrase of policy.requiredPhrases) {
    if (prohibited.has(phrase.toLowerCase())) {
      return "A Style Guide phrase cannot be both prohibited and required.";
    }
  }
  for (const rule of policy.termRules) {
    if (!rule.match.trim()) return "Each term rule needs a match phrase.";
    if ((rule.kind === "replace" || rule.kind === "abbreviation" || rule.kind === "firstMention")
      && !rule.replacement?.trim()) {
      return `Term rule "${rule.kind}" requires a replacement.`;
    }
  }
  return null;
}

export function linesFromMultiline(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

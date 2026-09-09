export type AudienceReadingLevel =
  | "general"
  | "professional"
  | "expert"
  | "executive";

export type AudienceValueProposition = {
  title: string;
  description: string;
};

export type AudienceObjectionResponse = {
  objection: string;
  response: string;
};

export type AudienceCharacteristic = {
  key: string;
  value: string;
};

export type AudiencePolicy = {
  schemaVersion: 1;
  summary: string;
  locale: string;
  industries: string[];
  roles: string[];
  pains: string[];
  goals: string[];
  buyingTriggers: string[];
  useCases: string[];
  readingLevel: AudienceReadingLevel | null;
  preferredLanguage: string[];
  bannedTopics: string[];
  avoidPhrases: string[];
  positioningStatement: string;
  valuePropositions: AudienceValueProposition[];
  objectionResponses: AudienceObjectionResponse[];
  additionalCharacteristics: AudienceCharacteristic[];
  customInstructions: string;
};

export const EMPTY_AUDIENCE_POLICY: AudiencePolicy = {
  schemaVersion: 1,
  summary: "",
  locale: "en",
  industries: [],
  roles: [],
  pains: [],
  goals: [],
  buyingTriggers: [],
  useCases: [],
  readingLevel: "professional",
  preferredLanguage: [],
  bannedTopics: [],
  avoidPhrases: [],
  positioningStatement: "",
  valuePropositions: [],
  objectionResponses: [],
  additionalCharacteristics: [],
  customInstructions: "",
};

const READING_LEVELS = new Set<AudienceReadingLevel>([
  "general",
  "professional",
  "expert",
  "executive",
]);

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

function normalizeValueProposition(value: unknown): AudienceValueProposition | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (!title && !description) return null;
  return { title, description };
}

function normalizeObjection(value: unknown): AudienceObjectionResponse | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const objection = typeof raw.objection === "string" ? raw.objection.trim() : "";
  const response = typeof raw.response === "string" ? raw.response.trim() : "";
  if (!objection && !response) return null;
  return { objection, response };
}

function normalizeCharacteristic(value: unknown): AudienceCharacteristic | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const key = typeof raw.key === "string" ? raw.key.trim() : "";
  const entryValue = typeof raw.value === "string" ? raw.value.trim() : "";
  if (!key && !entryValue) return null;
  return { key, value: entryValue };
}

export function normalizeAudiencePolicy(value: unknown): AudiencePolicy {
  const raw = asRecord(value) ?? {};
  const readingRaw = typeof raw.readingLevel === "string" ? raw.readingLevel : null;
  return {
    schemaVersion: 1,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    locale: typeof raw.locale === "string" && raw.locale.trim()
      ? raw.locale.trim()
      : EMPTY_AUDIENCE_POLICY.locale,
    industries: asStringList(raw.industries),
    roles: asStringList(raw.roles),
    pains: asStringList(raw.pains),
    goals: asStringList(raw.goals),
    buyingTriggers: asStringList(raw.buyingTriggers),
    useCases: asStringList(raw.useCases),
    readingLevel: readingRaw && READING_LEVELS.has(readingRaw as AudienceReadingLevel)
      ? readingRaw as AudienceReadingLevel
      : EMPTY_AUDIENCE_POLICY.readingLevel,
    preferredLanguage: asStringList(raw.preferredLanguage),
    bannedTopics: asStringList(raw.bannedTopics),
    avoidPhrases: asStringList(raw.avoidPhrases),
    positioningStatement: typeof raw.positioningStatement === "string"
      ? raw.positioningStatement
      : "",
    valuePropositions: (Array.isArray(raw.valuePropositions) ? raw.valuePropositions : [])
      .map(normalizeValueProposition)
      .filter((entry): entry is AudienceValueProposition => entry !== null),
    objectionResponses: (Array.isArray(raw.objectionResponses) ? raw.objectionResponses : [])
      .map(normalizeObjection)
      .filter((entry): entry is AudienceObjectionResponse => entry !== null),
    additionalCharacteristics: (Array.isArray(raw.additionalCharacteristics)
      ? raw.additionalCharacteristics
      : [])
      .map(normalizeCharacteristic)
      .filter((entry): entry is AudienceCharacteristic => entry !== null),
    customInstructions: typeof raw.customInstructions === "string"
      ? raw.customInstructions
      : "",
  };
}

export function validateAudiencePolicy(policy: AudiencePolicy): string | null {
  if (!policy.locale.trim()) return "Audience locale is required.";
  if (policy.readingLevel && !READING_LEVELS.has(policy.readingLevel)) {
    return "Audience readingLevel must be general, professional, expert, or executive.";
  }
  for (const entry of policy.valuePropositions) {
    if (!entry.title.trim()) return "Each value proposition needs a title.";
  }
  for (const entry of policy.objectionResponses) {
    if (!entry.objection.trim()) return "Each objection response needs an objection.";
  }
  for (const entry of policy.additionalCharacteristics) {
    if (!entry.key.trim()) return "Each additional characteristic needs a key.";
  }
  const banned = new Set(policy.bannedTopics.map((topic) => topic.toLowerCase()));
  if (banned.size !== policy.bannedTopics.length) {
    return "Audience bannedTopics must be unique.";
  }
  return null;
}

export function linesFromMultiline(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function multilineFromLines(values: string[]): string {
  return values.join("\n");
}

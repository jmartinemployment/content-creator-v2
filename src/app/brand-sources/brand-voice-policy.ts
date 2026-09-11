export type BrandVoicePolicy = {
  schemaVersion: 1;
  toneAttributes: string[];
  preferredPhrases: string[];
  avoidPhrases: string[];
  bannedClaims: string[];
  customInstructions: string;
};

export const EMPTY_BRAND_VOICE_POLICY: BrandVoicePolicy = {
  schemaVersion: 1,
  toneAttributes: [],
  preferredPhrases: [],
  avoidPhrases: [],
  bannedClaims: [],
  customInstructions: "",
};

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeBrandVoicePolicy(value: unknown): BrandVoicePolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_BRAND_VOICE_POLICY };
  }
  const raw = value as Record<string, unknown>;
  return {
    schemaVersion: 1,
    toneAttributes: stringList(raw.toneAttributes),
    preferredPhrases: stringList(raw.preferredPhrases),
    avoidPhrases: stringList(raw.avoidPhrases),
    bannedClaims: stringList(raw.bannedClaims),
    customInstructions: typeof raw.customInstructions === "string"
      ? raw.customInstructions
      : "",
  };
}

export function brandVoicePolicyPayload(policy: BrandVoicePolicy) {
  return {
    schemaVersion: 1 as const,
    toneAttributes: policy.toneAttributes,
    preferredPhrases: policy.preferredPhrases,
    avoidPhrases: policy.avoidPhrases,
    bannedClaims: policy.bannedClaims,
    customInstructions: policy.customInstructions.trim() || undefined,
  };
}

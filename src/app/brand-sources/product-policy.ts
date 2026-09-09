export type ProductFieldValueType = "string" | "text" | "number" | "boolean";

export type ProductSchemaField = {
  id: string;
  key: string;
  label: string;
  required: boolean;
  valueType: ProductFieldValueType;
};

export type ProductSchemaPolicy = {
  schemaVersion: 1;
  fields: ProductSchemaField[];
};

export type ProductVersionDraft = {
  productSchemaVersionId: string;
  fieldValues: Record<string, string>;
  approvedClaims: string[];
  prohibitedClaims: string[];
  mandatoryDisclaimers: string[];
};

export const EMPTY_PRODUCT_SCHEMA: ProductSchemaPolicy = {
  schemaVersion: 1,
  fields: [],
};

export function newFieldId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}

export function emptyProductSchemaField(index = 0): ProductSchemaField {
  return {
    id: newFieldId(),
    key: `field_${index + 1}`,
    label: `Field ${index + 1}`,
    required: false,
    valueType: "string",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asStringList(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return asStringList(parsed);
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const VALUE_TYPES = new Set<ProductFieldValueType>(["string", "text", "number", "boolean"]);

export function normalizeProductSchemaPolicy(value: unknown): ProductSchemaPolicy {
  const raw = asRecord(value);
  const fieldsSource = Array.isArray(value)
    ? value
    : Array.isArray(raw?.fields) ? raw.fields : [];
  const fields = fieldsSource.flatMap((entry, index) => {
    const field = asRecord(entry);
    if (!field) return [];
    const id = typeof field.id === "string" && field.id.trim() ? field.id.trim() : newFieldId();
    const key = typeof field.key === "string" && field.key.trim()
      ? field.key.trim()
      : `field_${index + 1}`;
    const label = typeof field.label === "string" && field.label.trim()
      ? field.label.trim()
      : key;
    const valueTypeRaw = typeof field.valueType === "string" ? field.valueType : "string";
    return [{
      id,
      key,
      label,
      required: field.required === true,
      valueType: VALUE_TYPES.has(valueTypeRaw as ProductFieldValueType)
        ? valueTypeRaw as ProductFieldValueType
        : "string",
    }];
  });
  return { schemaVersion: 1, fields };
}

export function validateProductSchemaPolicy(policy: ProductSchemaPolicy): string | null {
  if (policy.fields.length === 0) return "Add at least one Product Schema field.";
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const field of policy.fields) {
    if (!field.id.trim()) return "Each Product Schema field needs an id.";
    if (!field.key.trim()) return "Each Product Schema field needs a key.";
    if (!field.label.trim()) return "Each Product Schema field needs a label.";
    if (ids.has(field.id)) return "Product Schema field IDs must be unique.";
    if (keys.has(field.key.toLowerCase())) return "Product Schema field keys must be unique.";
    ids.add(field.id);
    keys.add(field.key.toLowerCase());
  }
  return null;
}

export function normalizeProductFieldValues(
  value: unknown,
  fields: ProductSchemaField[],
): Record<string, string> {
  const raw = asRecord(value) ?? {};
  const next: Record<string, string> = {};
  for (const field of fields) {
    const entry = raw[field.id];
    next[field.id] = entry == null ? "" : String(entry);
  }
  return next;
}

export function validateProductDraft(
  draft: ProductVersionDraft,
  schema: ProductSchemaPolicy,
): string | null {
  if (!draft.productSchemaVersionId) return "Select an approved Product Schema version.";
  for (const field of schema.fields) {
    if (field.required && !draft.fieldValues[field.id]?.trim()) {
      return `Required field "${field.label}" is empty.`;
    }
  }
  const approved = new Set(draft.approvedClaims.map((value) => value.toLowerCase()));
  for (const claim of draft.prohibitedClaims) {
    if (approved.has(claim.toLowerCase())) {
      return "A Product claim cannot be both approved and prohibited.";
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

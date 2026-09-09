"use client";

import type { StudioFormField } from "@/app/studio/studio-types";

type SchemaFormProps = {
  fields: StudioFormField[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
};

export function SchemaForm({ fields, values, onChange, disabled }: SchemaFormProps) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-5" aria-label="Task agent input form" data-schema-form="true">
      {fields.map((field) => {
        const value = values[field.id] ?? "";
        const setValue = (next: string) => onChange({ ...values, [field.id]: next });
        const common = "mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm";
        return (
          <div key={field.id}>
            <label className="block text-sm font-semibold" htmlFor={field.id}>
              {field.label}
              {!field.required ? (
                <span className="font-normal text-[var(--cc-muted)]"> (optional)</span>
              ) : null}
            </label>
            {field.type === "longText" || field.type === "tags" ? (
              <textarea
                id={field.id}
                value={value}
                disabled={disabled}
                rows={field.type === "tags" ? 4 : 10}
                placeholder={field.placeholder}
                onChange={(event) => setValue(event.target.value)}
                className={`${common} font-mono`}
              />
            ) : field.type === "select" ? (
              <select
                id={field.id}
                value={value}
                disabled={disabled}
                onChange={(event) => setValue(event.target.value)}
                className={common}
              >
                <option value="">Select…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                id={field.id}
                value={value}
                disabled={disabled}
                placeholder={field.placeholder}
                onChange={(event) => setValue(event.target.value)}
                className={common}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function schemaFormComplete(
  fields: StudioFormField[],
  values: Record<string, string>,
): boolean {
  return fields.every((field) => {
    if (!field.required) return true;
    return (values[field.id] ?? "").trim().length > 0;
  });
}

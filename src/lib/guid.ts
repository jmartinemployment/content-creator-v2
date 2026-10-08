/**
 * A GUID as GeekAPI prints one: eight, four, four, four and twelve hex digits. The page shows no
 * identifier but the project's and the labelled Run ID (plans/fix-project-persistence.md, GF6); this
 * is the one definition of what that rule looks for, shared by the run log that keeps identifiers off
 * the screen and the test that checks nothing else put one there.
 */
const GUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** True when the whole string is one GUID. */
export function isGuid(value: string): boolean {
  return new RegExp(`^${GUID_SOURCE}$`, "i").test(value);
}

/** Every GUID in a text, in order of first appearance, lower-cased, each listed once. */
export function findGuids(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(new RegExp(GUID_SOURCE, "gi"))) seen.add(match[0].toLowerCase());
  return [...seen];
}

/** The text with every GUID replaced by `replacement`. */
export function replaceGuids(text: string, replacement: string): string {
  return text.replace(new RegExp(GUID_SOURCE, "gi"), replacement);
}

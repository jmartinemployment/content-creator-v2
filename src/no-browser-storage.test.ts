import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Nothing the operator types lives only in the browser (plans/fix-project-persistence.md, J9, GF6).
 * The brief is loaded from the database and written to it on Save; no source file under src may read
 * or write browser storage.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

test("no source file uses localStorage or sessionStorage", () => {
  const offenders = sourceFiles("src").filter((path) =>
    /\b(localStorage|sessionStorage)\b/.test(readFileSync(path, "utf8")),
  );
  assert.deepEqual(offenders, []);
});

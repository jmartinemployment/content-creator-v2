import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("ContextSelector never shows the Save-before-attach dead-end copy", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/creates/new/context-selector.tsx"),
    "utf8",
  );
  assert.doesNotMatch(source, /Save the create from this review step/);
  assert.match(source, /Preparing this create/);
  assert.match(source, /ensureCreateId/);
});

test("new-create-form keeps pendingCreateId on Back from Review", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/creates/new/new-create-form.tsx"),
    "utf8",
  );
  assert.match(source, /async function ensureCreateId/);
  assert.doesNotMatch(
    source,
    /setToolsPreflight\(null\); setPendingCreateId\(null\); setStep\("outputs"\)/,
  );
});

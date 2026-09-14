import assert from "node:assert/strict";
import test from "node:test";
import {
  geekIqEmptyFieldCopy,
  geekIqKnowledgeEmptyCopy,
  geekIqProductsEmptyCopy,
  isAllGeekIqCatalogsEmpty,
  shouldShowGeekIqFullEmptyState,
} from "../../src/app/creates/new/geek-iq-catalog-ui";

const EMPTY = {
  brandKits: 0,
  audiences: 0,
  styleGuides: 0,
  visualGuidelines: 0,
  knowledge: 0,
  products: 0,
};

test("full empty state when every governed catalog count is zero", () => {
  assert.equal(isAllGeekIqCatalogsEmpty(EMPTY), true);
  assert.equal(shouldShowGeekIqFullEmptyState(EMPTY), true);
});

test("mixed catalogs do not use the full empty panel", () => {
  const mixed = { ...EMPTY, audiences: 1 };
  assert.equal(isAllGeekIqCatalogsEmpty(mixed), false);
  assert.equal(shouldShowGeekIqFullEmptyState(mixed), false);
});

test("empty field copy avoids disabled language and links to Geek IQ", () => {
  const audience = geekIqEmptyFieldCopy("audienceVersionId");
  assert.match(audience.note, /No approved Audience yet/);
  assert.doesNotMatch(audience.note, /disabled|unavailable/i);
  assert.equal(audience.href, "/brand-sources");
  assert.match(audience.linkLabel, /Approve an Audience/);

  const brand = geekIqEmptyFieldCopy("brandKitVersionId");
  assert.match(brand.note, /No approved Brand Voice yet/);
  assert.match(brand.linkLabel, /Approve a Brand Voice/);
});

test("knowledge and products empty notes stay actionable", () => {
  const knowledge = geekIqKnowledgeEmptyCopy();
  assert.match(knowledge.note, /No approved Knowledge/);
  assert.doesNotMatch(knowledge.note, /disabled/i);
  assert.equal(knowledge.href, "/brand-sources");

  const products = geekIqProductsEmptyCopy();
  assert.match(products.note, /No approved Products yet/);
  assert.doesNotMatch(products.note, /available/i);
  assert.match(products.linkLabel, /Approve a Product/);
});

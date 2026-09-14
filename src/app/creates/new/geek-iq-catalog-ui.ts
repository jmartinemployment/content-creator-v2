/** Pure Geek IQ empty/mixed catalog helpers for Create Review (and unit tests). */

export type GeekIqCatalogCounts = {
  brandKits: number;
  audiences: number;
  styleGuides: number;
  visualGuidelines: number;
  knowledge: number;
  products: number;
};

export type GeekIqSingleSelectField =
  | "brandKitVersionId"
  | "audienceVersionId"
  | "styleGuideVersionId"
  | "visualGuidelineVersionId";

export type GeekIqEmptyFieldCopy = {
  label: string;
  note: string;
  href: string;
  linkLabel: string;
};

const BRAND_SOURCES = "/brand-sources";

const SINGLE_SELECT_COPY: Record<GeekIqSingleSelectField, GeekIqEmptyFieldCopy> = {
  brandKitVersionId: {
    label: "Brand Voice",
    note: "No approved Brand Voice yet.",
    href: BRAND_SOURCES,
    linkLabel: "Approve a Brand Voice in Geek IQ",
  },
  audienceVersionId: {
    label: "Audience",
    note: "No approved Audience yet.",
    href: BRAND_SOURCES,
    linkLabel: "Approve an Audience in Geek IQ",
  },
  styleGuideVersionId: {
    label: "Style Guide",
    note: "No approved Style Guide yet.",
    href: BRAND_SOURCES,
    linkLabel: "Approve a Style Guide in Geek IQ",
  },
  visualGuidelineVersionId: {
    label: "Visual Guidelines",
    note: "No approved Visual Guidelines yet.",
    href: BRAND_SOURCES,
    linkLabel: "Approve Visual Guidelines in Geek IQ",
  },
};

export function isAllGeekIqCatalogsEmpty(counts: GeekIqCatalogCounts): boolean {
  return counts.brandKits === 0
    && counts.audiences === 0
    && counts.styleGuides === 0
    && counts.visualGuidelines === 0
    && counts.knowledge === 0
    && counts.products === 0;
}

export function geekIqEmptyFieldCopy(field: GeekIqSingleSelectField): GeekIqEmptyFieldCopy {
  return SINGLE_SELECT_COPY[field];
}

export function geekIqKnowledgeEmptyCopy(): GeekIqEmptyFieldCopy {
  return {
    label: "Additional approved sources",
    note: "No approved Knowledge items yet. Your selected project website is still included.",
    href: BRAND_SOURCES,
    linkLabel: "Approve Knowledge in Geek IQ",
  };
}

export function geekIqProductsEmptyCopy(): GeekIqEmptyFieldCopy {
  return {
    label: "Products",
    note: "No approved Products yet.",
    href: BRAND_SOURCES,
    linkLabel: "Approve a Product in Geek IQ",
  };
}

/** True when every listed catalog is empty — full empty-state panel, not per-field notes. */
export function shouldShowGeekIqFullEmptyState(counts: GeekIqCatalogCounts): boolean {
  return isAllGeekIqCatalogsEmpty(counts);
}

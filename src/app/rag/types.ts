/** Types for GeekAPI POST /api/rag/generate (content-creator-v2 client). */

export type RagWritingIntent =
  | "Technical Article"
  | "Case Study"
  | "Social Ad"
  | "Short Form"
  | "Competitive Battlecard"
  | "Pitch Slides"
  | "Strategy Theme";

export type RagAdTemplate = {
  id: string;
  name: string;
  channel?: string;
  framework?: string;
  body: string;
};

export type RagGenerateRequest = {
  writingIntent: RagWritingIntent;
  topic: string;
  targetEntities?: string[];
  adTemplates?: RagAdTemplate[];
  templateIds?: string[];
  generationStage?: "complete" | "outline" | "section";
  outline?: RagOutlineSection[];
  sectionKey?: string;
  sectionHeading?: string;
  sectionBrief?: string;
  completedSectionSummaries?: string[];
};

export type RagOutlineSection = {
  key: string;
  heading: string;
  brief: string;
};

export type RagGenerateSource = {
  url: string;
  title?: string | null;
  entity?: string | null;
  crawlType?: string | null;
  kind?: string | null;
  pageId?: string | null;
};

export type RagCitation = {
  pageId?: string | null;
  url: string;
  title?: string | null;
  sectionTitle?: string | null;
  quote: string;
  crawlType?: string | null;
};

export type RagThemeSource = {
  label: string;
  relationship?: string | null;
  entity?: string | null;
  url?: string | null;
};

export type RagBattlecard = {
  partnerSummary: string;
  competitorSummary: string;
  differentiators: string[];
  risks: string[];
};

export type RagGenerateResponse = {
  intent: string;
  content?: string | null;
  variations?: string[] | null;
  battlecard?: RagBattlecard | null;
  sources: RagGenerateSource[];
  citations?: RagCitation[] | null;
  themeSources?: RagThemeSource[] | null;
  outline?: RagOutlineSection[] | null;
  appliedTemplates?: RagAdTemplate[] | null;
  warnings?: string[];
  softDisabled?: boolean;
  modelUsed?: string | null;
  retrievalMode?: string | null;
};

export type RagGenerateStatus = {
  available: boolean;
  ragClientEnabled: boolean;
  generateEnabled: boolean;
  reason?: string | null;
  writingIntents: string[];
  entitySeeds: string[];
  longFormModel?: string;
  shortFormModel?: string;
  graphRetrievalAvailable?: boolean;
  adTemplateIndexAvailable?: boolean;
  citeableGenerateAvailable?: boolean;
};

/** Types for GeekAPI RAG library status / templates (Create client). RAG does not generate. */

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

export type RagOutlineSection = {
  key: string;
  heading: string;
  brief: string;
};

export type RagLibraryStatus = {
  available: boolean;
  ragClientEnabled: boolean;
  /** Always false — RAG generate is removed. */
  generateEnabled: boolean;
  reason?: string | null;
  writingIntents: string[];
  entitySeeds: string[];
  longFormModel?: string;
  shortFormModel?: string;
  graphRetrievalAvailable?: boolean;
  adTemplateIndexAvailable?: boolean;
  /**
   * Library ready for Create (query + GeekAPI draft). Not "/v1/generate available".
   * Absent on older GeekAPI — treat missing as ok when `available` is true.
   */
  citeableGenerateAvailable?: boolean;
  modelPolicyVersion?: string | null;
  approvedStageModels?: Record<string, string[]>;
};

/** @deprecated Use {@link RagLibraryStatus}. */
export type RagGenerateStatus = RagLibraryStatus;

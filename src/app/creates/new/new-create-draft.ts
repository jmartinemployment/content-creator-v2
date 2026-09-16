import type { BuyingStage, PrimaryIntent, ToneOfVoice } from "../brief-catalog";
import type { ContentType, PrimaryDraftType } from "../content-types";
import type { ModelPolicySelection } from "../rag-contract";
import type { SiteSectionContext } from "../site-section";
import type { ContextSelectionRequest } from "@/app/brand-sources/context-contract";
import type { SiteHierarchy } from "./site-hierarchy-panel";

/** In-progress Create wizard draft, held in session storage. */
export const NEW_CREATE_DRAFT_KEY = "gcc-v2-new-create-draft";


export type NewCreateWizardStep =
  | "source"
  | "analyzing"
  | "goal"
  | "audience"
  | "research"
  | "outputs"
  | "review";

export type NewCreateDraftV1 = {
  version: 1;
  step: NewCreateWizardStep;
  siteUrlInput: string;
  siteUrl: string;
  forceRecrawl: boolean;
  projectSiteCrawlRunId: string | null;
  section: SiteSectionContext | null;
  title: string;
  primaryDraft: PrimaryDraftType;
  alsoDrafts: ContentType[];
  targetKeyword: string;
  operatorToolsText: string;
  paaQuestionsText: string;
  competitorUrlsText: string;
  writingNotes: string;
  primaryIntent: PrimaryIntent | "";
  buyingStage: BuyingStage | "";
  toneOfVoice: ToneOfVoice | "";
  targetEntities: string[];
  selectedTemplateIds: string[];
  modelPolicy: ModelPolicySelection;
  contextSelection: ContextSelectionRequest;
  pendingCreateId: string | null;
  siteHierarchy: SiteHierarchy | null;
  selectedAgentIds: string[];
};

export function clearNewCreateDraft(): void {
  try {
    sessionStorage.removeItem(NEW_CREATE_DRAFT_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function saveNewCreateDraft(draft: NewCreateDraftV1): void {
  try {
    sessionStorage.setItem(NEW_CREATE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadNewCreateDraft(): NewCreateDraftV1 | null {
  try {
    const raw = sessionStorage.getItem(NEW_CREATE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewCreateDraftV1;
    if (!parsed || parsed.version !== 1 || typeof parsed.step !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function draftHasProgress(draft: NewCreateDraftV1): boolean {
  if (draft.step !== "source" && draft.step !== "analyzing") return true;
  if (draft.section) return true;
  if (draft.projectSiteCrawlRunId) return true;
  if (draft.siteUrl.trim() || draft.siteUrlInput.trim()) return true;
  if (draft.title.trim()) return true;
  if (draft.targetKeyword.trim()) return true;
  if (draft.operatorToolsText.trim()) return true;
  if (draft.competitorUrlsText.trim()) return true;
  if (draft.writingNotes.trim()) return true;
  if (draft.primaryIntent || draft.buyingStage || draft.toneOfVoice) return true;
  if (draft.alsoDrafts.length > 0) return true;
  if (draft.targetEntities.length > 0) return true;
  if (draft.selectedTemplateIds.length > 0) return true;
  if (draft.pendingCreateId) return true;
  if (draft.contextSelection.brandKitVersionId) return true;
  if (draft.contextSelection.audienceVersionId) return true;
  if (draft.contextSelection.styleGuideVersionId) return true;
  if (draft.contextSelection.visualGuidelineVersionId) return true;
  if (draft.contextSelection.knowledgeAssetVersionIds.length > 0) return true;
  if (draft.contextSelection.productSelections.length > 0) return true;
  if (draft.contextSelection.runAttachmentIds.length > 0) return true;
  if ((draft.contextSelection.runNotes ?? "").trim()) return true;
  return false;
}

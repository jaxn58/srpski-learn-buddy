export type Mode = "update" | "replace";
export type Provider = "gemini" | "openai";
export type StageKey = "specialist" | "auditor";
export type ModelTier = "ultra-budget" | "budget" | "balanced" | "premium" | "flagship";
export type NextStepKey = "creator" | "validator" | "lector" | "publish";
export type StepId = "generate" | "qa" | "publish";
export type SectionId = "overview" | "vocabulary" | "grammar" | "phrases" | "exercises" | "cultural";
export type DraftStatusKey = "draft" | "qc_failed" | "qc_passed" | "audit_failed" | "ready_to_publish" | "published";
export type SettingsTab = "ai" | "libraries" | "prompts";
export type StudioView = "draftManager" | "drafts" | "units" | "import";

export type ModelEntry = {
  id: string;
  title: string;
  blurb: string;
  tier: ModelTier;
  inputPricePer1M: number;
  outputPricePer1M: number;
};

export type BatchResult = {
  draftId: string;
  action: string;
  status: "success" | "failed";
  message?: string;
};

export type TranslateDeResult = {
  unitNumber: number;
  previewVersion: number | null;
  timestamp: number;
  info: any;
};

export interface SectionOption {
  value: SectionId;
  label: string;
}

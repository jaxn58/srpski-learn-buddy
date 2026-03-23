import type { DraftStatusKey, ModelEntry, ModelTier, Provider, SectionOption, StageKey } from "./types";

export const MODEL_META: Record<Provider, ModelEntry[]> = {
  gemini: [
    {
      id: "gemini-3.1-pro-preview",
      title: "gemini-3.1-pro-preview",
      blurb: "Top pick for Creator – generates grammatically precise, culturally authentic Serbian learning units with nuanced dialogue and exercises. Best overall language quality. Preview (Feb 2026)",
      tier: "flagship",
      inputPricePer1M: 2.00,
      outputPricePer1M: 12.0,
    },
    {
      id: "gemini-3-flash-preview",
      title: "gemini-3-flash-preview",
      blurb: "Strong choice for Creator – near-Pro language quality at 3x the speed; handles structured Markdown units and vocabulary well. Good Creator/Lector balance. Preview (Dec 2025)",
      tier: "premium",
      inputPricePer1M: 0.50,
      outputPricePer1M: 3.0,
    },
    {
      id: "gemini-2.5-pro",
      title: "gemini-2.5-pro",
      blurb: "Recommended Creator (stable) – proven, reliable unit generation with strong Serbian grammar understanding. Best choice if preview models are too experimental for production. GA",
      tier: "premium",
      inputPricePer1M: 1.25,
      outputPricePer1M: 10.0,
    },
    {
      id: "gemini-2.5-flash",
      title: "gemini-2.5-flash",
      blurb: "Recommended Lector (stable) – fast and accurate at spotting linguistic inconsistencies, grammar errors, and structural issues in generated units. Ideal audit model. GA",
      tier: "balanced",
      inputPricePer1M: 0.30,
      outputPricePer1M: 2.50,
    },
    {
      id: "gemini-3.1-flash-lite-preview",
      title: "gemini-3.1-flash-lite-preview",
      blurb: "Budget Lector option (Gemini 3 generation) – sufficient for lightweight audits and consistency checks; not recommended for primary content creation. Preview (Mar 2026)",
      tier: "budget",
      inputPricePer1M: 0.25,
      outputPricePer1M: 1.50,
    },
    {
      id: "gemini-2.5-flash-lite",
      title: "gemini-2.5-flash-lite",
      blurb: "Minimal Lector only – suitable for basic metadata checks and high-volume passes. Too limited for nuanced language content creation or deep audit. GA",
      tier: "ultra-budget",
      inputPricePer1M: 0.10,
      outputPricePer1M: 0.40,
    },
  ],
  openai: [
    {
      id: "gpt-4.1",
      title: "gpt-4.1",
      blurb: "Latest GPT flagship; 1M context, strong reasoning",
      tier: "premium",
      inputPricePer1M: 2.0,
      outputPricePer1M: 8.0,
    },
    {
      id: "gpt-4o",
      title: "gpt-4o",
      blurb: "Reliable all-rounder; multimodal, great for authoring",
      tier: "balanced",
      inputPricePer1M: 2.50,
      outputPricePer1M: 10.0,
    },
    {
      id: "gpt-4o-mini",
      title: "gpt-4o-mini",
      blurb: "Compact & fast; suitable for audit and simple fixes",
      tier: "budget",
      inputPricePer1M: 0.15,
      outputPricePer1M: 0.60,
    },
    {
      id: "gpt-4.1-nano",
      title: "gpt-4.1-nano",
      blurb: "Ultra-lightweight; lowest cost for high-volume tasks",
      tier: "ultra-budget",
      inputPricePer1M: 0.10,
      outputPricePer1M: 0.40,
    },
  ],
};

export const TIER_BADGE_CONFIG: Record<ModelTier, { label: string; className: string }> = {
  "ultra-budget": { label: "Ultra-Budget", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  "budget":       { label: "Budget",       className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  "balanced":     { label: "Balanced",     className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  "premium":      { label: "Premium",      className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  "flagship":     { label: "Flagship",     className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

export const STAGE_HELP: Record<StageKey, string> = {
  specialist:
    "Creator: generates the full unit as Markdown (Manus-compatible) which is then parsed into unitPackage.v1.",
  auditor:
    "Lector: reviews consistency/risk/obvious issues and can block publishing (structured findings).",
};

export const CONTENT_STUDIO_DIALOG_WIDTH = "w-[98vw] max-w-[98vw] sm:w-[90vw] sm:max-w-[90vw] md:w-[80vw] md:max-w-[80vw]";

export const DRAFT_STATUS_LABEL: Record<DraftStatusKey, string> = {
  draft: "Draft",
  qc_failed: "Validator failed",
  qc_passed: "Validated",
  audit_failed: "Lector flagged issues",
  ready_to_publish: "Ready to publish",
  published: "Published",
};

export const TIER_ORDER: ModelTier[] = ["flagship", "premium", "balanced", "budget", "ultra-budget"];

export const SECTION_OPTIONS: SectionOption[] = [
  { value: "overview", label: "Overview" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "grammar", label: "Grammar" },
  { value: "phrases", label: "Phrases & Dialogues" },
  { value: "exercises", label: "Interactive Test (Exercises)" },
  { value: "cultural", label: "Cultural Note" },
];

export function stageOrderedModels(provider: Provider, stage: StageKey): ModelEntry[] {
  const base = MODEL_META[provider] || [];
  if (stage === "specialist") {
    return [...base].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  }
  return [...base].sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
}

export function isKnownModel(provider: Provider, model: string): boolean {
  return (MODEL_META[provider] || []).some((m) => m.id === model);
}

/**
 * LLM model pricing (USD per 1M tokens).
 *
 * Source of truth for the cost basis used by the Energy admin UI to compute
 * marginal cost per Energy unit and per-tier margin previews. Mirrors:
 *   - Google AI pricing (https://ai.google.dev/gemini-api/docs/pricing)
 *   - OpenAI pricing (https://platform.openai.com/docs/pricing)
 *
 * Verified June 2026. Update via PR whenever Google/OpenAI publishes new
 * prices — there is no runtime override (admin UI shows these read-only).
 *
 * Notes:
 *   - Gemini 2.5 Pro pricing is tiered by prompt size (≤200k vs >200k tokens).
 *     We list the entry-level tariff (≤200k) which covers our typical chat
 *     payloads; if/when we hit the high-context tier regularly, add a separate
 *     entry or expose a context-size selector in the admin UI.
 *   - "Cached input" is intentionally ignored — context caching adds another
 *     dimension and is not used uniformly across our endpoints.
 */

export type ModelPricing = {
  /** Display label for the admin UI. */
  displayName: string;
  /** Input token price per 1M tokens (USD, paid tier). */
  inputUsdPer1M: number;
  /** Output token price per 1M tokens (USD, paid tier). */
  outputUsdPer1M: number;
  /** Provider key (matches chatAiConfig.primaryProvider). */
  provider: "google" | "openai";
};

/**
 * When the entire pricing table was last verified against the official docs.
 * Update this date together with any price change in this file. The admin UI
 * shows a "stale pricing" warning once this is older than
 * `PRICING_STALENESS_WARN_DAYS` and a hard reminder past
 * `PRICING_STALENESS_ALERT_DAYS`.
 *
 * Format: ISO 8601 (YYYY-MM-DD). Last verified June 2026 against
 * https://ai.google.dev/gemini-api/docs/pricing and
 * https://platform.openai.com/docs/pricing.
 */
export const PRICING_LAST_VERIFIED_AT = "2026-06-15";

/** Days until the admin UI shows an amber "may be outdated" hint. */
export const PRICING_STALENESS_WARN_DAYS = 90;

/** Days until the hint escalates to a red "please verify" reminder. */
export const PRICING_STALENESS_ALERT_DAYS = 180;

/** Official pricing documentation URLs — surfaced in the admin UI so a
 *  superadmin can verify and (if needed) request an update PR. */
export const PRICING_SOURCE_URLS = {
  google: "https://ai.google.dev/gemini-api/docs/pricing",
  openai: "https://platform.openai.com/docs/pricing",
} as const;

/**
 * Verified model pricing table. Add entries here when supporting new models in
 * convex/ai/chatConfig.ts.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ===== Google Gemini =====
  "gemini-2.5-flash": {
    displayName: "Gemini 2.5 Flash",
    inputUsdPer1M: 0.30,
    outputUsdPer1M: 2.50,
    provider: "google",
  },
  "gemini-2.5-flash-lite": {
    displayName: "Gemini 2.5 Flash-Lite",
    inputUsdPer1M: 0.10,
    outputUsdPer1M: 0.40,
    provider: "google",
  },
  "gemini-2.5-pro": {
    displayName: "Gemini 2.5 Pro (\u2264200k ctx)",
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10.00,
    provider: "google",
  },

  // ===== OpenAI =====
  "gpt-4o-mini": {
    displayName: "GPT-4o Mini",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.60,
    provider: "openai",
  },
  "gpt-4o": {
    displayName: "GPT-4o",
    inputUsdPer1M: 2.50,
    outputUsdPer1M: 10.00,
    provider: "openai",
  },
  "gpt-4.1-mini": {
    displayName: "GPT-4.1 Mini",
    inputUsdPer1M: 0.40,
    outputUsdPer1M: 1.60,
    provider: "openai",
  },
  "gpt-4.1-nano": {
    displayName: "GPT-4.1 Nano",
    inputUsdPer1M: 0.10,
    outputUsdPer1M: 0.40,
    provider: "openai",
  },
};

/**
 * Average token mix per "1 Energy" unit, derived from the worst-case figures
 * in docs/restructure/03_PREISKALKULATION.md §2.1.
 *
 * Two scenarios:
 *   - `typical`: balanced answer with RAG context (~3 Energy ≈ 2500 in / 800 out)
 *   - `worstCase`: detailed answer with full context (~4 Energy ≈ 5000 in / 2048 out)
 *
 * The admin Live-Kalkulator uses both to show a typical-cost and
 * worst-case-cost band per Energy.
 */
export const DEFAULT_AVG_TOKENS_PER_ENERGY = {
  typical: { input: 833, output: 267 },
  worstCase: { input: 1250, output: 512 },
} as const;

/** Fallback pricing used when a model name is not (yet) listed above. */
export const FALLBACK_MODEL_PRICING: ModelPricing = {
  displayName: "Unknown model (using Gemini 2.5 Flash fallback)",
  inputUsdPer1M: 0.30,
  outputUsdPer1M: 2.50,
  provider: "google",
};

/** Resolve pricing for a given model name; falls back to a safe default. */
export function getModelPricing(modelName: string): ModelPricing {
  return MODEL_PRICING[modelName] ?? FALLBACK_MODEL_PRICING;
}

/**
 * Derive USD cost for "1 Energy" given a model and an assumed token mix.
 * Pure function — used both server-side (getEnergyEconomics) and as a
 * reference implementation for the admin UI (live preview).
 */
export function usdPerEnergy(
  pricing: Pick<ModelPricing, "inputUsdPer1M" | "outputUsdPer1M">,
  tokens: { input: number; output: number }
): number {
  return (
    (tokens.input * pricing.inputUsdPer1M +
      tokens.output * pricing.outputUsdPer1M) /
    1_000_000
  );
}

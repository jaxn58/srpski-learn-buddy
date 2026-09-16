/**
 * Model capability helpers for the Content Studio AI calls.
 *
 * Pure functions, no Convex imports, so they can be unit-tested and reused by
 * the model evaluation script.
 *
 * Source of truth for the rules below is the official Gemini documentation
 * (verified 2026-09-16):
 *   - https://ai.google.dev/gemini-api/docs/openai  ("Thinking" section)
 *   - https://ai.google.dev/gemini-api/docs/models
 *
 * Key facts:
 *   - Every Gemini 2.5 and Gemini 3.x model is a thinking model. Thinking
 *     tokens are billed as output tokens and count towards `max_tokens`, so
 *     the completion budget must be inflated or the answer is truncated with
 *     `finish_reason=length`.
 *   - `reasoning_effort: "none"` (thinking off) is ONLY accepted by Gemini 2.5
 *     Flash / Flash-Lite. Gemini 2.5 Pro and all Gemini 3.x models reject it.
 *   - `reasoning_effort: low | medium | high` maps to `thinking_level`
 *     (Gemini 3.x) or `thinking_budget` (Gemini 2.5) and is accepted by all
 *     thinking models.
 */

export type ReasoningEffort = "none" | "low" | "medium" | "high";

/** Multiplier applied to the requested completion budget for thinking models. */
export const THINKING_MAX_TOKENS_MULTIPLIER = 4;

/** Lower bound for the inflated completion budget of thinking models. */
export const THINKING_MAX_TOKENS_FLOOR = 16_384;

const GEMINI_THINKING_FAMILY = /^gemini-(?:2\.5|3)(?:[.-]|$)/;
const GEMINI_THINKING_OFF_ALLOWED = /^gemini-2\.5-flash(?:-lite)?(?:-|$)/;

function normalizeModel(model: string): string {
  return String(model || "").trim().toLowerCase();
}

/**
 * True for every Gemini model that runs with internal thinking
 * (2.5 Flash, 2.5 Flash-Lite, 2.5 Pro, 3 Flash, 3.1 Pro, 3.5 ... 3.8 Flash, ...).
 */
export function isGeminiThinkingModel(provider: string, model: string): boolean {
  if (provider !== "gemini") return false;
  return GEMINI_THINKING_FAMILY.test(normalizeModel(model));
}

/**
 * True only for models where thinking can be switched off via
 * `reasoning_effort: "none"` (Gemini 2.5 Flash and 2.5 Flash-Lite, including
 * dated preview variants such as `gemini-2.5-flash-preview-09-2025`).
 */
export function supportsThinkingOff(provider: string, model: string): boolean {
  if (provider !== "gemini") return false;
  return GEMINI_THINKING_OFF_ALLOWED.test(normalizeModel(model));
}

/**
 * Build the OpenAI-compat request fields that control thinking for the given
 * model. Returns an empty object when nothing should be sent (non-Gemini
 * provider, non-thinking model, or an unsupported "none" request).
 */
export function buildReasoningParams(
  provider: string,
  model: string,
  reasoningEffort: ReasoningEffort | undefined,
): { reasoning_effort?: ReasoningEffort } {
  if (!reasoningEffort) return {};
  if (!isGeminiThinkingModel(provider, model)) return {};
  if (reasoningEffort === "none") {
    return supportsThinkingOff(provider, model) ? { reasoning_effort: "none" } : {};
  }
  return { reasoning_effort: reasoningEffort };
}

/**
 * Effective `max_tokens` for a request. Thinking models get an inflated budget
 * unless thinking was successfully disabled for that model.
 */
export function effectiveMaxTokens(params: {
  provider: string;
  model: string;
  requestedMaxTokens: number | undefined;
  defaultMaxTokens: number;
  reasoningEffort: ReasoningEffort | undefined;
}): number {
  const base =
    typeof params.requestedMaxTokens === "number" && params.requestedMaxTokens > 0
      ? params.requestedMaxTokens
      : params.defaultMaxTokens;
  if (!isGeminiThinkingModel(params.provider, params.model)) return base;
  const thinkingDisabled =
    params.reasoningEffort === "none" && supportsThinkingOff(params.provider, params.model);
  if (thinkingDisabled) return base;
  return Math.max(base * THINKING_MAX_TOKENS_MULTIPLIER, THINKING_MAX_TOKENS_FLOOR);
}

import { describe, it, expect } from "vitest";
import {
  buildReasoningParams,
  effectiveMaxTokens,
  isGeminiThinkingModel,
  supportsThinkingOff,
  THINKING_MAX_TOKENS_FLOOR,
  THINKING_MAX_TOKENS_MULTIPLIER,
} from "../../convex/contentStudio/_modelCapabilities";

/**
 * Locks the Gemini thinking rules used by callAiJson/callAiText:
 *   - all 2.5 and 3.x models think (budget must be inflated),
 *   - thinking can only be switched off on 2.5 Flash / Flash-Lite,
 *   - non-Gemini providers never receive reasoning params.
 * Reference: https://ai.google.dev/gemini-api/docs/openai (Thinking section).
 */

const THINKING_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
];

const THINKING_OFF_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-preview-09-2025"];

describe("isGeminiThinkingModel", () => {
  it.each(THINKING_MODELS)("treats %s as a thinking model", (model) => {
    expect(isGeminiThinkingModel("gemini", model)).toBe(true);
  });

  it("does not treat legacy 2.0 / 1.5 models as thinking models", () => {
    expect(isGeminiThinkingModel("gemini", "gemini-2.0-flash")).toBe(false);
    expect(isGeminiThinkingModel("gemini", "gemini-1.5-flash")).toBe(false);
  });

  it("ignores non-Gemini providers regardless of model name", () => {
    expect(isGeminiThinkingModel("openai", "gemini-2.5-pro")).toBe(false);
    expect(isGeminiThinkingModel("openai", "gpt-4o")).toBe(false);
  });
});

describe("supportsThinkingOff", () => {
  it.each(THINKING_OFF_MODELS)("allows thinking off for %s", (model) => {
    expect(supportsThinkingOff("gemini", model)).toBe(true);
  });

  it.each(THINKING_MODELS.filter((m) => !THINKING_OFF_MODELS.includes(m)))(
    "rejects thinking off for %s",
    (model) => {
      expect(supportsThinkingOff("gemini", model)).toBe(false);
    }
  );
});

describe("buildReasoningParams", () => {
  it("returns nothing when no effort is requested", () => {
    expect(buildReasoningParams("gemini", "gemini-3.8-flash", undefined)).toEqual({});
  });

  it("passes low/medium/high through for every thinking model", () => {
    for (const model of THINKING_MODELS) {
      expect(buildReasoningParams("gemini", model, "low")).toEqual({ reasoning_effort: "low" });
      expect(buildReasoningParams("gemini", model, "high")).toEqual({ reasoning_effort: "high" });
    }
  });

  it("sends none only where the model supports it", () => {
    expect(buildReasoningParams("gemini", "gemini-2.5-flash", "none")).toEqual({ reasoning_effort: "none" });
    expect(buildReasoningParams("gemini", "gemini-2.5-pro", "none")).toEqual({});
    expect(buildReasoningParams("gemini", "gemini-3.8-flash", "none")).toEqual({});
    expect(buildReasoningParams("gemini", "gemini-3.1-pro-preview", "none")).toEqual({});
  });

  it("never sends reasoning params to OpenAI", () => {
    expect(buildReasoningParams("openai", "gpt-4o", "low")).toEqual({});
    expect(buildReasoningParams("openai", "gpt-4o-mini", "none")).toEqual({});
  });
});

describe("effectiveMaxTokens", () => {
  const base = { requestedMaxTokens: 3000, defaultMaxTokens: 2500, reasoningEffort: undefined };

  it("inflates the budget for thinking models", () => {
    for (const model of THINKING_MODELS) {
      const result = effectiveMaxTokens({ ...base, provider: "gemini", model });
      expect(result).toBe(Math.max(3000 * THINKING_MAX_TOKENS_MULTIPLIER, THINKING_MAX_TOKENS_FLOOR));
    }
  });

  it("applies the floor for small requests on thinking models", () => {
    const result = effectiveMaxTokens({ ...base, provider: "gemini", model: "gemini-3.8-flash", requestedMaxTokens: 800 });
    expect(result).toBe(THINKING_MAX_TOKENS_FLOOR);
  });

  it("keeps the requested budget when thinking is disabled on a model that supports it", () => {
    const result = effectiveMaxTokens({
      ...base,
      provider: "gemini",
      model: "gemini-2.5-flash",
      reasoningEffort: "none",
    });
    expect(result).toBe(3000);
  });

  it("still inflates when none is requested but not supported (Pro, 3.x)", () => {
    for (const model of ["gemini-2.5-pro", "gemini-3.8-flash", "gemini-3.1-pro-preview"]) {
      const result = effectiveMaxTokens({ ...base, provider: "gemini", model, reasoningEffort: "none" });
      expect(result).toBe(THINKING_MAX_TOKENS_FLOOR);
    }
  });

  it("uses the default when no explicit budget is requested and never inflates OpenAI", () => {
    expect(effectiveMaxTokens({ ...base, provider: "openai", model: "gpt-4o", requestedMaxTokens: undefined })).toBe(2500);
    expect(effectiveMaxTokens({ ...base, provider: "openai", model: "gpt-4o" })).toBe(3000);
  });
});

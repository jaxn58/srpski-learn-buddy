import { describe, it, expect } from "vitest";
import {
  DEFAULT_VOCABULARY_BUDGET,
  MAX_VOCABULARY_BUDGET,
  MIN_VOCABULARY_BUDGET,
  parseVocabularyBudget,
  resolveVocabularyBudget,
  vocabularyBudgetOverrun,
} from "../../shared/contentStudio/vocabularyBudget";
import { parseBriefText, renderBriefText } from "../../shared/contentStudio/briefTemplate";

describe("parseVocabularyBudget", () => {
  it("reads plain numbers and numeric strings", () => {
    expect(parseVocabularyBudget(40)).toBe(40);
    expect(parseVocabularyBudget("40")).toBe(40);
    expect(parseVocabularyBudget("  30  ")).toBe(30);
  });

  it("tolerates the ways an author writes it down", () => {
    expect(parseVocabularyBudget("40 words")).toBe(40);
    expect(parseVocabularyBudget("ca. 30")).toBe(30);
    expect(parseVocabularyBudget("30-35")).toBe(30);
  });

  it("returns undefined for unusable input so callers fall through", () => {
    expect(parseVocabularyBudget("")).toBeUndefined();
    expect(parseVocabularyBudget("   ")).toBeUndefined();
    expect(parseVocabularyBudget(undefined)).toBeUndefined();
    expect(parseVocabularyBudget(null)).toBeUndefined();
    expect(parseVocabularyBudget("as many as needed")).toBeUndefined();
    expect(parseVocabularyBudget(Number.NaN)).toBeUndefined();
  });

  it("clamps out-of-range values instead of rejecting them", () => {
    expect(parseVocabularyBudget(1)).toBe(MIN_VOCABULARY_BUDGET);
    expect(parseVocabularyBudget(9999)).toBe(MAX_VOCABULARY_BUDGET);
    expect(parseVocabularyBudget(34.6)).toBe(35);
  });
});

describe("resolveVocabularyBudget", () => {
  it("prefers the per-unit value from the briefing", () => {
    expect(resolveVocabularyBudget({ brief: "40", settings: 30 })).toEqual({ budget: 40, source: "brief" });
  });

  it("falls back to the studio setting", () => {
    expect(resolveVocabularyBudget({ brief: "", settings: 30 })).toEqual({ budget: 30, source: "settings" });
    expect(resolveVocabularyBudget({ settings: 30 })).toEqual({ budget: 30, source: "settings" });
  });

  it("falls back to the default when nothing is configured", () => {
    expect(resolveVocabularyBudget({})).toEqual({
      budget: DEFAULT_VOCABULARY_BUDGET,
      source: "default",
    });
  });
});

describe("vocabularyBudgetOverrun", () => {
  it("reports only a real overrun", () => {
    expect(vocabularyBudgetOverrun(29, 35)).toBeNull();
    expect(vocabularyBudgetOverrun(35, 35)).toBeNull();
    expect(vocabularyBudgetOverrun(40, 35)).toEqual({ count: 40, budget: 35, over: 5 });
  });

  it("stays silent on unusable numbers", () => {
    expect(vocabularyBudgetOverrun(Number.NaN, 35)).toBeNull();
    expect(vocabularyBudgetOverrun(40, Number.NaN)).toBeNull();
  });
});

describe("briefing field round-trip", () => {
  it("renders and parses the budget line", () => {
    const text = renderBriefText({
      moduleNumber: 1,
      fields: {
        unitType: "standard",
        cefrLevel: "A1.1",
        strand: "ARR",
        setting: "serbia",
        situation: "Arrival in Belgrade.",
        vocabularyBudget: "40",
      },
    });
    expect(text).toContain("Vocabulary budget: 40");

    const parsed = parseBriefText(text);
    expect(parsed.recognized).toBe(true);
    expect(parsed.fields.vocabularyBudget).toBe("40");
    expect(resolveVocabularyBudget({ brief: parsed.fields.vocabularyBudget, settings: 30 }).budget).toBe(40);
  });

  it("omits the line when the author left it empty", () => {
    const text = renderBriefText({
      moduleNumber: 1,
      fields: { unitType: "standard", cefrLevel: "A1.1", strand: "ARR", setting: "serbia" },
    });
    expect(text).not.toContain("Vocabulary budget");
    expect(parseBriefText(text).fields.vocabularyBudget).toBeUndefined();
  });

  it("keeps legacy briefs without the field working", () => {
    const legacy = [
      "Module: 1",
      "Unit type: standard",
      "CEFR Level: A1.1",
      "Strand: ARR – Arrival & Travel",
      "Setting: Serbia (dinars)",
    ].join("\n");
    const parsed = parseBriefText(legacy);
    expect(parsed.recognized).toBe(true);
    expect(parsed.fields.vocabularyBudget).toBeUndefined();
    expect(resolveVocabularyBudget({ brief: parsed.fields.vocabularyBudget, settings: undefined }).source).toBe("default");
  });
});

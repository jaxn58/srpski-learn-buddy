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
import {
  buildSectionQaOverrideBlock,
  collectSectionQaOverridesFromExisting,
  exercisesOverrideAsksForMoreThanFoundation,
  normalizeSectionQaOverrides,
  requestedExerciseQuestionCount,
  shouldSuppressQaFinding,
} from "../../shared/contentStudio/sectionQaOverrides";

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

const exercises8 = {
  id: "1",
  sectionId: "exercises",
  instruction: "Make 8 questions per category instead of 6.",
  createdAt: 1,
};

describe("section QA overrides", () => {
  it("keeps valid override rows in createdAt order", () => {
    const list = normalizeSectionQaOverrides([
      { id: "b", sectionId: "grammar", instruction: "shorten examples", createdAt: 20 },
      { id: "a", sectionId: "exercises", instruction: "8 questions", createdAt: 10 },
    ]);
    expect(list.map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("reads the highest explicit exercise question count", () => {
    expect(requestedExerciseQuestionCount([exercises8])).toBe(8);
  });

  it("suppresses the foundation question-count warning only when asked", () => {
    const countWarning =
      "Exercise category 'translation' has 8 questions, exceeding the recommended maximum of 6 items per category for micro-units.";
    expect(
      shouldSuppressQaFinding({
        message: countWarning,
        path: "exercises.en[category=translation]",
        severity: "warning",
        overrides: [exercises8],
      }),
    ).toBe(true);
    expect(
      shouldSuppressQaFinding({
        message: countWarning,
        path: "exercises.en[category=translation]",
        severity: "warning",
        overrides: [],
      }),
    ).toBe(false);
    expect(exercisesOverrideAsksForMoreThanFoundation([exercises8])).toBe(true);
    expect(buildSectionQaOverrideBlock([exercises8])).toContain("8 questions");
  });

  it("never softens the foundation without an explicit higher count", () => {
    const countWarning =
      "Exercise category 'translation' has 8 questions, exceeding the recommended maximum of 6 items per category for micro-units.";
    const vague = {
      id: "2",
      sectionId: "exercises",
      instruction: "Add more questions and make them harder.",
      createdAt: 2,
    };
    const grammarOnly = {
      id: "3",
      sectionId: "grammar",
      instruction: "Shorten the examples.",
      createdAt: 3,
    };
    expect(requestedExerciseQuestionCount([vague])).toBeNull();
    expect(exercisesOverrideAsksForMoreThanFoundation([vague])).toBe(false);
    expect(
      shouldSuppressQaFinding({
        message: countWarning,
        path: "exercises.en[category=translation]",
        severity: "warning",
        overrides: [vague],
      }),
    ).toBe(false);
    expect(
      shouldSuppressQaFinding({
        message: countWarning,
        path: "exercises.en[category=translation]",
        severity: "warning",
        overrides: [grammarOnly],
      }),
    ).toBe(false);
    expect(
      shouldSuppressQaFinding({
        message: countWarning,
        path: "exercises.en[category=translation]",
        severity: "error",
        overrides: [exercises8],
      }),
    ).toBe(false);
    expect(
      shouldSuppressQaFinding({
        message: "Serbian word 'sira' is used in this unit but missing from the vocabulary table.",
        path: "vocabulary",
        severity: "warning",
        overrides: [exercises8],
      }),
    ).toBe(false);
  });

  it("reads the instruction already stored on briefing and pending revise", () => {
    const fromBrief = collectSectionQaOverridesFromExisting({
      curatedSections: [
        { section: "exercises", instruction: "Make 8 questions per category.", adoptedAt: 10 },
      ],
    });
    expect(fromBrief).toHaveLength(1);
    expect(requestedExerciseQuestionCount(fromBrief)).toBe(8);

    const pendingWins = collectSectionQaOverridesFromExisting({
      curatedSections: [
        { section: "exercises", instruction: "Keep 6 questions.", adoptedAt: 10 },
      ],
      pendingRevisions: [
        { section: "exercises", instruction: "Make 8 questions per category.", at: 20 },
      ],
    });
    expect(pendingWins[0]?.instruction).toContain("8 questions");
  });
});

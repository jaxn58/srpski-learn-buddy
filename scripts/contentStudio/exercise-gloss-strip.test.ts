import { describe, it, expect } from "vitest";
import {
  stripTrailingParentheticalGlosses,
  findUnwantedExerciseGlossIssues,
  findMissingOrUntranslatedFillInCueIssues,
  isSerbianStemExerciseType,
  isFillInSourceCue,
  isHelpTranslationGloss,
} from "../../convex/contentStudio/_translationCore";
import {
  runDeterministicTestGlossChecks,
  type VerifierInputItem,
} from "../../convex/contentStudio/_verifier";

describe("isFillInSourceCue / isHelpTranslationGloss", () => {
  it("classifies short fill-in cues", () => {
    expect(isFillInSourceCue("milk")).toBe(true);
    expect(isFillInSourceCue("Äpfel")).toBe(true);
    expect(isFillInSourceCue("one o'clock")).toBe(true);
    expect(isHelpTranslationGloss("milk")).toBe(false);
  });

  it("classifies sentence help glosses", () => {
    expect(isFillInSourceCue("It is one o'clock now.")).toBe(false);
    expect(isHelpTranslationGloss("It is one o'clock now.")).toBe(true);
    expect(isFillInSourceCue("Ana is a _____.")).toBe(false);
    expect(isHelpTranslationGloss("Ana is a _____.")).toBe(true);
  });
});

describe("stripTrailingParentheticalGlosses", () => {
  it("removes German help after Serbian stem", () => {
    const input =
      "Ana je _____. Ona radi u bolnici. (Ana ist eine _____. Sie arbeitet in einem Krankenhaus.)";
    expect(stripTrailingParentheticalGlosses(input)).toBe(
      "Ana je _____. Ona radi u bolnici."
    );
  });

  it("removes English sentence gloss from fill-in-blank style", () => {
    expect(
      stripTrailingParentheticalGlosses("Sada je jedan _____. (It is one o'clock now.)")
    ).toBe("Sada je jedan _____.");
  });

  it("keeps short fill-in source cues", () => {
    expect(stripTrailingParentheticalGlosses("Molim vas, jedan litar ___. (milk)")).toBe(
      "Molim vas, jedan litar ___. (milk)"
    );
    expect(stripTrailingParentheticalGlosses("Molim vas, jedan litar ___. (Milch)")).toBe(
      "Molim vas, jedan litar ___. (Milch)"
    );
  });

  it("leaves German-only MC prompts unchanged", () => {
    const q = "Marija ist aus Frankreich. Sie ist _____.";
    expect(stripTrailingParentheticalGlosses(q)).toBe(q);
  });
});

describe("findUnwantedExerciseGlossIssues", () => {
  it("flags leftover DE gloss on multipleChoice", () => {
    const issues = findUnwantedExerciseGlossIssues([
      {
        questionId: "u2_ex3_q18",
        questionType: "multipleChoice",
        questionEn: "Ana je _____. (Ana is a _____.)",
        questionDe: "Ana je _____. (Ana ist eine _____.)",
      },
    ]);
    expect(issues.length).toBe(1);
    expect(issues[0]).toContain("parenthetical help");
  });

  it("does not flag German fill-in cues", () => {
    const issues = findUnwantedExerciseGlossIssues([
      {
        questionId: "u5_ex2_q01",
        questionType: "fillInBlank",
        questionEn: "Molim vas, jedan litar ___. (milk)",
        questionDe: "Molim vas, jedan litar ___. (Milch)",
      },
    ]);
    expect(issues).toHaveLength(0);
  });

  it("passes when help glosses are stripped", () => {
    const issues = findUnwantedExerciseGlossIssues([
      {
        questionId: "u2_ex3_q18",
        questionType: "multipleChoice",
        questionEn: "Ana je _____. (Ana is a _____.)",
        questionDe: "Ana je _____.",
      },
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe("findMissingOrUntranslatedFillInCueIssues", () => {
  it("flags missing German cue", () => {
    const issues = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u5_ex2_q01",
        questionType: "fillInBlank",
        questionEn: "Molim vas, jedan litar ___. (milk)",
        questionDe: "Molim vas, jedan litar ___.",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("fill-in source cue missing");
  });

  it("flags English cue left untranslated", () => {
    const issues = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u5_ex2_q01",
        questionType: "fillInBlank",
        questionEn: "Molim vas, jedan litar ___. (milk)",
        questionDe: "Molim vas, jedan litar ___. (milk)",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("still English");
  });

  it("passes when cue is German", () => {
    const issues = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u5_ex2_q01",
        questionType: "fillInBlank",
        questionEn: "Molim vas, jedan litar ___. (milk)",
        questionDe: "Molim vas, jedan litar ___. (Milch)",
      },
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe("runDeterministicTestGlossChecks", () => {
  it("flags leftover German gloss help", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u2",
        kind: "test",
        label: "test u2",
        questionType: "multipleChoice",
        serbian: "Expected Serbian answer: lekarka",
        english: "Question (EN): Ana je _____. (Ana is a _____.)",
        german:
          "Question (DE): Ana je _____. Ona radi u bolnici. (Ana ist eine _____. Sie arbeitet in einem Krankenhaus.)",
      },
    ];
    const issues = runDeterministicTestGlossChecks(items);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("test_unwanted_parenthetical_gloss");
  });

  it("does not flag clean Serbian stem", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u2b",
        kind: "test",
        label: "test u2b",
        questionType: "multipleChoice",
        serbian: "Expected Serbian answer: lekarka",
        english: "Question (EN): Ana je _____. (Ana is a _____.)",
        german: "Question (DE): Ana je _____. Ona radi u bolnici.",
      },
    ];
    expect(runDeterministicTestGlossChecks(items)).toHaveLength(0);
  });

  it("flags missing fill-in cue on DE", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u5_ex2_q01",
        kind: "test",
        label: "test u5_ex2_q01",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: mleka",
        english: "Question (EN): Molim vas, jedan litar ___. (milk)",
        german: "Question (DE): Molim vas, jedan litar ___.",
      },
    ];
    const issues = runDeterministicTestGlossChecks(items);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("test_missing_fill_in_cue");
  });

  it("does not flag German fill-in cue", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u5_ex2_q01b",
        kind: "test",
        label: "test u5_ex2_q01b",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: mleka",
        english: "Question (EN): Molim vas, jedan litar ___. (milk)",
        german: "Question (DE): Molim vas, jedan litar ___. (Milch)",
      },
    ];
    expect(runDeterministicTestGlossChecks(items)).toHaveLength(0);
  });
});

describe("isSerbianStemExerciseType", () => {
  it("covers fillInBlank dialogue multipleChoice", () => {
    expect(isSerbianStemExerciseType("fillInBlank")).toBe(true);
    expect(isSerbianStemExerciseType("dialogue")).toBe(true);
    expect(isSerbianStemExerciseType("multipleChoice")).toBe(true);
    expect(isSerbianStemExerciseType("translation")).toBe(false);
  });
});

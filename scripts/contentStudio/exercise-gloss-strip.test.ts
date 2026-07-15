import { describe, it, expect } from "vitest";
import {
  stripTrailingParentheticalGlosses,
  findUnwantedExerciseGlossIssues,
  isSerbianStemExerciseType,
} from "../../convex/contentStudio/_translationCore";
import {
  runDeterministicTestGlossChecks,
  type VerifierInputItem,
} from "../../convex/contentStudio/_verifier";

describe("stripTrailingParentheticalGlosses", () => {
  it("removes German help after Serbian stem", () => {
    const input =
      "Ana je _____. Ona radi u bolnici. (Ana ist eine _____. Sie arbeitet in einem Krankenhaus.)";
    expect(stripTrailingParentheticalGlosses(input)).toBe(
      "Ana je _____. Ona radi u bolnici."
    );
  });

  it("removes English gloss from fill-in-blank style", () => {
    expect(
      stripTrailingParentheticalGlosses("Sada je jedan _____. (It is one o'clock now.)")
    ).toBe("Sada je jedan _____.");
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

  it("passes when glosses are stripped", () => {
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
});

describe("isSerbianStemExerciseType", () => {
  it("covers fillInBlank dialogue multipleChoice", () => {
    expect(isSerbianStemExerciseType("fillInBlank")).toBe(true);
    expect(isSerbianStemExerciseType("dialogue")).toBe(true);
    expect(isSerbianStemExerciseType("multipleChoice")).toBe(true);
    expect(isSerbianStemExerciseType("translation")).toBe(false);
  });
});

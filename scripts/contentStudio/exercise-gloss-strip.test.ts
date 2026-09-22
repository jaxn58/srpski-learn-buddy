import { describe, it, expect } from "vitest";
import {
  stripTrailingParentheticalGlosses,
  findUnwantedExerciseGlossIssues,
  findMissingOrUntranslatedFillInCueIssues,
  findMissingFillInContextGlossIssues,
  isSerbianStemExerciseType,
  isFillInSourceCue,
  isHelpTranslationGloss,
} from "../../convex/contentStudio/_translationCore";
import {
  dropAiIssuesThatBreakExerciseGlossContract,
  runDeterministicTestGlossChecks,
  type VerifierInputItem,
  type VerifierIssue,
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

  it("does not flag German fill-in context glosses", () => {
    const issues = findUnwantedExerciseGlossIssues([
      {
        questionId: "u1_ex2_q01",
        questionType: "fillInBlank",
        questionEn: "Ja ____ Ana. (I am Ana.)",
        questionDe: "Ja ____ Ana. (Ich bin Ana.)",
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

describe("findMissingFillInContextGlossIssues", () => {
  it("flags missing German context gloss", () => {
    const issues = findMissingFillInContextGlossIssues([
      {
        questionId: "u1_ex2_q01",
        questionType: "fillInBlank",
        questionEn: "Ja ____ Ana. (I am Ana.)",
        questionDe: "Ja ____ Ana.",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("fill-in context gloss missing");
  });

  it("flags English context gloss left untranslated", () => {
    const issues = findMissingFillInContextGlossIssues([
      {
        questionId: "u1_ex2_q01",
        questionType: "fillInBlank",
        questionEn: "Ja ____ Ana. (I am Ana.)",
        questionDe: "Ja ____ Ana. (I am Ana.)",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("still English");
  });

  it("passes when context gloss is German", () => {
    const issues = findMissingFillInContextGlossIssues([
      {
        questionId: "u1_ex2_q01",
        questionType: "fillInBlank",
        questionEn: "Ja ____ Ana. (I am Ana.)",
        questionDe: "Ja ____ Ana. (Ich bin Ana.)",
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

  it("flags missing fill-in context gloss on DE", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u1_ex2_q01",
        kind: "test",
        label: "test u1_ex2_q01",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: sam",
        english: "Question (EN): Ja ____ Ana. (I am Ana.)",
        german: "Question (DE): Ja ____ Ana.",
      },
    ];
    const issues = runDeterministicTestGlossChecks(items);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("test_missing_context_gloss");
  });

  it("does not flag German fill-in context gloss", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u1_ex2_q01b",
        kind: "test",
        label: "test u1_ex2_q01b",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: sam",
        english: "Question (EN): Ja ____ Ana. (I am Ana.)",
        german: "Question (DE): Ja ____ Ana. (Ich bin Ana.)",
      },
    ];
    expect(runDeterministicTestGlossChecks(items)).toHaveLength(0);
  });
});

describe("dropAiIssuesThatBreakExerciseGlossContract", () => {
  const mcItem: VerifierInputItem = {
    key: "test:u1_ex3_q04",
    kind: "test",
    label: "test u1_ex3_q04",
    questionType: "multipleChoice",
    serbian: "Expected Serbian answer: nisam",
    english: "Question (EN): Ja _____ putnik. (I am not a traveler.)",
    german: "Question (DE): Ja _____ putnik.",
  };

  const fillItem: VerifierInputItem = {
    key: "test:u1_ex2_q01",
    kind: "test",
    label: "test u1_ex2_q01",
    questionType: "fillInBlank",
    serbian: "Expected Serbian answer: sam",
    english: "Question (EN): Ja ____ Ana. (I am Ana.)",
    german: "Question (DE): Ja ____ Ana. (Ich bin Ana.)",
  };

  it("drops the Unit-1 MC missing-gloss critical", () => {
    const issues: VerifierIssue[] = [
      {
        itemKey: "test:u1_ex3_q04",
        itemLabel: "test u1_ex3_q04",
        itemKind: "test",
        severity: "critical",
        code: "missing_info",
        issue:
          "The German question is missing the context gloss ('I am not a traveler.') which helps the learner understand the meaning of the sentence.",
        suggestion: "Ja _____ putnik. (Ich bin kein Reisender)",
      },
    ];
    const { kept, dropped } = dropAiIssuesThatBreakExerciseGlossContract(issues, [mcItem]);
    expect(dropped).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it("keeps a real MC semantic mismatch that is not about glosses", () => {
    const issues: VerifierIssue[] = [
      {
        itemKey: "test:u1_ex3_q04",
        itemLabel: "test u1_ex3_q04",
        itemKind: "test",
        severity: "critical",
        code: "semantic_mismatch",
        issue: "German frames the opposite polarity: the Serbian answer is 'nisam' (I am not).",
        suggestion: "Keep the Serbian stem; the options already encode the negation.",
      },
    ];
    const { kept, dropped } = dropAiIssuesThatBreakExerciseGlossContract(issues, [mcItem]);
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });

  it("keeps a real fill-in missing context gloss from the AI", () => {
    const missingFill: VerifierInputItem = {
      ...fillItem,
      german: "Question (DE): Ja ____ Ana.",
    };
    const issues: VerifierIssue[] = [
      {
        itemKey: "test:u1_ex2_q01",
        itemLabel: "test u1_ex2_q01",
        itemKind: "test",
        severity: "critical",
        code: "missing_info",
        issue: "The German question omits the fill-in context gloss (I am Ana.).",
        suggestion: "Ja ____ Ana. (Ich bin Ana.)",
      },
    ];
    const { kept, dropped } = dropAiIssuesThatBreakExerciseGlossContract(issues, [missingFill]);
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });

  it("drops an AI request to strip a German fill-in context gloss", () => {
    const issues: VerifierIssue[] = [
      {
        itemKey: "test:u1_ex2_q01",
        itemLabel: "test u1_ex2_q01",
        itemKind: "test",
        severity: "critical",
        code: "unwanted",
        issue: "Remove the leftover parenthetical help gloss on the German question.",
        suggestion: "Ja ____ Ana.",
      },
    ];
    const { kept, dropped } = dropAiIssuesThatBreakExerciseGlossContract(issues, [fillItem]);
    expect(dropped).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it("never drops deterministic gloss codes", () => {
    const issues: VerifierIssue[] = [
      {
        itemKey: "test:u1_ex3_q04",
        itemLabel: "test u1_ex3_q04",
        itemKind: "test",
        severity: "critical",
        code: "test_unwanted_parenthetical_gloss",
        issue: "German exercise prompt still has parenthetical translation help.",
        suggestion: "Remove the parenthetical help",
      },
    ];
    const withGloss: VerifierInputItem = {
      ...mcItem,
      german: "Question (DE): Ja _____ putnik. (Ich bin kein Reisender)",
    };
    const { kept, dropped } = dropAiIssuesThatBreakExerciseGlossContract(issues, [withGloss]);
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
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

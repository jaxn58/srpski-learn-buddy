import { describe, it, expect } from "vitest";
import {
  stripTrailingParentheticalGlosses,
  findUnwantedExerciseGlossIssues,
  findMissingOrUntranslatedFillInCueIssues,
  findMissingFillInContextGlossIssues,
  findSwappedExerciseFormIssues,
  restoreSerbianStemQuestion,
  collectTestQualityIssues,
  isSerbianStemExerciseType,
  isFillInSourceCue,
  isHelpTranslationGloss,
} from "../../convex/contentStudio/_translationCore";
import {
  runDeterministicTestGlossChecks,
  textForSemanticVerification,
  verifierSideForSerbianStem,
  serbianExerciseStemStays,
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
  it("drops a description that was already on the English multiple-choice source", () => {
    const issues = findUnwantedExerciseGlossIssues([
      {
        questionId: "u2_ex3_q18",
        questionType: "multipleChoice",
        questionEn: "Ana je _____. (Ana is a _____.)",
        questionDe: "Ana je _____. (Ana ist eine _____.)",
      },
    ]);
    expect(issues.length).toBe(1);
    expect(issues[0]).toContain("Remove sentence-level translation help");
  });

  it("flags a description the English multiple-choice source did not have", () => {
    const issues = findUnwantedExerciseGlossIssues([
      {
        questionId: "u2_ex3_q18",
        questionType: "multipleChoice",
        questionEn: "Ana je _____.",
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

  it("flags a sentence gloss the English multiple-choice source already had", () => {
    const issues = findUnwantedExerciseGlossIssues([
      {
        questionId: "u12_ex3_q01",
        questionType: "multipleChoice",
        questionEn: "Ovo je _____ pasoš. (This is my passport.)",
        questionDe: "Ovo je _____ pasoš. (This is my passport.)",
      },
    ]);
    expect(issues.length).toBe(1);
    expect(issues[0]).toContain("Remove sentence-level translation help");
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
        correctAnswer: "mleka",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("still English");
  });

  it("does not flag a proper-name fill-in cue", () => {
    const jelena = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u16_ex2_q03",
        questionType: "fillInBlank",
        questionEn: "Ona _____ kafu. (Jelena)",
        questionDe: "Ona _____ kafu. (Jelena)",
        correctAnswer: "pije",
      },
    ]);
    const fullName = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u16_ex2_q04",
        questionType: "fillInBlank",
        questionEn: "Ona _____ kafu. (Ana Marija)",
        questionDe: "Ona _____ kafu. (Ana Marija)",
        correctAnswer: "pije",
      },
    ]);
    expect(jelena).toHaveLength(0);
    expect(fullName).toHaveLength(0);
  });

  it("still flags an untranslated weekday cue", () => {
    const issues = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u7_ex2_q03",
        questionType: "fillInBlank",
        questionEn: "Vidimo se u ___. (Monday)",
        questionDe: "Vidimo se u ___. (Monday)",
        correctAnswer: "ponedeljak",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("still English");
  });

  it("does not report a matching prompt that is already German", () => {
    const issues = collectTestQualityIssues(
      [
        {
          questionId: "u5_ex4_q01",
          questionType: "matching",
          questionEn: "_____ = fresh",
          questionDe: "_____ = frisch",
          correctAnswer: "sveže",
        },
      ],
      new Set()
    );
    expect(issues).toHaveLength(0);
  });

  it("does not flag a cue that names the Serbian answer", () => {
    const issues = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u4_ex2_q06",
        questionType: "fillInBlank",
        questionEn: "Mi smo u Novom ____. (Sad)",
        questionDe: "Mi smo u Novom ____. (Sad)",
        correctAnswer: "Sadu",
      },
    ]);
    expect(issues).toHaveLength(0);
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

  it("does not flag a Serbian aspect pair kept on DE", () => {
    const popunili = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u35_ex2_q03_preview_v2",
        questionType: "fillInBlank",
        questionEn: "Oni su _____ formular. (popunili / popunjavali)",
        questionDe: "Oni su _____ formular. (popunili / popunjavali)",
        correctAnswer: "popunili",
      },
    ]);
    const stigao = findSwappedExerciseFormIssues([
      {
        questionId: "u35_ex2_q06_preview_v2",
        questionType: "fillInBlank",
        questionEn: "On je _____ na šalter. (stigao / stizao)",
        questionDe: "On je _____ na šalter. (stigao / stizao)",
      },
    ]);
    expect(popunili).toHaveLength(0);
    expect(stigao).toHaveLength(0);
    expect(
      collectTestQualityIssues(
        [
          {
            questionId: "u35_ex2_q03_preview_v2",
            questionType: "fillInBlank",
            questionEn: "Oni su _____ formular. (popunili / popunjavali)",
            questionDe: "Oni su _____ formular. (popunili / popunjavali)",
            correctAnswer: "popunili",
          },
        ],
        new Set(),
      ),
    ).toHaveLength(0);
  });

  it("asks to keep a dropped aspect pair instead of translating it", () => {
    const issues = findMissingOrUntranslatedFillInCueIssues([
      {
        questionId: "u35_ex2_q03_preview_v2",
        questionType: "fillInBlank",
        questionEn: "Oni su _____ formular. (popunili / popunjavali)",
        questionDe: "Oni su _____ formular. (ausgefüllt / füllte aus)",
        correctAnswer: "popunili",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("keep the pair unchanged");
    expect(issues[0]).toContain("Do not translate it to German");
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

  it("does not flag a proper name used as the whole context gloss", () => {
    const issues = findMissingFillInContextGlossIssues([
      {
        questionId: "u16_ex2_q03",
        questionType: "fillInBlank",
        questionEn: "Ona _____ kafu. (Jelena.)",
        questionDe: "Ona _____ kafu. (Jelena.)",
      },
    ]);
    expect(issues).toHaveLength(0);
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

  it("does not flag a proper-name fill-in cue", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u16_ex2_q03",
        kind: "test",
        label: "test u16_ex2_q03",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: pije",
        english: "Question (EN): Ona _____ kafu. (Jelena)",
        german: "Question (DE): Ona _____ kafu. (Jelena)",
      },
    ];
    expect(runDeterministicTestGlossChecks(items)).toHaveLength(0);
  });

  it("flags an untranslated weekday fill-in cue", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u7_ex2_q03",
        kind: "test",
        label: "test u7_ex2_q03",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: ponedeljak",
        english: "Question (EN): Vidimo se u ___. (Monday)",
        german: "Question (DE): Vidimo se u ___. (Monday)",
      },
    ];
    const issues = runDeterministicTestGlossChecks(items);
    expect(issues.some((i) => i.code === "test_untranslated_fill_in_cue")).toBe(true);
  });

  it("flags an untranslated sentence gloss that contains a name", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u1_ex2_q01",
        kind: "test",
        label: "test u1_ex2_q01",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: sam",
        english: "Question (EN): Ja ____ Ana. (I am Ana.)",
        german: "Question (DE): Ja ____ Ana. (I am Ana.)",
      },
    ];
    const issues = runDeterministicTestGlossChecks(items);
    expect(issues.some((i) => i.code === "test_untranslated_context_gloss")).toBe(true);
  });

  it("does not flag a Serbian aspect pair kept on DE", () => {
    const popunili: VerifierInputItem[] = [
      {
        key: "test:u35_ex2_q03_preview_v2",
        kind: "test",
        label: "test u35_ex2_q03_preview_v2",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: popunili",
        english: "Question (EN): Oni su _____ formular. (popunili / popunjavali)",
        german: "Question (DE): Oni su _____ formular. (popunili / popunjavali)",
      },
    ];
    const stigao: VerifierInputItem[] = [
      {
        key: "test:u35_ex2_q06_preview_v2",
        kind: "test",
        label: "test u35_ex2_q06_preview_v2",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: stigao",
        english: "Question (EN): On je _____ na šalter. (stigao / stizao)",
        german: "Question (DE): On je _____ na šalter. (stigao / stizao)",
      },
    ];
    expect(runDeterministicTestGlossChecks(popunili)).toHaveLength(0);
    expect(runDeterministicTestGlossChecks(stigao)).toHaveLength(0);
  });

  it("tells the verifier to keep a dropped aspect pair unchanged", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u35_ex2_q03_preview_v2",
        kind: "test",
        label: "test u35_ex2_q03_preview_v2",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: popunili",
        english: "Question (EN): Oni su _____ formular. (popunili / popunjavali)",
        german: "Question (DE): Oni su _____ formular. (ausgefüllt / füllte aus)",
      },
    ];
    const issues = runDeterministicTestGlossChecks(items);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("test_missing_fill_in_cue");
    expect(issues[0]?.issue).toContain("Keep that pair unchanged");
    expect(issues[0]?.issue).toContain("Do not translate it to German");
  });

  it("does not flag a cue that is the Serbian answer", () => {
    const park: VerifierInputItem[] = [
      {
        key: "test:u4_ex2_q06",
        kind: "test",
        label: "test u4_ex2_q06",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: park",
        english: "Question (EN): Gde je _____? (park)",
        german: "Question (DE): Gde je _____? (park)",
      },
    ];
    const city: VerifierInputItem[] = [
      {
        key: "test:u4_ex2_q06",
        kind: "test",
        label: "test u4_ex2_q06",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: Sadu",
        english: "Question (EN): Mi smo u Novom ____. (Sad)",
        german: "Question (DE): Mi smo u Novom ____. (Sad)",
      },
    ];
    expect(runDeterministicTestGlossChecks(park)).toHaveLength(0);
    expect(runDeterministicTestGlossChecks(city)).toHaveLength(0);
  });

  it("flags an English cue that does not name the Serbian answer", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u5_ex2_q01",
        kind: "test",
        label: "test u5_ex2_q01",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: mleka",
        english: "Question (EN): Molim vas, jedan litar ___. (milk)",
        german: "Question (DE): Molim vas, jedan litar ___. (Milch)",
      },
    ];
    const stillEnglish: VerifierInputItem[] = [
      {
        ...items[0]!,
        german: "Question (DE): Molim vas, jedan litar ___. (milk)",
      },
    ];
    expect(runDeterministicTestGlossChecks(items)).toHaveLength(0);
    const flagged = runDeterministicTestGlossChecks(stillEnglish);
    expect(flagged.some((i) => i.code === "test_untranslated_fill_in_cue")).toBe(true);
    expect(flagged[0]?.suggestion).toBeUndefined();
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

describe("verifierSideForSerbianStem", () => {
  it("sends the German gloss only, not the Serbian fill-in stem", () => {
    const de = verifierSideForSerbianStem(
      "Question (DE): On _____ pivo. (Er will Bier.)",
      "DE"
    );
    expect(de).toContain("Learner gloss (DE): Er will Bier.");
    expect(de).not.toContain("On _____ pivo");
    expect(de).toContain("stem stays Serbian");
  });

  it("omits a sentence gloss when multiple choice drops it", () => {
    const en = verifierSideForSerbianStem(
      "Question (EN): Ovo je _____ pasoš. (This is my passport.)",
      "EN",
      true,
    );
    expect(en).toContain("Learner gloss (EN): none");
    expect(en).not.toContain("This is my passport");
  });

  it("sends a nested register note as part of the whole learner gloss", () => {
    const en = verifierSideForSerbianStem(
      "Question (EN): _____ li sok? (Do you (informal) have juice?)",
      "EN",
    );
    expect(en).toContain("Learner gloss (EN): Do you (informal) have juice?");
  });

  it("keeps a Serbian fill-in and treats an English fill-in sentence as translatable", () => {
    expect(serbianExerciseStemStays("fillInBlank", "On _____ pivo. (He wants beer.)")).toBe(true);
    expect(serbianExerciseStemStays("fillInBlank", "Ja ____ Ana. (I am Ana.)")).toBe(true);
    expect(serbianExerciseStemStays("fillInBlank", "I need a kilogram of _____.")).toBe(false);
    expect(serbianExerciseStemStays("multipleChoice", "You meet someone in the morning. What do you say?")).toBe(false);
    expect(serbianExerciseStemStays("multipleChoice", "You want to ask about the weather. You say:")).toBe(false);
    expect(serbianExerciseStemStays("multipleChoice", "_____ je vreme danas?")).toBe(true);
    expect(serbianExerciseStemStays("multipleChoice", "Idem u bioskop sa mojim _____.")).toBe(true);
    expect(
      serbianExerciseStemStays(
        "multipleChoice",
        "Svaki dan _____ novine. (I read the newspaper every day.)",
      ),
    ).toBe(true);
    expect(
      serbianExerciseStemStays(
        "multipleChoice",
        "Molim vas, _____ ovu knjigu do sutra. (Please, read this book by tomorrow.)",
      ),
    ).toBe(true);
  });
});

describe("restoreSerbianStemQuestion", () => {
  it("keeps the Serbian multiple-choice sentence and drops the sentence gloss", () => {
    const restored = restoreSerbianStemQuestion(
      "multipleChoice",
      "Svaki dan _____ novine. (I read the newspaper every day.)",
      "Ich lese jeden Tag die Zeitung.",
    );
    expect(restored).toBe("Svaki dan _____ novine.");
  });

  it("keeps a Serbian cloze that has no description", () => {
    expect(
      restoreSerbianStemQuestion(
        "multipleChoice",
        "_____ je vreme danas?",
        "Wie ist das Wetter heute?",
      ),
    ).toBe("_____ je vreme danas?");
    expect(
      restoreSerbianStemQuestion(
        "multipleChoice",
        "Idem u bioskop sa mojim _____. (I am going to the cinema with my friend.)",
        "Ich gehe mit meinem Freund ins Kino.",
      ),
    ).toBe("Idem u bioskop sa mojim _____.");
  });

  it("keeps the book sentence and drops the sentence gloss", () => {
    expect(
      restoreSerbianStemQuestion(
        "multipleChoice",
        "Molim vas, _____ ovu knjigu do sutra. (Please, read this book by tomorrow.)",
        "Bitte lesen Sie dieses Buch bis morgen.",
      ),
    ).toBe("Molim vas, _____ ovu knjigu do sutra.");
  });

  it("does not lock an English fill-in sentence", () => {
    const en = "I need a kilogram of _____.";
    const de = "Ich brauche ein Kilogramm _____.";
    expect(restoreSerbianStemQuestion("fillInBlank", en, de)).toBe(de);
  });

  it("keeps a translated fill-in description on the Serbian sentence", () => {
    expect(
      restoreSerbianStemQuestion(
        "fillInBlank",
        "Ja ____ Ana. (I am Ana.)",
        "Ja ____ Ana. (Ich bin Ana.)",
      ),
    ).toBe("Ja _____ Ana. (Ich bin Ana.)");
  });

  it("leaves an English situation prompt for the German translation", () => {
    const en = "You want to ask about the weather. You say:";
    const de = "Sie möchten nach dem Wetter fragen. Sie sagen:";
    expect(restoreSerbianStemQuestion("multipleChoice", en, de)).toBe(de);
  });

  it("keeps a nested register note inside the outer gloss", () => {
    const en = "_____ li sok? (Do you (informal) have juice?)";
    expect(
      restoreSerbianStemQuestion("fillInBlank", en, "_____ li sok? (Hast du Saft?)"),
    ).toBe("_____ li sok? (Hast du Saft?)");
    expect(restoreSerbianStemQuestion("fillInBlank", en, "Hast du Saft?")).toBe(
      "_____ li sok? (Hast du Saft?)",
    );
  });

  it("puts a dropped or translated aspect pair back on the Serbian sentence", () => {
    const popunili = "Oni su _____ formular. (popunili / popunjavali)";
    const stigao = "On je _____ na šalter. (stigao / stizao)";
    expect(restoreSerbianStemQuestion("fillInBlank", popunili, "Oni su _____ formular.")).toBe(popunili);
    expect(
      restoreSerbianStemQuestion(
        "fillInBlank",
        popunili,
        "Oni su _____ formular. (ausgefüllt / füllte aus)",
      ),
    ).toBe(popunili);
    expect(restoreSerbianStemQuestion("fillInBlank", stigao, "On je _____ na šalter.")).toBe(stigao);
    expect(
      restoreSerbianStemQuestion("fillInBlank", stigao, "On je _____ na šalter. (angekommen / kam an)"),
    ).toBe(stigao);
  });
});

describe("findSwappedExerciseFormIssues", () => {
  it("flags a situation prompt that stayed English and a description that stayed English", () => {
    const situation = findSwappedExerciseFormIssues([
      {
        questionId: "u16_mc_q13",
        questionType: "multipleChoice",
        questionEn: "You want to ask about the weather. You say:",
        questionDe: "You want to ask about the weather. You say:",
      },
    ]);
    expect(situation[0]).toContain("situation prompt is still English");

    const englishBlank = findSwappedExerciseFormIssues([
      {
        questionId: "u18_fill_en",
        questionType: "fillInBlank",
        questionEn: "I need a kilogram of _____.",
        questionDe: "I need a kilogram of _____.",
      },
    ]);
    expect(englishBlank[0]).toContain("English fill-in sentence is still English");

    const gloss = findSwappedExerciseFormIssues([
      {
        questionId: "u18_mc_q21",
        questionType: "multipleChoice",
        questionEn: "Svaki dan _____ novine. (I read the newspaper every day.)",
        questionDe: "Svaki dan _____ novine. (I read the newspaper every day.)",
      },
    ]);
    expect(gloss).toHaveLength(0);

    const fillGloss = findSwappedExerciseFormIssues([
      {
        questionId: "u12_fill_q01",
        questionType: "fillInBlank",
        questionEn: "Ja ____ Ana. (I am Ana.)",
        questionDe: "Ja ____ Ana. (I am Ana.)",
      },
    ]);
    expect(fillGloss[0]).toContain("parenthetical description is still English");
  });

  it("accepts a German situation prompt and a Serbian multiple-choice sentence without the gloss", () => {
    expect(
      findSwappedExerciseFormIssues([
        {
          questionId: "u16_mc_q13",
          questionType: "multipleChoice",
          questionEn: "You want to ask about the weather. You say:",
          questionDe: "Sie möchten nach dem Wetter fragen. Sie sagen:",
        },
        {
          questionId: "u18_mc_q21",
          questionType: "multipleChoice",
          questionEn: "Svaki dan _____ novine. (I read the newspaper every day.)",
          questionDe: "Svaki dan _____ novine.",
        },
      ]),
    ).toHaveLength(0);
  });
});

describe("textForSemanticVerification", () => {
  it("removes the parenthetical the deterministic gloss check already owns", () => {
    expect(textForSemanticVerification("Ja _____ putnik. (I am not a traveler.)")).toBe("Ja _____ putnik.");
    expect(textForSemanticVerification("Ja ____ Ana. (Ich bin Ana.)")).toBe("Ja ____ Ana.");
  });

  it("removes a nested gloss as one span", () => {
    expect(textForSemanticVerification("_____ li sok? (Do you (informal) have juice?)")).toBe(
      "_____ li sok?",
    );
  });
});

describe("nested register note in a fill-in gloss", () => {
  const en = "_____ li sok? (Do you (informal) have juice?)";
  const de = "_____ li sok? (Hast du Saft?)";

  it("treats the whole sentence as a context gloss, not a missing fill-in cue", () => {
    expect(
      findMissingOrUntranslatedFillInCueIssues([
        {
          questionId: "u2_ex2_q06_preview_v8",
          questionType: "fillInBlank",
          questionEn: en,
          questionDe: de,
          correctAnswer: "Imaš",
        },
      ]),
    ).toHaveLength(0);
    expect(
      findMissingFillInContextGlossIssues([
        {
          questionId: "u2_ex2_q06_preview_v8",
          questionType: "fillInBlank",
          questionEn: en,
          questionDe: de,
        },
      ]),
    ).toHaveLength(0);
  });

  it("does not raise a missing fill-in cue in the verifier", () => {
    const items: VerifierInputItem[] = [
      {
        key: "test:u2_ex2_q06_preview_v8",
        kind: "test",
        label: "test u2_ex2_q06_preview_v8",
        questionType: "fillInBlank",
        serbian: "Expected Serbian answer: Imaš",
        english: `Question (EN): ${en}`,
        german: `Question (DE): ${de}`,
      },
    ];
    const issues = runDeterministicTestGlossChecks(items);
    expect(issues.some((issue) => issue.code === "test_missing_fill_in_cue")).toBe(false);
    expect(issues.some((issue) => issue.code === "test_missing_context_gloss")).toBe(false);
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

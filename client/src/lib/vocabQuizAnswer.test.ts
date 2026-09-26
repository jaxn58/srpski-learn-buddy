import { describe, expect, it } from "vitest";
import { extractAlternativeMeanings, gradeVocabularyAnswer } from "./vocabQuizAnswer";

describe("extractAlternativeMeanings", () => {
  it("reads AlsoMeaning and ignores the usage sentence around it", () => {
    const note =
      'Context: Used as a reply to "Hvala" or when offering something.\nAlsoMeaning: Please';
    expect(extractAlternativeMeanings(note)).toEqual(["Please"]);
  });

  it("strips a parenthetical gloss", () => {
    expect(
      extractAlternativeMeanings("AlsoMeaning: you are welcome (when replying to hvala).")
    ).toEqual(["you are welcome"]);
  });

  it("reads several AlsoMeaning clauses and comma-separated meanings", () => {
    expect(
      extractAlternativeMeanings(
        "AlsoMeaning: You're welcome; AlsoMeaning: Pardon? (asking to repeat)"
      )
    ).toEqual(["You're welcome", "Pardon?"]);
    expect(extractAlternativeMeanings("AlsoMeaning: Another, Still")).toEqual([
      "Another",
      "Still",
    ]);
  });

  it("does not treat the next note key as a meaning", () => {
    expect(extractAlternativeMeanings("AlsoMeaning: Fine, KnownFrom: Unit 1")).toEqual([
      "Fine",
    ]);
    expect(extractAlternativeMeanings("AlsoMeaning: Please (offering), KnownFrom: Unit 1")).toEqual([
      "Please",
    ]);
  });

  it("drops a broken AlsoMeaning fragment with an unmatched parenthesis", () => {
    expect(
      extractAlternativeMeanings("This is the imperative form of `ići`.\nAlsoMeaning: plural)")
    ).toEqual([]);
  });

  it("reads the German note forms used for the same field", () => {
    expect(
      extractAlternativeMeanings("Auch: gern geschehen (als Antwort auf hvala).")
    ).toEqual(["gern geschehen"]);
    expect(
      extractAlternativeMeanings(
        "Kontext: Wird als Antwort auf „Hvala“ verwendet. Bedeutet auch: Bitte (als Aufforderung)."
      )
    ).toEqual(["Bitte"]);
    expect(
      extractAlternativeMeanings(
        "Kontext: Wird verwendet, wenn man um etwas bittet.\nAuch: Gern geschehen."
      )
    ).toEqual(["Gern geschehen"]);
  });
});

describe("gradeVocabularyAnswer", () => {
  const molimNote =
    'Context: Used as a reply to "Hvala" or when offering something.\nAlsoMeaning: Please';

  it("accepts the AlsoMeaning when the primary translation is the other sense", () => {
    const grade = gradeVocabularyAnswer({
      userAnswer: "please",
      primaryTranslation: "you're welcome",
      note: molimNote,
    });
    expect(grade.correct).toBe(true);
    expect(grade.matchedForm).toBe("Please");
  });

  it("still accepts the primary translation", () => {
    const grade = gradeVocabularyAnswer({
      userAnswer: "you're welcome",
      primaryTranslation: "you're welcome",
      note: molimNote,
    });
    expect(grade.correct).toBe(true);
    expect(grade.caseMismatch).toBe(false);
    expect(grade.matchedForm).toBe("you're welcome");
  });

  it("keeps the case hint when only the letter case differs", () => {
    const grade = gradeVocabularyAnswer({
      userAnswer: "You're welcome",
      primaryTranslation: "you're welcome",
      note: molimNote,
    });
    expect(grade.correct).toBe(true);
    expect(grade.caseMismatch).toBe(true);
    expect(grade.matchedForm).toBe("you're welcome");
  });

  it("rejects a word that only appears inside the usage note", () => {
    const grade = gradeVocabularyAnswer({
      userAnswer: "hvala",
      primaryTranslation: "you're welcome",
      note: molimNote,
    });
    expect(grade.correct).toBe(false);
    expect(grade.matchedForm).toBeNull();
  });

  it("flags case differences against the form that matched", () => {
    const grade = gradeVocabularyAnswer({
      userAnswer: "PLEASE",
      primaryTranslation: "you're welcome",
      note: molimNote,
    });
    expect(grade.correct).toBe(true);
    expect(grade.caseMismatch).toBe(true);
    expect(grade.matchedForm).toBe("Please");
  });

  it("accepts the German alternative on the DE note", () => {
    const grade = gradeVocabularyAnswer({
      userAnswer: "gern geschehen",
      primaryTranslation: "bitte",
      note: "Auch: gern geschehen (als Antwort auf hvala).",
    });
    expect(grade.correct).toBe(true);
    expect(grade.matchedForm).toBe("gern geschehen");
  });

  it("keeps punctuation-insensitive matching for the primary translation", () => {
    const grade = gradeVocabularyAnswer({
      userAnswer: "you're welcome!",
      primaryTranslation: "you're welcome",
      note: null,
    });
    expect(grade.correct).toBe(true);
    expect(grade.caseMismatch).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { autofixUnitPackage } from "./autofix";
import { validateUnitPackageTemplateRules } from "./templateRules";
import type { UnitPackage, UnitPackageExerciseCategory } from "./schema";

/**
 * Invariant: after autofixUnitPackage(), no template-rule finding may point to
 * a path that the autofix actually touched (modified).
 *
 * Rationale: If the autofix produces a state that the template validator then
 * rejects, the Content Studio Fix-Findings loop goes endless - the AI edits
 * the markdown, the validator re-runs autofix, autofix re-creates the forbidden
 * state, validator re-reports it, and round it goes. This test locks the
 * invariant so any future autofix or template-rule change that would break it
 * fails in CI.
 */

function makeBasePackage(overrides?: Partial<UnitPackage>): UnitPackage {
  const baseExercises: UnitPackageExerciseCategory[] = [
    {
      category: "translation",
      categoryInstructions: "Translate into Serbian.",
      questions: [
        {
          questionId: "u1_ex1_q01",
          order: 1,
          questionType: "translation",
          question: "Hello",
          correctAnswer: "Zdravo",
        },
      ],
    },
    {
      category: "fillInBlank",
      categoryInstructions: "Fill in the blank.",
      questions: [
        {
          questionId: "u1_ex2_q01",
          order: 2,
          questionType: "fillInBlank",
          question: "Ja _____ dobro.",
          correctAnswer: "sam",
        },
      ],
    },
    {
      category: "multipleChoice",
      categoryInstructions: "Choose the correct answer.",
      questions: [
        {
          questionId: "u1_ex3_q01",
          order: 3,
          questionType: "multipleChoice",
          question: "How are you?",
          options: ["Dobro", "Hvala", "Zdravo"],
          correctAnswer: "Dobro",
        },
      ],
    },
    {
      category: "vocabularyMatching",
      categoryInstructions: "Match the words.",
      questions: [
        {
          questionId: "u1_ex4_q01",
          order: 4,
          questionType: "matching",
          question: "_____ = Hello",
          correctAnswer: "Zdravo",
        },
      ],
    },
    {
      category: "dialogueCompletion",
      categoryInstructions: "Complete the dialogue.",
      questions: [
        {
          questionId: "u1_ex5_q01",
          order: 5,
          questionType: "multipleChoice",
          question: "A: Zdravo! B: ___",
          options: ["Zdravo", "Hvala", "Ja"],
          correctAnswer: "Zdravo",
        },
      ],
    },
  ];

  const base: UnitPackage = {
    schemaVersion: "unitPackage.v1",
    unitNumber: 1,
    module: { moduleNumber: 1, title: "Arrival" },
    title: "Greetings",
    description: "A simple greetings unit.",
    baseLanguage: "en",
    targetLanguage: "sr",
    languages: ["en"],
    content: {
      en: {
        overviewMd: "Overview",
        grammarMd: "Grammar",
        phrasesMd: "Phrases",
        dialoguesMd: "Dialogues",
        testIntroductionMd: "Test intro",
      },
    },
    vocabulary: {
      en: [],
    },
    exercises: {
      en: baseExercises,
    },
  };

  return { ...base, ...(overrides ?? {}) };
}

function pathsOverlap(
  a: Array<string | number>,
  b: Array<string | number>
): boolean {
  const ja = a.join(".");
  const jb = b.join(".");
  if (!ja || !jb) return false;
  if (ja === jb) return true;
  if (ja.startsWith(jb + ".")) return true;
  if (jb.startsWith(ja + ".")) return true;
  return false;
}

function assertInvariant(pkg: UnitPackage) {
  const { fixed, changes } = autofixUnitPackage(pkg);
  const findings = validateUnitPackageTemplateRules(fixed);
  const touchedPaths = changes.map((c) => c.path);
  const violating = findings.filter((f) =>
    touchedPaths.some((tp) => pathsOverlap(tp, f.path))
  );
  if (violating.length > 0) {
    const details = violating
      .map((v) => `  - ${v.path.join(".")}: ${v.message}`)
      .join("\n");
    throw new Error(
      `Invariant violated: template findings on autofix-touched paths:\n${details}`
    );
  }
}

describe("autofixUnitPackage invariant: no template finding on autofix-touched paths", () => {
  it("canonicalizes 'Also:' in noteEn to 'AlsoMeaning:' and leaves no finding", () => {
    const pkg = makeBasePackage({
      vocabulary: {
        en: [
          {
            serbian: "Dobro",
            en: "Good",
            noteEn: "Also: Fine",
          },
        ],
      },
    });
    const { fixed } = autofixUnitPackage(pkg);
    expect(fixed.vocabulary.en[0].noteEn).toMatch(/AlsoMeaning:/);
    expect(fixed.vocabulary.en[0].noteEn).not.toMatch(/(^|\n|;\s*)Also:/);
    assertInvariant(pkg);
  });

  it("rewrites 'Alt:' prefix to canonical form", () => {
    const pkg = makeBasePackage({
      vocabulary: {
        en: [
          {
            serbian: "Racun",
            en: "Bill",
            noteEn: "Alt: Check",
          },
        ],
      },
    });
    const { fixed } = autofixUnitPackage(pkg);
    expect(fixed.vocabulary.en[0].noteEn).toMatch(/AlsoMeaning: Check/);
    assertInvariant(pkg);
  });

  it("rewrites 'Alternative:' prefix to canonical form", () => {
    const pkg = makeBasePackage({
      vocabulary: {
        en: [
          {
            serbian: "Jos",
            en: "More",
            noteEn: "Alternative: Another",
          },
        ],
      },
    });
    const { fixed } = autofixUnitPackage(pkg);
    expect(fixed.vocabulary.en[0].noteEn).toMatch(/AlsoMeaning: Another/);
    assertInvariant(pkg);
  });

  it("collapseEnglishSlashAlternatives writes canonical 'AlsoMeaning:' not 'Also:'", () => {
    const pkg = makeBasePackage({
      vocabulary: {
        en: [
          {
            serbian: "Dobro",
            en: "Good/Fine",
          },
        ],
      },
    });
    const { fixed } = autofixUnitPackage(pkg);
    expect(fixed.vocabulary.en[0].en).toBe("Good");
    expect(fixed.vocabulary.en[0].noteEn ?? "").toMatch(/AlsoMeaning: Fine/);
    expect(fixed.vocabulary.en[0].noteEn ?? "").not.toMatch(
      /(^|\n|;\s*)Also:/
    );
    assertInvariant(pkg);
  });

  it("leaves canonical 'AlsoMeaning:' untouched and produces no finding", () => {
    const pkg = makeBasePackage({
      vocabulary: {
        en: [
          {
            serbian: "Molim",
            en: "Please",
            noteEn: "AlsoMeaning: You're welcome",
          },
        ],
      },
    });
    const { fixed } = autofixUnitPackage(pkg);
    expect(fixed.vocabulary.en[0].noteEn).toBe("AlsoMeaning: You're welcome");
    assertInvariant(pkg);
  });

  it("handles multiple problem patterns in one package without leaving any invariant violation", () => {
    const pkg = makeBasePackage({
      vocabulary: {
        en: [
          { serbian: "Dobro", en: "Good/Fine" },
          { serbian: "Racun", en: "Bill", noteEn: "Also: Check" },
          { serbian: "Jos", en: "More", noteEn: "Alt: Another" },
        ],
      },
    });
    assertInvariant(pkg);
  });
});

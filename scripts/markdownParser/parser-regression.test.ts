import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseMarkdownToUnitPackage, validateMarkdownStructure } from "./parser";
import { extractSection, validateSection, listSections } from "./sectionUtils";
import { UnitPackageSchema } from "../unitPackage/schema";
import { validateUnitPackageTemplateRules } from "../unitPackage/templateRules";
import { autofixUnitPackage } from "../unitPackage/autofix";

/**
 * Regression suite for the Markdown -> unitPackage.v1 pipeline.
 *
 * The fixtures are verbatim snapshots (`contentDraftSnapshots.markdownSource`)
 * of units that are PUBLISHED in the app. They lock the parser's current
 * behaviour for the legacy grammar format (free-form `###` grammar points
 * without the didactic `####` template), so that later parser/validator
 * changes (stricter grammar template, new exercise columns) cannot silently
 * break units that are already live.
 *
 * If a fixture assertion fails after an intentional change, the change is
 * NOT backwards compatible for published content and must be reconsidered.
 */

const FIXTURES_DIR = path.join(import.meta.dirname, "__fixtures__");

function loadFixture(name: string): string {
  // Snapshots in the DB use LF; normalize so on-disk line endings never matter.
  return readFileSync(path.join(FIXTURES_DIR, name), "utf8").replace(/\r\n/g, "\n");
}

type FixtureExpectation = {
  file: string;
  unitNumber: number;
  moduleNumber: number;
  title: string;
  vocabularyCount: number;
  firstVocab: { serbian: string; en: string };
  exerciseCounts: Record<string, number>;
  grammarPoints: number;
};

const FIXTURES: FixtureExpectation[] = [
  {
    file: "unit2-morning-coffee.md",
    unitNumber: 2,
    moduleNumber: 1,
    title: "The Morning Coffee Ritual",
    vocabularyCount: 28,
    firstVocab: { serbian: "kafa", en: "coffee" },
    exerciseCounts: {
      translation: 7,
      fillInBlank: 6,
      multipleChoice: 6,
      vocabularyMatching: 8,
      dialogueCompletion: 5,
    },
    grammarPoints: 3,
  },
  {
    file: "unit3-market-numbers.md",
    unitNumber: 3,
    moduleNumber: 1,
    title: "Cheese, Olives, and Numbers up to 100 (CEFR Level: A1.1)",
    vocabularyCount: 49,
    firstVocab: { serbian: "pijaca", en: "outdoor market" },
    exerciseCounts: {
      translation: 7,
      fillInBlank: 7,
      multipleChoice: 6,
      vocabularyMatching: 8,
      dialogueCompletion: 5,
    },
    grammarPoints: 3,
  },
];

const CATEGORY_ORDER = [
  "translation",
  "fillInBlank",
  "multipleChoice",
  "vocabularyMatching",
  "dialogueCompletion",
];

describe.each(FIXTURES)("published unit fixture $file", (fx) => {
  const markdown = loadFixture(fx.file);

  it("passes validateMarkdownStructure", () => {
    const result = validateMarkdownStructure(markdown);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("exposes all six sections in canonical order", () => {
    expect(listSections(markdown)).toEqual([
      "overview",
      "vocabulary",
      "grammar",
      "phrases",
      "exercises",
      "cultural",
    ]);
  });

  it("parses metadata and module placement", () => {
    const pkg = parseMarkdownToUnitPackage(markdown);
    expect(pkg.schemaVersion).toBe("unitPackage.v1");
    expect(pkg.unitNumber).toBe(fx.unitNumber);
    expect(pkg.module.moduleNumber).toBe(fx.moduleNumber);
    expect(pkg.title).toBe(fx.title);
    expect(pkg.description.length).toBeGreaterThan(10);
    expect(pkg.baseLanguage).toBe("en");
    expect(pkg.targetLanguage).toBe("sr");
  });

  it("extracts the full vocabulary table set", () => {
    const pkg = parseMarkdownToUnitPackage(markdown);
    expect(pkg.vocabulary.en).toHaveLength(fx.vocabularyCount);
    expect(pkg.vocabulary.en[0]).toMatchObject(fx.firstVocab);
    // Serbian keys must be unique (validator relies on this).
    const keys = pkg.vocabulary.en.map((v) => v.serbian.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("extracts the legacy grammar section as one Markdown blob", () => {
    const pkg = parseMarkdownToUnitPackage(markdown);
    const grammar = pkg.content.en.grammarMd;
    expect(grammar.startsWith("## 3. Grammar")).toBe(true);
    expect(grammar.length).toBeGreaterThan(500);
    const points = grammar.match(/^###\s+/gm) ?? [];
    expect(points).toHaveLength(fx.grammarPoints);
    // Legacy format: no didactic #### template blocks present.
    expect(/^####\s+The Rule\b/m.test(grammar)).toBe(false);
  });

  it("validates the grammar section with the section validator (legacy rules)", () => {
    const section = extractSection(markdown, "grammar");
    expect(section).not.toBeNull();
    const result = validateSection("grammar", section ?? "");
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("extracts all five exercise categories in template order with stable question IDs", () => {
    const pkg = parseMarkdownToUnitPackage(markdown);
    const cats = pkg.exercises.en;
    expect(cats.map((c) => c.category)).toEqual(CATEGORY_ORDER);

    for (const cat of cats) {
      expect(cat.questions).toHaveLength(fx.exerciseCounts[cat.category]);
      expect(cat.categoryInstructions.length).toBeGreaterThan(5);

      const exNumber = CATEGORY_ORDER.indexOf(cat.category) + 1;
      cat.questions.forEach((q, idx) => {
        // questionId is the key for learner progress (questionProgress) - must stay stable.
        expect(q.questionId).toBe(`u${fx.unitNumber}_ex${exNumber}_q${String(idx + 1).padStart(2, "0")}`);
        expect(q.question.trim().length).toBeGreaterThan(0);
        expect(q.correctAnswer.trim().length).toBeGreaterThan(0);
      });
    }

    // Global order counter is strictly increasing across categories.
    const orders = cats.flatMap((c) => c.questions.map((q) => q.order));
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("parses lettered options and normalizes the correct answer to an option", () => {
    const pkg = parseMarkdownToUnitPackage(markdown);
    const choiceCats = pkg.exercises.en.filter((c) =>
      c.category === "multipleChoice" || c.category === "dialogueCompletion"
    );
    expect(choiceCats).toHaveLength(2);
    for (const cat of choiceCats) {
      for (const q of cat.questions) {
        expect(q.options).toBeDefined();
        expect((q.options ?? []).length).toBeGreaterThanOrEqual(3);
        expect(q.options).toContain(q.correctAnswer);
        // Letter markers must be stripped from options and answer.
        for (const opt of q.options ?? []) {
          expect(/^[A-D]\)\s/.test(opt)).toBe(false);
        }
      }
    }
  });

  it("builds blank-based prompts for vocabulary matching and keeps one blank per fill-in row", () => {
    const pkg = parseMarkdownToUnitPackage(markdown);
    const matching = pkg.exercises.en.find((c) => c.category === "vocabularyMatching");
    expect(matching).toBeDefined();
    for (const q of matching?.questions ?? []) {
      expect(q.question.startsWith("_____ = ")).toBe(true);
      expect(q.questionType).toBe("matching");
    }
    const fill = pkg.exercises.en.find((c) => c.category === "fillInBlank");
    for (const q of fill?.questions ?? []) {
      expect(q.question.match(/_{3,}/g) ?? []).toHaveLength(1);
    }
  });

  it("is schema-valid, template-clean and autofix-stable", () => {
    const pkg = parseMarkdownToUnitPackage(markdown);
    const parsed = UnitPackageSchema.safeParse(pkg);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const issues = validateUnitPackageTemplateRules(parsed.data);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);

    // Autofix on already-published content must be a no-op for exercises/vocabulary.
    const { fixed } = autofixUnitPackage(parsed.data);
    expect(fixed.exercises.en.map((c) => c.questions.map((q) => q.questionId))).toEqual(
      parsed.data.exercises.en.map((c) => c.questions.map((q) => q.questionId))
    );
    expect(fixed.vocabulary.en.map((v) => v.serbian)).toEqual(parsed.data.vocabulary.en.map((v) => v.serbian));
  });

  it("produces identical output for CRLF and LF line endings", () => {
    const crlf = markdown.replace(/\n/g, "\r\n");
    const a = parseMarkdownToUnitPackage(markdown);
    const b = parseMarkdownToUnitPackage(crlf);
    expect(b.vocabulary.en.length).toBe(a.vocabulary.en.length);
    expect(b.exercises.en.map((c) => c.questions.length)).toEqual(a.exercises.en.map((c) => c.questions.length));
    expect(b.content.en.grammarMd.replace(/\r\n/g, "\n")).toBe(a.content.en.grammarMd);
    expect(validateMarkdownStructure(crlf).valid).toBe(true);
  });
});

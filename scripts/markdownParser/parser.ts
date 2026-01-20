/**
 * Main Markdown Parser
 * Converts Markdown files to unitPackage.v1 JSON structure
 */

import type { UnitPackage } from "../unitPackage/schema";
import {
  extractMetadata,
  extractOverview,
  extractVocabulary,
  extractGrammar,
  extractPhrases,
  extractDialogues,
  extractTestIntroduction,
  extractExercises,
} from "./extractors";
import type { ParsedExercise } from "./types";

/**
 * Parse a Markdown file into a unitPackage.v1 JSON structure
 */
export function parseMarkdownToUnitPackage(markdown: string): UnitPackage {
  // Extract metadata
  const metadata = extractMetadata(markdown);

  // Extract content sections
  const overviewMd = extractOverview(markdown);
  const vocabulary = extractVocabulary(markdown);
  const grammarMd = extractGrammar(markdown);
  const phrasesMd = extractPhrases(markdown);
  const dialoguesMd = extractDialogues(markdown);
  const testIntroductionMd = extractTestIntroduction(markdown);
  const exercises = extractExercises(markdown);

  // UnitPackageSchema currently expects strict literals here.
  // Until the app is fully multi-language capable, we lock these to en→sr.
  const baseLanguage: "en" = "en";
  const targetLanguage: "sr" = "sr";

  // Build unit package
  const unitPackage: UnitPackage = {
    schemaVersion: "unitPackage.v1" as const,
    unitNumber: metadata.unitNumber,
    title: metadata.unitTitle,
    baseLanguage,
    targetLanguage,
    languages: ["en"], // Currently only English
    module: {
      moduleNumber: metadata.moduleNumber,
      title: metadata.moduleTitle,
    },
    content: {
      en: {
        overviewMd,
        grammarMd,
        phrasesMd,
        dialoguesMd,
        testIntroductionMd,
      },
    },
    vocabulary: {
      en: vocabulary.map((v) => ({
        serbian: v.serbian,
        en: v.en,
        noteEn: v.noteEn,
        gender: v.gender,
      })),
    },
    exercises: {
      en: convertExercisesToUnitPackageFormat(exercises, metadata.unitNumber),
    },
  };

  return unitPackage;
}

/**
 * Convert parsed exercises to the unitPackage.v1 format
 */
function convertExercisesToUnitPackageFormat(
  exercises: ParsedExercise[],
  unitNumber: number
): UnitPackage["exercises"]["en"] {
  const result: UnitPackage["exercises"]["en"] = [];
  let orderCounter = 1;

  for (const exercise of exercises) {
    const category = mapExerciseTypeToCategory(exercise.type);
    const questionType = mapExerciseTypeToQuestionType(exercise.type);

    // Build questions array with proper structure
    const questions: any[] = exercise.questions.map((question) => {
      const order = orderCounter++;
      const providedId = String(question.questionId || "").trim();
      const questionId =
        providedId && !providedId.startsWith("ex") ? providedId : `u${unitNumber}_${questionType}_q${order}`;
      const questionEntry: any = {
        questionId,
        order,
        questionType,
        question: question.question,
        correctAnswer: question.correctAnswer,
      };

      // Add options for multiple choice, dialogue completion, etc.
      if (question.options && question.options.length > 0) {
        questionEntry.options = question.options;
      }

      return questionEntry;
    });

    // Create exercise category object
    result.push({
      category,
      categoryInstructions: exercise.instructions || "",
      questions,
    });
  }

  return result;
}

function normalizeLanguageCode(
  raw: string,
  fallback: "en" | "sr"
): "en" | "sr" {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized.startsWith("en") || normalized.includes("english")) {
    return "en";
  }
  if (normalized.startsWith("sr") || normalized.includes("serbian")) {
    return "sr";
  }
  return fallback;
}

function mapExerciseTypeToQuestionType(
  type: ParsedExercise["type"]
): "translation" | "fillInBlank" | "multipleChoice" | "matching" | "dialogue" {
  switch (type) {
    case "translation":
      return "translation";
    case "fill_in_blank":
      return "fillInBlank";
    case "multiple_choice":
      return "multipleChoice";
    case "vocabulary_matching":
      return "matching";
    case "dialogue_completion":
      return "multipleChoice";
    default:
      return "translation";
  }
}

/**
 * Map exercise type to category string
 */
function mapExerciseTypeToCategory(
  type: ParsedExercise["type"]
): string {
  const categoryMap: Record<ParsedExercise["type"], string> = {
    translation: "translation",
    fill_in_blank: "fillInBlank",
    multiple_choice: "multipleChoice",
    vocabulary_matching: "vocabularyMatching",
    dialogue_completion: "dialogueCompletion",
  };

  return categoryMap[type] || "translation";
}

/**
 * Validate that a Markdown file has the expected structure
 */
export function validateMarkdownStructure(markdown: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for required sections
  if (!markdown.includes("## 1. Overview")) {
    errors.push("Missing required section: '## 1. Overview'");
  }

  if (!markdown.includes("## 2. Vocabulary")) {
    errors.push("Missing required section: '## 2. Vocabulary'");
  }

  if (!markdown.includes("## 5. Interactive Test")) {
    errors.push("Missing required section: '## 5. Interactive Test'");
  }

  // Check for module/unit headers
  if (!markdown.match(/^#\s+Module\s+\d+:/m)) {
    errors.push("Missing module header (e.g., '# Module 1: ...')");
  }

  if (!markdown.match(/^##\s+Unit\s+\d+:/m)) {
    errors.push("Missing unit header (e.g., '## Unit 1: ...')");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

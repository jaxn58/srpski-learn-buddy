/**
 * Main Markdown Parser
 * Converts Markdown files to unitPackage.v1 JSON structure
 */

import type { UnitPackage } from "../unitPackage/schema";
import {
  extractMetadata,
  extractOverview,
  extractVocabulary,
  extractVocabularyMarkdown,
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
  const vocabularyMd = extractVocabularyMarkdown(markdown);
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
    description: metadata.unitDescription,
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
        vocabularyMd,
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

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const exNumberForType = (type: ParsedExercise["type"]): number => {
    switch (type) {
      case "translation":
        return 1;
      case "fill_in_blank":
        return 2;
      case "multiple_choice":
        return 3;
      case "vocabulary_matching":
        return 4;
      case "dialogue_completion":
        return 5;
      default:
        return 1;
    }
  };

  for (const exercise of exercises) {
    const category = mapExerciseTypeToCategory(exercise.type);
    const questionType = mapExerciseTypeToQuestionType(exercise.type);
    const exNumber = exNumberForType(exercise.type);

    // Build questions array with proper structure
    const questions: any[] = exercise.questions.map((question, localIdx) => {
      const order = orderCounter++;
      const providedId = String(question.questionId || "").trim();
      let questionId = "";
      if (providedId && !providedId.toLowerCase().startsWith("ex")) {
        questionId = providedId;
      } else if (providedId) {
        // Our parser may generate stable IDs like "ex3_q1" when the table lacks a "Question ID" column.
        // Convert those to the canonical template shape: u<UNIT>_ex<EX>_q<NN>
        const m = providedId.match(/^ex(\d+)_q(\d+)$/i);
        if (m) {
          questionId = `u${unitNumber}_ex${parseInt(m[1], 10)}_q${pad2(parseInt(m[2], 10))}`;
        }
      }
      if (!questionId) {
        questionId = `u${unitNumber}_ex${exNumber}_q${pad2(localIdx + 1)}`;
      }
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

  if (!markdown.includes("## 3. Grammar")) {
    errors.push("Missing required section: '## 3. Grammar'");
  }

  if (!markdown.includes("## 4. Phrases")) {
    errors.push("Missing required section: '## 4. Phrases'");
  }

  if (!markdown.includes("## 5. Interactive Test")) {
    errors.push("Missing required section: '## 5. Interactive Test'");
  }

  // Dialogues are required for Unit UI consistency (Unit 1/2 format):
  // - Either a dedicated "## 5. Dialogues" section exists, OR
  // - Dialogue blocks exist inside Phrases as "### ... Dialogue ..."
  const hasDedicatedDialogues = /##\s+5\.\s+Dialogues\b/i.test(markdown);
  const phrasesSectionMatch = markdown.match(/##\s+4\.\s+Phrases[\s\S]+?(?=##\s+\d+\.|$)/);
  const hasDialogueBlocksInPhrases = !!phrasesSectionMatch?.[0]?.match(/###\s+.*Dialogue/i);
  if (!hasDedicatedDialogues && !hasDialogueBlocksInPhrases) {
    errors.push("Missing dialogues: add '### ... Dialogue ...' blocks in Phrases (Unit 1/2 format) or a dedicated '## 5. Dialogues' section.");
  }

  // Audio requirement: dialogues must use a table with Role/Serbian/English columns (Unit 1/2 canonical).
  const hasDialogueTable = /\|\s*Role\s*\|\s*Serbian\s*\|\s*English\s*\|/i.test(markdown);
  if (hasDedicatedDialogues || hasDialogueBlocksInPhrases) {
    if (!hasDialogueTable) {
      errors.push("Dialogues must be written as a table with columns: '| Role | Serbian | English |' (required for audio playback).");
    }
  }

  // Check for module/unit headers
  if (!markdown.match(/^#\s+Module\s+\d+:/m)) {
    errors.push("Missing module header (e.g., '# Module 1: ...')");
  }

  if (!markdown.match(/^##\s+Unit\s+\d+:/m)) {
    errors.push("Missing unit header (e.g., '## Unit 1: ...')");
  }

  // Require a short description right after the unit header.
  // Accept EN/DE label for author convenience.
  if (!markdown.match(/^\*\*(Description|Beschreibung):\*\*\s+.+/m)) {
    errors.push("Missing unit description line (e.g., '**Description:** One short sentence.')");
  }

  // Validate Grammar section is substantial (not truncated)
  // Grammar should have subsections like "### The Locative Case" and at least 500 chars of content
  const grammarMatch = markdown.match(/##\s+3\.\s+Grammar[\s\S]+?(?=##\s+\d+\.|$)/);
  if (grammarMatch) {
    const grammarContent = grammarMatch[0];
    const hasSubsections = /###\s+.+/.test(grammarContent);
    const isSubstantial = grammarContent.length > 500;
    
    if (!hasSubsections && !isSubstantial) {
      errors.push("Grammar section appears truncated or empty. Must contain subsections (### ...) or substantial content (500+ chars).");
    }
    
    // Check for truncation marker (single # at end without content)
    if (grammarContent.trim().endsWith("#") || grammarContent.trim().endsWith("##")) {
      errors.push("Grammar section appears to be cut off mid-generation (ends with incomplete header).");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

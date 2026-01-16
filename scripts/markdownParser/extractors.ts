/**
 * Specialized extractors for different Markdown sections
 * Each extractor handles a specific part of the unit content
 */

import type {
  ParsedMetadata,
  ParsedVocabularyEntry,
  ParsedGrammarSection,
  ParsedPhrase,
  ParsedDialogue,
  ParsedExercise,
  ParsedQuestion,
} from "./types";
import {
  extractTableFromSection,
  extractAnswerFromTable,
  cleanCellContent,
  splitMultipleAnswers,
} from "./tableParser";

/**
 * Extract module and unit metadata from the top of the document
 */
export function extractMetadata(markdown: string): ParsedMetadata {
  const lines = markdown.split("\n");

  let moduleNumber = 0;
  let moduleTitle = "";
  let unitNumber = 0;
  let unitTitle = "";
  let baseLanguage = "English";
  let targetLanguage = "Serbian";

  for (const line of lines) {
    // Module: "# Module 2: Soziales Leben (Social Life)"
    const moduleMatch = line.match(/^#\s+Module\s+(\d+):\s+(.+?)(?:\s+\((.+?)\))?$/);
    if (moduleMatch) {
      moduleNumber = parseInt(moduleMatch[1], 10);
      moduleTitle = moduleMatch[3] || moduleMatch[2]; // Prefer English title in parentheses
    }

    // Unit: "## Unit 7: Going Out with Friends"
    const unitMatch = line.match(/^##\s+Unit\s+(\d+):\s+(.+)$/);
    if (unitMatch) {
      unitNumber = parseInt(unitMatch[1], 10);
      unitTitle = unitMatch[2];
    }

    // Base Language: "**Base Language:** English"
    const baseLangMatch = line.match(/\*\*Base Language:\*\*\s+(.+)/);
    if (baseLangMatch) {
      baseLanguage = baseLangMatch[1].trim();
    }

    // Target Language: "**Target Language:** Serbian (Serbo-Croatian, with Montenegrin focus)"
    const targetLangMatch = line.match(/\*\*Target Language:\*\*\s+(.+?)(?:\s+\(|$)/);
    if (targetLangMatch) {
      targetLanguage = targetLangMatch[1].trim();
    }
  }

  if (moduleNumber === 0 || unitNumber === 0) {
    throw new Error("Could not extract module or unit number from metadata");
  }

  return {
    moduleNumber,
    moduleTitle,
    unitNumber,
    unitTitle,
    baseLanguage,
    targetLanguage,
  };
}

/**
 * Extract overview section (learning objectives and founder note)
 */
export function extractOverview(markdown: string): string {
  const overviewMatch = markdown.match(
    /##\s+1\.\s+Overview\s*\n([\s\S]+?)(?=##\s+\d+\.|\z)/
  );

  if (!overviewMatch) return "";

  let overview = overviewMatch[1].trim();

  // Remove the founder note quote if present
  overview = overview.replace(/####\s+A Note from the Founder[\s\S]+?(?=####|$)/, "");

  // Extract learning objectives if present
  const objectivesMatch = overview.match(
    /####\s+Learning Objectives\s*\n([\s\S]+?)(?=####|##|$)/
  );

  if (objectivesMatch) {
    return objectivesMatch[1].trim();
  }

  return overview.trim();
}

/**
 * Extract vocabulary from tables in section "2. Vocabulary"
 */
export function extractVocabulary(markdown: string): ParsedVocabularyEntry[] {
  const vocabMatch = markdown.match(
    /##\s+2\.\s+Vocabulary[\s\S]+?(?=##\s+\d+\.|\z)/
  );

  if (!vocabMatch) return [];

  const vocabSection = vocabMatch[0];
  const vocabulary: ParsedVocabularyEntry[] = [];

  // Split by subsections (###)
  const subsections = vocabSection.split(/###\s+/);

  for (const subsection of subsections) {
    const table = extractTableFromSection(subsection, 2);
    if (!table) continue;

    // Check if this is a vocabulary table (has Serbian/English columns)
    const hasSerbianCol = table.headers.some((h) =>
      h.toLowerCase().includes("serbian")
    );
    const hasEnglishCol = table.headers.some((h) =>
      h.toLowerCase().includes("english")
    );

    if (!hasSerbianCol || !hasEnglishCol) continue;

    // Extract vocab entries
    for (const row of table.rows) {
      const serbian = cleanCellContent(row["Serbian"] || "");
      const english = cleanCellContent(row["English"] || "");

      if (!serbian || !english) continue;

      const entry: ParsedVocabularyEntry = {
        serbian: extractCleanWord(serbian),
        en: extractCleanTranslation(english),
      };

      // Extract notes (gender markers, dialect notes)
      const genderMatch = english.match(/\((m|f|n)\)/);
      if (genderMatch) {
        entry.gender = genderMatch[1] as "m" | "f" | "n";
        entry.noteEn = genderMatch[1];
      }

      // Extract additional notes from Notes column if present
      const notes = row["Notes"] || "";
      if (notes.trim()) {
        entry.noteEn = (entry.noteEn ? entry.noteEn + ". " : "") + cleanCellContent(notes);
      }

      vocabulary.push(entry);
    }
  }

  return vocabulary;
}

/**
 * Extract clean Serbian word (remove gender markers, parentheses, etc.)
 */
function extractCleanWord(word: string): string {
  return word
    .replace(/\(m\)/gi, "")
    .replace(/\(f\)/gi, "")
    .replace(/\(n\)/gi, "")
    .replace(/\*/g, "") // Remove asterisks (dialect markers)
    .trim();
}

/**
 * Extract clean English translation (remove gender markers)
 */
function extractCleanTranslation(translation: string): string {
  return translation
    .replace(/\(m\)/gi, "")
    .replace(/\(f\)/gi, "")
    .replace(/\(n\)/gi, "")
    .trim();
}

/**
 * Extract grammar sections from "3. Grammar"
 */
export function extractGrammar(markdown: string): string {
  const grammarMatch = markdown.match(
    /##\s+3\.\s+Grammar[\s\S]+?(?=##\s+\d+\.|\z)/
  );

  if (!grammarMatch) return "";

  // Return the full grammar section as markdown
  return grammarMatch[0].trim();
}

/**
 * Extract phrases from "4. Phrases" section (tables and dialogues)
 */
export function extractPhrases(markdown: string): string {
  const phrasesMatch = markdown.match(
    /##\s+4\.\s+Phrases[\s\S]+?(?=##\s+\d+\.|\z)/
  );

  if (!phrasesMatch) return "";

  // Remove dialogue subsections so phrases and dialogues are separated
  const phrasesOnly = phrasesMatch[0]
    .replace(/###\s+.*Dialogue[\s\S]+?(?=###\s+|$)/g, "")
    .trim();

  return phrasesOnly;
}

/**
 * Extract dialogue subsections from "4. Phrases" section
 */
export function extractDialogues(markdown: string): string {
  const phrasesMatch = markdown.match(
    /##\s+4\.\s+Phrases[\s\S]+?(?=##\s+\d+\.|\z)/
  );

  if (!phrasesMatch) return "";

  const phrasesSection = phrasesMatch[0];
  const dialogueBlocks =
    phrasesSection.match(/###\s+.*Dialogue[\s\S]+?(?=###\s+|$)/g) || [];

  return dialogueBlocks.map((b) => b.trim()).filter(Boolean).join("\n\n---\n\n");
}

/**
 * Extract test introduction text from "5. Interactive Test" section
 */
export function extractTestIntroduction(markdown: string): string {
  const testIntroMatch = markdown.match(
    /##\s+5\.\s+Interactive Test[^\n]*\n([\s\S]+?)(?=###\s+Exercise|##\s+\d+\.|\z)/
  );

  if (!testIntroMatch) return "";

  return testIntroMatch[1].trim();
}

/**
 * Extract exercises from "5. Interactive Test" section
 */
export function extractExercises(markdown: string): ParsedExercise[] {
  const exercises: ParsedExercise[] = [];

  // Find all "### Exercise X:" sections
  const lines = markdown.split("\n");
  let currentExercise: {
    number: number;
    title: string;
    content: string[];
  } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is an exercise heading
    const exerciseMatch = line.match(/^###\s+Exercise\s+(\d+):\s+(.+)/);
    
    if (exerciseMatch) {
      // Save previous exercise if exists
      if (currentExercise) {
        const parsedExercise = parseExerciseSection(
          currentExercise.number,
          currentExercise.title, 
          currentExercise.content.join("\n")
        );
        if (parsedExercise) {
          exercises.push(parsedExercise);
        }
      }
      
      // Start new exercise
      currentExercise = {
        number: parseInt(exerciseMatch[1], 10),
        title: exerciseMatch[2].trim(),
        content: []
      };
    } else if (currentExercise && !line.startsWith("##")) {
      // Add line to current exercise (stop at next major section)
      currentExercise.content.push(line);
    } else if (currentExercise && line.startsWith("##")) {
      // Major section starts, save current exercise
      const parsedExercise = parseExerciseSection(
        currentExercise.number,
        currentExercise.title, 
        currentExercise.content.join("\n")
      );
      if (parsedExercise) {
        exercises.push(parsedExercise);
      }
      currentExercise = null;
    }
  }
  
  // Don't forget last exercise
  if (currentExercise) {
    const parsedExercise = parseExerciseSection(
      currentExercise.number,
      currentExercise.title, 
      currentExercise.content.join("\n")
    );
    if (parsedExercise) {
      exercises.push(parsedExercise);
    }
  }
  return exercises;
}

/**
 * Parse a single exercise section
 */
function parseExerciseSection(exerciseNumber: number, title: string, content: string): ParsedExercise | null {
  // Determine exercise type from title
  let type: ParsedExercise["type"] = "translation";
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes("translation") || lowerTitle.includes("time expressions")) {
    type = "translation";
  } else if (
    lowerTitle.includes("fill") || 
    lowerTitle.includes("blank") ||
    lowerTitle.includes("verb conjugation") ||
    lowerTitle.includes("hajde da")
  ) {
    type = "fill_in_blank";
  } else if (
    lowerTitle.includes("multiple") || 
    lowerTitle.includes("choice") ||
    lowerTitle.includes("situational")
  ) {
    type = "multiple_choice";
  } else if (lowerTitle.includes("matching")) {
    type = "vocabulary_matching";
  } else if (lowerTitle.includes("dialogue")) {
    type = "dialogue_completion";
  }

  // Extract instructions
  const instructionsMatch = content.match(/\*\*Instructions:\*\*\s+(.+?)(?=\n\n|\||$)/s);
  const instructions = instructionsMatch ? instructionsMatch[1].trim() : "";

  // Extract questions from table
  const table = extractTableFromSection(content, 2);
  const questions: ParsedQuestion[] = [];

  if (table) {
    for (let qIdx = 0; qIdx < table.rows.length; qIdx++) {
      const row = table.rows[qIdx];

      // Extract question text - try all possible column names
      let questionText = "";
      let englishMeaning = "";
      let serbianWord = "";
      const possibleQuestionColumns = [
        "English",
        "English Prompt",
        "Question",
        "Sentence",
        "Dialogue Line",
        "Serbian Word",
      ];

      for (const col of possibleQuestionColumns) {
        if (row[col]) {
          questionText = cleanCellContent(row[col]);
          break;
        }
      }

      // Special handling for vocabulary matching: build a blank-based prompt
      if (type === "vocabulary_matching") {
        englishMeaning = cleanCellContent(
          row["English Meaning"] || row["English"] || row["Meaning"] || ""
        );
        serbianWord = cleanCellContent(
          row["Serbian Word"] || row["Serbian"] || row["Answer (for database)"] || ""
        );
        if (englishMeaning) {
          questionText = `_____ = ${englishMeaning}`;
        } else if (serbianWord) {
          questionText = `_____ = ${serbianWord}`;
        }
      }

      if (!questionText) continue;

      // Extract correct answer
      let correctAnswer = extractAnswerFromTable(row) || "";
      if (type === "vocabulary_matching" && serbianWord) {
        correctAnswer = serbianWord;
      }

      // Extract options for multiple choice and dialogue completion
      let options: string[] | undefined;
      if (type === "multiple_choice" || type === "dialogue_completion") {
        const optionsText = cleanCellContent(row["Options"] || "");
        if (optionsText) {
          options = parseMultipleChoiceOptions(optionsText);
        }
      }

      // Normalize multiple-choice correct answer to match options
      if ((type === "multiple_choice" || type === "dialogue_completion") && options && options.length > 0) {
        correctAnswer = normalizeMultipleChoiceAnswer(correctAnswer, options);
      }

      // Special handling for Hajde da... prompts without blanks
      if (type === "fill_in_blank" && !questionText.includes("_")) {
        const hajdeBlank = buildHajdeDaBlankQuestion(correctAnswer);
        if (hajdeBlank) {
          questionText = hajdeBlank.question;
          correctAnswer = hajdeBlank.correctAnswer;
        }
      }

      const question: ParsedQuestion = {
        questionId: `ex${exerciseNumber}_q${qIdx + 1}`,
        question: questionText,
        correctAnswer,
      };

      if (options && options.length > 0) {
        question.options = options;
      }

      questions.push(question);
    }
  }

  if (questions.length === 0) {
    return null;
  }

  return {
    type,
    title: `Exercise: ${title}`,
    instructions,
    questions,
  };
}

/**
 * Parse multiple choice options from text like "A) Option 1  B) Option 2  C) Option 3"
 */
function parseMultipleChoiceOptions(optionsText: string): string[] {
  const options: string[] = [];

  // Split by letter markers (A), B), C), etc.)
  const normalized = optionsText.trim().replace(/^([A-Z]\))/, " $1");
  const parts = normalized.split(/\s+[A-Z]\)\s+/);

  for (let i = 1; i < parts.length; i++) {
    const option = parts[i].trim();
    if (option) {
      options.push(option);
    }
  }

  // If no letter markers found, try splitting by newlines or double spaces
  if (options.length === 0) {
    const splitOptions = optionsText
      .split(/\n|  /)
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    options.push(...splitOptions);
  }

  return options;
}

function stripChoicePrefix(input: string): string {
  return input.replace(/^\s*[A-Da-d](\)|\.)\s+/, "").trim();
}

function normalizeMultipleChoiceAnswer(answer: string, options: string[]): string {
  const cleaned = stripChoicePrefix(answer);
  if (options.includes(cleaned)) return cleaned;

  const candidates = cleaned
    .split("/")
    .map((c) => c.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (options.includes(candidate)) {
      return candidate;
    }
  }

  return cleaned;
}

function buildHajdeDaBlankQuestion(answer: string): { question: string; correctAnswer: string } | null {
  const cleaned = cleanCellContent(answer);
  const punctuationMatch = cleaned.match(/([.!?]+)$/);
  const punctuation = punctuationMatch ? punctuationMatch[1] : "";
  const base = punctuation ? cleaned.slice(0, -punctuation.length).trim() : cleaned;

  const match = base.match(/^Hajde da\s+(.+)$/i);
  if (!match) return null;

  const remainder = match[1].trim();
  if (!remainder) return null;

  let prefix = "Hajde da ";
  let verb = "";
  let after = "";

  if (remainder.startsWith("se ")) {
    prefix = "Hajde da se ";
    const rest = remainder.slice(3).trim();
    const parts = rest.split(/\s+/);
    verb = parts.shift() || "";
    after = parts.join(" ");
  } else {
    const parts = remainder.split(/\s+/);
    verb = parts.shift() || "";
    after = parts.join(" ");
  }

  if (!verb) return null;

  const questionCore = after ? `${prefix}_____ ${after}` : `${prefix}_____`;
  const question = `${questionCore}${punctuation}`.trim();
  return { question, correctAnswer: verb };
}

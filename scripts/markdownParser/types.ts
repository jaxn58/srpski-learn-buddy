/**
 * TypeScript types for Markdown Parser
 * Used for parsing Markdown files into unitPackage.v1 JSON structure
 */

export interface ParsedMetadata {
  moduleNumber: number;
  moduleTitle: string;
  unitNumber: number;
  unitTitle: string;
  unitDescription?: string;
  baseLanguage: string;
  targetLanguage: string;
}

export interface ParsedVocabularyEntry {
  serbian: string;
  en: string;
  noteEn?: string;
  gender?: "m" | "f" | "n";
  dialectNote?: string;
}

export interface ParsedGrammarSection {
  title: string;
  content: string;
  examples?: string[];
}

export interface ParsedPhrase {
  situation: string;
  serbian: string;
  en: string;
  notes?: string;
}

export interface ParsedDialogue {
  title: string;
  scene?: string;
  lines: Array<{
    role: string;
    serbian: string;
    en: string;
  }>;
}

export interface ParsedExercise {
  type: "translation" | "fill_in_blank" | "multiple_choice" | "vocabulary_matching" | "dialogue_completion";
  title: string;
  instructions: string;
  questions: ParsedQuestion[];
}

export interface ParsedQuestion {
  questionId: string;
  question: string;
  correctAnswer: string;
  options?: string[];
  hint?: string;
}

export interface MarkdownTable {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface ParseError {
  line: number;
  message: string;
  section?: string;
}

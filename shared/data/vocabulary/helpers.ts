// Helper functions for multi-language vocabulary support

export type SupportedLanguage = "en" | "de" | "es" | "fr";

export type VocabWord = {
  serbian: string;
  translations: {
    en: string;
    de: string;
    es?: string;
    fr?: string;
  };
  alternatives?: {
    en?: string[];
    de?: string[];
    es?: string[];
    fr?: string[];
  };
  unit: number;
};

/**
 * Get the translation for a vocabulary word in the specified language
 * Falls back to English if translation is not available
 */
export function getTranslation(
  word: VocabWord,
  language: SupportedLanguage
): string {
  return word.translations[language] || word.translations.en;
}

/**
 * Get alternative translations for a vocabulary word in the specified language
 * Returns empty array if no alternatives are available
 */
export function getAlternatives(
  word: VocabWord,
  language: SupportedLanguage
): string[] {
  return word.alternatives?.[language] || [];
}

/**
 * Check if a user's answer is correct (matches translation or any alternative)
 */
export function isAnswerCorrect(
  word: VocabWord,
  userAnswer: string,
  language: SupportedLanguage
): boolean {
  const normalizedAnswer = userAnswer.trim().toLowerCase();
  const correctAnswer = getTranslation(word, language).toLowerCase();
  const alternatives = getAlternatives(word, language).map(alt => alt.toLowerCase());
  
  return normalizedAnswer === correctAnswer || alternatives.includes(normalizedAnswer);
}






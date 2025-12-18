/**
 * Unit Exercises Configuration
 * Maps unit numbers to their required exercise IDs
 */

// Exercise IDs for each unit
// These are the exercises that must be completed (with perfect score) to unlock the next unit
export const UNIT_EXERCISES: Record<number, string[]> = {
  // New Units 1 and 2 (First Words, Who Are You)
  1: [
    "unit1_first_words_greetings",
    "unit1_basic_phrases",
    "unit1_biti_partial",
  ],
  2: [
    "unit2_who_are_you_introduction",
    "unit2_biti_conjugation",
    "unit2_zvati_se_conjugation",
    "unit2_noun_gender",
  ],
  // Shifted units (old Units 2-5 → Units 3-6)
  3: [
    "unit2_grammar_verbs",
    "unit2_translation",
  ],
  4: [
    "unit3_grammar_cases",
    "unit3_fill_in_blank",
  ],
  5: [
    "unit4_grammar_plurals",
    "unit4_sentence_building",
  ],
  6: [
    "unit5_grammar_adjectives",
    "unit5_translation",
  ],
  // Unit 7 (old Unit 1 - kept as reference for exercise design)
  7: [
    "unit1_grammar_biti",
    "unit1_sentence_building",
  ],
  // Units 8-27: Add exercises as needed
  8: [],
  9: [],
  10: [],
  11: [],
  12: [],
  13: [],
  14: [],
  15: [],
  16: [],
  17: [],
  18: [],
  19: [],
  20: [],
  21: [],
  22: [],
  23: [],
  24: [],
  25: [],
  26: [],
  27: [],
};

/**
 * Get the list of required exercise IDs for a given unit
 * @param unitNumber - The unit number (1-27)
 * @returns Array of exercise IDs that are required for unit completion
 */
export function getRequiredExercises(unitNumber: number): string[] {
  return UNIT_EXERCISES[unitNumber] || [];
}













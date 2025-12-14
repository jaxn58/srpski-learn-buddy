/**
 * Unit Exercises Configuration
 * Maps unit numbers to their required exercise IDs
 */

// Exercise IDs for each unit
// These are the exercises that must be completed (with perfect score) to unlock the next unit
export const UNIT_EXERCISES: Record<number, string[]> = {
  1: [
    "unit1_grammar_biti",
    "unit1_sentence_building",
  ],
  2: [
    "unit2_grammar_verbs",
    "unit2_translation",
  ],
  3: [
    "unit3_grammar_cases",
    "unit3_fill_in_blank",
  ],
  4: [
    "unit4_grammar_plurals",
    "unit4_sentence_building",
  ],
  5: [
    "unit5_grammar_adjectives",
    "unit5_translation",
  ],
  6: [
    "unit6_grammar_locative",
    "unit6_fill_in_blank",
  ],
  // Units 7-27: Add exercises as needed
  7: [],
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






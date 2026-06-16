/**
 * Single source of truth for gamification XP rules.
 *
 * Canonical schema (see AGENTS.md):
 *  - Spaced-repetition correct answers award 5 / 10 / 20 XP for the
 *    1st / 2nd / 3rd correct answer (total 35 XP per item).
 *  - After mastery (3 correct answers) no further XP is granted.
 *  - Levels: every XP_PER_LEVEL XP advances one level, starting at level 1.
 *
 * All gamification flows (vocabulary, unit exercises, interactive tests) must
 * import from here instead of hardcoding XP values or the level threshold.
 */

export const XP_PER_LEVEL = 300;

export const SPACED_REPETITION_XP = [5, 10, 20] as const;

/**
 * XP for a correct answer, based on how many correct answers preceded it.
 * previousCorrectCount = 0 -> 5 XP, 1 -> 10 XP, 2 -> 20 XP, 3+ -> 0 XP.
 */
export function spacedRepetitionXp(previousCorrectCount: number): number {
  if (previousCorrectCount < 0) return 0;
  if (previousCorrectCount >= SPACED_REPETITION_XP.length) return 0;
  return SPACED_REPETITION_XP[previousCorrectCount];
}

/**
 * Total XP accumulated after `correctCount` correct answers, i.e. the sum of the
 * per-attempt awards. correctCount 1 -> 5, 2 -> 15, 3 -> 35 (capped at mastery).
 * Used when reconstructing historical XP from a stored correct-answer count.
 */
export function cumulativeSpacedRepetitionXp(correctCount: number): number {
  let sum = 0;
  for (let i = 0; i < correctCount; i++) {
    sum += spacedRepetitionXp(i);
  }
  return sum;
}

/** Level derived from total XP (every XP_PER_LEVEL XP = 1 level, base level 1). */
export function levelFromXp(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

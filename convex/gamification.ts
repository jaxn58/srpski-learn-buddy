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

/**
 * Weekly XP goal (dashboard and progress). One standard unit answered once,
 * plus about half of those items a second time: three short sessions, without
 * requiring the third (mastery) answer in the same week.
 */
export const WEEKLY_XP_TARGET = 500;

/** Active days required in the same week as WEEKLY_XP_TARGET. */
export const WEEKLY_ACTIVE_DAYS_TARGET = 3;

/** Completed-unit counts at each module end (U012, U024, U038, U052, U072). */
export const MODULE_COMPLETION_BADGES = [
  { id: "module_1", units: 12 },
  { id: "module_2", units: 24 },
  { id: "module_3", units: 38 },
  { id: "module_4", units: 52 },
  { id: "module_5", units: 72 },
] as const;

/** Consecutive Monday–Sunday weeks that met the weekly goal. */
export const WEEK_STREAK_BADGES = [
  { id: "weeks_2", weeks: 2 },
  { id: "weeks_4", weeks: 4 },
  { id: "weeks_8", weeks: 8 },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight of the calendar day that contains `ts`. Activity rows use this clock. */
export function utcDayStart(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Monday 00:00 UTC of the week that contains `dayStart` (itself a UTC midnight). */
export function utcWeekStart(dayStart: number): number {
  const dow = new Date(dayStart).getUTCDay();
  const sinceMonday = dow === 0 ? 6 : dow - 1;
  return dayStart - sinceMonday * DAY_MS;
}

/**
 * How many Monday–Sunday weeks in a row met the weekly goal.
 * The current week counts once it is already met. Until Sunday is over, an
 * unfinished current week does not break the run; counting starts at the
 * previous week.
 */
export function consecutiveGoalWeeks(args: {
  now: number;
  days: Array<{ dayStart: number; xp: number; active: boolean }>;
  xpTarget: number;
  activeDaysTarget: number;
}): number {
  const today = utcDayStart(args.now);
  const byWeek = new Map<number, { xp: number; activeDays: Set<number> }>();
  for (const day of args.days) {
    const dayStart = utcDayStart(day.dayStart);
    const week = utcWeekStart(dayStart);
    const bucket = byWeek.get(week) ?? { xp: 0, activeDays: new Set<number>() };
    bucket.xp += day.xp;
    if (day.active) bucket.activeDays.add(dayStart);
    byWeek.set(week, bucket);
  }

  const met = (weekStart: number) => {
    const bucket = byWeek.get(weekStart);
    if (!bucket) return false;
    return bucket.xp >= args.xpTarget && bucket.activeDays.size >= args.activeDaysTarget;
  };

  let week = utcWeekStart(today);
  if (!met(week)) week -= 7 * DAY_MS;

  let streak = 0;
  while (met(week)) {
    streak += 1;
    week -= 7 * DAY_MS;
    if (streak > 520) break;
  }
  return streak;
}

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

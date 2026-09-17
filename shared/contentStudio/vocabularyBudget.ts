/**
 * Vocabulary budget: the guideline for how many vocabulary entries a unit
 * should introduce.
 *
 * Deliberately a GUIDELINE, not a limit (decision 2026-09-16). Completeness
 * wins: every Serbian word used in grammar, dialogues, phrases or exercises
 * belongs in the vocabulary table, even when that pushes the unit over the
 * budget. An earlier setup treated the number as a hard rule, the Lector
 * reported the overrun as a defect, and the Fix stage deleted words that the
 * unit was actively teaching. Exceeding the budget is therefore reported to
 * the author only, never to an AI stage.
 *
 * Resolution order: per-unit value from the briefing, then the studio-wide
 * setting, then DEFAULT_VOCABULARY_BUDGET.
 */

export const DEFAULT_VOCABULARY_BUDGET = 35;

/** Guard rails for the admin input and the briefing field. */
export const MIN_VOCABULARY_BUDGET = 10;
export const MAX_VOCABULARY_BUDGET = 120;

/**
 * Read a budget from user input (admin field, briefing line, stored config).
 * Returns undefined for anything that is not a usable number, so callers fall
 * through to the next source instead of silently using a wrong value.
 */
export function parseVocabularyBudget(raw: unknown): number | undefined {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? clampVocabularyBudget(raw) : undefined;
  }
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  // Tolerate "40 words", "ca. 40", "40-45" (first number wins).
  const m = text.match(/\d+/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? clampVocabularyBudget(n) : undefined;
}

export function clampVocabularyBudget(n: number): number {
  const rounded = Math.round(n);
  if (rounded < MIN_VOCABULARY_BUDGET) return MIN_VOCABULARY_BUDGET;
  if (rounded > MAX_VOCABULARY_BUDGET) return MAX_VOCABULARY_BUDGET;
  return rounded;
}

export type VocabularyBudgetSource = "brief" | "settings" | "default";

export interface ResolvedVocabularyBudget {
  budget: number;
  source: VocabularyBudgetSource;
}

/**
 * Effective budget for one unit. `brief` is the per-unit override from the
 * briefing, `settings` the studio-wide value.
 */
export function resolveVocabularyBudget(input: {
  brief?: unknown;
  settings?: unknown;
}): ResolvedVocabularyBudget {
  const fromBrief = parseVocabularyBudget(input.brief);
  if (fromBrief !== undefined) return { budget: fromBrief, source: "brief" };

  const fromSettings = parseVocabularyBudget(input.settings);
  if (fromSettings !== undefined) return { budget: fromSettings, source: "settings" };

  return { budget: DEFAULT_VOCABULARY_BUDGET, source: "default" };
}

/**
 * How far a unit is over budget. Returns null when within budget, so callers
 * can use it directly as "is there something to report".
 */
export function vocabularyBudgetOverrun(
  entryCount: number,
  budget: number
): { count: number; budget: number; over: number } | null {
  if (!Number.isFinite(entryCount) || !Number.isFinite(budget)) return null;
  const over = Math.round(entryCount) - Math.round(budget);
  if (over <= 0) return null;
  return { count: Math.round(entryCount), budget: Math.round(budget), over };
}

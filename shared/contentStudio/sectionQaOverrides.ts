/**
 * Author section overrides come from the existing Section-Modifier flow:
 * the instruction on a section-revise snapshot (draft) and, after adopt,
 * `curatedSections[].instruction` (briefing). The course foundation stays
 * in force; those instructions overrule only a rule they clearly contradict.
 */

export const FOUNDATION_MAX_QUESTIONS_PER_CATEGORY = 6;

export type SectionQaOverride = {
  id: string;
  sectionId: string;
  instruction: string;
  createdAt: number;
};

export function normalizeSectionQaOverrides(raw: unknown): SectionQaOverride[] {
  if (!Array.isArray(raw)) return [];
  const out: SectionQaOverride[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = String(rec.id ?? "").trim();
    const sectionId = String(rec.sectionId ?? "").trim();
    const instruction = String(rec.instruction ?? "").trim();
    const createdAt = Number(rec.createdAt);
    if (!id || !sectionId || !instruction || !Number.isFinite(createdAt)) continue;
    out.push({ id, sectionId, instruction, createdAt });
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Latest instruction per section, from the briefing and from pending
 * section-revise snapshots that are not yet adopted or refused.
 */
export function collectSectionQaOverridesFromExisting(args: {
  curatedSections?: unknown;
  pendingRevisions?: Array<{ section: string; instruction: string; at: number }>;
}): SectionQaOverride[] {
  const bySection = new Map<string, SectionQaOverride>();

  const curated = Array.isArray(args.curatedSections) ? args.curatedSections : [];
  for (const row of curated) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const sectionId = String(rec.section ?? rec.sectionId ?? "").trim();
    const instruction = String(rec.instruction ?? "").trim();
    const createdAt = Number(rec.adoptedAt ?? rec.createdAt);
    if (!sectionId || !instruction || !Number.isFinite(createdAt)) continue;
    bySection.set(sectionId, {
      id: `brief:${sectionId}`,
      sectionId,
      instruction,
      createdAt,
    });
  }

  for (const row of args.pendingRevisions ?? []) {
    const sectionId = String(row.section ?? "").trim();
    const instruction = String(row.instruction ?? "").trim();
    const createdAt = Number(row.at);
    if (!sectionId || !instruction || !Number.isFinite(createdAt)) continue;
    const prev = bySection.get(sectionId);
    if (prev && prev.createdAt > createdAt) continue;
    bySection.set(sectionId, {
      id: `pending:${sectionId}`,
      sectionId,
      instruction,
      createdAt,
    });
  }

  return normalizeSectionQaOverrides(Array.from(bySection.values()));
}

export function buildSectionQaOverrideBlock(overrides: SectionQaOverride[]): string {
  const list = normalizeSectionQaOverrides(overrides);
  if (list.length === 0) return "";
  const lines = list.map(
    (o, i) => `${i + 1}. Section "${o.sectionId}": ${o.instruction}`,
  );
  return [
    "=== AUTHOR SECTION OVERRIDES ===",
    "The default course foundation (prompts, template rules, curriculum limits) still applies.",
    "Only the explicit author instructions below overrule a conflicting foundation rule.",
    "Do not flag the unit for following these overrides. Everything else stays as specified.",
    ...lines,
  ].join("\n");
}

/**
 * Highest explicit question/item count the author asked for in an exercises
 * override. `null` if they only said "more questions" without a number, or
 * if no exercises override exists.
 */
export function requestedExerciseQuestionCount(overrides: SectionQaOverride[]): number | null {
  let max: number | null = null;
  for (const o of normalizeSectionQaOverrides(overrides)) {
    if (o.sectionId !== "exercises") continue;
    const n = parseRequestedCount(o.instruction);
    if (n === null) continue;
    if (max === null || n > max) max = n;
  }
  return max;
}

export function exercisesOverrideAsksForMoreThanFoundation(
  overrides: SectionQaOverride[],
  foundationMax: number = FOUNDATION_MAX_QUESTIONS_PER_CATEGORY,
): boolean {
  const requested = requestedExerciseQuestionCount(overrides);
  return requested !== null && requested > foundationMax;
}

export function shouldSuppressQaFinding(args: {
  message: string;
  path?: string;
  severity?: string;
  overrides: SectionQaOverride[];
}): boolean {
  if (args.severity === "error") return false;
  const overrides = normalizeSectionQaOverrides(args.overrides);
  if (overrides.length === 0) return false;

  const message = String(args.message || "");
  const path = String(args.path || "");
  if (!isExerciseCountFinding(message, path)) return false;
  return exercisesOverrideAsksForMoreThanFoundation(overrides);
}

function parseRequestedCount(instruction: string): number | null {
  const text = String(instruction || "");
  const patterns = [
    /(\d+)\s*(?:questions?|items?|aufgaben|fragen)/gi,
    /(?:questions?|items?|aufgaben|fragen)\s*(?:to|auf|auf\s+)?(\d+)/gi,
    /(?:genau|exactly|jeweils|per category|pro kategorie)\s+(\d+)/gi,
  ];
  let max: number | null = null;
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (!Number.isFinite(n) || n < 1 || n > 40) continue;
      if (max === null || n > max) max = n;
    }
  }
  return max;
}

function isExerciseCountFinding(message: string, path: string): boolean {
  const onExercises = /exercises/i.test(path) || /exercise category/i.test(message);
  if (!onExercises) return false;
  return (
    /exceeding the recommended maximum/i.test(message) ||
    /recommended maximum of \d+ items per category/i.test(message) ||
    /micro-units/i.test(message)
  );
}

/**
 * Vocabulary-quiz grading.
 *
 * Each entry has one primary translation (`en` / `de`). Further meanings are
 * stored in the learner-language note, not as extra translation columns:
 *   EN: `AlsoMeaning: Please`
 *   DE: `Auch: gern geschehen` or `Bedeutet auch: Bitte`
 * Those values are valid answers. Usage notes (`Context`, `Usage`, `Kontext`,
 * parenthetical glosses) are not.
 */

const QUIZ_PUNCTUATION_SOURCE = "[.,!?;:'\"()\\[\\]{}\\-\\u2013\\u2014\\u2026\\u00a1\\u00bf]";

const ALTERNATIVE_MARKER_SOURCE =
  "Bedeutet auch\\s*:|AlsoMeaning\\s*:|(?:^|[\\n;])\\s*Auch\\s*:";

const FOLLOWING_NOTE_KEY =
  /\s+(?:AlsoMeaning|Bedeutet auch|Auch|Context|Usage|Gender|Chunk|KnownFrom|Montenegro|Kontext)\s*:/i;

const NOTE_KEY_CLAUSE =
  /^(?:AlsoMeaning|Bedeutet auch|Auch|Context|Usage|Gender|Chunk|KnownFrom|Montenegro|Kontext)\s*:/i;

function stripQuizPunctuation(value: string): string {
  return value.replace(new RegExp(QUIZ_PUNCTUATION_SOURCE, "g"), "");
}

export function normalizeQuizAnswer(value: string): string {
  return stripQuizPunctuation(value.trim().toLowerCase()).replace(/\s+/g, " ").trim();
}

export function normalizeQuizAnswerPreservingCase(value: string): string {
  return stripQuizPunctuation(value.trim()).replace(/\s+/g, " ").trim();
}

function hasBalancedParens(value: string): boolean {
  let depth = 0;
  for (const ch of value) {
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function splitOutsideParens(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")" && depth > 0) depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function stripGloss(value: string): string {
  return value
    .replace(/\s*\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .trim();
}

function meaningsFromClause(rawClause: string): string[] {
  const cut = FOLLOWING_NOTE_KEY.exec(rawClause);
  const clause = (cut ? rawClause.slice(0, cut.index) : rawClause).trim();
  const meanings: string[] = [];
  for (const part of splitOutsideParens(clause)) {
    const trimmed = part.trim();
    if (!trimmed || NOTE_KEY_CLAUSE.test(trimmed)) break;
    if (!hasBalancedParens(trimmed)) continue;
    const cleaned = stripGloss(trimmed);
    if (cleaned) meanings.push(cleaned);
  }
  return meanings;
}

export function extractAlternativeMeanings(note: string | null | undefined): string[] {
  if (!note) return [];
  const meanings: string[] = [];
  const seen = new Set<string>();
  const marker = new RegExp(ALTERNATIVE_MARKER_SOURCE, "gi");
  for (const match of note.matchAll(marker)) {
    const marker = match[0];
    const colon = marker.lastIndexOf(":");
    const start = (match.index ?? 0) + colon + 1;
    const rest = note.slice(start);
    const endMatch = /[\n;]/.exec(rest);
    const clause = endMatch ? rest.slice(0, endMatch.index) : rest;
    for (const meaning of meaningsFromClause(clause)) {
      const key = normalizeQuizAnswer(meaning);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      meanings.push(meaning);
    }
  }
  return meanings;
}

export type VocabularyQuizGrade = {
  correct: boolean;
  caseMismatch: boolean;
  /** Spelling of the form that matched. Null when the answer is wrong. */
  matchedForm: string | null;
};

export function gradeVocabularyAnswer(params: {
  userAnswer: string;
  primaryTranslation: string;
  note: string | null | undefined;
}): VocabularyQuizGrade {
  const primary = params.primaryTranslation.trim();
  const userNorm = normalizeQuizAnswer(params.userAnswer);
  if (!primary || !userNorm) {
    return { correct: false, caseMismatch: false, matchedForm: null };
  }

  const candidates = [primary, ...extractAlternativeMeanings(params.note)];
  for (const candidate of candidates) {
    if (normalizeQuizAnswer(candidate) !== userNorm) continue;
    const caseMismatch =
      normalizeQuizAnswerPreservingCase(params.userAnswer) !==
      normalizeQuizAnswerPreservingCase(candidate);
    return { correct: true, caseMismatch, matchedForm: candidate };
  }

  return { correct: false, caseMismatch: false, matchedForm: null };
}

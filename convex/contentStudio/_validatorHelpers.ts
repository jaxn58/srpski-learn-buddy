import { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { callAiText, truncateForAudit } from "./_shared";
import { toVocabularyKey } from "../vocabulary";

export const REQUIRED_TEMPLATE_EXERCISE_CATEGORIES: Array<{
  category: "translation" | "fillInBlank" | "multipleChoice" | "vocabularyMatching" | "dialogueCompletion";
  exNumber: 1 | 2 | 3 | 4 | 5;
  questionType: "translation" | "fillInBlank" | "multipleChoice" | "matching";
  defaultInstructions: string;
}> = [
  {
    category: "translation",
    exNumber: 1,
    questionType: "translation",
    defaultInstructions: "Translate into Serbian.",
  },
  {
    category: "fillInBlank",
    exNumber: 2,
    questionType: "fillInBlank",
    defaultInstructions: "Fill in the blank with the correct Serbian word.",
  },
  {
    category: "multipleChoice",
    exNumber: 3,
    questionType: "multipleChoice",
    defaultInstructions: "Choose the correct answer.",
  },
  {
    category: "vocabularyMatching",
    exNumber: 4,
    questionType: "matching",
    defaultInstructions: "Match the English word to the Serbian word.",
  },
  {
    category: "dialogueCompletion",
    exNumber: 5,
    questionType: "multipleChoice",
    defaultInstructions: "Choose the best completion.",
  },
];

export const FALLBACK_VOCAB_PAIRS: Array<{ en: string; serbian: string }> = [
  { en: "coffee", serbian: "kafa" },
  // Montenegro variant
  { en: "milk", serbian: "mlijeko" },
  { en: "milk", serbian: "mleko" },
  { en: "water", serbian: "voda" },
  { en: "with", serbian: "sa" },
  { en: "without", serbian: "bez" },
  { en: "of", serbian: "od" },
  { en: "would (I would; conditional auxiliary)", serbian: "bih" },
  { en: "we are (auxiliary)", serbian: "smo" },
  { en: "please", serbian: "molim" },
  { en: "thank you", serbian: "hvala" },
  { en: "bill", serbian: "račun" },
  { en: "yes", serbian: "da" },
  { en: "no", serbian: "ne" },
];

/**
 * Remove already-taught vocabulary rows from the Markdown "## 2. Vocabulary" section.
 * Keeps the markdown structure (headings, table headers/separators) intact;
 * only strips data rows whose Serbian cell matches one of the given keys.
 */
export function stripAlreadyTaughtVocabFromMarkdown(
  markdown: string,
  taughtSerbianKeys: Set<string>,
): { markdown: string; strippedCount: number } {
  if (!taughtSerbianKeys.size) return { markdown, strippedCount: 0 };

  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const vocabHeaderMatch = normalized.match(/^##\s+2\.\s+Vocabulary\b/m);
  if (!vocabHeaderMatch || vocabHeaderMatch.index == null) return { markdown: normalized, strippedCount: 0 };

  const vocabStart = vocabHeaderMatch.index;
  const nextSectionMatch = normalized.slice(vocabStart + vocabHeaderMatch[0].length).match(/\n##\s+\d+\./);
  const vocabEnd = nextSectionMatch?.index != null
    ? vocabStart + vocabHeaderMatch[0].length + nextSectionMatch.index
    : normalized.length;

  const before = normalized.slice(0, vocabStart);
  const vocabSection = normalized.slice(vocabStart, vocabEnd);
  const after = normalized.slice(vocabEnd);

  const lines = vocabSection.split("\n");
  const kept: string[] = [];
  let strippedCount = 0;

  const isTableSeparator = (line: string) => /^\|[\s:|-]+\|$/.test(line.trim());
  const isTableRow = (line: string) => line.trim().startsWith("|") && line.trim().endsWith("|");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isTableRow(line) || isTableSeparator(line)) {
      kept.push(line);
      continue;
    }

    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) {
      kept.push(line);
      continue;
    }

    const isHeader = /serbian/i.test(cells[0]) && /english/i.test(cells[1]);
    if (isHeader) {
      kept.push(line);
      continue;
    }

    const serbianCell = cells[0]
      .replace(/[`"'*_]/g, "")
      .replace(/[.?!,:;]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (taughtSerbianKeys.has(serbianCell)) {
      strippedCount++;
      continue;
    }

    kept.push(line);
  }

  return {
    markdown: before + kept.join("\n") + after,
    strippedCount,
  };
}

export function normalizeSerbianKey(s: unknown): string {
  // Normalize for matching Serbian keys across various user/model formatting.
  // IMPORTANT: this is used only for validation/matching, not for storing audio-clean Serbian.
  //
  // The final step funnels through `toVocabularyKey` so any key used in-memory
  // by the validator matches the exact normalization that guards and DB writes
  // use. Without this, visually-identical keys (NFC vs NFD, different case)
  // can miss the `by_serbian_normalized` index and bypass the dedup guard.
  const stripped = String(s ?? "")
    .trim()
    // Strip markdown wrappers/backticks/bold/quotes (anywhere)
    .replace(/[`"'*_]/g, "")
    // Strip trailing punctuation that sometimes sneaks into lists (e.g. "od.")
    .replace(/[.?!,:;]+$/g, "")
    .replace(/\s+/g, " ");
  return toVocabularyKey(stripped);
}

/** Full vocabulary keys plus the single words inside multi-word entries. */
export function expandLemmaKeys(keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of keys) {
    const key = normalizeSerbianKey(raw);
    if (!key) continue;
    out.add(key);
    if (!key.includes(" ")) continue;
    for (const part of key.split(/\s+/)) {
      if (part.length >= 2 || ONE_LETTER_SERBIAN_WORDS.has(part)) out.add(part);
    }
  }
  return out;
}

/**
 * The classifier named a dictionary form for this surface. Accept it only
 * when that form is already a known lemma. This is the model's judgment,
 * not an ending rule: "kartico" anchors to "kartica" only because the model
 * said so and "kartica" is in the known set.
 */
export function resolveClassifierAnchor(
  surface: string,
  reportedLemma: string | undefined,
  knownLemmas: { has(key: string): boolean },
): string | null {
  const key = normalizeSerbianKey(surface);
  const lemma = normalizeSerbianKey(reportedLemma ?? "");
  if (!key || !lemma || lemma === key) return null;
  if (!knownLemmas.has(lemma)) return null;
  return lemma;
}

export type LemmaBooking = "unit" | "earlier" | "later";

/** Where a known lemma already lives. This unit wins over earlier and later units. */
export function bookKnownLemma(
  lemma: string,
  where: {
    unit: { has(key: string): boolean };
    earlier: { has(key: string): boolean };
    later: { has(key: string): boolean };
  },
): LemmaBooking | null {
  const key = normalizeSerbianKey(lemma);
  if (!key) return null;
  if (where.unit.has(key)) return "unit";
  if (where.earlier.has(key)) return "earlier";
  if (where.later.has(key)) return "later";
  return null;
}

/**
 * Dictionary headword the classifier named for a surface that is not itself
 * the headword ("kartico" → "kartica"). Used only when that headword is not
 * already known, so the vocabulary row is the base form.
 */
export function dictionaryHeadword(
  surface: string,
  reportedLemma: string | undefined,
): string | null {
  const key = normalizeSerbianKey(surface);
  const lemma = normalizeSerbianKey(reportedLemma ?? "");
  if (!key || !lemma || lemma === key) return null;
  if (lemma.includes(" ") || !looksLikeVocabularyItem(lemma)) return null;
  return lemma;
}

function normalizeTextForVariety(s: unknown): string {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .toLowerCase()
    // strip quotes/backticks/markdown emphasis
    .replace(/[`"'*_]/g, "")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

export function calculateExerciseVarietyScore(
  pkg: any,
  lang: string = "en"
): {
  score: number; // 0..10
  questionCount: number;
  uniqueStemCount: number;
  topRepeatedStems: Array<{ stem: string; count: number }>;
} {
  const cats: any[] = Array.isArray(pkg?.exercises?.[lang]) ? pkg.exercises[lang] : [];
  const stems: string[] = [];

  for (const cat of cats) {
    const instrNorm = normalizeTextForVariety(cat?.categoryInstructions);
    const qs: any[] = Array.isArray(cat?.questions) ? cat.questions : [];
    for (const q of qs) {
      const rawQ = normalizeTextForVariety(q?.question);
      let s = rawQ;

      // Strip the category instruction prefix if the question starts with it (common for templated prompts).
      if (instrNorm && s.startsWith(instrNorm)) {
        s = s.slice(instrNorm.length).trim();
      }

      // Strip common separators after instructions (":", "-", "—")
      s = s.replace(/^[:\-–—]+\s*/, "");

      const tokens = s.split(" ").filter(Boolean);
      const stem = tokens.slice(0, 6).join(" ").trim();
      if (stem) stems.push(stem);
    }
  }

  const total = stems.length;
  if (total === 0) {
    return { score: 10, questionCount: 0, uniqueStemCount: 0, topRepeatedStems: [] };
  }

  const counts = new Map<string, number>();
  for (const stem of stems) {
    counts.set(stem, (counts.get(stem) ?? 0) + 1);
  }

  const unique = counts.size;
  const ratio = unique / total; // 0..1
  const score = Math.max(0, Math.min(10, Math.round(ratio * 10)));

  const topRepeatedStems = Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([stem, count]) => ({ stem, count }));

  return { score, questionCount: total, uniqueStemCount: unique, topRepeatedStems };
}

export const SERBIAN_FORBIDDEN_REGEX = /[()\[\]*\/]|[.?!,:;]/;

// Common English words that should NOT be treated as Serbian vocabulary
export const COMMON_ENGLISH_WORDS = new Set([
  // Grammar terms often appearing in exercises
  "plural", "singular", "nominative", "accusative", "genitive", "dative", "instrumental", "locative", "vocative",
  "masculine", "feminine", "neuter", "verb", "noun", "adjective", "adverb", "preposition",
  // Common English words
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "nice", "small", "clean", "big", "new", "old", "good", "bad", "hot", "cold",
  "yes", "no", "not", "and", "or", "but", "if", "then", "when", "where", "what", "who", "how", "why",
  "this", "that", "these", "those", "here", "there", "now", "then",
  "one", "two", "three", "four", "five", "first", "second", "third",
  "room", "hotel", "key", "floor", "bathroom", "bed", "window", "door", "table", "chair",
  "water", "coffee", "tea", "juice", "milk", "beer", "wine", "food", "breakfast", "lunch", "dinner",
]);

export function looksLikeVocabularyItem(serbian: string): boolean {
  const s = String(serbian || "").trim();
  if (!s) return false;
  if (SERBIAN_FORBIDDEN_REGEX.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 3) return false;
  
  // Filter out common English words
  const lower = s.toLowerCase();
  if (COMMON_ENGLISH_WORDS.has(lower)) return false;
  
  return true;
}

export function appendNoteEn(existing: unknown, extraLine: string): string {
  const base = typeof existing === "string" ? existing.trim() : "";
  const extra = String(extraLine || "").trim();
  if (!extra) return base;
  if (!base) return extra;
  if (base.includes(extra)) return base;
  return `${base}\n${extra}`;
}

/**
 * Ekavian (Serbia) → Ijekavian (Montenegro) lookup.
 * Serbian form (key) → Montenegrin form (value).
 * Used to auto-add "Montenegro: <variant>" notes when AI forgets.
 */
export const EKAVIAN_TO_IJEKAVIAN: Record<string, string> = {
  gde: "gdje",
  ovde: "ovdje",
  peške: "pješke",
  mleko: "mlijeko",
  hleb: "hljeb",
  razumem: "razumijem",
  lepo: "lijepo",
  lep: "lijep",
  lepa: "lijepa",
  nameštaj: "namještaj",
  železnička: "željeznička",
  dete: "dijete",
  nedelja: "nedjelja",
  ponedeljak: "ponedjeljak",
  levo: "lijevo",
};

/** Reverse: Ijekavian (Montenegro) → Ekavian (Serbia) for entries like "gdje". */
const IJEKAVIAN_TO_EKAVIAN: Record<string, string> = {
  gdje: "gde",
  ovdje: "ovde",
  pješke: "peške",
  mlijeko: "mleko",
  hljeb: "hleb",
  razumijem: "razumem",
  lijepo: "lepo",
  lijep: "lep",
  ljepa: "lepa",
  namještaj: "nameštaj",
  željeznička: "železnička",
  dijete: "dete",
  nedjelja: "nedelja",
  ponedjeljak: "ponedeljak",
  lijevo: "levo",
};

const HAS_MONTENEGRO_NOTE_RE = /montenegro:|variant.*montenegro/i;
const STRUCTURED_MONTENEGRO_NOTE_RE = /^(montenegro:|variant\s*\(\s*serbia\s*\):)/i;

export function hasMontenegroVariantNote(note: unknown): boolean {
  return HAS_MONTENEGRO_NOTE_RE.test(typeof note === "string" ? note : "");
}

/**
 * Structured Montenegro / Serbia-variant line already stored in a note.
 * Splits on newlines or `;` so a Chunk note and a dialect note can coexist.
 */
export function extractStructuredMontenegroNote(note: unknown): string | null {
  const raw = typeof note === "string" ? note : "";
  if (!raw.trim()) return null;
  const parts = raw.split(/\n|;/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (STRUCTURED_MONTENEGRO_NOTE_RE.test(part)) return part;
  }
  return null;
}

/**
 * Build the dialect note for a Serbian cell.
 * Matches the full cell first, then individual tokens, so phrases like
 * "ne razumem" become "Montenegro: ne razumijem (ijekavian)."
 * Does not invent forms that are missing from the lookup.
 */
export function resolveMontenegroVariantNote(serbian: unknown): string | null {
  const key = normalizeSerbianKey(serbian);
  if (!key) return null;

  if (EKAVIAN_TO_IJEKAVIAN[key]) {
    return `Montenegro: ${EKAVIAN_TO_IJEKAVIAN[key]} (ijekavian).`;
  }
  if (IJEKAVIAN_TO_EKAVIAN[key]) {
    return `Variant (Serbia): ${IJEKAVIAN_TO_EKAVIAN[key]} (ekavian).`;
  }

  const tokens = key.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  let sawEkavian = false;
  let sawIjekavian = false;
  const montenegroTokens: string[] = [];
  const serbiaTokens: string[] = [];

  for (const token of tokens) {
    const toIje = EKAVIAN_TO_IJEKAVIAN[token];
    const toEka = IJEKAVIAN_TO_EKAVIAN[token];
    if (toIje) {
      sawEkavian = true;
      montenegroTokens.push(toIje);
      serbiaTokens.push(token);
    } else if (toEka) {
      sawIjekavian = true;
      montenegroTokens.push(token);
      serbiaTokens.push(toEka);
    } else {
      montenegroTokens.push(token);
      serbiaTokens.push(token);
    }
  }

  if (sawEkavian) {
    return `Montenegro: ${montenegroTokens.join(" ")} (ijekavian).`;
  }
  if (sawIjekavian) {
    return `Variant (Serbia): ${serbiaTokens.join(" ")} (ekavian).`;
  }
  return null;
}

export function applyMontenegroVariantNotesToVocabulary(pkg: any): { changed: number } {
  const vocabEn: any[] = Array.isArray(pkg?.vocabulary?.en) ? pkg.vocabulary.en : [];
  let changed = 0;

  for (const v of vocabEn) {
    const prev = typeof v?.noteEn === "string" ? v.noteEn : "";
    if (hasMontenegroVariantNote(prev)) continue;

    const note = resolveMontenegroVariantNote(v?.serbian);
    if (!note) continue;

    const next = appendNoteEn(prev, note);
    if (next !== prev) {
      v.noteEn = next;
      changed += 1;
    }
  }

  return { changed };
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function isMarkdownTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function splitMarkdownTableCells(line: string): string[] {
  const trimmed = line.trim();
  return trimmed.slice(1, -1).split("|").map((c) => c.trim());
}

function joinMarkdownTableCells(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

/**
 * Write Montenegro / Serbia-variant notes from vocabulary.en back into the
 * Markdown "## 2. Vocabulary" table so a later re-parse does not drop them.
 * Existing Notes (Chunk, Gender, AlsoMeaning, …) are kept; the dialect line
 * is appended with "; ".
 */
export function appendMontenegroNotesToMarkdown(
  markdown: string,
  vocabEn: Array<{ serbian?: unknown; noteEn?: unknown }>,
): { markdown: string; changed: number } {
  const noteByKey = new Map<string, string>();
  for (const entry of vocabEn) {
    const key = normalizeSerbianKey(entry?.serbian);
    if (!key) continue;
    const note =
      extractStructuredMontenegroNote(entry?.noteEn) ??
      resolveMontenegroVariantNote(entry?.serbian);
    if (note) noteByKey.set(key, note);
  }
  if (noteByKey.size === 0) return { markdown, changed: 0 };

  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const vocabHeaderMatch = normalized.match(/^##\s+2\.\s+Vocabulary\b/m);
  if (!vocabHeaderMatch || vocabHeaderMatch.index == null) {
    return { markdown: normalized, changed: 0 };
  }

  const vocabStart = vocabHeaderMatch.index;
  const nextSectionMatch = normalized.slice(vocabStart + vocabHeaderMatch[0].length).match(/\n##\s+\d+\./);
  const vocabEnd = nextSectionMatch?.index != null
    ? vocabStart + vocabHeaderMatch[0].length + nextSectionMatch.index
    : normalized.length;

  const before = normalized.slice(0, vocabStart);
  const vocabSection = normalized.slice(vocabStart, vocabEnd);
  const after = normalized.slice(vocabEnd);
  const lines = vocabSection.split("\n");
  const nextLines: string[] = [];
  let changed = 0;
  let notesIdx: number | null = null;

  for (const line of lines) {
    if (!isMarkdownTableRow(line)) {
      if (/^\s*#/.test(line)) notesIdx = null;
      nextLines.push(line);
      continue;
    }
    if (isMarkdownTableSeparator(line)) {
      if (notesIdx != null) {
        const sepCells = splitMarkdownTableCells(line);
        while (sepCells.length <= notesIdx) sepCells.push("---");
        nextLines.push(joinMarkdownTableCells(sepCells));
      } else {
        nextLines.push(line);
      }
      continue;
    }

    const cells = splitMarkdownTableCells(line);
    if (cells.length < 2) {
      nextLines.push(line);
      continue;
    }

    const serbianHeaderIdx = cells.findIndex((c) => /serbian/i.test(c));
    const englishHeaderIdx = cells.findIndex((c) => /english/i.test(c));
    if (serbianHeaderIdx >= 0 && englishHeaderIdx >= 0) {
      const headerNotesIdx = cells.findIndex((c) => /^notes?$/i.test(c));
      notesIdx = headerNotesIdx >= 0 ? headerNotesIdx : cells.length;
      if (headerNotesIdx < 0) {
        cells.push("Notes");
        nextLines.push(joinMarkdownTableCells(cells));
        continue;
      }
      nextLines.push(line);
      continue;
    }

    if (notesIdx == null) {
      nextLines.push(line);
      continue;
    }

    const serbianKey = normalizeSerbianKey(cells[0]);
    const dialectNote = noteByKey.get(serbianKey);
    if (!dialectNote) {
      nextLines.push(line);
      continue;
    }

    while (cells.length <= notesIdx) cells.push("");
    const currentNotes = cells[notesIdx] ?? "";
    if (hasMontenegroVariantNote(currentNotes)) {
      nextLines.push(line);
      continue;
    }

    cells[notesIdx] = currentNotes.trim()
      ? `${currentNotes.trim()}; ${dialectNote}`
      : dialectNote;
    nextLines.push(joinMarkdownTableCells(cells));
    changed += 1;
  }

  return {
    markdown: before + nextLines.join("\n") + after,
    changed,
  };
}

/**
 * One-letter Serbian words that are genuine vocabulary: i (and), a (but/and),
 * u (in), o (about), s (with, short form of "sa"). Everything else of length 1
 * is markup residue or an abbreviation.
 */
const ONE_LETTER_SERBIAN_WORDS = new Set(["i", "a", "u", "o", "s"]);

export function collectSerbianCandidatesFromExercises(pkg: any): string[] {
  const cats: any[] = Array.isArray(pkg?.exercises?.en) ? pkg.exercises.en : [];
  const out: string[] = [];

  for (const c of cats) {
    const qs: any[] = Array.isArray(c?.questions) ? c.questions : [];
    for (const q of qs) {
      const qt = String(q?.questionType || "");
      // For translation, correctAnswer is often a full sentence; skip by default.
      if (qt === "translation") continue;

      const ans = String(q?.correctAnswer || "").trim();
      if (ans) out.push(ans);

      if (Array.isArray(q?.options)) {
        for (const opt of q.options) out.push(String(opt || "").trim());
      }
    }
  }

  return Array.from(new Set(out.map((s) => String(s || "").trim()).filter(Boolean)));
}


/**
 * Extract Serbian word candidates from dialogue and phrase tables in the content markdown.
 * Tokenizes sentences into individual words for vocabulary coverage checking.
 */
export function collectSerbianCandidatesFromContent(pkg: any): string[] {
  const out: string[] = [];
  const content = pkg?.content?.en;
  if (!content) return out;

  const mdParts = [
    String(content.dialoguesMd || ""),
    String(content.phrasesMd || ""),
  ];

  for (const md of mdParts) {
    if (!md.trim()) continue;
    const serbianTexts = extractSerbianColumnFromMdTables(md);
    for (const text of serbianTexts) {
      const words = tokenizeSerbianText(text);
      out.push(...words);
    }
  }

  out.push(...collectSerbianCandidatesFromGrammar(String(content.grammarMd || "")));

  return Array.from(new Set(out.filter(Boolean)));
}

/**
 * Serbian candidates from the grammar section: the forms the unit explicitly
 * teaches. Covers the two places where grammar introduces new words:
 *   - Pattern tables, where the Serbian forms are bold ("| ja | **sam** | I am |")
 *   - Example bullets, where Serbian precedes the English gloss in parentheses
 *
 * Without this, a form that only lives in the grammar section (e.g. "nisi")
 * was invisible to the coverage net: when the Fix stage dropped it from the
 * vocabulary table to satisfy a word-count finding, nothing brought it back
 * and the next Lector run reported it as untaught (2026-09-16).
 */
export function collectSerbianCandidatesFromGrammar(grammarMd: string): string[] {
  const md = String(grammarMd || "");
  if (!md.trim()) return [];

  const out: string[] = [];
  for (const rawLine of md.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (line.startsWith("|")) {
      // Bold cells in a grammar table are the Serbian forms; the remaining
      // cells are pronouns and English glosses we must not harvest.
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.some((c) => /^:?-{3,}:?$/.test(c))) continue;
      for (const cell of cells) {
        const bold = cell.match(/^\*\*(.+)\*\*$/);
        if (bold) out.push(...tokenizeSerbianText(bold[1]));
      }
      continue;
    }

    const example = serbianOfGrammarExampleLine(line);
    if (example) out.push(...tokenizeSerbianText(example));
  }

  return out;
}

/**
 * Serbian part of an example bullet: "*   Ja **sam** Ana. (I am Ana.)".
 * Returns null for anything that is not an example with an English gloss, so
 * prose lines of the explanation are never mistaken for Serbian.
 */
function serbianOfGrammarExampleLine(line: string): string | null {
  const m = line.match(/^(?:[-*]|\d+\.)\s+(.*?)\s*\((?:[^()]*)\)[.\s]*$/);
  if (!m) return null;
  return m[1].replace(/\*\*|`/g, "").trim() || null;
}

function extractSerbianColumnFromMdTables(markdown: string): string[] {
  const results: string[] = [];
  const lines = markdown.split("\n");
  let serbianColIdx = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      serbianColIdx = -1;
      continue;
    }

    const cells = trimmed.split("|").slice(1, -1).map(c => c.trim());
    if (cells.length < 2) continue;

    if (cells.some(c => /^serbian$/i.test(c.replace(/\*+/g, "").trim()))) {
      serbianColIdx = cells.findIndex(c => /^serbian$/i.test(c.replace(/\*+/g, "").trim()));
      continue;
    }

    if (cells.every(c => /^[-:\s]+$/.test(c))) continue;

    if (serbianColIdx >= 0 && serbianColIdx < cells.length && cells[serbianColIdx]) {
      results.push(cells[serbianColIdx]);
    }
  }

  return results;
}

function tokenizeSerbianText(text: string): string[] {
  return String(text || "")
    .replace(/\*+/g, "")
    .replace(/[.?!,:;()\[\]"'…–—\/\\]/g, " ")
    .split(/\s+/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length >= 2 || ONE_LETTER_SERBIAN_WORDS.has(w));
}

/**
 * Collects ORIGINAL-CASE Serbian text samples from exercises (answers/options)
 * and from the Serbian column of content markdown tables.
 *
 * Unlike `collectSerbianCandidatesFromExercises` / `collectSerbianCandidatesFromContent`,
 * this returns the raw sentences with preserved case, so downstream heuristics can
 * detect proper nouns based on mid-sentence capitalization.
 */
export function collectOriginalSerbianTextSamples(pkg: any): string[] {
  const out: string[] = [];

  // Exercises: answers + options (same shape as collectSerbianCandidatesFromExercises, but we also
  // keep multi-word and translation answers because they help detect proper-noun context).
  const cats: any[] = Array.isArray(pkg?.exercises?.en) ? pkg.exercises.en : [];
  for (const c of cats) {
    const qs: any[] = Array.isArray(c?.questions) ? c.questions : [];
    for (const q of qs) {
      const ans = String(q?.correctAnswer || "").trim();
      if (ans) out.push(ans);
      if (Array.isArray(q?.options)) {
        for (const opt of q.options) {
          const s = String(opt || "").trim();
          if (s) out.push(s);
        }
      }
      // Hints and question text can contain the name in-context, too.
      const hint = String(q?.hint || "").trim();
      if (hint) out.push(hint);
      const qt = String(q?.question || "").trim();
      if (qt) out.push(qt);
    }
  }

  // Content markdown: Serbian column of tables.
  const content = pkg?.content?.en;
  if (content) {
    const mdParts = [
      String(content.dialoguesMd || ""),
      String(content.phrasesMd || ""),
    ];
    for (const md of mdParts) {
      if (!md.trim()) continue;
      const serbianTexts = extractSerbianColumnFromMdTables(md);
      for (const text of serbianTexts) {
        if (text && text.trim()) out.push(text.trim());
      }
    }
  }

  return out;
}

/**
 * Heuristic: Checks whether a candidate lemma is most likely a personal/proper noun
 * based on its case pattern in the original text samples.
 *
 * Returns:
 *  - "strong": The word appears CAPITALIZED mid-sentence (i.e. not as the first token
 *    of a sentence / sample and not after ".", "!", "?") — almost certainly a proper noun.
 *  - "weak": The word appears ONLY capitalized (even when counting sentence-initial
 *    positions — where capitalization is ambiguous because every sentence-initial word
 *    is capitalized in Serbian too), and never lowercase. This is NOT reliable for
 *    vocabulary in a language course where common words frequently appear sentence-initially.
 *  - false: Mixed case or only-lowercase — not a proper noun by case pattern.
 *
 * Callers should treat "strong" as definitive and "weak" as requiring further
 * verification (e.g. AI classifier) before skipping a word.
 */
export function looksLikePersonalNameByContext(lemma: string, samples: string[]): "strong" | "weak" | false {
  const target = String(lemma || "").trim().toLowerCase();
  if (!target || target.length < 2) return false;

  // Word-boundary regex, case-insensitive, used to find every occurrence.
  // Escape any regex metacharacters in the lemma (defensive — should be pure letters).
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordRe = new RegExp(`(^|[^\\p{L}])(${escaped})(?=$|[^\\p{L}])`, "giu");

  let sawLowercase = false;
  let sawCapitalMidSentence = false;
  let sawAnyOccurrence = false;

  for (const raw of samples) {
    const sample = String(raw || "");
    if (!sample) continue;

    // Reset regex state for each sample.
    wordRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = wordRe.exec(sample)) !== null) {
      sawAnyOccurrence = true;
      const prefix = match[1] || "";
      const matchedWord = match[2] || "";
      const firstChar = matchedWord.charAt(0);

      // Lowercase occurrence? → definitely NOT a proper noun.
      if (firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()) {
        sawLowercase = true;
        continue;
      }

      // Capitalized occurrence — is it at the start of a sentence?
      // Sentence-initial means: prefix is empty (match at index 0), or prefix is
      // a sentence-ending punctuation/newline followed by optional whitespace.
      const charsBeforeStart = sample.slice(0, Math.max(0, match.index));
      const trimmedBefore = charsBeforeStart.replace(/\s+$/u, "");
      const lastCharBefore = trimmedBefore.slice(-1);
      const isSentenceInitial =
        trimmedBefore.length === 0 ||
        lastCharBefore === "." ||
        lastCharBefore === "!" ||
        lastCharBefore === "?" ||
        lastCharBefore === "\n" ||
        // Table cell boundary (dialogues/phrases markdown) also counts as sentence start.
        lastCharBefore === "|" ||
        // Speaker label in dialogues and dialogue-completion stems:
        // "A: Još nešto?" — the colon starts a new utterance. Without this,
        // "još" counted as capitalized mid-sentence and was dropped as a
        // personal name, which the Lector then reported as untaught
        // vocabulary (Unit 2, 2026-09-17).
        lastCharBefore === ":" ||
        lastCharBefore === ";" ||
        // Opening quotes / brackets.
        lastCharBefore === '"' ||
        lastCharBefore === "„" ||
        lastCharBefore === "»" ||
        lastCharBefore === "(" ||
        lastCharBefore === "-" ||
        lastCharBefore === "—";

      if (!isSentenceInitial) {
        sawCapitalMidSentence = true;
      }
    }
  }

  // No occurrences at all → heuristic cannot decide.
  if (!sawAnyOccurrence) return false;

  // Strong signal: capitalized mid-sentence at least once.
  if (sawCapitalMidSentence) return "strong";

  // Weak signal: never seen lowercase anywhere. In a language course, many
  // common words (verbs, adjectives, greetings) appear only at sentence start
  // (e.g. "Zovem se...", "Dobar dan!") and thus never in lowercase. This is
  // NOT sufficient to classify them as names — the AI classifier must confirm.
  if (!sawLowercase) return "weak";

  return false;
}

export function isTaughtEarlier(entry: any, currentUnitNumber: number): boolean {
  const unitNumber = Number(entry?.unitNumber);
  if (!Number.isFinite(unitNumber)) return false;
  if (unitNumber >= currentUnitNumber) return false;

  // Versioning/soft-archive: treat undefined isActive as active
  if (entry?.isActive === false) return false;
  const rs = entry?.releaseStatus;
  if (rs === "offline") return false;
  return true;
}

export type SerbianWordClassification = {
  isSerbian: boolean;
  translation?: string;
  isProperNoun?: boolean;
  /** Dictionary form named by the model, when the surface is not that form. */
  lemma?: string;
};

/**
 * Classify and translate words. Known lemmas are the dictionary forms already
 * in this unit (including words inside a multi-word entry) and in other units.
 * An inflection of one of those lemmas is anchored to the lemma; it is not a
 * new vocabulary headword.
 */
export async function classifyAndTranslateWords(
  ctx: ActionCtx,
  words: string[],
  knownLemmas: string[] = [],
): Promise<Map<string, SerbianWordClassification>> {
  const cleanWords = words
    .map(w => String(w || "").trim())
    .filter(w => w.length > 0);
  
  if (cleanWords.length === 0) return new Map();

  const knownList = Array.from(expandLemmaKeys(knownLemmas)).slice(0, 2000);
  const knownBlock = knownList.length
    ? [
        ``,
        `KNOWN LEMMAS (dictionary forms already taught or listed in this unit, including single words inside a phrase):`,
        knownList.join(", "),
        ``,
        `Judge every word against KNOWN LEMMAS first.`,
        `A case form, vocative, gender form, plural, conjugated form or infinitive of a known lemma is NOT a new word.`,
        `Return { "lang": "inflection", "lemma": "<one string copied from KNOWN LEMMAS>" }.`,
        `Copy the listed string even when the dictionary infinitive is spelled differently. Never answer lang "sr" for that word.`,
        `Example: known lemma "kartica" (also when the table only has "SIM kartica"), word "kartico" → { "lang": "inflection", "lemma": "kartica" }.`,
        `The same applies to "karticu" and "karticom".`,
        `Example: known "ima" or "imati", word "imati" or "imamo" → lemma is the listed string.`,
        `Example: known "hoću" or "hoće", word "hteti", "hoćeš" or "neću" → { "lang": "inflection", "lemma": "hoću" } (whichever of those forms is actually listed). "hteti" is that verb's infinitive, not a new headword.`,
        `"želeti" / "želim" is a different verb from "hteti" / "hoću". Never anchor one onto the other.`,
      ].join("\n")
    : "";

  const system = [
    `You are a language classifier and Serbian-English translator. You know Serbian morphology.`,
    `For each word, classify it into one of five categories.`,
    ``,
    `Return a JSON object where each key is a word and the value is ONE of:`,
    `- Inflection of a KNOWN LEMMA: { "lang": "inflection", "lemma": "<known lemma>" }`,
    `- Serbian vocabulary word: { "lang": "sr", "en": "<English translation>", "lemma": "<dictionary form>" }`,
    `- English / grammar term / other language: { "lang": "en" }`,
    `- Personal name of a human (first name, given name, nickname): { "lang": "proper_noun" }`,
    `- Not a real word in any language (typo, gibberish, misspelling): { "lang": "unknown" }`,
    knownBlock,
    ``,
    `IMPORTANT — unknown category:`,
    `- Use "unknown" for strings that do NOT exist as actual words in Serbian, English, or any other language.`,
    `- Common signs: the string looks vaguely Slavic but has no meaning, or it resembles a real word but is misspelled (e.g. "čema", "prsto", "kuhna").`,
    `- Do NOT guess a translation for unknown words — classify them as "unknown" instead of forcing a "sr" classification.`,
    `- If you are unsure whether a word exists in Serbian, prefer "unknown" over hallucinating a translation.`,
    ``,
    `IMPORTANT — proper_noun scope:`,
    `- Use "proper_noun" ONLY for names of PEOPLE (Elena, Marko, Ana, Milan, Jovana, Petar, Ivana, ...).`,
    `- Do NOT use "proper_noun" for city/country/place names, product/brand names, or foods — classify those as "sr" with a translation if they are used as regular Serbian nouns (e.g. "Beograd" → { "lang": "sr", "en": "Belgrade" }).`,
    `- If a word could be both a regular noun and a rare given name, prefer "sr" unless it is clearly being used as a personal name.`,
    ``,
    `Examples:`,
    `- "moga" → { "lang": "sr", "en": "I can" }`,
    `- "kupatilo" → { "lang": "sr", "en": "bathroom" }`,
    `- "Beograd" → { "lang": "sr", "en": "Belgrade" }`,
    `- "Elena" → { "lang": "proper_noun" }`,
    `- "Marko" → { "lang": "proper_noun" }`,
    `- "Ana" → { "lang": "proper_noun" }`,
    `- "locative" → { "lang": "en" } (English grammar term)`,
    `- "plural" → { "lang": "en" } (English grammar term)`,
    `- "nominative" → { "lang": "en" } (English grammar term)`,
    `- "hotel" → { "lang": "en" } (international word, treat as English)`,
    `- "čema" → { "lang": "unknown" } (not a real Serbian word)`,
    `- "prsto" → { "lang": "unknown" } (misspelling, not a real word)`,
    ``,
    `Use lang "sr" only when NO form of that lexeme is in KNOWN LEMMAS.`,
    `When lang is "sr" and the word you see is not the dictionary form, set "lemma" to the dictionary form (nominative singular for nouns, masculine nominative for adjectives, infinitive for verbs). The English translation belongs to that dictionary form: an infinitive is "to want", not "I want".`,
    `Do not put an infinitive in "lemma" when any form of that same verb is already in KNOWN LEMMAS. That answer is lang "inflection" and the lemma is the listed form.`,
    `Keep translations short (1-3 words).`,
  ].join("\n");

  const userPrompt = JSON.stringify(cleanWords);

  const { raw } = await callAiText(ctx, {
    stage: "specialist",
    system,
    user: userPrompt,
    maxTokens: 2000,
  });

  const result = new Map<string, SerbianWordClassification>();
  const knownSet = expandLemmaKeys(knownList);

  try {
    const cleanedRaw = String(raw || "")
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    
    const parsed = JSON.parse(cleanedRaw);
    
    if (parsed && typeof parsed === "object") {
      for (const [word, info] of Object.entries(parsed)) {
        const data = info as any;
        const lang = String(data?.lang || "").toLowerCase();
        const key = normalizeSerbianKey(word);
        if (!key) continue;
        const lemmaRaw = typeof data?.lemma === "string" ? normalizeSerbianKey(data.lemma) : "";
        const lemma = lemmaRaw && lemmaRaw !== key ? lemmaRaw : undefined;
        if (lang === "inflection" && lemma && knownSet.has(lemma)) {
          result.set(key, { isSerbian: true, lemma });
        } else if (lang === "sr" && data?.en) {
          result.set(key, {
            isSerbian: true,
            translation: String(data.en).trim(),
            lemma,
          });
        } else if (lang === "proper_noun") {
          result.set(key, { isSerbian: false, isProperNoun: true });
        } else {
          if (lang === "unknown") {
            console.log(`Classifier rejected '${word}' — not a real word in any language`);
          }
          result.set(key, { isSerbian: false });
        }
      }
    }
  } catch (err) {
    console.warn("Failed to parse classification response:", err);
  }

  return result;
}

/**
 * Vocabulary coverage check.
 *
 * REPORTS gaps, it does not fill them (decision 2026-09-17). The previous
 * version pushed rows straight into the unit package JSON. That JSON is
 * derived from the markdown, and the markdown is what the author sees and
 * what the Fix stage rewrites — so injected rows existed only in the JSON:
 * every Validator run re-added the same 14 words, every Fix run lost them
 * again (Unit 2 oscillated 45 → 31 → 46 → 33 → 47), and the Lector reported
 * bare case forms like "šećera" as undidactic vocabulary that the author
 * could not find anywhere in the text.
 *
 * Now the Validator turns `missing` into blocking findings, the Fix stage
 * writes proper rows into the markdown (with note and category), and markdown
 * and JSON stay identical.
 */
export async function checkVocabularyCoverage(ctx: ActionCtx, pkg: any): Promise<{
  pkg: any;
  /** Used in the unit but absent from its vocabulary table; must be added. */
  missing: Array<{ serbian: string; suggestedEn: string }>;
  unresolvedNew: string[];
  alreadyTaughtUsed: Array<{ serbian: string; firstUnit: number; currentUnit: number }>;
  /** Belongs to a LATER unit; must not be pulled forward into this one. */
  taughtLater: Array<{ serbian: string; laterUnit: number }>;
  skippedProperNouns: Array<{ serbian: string; reason: "case_heuristic" | "ai_classifier" }>;
}> {
  const out = pkg && typeof pkg === "object" ? { ...pkg } : {};
  if (!out.vocabulary || typeof out.vocabulary !== "object") out.vocabulary = {};
  if (!Array.isArray(out.vocabulary.en)) out.vocabulary.en = [];

  const vocabEn: any[] = out.vocabulary.en;
  const existing = new Set(vocabEn.map((v: any) => normalizeSerbianKey(v?.serbian)));
  const existingKeys = Array.from(existing.values());

  // Words that are part of a multi-word entry (chunk) count as covered: the
  // learner sees "Dobar dan" translated as a whole, so "dan" needs no row of
  // its own. Without this, the token scan re-added chunk parts ("dan",
  // "zovem", "imam", "razumem") with invented glosses (2026-09-16).
  const coveredByChunk = new Set<string>();
  const addChunkParts = (key: string) => {
    if (!key.includes(" ")) return;
    for (const part of key.split(/\s+/)) {
      // One-letter parts count too: "u redu" covers "u" (2026-09-17).
      if (part.length >= 2 || ONE_LETTER_SERBIAN_WORDS.has(part)) coveredByChunk.add(part);
    }
  };
  for (const k of existingKeys) addChunkParts(k);

  // Pre-collect original-case text samples so we can detect proper nouns
  // BEFORE spending an AI classifier call on them.
  const originalTextSamples = collectOriginalSerbianTextSamples(out);
  const skippedProperNouns: Array<{ serbian: string; reason: "case_heuristic" | "ai_classifier" }> = [];

  // Load the admin-maintained "not-a-name" allowlist once. These tokens
  // override both the case heuristic and the AI classifier's proper-noun
  // decision so false positives (e.g. "ćao") stay admitted as vocabulary.
  let allowlistSet = new Set<string>();
  try {
    const allowlistKeys = await ctx.runQuery(
      internal.contentStudio.getAllowlistKeysInternal,
      {}
    );
    if (Array.isArray(allowlistKeys)) {
      allowlistSet = new Set<string>(allowlistKeys);
    }
  } catch (err) {
    console.warn("Proper-noun allowlist fetch failed, continuing without:", err);
  }

  // Load the admin-maintained name blacklist. Tokens on this list have been
  // explicitly confirmed as personal names and must never be auto-added again.
  let blacklistSet = new Set<string>();
  try {
    const blacklistKeys = await ctx.runQuery(
      internal.contentStudio.getBlacklistKeysInternal,
      {}
    );
    if (Array.isArray(blacklistKeys)) {
      blacklistSet = new Set<string>(blacklistKeys);
    }
  } catch (err) {
    console.warn("Name blacklist fetch failed, continuing without:", err);
  }

  const unitNumber = typeof out.unitNumber === "number" ? out.unitNumber : 1;

  // Course vocabulary of ALL units, once. Replaces one DB round-trip per
  // candidate and gives us the three facts the old per-word lookup could not
  // deliver: taught earlier, taught later, and part of an earlier unit's chunk.
  const taughtEarlierByKey = new Map<string, number>();
  const taughtLaterByKey = new Map<string, number>();
  const sameUnitEnByKey = new Map<string, string>();
  try {
    const courseVocab = await ctx.runQuery(api.vocabulary.getAllCourseVocabulary, {});
    for (const row of (courseVocab ?? []) as any[]) {
      if (row?.releaseStatus === "offline") continue;
      const key = normalizeSerbianKey(row?.serbian);
      const rowUnit = Number(row?.unitNumber);
      if (!key || !Number.isFinite(rowUnit)) continue;

      if (rowUnit < unitNumber) {
        const prev = taughtEarlierByKey.get(key);
        if (prev === undefined || rowUnit < prev) taughtEarlierByKey.set(key, rowUnit);
        // "Dobar dan" in Unit 1 covers "dobar" and "dan" here: the learner
        // knows the phrase, so the parts need no row of their own.
        addChunkParts(key);
      } else if (rowUnit > unitNumber) {
        const prev = taughtLaterByKey.get(key);
        if (prev === undefined || rowUnit < prev) taughtLaterByKey.set(key, rowUnit);
      } else {
        // Currently published version of THIS unit. It does NOT cover
        // anything: publishing replaces it, so a word that only exists there
        // would end up untaught. Its English translation is kept as a
        // suggestion so the gap can be reported without an AI call.
        // ("imamo" slipped past the net this way and surfaced as a Lector
        // finding instead of a deterministic error, 2026-09-17.)
        if (!sameUnitEnByKey.has(key)) {
          const en = String(row?.en ?? "").trim();
          if (en) sameUnitEnByKey.set(key, en);
        }
      }
    }
  } catch (err) {
    console.warn("Course vocabulary fetch failed; coverage check falls back to unit-local data:", err);
  }

  const exerciseCandidates = collectSerbianCandidatesFromExercises(out);
  const contentCandidates = collectSerbianCandidatesFromContent(out);
  const candidates = [...exerciseCandidates, ...contentCandidates]
    .map((s) => String(s || "").trim())
    .filter((s) => looksLikeVocabularyItem(s));

  const missing: Array<{ serbian: string; suggestedEn: string }> = [];
  const unresolvedNew: string[] = [];
  const alreadyTaughtUsed: Array<{ serbian: string; firstUnit: number; currentUnit: number }> = [];
  const taughtLater: Array<{ serbian: string; laterUnit: number }> = [];

  // Phase 1: Collect all candidates that need processing
  type CandidateInfo = {
    /** Token as it appears in the unit. The classifier sees this, not a guessed headword. */
    surface: string;
    lemma: string;
    fallbackEn: string;
    needsAiTranslation: boolean;
  };
  const candidatesToProcess: CandidateInfo[] = [];

  for (const serbian of candidates) {
    const key = normalizeSerbianKey(serbian);
    if (!key || existing.has(key)) continue;

    // Do not treat multi-word phrases as vocabulary items; those belong to Phrases/Dialogue, not vocabulary table.
    if (key.includes(" ")) continue;
    // Ignore very short tokens. (We allow 2-letter words like "od/sa".)
    // Exception: the one-letter function words are real vocabulary a beginner
    // needs. "i" (and) appears in Unit 1 dialogues and used to fall through
    // this guard, so nothing restored it after a Fix run dropped it.
    if (key.length < 2 && !ONE_LETTER_SERBIAN_WORDS.has(key)) continue;
    // Part of a chunk that is already in the table ("dan" in "Dobar dan").
    if (coveredByChunk.has(key)) continue;

    // Admin-confirmed name blacklist: if this token was previously deleted as
    // a personal name, never re-add it regardless of any other signal.
    if (blacklistSet.has(key)) continue;

    // Case heuristic: if the word appears capitalized mid-sentence, it is almost
    // certainly a personal name. Skip it immediately so we don't pollute vocabulary.
    //
    // For the weaker signal (word never seen lowercase but only sentence-initial),
    // we do NOT skip here — instead we let it proceed to the AI classifier phase
    // where it gets a proper linguistic evaluation. This prevents false positives
    // for common Serbian words that happen to appear only at sentence starts
    // (e.g. "Zovem se...", "Dobar dan!", "Zove se...").
    //
    // Exception: admin-confirmed allowlist entries override the heuristic so
    // the same false positives don't reappear after a cleanup review.
    if (!allowlistSet.has(key)) {
      const caseSignal = looksLikePersonalNameByContext(key, originalTextSamples);
      if (caseSignal === "strong") {
        if (!skippedProperNouns.some((p) => normalizeSerbianKey(p.serbian) === key)) {
          skippedProperNouns.push({ serbian: key, reason: "case_heuristic" });
        }
        continue;
      }
      // "weak" signal: don't skip — let AI classifier decide below.
    }

    // Exact key only. Inflection ("kartico", "sira") is decided by the
    // Serbian classifier below, which sees the known lemmas. Ending rules
    // must not guess a headword before that.
    const lemma = key;

    // Taught in an earlier unit: usable for review, must NOT be listed again.
    const earlierUnit = taughtEarlierByKey.get(lemma);
    if (earlierUnit !== undefined) {
      alreadyTaughtUsed.push({ serbian: lemma, firstUnit: earlierUnit, currentUnit: unitNumber });
      continue;
    }

    // Belongs to a LATER unit. Adding it here would duplicate the word across
    // two units and break the curriculum order, so report instead of adding.
    const laterUnit = taughtLaterByKey.get(lemma);
    if (laterUnit !== undefined) {
      taughtLater.push({ serbian: lemma, laterUnit });
      continue;
    }

    // Fallback list gives a safe translation without an AI call.
    // A same-unit published translation is NOT applied here: the surface may
    // be an inflection ("kartico") of a lemma already in the table, and the
    // classifier has to anchor it before anyone proposes a new row.
    const fallback = FALLBACK_VOCAB_PAIRS.find((p) => normalizeSerbianKey(p.serbian) === lemma);

    const fallbackEn = fallback ? fallback.en : "";
    candidatesToProcess.push({
      surface: key,
      lemma,
      fallbackEn,
      needsAiTranslation: !fallbackEn,
    });
  }

  const unitLemmas = expandLemmaKeys(existingKeys);
  const earlierLemmas = expandLemmaKeys(taughtEarlierByKey.keys());
  const laterLemmas = expandLemmaKeys(taughtLaterByKey.keys());
  const knownLemmas: string[] = [];
  const seenKnown = new Set<string>();
  for (const lemmaKey of [...unitLemmas, ...earlierLemmas, ...laterLemmas]) {
    if (seenKnown.has(lemmaKey)) continue;
    seenKnown.add(lemmaKey);
    knownLemmas.push(lemmaKey);
  }
  const lemmaWhere = { unit: unitLemmas, earlier: earlierLemmas, later: laterLemmas };
  const unitOf = (lemmaKey: string, full: Map<string, number>): number | undefined => {
    const direct = full.get(lemmaKey);
    if (direct !== undefined) return direct;
    for (const [phrase, phraseUnit] of full) {
      if (!phrase.includes(" ")) continue;
      if (phrase.split(/\s+/).includes(lemmaKey)) return phraseUnit;
    }
    return undefined;
  };

  // Phase 2: Classify and translate all words that need AI processing (single API call)
  const wordsNeedingClassification = candidatesToProcess
    .filter(c => c.needsAiTranslation)
    .map(c => c.surface);

  let classificationResults = new Map<string, SerbianWordClassification>();
  if (wordsNeedingClassification.length > 0) {
    try {
      classificationResults = await classifyAndTranslateWords(ctx, wordsNeedingClassification, knownLemmas);
      const serbianCount = Array.from(classificationResults.values()).filter(v => v.isSerbian).length;
      const anchoredCount = Array.from(classificationResults.values()).filter(v => v.lemma).length;
      console.log(`Classified ${classificationResults.size} words: ${serbianCount} Serbian, ${anchoredCount} with a dictionary form, ${classificationResults.size - serbianCount} English/other`);
    } catch (err) {
      console.warn("Classification failed:", err);
    }
  }

  // Phase 3: Anchor inflections the classifier recognized, then report only
  // real gaps. A new row is the dictionary form, never the case ending.
  for (const candidate of candidatesToProcess) {
    const surfaceKey = normalizeSerbianKey(candidate.surface);
    const classification = classificationResults.get(surfaceKey);

    if (classification?.lemma) {
      const anchor = resolveClassifierAnchor(candidate.surface, classification.lemma, seenKnown);
      const head = anchor ?? dictionaryHeadword(candidate.surface, classification.lemma);
      if (head) {
        const booking = bookKnownLemma(head, lemmaWhere);
        if (booking === "unit") {
          console.log(`Anchored '${candidate.surface}' to '${head}', already in this unit`);
          continue;
        }
        if (booking === "earlier") {
          const firstUnit = unitOf(head, taughtEarlierByKey);
          if (firstUnit !== undefined) {
            alreadyTaughtUsed.push({ serbian: head, firstUnit, currentUnit: unitNumber });
            console.log(`Anchored '${candidate.surface}' to '${head}', taught in Unit ${firstUnit}`);
            continue;
          }
        }
        if (booking === "later") {
          const laterUnit = unitOf(head, taughtLaterByKey);
          if (laterUnit !== undefined) {
            taughtLater.push({ serbian: head, laterUnit });
            continue;
          }
        }
        if (anchor) {
          // Named a known lemma but the booking sets did not contain it.
          // Still not a new headword.
          console.log(`Anchored '${candidate.surface}' to known lemma '${head}'`);
          continue;
        }
        candidate.lemma = head;
      }
    }

    let en = candidate.fallbackEn;

    // If no fallback, use classification result
    if (!en) {
      // Skip proper nouns (personal names) explicitly so we can report them.
      // Allowlist takes precedence: if an admin confirmed a word is regular
      // vocabulary, override the classifier and keep processing.
      if (classification?.isProperNoun) {
        const key = normalizeSerbianKey(candidate.lemma);
        if (!allowlistSet.has(key)) {
          if (!skippedProperNouns.some((p) => normalizeSerbianKey(p.serbian) === key)) {
            skippedProperNouns.push({ serbian: candidate.lemma, reason: "ai_classifier" });
          }
          console.log(`Skipping '${candidate.lemma}' - classified as proper noun (personal name)`);
          continue;
        }
        console.log(`Allowlist override: '${candidate.lemma}' classified as proper noun but confirmed as vocabulary`);
      }

      // Skip if classified as English/other/unknown (not Serbian)
      if (classification && !classification.isSerbian) {
        console.log(`Skipping '${candidate.lemma}' - classified as non-Serbian (English, unknown, or other)`);
        continue;
      }

      en = classification?.translation || sameUnitEnByKey.get(candidate.lemma) || "";
    }

    if (!en) {
      unresolvedNew.push(candidate.lemma);
      continue;
    }

    // Report only. The suggested translation goes into the finding so the Fix
    // stage can write a complete row into the MARKDOWN; nothing is injected
    // into the package here (see the function comment).
    missing.push({ serbian: candidate.lemma, suggestedEn: en });
  }

  // Deterministic dialect note: gde/gdje (Montenegro ijekavian vs Serbia ekavian)
  applyMontenegroVariantNotesToVocabulary(out);

  return { pkg: out, missing, unresolvedNew, alreadyTaughtUsed, taughtLater, skippedProperNouns };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function getMaxExerciseOrder(cats: any[]): number {
  let max = 0;
  for (const c of cats) {
    const qs = Array.isArray(c?.questions) ? c.questions : [];
    for (const q of qs) {
      const o = Number(q?.order);
      if (Number.isFinite(o) && o > max) max = o;
    }
  }
  return max;
}

export function collectExistingQuestionIds(cats: any[]): Set<string> {
  const ids = new Set<string>();
  for (const c of cats) {
    const qs = Array.isArray(c?.questions) ? c.questions : [];
    for (const q of qs) {
      const id = String(q?.questionId || "").trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

export function makeUniqueQuestionId(params: {
  unitNumber: number;
  exNumber: number;
  desiredIndex: number;
  existingIds: Set<string>;
}): string {
  let idx = params.desiredIndex;
  while (idx <= 99) {
    const candidate = `u${params.unitNumber}_ex${params.exNumber}_q${pad2(idx)}`;
    if (!params.existingIds.has(candidate)) {
      params.existingIds.add(candidate);
      return candidate;
    }
    idx += 1;
  }
  // Extremely unlikely; keep something deterministic even if it collides.
  const fallback = `u${params.unitNumber}_ex${params.exNumber}_q99`;
  params.existingIds.add(fallback);
  return fallback;
}

export function pickVocabPairsForExercises(pkg: any, count: number): Array<{ en: string; serbian: string; gender?: string }> {
  const raw = Array.isArray(pkg?.vocabulary?.en) ? pkg.vocabulary.en : [];
  const pairs = raw
    .map((v: any) => ({
      en: String(v?.en || "").trim(),
      serbian: String(v?.serbian || "").trim(),
      gender: typeof v?.gender === "string" ? v.gender.trim() : undefined,
    }))
    .filter((p: any) => p.en && p.serbian);

  if (pairs.length >= count) return pairs.slice(0, count);

  const needed = count - pairs.length;
  const extras = FALLBACK_VOCAB_PAIRS.filter(
    (p) => !pairs.some((x: { serbian: string }) => x.serbian.toLowerCase() === p.serbian.toLowerCase())
  );
  return [...pairs, ...extras.slice(0, needed)];
}

export function uniqueStrings(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of list) {
    const k = String(s || "").trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function buildMultipleChoiceOptions(pairs: Array<{ en: string; serbian: string }>, correct: string): string[] {
  const distractors = pairs.map((p) => p.serbian).filter((s) => s && s !== correct);
  const options = uniqueStrings([correct, ...distractors]).slice(0, 4);
  // Ensure minimum 3 options for template rules; pad with fallbacks if needed.
  if (options.length < 3) {
    const pad = FALLBACK_VOCAB_PAIRS.map((p) => p.serbian).filter((s) => s && s !== correct);
    for (const s of pad) {
      if (options.length >= 3) break;
      if (!options.includes(s)) options.push(s);
    }
  }
  return options;
}

export function toAccusativeForm(serbian: string, gender?: string): string {
  const s = String(serbian || "").trim();
  if (!s) return s;
  // Only handle single-token words deterministically; phrases stay as-is.
  if (s.includes(" ")) return s;

  // Special-case: masculine animate like "konobar" (waiter) -> "konobara"
  // (Used defensively in case it slips into dialogue completion. Prefer not to use roles at all.)
  if (normalizeSerbianKey(s) === "konobar") return "konobara";

  const g = String(gender || "").trim().toLowerCase();
  // Feminine nouns commonly end with -a and change to -u in accusative singular.
  if (g === "f" || s.toLowerCase().endsWith("a")) {
    // Avoid double conversion (already ends with 'u' etc.)
    if (s.toLowerCase().endsWith("a")) return s.slice(0, -1) + "u";
  }
  // Masculine inanimate & neuter: often same as nominative for our beginner content.
  return s;
}

export function isOrderableDialogueAnswer(pair: { en: string; serbian: string }): boolean {
  const en = String(pair?.en || "").trim().toLowerCase();
  const sr = normalizeSerbianKey(pair?.serbian);

  // Exclude roles/people and abstract service words.
  const excludedEn = new Set(["waiter", "server", "customer", "guest", "bill", "receipt", "please", "thank you", "excuse me"]);
  const excludedSr = new Set(["konobar", "gost", "račun", "molim", "hvala", "izvinite"]);
  if (excludedEn.has(en) || excludedSr.has(sr)) return false;

  // Prefer items you can order in a café (safe subset)
  const preferredEn = new Set(["coffee", "water", "juice", "milk", "tea", "beer", "wine"]);
  if (preferredEn.has(en)) return true;

  // Fallback: allow short nouns that look like items (1–2 words) and are not excluded
  if (sr && !sr.includes(" ") && sr.length >= 3) return true;
  return false;
}

export function pickOrderablePair(
  pairs: Array<{ en: string; serbian: string; gender?: string }>
): { en: string; serbian: string; gender?: string } | null {
  const list = Array.isArray(pairs) ? pairs : [];
  const firstPreferred = list.find((p) => {
    const en = String(p?.en || "").trim().toLowerCase();
    return ["coffee", "water", "juice", "milk", "tea"].includes(en);
  });
  if (firstPreferred && isOrderableDialogueAnswer(firstPreferred as any)) return firstPreferred;

  const any = list.find((p) => isOrderableDialogueAnswer(p as any));
  return any ?? null;
}

export function buildDialogueCompletionOptionsAccusative(
  pairs: Array<{ en: string; serbian: string; gender?: string }>,
  correctNom: string,
  correctGender?: string
): string[] {
  const correct = toAccusativeForm(correctNom, correctGender);
  const distractors = pairs
    .map((p) => toAccusativeForm(p.serbian, p.gender))
    .filter((s) => s && s !== correct);
  const options = uniqueStrings([correct, ...distractors]).slice(0, 4);
  if (options.length < 3) {
    const pad = FALLBACK_VOCAB_PAIRS.map((p) => toAccusativeForm(p.serbian, undefined)).filter((s) => s && s !== correct);
    for (const s of pad) {
      if (options.length >= 3) break;
      if (!options.includes(s)) options.push(s);
    }
  }
  return options;
}

export function appendExerciseOverviewToTestIntroduction(pkg: any): void {
  const en = pkg?.content?.en;
  if (!en || typeof en !== "object") return;
  if (typeof en.testIntroductionMd !== "string") en.testIntroductionMd = "";

  const current = String(en.testIntroductionMd || "");
  // Avoid appending multiple times.
  if (/#+\s*Exercise Overview/i.test(current)) return;

  const cats: any[] = Array.isArray(pkg?.exercises?.en) ? pkg.exercises.en : [];
  const byCat = new Map<string, number>();
  for (const c of cats) {
    const key = String(c?.category || "").trim();
    const qs = Array.isArray(c?.questions) ? c.questions : [];
    if (!key) continue;
    byCat.set(key, qs.length);
  }

  const labelFor = (key: string): string => {
    switch (key) {
      case "translation":
        return "Translation";
      case "fillInBlank":
        return "Fill in the Blank";
      case "multipleChoice":
        return "Multiple Choice";
      case "vocabularyMatching":
        return "Vocabulary Matching";
      case "dialogueCompletion":
        return "Dialogue Completion";
      default:
        return key;
    }
  };

  const orderedKeys = ["translation", "fillInBlank", "multipleChoice", "vocabularyMatching", "dialogueCompletion"];
  const lines: string[] = [];
  lines.push("#### Exercise Overview");
  lines.push("In this unit, you will practice with the following exercise types:");
  lines.push("");
  for (const k of orderedKeys) {
    if (!byCat.has(k)) continue;
    const n = byCat.get(k) ?? 0;
    lines.push(`- **${labelFor(k)}** (${n} questions)`);
  }
  // Include any extra categories that exist (deterministically), so overview stays truthful.
  for (const [k, n] of byCat.entries()) {
    if (orderedKeys.includes(k)) continue;
    lines.push(`- **${labelFor(k)}** (${n} questions)`);
  }

  const appendix = lines.join("\n").trim();
  const next = current.trim() ? `${current.trim()}\n\n${appendix}\n` : `${appendix}\n`;
  en.testIntroductionMd = next;
}

export function upgradeDialogueCompletionQuestions(pkg: any): void {
  if (!pkg || typeof pkg !== "object") return;
  const cats: any[] = Array.isArray(pkg?.exercises?.en) ? pkg.exercises.en : [];

  // Build gender lookup from unit vocabulary
  const vocabEn: any[] = Array.isArray(pkg?.vocabulary?.en) ? pkg.vocabulary.en : [];
  const genderBySerbian = new Map<string, string | undefined>();
  const vocabPairs: Array<{ en: string; serbian: string; gender?: string }> = [];
  for (const v of vocabEn) {
    const key = normalizeSerbianKey(v?.serbian);
    if (!key) continue;
    const g = typeof v?.gender === "string" ? v.gender.trim() : undefined;
    genderBySerbian.set(key, g);
    vocabPairs.push({
      en: String(v?.en || "").trim(),
      serbian: String(v?.serbian || "").trim(),
      gender: g,
    });
  }

  const dialogueTemplates = [
    ["Waiter: Šta želite?", "Customer: Ja bih _____."],
    ["Waiter: Šta biste želeli?", "Customer: Molim _____."],
    ["Waiter: Izvolite?", "Customer: Može _____."],
    ["Waiter: Šta ćete popiti?", "Customer: Ja bih _____."],
  ].map((lines) => lines.join("\n"));

  for (const cat of cats) {
    if (String(cat?.category || "") !== "dialogueCompletion") continue;
    if (!Array.isArray(cat?.questions)) continue;

    cat.questions = cat.questions.map((q: any) => {
      const existingQuestion = String(q?.question || "").trim();
      // Only apply the waiter template when the question does NOT already have
      // a proper dialogue format (speaker: text pattern).
      // A real dialogue question already contains ":" (e.g. "A: Zdravo. B: _____").
      // Placeholder or bare-sentence questions lack this pattern and get upgraded.
      const alreadyIsDialogue = /[A-Za-zšđčćž]+\s*:/.test(existingQuestion);
      if (alreadyIsDialogue) {
        // Question is already a real dialogue — leave it as-is.
        return q;
      }
      // Keep a consistent dialogue SNIPPET format, but vary the prompt text a bit to avoid repetition.
      const idx = (Number(q?.order ?? 0) || 0) % dialogueTemplates.length;
      const chosen = dialogueTemplates[idx] ?? dialogueTemplates[0];
      let nextQ: any = { ...q, question: chosen };

      // Grammar guard: for "Ja bih _____", prefer accusative for feminine nouns (kafa->kafu).
      const qText = String(nextQ?.question || "");
      const looksLikeJaBih = /ja\s+bih[\s\S]*_____/.test(qText.toLowerCase());
      if (looksLikeJaBih) {
        let caNom = String(nextQ?.correctAnswer || "").trim();
        let caGender = genderBySerbian.get(normalizeSerbianKey(caNom));

        // If the current answer is not an orderable item (e.g., konobar), pick a better deterministic one.
        const currentPair = { en: "", serbian: caNom };
        if (!isOrderableDialogueAnswer(currentPair as any)) {
          const picked = pickOrderablePair(vocabPairs);
          if (picked) {
            caNom = picked.serbian;
            caGender = picked.gender;
          }
        }

        const caAcc = toAccusativeForm(caNom, caGender);
        const optionsAcc = buildDialogueCompletionOptionsAccusative(vocabPairs, caNom, caGender);
        // Ensure correct is in options; if not, force it in.
        const fixedOptions = uniqueStrings([caAcc, ...optionsAcc]).slice(0, 4);
        nextQ = { ...nextQ, options: fixedOptions, correctAnswer: caAcc };
      }

      return nextQ;

    });
  }
}

export function ensureRequiredTemplateExerciseCategories(pkg: any): void {
  if (!pkg || typeof pkg !== "object") return;
  if (!pkg.exercises || typeof pkg.exercises !== "object") pkg.exercises = {};
  if (!Array.isArray(pkg.exercises.en)) pkg.exercises.en = [];

  const cats: any[] = pkg.exercises.en;
  const existing = new Set(cats.map((c) => String(c?.category || "")));
  const existingIds = collectExistingQuestionIds(cats);

  const unitNumber = typeof pkg.unitNumber === "number" && Number.isFinite(pkg.unitNumber) ? pkg.unitNumber : 1;
  let orderCounter = getMaxExerciseOrder(cats);
  const vocabPairs = pickVocabPairsForExercises(pkg, 6);

  for (const req of REQUIRED_TEMPLATE_EXERCISE_CATEGORIES) {
    if (existing.has(req.category)) continue;

    const questions: any[] = [];
    const perCat = Math.max(1, Math.min(6, vocabPairs.length));
    for (let i = 0; i < perCat; i++) {
      const pair = vocabPairs[i] ?? FALLBACK_VOCAB_PAIRS[i % FALLBACK_VOCAB_PAIRS.length];
      orderCounter += 1;

      const questionId = makeUniqueQuestionId({
        unitNumber,
        exNumber: req.exNumber,
        desiredIndex: i + 1,
        existingIds,
      });

      if (req.category === "translation") {
        questions.push({
          questionId,
          order: orderCounter,
          questionType: "translation",
          // Question text must be only the prompt (instructions belong in categoryInstructions / UI header).
          question: String(pair.en || "").trim(),
          correctAnswer: pair.serbian,
        });
        continue;
      }

      if (req.category === "fillInBlank") {
        questions.push({
          questionId,
          order: orderCounter,
          questionType: "fillInBlank",
          // Auditor expects a sentence containing the blank, not just a standalone blank token.
          question: `Ja bih _____. (I would like [blank].)`,
          correctAnswer: pair.serbian,
        });
        continue;
      }

      if (req.category === "multipleChoice") {
        const options = buildMultipleChoiceOptions(vocabPairs, pair.serbian);
        questions.push({
          questionId,
          order: orderCounter,
          questionType: "multipleChoice",
          question: String(pair.en || "").trim(),
          correctAnswer: pair.serbian,
          options,
        });
        continue;
      }

      if (req.category === "vocabularyMatching") {
        questions.push({
          questionId,
          order: orderCounter,
          questionType: "matching",
          question: `_____ = ${String(pair.en || "").trim()}`,
          correctAnswer: pair.serbian,
        });
        continue;
      }

      // dialogueCompletion (treated as multipleChoice in template rules)
      {
        const pick = pickOrderablePair(vocabPairs) ?? pair;
        const options = buildDialogueCompletionOptionsAccusative(vocabPairs, pick.serbian, pick.gender);
        questions.push({
          questionId,
          order: orderCounter,
          questionType: "multipleChoice",
          question: [
            "Waiter: Šta želite?",
            "Customer: Ja bih _____.",
          ].join("\n"),
          correctAnswer: toAccusativeForm(pick.serbian, pick.gender),
          options,
        });
      }
    }

    cats.push({
      category: req.category,
      categoryInstructions: req.defaultInstructions,
      questions,
    });
  }

  // Keep the written content consistent with the JSON exercises block (reduces auditor hallucinations).
  appendExerciseOverviewToTestIntroduction(pkg);
  // Auditor guardrail: dialogueCompletion should look like a dialogue snippet, not a bare sentence.
  upgradeDialogueCompletionQuestions(pkg);
}

export function buildAuditPayload(pkg: any, knownFromPreviousUnits?: string[]): any {
  const contentEn = pkg?.content?.en ?? {};
  const cats: any[] = Array.isArray(pkg?.exercises?.en) ? pkg.exercises.en : [];

  const exercises = cats.map((c: any) => {
    const qs: any[] = Array.isArray(c?.questions) ? c.questions : [];
    return {
      category: String(c?.category || ""),
      categoryInstructions: truncateForAudit(c?.categoryInstructions, 240),
      questions: qs.slice(0, 10).map((q: any) => ({
        questionId: String(q?.questionId || ""),
        order: q?.order,
        questionType: String(q?.questionType || ""),
        question: truncateForAudit(q?.question, 220),
        correctAnswer: truncateForAudit(q?.correctAnswer, 120),
        options: Array.isArray(q?.options) ? q.options.slice(0, 6).map((o: any) => truncateForAudit(o, 120)) : undefined,
      })),
      totalQuestions: qs.length,
    };
  });

  return {
    schemaVersion: String(pkg?.schemaVersion || ""),
    unitNumber: pkg?.unitNumber,
    module: pkg?.module,
    title: pkg?.title,
    description: pkg?.description,
    contentEn: {
      // The Lector must see the whole grammar section (v2 structure is
      // 3,000-5,000 chars) and complete dialogues; clitic placement and
      // out-of-scope forms hide in examples, not in the first paragraph.
      overviewMd: truncateForAudit(contentEn?.overviewMd, 2500),
      grammarMd: truncateForAudit(contentEn?.grammarMd, 8000),
      phrasesMd: truncateForAudit(contentEn?.phrasesMd, 4000),
      dialoguesMd: truncateForAudit(contentEn?.dialoguesMd, 4000),
      testIntroductionMd: truncateForAudit(contentEn?.testIntroductionMd, 1600),
    },
    // Provide FULL vocabulary keys so the auditor never misfires due to sampling.
    vocabularyKeys: Array.isArray(pkg?.vocabulary?.en)
      ? pkg.vocabulary.en.map((v: any) => String(v?.serbian || "").trim()).filter(Boolean)
      : [],
    // Words the learner already knows from earlier units. Inside the payload
    // because the model checks payload fields and overlooks the same list in
    // the system prompt: it reported "imam" as untaught although Unit 1
    // teaches it (2026-09-17).
    knownFromPreviousUnits: Array.isArray(knownFromPreviousUnits)
      ? knownFromPreviousUnits.slice(0, 400)
      : [],
    // Enriched entries: the Lector checks translations and notes here, so it
    // must see every entry. The cap only guards against a runaway package;
    // a micro-unit stays well below it (<= 35 by curriculum rule).
    vocabularySample: Array.isArray(pkg?.vocabulary?.en)
      ? pkg.vocabulary.en.slice(0, 80).map((v: any) => ({
          serbian: String(v?.serbian || ""),
          en: String(v?.en || ""),
          noteEn: typeof v?.noteEn === "string" ? truncateForAudit(v.noteEn, 200) : undefined,
          gender: v?.gender,
        }))
      : [],
    exercises,
  };
}

export function fillMissingUnitPackageFields(candidate: any, fallback: any): any {
  const fb = fallback && typeof fallback === "object" ? fallback : {};
  const out: any = candidate && typeof candidate === "object" ? { ...candidate } : {};

  // Hard literals (current app assumptions)
  out.schemaVersion = "unitPackage.v1";
  out.baseLanguage = "en";
  out.targetLanguage = "sr";
  out.languages = ["en"];

  // Required scalars
  if (typeof out.unitNumber !== "number" || !Number.isFinite(out.unitNumber) || out.unitNumber <= 0) {
    out.unitNumber = typeof (fb as any).unitNumber === "number" ? (fb as any).unitNumber : 1;
  }
  if (typeof out.title !== "string" || !out.title.trim()) {
    out.title = typeof (fb as any).title === "string" ? String((fb as any).title) : `Unit ${out.unitNumber}`;
  }
  if (out.description !== undefined && typeof out.description !== "string") {
    out.description = typeof (fb as any).description === "string" ? String((fb as any).description) : undefined;
  }

  // Module object
  const fbModule = (fb as any).module && typeof (fb as any).module === "object" ? (fb as any).module : null;
  if (!out.module || typeof out.module !== "object") {
    out.module = fbModule ?? { moduleNumber: 1, title: "Ankommen (Arrival)" };
  } else {
    if (
      typeof (out.module as any).moduleNumber !== "number" ||
      !Number.isFinite((out.module as any).moduleNumber) ||
      (out.module as any).moduleNumber <= 0
    ) {
      (out.module as any).moduleNumber = typeof fbModule?.moduleNumber === "number" ? fbModule.moduleNumber : 1;
    }
    if (typeof (out.module as any).title !== "string" || !(out.module as any).title.trim()) {
      (out.module as any).title = typeof fbModule?.title === "string" ? fbModule.title : "Ankommen (Arrival)";
    }
  }

  // Content record
  const fbContent = (fb as any).content && typeof (fb as any).content === "object" ? (fb as any).content : {};
  if (!out.content || typeof out.content !== "object") out.content = fbContent;
  if (!(out.content as any).en || typeof (out.content as any).en !== "object") (out.content as any).en = (fbContent as any).en ?? {};

  const fbEn = (fbContent as any).en && typeof (fbContent as any).en === "object" ? (fbContent as any).en : {};
  const en = (out.content as any).en as any;
  const mdKeys = ["overviewMd", "grammarMd", "phrasesMd", "dialoguesMd", "testIntroductionMd"] as const;
  for (const k of mdKeys) {
    if (typeof en[k] !== "string") en[k] = typeof fbEn[k] === "string" ? fbEn[k] : "";
  }
  if (en.vocabularyMd !== undefined && typeof en.vocabularyMd !== "string") {
    en.vocabularyMd = typeof fbEn.vocabularyMd === "string" ? fbEn.vocabularyMd : undefined;
  }

  // Vocabulary record
  const fbVocab = (fb as any).vocabulary && typeof (fb as any).vocabulary === "object" ? (fb as any).vocabulary : {};
  if (!out.vocabulary || typeof out.vocabulary !== "object") out.vocabulary = fbVocab;
  if (!Array.isArray((out.vocabulary as any).en)) (out.vocabulary as any).en = Array.isArray((fbVocab as any).en) ? (fbVocab as any).en : [];

  // Exercises record
  const fbEx = (fb as any).exercises && typeof (fb as any).exercises === "object" ? (fb as any).exercises : {};
  if (!out.exercises || typeof out.exercises !== "object") out.exercises = fbEx;
  if (!Array.isArray((out.exercises as any).en)) (out.exercises as any).en = Array.isArray((fbEx as any).en) ? (fbEx as any).en : [];

  // Content Studio guardrail: ensure required template exercise categories exist at least as a valid skeleton.
  // Deterministic guardrail: prevents the revision loop from getting stuck if the Creator misses categories.
  ensureRequiredTemplateExerciseCategories(out);

  return out;
}

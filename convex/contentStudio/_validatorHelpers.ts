import { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { callAiText, truncateForAudit } from "./_shared";

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
  return String(s ?? "")
    .trim()
    // Strip markdown wrappers/backticks/bold/quotes (anywhere)
    .replace(/[`"'*_]/g, "")
    // Strip trailing punctuation that sometimes sneaks into lists (e.g. "od.")
    .replace(/[.?!,:;]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
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

export function applyMontenegroVariantNotesToVocabulary(pkg: any): { changed: number } {
  const vocabEn: any[] = Array.isArray(pkg?.vocabulary?.en) ? pkg.vocabulary.en : [];
  let changed = 0;

  for (const v of vocabEn) {
    const key = normalizeSerbianKey(v?.serbian);
    const prev = typeof v?.noteEn === "string" ? v.noteEn : "";
    // Skip if already has Montenegro note
    if (/montenegro:|variant.*montenegro/i.test(prev)) continue;

    let note: string | null = null;
    if (EKAVIAN_TO_IJEKAVIAN[key]) {
      note = `Montenegro: ${EKAVIAN_TO_IJEKAVIAN[key]} (ijekavian).`;
    } else if (IJEKAVIAN_TO_EKAVIAN[key]) {
      note = `Variant (Serbia): ${IJEKAVIAN_TO_EKAVIAN[key]} (ekavian).`;
    }

    if (!note) continue;

    const next = appendNoteEn(prev, note);
    if (next !== prev) {
      v.noteEn = next;
      changed += 1;
    }
  }

  return { changed };
}

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

const COMMON_SERBIAN_FUNCTION_WORDS = new Set([
  "je", "su", "sam", "si", "smo", "ste",
  "i", "a", "ali", "ili", "ni", "niti",
  "u", "na", "sa", "za", "od", "do", "iz", "po", "o", "ka", "kod", "bez", "kroz", "između",
  "da", "ne", "li", "se", "bi", "ce", "cu",
  "ja", "ti", "on", "ona", "ono", "mi", "vi", "oni", "one",
  "taj", "ta", "to", "ova", "ovo", "ovaj",
  "što", "šta", "ko", "gde", "kad", "kako", "zašto",
  "još", "već", "sad", "tu", "ovde", "onde",
  "vrlo", "baš", "samo", "još",
]);

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

  return Array.from(new Set(out.filter(Boolean)));
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
    .filter(w => w.length >= 2 && !COMMON_SERBIAN_FUNCTION_WORDS.has(w));
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
 * Logic:
 *  - We look at every occurrence of the word (case-insensitive) in the original samples.
 *  - If the word appears CAPITALIZED mid-sentence (i.e. not as the first token of a
 *    sentence / sample and not after ".", "!", "?"), it is almost certainly a proper noun.
 *  - If the word appears ONLY capitalized (even when counting sentence-initial
 *    positions — where capitalization is ambiguous because every sentence-initial word
 *    is capitalized in Serbian too), and never lowercase, we treat it as a
 *    "suspected proper noun" and return true as well. This catches single-word
 *    answers like "Elena" where the word is always at position 0.
 *  - Otherwise (mixed case, or only-lowercase) we return false and let downstream
 *    logic (dictionary lookup + AI classifier) decide.
 *
 * This runs BEFORE the AI classifier, so it saves an API call for obvious cases
 * and protects against the classifier mis-labeling a name as a regular Serbian word.
 */
export function looksLikePersonalNameByContext(lemma: string, samples: string[]): boolean {
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
        lastCharBefore === "|";

      if (!isSentenceInitial) {
        sawCapitalMidSentence = true;
      }
    }
  }

  // No occurrences at all → heuristic cannot decide.
  if (!sawAnyOccurrence) return false;

  // Strong signal: capitalized mid-sentence at least once.
  if (sawCapitalMidSentence) return true;

  // Weaker signal: never seen lowercase anywhere. In Serbian, regular vocabulary
  // appears lowercase somewhere (in tables, hints, options). A word that is
  // ALWAYS capitalized is most likely a proper noun — but only treat as such if
  // there is no lowercase evidence at all.
  if (!sawLowercase) return true;

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

/**
 * Classify and translate words - determines if each word is Serbian or English,
 * and provides English translation for Serbian words.
 * Returns a Map of word -> { isSerbian: boolean, translation?: string }
 */
export async function classifyAndTranslateWords(
  ctx: ActionCtx,
  words: string[],
): Promise<Map<string, { isSerbian: boolean; translation?: string; isProperNoun?: boolean }>> {
  const cleanWords = words
    .map(w => String(w || "").trim())
    .filter(w => w.length > 0);
  
  if (cleanWords.length === 0) return new Map();

  const system = [
    `You are a language classifier and Serbian-English translator.`,
    `For each word, classify it into one of three categories.`,
    ``,
    `Return a JSON object where each key is a word and the value is ONE of:`,
    `- Serbian vocabulary word: { "lang": "sr", "en": "<English translation>" }`,
    `- English / grammar term / other language: { "lang": "en" }`,
    `- Personal name of a human (first name, given name, nickname): { "lang": "proper_noun" }`,
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
    ``,
    `Keep translations short (1-3 words).`,
  ].join("\n");

  const userPrompt = JSON.stringify(cleanWords);

  const { raw } = await callAiText(ctx, {
    stage: "specialist",
    system,
    user: userPrompt,
    maxTokens: 2000,
  });

  const result = new Map<string, { isSerbian: boolean; translation?: string; isProperNoun?: boolean }>();

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
        if (lang === "sr" && data?.en) {
          result.set(word.toLowerCase(), { isSerbian: true, translation: String(data.en).trim() });
        } else if (lang === "proper_noun") {
          result.set(word.toLowerCase(), { isSerbian: false, isProperNoun: true });
        } else {
          result.set(word.toLowerCase(), { isSerbian: false });
        }
      }
    }
  } catch (err) {
    console.warn("Failed to parse classification response:", err);
  }

  return result;
}

export async function syncVocabularyCoverageFromExercises(ctx: ActionCtx, pkg: any): Promise<{
  pkg: any;
  added: Array<{ serbian: string; en: string; fromUnit?: number }>;
  unresolvedNew: string[];
  alreadyTaughtUsed: Array<{ serbian: string; firstUnit: number; currentUnit: number }>;
  skippedProperNouns: Array<{ serbian: string; reason: "case_heuristic" | "ai_classifier" }>;
}> {
  const out = pkg && typeof pkg === "object" ? { ...pkg } : {};
  if (!out.vocabulary || typeof out.vocabulary !== "object") out.vocabulary = {};
  if (!Array.isArray(out.vocabulary.en)) out.vocabulary.en = [];

  const vocabEn: any[] = out.vocabulary.en;
  const existing = new Set(vocabEn.map((v: any) => normalizeSerbianKey(v?.serbian)));
  const existingKeys = Array.from(existing.values());

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

  const isLikelyInflectedFormOfUnitVocab = (candidate: string): string | null => {
    const key = normalizeSerbianKey(candidate);
    if (!key || key.length < 3) return null;

    // Deterministic: common beginner accusative feminine a->u (kafa->kafu, voda->vodu, jedna->jednu, etc.)
    if (key.endsWith("u")) {
      const baseA = key.slice(0, -1) + "a";
      if (existing.has(baseA)) return baseA;
    }

    // Deterministic: common instrumental "-om" -> base "-o" (mlijekom -> mlijeko)
    if (key.endsWith("om") && key.length > 3) {
      const baseO = key.slice(0, -2) + "o";
      if (existing.has(baseO)) return baseO;
    }

    // Heuristic fallback: if it shares a 3+ letter prefix with an existing unit vocab key, treat as an inflected form.
    // Example: "mlijekom" -> "mlijeko".
    const prefix = key.slice(0, Math.min(3, key.length));
    const match = existingKeys.find((k) => k.startsWith(prefix) || prefix.startsWith(k.slice(0, Math.min(3, k.length))));
    return match || null;
  };

  const exerciseCandidates = collectSerbianCandidatesFromExercises(out);
  const contentCandidates = collectSerbianCandidatesFromContent(out);
  const candidates = [...exerciseCandidates, ...contentCandidates]
    .map((s) => String(s || "").trim())
    .filter((s) => looksLikeVocabularyItem(s));

  const added: Array<{ serbian: string; en: string; fromUnit?: number }> = [];
  const unresolvedNew: string[] = [];
  const alreadyTaughtUsed: Array<{ serbian: string; firstUnit: number; currentUnit: number }> = [];

  const unitNumber = typeof out.unitNumber === "number" ? out.unitNumber : 1;

  // Phase 1: Collect all candidates that need processing
  type CandidateInfo = {
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
    if (key.length < 2) continue;

    // Case heuristic: if the word appears capitalized mid-sentence (or is ALWAYS
    // capitalized and never lowercase) in the original text, it is almost
    // certainly a personal name. Skip it so we don't pollute vocabulary.
    // Runs before the AI classifier to save tokens and avoid mis-classification.
    //
    // Exception: admin-confirmed allowlist entries override the heuristic so
    // the same false positives don't reappear after a cleanup review.
    if (
      !allowlistSet.has(key) &&
      looksLikePersonalNameByContext(key, originalTextSamples)
    ) {
      if (!skippedProperNouns.some((p) => normalizeSerbianKey(p.serbian) === key)) {
        skippedProperNouns.push({ serbian: key, reason: "case_heuristic" });
      }
      continue;
    }

    // If it's likely an inflected form of an existing unit vocab word, don't block or auto-add.
    if (isLikelyInflectedFormOfUnitVocab(key)) continue;

    // If it looks like an inflected form, prefer adding the lemma (base form), not the inflected surface form.
    let lemma = key;
    if (key.endsWith("u") && key.length > 3) {
      lemma = key.slice(0, -1) + "a";
    } else if (key.endsWith("om") && key.length > 3) {
      lemma = key.slice(0, -2) + "o";
    }
    // If lemma is already in unit vocab, stop (it's covered).
    if (lemma !== key && existing.has(lemma)) continue;

    // 1) Try DB dictionary (courseVocabulary) for exact Serbian string.
    let found: any[] = [];
    try {
      found = await ctx.runQuery(api.vocabulary.findVocabularyBySerbian, { serbian: lemma });
    } catch {
      found = [];
    }

    // 2) Fallback list if DB doesn't have it.
    const fallback = FALLBACK_VOCAB_PAIRS.find((p) => normalizeSerbianKey(p.serbian) === lemma);

    const activeFound = Array.isArray(found) ? found.filter((e: any) => e?.isActive !== false && e?.releaseStatus !== "offline") : [];
    const taughtEarlier = activeFound
      .filter((e: any) => isTaughtEarlier(e, unitNumber))
      .sort((a: any, b: any) => (a.unitNumber ?? 9999) - (b.unitNumber ?? 9999));
    const firstTaught = taughtEarlier.length ? taughtEarlier[0] : null;

    // If already taught in earlier unit: do NOT auto-add to this unit's vocabulary.
    if (firstTaught) {
      alreadyTaughtUsed.push({ serbian: lemma, firstUnit: Number(firstTaught.unitNumber), currentUnit: unitNumber });
      continue;
    }

    // Collect for processing
    const fallbackEn = fallback ? fallback.en : "";
    candidatesToProcess.push({
      lemma,
      fallbackEn,
      needsAiTranslation: !fallbackEn,
    });
  }

  // Phase 2: Classify and translate all words that need AI processing (single API call)
  const wordsNeedingClassification = candidatesToProcess
    .filter(c => c.needsAiTranslation)
    .map(c => c.lemma);

  let classificationResults = new Map<
    string,
    { isSerbian: boolean; translation?: string; isProperNoun?: boolean }
  >();
  if (wordsNeedingClassification.length > 0) {
    try {
      classificationResults = await classifyAndTranslateWords(ctx, wordsNeedingClassification);
      const serbianCount = Array.from(classificationResults.values()).filter(v => v.isSerbian).length;
      console.log(`Classified ${classificationResults.size} words: ${serbianCount} Serbian, ${classificationResults.size - serbianCount} English/other`);
    } catch (err) {
      console.warn("Classification failed:", err);
    }
  }

  // Phase 3: Process all candidates with translations (skip English words + proper nouns)
  for (const candidate of candidatesToProcess) {
    let en = candidate.fallbackEn;

    // If no fallback, use classification result
    if (!en) {
      const classification = classificationResults.get(candidate.lemma.toLowerCase());

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

      // Skip if classified as English/other (not Serbian)
      if (classification && !classification.isSerbian) {
        console.log(`Skipping '${candidate.lemma}' - classified as English/other`);
        continue;
      }

      en = classification?.translation || "";
    }

    if (!en) {
      unresolvedNew.push(candidate.lemma);
      continue;
    }

    const noteBits: string[] = ["AutoAdded: new vocabulary used in exercises"];

    vocabEn.push({
      serbian: candidate.lemma,
      en,
      noteEn: noteBits.join("\n"),
    });
    existing.add(candidate.lemma);
    added.push({ serbian: candidate.lemma, en, fromUnit: undefined });
  }

  // Deterministic dialect note: gde/gdje (Montenegro ijekavian vs Serbia ekavian)
  applyMontenegroVariantNotesToVocabulary(out);

  return { pkg: out, added, unresolvedNew, alreadyTaughtUsed, skippedProperNouns };
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

export function buildAuditPayload(pkg: any): any {
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
      // Keep only the parts auditors actually reason about; avoid huge payloads.
      overviewMd: truncateForAudit(contentEn?.overviewMd, 1600),
      grammarMd: truncateForAudit(contentEn?.grammarMd, 1200),
      phrasesMd: truncateForAudit(contentEn?.phrasesMd, 1200),
      dialoguesMd: truncateForAudit(contentEn?.dialoguesMd, 1200),
      testIntroductionMd: truncateForAudit(contentEn?.testIntroductionMd, 1600),
    },
    // Provide FULL vocabulary keys so the auditor never misfires due to sampling.
    vocabularyKeys: Array.isArray(pkg?.vocabulary?.en)
      ? pkg.vocabulary.en.map((v: any) => String(v?.serbian || "").trim()).filter(Boolean)
      : [],
    // Keep a small sample of enriched entries for context (optional)
    vocabularySample: Array.isArray(pkg?.vocabulary?.en)
      ? pkg.vocabulary.en.slice(0, 20).map((v: any) => ({
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

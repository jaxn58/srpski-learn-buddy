/**
 * Deterministic check for the most frequent Serbian error the Creator makes:
 * an enclitic in first position ("Sam dobro." instead of "Dobro sam.").
 *
 * Enclitics (short verb forms, short pronouns, the particle li) cannot open a
 * sentence or clause; they take second position. The LLM stages know the rule
 * (cs_language_rules) and still slip; this check makes it a validator error so
 * a slip never reaches the learner, whatever the models do.
 *
 * Deliberately conservative: only tokens that have NO other reading at the
 * start of a sentence are flagged. Excluded on purpose:
 *   je   - "Je li ovo ...?" is a correct question opener
 *   mi   - also the pronoun "we" ("Mi smo ...")
 *   ti   - also the pronoun "you" ("Ti si ...")
 *   te   - also the demonstrative "those" ("Te knjige ...")
 *   me   - rare, but keep the false-positive rate at zero
 */
const LEADING_CLITICS = new Set([
  "sam", "si", "smo", "ste", "su", // biti, short forms
  "se", // reflexive
  "ga", "ih", "mu", "joj", "nam", "vam", "im", // short pronouns
  "li", // question particle
]);

const WORD = "[A-Za-zČĆĐŠŽčćđšž]+";
const LEADING_CLITIC_RE = new RegExp(`^\\s*[\"'„“(«-]*\\s*(${WORD})\\s+(${WORD})`);

export interface LeadingCliticHit {
  /** The offending sentence, trimmed, without markdown emphasis. */
  sentence: string;
  /** The clitic found in first position (lower-case). */
  clitic: string;
}

/** Remove markdown emphasis and code marks so word boundaries are clean. */
function stripInlineMarkdown(text: string): string {
  return String(text ?? "")
    .replace(/\*\*|__|\*|_(?!_)|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split a Serbian passage into clauses. An enclitic needs a host word in its
 * OWN clause, so every clause boundary counts as a "sentence start" for this
 * check: full stops, but also commas, semicolons, colons and dashes.
 * "Da, sam gospodin Petrović." is as wrong as "Sam gospodin Petrović."
 * (the Lector caught exactly this in a Unit 1 draft on 2026-09-16, after the
 * first version of this check had let it through).
 */
function splitSentences(text: string): string[] {
  return stripInlineMarkdown(text)
    .split(/(?<=[.!?,;:–—])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Put the correct answer into the blank of a fill-in stem so the resulting
 * sentence can be checked as the learner will read it. Without this, the
 * blank hid the clitic: "Da, _____ gospodin Petrović." + "sam" was never
 * seen as "Da, sam gospodin Petrović.".
 */
export function fillBlankWithAnswer(stem: string, answer: string | undefined): string {
  const a = String(answer ?? "").replace(/^[A-D]\)\s*/, "").trim();
  if (!/_{2,}/.test(stem)) return stem;
  return stem.replace(/_{2,}/, a || "x");
}

/** Check a Serbian passage (one cell, one example, one dialogue line). */
export function findLeadingClitics(serbianText: string): LeadingCliticHit[] {
  const hits: LeadingCliticHit[] = [];
  for (const sentence of splitSentences(serbianText)) {
    const m = sentence.match(LEADING_CLITIC_RE);
    if (!m) continue;
    const first = m[1].toLowerCase();
    if (!LEADING_CLITICS.has(first)) continue;
    hits.push({ sentence, clitic: first });
  }
  return hits;
}

/**
 * Serbian text of a grammar example bullet: everything before the English
 * translation in parentheses. Returns null for lines that are not examples.
 */
export function serbianOfExampleLine(line: string): string | null {
  const m = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*?)\s*\((?:[^()]*)\)\s*$/);
  return m ? m[1] : null;
}

/**
 * Serbian cells of GFM tables whose header contains a "Serbian" column
 * (vocabulary, phrases, dialogues). Header-agnostic otherwise.
 */
export function serbianCellsOfTables(markdown: string): string[] {
  const out: string[] = [];
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  let serbianIdx = -1;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("|")) {
      serbianIdx = -1;
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.some((c) => /^:?-{3,}:?$/.test(c))) continue; // separator row
    const headerIdx = cells.findIndex((c) => /serbian/i.test(c));
    if (headerIdx >= 0 && serbianIdx === -1) {
      serbianIdx = headerIdx;
      continue;
    }
    if (serbianIdx >= 0 && cells[serbianIdx]) out.push(cells[serbianIdx]);
  }
  return out;
}

/** Fill-in-the-blank stems carry the English translation in parentheses; strip it. */
function serbianOfExerciseStem(text: string): string {
  return String(text ?? "").replace(/\([^)]*\)\s*$/, "").trim();
}

export interface CliticIssue {
  path: Array<string | number>;
  message: string;
}

/**
 * Scan every place a learner reads Serbian: grammar examples, phrase and
 * dialogue tables, exercise stems, options and answers.
 */
export function collectLeadingCliticIssues(pkg: {
  content?: Record<string, { grammarMd?: string; phrasesMd?: string; dialoguesMd?: string } | undefined>;
  exercises?: Record<string, Array<{ category: string; questions: Array<{ questionId: string; question: string; options?: string[]; correctAnswer?: string }> }> | undefined>;
  languages?: string[];
}): CliticIssue[] {
  const issues: CliticIssue[] = [];
  const langs = Array.isArray(pkg.languages) && pkg.languages.length > 0 ? pkg.languages : ["en"];

  const report = (path: Array<string | number>, text: string) => {
    for (const hit of findLeadingClitics(text)) {
      issues.push({
        path,
        message: `Enclitic "${hit.clitic}" cannot start a sentence: "${hit.sentence}". Move it to second position (e.g. "Dobro sam." not "Sam dobro.").`,
      });
    }
  };

  for (const lang of langs) {
    const content = pkg.content?.[lang];
    if (content) {
      for (const line of String(content.grammarMd ?? "").split("\n")) {
        const sr = serbianOfExampleLine(line);
        if (sr) report(["content", lang, "grammarMd"], sr);
      }
      for (const cell of serbianCellsOfTables(String(content.phrasesMd ?? ""))) report(["content", lang, "phrasesMd"], cell);
      for (const cell of serbianCellsOfTables(String(content.dialoguesMd ?? ""))) report(["content", lang, "dialoguesMd"], cell);
    }

    const cats = pkg.exercises?.[lang] ?? [];
    for (const cat of cats) {
      for (const q of cat.questions ?? []) {
        const base: Array<string | number> = ["exercises", lang, `category=${cat.category}`, `questionId=${q.questionId}`];
        // Stems: fillInBlank ("Ja _____ Alex. (I am Alex.)") and dialogue ("A: ... B: _____").
        // Checked WITH the correct answer in the blank, as the learner reads it.
        if (cat.category === "fillInBlank" || cat.category === "dialogueCompletion") {
          const stem = serbianOfExerciseStem(q.question);
          const filled = fillBlankWithAnswer(stem, q.correctAnswer);
          // "A: ... B: ..." are two speakers, i.e. two independent utterances.
          for (const utterance of filled.split(/\b[AB]:\s*/).map((s) => s.trim()).filter(Boolean)) {
            report([...base, "question"], utterance);
          }
        }
        for (const opt of q.options ?? []) report([...base, "options"], opt.replace(/^[A-D]\)\s*/, ""));
        if (q.correctAnswer) report([...base, "correctAnswer"], q.correctAnswer.replace(/^[A-D]\)\s*/, ""));
      }
    }
  }
  return issues;
}

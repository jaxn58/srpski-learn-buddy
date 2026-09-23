import type { ActionCtx } from "../_generated/server";
import {
  callAiJson,
  closeTruncatedJson,
  extractCompleteJsonObjects,
  languageRulesBlock,
  parseJsonOrThrow,
  resolvePromptFromDb,
  type Provider,
} from "./_shared";
import { CS_PROMPT_KEYS } from "./prompts";
import {
  CODE_DEFAULT_PROMPT_COGNATES,
  loadMergedPromptCognates,
  normalizeCognateTerm,
} from "./_translatorCognates";

/**
 * Keep in sync with `isFillInSourceCue` / `isHelpTranslationGloss` in `_translationCore.ts`.
 * Duplicated here to avoid a circular import (translationCore → verifier).
 */
function isFillInSourceCue(gloss: string): boolean {
  const g = String(gloss || "").trim();
  if (!g) return false;
  if (/_+/.test(g)) return false;
  if (/[.!?…]/.test(g)) return false;
  const words = g.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (
    words.length >= 3 &&
    /^(it|this|that|there|here|she|he|they|we|you|i|ana|marko|marija)\b/i.test(g)
  ) {
    return false;
  }
  return true;
}

function isHelpTranslationGloss(gloss: string): boolean {
  const g = String(gloss || "").trim();
  if (!g) return false;
  if (isFillInSourceCue(g)) return false;
  return true;
}

/**
 * Serbian <-> German translation verifier.
 *
 * Given items with { serbian, english, german }, asks an LLM to compare
 * the Serbian original against the German translation (using English only
 * as a bridge reference). Returns a structured report with severity-tagged
 * issues so the caller can decide whether to retry translation with feedback.
 */

export type VerifierSeverity = "info" | "warning" | "critical";

export type VerifierItemKind = "vocabulary" | "test" | "section" | "metadata";

export interface VerifierInputItem {
  /** Stable key used by the caller to correlate issues back to items. */
  key: string;
  kind: VerifierItemKind;
  /** Human-readable label, e.g. "vocabulary: 'sok od jabuke'" or "section: grammar". */
  label: string;
  /** Interactive test questionType when kind === "test" (e.g. translation, matching, multipleChoice). */
  questionType?: string;
  /** The Serbian original (word, phrase, or Serbian content extracted from markdown). */
  serbian: string;
  /** English bridge/reference text. */
  english: string;
  /** German translation under review. */
  german: string;
}

export interface VerifierIssue {
  /** Item key from the input (matches VerifierInputItem.key). */
  itemKey: string;
  itemLabel: string;
  itemKind: VerifierItemKind;
  severity: VerifierSeverity;
  /** Short machine-readable category, e.g. "semantic_mismatch", "missing_info". */
  code: string;
  /** Human-readable description of the issue. */
  issue: string;
  /** Suggested German rewrite or concrete advice for the retry pass. */
  suggestion?: string;
}

export interface VerifierReport {
  itemsChecked: number;
  issues: VerifierIssue[];
  criticals: VerifierIssue[];
  warnings: VerifierIssue[];
  infos: VerifierIssue[];
  durationMs: number;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
  estimatedCostUsd: number | null;
  /** Short AI error if a verifier batch failed. Deterministic issues may still be present. */
  error?: string;
  /** Label so the client can distinguish pass 1 vs pass 2 verifier runs. */
  pass: "pass1" | "pass2";
}

function extractVerifierQuestion(side: string, lang: "EN" | "DE"): string {
  const re = new RegExp(`Question \\(${lang}\\):\\s*([\\s\\S]*?)(?:\\nHint \\(${lang}\\):|$)`);
  const m = String(side || "").match(re);
  return (m?.[1] ?? "").trim();
}

function extractParentheticalGlossesFromText(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text || "").matchAll(/\(([^)]+)\)/g)) {
    const g = String(m[1] ?? "").trim();
    if (g) out.push(g);
  }
  return out;
}

/**
 * Parenthetical glosses are judged by the deterministic checker before the
 * AI call. The AI sees the stem only, so it cannot demand or reject a gloss
 * that the contract already decided.
 */
export function textForSemanticVerification(text: string): string {
  return String(text || "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.?!])/g, "$1")
    .trim();
}

/** Fill-in, dialogue, and a multiple-choice stem that is itself Serbian stay Serbian on the DE track. */
export function serbianExerciseStemStays(questionType: string, question: string): boolean {
  const qType = String(questionType || "").trim();
  if (qType === "fillInBlank" || qType === "dialogue") return true;
  if (qType !== "multipleChoice") return false;
  const stem = textForSemanticVerification(question);
  if (/^(?:A|B)\s*:/i.test(stem)) return true;
  if (/_+/.test(stem)) return true;
  if (/[čćšžđČĆŠŽĐ]/.test(stem)) return true;
  if (/\b(je|sam|si|su|ona|on|mi|vi|kako|odakle|zove|radi|predaje)\b/i.test(stem)) return true;
  return false;
}

/**
 * For a Serbian exercise stem the only German text is the learner gloss (and
 * an optional hint). The stem itself is not a translation, so it is not sent
 * as the German question.
 */
export function verifierSideForSerbianStem(side: string, lang: "EN" | "DE"): string {
  const question = extractVerifierQuestion(side, lang);
  const hint = String(side.match(new RegExp(`Hint \\(${lang}\\):\\s*([\\s\\S]*)$`))?.[1] ?? "").trim();
  const glosses = extractParentheticalGlossesFromText(question);
  const lines = [
    "The exercise stem stays Serbian on the English and the German track. Do not translate it and do not report it.",
    glosses.length
      ? `Learner gloss (${lang}): ${glosses.join(" | ")}`
      : `Learner gloss (${lang}): none`,
  ];
  if (hint) lines.push(`Hint (${lang}): ${hint}`);
  return lines.join("\n");
}

function semanticSide(item: VerifierInputItem, side: string): string {
  if (item.kind !== "test") return side;
  const qType = String(item.questionType ?? "").trim();
  if (qType !== "multipleChoice" && qType !== "dialogue" && qType !== "fillInBlank") return side;
  const lang = /^\s*Question \(DE\)/m.test(side) ? "DE" : "EN";
  const question = extractVerifierQuestion(side, lang);
  if (serbianExerciseStemStays(qType, question)) return verifierSideForSerbianStem(side, lang);
  return textForSemanticVerification(side);
}

/** Same row counter as `checkSectionQuality` — header + data rows, not separator lines. */
function countTableDataRows(markdown: string): number {
  return (String(markdown || "").match(/^\|(?![-: |]+\|)/gm) ?? []).length;
}

function extractSerbianColumnCells(markdown: string): string[] {
  const results: string[] = [];
  let serbianColIdx = -1;

  for (const line of String(markdown || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      serbianColIdx = -1;
      continue;
    }
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    if (cells.every((c) => /^[-:\s]+$/.test(c))) continue;

    const headerIdx = cells.findIndex((c) => /^serbian$/i.test(c.replace(/\*+/g, "").trim()));
    if (headerIdx >= 0) {
      serbianColIdx = headerIdx;
      continue;
    }

    const idx = serbianColIdx >= 0 ? serbianColIdx : 0;
    const cell = String(cells[idx] ?? "")
      .replace(/\*+/g, "")
      .trim();
    if (cell) results.push(cell);
  }
  return results;
}

const LEMMA_INSTRUCTION_TAILS =
  /\s+(?:to|in|from|into)\s+the\s+(?:german|english|source|output|table|section)\b.*$/i;
const LEMMA_INSTRUCTION_HEADS =
  /^(?:please\s+)?(?:add|include|omit|missing|keep|entries?|lemmas?|items?|words?)\s*:?\s*/i;
const LEMMA_WHOLE_STOP = new Set([
  "german",
  "serbian",
  "english",
  "vocabulary",
  "section",
  "table",
  "column",
  "translation",
  "output",
  "entries",
  "entry",
  "lemmas",
  "lemma",
  "items",
  "item",
  "words",
  "word",
  "source",
  "text",
  "information",
  "content",
]);
const LEMMA_EN_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "are",
  "was",
  "were",
  "this",
  "that",
  "these",
  "those",
  "it",
  "they",
  "we",
  "you",
  "from",
  "with",
  "into",
  "than",
  "also",
  "still",
  "already",
  "several",
  "present",
  "missing",
  "add",
  "include",
]);

function stripLemmaInstructionAffixes(raw: string): string {
  return String(raw || "")
    .replace(LEMMA_INSTRUCTION_TAILS, "")
    .replace(LEMMA_INSTRUCTION_HEADS, "")
    .replace(/^[`'«"“]+|[`'»"”]+$/g, "")
    .trim();
}

function isLemmaLikeToken(raw: string): boolean {
  const s = stripLemmaInstructionAffixes(raw);
  if (!s || s.length > 60) return false;
  if (LEMMA_WHOLE_STOP.has(s.toLowerCase())) return false;
  if (!/^[\p{L}][\p{L}'’-]{0,40}(?:\s+[\p{L}][\p{L}'’-]{0,40}){0,3}$/u.test(s)) return false;
  const words = s.split(/\s+/);
  if (words.every((w) => LEMMA_EN_STOP.has(w.toLowerCase()) || LEMMA_WHOLE_STOP.has(w.toLowerCase()))) {
    return false;
  }
  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textContainsLemma(haystack: string, lemma: string): boolean {
  const n = String(lemma || "").trim();
  if (!n) return false;
  const escaped = escapeRegExp(n).replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^\\p{L}])${escaped}(?:$|[^\\p{L}])`, "iu").test(String(haystack || ""));
}

/**
 * Pull quoted spans and comma lists out of a verifier issue/suggestion.
 * Used only to decide whether a vocabulary-section `missing_info` names
 * lemmas that are already in the DE Serbian column.
 */
export function extractMentionedLemmaTokens(text: string): string[] {
  const found = new Set<string>();
  const add = (raw: string) => {
    const s = stripLemmaInstructionAffixes(raw);
    if (isLemmaLikeToken(s)) found.add(s);
  };

  for (const m of String(text || "").matchAll(/["'`«“]([^"'`»”\n]{1,60})["'`»”]/g)) {
    add(String(m[1] ?? ""));
  }

  for (const sentence of String(text || "").split(/[.\n]/)) {
    const afterColon = sentence.includes(":")
      ? sentence.slice(sentence.lastIndexOf(":") + 1)
      : sentence;
    const parts = afterColon
      .replace(/\s+(?:and|und|or|oder)\s+/gi, ", ")
      .split(",")
      .map((p) => stripLemmaInstructionAffixes(p))
      .filter(Boolean);
    const lemmas = parts.filter(isLemmaLikeToken);
    if (lemmas.length >= 2) {
      for (const lemma of lemmas) add(lemma);
    }
  }

  return [...found];
}

function isVocabularySectionKey(key: string): boolean {
  return key.trim().toLowerCase() === "section:vocabulary";
}

function isPreservedSerbianLemma(token: string, item: VerifierInputItem): boolean {
  const deCells = extractSerbianColumnCells(item.german).join("\n");
  if (textContainsLemma(deCells, token)) return true;
  // Token was in the EN Serbian extract and still appears somewhere in DE.
  if (textContainsLemma(item.serbian, token) && textContainsLemma(item.german, token)) {
    return true;
  }
  return false;
}

function shouldDropVocabSectionMissingInfo(
  issue: VerifierIssue,
  item: VerifierInputItem | undefined
): boolean {
  if (!item || issue.itemKind !== "section" || item.kind !== "section") return false;
  if (!isVocabularySectionKey(issue.itemKey) && !isVocabularySectionKey(item.key)) return false;
  if (issue.code !== "missing_info") return false;

  const enRows = countTableDataRows(item.english);
  const deRows = countTableDataRows(item.german);
  const rowsMatch = enRows > 0 && enRows === deRows;

  const blob = `${issue.issue} ${issue.suggestion ?? ""}`;
  const mentioned = extractMentionedLemmaTokens(blob);
  const preserved = mentioned.filter((token) => isPreservedSerbianLemma(token, item));

  if (mentioned.length > 0 && preserved.length === mentioned.length) return true;
  const aboutSerbianColumn =
    /missing serbian|serbian (?:entr(?:y|ies)|lemmas?|words?|column)|add them to the german|add these (?:lemmas?|entr(?:y|ies)|words?)/i.test(
      blob
    );
  if (rowsMatch && mentioned.length === 0 && aboutSerbianColumn) return true;
  return false;
}

/**
 * Drop AI `missing_info` on `section:vocabulary` when the model asks to add
 * Serbian lemmas that already sit in the DE table's Serbian column, or when
 * the EN/DE table row counts already match and no missing lemma is named.
 *
 * Real row loss stays visible via `checkSectionQuality` and via this filter
 * keeping issues whose named tokens are absent from DE.
 */
export function dropAiMissingInfoThatRepeatsVocabularySerbian(
  issues: VerifierIssue[],
  items: VerifierInputItem[]
): { kept: VerifierIssue[]; dropped: VerifierIssue[] } {
  const byKey = new Map(items.map((it) => [it.key, it]));
  const kept: VerifierIssue[] = [];
  const dropped: VerifierIssue[] = [];
  for (const issue of issues) {
    if (shouldDropVocabSectionMissingInfo(issue, byKey.get(issue.itemKey))) {
      dropped.push(issue);
    } else {
      kept.push(issue);
    }
  }
  return { kept, dropped };
}

/**
 * Deterministic sanity checks that don't require an AI call.
 *
 * Currently: flag vocabulary items whose German translation stacks multiple
 * meanings together. We want 'de' to be ONE German equivalent; alternative
 * meanings belong in 'noteDe'. Detects separators like "und", "oder", "bzw",
 * "/", ",", ";".
 *
 * These are emitted as warnings (not criticals) so they surface in the report
 * and become selectable for manual retry, without blocking publish.
 */
export function runDeterministicVocabChecks(items: VerifierInputItem[]): VerifierIssue[] {
  const issues: VerifierIssue[] = [];
  // Word-boundary-aware matchers. We explicitly do NOT flag bare hyphens or
  // parentheses — those commonly appear in legitimate single-lemma entries
  // like "zu Hause" or "Mann (Plural: Männer)".
  const STACKED_WORDS = /\b(und|oder|bzw\.?|beziehungsweise|sowie)\b/i;
  const STACKED_PUNCT = /[\/;]|,\s*(?![a-zäöü])/; // slash, semicolon, or comma not part of a compound
  // Legitimate single-lemma connectors. A vocabulary entry whose entire
  // German field is exactly one of these words is a real dictionary lemma
  // (e.g. serbian "i"/"a" -> "und", "ili" -> "oder"), NOT stacked meanings.
  // Without this allowlist, the STACKED_WORDS regex would false-positive on
  // every connector lemma and produce persistent noise in the verifier report.
  // The semantic AI-verifier layer still checks these items against the
  // Serbian source independently, so legitimacy of the translation is not
  // lost by skipping the deterministic heuristic here.
  const SINGLE_CONNECTOR_LEMMA = /^(und|oder|bzw\.?|beziehungsweise|sowie)$/i;

  const allowlisted: Array<{ key: string; label: string; de: string }> = [];

  for (const it of items) {
    if (it.kind !== "vocabulary") continue;
    const de = String(it.german ?? "").trim();
    if (!de) continue;

    // Whitelist: the entire DE field is exactly a single connector word -> legitimate lemma, skip.
    if (SINGLE_CONNECTOR_LEMMA.test(de)) {
      allowlisted.push({ key: it.key, label: it.label, de });
      continue;
    }

    const hasStackedWord = STACKED_WORDS.test(de);
    const hasStackedPunct = STACKED_PUNCT.test(de);
    if (!hasStackedWord && !hasStackedPunct) continue;

    issues.push({
      itemKey: it.key,
      itemLabel: it.label,
      itemKind: "vocabulary",
      severity: "warning",
      code: "vocab_stacked_meanings",
      issue:
        `German translation looks like multiple stacked meanings ("${de}"). ` +
        `Use ONE German equivalent in 'de' and move alternative meanings into 'noteDe'.`,
      suggestion: undefined,
    });
  }

  // Audit trail: log which items bypassed the heuristic because they are
  // single-connector lemmas. Surfaces in Convex function logs so any
  // unexpected allowlisting can be reviewed retroactively.
  if (allowlisted.length > 0) {
    console.log(
      `[verifier] runDeterministicVocabChecks: allowlisted ${allowlisted.length} single-connector lemma(s) from vocab_stacked_meanings heuristic: ` +
        allowlisted.map((a) => `${a.label}="${a.de}"`).join(", "),
    );
  }

  return issues;
}

/**
 * Deterministic check for parentheses on Serbian-stem exercise prompts:
 * - fillInBlank CONTEXT glosses (full-sentence translation of the Serbian) → must stay as German
 * - fillInBlank SOURCE CUES (short word after blank, e.g. "(milk)") → must stay as German
 * - HELP glosses on dialogue / multipleChoice → critical unwanted
 */
export function runDeterministicTestGlossChecks(
  items: VerifierInputItem[],
  cognates: Set<string> = new Set(CODE_DEFAULT_PROMPT_COGNATES)
): VerifierIssue[] {
  const issues: VerifierIssue[] = [];

  const looksLikeSerbianStem = (q: string) => {
    const t = String(q || "").trim();
    if (/^(?:A|B)\s*:/i.test(t)) return true;
    if (/_+/.test(t)) return true;
    if (/[čćšžđČĆŠŽĐ]/.test(t)) return true;
    if (/\b(je|sam|si|su|ona|on|mi|vi|kako|odakle|zove|radi|predaje)\b/i.test(t)) return true;
    return false;
  };

  const norm = (s: string) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  for (const it of items) {
    if (it.kind !== "test") continue;
    const qType = String(it.questionType ?? "").trim();
    if (qType && qType !== "fillInBlank" && qType !== "dialogue" && qType !== "multipleChoice") {
      continue;
    }

    const enQ = extractVerifierQuestion(it.english, "EN");
    const deQ = extractVerifierQuestion(it.german, "DE");
    if (!deQ) continue;

    const enGlosses = extractParentheticalGlossesFromText(enQ);
    const deGlosses = extractParentheticalGlossesFromText(deQ);
    const enCues = enGlosses.filter(isFillInSourceCue);
    const deCues = deGlosses.filter(isFillInSourceCue);
    const enContext = enGlosses.filter(isHelpTranslationGloss);
    const deContext = deGlosses.filter(isHelpTranslationGloss);
    const deHelp = deGlosses.filter(isHelpTranslationGloss);
    const stem = deQ.replace(/(?:\s*\([^)]*\))+\s*[.!?…]?$/u, "").trim();
    const stemForStemCheck = deCues.length > 0 ? stem : deQ.replace(/(?:\s*\([^)]*\))+\s*[.!?…]?$/u, "").trim();

    // fillInBlank: EN source cues must appear as German cues on DE.
    if ((!qType || qType === "fillInBlank") && enCues.length > 0) {
      if (deCues.length < enCues.length) {
        const stemWithBlank = stem || deQ;
        issues.push({
          itemKey: it.key,
          itemLabel: it.label,
          itemKind: "test",
          severity: "critical",
          code: "test_missing_fill_in_cue",
          issue:
            `The German question omits the fill-in source cue ` +
            `${enCues.map((g) => `(${g})`).join(" ")} which is present in the English source. ` +
            `Without this cue, the learner does not know which word to fill in.`,
          suggestion: `${stemWithBlank} (German for: ${enCues.join(", ")})`,
        });
      } else {
        for (let i = 0; i < enCues.length; i++) {
          const enG = enCues[i]!;
          const deG = deCues[i] ?? "";
          if (norm(enG) === norm(deG) && !cognates.has(norm(enG))) {
            issues.push({
              itemKey: it.key,
              itemLabel: it.label,
              itemKind: "test",
              severity: "critical",
              code: "test_untranslated_fill_in_cue",
              issue:
                `Fill-in source cue is still English "(${enG})". ` +
                `Translate it to German inside the parentheses (e.g. milk→Milch).`,
              suggestion: `${stem || deQ} (German for "${enG}")`,
            });
          }
        }
      }
    }

    // fillInBlank: EN context glosses (full-sentence) must appear as German on DE.
    if ((!qType || qType === "fillInBlank") && enContext.length > 0) {
      if (deContext.length < enContext.length) {
        const stemWithBlank = stem || deQ;
        issues.push({
          itemKey: it.key,
          itemLabel: it.label,
          itemKind: "test",
          severity: "critical",
          code: "test_missing_context_gloss",
          issue:
            `The German question omits the fill-in context gloss ` +
            `${enContext.map((g) => `(${g})`).join(" ")} which is present in the English source. ` +
            `Without this context, the learner cannot understand the exercise.`,
          suggestion: `${stemWithBlank} (German for: ${enContext.join("; ")})`,
        });
      } else {
        for (let i = 0; i < enContext.length; i++) {
          const enG = enContext[i]!;
          const deG = deContext[i] ?? "";
          if (norm(enG) === norm(deG) && !cognates.has(norm(enG))) {
            issues.push({
              itemKey: it.key,
              itemLabel: it.label,
              itemKind: "test",
              severity: "critical",
              code: "test_untranslated_context_gloss",
              issue:
                `Fill-in context gloss is still English "(${enG})". ` +
                `Translate it to German inside the parentheses (e.g. "I am Ana." → "Ich bin Ana.").`,
              suggestion: `${stem || deQ} (German for "${enG}")`,
            });
          }
        }
      }
    }

    // Help glosses on dialogue/MC must be stripped — not on fillInBlank.
    if (qType === "fillInBlank") continue;
    if (deHelp.length === 0) continue;
    if (!looksLikeSerbianStem(stemForStemCheck) && enGlosses.filter(isHelpTranslationGloss).length === 0) {
      continue;
    }

    issues.push({
      itemKey: it.key,
      itemLabel: it.label,
      itemKind: "test",
      severity: "critical",
      code: "test_unwanted_parenthetical_gloss",
      issue:
        `German exercise prompt still has parenthetical translation help ` +
        `(${deHelp.map((g) => `(${g})`).join(" ")}). ` +
        `Remove sentence-level learner glosses — keep the Serbian stem/blank` +
        (enCues.length > 0 ? ` plus the short German fill-in cue.` : ` only.`),
      suggestion: `Remove the parenthetical help; keep only: "${stem || deQ}"`,
    });
  }

  return issues;
}

/** True when the prompt is a Serbian dialogue/fill-in stem that must stay EN=DE on the DE track. */
function isSerbianDialogueOrStemPrompt(question: string): boolean {
  const q = String(question || "").trim();
  if (!q) return false;
  if (/^(?:A|B)\s*:/i.test(q)) return true;
  if (/\b(?:Person\s+[AB]|Waiter|Guest)\b/i.test(q)) return true;
  // Blank without an English learner gloss in parentheses → Serbian stem (not EN→DE prompt).
  if (/_+/.test(q) && !/\([^)]*[a-zA-Z]{3,}[^)]*\)/.test(q)) return true;
  return false;
}

/**
 * Deterministic check for translation/matching prompts that stayed English.
 * Example EN→DE failure: questionEn "Monday" / questionDe "Monday" (should be "Montag").
 * Cognates that are identical in EN and DE (e.g. August, orange) are allowed.
 */
export function runDeterministicTestPromptChecks(
  items: VerifierInputItem[],
  cognates: Set<string> = new Set(CODE_DEFAULT_PROMPT_COGNATES)
): VerifierIssue[] {
  const issues: VerifierIssue[] = [];
  const PROMPT_CHECK_TYPES = new Set(["translation", "matching"]);

  const extractQuestion = (side: string, lang: "EN" | "DE"): string => {
    const re = new RegExp(`Question \\(${lang}\\):\\s*([\\s\\S]*?)(?:\\nHint \\(${lang}\\):|$)`);
    const m = String(side || "").match(re);
    return (m?.[1] ?? "").trim();
  };

  const comparable = (q: string) =>
    String(q || "")
      .replace(/_+/g, " ")
      .replace(/^\s*=\s*/g, "")
      .replace(/\s*=\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  for (const it of items) {
    if (it.kind !== "test") continue;
    const enQ = extractQuestion(it.english, "EN");
    const deQ = extractQuestion(it.german, "DE");
    if (!enQ || !deQ) continue;

    const qType = String(it.questionType ?? "").trim();
    if (qType && !PROMPT_CHECK_TYPES.has(qType)) continue;
    if (!qType && isSerbianDialogueOrStemPrompt(enQ)) continue;

    const hasBlank = /_+/.test(enQ);
    const enComp = comparable(enQ);
    const deComp = comparable(deQ);
    if (!enComp || !deComp) continue;
    if (enComp !== deComp) continue;
    if (cognates.has(enComp)) continue;

    // Single-token or short matching prompt left identical → untranslated EN prompt.
    const tokenCount = enComp.split(/\s+/).filter(Boolean).length;
    if (!hasBlank && tokenCount > 4) continue; // longer English MC prompts handled by AI verifier
    if (hasBlank && tokenCount > 6) continue;

    issues.push({
      itemKey: it.key,
      itemLabel: it.label,
      itemKind: "test",
      severity: "critical",
      code: "test_untranslated_learner_prompt",
      issue:
        `German question prompt is still English ("${extractQuestion(it.german, "DE")}"). ` +
        `For translation/matching items on the DE track, translate the learner-facing prompt to German ` +
        `(e.g. Monday→Montag, today→heute, half→Hälfte).`,
      suggestion: `Translate the English prompt "${extractQuestion(it.english, "EN")}" into German; keep blanks/format.`,
    });
  }

  return issues;
}

function truncate(s: string, max: number): string {
  const str = String(s ?? "");
  if (str.length <= max) return str;
  return `${str.slice(0, max)}\n[...truncated for verifier...]`;
}

/**
 * Defensive post-filter: drop issues whose own text admits they are not
 * actually issues. The verifier prompt instructs the model to omit items that
 * match correctly, but in rare cases the model emits a "commentary" issue with
 * language like "No issue here — they match" or "both are correct, no problem".
 * Those entries have no actionable signal, clutter the admin report, and
 * pollute the retry feedback. Filtering is conservative: we require the issue
 * text to EXPLICITLY state that there is no issue, not merely that something
 * is acceptable.
 */
const NON_ISSUE_PHRASE_PATTERNS: RegExp[] = [
  /\bno\s+issue\s+here\b/i,
  /\bno\s+issue\s+found\b/i,
  /\bno\s+(real\s+)?issue(s)?\b/i,
  /\bno\s+problem(s)?\b/i,
  /\bthey\s+match\b/i,
  /\bthey\s+are\s+(a\s+)?match(ing)?\b/i,
  /\bis\s+correct\s+and\s+matches\b/i,
  /\bmatches\s+(the\s+)?serbian\s+meaning\b/i,
];

function isNonIssueCommentary(issue: VerifierIssue): boolean {
  const text = `${issue.issue} ${issue.suggestion ?? ""}`.trim();
  if (!text) return false;
  return NON_ISSUE_PHRASE_PATTERNS.some((re) => re.test(text));
}

/**
 * Batches items for the verifier call. Each batch stays under a conservative
 * character budget so we don't blow the context window. Markdown sections are
 * much larger than vocabulary items, so we let batching per-kind handle size.
 */
const VERIFIER_BATCH_CHARS = 10_000;
const VERIFIER_BATCH_MAX_ITEMS = 8;
const VERIFIER_MAX_TOKENS = 4000;

function batchItems(
  items: VerifierInputItem[],
  maxCharsPerBatch: number,
  maxItemsPerBatch: number = VERIFIER_BATCH_MAX_ITEMS
): VerifierInputItem[][] {
  const batches: VerifierInputItem[][] = [];
  let current: VerifierInputItem[] = [];
  let currentChars = 0;
  for (const it of items) {
    const size = (it.serbian?.length || 0) + (it.english?.length || 0) + (it.german?.length || 0);
    const overflow =
      current.length > 0 &&
      (current.length >= maxItemsPerBatch || currentChars + size > maxCharsPerBatch);
    if (overflow) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(it);
    currentChars += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function isVerifierIssueShape(value: unknown): value is { key: string; issue: string } {
  if (!value || typeof value !== "object") return false;
  const o = value as { key?: unknown; issue?: unknown };
  return typeof o.key === "string" && o.key.trim() !== "" && typeof o.issue === "string" && o.issue.trim() !== "";
}

/** Recover `{ issues: [...] }` from truncated or slightly broken verifier JSON. */
export function parseVerifierIssuesJson(raw: string): { issues: any[] } {
  try {
    const parsed = parseJsonOrThrow(raw);
    if (parsed && Array.isArray(parsed.issues)) return { issues: parsed.issues };
    if (Array.isArray(parsed)) return { issues: parsed };
  } catch {
    // salvage below
  }

  const closed = closeTruncatedJson(raw);
  if (closed) {
    try {
      const parsed = JSON.parse(closed);
      if (parsed && Array.isArray(parsed.issues)) return { issues: parsed.issues };
      if (Array.isArray(parsed)) return { issues: parsed };
    } catch {
      // salvage complete objects
    }
  }

  const issues = extractCompleteJsonObjects(raw).filter(isVerifierIssueShape);
  if (issues.length > 0) return { issues };
  throw new Error("Invalid JSON from AI: could not salvage verifier issues.");
}

function shortVerifierError(message: string): string {
  return String(message || "")
    .replace(/\s*Preview:\s*[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

// Base prompt: chatPrompts cs_translator_verifier (no code fallback).

function buildVerifierUserPayload(items: VerifierInputItem[]): string {
  const contract = [
    "TEST GLOSS CONTRACT (binding for kind=test; do not contradict):",
    "- Each test item includes questionType.",
    "- A fill-in, a dialogue, or a multiple-choice item whose stem is Serbian is sent as learner glosses only. That stem stays Serbian on purpose. Do not report semantic_mismatch because the question is Serbian, and do not suggest a German sentence in its place. Judge only whether the German learner gloss means the same as the English gloss.",
    "- Parenthetical glosses on other test items are removed from this payload. The deterministic checker already applied the gloss contract (fill-in keeps a German context gloss; multiple choice and dialogue do not). Do not report a missing, extra, or unwanted gloss.",
    "- Short fill-in source cues like (Milch) are not sentence-level glosses and are also absent here.",
    "- vocabulary section: the Serbian table column stays Serbian on DE. Do not report missing_info for lemmas that are still present in the German table's Serbian column.",
    "OUTPUT: return ONLY a JSON object {\"issues\":[...]} with no markdown.",
    "Each issue: {key, severity, code, issue, suggestion?}. Keep issue text under 200 characters.",
    "Omit items with no problem. Do not put unescaped double quotes inside issue/suggestion strings.",
    "",
  ].join("\n");
  const payload = {
    items: items.map((it) => ({
      key: it.key,
      kind: it.kind,
      label: it.label,
      ...(it.kind === "test" && it.questionType ? { questionType: it.questionType } : {}),
      serbian: truncate(it.serbian, 4000),
      english: truncate(semanticSide(it, it.english), 4000),
      german: truncate(semanticSide(it, it.german), 4000),
    })),
  };
  return `${contract}${JSON.stringify(payload)}`;
}

export async function verifySerbianGermanAlignment(
  ctx: ActionCtx,
  params: {
    items: VerifierInputItem[];
    preferredProvider?: Provider;
    pass: "pass1" | "pass2";
    extraCognates?: string[];
  }
): Promise<VerifierReport> {
  const t0 = Date.now();
  const empty: VerifierReport = {
    itemsChecked: params.items.length,
    issues: [],
    criticals: [],
    warnings: [],
    infos: [],
    durationMs: 0,
    provider: null,
    model: null,
    inputTokens: null,
    outputTokens: null,
    thinkingTokens: null,
    estimatedCostUsd: null,
    pass: params.pass,
  };

  if (params.items.length === 0) {
    empty.durationMs = Date.now() - t0;
    return empty;
  }

  // Filter: item must have a non-empty German translation and a non-empty
  // anchor appropriate to its kind.
  //  - Metadata items are UI/info texts translated EN→DE; the anchor is ENGLISH.
  //    The Serbian field is only optional thematic context and may be empty.
  //  - All other kinds (vocabulary, test, section) are SR→DE checks and require
  //    a non-empty Serbian anchor.
  const usable = params.items.filter((it) => {
    const de = String(it.german ?? "").trim();
    if (!de) return false;
    if (it.kind === "metadata") return !!String(it.english ?? "").trim();
    return !!String(it.serbian ?? "").trim();
  });
  if (usable.length === 0) {
    empty.durationMs = Date.now() - t0;
    return empty;
  }

  const batches = batchItems(usable, VERIFIER_BATCH_CHARS, VERIFIER_BATCH_MAX_ITEMS);

  // Run deterministic checks first — no AI call required, and the results
  // show up alongside AI-detected issues for the admin to select for retry.
  const cognates = await loadMergedPromptCognates(ctx);
  for (const term of params.extraCognates ?? []) {
    const n = normalizeCognateTerm(term);
    if (n) cognates.add(n);
  }
  const deterministicIssues = [
    ...runDeterministicVocabChecks(usable),
    ...runDeterministicTestGlossChecks(usable, cognates),
    ...runDeterministicTestPromptChecks(usable, cognates),
  ];

  const aiIssues: VerifierIssue[] = [];
  let sumInput = 0;
  let sumOutput = 0;
  let sumThinking = 0;
  let sumCost: number | null = 0;
  let provider: string | null = null;
  let model: string | null = null;
  let callError: string | undefined;

  const itemByKey = new Map<string, VerifierInputItem>();
  for (const it of usable) itemByKey.set(it.key, it);

  let failedJsonBatches = 0;
  const baseSystem =
    (await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.translatorVerifier)) +
    (await languageRulesBlock(ctx));

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]!;
    try {
      let parsed: { issues: any[] } | null = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        const user =
          attempt === 0
            ? buildVerifierUserPayload(batch)
            : [
                buildVerifierUserPayload(batch),
                "",
                "RETRY: previous output was invalid JSON. Return ONLY {\"issues\":[...]} with short issue texts and escaped quotes.",
              ].join("\n");
        const ai = await callAiJson(ctx, {
          stage: "auditor",
          preferredProvider: params.preferredProvider,
          system: baseSystem,
          user,
          maxTokens: VERIFIER_MAX_TOKENS,
          timeoutMs: 90_000,
          reasoningEffort: "low",
        });
        provider = ai.provider;
        model = ai.model;
        if (ai.usage?.inputTokens != null) sumInput += ai.usage.inputTokens;
        if (ai.usage?.outputTokens != null) sumOutput += ai.usage.outputTokens;
        if (ai.usage?.thinkingTokens != null) sumThinking += ai.usage.thinkingTokens;
        if (ai.estimatedCostUsd != null && sumCost != null) sumCost += ai.estimatedCostUsd;
        else sumCost = sumCost != null && ai.estimatedCostUsd == null ? sumCost : sumCost;

        try {
          parsed = parseVerifierIssuesJson(ai.raw);
        } catch (e: any) {
          if (attempt === 1) {
            failedJsonBatches += 1;
            console.warn(
              `[verifier] batch ${batchIndex + 1}/${batches.length} invalid JSON after retry: ${shortVerifierError(e?.message || e)}`
            );
          }
        }
      }
      if (!parsed) continue;
      const rawIssues: any[] = Array.isArray(parsed.issues) ? parsed.issues : [];
      const droppedAsNonIssue: Array<{ key: string; text: string }> = [];
      for (const raw of rawIssues) {
        const key = String(raw?.key ?? "").trim();
        const src = itemByKey.get(key);
        if (!src) continue;
        const sevRaw = String(raw?.severity ?? "").trim().toLowerCase();
        const severity: VerifierSeverity =
          sevRaw === "critical" ? "critical" : sevRaw === "warning" ? "warning" : "info";
        const code = String(raw?.code ?? "other").trim() || "other";
        const issue = String(raw?.issue ?? "").trim();
        if (!issue) continue;
        const suggestion =
          typeof raw?.suggestion === "string" && String(raw.suggestion).trim()
            ? String(raw.suggestion).trim()
            : undefined;
        const candidate: VerifierIssue = {
          itemKey: src.key,
          itemLabel: src.label,
          itemKind: src.kind,
          severity,
          code,
          issue,
          suggestion,
        };
        // Defensive drop: the verifier occasionally emits "no issue — they
        // match" commentary despite being told not to. Such entries are not
        // actionable and must not reach the admin UI or the retry feedback.
        if (isNonIssueCommentary(candidate)) {
          droppedAsNonIssue.push({ key: src.key, text: issue });
          continue;
        }
        aiIssues.push(candidate);
      }
      if (droppedAsNonIssue.length > 0) {
        console.log(
          `[verifier] dropped ${droppedAsNonIssue.length} non-issue commentary entr${
            droppedAsNonIssue.length === 1 ? "y" : "ies"
          }: ` +
            droppedAsNonIssue
              .map((d) => `${d.key}="${d.text.slice(0, 120)}"`)
              .join("; ")
        );
      }
    } catch (e: any) {
      failedJsonBatches += 1;
      console.warn(
        `[verifier] batch ${batchIndex + 1}/${batches.length} call failed: ${shortVerifierError(e?.message || e)}`
      );
    }
  }

  if (failedJsonBatches > 0) {
    callError =
      `AI verifier JSON invalid on ${failedJsonBatches} of ${batches.length} batch(es). ` +
      `Deterministic checks still apply.`;
  }

  const vocabMissing = dropAiMissingInfoThatRepeatsVocabularySerbian(aiIssues, usable);
  if (vocabMissing.dropped.length > 0) {
    console.log(
      `[verifier] dropped ${vocabMissing.dropped.length} AI missing_info issue(s) that repeat the vocabulary Serbian column: ` +
        vocabMissing.dropped.map((d) => `${d.itemKey}/${d.code}`).join("; ")
    );
  }
  const allIssues: VerifierIssue[] = [...deterministicIssues, ...vocabMissing.kept];

  const criticals = allIssues.filter((i) => i.severity === "critical");
  const warnings = allIssues.filter((i) => i.severity === "warning");
  const infos = allIssues.filter((i) => i.severity === "info");

  return {
    itemsChecked: usable.length,
    issues: allIssues,
    criticals,
    warnings,
    infos,
    durationMs: Date.now() - t0,
    provider,
    model,
    inputTokens: sumInput || null,
    outputTokens: sumOutput || null,
    thinkingTokens: sumThinking || null,
    estimatedCostUsd: sumCost && sumCost > 0 ? sumCost : null,
    ...(callError ? { error: callError } : {}),
    pass: params.pass,
  };
}

/**
 * Extracts Serbian content lines from a Markdown section.
 * Used to build a focused Serbian anchor for the verifier — passing the
 * full markdown is noisy; pulling only embedded SR (Cyrillic + common
 * Latin-transliterated words + table cells) is more precise.
 */
export function extractSerbianFromMarkdown(md: string): string {
  const text = String(md ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) return "";

  const lines = text.split("\n");
  const out: string[] = [];

  const latinSrPattern =
    /\b(Zdravo|Hvala|Molim|Dobar|Dobra|Dobro|Jutro|Veče|Kako|Šta|Ko|Koji|Koja|Koje|Ja sam|Vi ste|Ti si|On je|Ona je|Oni su|ne|da|ali|molim|Moje ime|Moj|Moja|Moje|volim|hoću|mogu|imam|sok|voda|hleb|mleko|knjiga|škola|studentski|sada|juče|sutra|danas|dobro došli)\b/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("|---") || /^\|[\s:|-]+\|/.test(trimmed)) continue;

    if (/\p{Script=Cyrillic}/u.test(trimmed)) {
      out.push(trimmed);
      continue;
    }

    if (trimmed.startsWith("|")) {
      const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
      const srCells = cells.filter(
        (c) => /\p{Script=Cyrillic}/u.test(c) || latinSrPattern.test(c) || /[čćžšđČĆŽŠĐ]/.test(c)
      );
      if (srCells.length > 0) {
        out.push(srCells.join(" | "));
        continue;
      }
    }

    if (/[čćžšđČĆŽŠĐ]/.test(trimmed) && !/[äöüßÄÖÜ]/.test(trimmed)) {
      if (latinSrPattern.test(trimmed) || /\b(je|su|sam|si|smo|ste|nije)\b/.test(trimmed)) {
        out.push(trimmed);
      }
    }
  }

  return out.slice(0, 80).join("\n");
}

/**
 * Groups verifier issues by item kind + formats them as prompt-ready retry feedback.
 * Returned object is keyed by kind; the caller picks the relevant block and prepends
 * it to the respective translation prompt on pass 2 or a manual retry run.
 *
 * Accepts any VerifierIssue[] — the caller decides which severities to include
 * (auto-retry uses criticals only; manual retry can include warnings).
 *
 * When a suggestion is present, the line marks it as binding so the model must
 * use that German wording verbatim for the flagged span (see also
 * `applyDeterministicVerifierSuggestions`, which patches before any AI retry).
 */
export function formatRetryFeedback(issues: VerifierIssue[]): {
  metadata: string;
  vocabulary: string;
  test: string;
  sectionByContentType: Record<string, string>;
} {
  const lines = {
    metadata: [] as string[],
    vocabulary: [] as string[],
    test: [] as string[],
  };
  const sectionLines: Record<string, string[]> = {};

  for (const iss of issues) {
    const sevTag = iss.severity === "critical" ? "CRITICAL" : iss.severity === "warning" ? "WARNING" : "INFO";
    const suggestion = typeof iss.suggestion === "string" ? iss.suggestion.trim() : "";
    const suggestionPart = suggestion
      ? isActionableGermanSuggestion(suggestion)
        ? ` MUST use Suggested German verbatim: «${suggestion}»`
        : ` (Suggested German: ${suggestion})`
      : "";
    const line = `- [${sevTag}] [${iss.itemLabel}] ${iss.issue}${suggestionPart}`;
    if (iss.itemKind === "metadata") {
      lines.metadata.push(line);
    } else if (iss.itemKind === "vocabulary") {
      lines.vocabulary.push(line);
    } else if (iss.itemKind === "test") {
      lines.test.push(line);
    } else if (iss.itemKind === "section") {
      const ctMatch = iss.itemKey.match(/^section:(.+)$/);
      const contentType = ctMatch?.[1] ?? "unknown";
      if (!sectionLines[contentType]) sectionLines[contentType] = [];
      sectionLines[contentType].push(line);
    }
  }

  const sectionByContentType: Record<string, string> = {};
  for (const [k, v] of Object.entries(sectionLines)) sectionByContentType[k] = v.join("\n");

  return {
    metadata: lines.metadata.join("\n"),
    vocabulary: lines.vocabulary.join("\n"),
    test: lines.test.join("\n"),
    sectionByContentType,
  };
}

// ---------------------------------------------------------------------------
// Deterministic suggestion patches (before AI retry)
// ---------------------------------------------------------------------------

const ADVISORY_SUGGESTION =
  /^(remove|translate|keep|add|consider|change|use|replace|do not|don't|please|prefer|rewrite)\b/i;
const ADVISORY_PHRASE = /\b(german for|english for|instead of|for example|e\.g\.|i\.e\.)\b/i;

/**
 * True when the verifier suggestion is a concrete German rewrite we can apply
 * (or force on the model), not instructional English advice.
 */
export function isActionableGermanSuggestion(suggestion: string | undefined | null): boolean {
  const s = String(suggestion ?? "").trim();
  if (!s) return false;
  if (s.length > 120) return false;
  if (ADVISORY_SUGGESTION.test(s)) return false;
  if (ADVISORY_PHRASE.test(s)) return false;
  if (!/[A-Za-zÄÖÜäöüß]/.test(s)) return false;
  return true;
}

export function extractQuotedSpans(text: string): string[] {
  const out: string[] = [];
  const re = /"([^"\n]{2,80})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text || "")))) {
    const span = m[1].trim();
    if (span) out.push(span);
  }
  return out;
}

/** Same noun with the other common German indefinite-article forms. */
export function articleGenderVariants(suggestion: string): string[] {
  const m = String(suggestion || "")
    .trim()
    .match(/^(eine|einen|einem|einer|eines|ein)\s+(.+)$/i);
  if (!m) return [];
  const noun = m[2];
  return ["ein", "eine", "einen", "einem", "einer", "eines"]
    .map((a) => `${a} ${noun}`)
    .filter((v) => v.toLowerCase() !== suggestion.trim().toLowerCase());
}

/**
 * Replace a wrong German span with the suggestion when we can locate the
 * wrong text. Returns null when no safe edit is possible.
 */
export function applySuggestionToGermanText(
  german: string,
  issueText: string,
  suggestion: string
): string | null {
  const src = String(german ?? "");
  const issue = String(issueText ?? "");
  const fix = String(suggestion ?? "").trim();
  if (!src || !fix) return null;

  // 1) Gender/article variants of the suggestion (ein Milch → eine Milch).
  for (const wrong of articleGenderVariants(fix)) {
    if (src.includes(wrong)) {
      return src.split(wrong).join(fix);
    }
  }

  // 2) Explicit wrong forms from phrasing like: was translated as "ein Bier".
  const translatedAs: string[] = [];
  const translatedAsRe = /\b(?:translated as|currently|wrote|got)\s+"([^"\n]{2,80})"/gi;
  let tm: RegExpExecArray | null;
  while ((tm = translatedAsRe.exec(issue))) {
    const span = tm[1].trim();
    if (span && span !== fix) translatedAs.push(span);
  }
  for (const wrong of translatedAs) {
    if (src.includes(wrong)) {
      return src.split(wrong).join(fix);
    }
  }

  // Serbian originals quoted as "Serbian source …" must never be overwritten.
  const serbianSources = new Set<string>();
  const srRe = /\bSerbian(?:\s+source)?\s+"([^"\n]{2,80})"/gi;
  let sm: RegExpExecArray | null;
  while ((sm = srRe.exec(issue))) {
    const span = sm[1].trim();
    if (span) serbianSources.add(span);
  }

  // 3) Other quoted wrong German. Skip quotes that are already part of the
  // suggestion, Serbian sources, or look like Serbian orthography.
  const looksSerbian = (q: string) =>
    /[čćžšđČĆŽŠĐ]/.test(q) ||
    /\b(je|su|sam|si|smo|ste|nije|mleko|jedno|jedan|jedna)\b/i.test(q);

  const quotes = extractQuotedSpans(issue)
    .filter((q) => {
      if (!q || q === fix || q.length < 2) return false;
      if (fix.toLowerCase().includes(q.toLowerCase())) return false;
      if (serbianSources.has(q)) return false;
      if (looksSerbian(q)) return false;
      return true;
    })
    .sort((a, b) => b.length - a.length);
  for (const wrong of quotes) {
    if (src.includes(wrong)) {
      return src.split(wrong).join(fix);
    }
  }

  const trimmed = src.trim();
  if (translatedAs.some((q) => q === trimmed) || quotes.some((q) => q === trimmed)) {
    return fix;
  }

  return null;
}

const LEADING_DEFINITE_FOR_VOCAB = /^(der|die|das|den|dem|des)\s+/i;

function stripDefiniteArticleForVocab(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return trimmed;
  const stripped = trimmed.replace(LEADING_DEFINITE_FOR_VOCAB, "").trim();
  return stripped || trimmed;
}

export type DeTranslationState = {
  contentDe: any[];
  testsDe: any[];
  vocabularyDe: any[];
};

/**
 * Apply actionable verifier suggestions in-place on the current DE state.
 * Used before AI pass-2 / manual retry so concrete fixes (eine Milch, …) are
 * written without regenerating a whole section or test category.
 *
 * Returns the patched state, the itemKeys that were fixed, and the issues that
 * still need an AI retry.
 */
export function applyDeterministicVerifierSuggestions(params: {
  issues: VerifierIssue[];
  state: DeTranslationState;
}): {
  state: DeTranslationState;
  patchedKeys: string[];
  remainingIssues: VerifierIssue[];
} {
  const contentDe = Array.isArray(params.state.contentDe) ? params.state.contentDe.map((r) => ({ ...r })) : [];
  const testsDe = Array.isArray(params.state.testsDe) ? params.state.testsDe.map((r) => ({ ...r })) : [];
  const vocabularyDe = Array.isArray(params.state.vocabularyDe)
    ? params.state.vocabularyDe.map((r) => ({ ...r }))
    : [];

  const patchedKeys: string[] = [];
  const remainingIssues: VerifierIssue[] = [];

  for (const iss of params.issues) {
    const suggestion = typeof iss.suggestion === "string" ? iss.suggestion.trim() : "";
    if (!isActionableGermanSuggestion(suggestion)) {
      remainingIssues.push(iss);
      continue;
    }

    let patched = false;

    if (iss.itemKind === "vocabulary") {
      const id = String(iss.itemKey).replace(/^vocab:/, "");
      const idx = vocabularyDe.findIndex((v) => String(v?.courseVocabularyId ?? "") === id);
      if (idx >= 0) {
        vocabularyDe[idx] = {
          ...vocabularyDe[idx],
          de: stripDefiniteArticleForVocab(suggestion),
        };
        patched = true;
      }
    } else if (iss.itemKind === "test") {
      const qid = String(iss.itemKey).replace(/^test:/, "");
      const idx = testsDe.findIndex((t) => String(t?.questionId ?? "") === qid);
      if (idx >= 0) {
        const current = String(testsDe[idx]?.question ?? "");
        const next = applySuggestionToGermanText(current, iss.issue, suggestion);
        if (next != null && next !== current) {
          testsDe[idx] = { ...testsDe[idx], question: next };
          patched = true;
        } else if (
          current.trim().split(/\s+/).length <= 6 &&
          suggestion.split(/\s+/).length <= 6 &&
          current.trim().toLowerCase() !== suggestion.toLowerCase()
        ) {
          // Short prompt fields: replace the whole German question when the
          // suggestion is itself a short concrete rewrite.
          testsDe[idx] = { ...testsDe[idx], question: suggestion };
          patched = true;
        }
      }
    } else if (iss.itemKind === "section") {
      const ctMatch = String(iss.itemKey).match(/^section:(.+)$/);
      const contentType = ctMatch?.[1] ?? "";
      const idx = contentDe.findIndex((r) => String(r?.contentType ?? "") === contentType);
      if (idx >= 0) {
        const current = String(contentDe[idx]?.content ?? "");
        const next = applySuggestionToGermanText(current, iss.issue, suggestion);
        if (next != null && next !== current) {
          contentDe[idx] = { ...contentDe[idx], content: next };
          patched = true;
        }
      }
    }

    if (patched) {
      patchedKeys.push(iss.itemKey);
    } else {
      remainingIssues.push(iss);
    }
  }

  return {
    state: { contentDe, testsDe, vocabularyDe },
    patchedKeys: [...new Set(patchedKeys)],
    remainingIssues,
  };
}

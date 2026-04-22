import type { ActionCtx } from "../_generated/server";
import { callAiJson, parseJsonOrThrow, type Provider } from "./_shared";

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
  /** Raw AI error if the verifier call failed; in that case issues is empty. */
  error?: string;
  /** Label so the client can distinguish pass 1 vs pass 2 verifier runs. */
  pass: "pass1" | "pass2";
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
  // like "zu Hause" or "der Mann (Plural: die Männer)".
  const STACKED_WORDS = /\b(und|oder|bzw\.?|beziehungsweise|sowie)\b/i;
  const STACKED_PUNCT = /[\/;]|,\s*(?![a-zäöü])/; // slash, semicolon, or comma not part of a compound

  for (const it of items) {
    if (it.kind !== "vocabulary") continue;
    const de = String(it.german ?? "").trim();
    if (!de) continue;

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
  return issues;
}

function truncate(s: string, max: number): string {
  const str = String(s ?? "");
  if (str.length <= max) return str;
  return `${str.slice(0, max)}\n[...truncated for verifier...]`;
}

/**
 * Batches items for the verifier call. Each batch stays under a conservative
 * character budget so we don't blow the context window. Markdown sections are
 * much larger than vocabulary items, so we let batching per-kind handle size.
 */
function batchItems(items: VerifierInputItem[], maxCharsPerBatch: number): VerifierInputItem[][] {
  const batches: VerifierInputItem[][] = [];
  let current: VerifierInputItem[] = [];
  let currentChars = 0;
  for (const it of items) {
    const size = (it.serbian?.length || 0) + (it.english?.length || 0) + (it.german?.length || 0);
    if (current.length > 0 && currentChars + size > maxCharsPerBatch) {
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

const VERIFIER_SYSTEM = [
  "You are a bilingual Serbian-German translation reviewer for a Serbian-language-learning course.",
  "For each item, compare the German translation against the Serbian ORIGINAL (the English text is a bridge reference only; English may itself be imprecise).",
  "Focus on SEMANTIC alignment between Serbian and German — not between English and German.",
  "",
  "Severity rubric:",
  "- 'critical': the German clearly does NOT match the Serbian meaning (mistranslation, wrong subject/object, lost core info, contradicts the Serbian).",
  "- 'warning': the German is understandable but loses nuance, register, grammatical detail, or adds/omits minor information relative to the Serbian.",
  "- 'info': minor stylistic observation or a polish suggestion that would not confuse learners.",
  "",
  "Only report items that have a real issue. Do NOT report items where German correctly reflects the Serbian (even if the English phrasing was different).",
  "When in doubt between warning and critical, choose warning. Reserve 'critical' for real meaning errors.",
  "",
  "HARD RULES — do NOT flag these (they are not issues):",
  "1. German pronoun capitalization context: 'sie' (lowercase) = 'she'/'they'; 'Sie' (capitalized) = formal 'you' OR sentence-initial 'she/they'.",
  "   - Both forms can be correct depending on context. Do NOT flag 'Sie' at the start of a German sentence, a heading, a bullet, or a table cell as 'wrong capitalization'.",
  "   - In vocabulary tables/glossaries whose cell starts with a lowercase Serbian lemma (e.g., 'ona'), the matching German gloss is lowercase ('sie'). If already lowercase there, do NOT 'correct' it to capitalized. If capitalized as a standalone cell/heading (e.g., '| Ona | Sie |'), that is ALSO acceptable per German noun-capitalization conventions for isolated pronouns and is NOT a critical issue.",
  "   - Same rule applies to 'er/Er' and 'es/Es'.",
  "2. Acceptable near-synonyms in German are NOT issues. Examples:",
  "   - Pasoš → 'Pass' OR 'Reisepass' (both fine).",
  "   - avion → 'Flugzeug' OR 'Flieger'.",
  "   - Only flag when the German word is a DIFFERENT concept, not a stylistic refinement.",
  "3. Do NOT propose swaps between words that are both valid translations. Pick at most one and if both are acceptable, emit NO issue.",
  "4. Register/formality differences that are idiomatic for a learning course (e.g., 'du' vs 'Sie' address in instructions) are NOT issues unless the Serbian explicitly uses a mismatching register.",
  "5. SERBIAN-SPECIFIC GRAMMAR vs. GERMAN GRAMMAR — do NOT project Serbian grammatical form onto German. The German translation must be GRAMMATICALLY NATURAL GERMAN, even if that differs in form from the Serbian surface.",
  "   - Serbian uses genitive (often singular) after cardinal numbers ≥ 5 and after quantity words like 'kilogram', 'litar', 'čaša', 'mnogo', 'malo'. Example: 'jedan kilogram krompira' (gen.sg), 'pet jabuka' (gen.pl).",
  "   - The natural German rendering is: 'ein Kilogramm Kartoffeln', 'fünf Äpfel' (German plural after quantity). The singular 'ein Kilogramm Kartoffel' is UNGRAMMATICAL/awkward in German and must NOT be suggested.",
  "   - RULE: If the German plural is the natural rendering of a Serbian quantity expression, it is CORRECT. Do NOT flag it as 'wrong number' based on the Serbian form. Do NOT suggest switching to German singular just because Serbian is morphologically singular.",
  "   - Same principle applies to any other case where SR morphology (aspect, gender, case, number) has no 1:1 mirror in DE grammar: follow idiomatic German, not a mechanical projection of SR morphology.",
  "",
  "CONSISTENCY — STRICT: Your rulings must be internally consistent. If text X is acceptable, the equivalent text X in the next pass must also be acceptable. Do NOT oscillate between opposite recommendations on the same surface form.",
  "  - Oscillation example to AVOID: pass 1 flags 'Ein Kilogramm Kartoffeln' (plural) and suggests 'Kartoffel' (singular); pass 2 then flags 'Ein Kilogramm Kartoffel' (singular) as awkward and suggests 'Kartoffeln' (plural). This is a forbidden oscillation — the correct behavior is: do NOT flag German plural after a quantity word at all (see rule 5).",
  "  - If a previous pass's suggestion would merely swap a form to its opposite without a clear semantic gain, emit NO issue.",
  "",
  "Return ONLY valid JSON in this exact shape:",
  "{",
  '  "issues": [',
  '    { "key": "<item key>", "severity": "critical|warning|info", "code": "semantic_mismatch|missing_info|wrong_register|grammatical|other", "issue": "<short description in English>", "suggestion": "<optional German rewrite or concrete fix>" }',
  "  ]",
  "}",
  "If everything is fine, return { \"issues\": [] }.",
].join("\n");

function buildVerifierUserPayload(items: VerifierInputItem[]): string {
  const payload = {
    items: items.map((it) => ({
      key: it.key,
      kind: it.kind,
      label: it.label,
      serbian: truncate(it.serbian, 4000),
      english: truncate(it.english, 4000),
      german: truncate(it.german, 4000),
    })),
  };
  return JSON.stringify(payload);
}

export async function verifySerbianGermanAlignment(
  ctx: ActionCtx,
  params: {
    items: VerifierInputItem[];
    preferredProvider?: Provider;
    pass: "pass1" | "pass2";
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

  // Filter: only items with non-empty Serbian anchor and non-empty German translation.
  const usable = params.items.filter(
    (it) => String(it.serbian ?? "").trim() && String(it.german ?? "").trim()
  );
  if (usable.length === 0) {
    empty.durationMs = Date.now() - t0;
    return empty;
  }

  const batches = batchItems(usable, 28_000);

  // Run deterministic checks first — no AI call required, and the results
  // show up alongside AI-detected issues for the admin to select for retry.
  const deterministicIssues = runDeterministicVocabChecks(usable);

  const allIssues: VerifierIssue[] = [...deterministicIssues];
  let sumInput = 0;
  let sumOutput = 0;
  let sumThinking = 0;
  let sumCost: number | null = 0;
  let provider: string | null = null;
  let model: string | null = null;
  let callError: string | undefined;

  const itemByKey = new Map<string, VerifierInputItem>();
  for (const it of usable) itemByKey.set(it.key, it);

  for (const batch of batches) {
    try {
      const ai = await callAiJson(ctx, {
        stage: "auditor",
        preferredProvider: params.preferredProvider,
        system: VERIFIER_SYSTEM,
        user: buildVerifierUserPayload(batch),
        maxTokens: 3000,
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

      let parsed: any;
      try {
        parsed = parseJsonOrThrow(ai.raw);
      } catch (e: any) {
        callError = `Verifier returned invalid JSON: ${e?.message || String(e)}`;
        continue;
      }
      const rawIssues: any[] = Array.isArray(parsed?.issues) ? parsed.issues : [];
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
        allIssues.push({
          itemKey: src.key,
          itemLabel: src.label,
          itemKind: src.kind,
          severity,
          code,
          issue,
          suggestion,
        });
      }
    } catch (e: any) {
      callError = `Verifier call failed: ${String(e?.message || e).slice(0, 400)}`;
      // Continue with next batch; partial results are still useful.
    }
  }

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
    const line = `- [${sevTag}] [${iss.itemLabel}] ${iss.issue}${iss.suggestion ? ` (Suggested German: ${iss.suggestion})` : ""}`;
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

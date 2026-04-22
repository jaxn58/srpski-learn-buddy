import type { ActionCtx } from "../_generated/server";
import { callAiJson, callAiText, parseJsonOrThrow, type Provider } from "./_shared";
import {
  extractSerbianFromMarkdown,
  type VerifierInputItem,
} from "./_verifier";

/**
 * Shared translation primitives used by both:
 *   - translatePublishedUnitEnToDe (full unit EN->DE translation)
 *   - retryDeTranslationForSelectedIssues (selective retry of individual items)
 *
 * All prompts live here so the two actions stay in lockstep. If you change a
 * prompt or a translation helper here, both actions automatically pick it up.
 *
 * Design notes:
 *   - Serbian is the PRIMARY semantic source; English is a bridge reference only.
 *   - Helpers are pure functions with explicit parameters (no hidden closures).
 *   - Each AI-calling helper writes to a shared `stepLogs` array passed in by
 *     the caller so the action can aggregate timing/token stats for the UI.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepLog = {
  step: string;
  provider: string;
  model: string;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  qualityIssues: string[];
};

export type TargetReleaseStatus = "preview" | "published";

export interface TranslationSourceEn {
  metadataEn: any;
  contentEn: any[];
  testsEn: any[];
  vocabEn: any[];
}

export interface AiCallOptions {
  primaryProvider: Provider | undefined;
  fallbackProvider: Provider | undefined;
}

export interface StageCall {
  step: string;
  stage: "specialist" | "auditor";
  system: string;
  user: string;
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function isRetryableAiError(e: any): boolean {
  const msg = String(e?.message || e || "");
  return (
    msg.includes("AI API error: 503") ||
    msg.includes("AI API error: 429") ||
    msg.includes("AI returned no content") ||
    msg.includes("returned no content") ||
    msg.includes("AI API timeout") ||
    msg.includes("AI output truncated") ||
    msg.includes("finish_reason=length") ||
    /UNAVAILABLE|overloaded|high demand|rate limit|timeout|request aborted|truncated/i.test(msg)
  );
}

export function pickPrimaryProvider(preferred: Provider | undefined): Provider | undefined {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  return preferred || (hasGemini ? "gemini" : hasOpenAI ? "openai" : undefined);
}

export function pickFallbackProvider(primary: Provider | undefined): Provider | undefined {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  return primary === "gemini" ? (hasOpenAI ? "openai" : undefined) : hasGemini ? "gemini" : undefined;
}

function buildStageTryOrder(stage: "specialist" | "auditor") {
  return stage === "specialist" ? (["specialist", "auditor"] as const) : (["auditor", "specialist"] as const);
}

function timeoutForStepMs(step: string): number {
  if (step.startsWith("section:")) return 120_000;
  if (step.startsWith("tests:")) return 60_000;
  if (step.startsWith("vocab:")) return 60_000;
  return 45_000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function makeStepLog(
  step: string,
  ai: {
    provider: string;
    model: string;
    usage:
      | { inputTokens?: number; outputTokens?: number; totalTokens?: number; thinkingTokens?: number }
      | null;
    estimatedCostUsd: number | null;
  },
  durationMs: number,
  qualityIssues: string[] = []
): StepLog {
  return {
    step,
    provider: ai.provider,
    model: ai.model,
    durationMs,
    inputTokens: ai.usage?.inputTokens ?? null,
    outputTokens: ai.usage?.outputTokens ?? null,
    thinkingTokens: ai.usage?.thinkingTokens ?? null,
    totalTokens: ai.usage?.totalTokens ?? null,
    estimatedCostUsd: ai.estimatedCostUsd,
    qualityIssues,
  };
}

/**
 * Structural quality check for a single translated Markdown section.
 * Checks section-level invariants (heading count, id preservation,
 * blank count, table row count) — NOT full-unit structure.
 */
export function checkSectionQuality(mdEn: string, mdDe: string): string[] {
  const issues: string[] = [];

  const extractHeadings = (s: string) =>
    (s.match(/^#{1,6}\s+.+$/gm) ?? []).map((h) => h.replace(/^(#{1,6})\s+.*$/, "$1").length);
  const enHeadingLevels = extractHeadings(mdEn);
  const deHeadingLevels = extractHeadings(mdDe);
  if (enHeadingLevels.length !== deHeadingLevels.length) {
    issues.push(
      `Heading count mismatch: EN=${enHeadingLevels.length}, DE=${deHeadingLevels.length}`
    );
  }

  const extractIds = (s: string) =>
    [...s.matchAll(/\b[a-z]+\d+_[a-z_]+\d*\b/g)].map((m) => m[0]);
  const enIds = new Set(extractIds(mdEn));
  const deIds = new Set(extractIds(mdDe));
  const missingIds = [...enIds].filter((id) => !deIds.has(id));
  if (missingIds.length > 0) {
    issues.push(
      `Missing IDs: ${missingIds.slice(0, 5).join(", ")}${missingIds.length > 5 ? ` +${missingIds.length - 5} more` : ""}`
    );
  }

  const countBlanks = (s: string) => (s.match(/_____/g) ?? []).length;
  const enBlanks = countBlanks(mdEn);
  const deBlanks = countBlanks(mdDe);
  if (enBlanks !== deBlanks) {
    issues.push(`Blank count mismatch: EN=${enBlanks}, DE=${deBlanks}`);
  }

  const countTableDataRows = (s: string) =>
    (s.match(/^\|(?![-: |]+\|)/gm) ?? []).length;
  const enRows = countTableDataRows(mdEn);
  const deRows = countTableDataRows(mdDe);
  if (enRows > 0 && enRows !== deRows) {
    issues.push(`Table row count mismatch: EN=${enRows}, DE=${deRows}`);
  }

  return issues;
}

// ---------------------------------------------------------------------------
// AI call with provider fallback + retry
// ---------------------------------------------------------------------------

export async function callJsonRobust(
  ctx: ActionCtx,
  params: StageCall,
  opts: AiCallOptions
): Promise<{
  raw: string;
  provider: string;
  model: string;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number; thinkingTokens?: number } | null;
  estimatedCostUsd: number | null;
}> {
  const providers: Array<Provider | undefined> =
    opts.fallbackProvider && opts.fallbackProvider !== opts.primaryProvider
      ? [opts.primaryProvider, opts.fallbackProvider]
      : [opts.primaryProvider];
  const stageOrder = buildStageTryOrder(params.stage);
  const errors: string[] = [];

  for (const p of providers) {
    for (const stage of stageOrder) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await callAiJson(ctx, {
            stage,
            preferredProvider: p,
            system: params.system,
            user: params.user,
            maxTokens: params.maxTokens,
            timeoutMs: timeoutForStepMs(params.step),
            reasoningEffort: "low",
          });
        } catch (e: any) {
          const msg = String(e?.message || e || "");
          errors.push(`[${params.step}] provider=${String(p)} stage=${stage} attempt=${attempt + 1} err=${msg.slice(0, 240)}`);
          const isNoContent = /returned no content/i.test(msg);
          if (isRetryableAiError(e) && attempt < 1 && !isNoContent) {
            await sleep(650 + attempt * 950);
            continue;
          }
          if (isRetryableAiError(e)) break;
          throw e;
        }
      }
    }
  }
  throw new Error(`AI call failed after retries. Attempts:\n${errors.slice(-10).join("\n")}`);
}

export async function callTextRobust(
  ctx: ActionCtx,
  params: StageCall,
  opts: AiCallOptions
): Promise<{
  raw: string;
  provider: string;
  model: string;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number; thinkingTokens?: number } | null;
  estimatedCostUsd: number | null;
}> {
  const providers: Array<Provider | undefined> =
    opts.fallbackProvider && opts.fallbackProvider !== opts.primaryProvider
      ? [opts.primaryProvider, opts.fallbackProvider]
      : [opts.primaryProvider];
  const stageOrder = buildStageTryOrder(params.stage);
  const errors: string[] = [];

  for (const p of providers) {
    for (const stage of stageOrder) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await callAiText(ctx, {
            stage,
            preferredProvider: p,
            system: params.system,
            user: params.user,
            maxTokens: params.maxTokens,
            timeoutMs: timeoutForStepMs(params.step),
            reasoningEffort: "low",
          });
        } catch (e: any) {
          const msg = String(e?.message || e || "");
          errors.push(`[${params.step}] provider=${String(p)} stage=${stage} attempt=${attempt + 1} err=${msg.slice(0, 240)}`);
          const isNoContent = /returned no content/i.test(msg);
          if (isRetryableAiError(e) && attempt < 1 && !isNoContent) {
            await sleep(650 + attempt * 950);
            continue;
          }
          if (isRetryableAiError(e)) break;
          throw e;
        }
      }
    }
  }
  throw new Error(`AI call failed after retries. Attempts:\n${errors.slice(-10).join("\n")}`);
}

// ---------------------------------------------------------------------------
// Serbian context block (primary semantic anchor fed into every prompt)
// ---------------------------------------------------------------------------

export function buildSerbianContextBlock(source: TranslationSourceEn): string {
  const lines: string[] = [];
  const vocabSamples = Array.isArray(source.vocabEn) ? source.vocabEn.slice(0, 30) : [];
  if (vocabSamples.length > 0) {
    lines.push("Sample Serbian vocabulary this unit teaches (primary semantic source):");
    for (const v of vocabSamples) {
      const sr = String(v?.serbian ?? "").trim();
      const en = String(v?.en ?? "").trim();
      if (!sr) continue;
      lines.push(`- ${sr}${en ? `  (EN reference: ${en})` : ""}`);
    }
  }
  const overviewRow = Array.isArray(source.contentEn)
    ? source.contentEn.find((c: any) => String(c?.contentType) === "overview")
    : null;
  const overviewMd = String(overviewRow?.content ?? "").replace(/\r\n/g, "\n");
  if (overviewMd) {
    const srLines: string[] = [];
    for (const raw of overviewMd.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/\p{Script=Cyrillic}/u.test(line)) { srLines.push(line); if (srLines.length >= 8) break; continue; }
      if (/\b(Zdravo|Hvala|Molim|Dobar|Dobro|Kako|Šta|Koji|Jesam|Jesi|ime|Ja sam|Vi ste|ti si)\b/.test(line)) {
        srLines.push(line);
      }
      if (srLines.length >= 8) break;
    }
    if (srLines.length > 0) {
      lines.push("");
      lines.push("Sample Serbian phrases from unit overview:");
      for (const l of srLines) lines.push(`- ${l}`);
    }
  }
  return lines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Metadata translation (trilingual prompt)
// ---------------------------------------------------------------------------

const META_SYSTEM_BASE = [
  "You translate Serbian-language-course unit METADATA (title, description, topics, grammarFocus, vocabularyThemes) from English into German (de-DE) for German-speaking learners of Serbian.",
  "",
  "IMPORTANT ROLE OF THESE FIELDS:",
  "- Unit metadata is LEARNER-FACING UI/INFORMATIONAL text. It is NOT the Serbian language the learner studies — it is the interface copy that tells the learner what the unit is about.",
  "- These fields are authored and maintained in ENGLISH. The ENGLISH text is the PRIMARY and ONLY semantic source for the German translation.",
  "- A Serbian context block may be provided for THEMATIC reference only (so you can align tone and domain vocabulary). It is NOT a translation source. Do NOT add, omit, or alter meaning based on the Serbian context. Do NOT drop descriptive sentences just because the Serbian side is shorter or is only a vocabulary list.",
  "",
  "TRANSLATION RULES:",
  "- Translate EN → DE faithfully. Preserve the meaning, tone, and level of detail of the English original.",
  "- Do NOT invent new items. Preserve array lengths and order from the English source.",
  "- If a source field is empty, return an empty string (for strings) or empty array (for arrays).",
  "",
  "Return ONLY valid JSON with keys: titleDe, descriptionDe, topicsDe, grammarFocusDe, vocabularyThemesDe.",
].join("\n");

function buildMetaUserPayload(source: TranslationSourceEn, serbianContextBlock: string): string {
  const parts: string[] = [];
  parts.push(`Title (EN, PRIMARY SOURCE — translate this):`);
  parts.push(String(source.metadataEn?.title ?? ""));
  parts.push(``);
  parts.push(`Description (EN, PRIMARY SOURCE — translate this):`);
  parts.push(String(source.metadataEn?.description ?? ""));
  parts.push(``);
  parts.push(`Topics (EN, PRIMARY SOURCE — translate this) JSON:`);
  parts.push(JSON.stringify(source.metadataEn?.topics ?? []));
  parts.push(``);
  parts.push(`Grammar focus (EN, PRIMARY SOURCE — translate this) JSON:`);
  parts.push(JSON.stringify(source.metadataEn?.grammarFocus ?? []));
  parts.push(``);
  parts.push(`Vocabulary themes (EN, PRIMARY SOURCE — translate this) JSON:`);
  parts.push(JSON.stringify(source.metadataEn?.vocabularyThemes ?? []));
  if (serbianContextBlock) {
    parts.push(``);
    parts.push(`Thematic Serbian context (REFERENCE ONLY — do NOT translate from this, do NOT let it change the meaning of the German output; use only to align tone and domain terminology):`);
    parts.push(serbianContextBlock);
  }
  return parts.join("\n");
}

export async function runMetadataTranslation(
  ctx: ActionCtx,
  args: {
    source: TranslationSourceEn;
    serbianContextBlock: string;
    ai: AiCallOptions;
    stepLogs: StepLog[];
    retryFeedback?: string;
  }
): Promise<{ raw: string; provider: string; model: string }> {
  const system = args.retryFeedback
    ? `${META_SYSTEM_BASE}\n\nIMPORTANT: A previous attempt had EN→DE translation issues flagged by the verifier. Fix these in your output while keeping the English meaning intact:\n${args.retryFeedback}`
    : META_SYSTEM_BASE;
  const step = args.retryFeedback ? "metadata:retry" : "metadata";
  const t0 = Date.now();
  const ai = await callJsonRobust(
    ctx,
    {
      step,
      stage: "auditor",
      system,
      user: buildMetaUserPayload(args.source, args.serbianContextBlock),
      maxTokens: 1500,
    },
    args.ai
  );
  args.stepLogs.push(makeStepLog(step, ai, Date.now() - t0));
  return { raw: ai.raw, provider: ai.provider, model: ai.model };
}

export function buildMetadataDeFromAi(aiRaw: string, source: TranslationSourceEn): any {
  let parsed: any;
  try {
    parsed = parseJsonOrThrow(aiRaw);
  } catch (e: any) {
    throw new Error(`AI returned invalid JSON for metadata translation. ${e?.message || ""}`);
  }
  return {
    title: String(parsed?.titleDe ?? "").trim() || String(source.metadataEn?.title ?? ""),
    description:
      typeof parsed?.descriptionDe === "string" && String(parsed.descriptionDe).trim()
        ? String(parsed.descriptionDe).trim()
        : undefined,
    topics: Array.isArray(parsed?.topicsDe) ? parsed.topicsDe.map((x: any) => String(x)) : [],
    grammarFocus: Array.isArray(parsed?.grammarFocusDe) ? parsed.grammarFocusDe.map((x: any) => String(x)) : [],
    vocabularyThemes: Array.isArray(parsed?.vocabularyThemesDe) ? parsed.vocabularyThemesDe.map((x: any) => String(x)) : [],
    moduleMetadataId: source.metadataEn?.moduleMetadataId as any,
    moduleId: typeof source.metadataEn?.moduleId === "string" ? source.metadataEn.moduleId : undefined,
  };
}

// ---------------------------------------------------------------------------
// Section (markdown) translation (trilingual prompt)
// ---------------------------------------------------------------------------

function buildSectionSystemPrompt(retryFeedback?: string): string {
  return [
    "You are translating ONE Serbian-course unit markdown section into German (de-DE) for German-speaking learners of Serbian.",
    "",
    "PRIMARY SEMANTIC SOURCE: the Serbian content embedded inside this markdown (vocabulary tables with Serbian columns, example phrases, dialogue lines, answers). This is the actual language the learner is studying.",
    "BRIDGE/REFERENCE ONLY: the English explanations. They may contain imprecisions or oversimplifications.",
    "",
    "If an English explanation disagrees in meaning with the Serbian content shown in the same section, the German text MUST match the meaning of the Serbian content, not the English wording.",
    "Example: if an English note says a Serbian phrase means 'apple juice' but the Serbian actually says 'sok od jabuke' (literally 'juice of apple'), the German must accurately describe what the Serbian expresses, not just re-translate the English note.",
    "",
    "CRITICAL: Preserve Markdown structure EXACTLY (do not reformat):",
    "- Do NOT reorder headings/sections.",
    "- Do NOT change tables: keep exact columns, pipes, separators, and one-row-per-line formatting.",
    "- Do NOT wrap table rows across lines.",
    "- Preserve blanks EXACTLY as '_____' (five underscores).",
    "- Preserve lettered options formatting: A) ...  B) ...  C) ...  D) ...",
    "- Preserve all IDs (e.g., questionId like u2_ex5_q01) exactly.",
    "",
    "CRITICAL: Do NOT translate Serbian content:",
    "- In vocabulary tables: do NOT change the Serbian column values.",
    "- Do NOT change any Serbian phrases inside examples, answers, or dialogue lines.",
    "- Only translate English explanatory/instructional text into German.",
    "",
    ...(retryFeedback && retryFeedback.trim()
      ? [
          "IMPORTANT: A previous translation attempt had semantic issues vs. the Serbian content. Address this feedback:",
          retryFeedback.trim(),
          "",
        ]
      : []),
    "Return ONLY the final Markdown content (no commentary, no code fences).",
  ].join("\n");
}

export async function translateMarkdownSection(
  ctx: ActionCtx,
  args: {
    contentType: string;
    markdownEn: string;
    unitNumber: number;
    ai: AiCallOptions;
    retryFeedback?: string;
  }
): Promise<{ mdDe: string; log: StepLog }> {
  const input = String(args.markdownEn ?? "").replace(/\r\n/g, "\n").trim();
  const stepName = args.retryFeedback ? `section:${args.contentType}:retry` : `section:${args.contentType}`;
  const emptyLog: StepLog = {
    step: stepName,
    provider: "",
    model: "",
    durationMs: 0,
    inputTokens: null,
    outputTokens: null,
    thinkingTokens: null,
    totalTokens: null,
    estimatedCostUsd: null,
    qualityIssues: [],
  };
  if (!input) return { mdDe: "", log: emptyLog };

  const system = buildSectionSystemPrompt(args.retryFeedback);
  const user = [
    `Unit: ${args.unitNumber}`,
    `Section: ${args.contentType}`,
    "",
    input,
  ].join("\n");

  const t0 = Date.now();
  const aiResult = await callTextRobust(
    ctx,
    { step: stepName, stage: "auditor", system, user, maxTokens: 9000 },
    args.ai
  );
  const durationMs = Date.now() - t0;
  const out = String(aiResult.raw ?? "").replace(/\r\n/g, "\n").trim();
  const mdDe = out || input;
  const qualityIssues = checkSectionQuality(input, mdDe);
  return {
    mdDe,
    log: makeStepLog(stepName, aiResult, durationMs, qualityIssues),
  };
}

export function buildContentDeForSection(
  row: any,
  mdDe: string,
  targetReleaseStatus: TargetReleaseStatus,
  previewUnitVersion: number
): any {
  const contentType = String(row?.contentType ?? "");
  const unitVersion =
    targetReleaseStatus === "preview" ? previewUnitVersion : Number(row?.unitVersion ?? 1) || 1;
  return targetReleaseStatus === "preview"
    ? { contentType, content: mdDe }
    : { contentType, content: mdDe, unitVersion };
}

// ---------------------------------------------------------------------------
// Vocabulary translation (trilingual prompt)
// ---------------------------------------------------------------------------

function buildVocabSystemPrompt(retryFeedback?: string): string {
  return [
    "You translate Serbian vocabulary entries into German (de-DE) for German-speaking learners of Serbian.",
    "The PRIMARY semantic source is the Serbian word/phrase in the 'sr' field — it is the actual language the learner studies.",
    "English ('en') is a BRIDGE/REFERENCE only and may be imprecise, slangy, or lose nuance from the Serbian original.",
    "Produce German translations that accurately convey the meaning and register of the Serbian original.",
    "If Serbian and English differ in meaning, follow the SERBIAN meaning.",
    "",
    "OUTPUT RULES FOR 'de' — STRICT, NO EXCEPTIONS:",
    "- 'de' must be EXACTLY ONE German equivalent: a single word, or at most one short fixed phrase (e.g. 'zu Fuß gehen').",
    "- NEVER combine multiple meanings with 'und', 'oder', 'bzw', '/', ',' or ';' inside 'de'.",
    "- If the Serbian word is polysemous (has multiple distinct German equivalents), pick the ONE that best fits the unit's learner context.",
    "- For nouns, prefer including the definite article with gender ('der Mann', 'die Frau', 'das Kind') so the learner sees the grammatical gender.",
    "",
    "OUTPUT RULES FOR 'noteDe':",
    "- Translate/adapt 'noteEn' into learner-friendly German. Describe the Serbian word, not just the English label.",
    "- If the Serbian word has additional relevant German meanings that did NOT fit into 'de', explain them here (e.g. 'Je nach Kontext auch: dahin (Richtung).').",
    "- If relevant grammatical info (gender, aspect, register) is missing from 'de', explain it here.",
    "",
    "Do NOT invent new entries. Do NOT change ids. Return ONLY valid JSON with key: items.",
    "Each item must have: id, de, noteDe. Do NOT emit any 'deAlt' field.",
    "If a source field is empty, return an empty string for that field.",
    ...(retryFeedback && retryFeedback.trim()
      ? [
          "",
          "IMPORTANT: A previous attempt had semantic issues vs. the Serbian original. Address this feedback:",
          retryFeedback.trim(),
        ]
      : []),
  ].join("\n");
}

export interface VocabTranslationResult {
  courseVocabularyId: any;
  de?: string;
  noteDe?: string;
}

export const VOCAB_CHUNK_SIZE = 25;

export async function translateVocabChunks(
  ctx: ActionCtx,
  args: {
    items: any[];
    ai: AiCallOptions;
    stepLogs: StepLog[];
    retryFeedback?: string;
    stepPrefix?: string;
  }
): Promise<VocabTranslationResult[]> {
  const out: VocabTranslationResult[] = [];
  const stepPrefix = args.stepPrefix ?? "vocab";

  for (let i = 0; i < args.items.length; i += VOCAB_CHUNK_SIZE) {
    const chunk = args.items.slice(i, i + VOCAB_CHUNK_SIZE);
    const system = buildVocabSystemPrompt(args.retryFeedback);
    const user = JSON.stringify({
      items: chunk.map((v: any) => ({
        id: String(v?._id ?? ""),
        sr: String(v?.serbian ?? ""),
        en: String(v?.en ?? ""),
        noteEn: typeof v?.noteEn === "string" ? v.noteEn : "",
      })),
    });
    const stepName = `${stepPrefix}:${i}-${i + chunk.length - 1}`;
    const t0 = Date.now();
    const ai = await callJsonRobust(
      ctx,
      { step: stepName, stage: "auditor", system, user, maxTokens: 4000 },
      args.ai
    );
    args.stepLogs.push(makeStepLog(stepName, ai, Date.now() - t0));
    let parsed: any;
    try {
      parsed = parseJsonOrThrow(ai.raw);
    } catch (e: any) {
      throw new Error(`AI returned invalid JSON for vocabulary translation (chunk ${i}-${i + chunk.length - 1}). ${e?.message || ""}`);
    }
    const itemsOut: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
    const byId = new Map<string, any>();
    for (const it of itemsOut) {
      const id = String(it?.id ?? "").trim();
      if (!id) continue;
      byId.set(id, it);
    }
    for (const src of chunk) {
      const id = String(src?._id ?? "").trim();
      const aiOut = byId.get(id);
      if (!aiOut) continue;
      const de = typeof aiOut?.de === "string" ? String(aiOut.de).trim() : "";
      const noteDe = typeof aiOut?.noteDe === "string" ? String(aiOut.noteDe).trim() : "";
      out.push({
        courseVocabularyId: src._id as any,
        ...(de ? { de } : {}),
        ...(noteDe ? { noteDe } : {}),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Interactive tests translation (trilingual; SR answers stay untranslated)
// ---------------------------------------------------------------------------

function buildTestsSystemPrompt(retryFeedback?: string): string {
  return [
    "You translate interactive-test prompts (questions, hints, category instructions) into German (de-DE) for German-speaking learners of Serbian.",
    "",
    "FIELD ROLES — this is important:",
    "- 'categoryInstructionsEn' is LEARNER-FACING UI GUIDANCE (e.g. 'Translate the following Serbian phrases into German'). Translate it EN → DE directly and idiomatically. It is NOT Serbian content the learner studies; the Serbian-anchor rule does NOT apply to it. Do NOT let specific Serbian answers in this batch narrow or alter the meaning of the instructions.",
    "- 'hintEn' is LEARNER-FACING HELP TEXT (UI). Translate it EN → DE directly and idiomatically. It is not part of the Serbian content being taught.",
    "- 'questionEn' is the prompt the learner sees. The learner is expected to answer in Serbian (see 'correctAnswerSr' / 'optionsSr' / 'acceptableAlternativesSr'). The German question text MUST stay coherent with those Serbian answers: it is the ONE place where the Serbian-anchor rule applies in this prompt.",
    "",
    "RULES FOR questionDe:",
    "- The PRIMARY semantic anchor is the Serbian answer content. The German question must make sense for those Serbian answers.",
    "- English question text ('questionEn') is a BRIDGE/REFERENCE only and may be imprecise or lose nuance; if it disagrees with what the Serbian answers imply, follow the Serbian meaning.",
    "- Do NOT translate the Serbian answer strings, options, or alternatives. Do NOT change questionId, order, or questionType.",
    "- Preserve blanks EXACTLY as '_____' (five underscores) and keep the number of blanks identical to the English source.",
    "",
    "Return ONLY valid JSON with keys: categoryInstructionsDe, questions.",
    "questions must be an array of { questionId, questionDe, hintDe }.",
    ...(retryFeedback && retryFeedback.trim()
      ? [
          "",
          "IMPORTANT: A previous attempt had issues flagged by the verifier. Address this feedback (it applies to questionDe, which is SR-anchored; categoryInstructions and hints remain straight EN→DE UI translations):",
          retryFeedback.trim(),
        ]
      : []),
  ].join("\n");
}

export async function translateTestsForCategory(
  ctx: ActionCtx,
  args: {
    category: string;
    bucket: { categoryInstructions: string; questions: any[] };
    targetReleaseStatus: TargetReleaseStatus;
    ai: AiCallOptions;
    stepLogs: StepLog[];
    retryFeedback?: string;
  }
): Promise<any[]> {
  const stepName = args.retryFeedback ? `tests:${args.category}:retry` : `tests:${args.category}`;
  const system = buildTestsSystemPrompt(args.retryFeedback);
  const user = JSON.stringify({
    category: args.category,
    categoryInstructionsEn: args.bucket.categoryInstructions || "",
    questions: args.bucket.questions.map((q) => ({
      questionId: String(q.questionId),
      questionType: String(q.questionType),
      order: Number(q.order ?? 0) || 0,
      questionEn: String(q.question ?? ""),
      hintEn: typeof q.hint === "string" ? q.hint : "",
      correctAnswerSr: String(q.correctAnswer ?? ""),
      optionsSr: Array.isArray(q.options) ? q.options : undefined,
      acceptableAlternativesSr: Array.isArray(q.acceptableAlternatives) ? q.acceptableAlternatives : undefined,
    })),
  });

  const t0 = Date.now();
  const ai = await callJsonRobust(
    ctx,
    { step: stepName, stage: "auditor", system, user, maxTokens: 3500 },
    args.ai
  );
  args.stepLogs.push(makeStepLog(stepName, ai, Date.now() - t0));
  let parsed: any;
  try {
    parsed = parseJsonOrThrow(ai.raw);
  } catch (e: any) {
    throw new Error(`AI returned invalid JSON for test translation (category=${args.category}). ${e?.message || ""}`);
  }
  const categoryInstructionsDe =
    typeof parsed?.categoryInstructionsDe === "string" ? String(parsed.categoryInstructionsDe).trim() : "";
  const outQuestions: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const outById = new Map<string, any>();
  for (const oq of outQuestions) {
    const id = String(oq?.questionId ?? "").trim();
    if (!id) continue;
    outById.set(id, oq);
  }

  const produced: any[] = [];
  for (const src of args.bucket.questions) {
    const qid = String(src.questionId);
    const oq = outById.get(qid);
    const countBlanks = (s: string) => (String(s || "").match(/_+/g) || []).length;
    const srcQuestion = String(src.question ?? "");
    const srcBlanks = countBlanks(srcQuestion);

    let translatedQ = typeof oq?.questionDe === "string" ? String(oq.questionDe) : srcQuestion;
    const qType = String(src.questionType ?? "");
    if (
      (qType === "fillInBlank" || qType === "matching" || qType === "dialogue") &&
      srcBlanks !== countBlanks(translatedQ)
    ) {
      translatedQ = srcQuestion;
    }
    const translatedHint = typeof oq?.hintDe === "string" ? String(oq.hintDe) : (typeof src.hint === "string" ? src.hint : undefined);

    produced.push(
      args.targetReleaseStatus === "preview"
        ? {
            questionId: qid,
            category: String(src.category ?? ""),
            categoryInstructions:
              categoryInstructionsDe || (typeof src.categoryInstructions === "string" ? src.categoryInstructions : undefined),
            questionType: String(src.questionType ?? ""),
            question: translatedQ,
            correctAnswer: String(src.correctAnswer ?? ""),
            acceptableAlternatives: src.acceptableAlternatives,
            options: src.options,
            hint: translatedHint,
            order: Number(src.order ?? 0) || 0,
          }
        : {
            questionId: qid,
            unitVersion: Number(src.unitVersion ?? 1) || 1,
            category: String(src.category ?? ""),
            categoryInstructions:
              categoryInstructionsDe || (typeof src.categoryInstructions === "string" ? src.categoryInstructions : undefined),
            questionType: String(src.questionType ?? ""),
            question: translatedQ,
            correctAnswer: String(src.correctAnswer ?? ""),
            acceptableAlternatives: src.acceptableAlternatives,
            options: src.options,
            hint: translatedHint,
            order: Number(src.order ?? 0) || 0,
          }
    );
  }
  return produced;
}

// ---------------------------------------------------------------------------
// Verifier-item builder — pairs Serbian source with German translation for SR<->DE alignment check.
// Optional `restrictKeys` lets callers focus the verifier on specific items only (used by retry runs).
// ---------------------------------------------------------------------------

export function buildVerifierItems(params: {
  source: TranslationSourceEn;
  serbianContextBlock: string;
  metadataDe: any;
  contentDe: any[];
  vocabDe: VocabTranslationResult[];
  testsDe: any[];
  restrictKeys?: Set<string>;
}): VerifierInputItem[] {
  const items: VerifierInputItem[] = [];
  const pass = params.restrictKeys;

  {
    const key = "metadata:main";
    if (!pass || pass.has(key)) {
      // Metadata is learner-facing UI text, maintained in English. The verifier
      // check for this item is an EN→DE translation review, NOT a SR→DE
      // semantic check. We deliberately leave `serbian` empty so the verifier
      // cannot accidentally measure the German description against a partial
      // Serbian vocabulary extract.
      const enCombined = [
        String(params.source.metadataEn?.title ?? ""),
        String(params.source.metadataEn?.description ?? ""),
        (params.source.metadataEn?.topics ?? []).join(", "),
        (params.source.metadataEn?.grammarFocus ?? []).join(", "),
        (params.source.metadataEn?.vocabularyThemes ?? []).join(", "),
      ]
        .filter(Boolean)
        .join("\n");
      const deCombined = [
        String(params.metadataDe?.title ?? ""),
        String(params.metadataDe?.description ?? ""),
        (params.metadataDe?.topics ?? []).join(", "),
        (params.metadataDe?.grammarFocus ?? []).join(", "),
        (params.metadataDe?.vocabularyThemes ?? []).join(", "),
      ]
        .filter(Boolean)
        .join("\n");
      if (enCombined && deCombined) {
        items.push({
          key,
          kind: "metadata",
          label: "unit metadata (EN→DE UI translation)",
          serbian: "",
          english: enCombined,
          german: deCombined,
        });
      }
    }
  }

  const vocabDeById = new Map<string, any>();
  for (const v of params.vocabDe) vocabDeById.set(String(v.courseVocabularyId ?? ""), v);
  for (const src of params.source.vocabEn ?? []) {
    const id = String((src as any)?._id ?? "");
    const key = `vocab:${id}`;
    if (pass && !pass.has(key)) continue;
    const sr = String((src as any)?.serbian ?? "");
    const out = vocabDeById.get(id);
    const de = String(out?.de ?? "");
    if (!sr || !de) continue;
    const en = String((src as any)?.en ?? "");
    items.push({
      key,
      kind: "vocabulary",
      label: `vocabulary: '${sr.slice(0, 50)}'`,
      serbian: sr,
      english: en,
      german: de,
    });
  }

  const testsDeById = new Map<string, any>();
  for (const t of params.testsDe) testsDeById.set(String(t.questionId ?? ""), t);
  for (const src of params.source.testsEn ?? []) {
    const qid = String((src as any)?.questionId ?? "");
    const key = `test:${qid}`;
    if (pass && !pass.has(key)) continue;

    // IMPORTANT for the SR→DE verifier:
    // `options`, `correctAnswer`, `acceptableAlternatives` are intentionally
    // Serbian-only by course design — the learner answers in Serbian, so those
    // fields stay untranslated in the DE record as well. We pass them to the
    // verifier ONLY as context so it can judge whether the German question
    // coherently frames these Serbian answers. They must NOT be interpreted as
    // source text missing a German counterpart (that was the cause of the
    // "options missing" false-positive storm). The explicit "do NOT translate"
    // header below, combined with the kind=='test' rule in VERIFIER_SYSTEM,
    // makes this contract unmistakable to the reviewing model.
    const optionsSr =
      Array.isArray((src as any)?.options) && (src as any).options.length
        ? (src as any).options.join(" | ")
        : "";
    const alternativesSr =
      Array.isArray((src as any)?.acceptableAlternatives) && (src as any).acceptableAlternatives.length
        ? (src as any).acceptableAlternatives.join(" | ")
        : "";
    const correctSr = String((src as any)?.correctAnswer ?? "");
    const hasAnySrContent = Boolean(correctSr || optionsSr || alternativesSr);
    const srAnchor = hasAnySrContent
      ? [
          "[Learner-produced Serbian answers — intentionally NOT translated to German; options stay Serbian in DE by course design]",
          correctSr ? `Expected Serbian answer: ${correctSr}` : "",
          optionsSr ? `Answer choices (Serbian, stay untranslated): ${optionsSr}` : "",
          alternativesSr ? `Accepted Serbian variants: ${alternativesSr}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const out = testsDeById.get(qid);
    const deQuestion = String(out?.question ?? "");
    if (!srAnchor || !deQuestion) continue;

    const enQuestion = String((src as any)?.question ?? "");
    const enHint = typeof (src as any)?.hint === "string" ? String((src as any).hint) : "";
    const deHint = typeof out?.hint === "string" ? String(out.hint) : "";
    const enSide = [`Question (EN): ${enQuestion}`, enHint ? `Hint (EN): ${enHint}` : ""]
      .filter(Boolean)
      .join("\n");
    const deSide = [`Question (DE): ${deQuestion}`, deHint ? `Hint (DE): ${deHint}` : ""]
      .filter(Boolean)
      .join("\n");

    items.push({
      key,
      kind: "test",
      label: `test ${qid}`,
      serbian: srAnchor,
      english: enSide,
      german: deSide,
    });
  }

  const contentDeByType = new Map<string, any>();
  for (const c of params.contentDe) contentDeByType.set(String(c.contentType ?? ""), c);
  for (const src of params.source.contentEn ?? []) {
    const contentType = String((src as any)?.contentType ?? "");
    const key = `section:${contentType}`;
    if (pass && !pass.has(key)) continue;
    const mdEn = String((src as any)?.content ?? "");
    const out = contentDeByType.get(contentType);
    const mdDe = String(out?.content ?? "");
    if (!mdEn || !mdDe) continue;
    const srAnchor = extractSerbianFromMarkdown(mdEn);
    if (!srAnchor) continue;
    items.push({
      key,
      kind: "section",
      label: `section: ${contentType}`,
      serbian: srAnchor,
      english: mdEn,
      german: mdDe,
    });
  }

  return items;
}

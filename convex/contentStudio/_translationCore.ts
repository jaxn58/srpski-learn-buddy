import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  callAiJson,
  callAiText,
  extractStructuredMontenegroNote,
  formatSkillPromptBlock,
  languageRulesBlock,
  loadDraftSelectedSkills,
  mergeSkillsById,
  parseJsonOrThrow,
  resolvePromptFromDb,
  type Provider,
} from "./_shared";
import { CS_PROMPT_KEYS } from "./prompts";
import {
  extractSerbianFromMarkdown,
  type VerifierInputItem,
} from "./_verifier";
import { buildValidatorMemoryBlockFromEntries } from "./_validatorMemory";
import {
  CODE_DEFAULT_PROMPT_COGNATES,
  collectCognateCandidatesFromIssues,
  loadMergedPromptCognates,
} from "./_translatorCognates";
import { restoreOriginalAuthorQuote } from "../../shared/contentStudio/authorNote";

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

/**
 * Quiz answers are compared 1:1 against `de`. Leading German definite articles
 * are display sugar for gender, which already lives in the `gender` field.
 * Strip them so a learner answering "Reisepass" is not marked wrong for
 * omitting "der".
 */
const LEADING_GERMAN_DEFINITE_ARTICLE = /^(der|die|das|den|dem|des)\s+/i;

export function stripLeadingGermanArticle(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return trimmed;
  const stripped = trimmed.replace(LEADING_GERMAN_DEFINITE_ARTICLE, "").trim();
  return stripped || trimmed;
}

function timeoutForStepMs(step: string): number {
  if (step.startsWith("validator:")) return 90_000;
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

  // Serbian-column identity: any table with a literal "Serbian" header
  // (dialogue tables, grammar Pattern tables) must keep that column
  // byte-identical between EN and DE, row for row. Serbian is the language
  // being taught; the DE pass may translate the English column next to it,
  // never the Serbian one. Row-count mismatches are already caught above,
  // so this only compares content when the row counts line up.
  const enSerbianCells = extractSerbianColumnCells(mdEn);
  const deSerbianCells = extractSerbianColumnCells(mdDe);
  if (enSerbianCells.length > 0 && enSerbianCells.length === deSerbianCells.length) {
    for (let i = 0; i < enSerbianCells.length; i++) {
      if (enSerbianCells[i] !== deSerbianCells[i]) {
        issues.push(
          `Serbian column changed in row ${i + 1}: EN="${enSerbianCells[i]}" DE="${deSerbianCells[i]}"`
        );
      }
    }
  }

  return issues;
}

/**
 * Collect the cell values of the column literally headed "Serbian" from
 * every Markdown table in a section (dialogue tables, grammar Pattern
 * tables). Returns them in document order across all such tables.
 */
function extractSerbianColumnCells(md: string): string[] {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const cells: string[] = [];
  let serbianIdx: number | null = null;

  const isTableRow = (line: string) => {
    const t = line.trim();
    return t.startsWith("|") && t.endsWith("|");
  };
  const isTableSeparator = (line: string) => /^\|[\s:|-]+\|$/.test(line.trim());
  const splitCells = (line: string) => line.trim().slice(1, -1).split("|").map((c) => c.trim());

  for (const line of lines) {
    if (!isTableRow(line)) {
      serbianIdx = null;
      continue;
    }
    if (isTableSeparator(line)) continue;

    const rowCells = splitCells(line);
    const headerIdx = rowCells.findIndex((c) => /^serbian$/i.test(c));
    if (headerIdx >= 0) {
      serbianIdx = headerIdx;
      continue;
    }
    if (serbianIdx != null && rowCells[serbianIdx] !== undefined) {
      cells.push(rowCells[serbianIdx]);
    }
  }
  return cells;
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
// Translator admin context (Skills stage=translator + Memory applyInTranslator)
// ---------------------------------------------------------------------------

export type TranslatorAdminContext = {
  skillBlock: string;
  memoryBlock: string;
  rulesBlock: string;
};

/**
 * Load admin-managed translator rules (active skills + memory + the shared
 * Serbian language rules). The rules block is mandatory (throws if the DB
 * prompt `cs_language_rules` is missing) so the translator never runs
 * without the same norm as Creator, Lector and Fixer.
 */
export async function loadTranslatorAdminContext(
  ctx: ActionCtx,
  opts?: { draft?: any; unitNumber?: number }
): Promise<TranslatorAdminContext> {
  const draftSkillsPromise = opts?.draft
    ? loadDraftSelectedSkills(ctx, opts.draft)
    : typeof opts?.unitNumber === "number"
      ? ctx
          .runQuery(internal.contentStudio.getSelectedContentSkillIdsForUnit, {
            unitNumber: opts.unitNumber,
          })
          .then((ids) => loadDraftSelectedSkills(ctx, { specialistSkillIds: ids }))
      : Promise.resolve([]);

  const [translatorSkills, draftSkills, memoryEntries, rulesBlock] = await Promise.all([
    ctx.runQuery(internal.contentStudio.listActiveSkillsByStageInternal, {
      stage: "translator",
    }),
    draftSkillsPromise,
    ctx.runQuery(internal.contentStudio.getActiveValidatorMemoryForScope, {
      scope: "translator",
      limit: 60,
    }),
    languageRulesBlock(ctx),
  ]);

  const contentBlock = formatSkillPromptBlock(
    "DRAFT SKILLS (checked on this unit — apply across Creator, Fix, Lector, and Translator):",
    draftSkills
  );
  const translatorOnly = mergeSkillsById(translatorSkills as Array<{ _id: string; name: string; prompt: string }>);
  const translatorBlock = formatSkillPromptBlock(
    "TRANSLATOR SKILLS (EN→DE only):",
    translatorOnly
  );
  const skillBlock = [contentBlock, translatorBlock].filter(Boolean).join("\n\n");

  const memoryBlock = buildValidatorMemoryBlockFromEntries(memoryEntries as any, {
    limit: 40,
    requireScope: "none",
    heading:
      "TRANSLATOR MEMORY (admin-managed rules — apply during EN→DE translation):",
  });

  return { skillBlock, memoryBlock, rulesBlock };
}

/**
 * Final system prompt order: base → shared Serbian rules → admin skills → admin memory → retry feedback.
 */
export function composeTranslatorSystemPrompt(
  basePrompt: string,
  admin: TranslatorAdminContext,
  retryFeedback?: string
): string {
  const parts = [String(basePrompt || "").trim()];
  if (admin.rulesBlock.trim()) parts.push(admin.rulesBlock.trim());
  if (admin.skillBlock.trim()) parts.push(admin.skillBlock.trim());
  if (admin.memoryBlock.trim()) parts.push(admin.memoryBlock.trim());
  if (retryFeedback && retryFeedback.trim()) {
    parts.push(
      [
        "IMPORTANT: A previous attempt had issues flagged by the verifier or quality guard.",
        "When a CRITICAL line includes «Suggested German» / \"MUST use Suggested German verbatim\", you MUST use that German wording verbatim for the flagged span.",
        "Do not invent a different noun, article, or paraphrase of the suggestion.",
        "Leave all other German text unchanged whenever possible; only fix the flagged spans.",
        "Address this feedback:",
        retryFeedback.trim(),
      ].join("\n")
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Metadata translation (base prompt: chatPrompts cs_translator_metadata)
// ---------------------------------------------------------------------------

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
    adminContext?: TranslatorAdminContext;
    unitNumber?: number;
  }
): Promise<{ raw: string; provider: string; model: string }> {
  const admin = args.adminContext ?? (await loadTranslatorAdminContext(ctx, { unitNumber: args.unitNumber }));
  const retry = args.retryFeedback
    ? `EN→DE translation issues flagged by the verifier. Fix these while keeping the English meaning intact:\n${args.retryFeedback}`
    : undefined;
  const base = await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.translatorMetadata);
  const system = composeTranslatorSystemPrompt(base, admin, retry);
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
// Section (markdown) translation (base prompt: chatPrompts cs_translator_section)
// ---------------------------------------------------------------------------

export async function translateMarkdownSection(
  ctx: ActionCtx,
  args: {
    contentType: string;
    markdownEn: string;
    unitNumber: number;
    ai: AiCallOptions;
    retryFeedback?: string;
    adminContext?: TranslatorAdminContext;
    originalAuthorQuote?: string;
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

  const admin = args.adminContext ?? (await loadTranslatorAdminContext(ctx, { unitNumber: args.unitNumber }));
  const base = await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.translatorSection);
  const system = composeTranslatorSystemPrompt(
    base,
    admin,
    args.retryFeedback
  );
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
  let mdDe = out || input;
  if (args.contentType === "overview" && args.originalAuthorQuote) {
    mdDe = restoreOriginalAuthorQuote(mdDe, args.originalAuthorQuote);
  }
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
// Vocabulary translation (base prompt: chatPrompts cs_translator_vocab)
// ---------------------------------------------------------------------------

export interface VocabTranslationResult {
  courseVocabularyId: any;
  de?: string;
  noteDe?: string;
}

export const VOCAB_CHUNK_SIZE = 25;

/**
 * Deterministic guard: when the Serbian source note carries the
 * Montenegrin-pronunciation skill's structured line ("In Montenegro:
 * <form>."), the German note produced by this translation run must carry
 * the exact same line, unchanged -- it names a Serbian word, never
 * translated, only copied. Returns a soft quality-issue message when the
 * line is missing or altered; null when the source has no such line, or it
 * survived unchanged into noteDe.
 */
export function checkMontenegroNoteCarriedOver(params: {
  courseVocabularyId: string;
  noteEn: string;
  noteDe: string;
}): string | null {
  const sourceLine = extractStructuredMontenegroNote(params.noteEn);
  if (!sourceLine) return null;
  const targetLine = extractStructuredMontenegroNote(params.noteDe);
  if (targetLine === sourceLine) return null;
  return (
    `vocab:${params.courseVocabularyId}: noteEn has "${sourceLine}" but noteDe is missing it or has a different line. ` +
    `Copy it into noteDe unchanged (do not translate the Serbian word inside it).`
  );
}

export async function translateVocabChunks(
  ctx: ActionCtx,
  args: {
    items: any[];
    ai: AiCallOptions;
    stepLogs: StepLog[];
    retryFeedback?: string;
    stepPrefix?: string;
    adminContext?: TranslatorAdminContext;
    unitNumber?: number;
  }
): Promise<VocabTranslationResult[]> {
  const out: VocabTranslationResult[] = [];
  const stepPrefix = args.stepPrefix ?? "vocab";
  const admin = args.adminContext ?? (await loadTranslatorAdminContext(ctx, { unitNumber: args.unitNumber }));
  const base = await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.translatorVocab);

  for (let i = 0; i < args.items.length; i += VOCAB_CHUNK_SIZE) {
    const chunk = args.items.slice(i, i + VOCAB_CHUNK_SIZE);
    const system = composeTranslatorSystemPrompt(base, admin, args.retryFeedback);
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
    const dialectIssues: string[] = [];
    for (const src of chunk) {
      const id = String(src?._id ?? "").trim();
      const aiOut = byId.get(id);
      if (!aiOut) continue;
      const de =
        typeof aiOut?.de === "string" ? stripLeadingGermanArticle(String(aiOut.de)) : "";
      const noteDe = typeof aiOut?.noteDe === "string" ? String(aiOut.noteDe).trim() : "";
      const dialectIssue = checkMontenegroNoteCarriedOver({
        courseVocabularyId: id,
        noteEn: typeof src?.noteEn === "string" ? src.noteEn : "",
        noteDe,
      });
      if (dialectIssue) dialectIssues.push(dialectIssue);
      out.push({
        courseVocabularyId: src._id as any,
        ...(de ? { de } : {}),
        ...(noteDe ? { noteDe } : {}),
      });
    }
    if (dialectIssues.length > 0) {
      // Soft report only, same pattern as the test-translation quality guard:
      // never blocks the run, always visible on the translation report.
      args.stepLogs.push({
        step: `${stepName}:montenegro-note`,
        provider: "",
        model: "",
        durationMs: 0,
        inputTokens: null,
        outputTokens: null,
        thinkingTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        qualityIssues: dialectIssues,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Interactive tests translation (trilingual; SR answers stay untranslated)
// ---------------------------------------------------------------------------

/** Parenthetical learner glosses, e.g. "(It is one o'clock now.)" after a Serbian stem. */
export function extractParentheticalGlosses(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text || "").matchAll(/\(([^)]+)\)/g)) {
    const g = String(m[1] ?? "").trim();
    if (g) out.push(g);
  }
  return out;
}

function normalizeGlossCompare(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Exercise questionTypes whose prompts may include a Serbian stem. */
export function isSerbianStemExerciseType(questionType: string): boolean {
  const t = String(questionType || "");
  return t === "fillInBlank" || t === "dialogue" || t === "multipleChoice";
}

/**
 * Short source-language cue for fill-in-the-blank: tells the learner WHICH word
 * to put into the blank (EN→DE). Example: "(milk)" → "(Milch)".
 * NOT a full-sentence translation of the Serbian stem.
 */
export function isFillInSourceCue(gloss: string): boolean {
  const g = String(gloss || "").trim();
  if (!g) return false;
  if (/_+/.test(g)) return false;
  // Full sentences / explanations are help glosses, not fill-in cues.
  if (/[.!?…]/.test(g)) return false;
  const words = g.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  // Clause-like starters with enough words → help, not a cue noun/phrase.
  if (
    words.length >= 3 &&
    /^(it|this|that|there|here|she|he|they|we|you|i|ana|marko|marija)\b/i.test(g)
  ) {
    return false;
  }
  return true;
}

/** Full-sentence / blank-containing parenthetical that explains the Serbian (must be stripped). */
export function isHelpTranslationGloss(gloss: string): boolean {
  const g = String(gloss || "").trim();
  if (!g) return false;
  if (isFillInSourceCue(g)) return false;
  return true;
}

/**
 * Strip trailing HELP parentheticals only (sentence-level translation of the Serbian).
 * Keeps fill-in source cues like "(milk)" / "(Milch)".
 */
export function stripTrailingParentheticalGlosses(text: string): string {
  let s = String(text || "").replace(/\r\n/g, "\n").trim();
  for (let i = 0; i < 8; i++) {
    const m = s.match(/^(.*?)(?:\s*\(([^)]*)\))\s*([.!?…])?$/u);
    if (!m) break;
    const gloss = String(m[2] ?? "").trim();
    if (!gloss || !isHelpTranslationGloss(gloss)) break;
    const next = String(m[1] ?? "").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/**
 * Detect leftover HELP parentheticals (not fill-in cues) on DE exercise prompts.
 * Dialogue / MC: strip help. Fill-in cues are handled separately (must be kept + translated).
 */
export function findUnwantedExerciseGlossIssues(
  pairs: Array<{ questionId: string; questionType: string; questionEn: string; questionDe: string }>
): string[] {
  const issues: string[] = [];
  for (const p of pairs) {
    if (!isSerbianStemExerciseType(p.questionType)) continue;
    // fillInBlank keeps full-sentence context glosses on the DE track.
    if (p.questionType === "fillInBlank") continue;
    const deHelp = extractParentheticalGlosses(p.questionDe).filter(isHelpTranslationGloss);
    if (deHelp.length === 0) continue;
    issues.push(
      `questionId=${p.questionId}: exercise prompt still has parenthetical help ` +
        `(${deHelp.map((g) => `(${g})`).join(" ")}). ` +
        `Remove sentence-level translation help — keep the Serbian stem/blank only` +
        (p.questionType === "fillInBlank"
          ? ` (short fill-in cues like "(Milch)" must stay).`
          : `.`)
    );
  }
  return issues;
}

/**
 * fillInBlank: EN has short source cues "(milk)" → DE must keep them as German "(Milch)".
 */
export function findMissingOrUntranslatedFillInCueIssues(
  pairs: Array<{
    questionId: string;
    questionType: string;
    questionEn: string;
    questionDe: string;
  }>,
  cognates: Set<string> = new Set(CODE_DEFAULT_PROMPT_COGNATES)
): string[] {
  const issues: string[] = [];
  for (const p of pairs) {
    if (String(p.questionType || "") !== "fillInBlank") continue;
    const enCues = extractParentheticalGlosses(p.questionEn).filter(isFillInSourceCue);
    if (enCues.length === 0) continue;
    const deCues = extractParentheticalGlosses(p.questionDe).filter(isFillInSourceCue);
    if (deCues.length < enCues.length) {
      issues.push(
        `questionId=${p.questionId}: fill-in source cue missing on DE ` +
          `(EN has ${enCues.map((g) => `(${g})`).join(" ")}). ` +
          `Keep the Serbian stem/blank and translate the cue to German ` +
          `(e.g. "(milk)" → "(Milch)") so the learner knows what to fill in.`
      );
      continue;
    }
    for (let i = 0; i < enCues.length; i++) {
      const enG = enCues[i]!;
      const deG = deCues[i] ?? "";
      const enNorm = normalizeGlossCompare(enG);
      const deNorm = normalizeGlossCompare(deG);
      if (deNorm && enNorm === deNorm && !cognates.has(enNorm)) {
        issues.push(
          `questionId=${p.questionId}: fill-in source cue is still English "(${enG})". ` +
            `Translate it to German inside the parentheses (e.g. milk→Milch, apples→Äpfel).`
        );
      }
    }
  }
  return issues;
}

/**
 * fillInBlank: EN has full-sentence context glosses "(I am Ana.)" → DE must keep them as German "(Ich bin Ana.)".
 */
export function findMissingFillInContextGlossIssues(
  pairs: Array<{
    questionId: string;
    questionType: string;
    questionEn: string;
    questionDe: string;
  }>,
  cognates: Set<string> = new Set(CODE_DEFAULT_PROMPT_COGNATES)
): string[] {
  const issues: string[] = [];
  for (const p of pairs) {
    if (String(p.questionType || "") !== "fillInBlank") continue;
    const enContext = extractParentheticalGlosses(p.questionEn).filter(isHelpTranslationGloss);
    if (enContext.length === 0) continue;
    const deContext = extractParentheticalGlosses(p.questionDe).filter(isHelpTranslationGloss);
    if (deContext.length < enContext.length) {
      issues.push(
        `questionId=${p.questionId}: fill-in context gloss missing on DE ` +
          `(EN has ${enContext.map((g) => `(${g})`).join(" ")}). ` +
          `Keep the Serbian stem/blank and translate the full-sentence context to German ` +
          `(e.g. "(I am Ana.)" → "(Ich bin Ana.)") so the learner understands the exercise.`
      );
      continue;
    }
    for (let i = 0; i < enContext.length; i++) {
      const enG = enContext[i]!;
      const deG = deContext[i] ?? "";
      const enNorm = normalizeGlossCompare(enG);
      const deNorm = normalizeGlossCompare(deG);
      if (deNorm && enNorm === deNorm && !cognates.has(enNorm)) {
        issues.push(
          `questionId=${p.questionId}: fill-in context gloss is still English "(${enG})". ` +
            `Translate it to German inside the parentheses (e.g. "I am Ana." → "Ich bin Ana.").`
        );
      }
    }
  }
  return issues;
}

/** @deprecated Prefer findUnwantedExerciseGlossIssues / findMissingOrUntranslatedFillInCueIssues. */
export function findLostOrUntranslatedGlossIssues(
  pairs: Array<{ questionId: string; questionEn: string; questionDe: string }>
): string[] {
  return findMissingOrUntranslatedFillInCueIssues(
    pairs.map((p) => ({
      questionId: p.questionId,
      questionType: "fillInBlank",
      questionEn: p.questionEn,
      questionDe: p.questionDe,
    }))
  );
}

function looksEnglishParenthetical(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/[äöüßÄÖÜ]/.test(t)) return false;
  if (/[čćšžđČĆŠŽĐ]/.test(t)) return false;
  if (
    /\b(the|and|you|are|is|from|excuse|me|what|where|how|please|thank|hello|good|morning|name|who|why|this|that|with|your)\b/i.test(
      t
    )
  ) {
    return true;
  }
  // Latin-only multi-word snippet without German/Serbian markers → likely English reference.
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 2 && /^[a-zA-Z0-9\s:',.!?\-_/]+$/.test(t);
}

/**
 * Detect EN reference parentheticals appended on DE that were not present (or fewer) in EN.
 * Targets dialogueCompletion / A:/B: dialogue stems.
 */
export function findAppendedForeignParentheticalIssues(
  pairs: Array<{
    questionId: string;
    questionType: string;
    category: string;
    questionEn: string;
    questionDe: string;
  }>
): string[] {
  const issues: string[] = [];
  for (const p of pairs) {
    const cat = String(p.category || "");
    const enQ = String(p.questionEn || "");
    const deQ = String(p.questionDe || "");
    const looksLikeDialogueStem =
      cat === "dialogueCompletion" ||
      String(p.questionType || "") === "dialogue" ||
      /^(?:A|B)\s*:/i.test(enQ.trim());
    if (!looksLikeDialogueStem) continue;

    const enGlosses = extractParentheticalGlosses(enQ);
    const deGlosses = extractParentheticalGlosses(deQ);
    if (deGlosses.length <= enGlosses.length) continue;

    const extras = deGlosses.slice(enGlosses.length);
    const enNorm = normalizeGlossCompare(enQ);
    const foreignExtras = extras.filter((g) => {
      const gn = normalizeGlossCompare(g);
      if (looksEnglishParenthetical(g)) return true;
      // Extra DE paren that reproduces a large chunk of the EN prompt.
      if (gn.length >= 10 && enNorm.includes(gn)) return true;
      return false;
    });
    if (foreignExtras.length === 0) continue;

    issues.push(
      `questionId=${p.questionId}: additionally appended English parenthetical ` +
        `(${foreignExtras.map((g) => `(${g})`).join(" ")}). ` +
        `Remove it. Dialogue stays Serbian; do not append an EN reference translation.`
    );
  }
  return issues;
}

function buildGlossRetryFeedback(issues: string[]): string {
  return [
    "CRITICAL: Distinguish FILL-IN SOURCE CUES, FILL-IN CONTEXT GLOSSES, and HELP GLOSSES.",
    "",
    "fillInBlank SOURCE CUES (KEEP + TRANSLATE EN→DE):",
    "- Short parentheses after the blank tell the learner WHICH word to fill in.",
    "- Example EN: 'Molim vas, jedan litar ___. (milk)' → DE: 'Molim vas, jedan litar ___. (Milch)'",
    "- Example EN: 'Želim da kupim kilo ___. (apples)' → DE: 'Želim da kupim kilo ___. (Äpfel)'",
    "- Never drop these cues on the German track.",
    "",
    "fillInBlank CONTEXT GLOSSES (KEEP + TRANSLATE EN→DE):",
    "- Full-sentence parentheses that translate the whole Serbian line MUST stay on fillInBlank.",
    "- Example EN: 'Ja ____ Ana. (I am Ana.)' → DE: 'Ja ____ Ana. (Ich bin Ana.)'",
    "- Example EN: 'Ti ____ iz Srbije. (You are from Serbia.)' → DE: 'Ti ____ iz Srbije. (Du bist aus Serbien.)'",
    "- Without this context, beginner learners cannot understand the exercise.",
    "",
    "HELP GLOSSES on dialogue / multipleChoice (DELETE — do not translate to German):",
    "- Full-sentence translation of the Serbian stem, or parentheses that contain blanks.",
    "- Example EN: 'Ana je _____. Ona radi u bolnici. (Ana is a _____. She works in a hospital.)' → DE: 'Ana je _____. Ona radi u bolnici.'",
    "",
    "dialogue / dialogueCompletion: do NOT append an English reference translation in parentheses.",
    "Example EN dialogue: 'A: Odakle ste Vi? B: _____' → DE: same Serbian, no English paren.",
    ...issues,
  ].join("\n");
}

/** Strip blanks/equals scaffolding from matching/translation prompt text for comparison. */
function extractComparablePromptText(question: string): string {
  return String(question || "")
    .replace(/_+/g, " ")
    .replace(/^\s*=\s*/g, "")
    .replace(/\s*=\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Translation / vocabularyMatching prompts are learner-facing SOURCE-LANGUAGE words/phrases.
 * For the German track they MUST become German (Montag, heute, Hälfte, …), not stay English.
 * Cognates (code defaults + admin DB) may stay identical.
 */
export function findUntranslatedLearnerPromptIssues(
  pairs: Array<{
    questionId: string;
    questionType: string;
    questionEn: string;
    questionDe: string;
  }>,
  cognates: Set<string> = new Set(CODE_DEFAULT_PROMPT_COGNATES)
): string[] {
  const issues: string[] = [];
  for (const p of pairs) {
    const qType = String(p.questionType || "");
    if (qType !== "translation" && qType !== "matching") continue;

    const enPrompt = extractComparablePromptText(p.questionEn);
    const dePrompt = extractComparablePromptText(p.questionDe);
    if (!enPrompt || !dePrompt) continue;

    const enNorm = normalizeGlossCompare(enPrompt);
    const deNorm = normalizeGlossCompare(dePrompt);
    if (enNorm !== deNorm) continue;
    if (cognates.has(enNorm)) continue;

    issues.push(
      `questionId=${p.questionId} (${qType}): learner prompt is still English "${enPrompt}". ` +
        `Translate it to the German equivalent the DE-track learner should see ` +
        `(e.g. Monday→Montag, today→heute, half→halb/Hälfte). Keep blanks/format identical.`
    );
  }
  return issues;
}

/** DE category instructions must not tell German learners to work "from English". */
export function findEnglishFramingInstructionIssues(categoryInstructionsDe: string): string[] {
  const text = String(categoryInstructionsDe || "").trim();
  if (!text) return [];
  if (/\b(english|englisch(?:en|e|er|es)?)\b/i.test(text)) {
    return [
      `categoryInstructionsDe still refers to English ("${text}"). ` +
        `For the German learner track, reframe the instruction to German as the source language ` +
        `(e.g. "Übersetzen Sie die folgenden Wörter aus dem Deutschen ins Serbische." / ` +
        `"Ordne die deutsche Bedeutung dem richtigen serbischen Wort zu."). ` +
        `Do NOT mention English.`,
    ];
  }
  return [];
}

function buildPromptGuardRetryFeedback(issues: string[]): string {
  return [
    "CRITICAL: German-track interactive tests must not keep English as the learner's source language.",
    "For questionType 'translation': translate each English prompt word/phrase to German (Monday→Montag, today→heute).",
    "For questionType 'matching': translate the English meaning side to German (half→halb/Hälfte); keep _____ blanks.",
    "For categoryInstructions: adapt EN framing that says 'from English' / 'English meaning' to German-source framing. Never leave 'Englisch/English' in the DE instructions.",
    "Serbian answers/options stay Serbian and untranslated.",
    ...issues,
  ].join("\n");
}

// Base prompt: chatPrompts cs_translator_tests (no code fallback).

async function translateTestsForCategoryOnce(
  ctx: ActionCtx,
  args: {
    category: string;
    bucket: { categoryInstructions: string; questions: any[] };
    targetReleaseStatus: TargetReleaseStatus;
    ai: AiCallOptions;
    stepLogs: StepLog[];
    retryFeedback?: string;
    stepName: string;
    adminContext?: TranslatorAdminContext;
    unitNumber?: number;
  }
): Promise<any[]> {
  const admin = args.adminContext ?? (await loadTranslatorAdminContext(ctx, { unitNumber: args.unitNumber }));
  const base = await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.translatorTests);
  const system = composeTranslatorSystemPrompt(
    base,
    admin,
    args.retryFeedback
  );
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
    { step: args.stepName, stage: "auditor", system, user, maxTokens: 3500 },
    args.ai
  );
  args.stepLogs.push(makeStepLog(args.stepName, ai, Date.now() - t0));
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

  const countBlanks = (s: string) => (String(s || "").match(/_+/g) || []).length;
  /** Normalize any underscore-run blanks to the canonical five-underscore form. */
  const normalizeBlankRuns = (s: string) => String(s || "").replace(/_+/g, "_____");

  const produced: any[] = [];
  for (const src of args.bucket.questions) {
    const qid = String(src.questionId);
    const oq = outById.get(qid);
    const srcQuestion = String(src.question ?? "");
    const srcBlanks = countBlanks(srcQuestion);

    let translatedQ = typeof oq?.questionDe === "string" ? String(oq.questionDe) : srcQuestion;
    const qType = String(src.questionType ?? "");
    if (qType === "fillInBlank" || qType === "matching" || qType === "dialogue") {
      if (srcBlanks === countBlanks(translatedQ)) {
        // Same blank count: normalize underscore runs to _____ without discarding DE text.
        if (srcBlanks > 0) translatedQ = normalizeBlankRuns(translatedQ);
      } else {
        // Blank-count mismatch is unsafe for the exercise UI. Fall back to EN source,
        // then strip learner glosses for Serbian-stem types below.
        translatedQ = srcQuestion;
      }
    }
    // Exercise tests: strip help glosses on dialogue/MC — fillInBlank keeps context glosses.
    if (isSerbianStemExerciseType(qType) && qType !== "fillInBlank") {
      translatedQ = stripTrailingParentheticalGlosses(translatedQ);
    }
    const translatedHint =
      typeof oq?.hintDe === "string" ? String(oq.hintDe) : typeof src.hint === "string" ? src.hint : undefined;

    produced.push(
      args.targetReleaseStatus === "preview"
        ? {
            questionId: qid,
            category: String(src.category ?? ""),
            categoryInstructions:
              categoryInstructionsDe ||
              (typeof src.categoryInstructions === "string" ? src.categoryInstructions : undefined),
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
              categoryInstructionsDe ||
              (typeof src.categoryInstructions === "string" ? src.categoryInstructions : undefined),
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

export async function translateTestsForCategory(
  ctx: ActionCtx,
  args: {
    category: string;
    bucket: { categoryInstructions: string; questions: any[] };
    targetReleaseStatus: TargetReleaseStatus;
    ai: AiCallOptions;
    stepLogs: StepLog[];
    retryFeedback?: string;
    adminContext?: TranslatorAdminContext;
    unitNumber?: number;
  }
): Promise<any[]> {
  const baseStep = args.retryFeedback ? `tests:${args.category}:retry` : `tests:${args.category}`;
  const admin = args.adminContext ?? (await loadTranslatorAdminContext(ctx, { unitNumber: args.unitNumber }));
  const cognates = await loadMergedPromptCognates(ctx);

  let produced = await translateTestsForCategoryOnce(ctx, {
    ...args,
    adminContext: admin,
    stepName: baseStep,
  });

  const qualityPairs = () =>
    args.bucket.questions.map((src) => {
      const qid = String(src.questionId);
      const de = produced.find((p) => String(p.questionId) === qid);
      return {
        questionId: qid,
        questionType: String(src.questionType ?? ""),
        category: args.category,
        questionEn: String(src.question ?? ""),
        questionDe: String(de?.question ?? ""),
      };
    });

  const collectQualityIssues = () => {
    const instructionsDe =
      produced.length > 0 && typeof produced[0]?.categoryInstructions === "string"
        ? String(produced[0].categoryInstructions)
        : "";
    return [
      ...findUnwantedExerciseGlossIssues(qualityPairs()),
      ...findMissingOrUntranslatedFillInCueIssues(qualityPairs(), cognates),
      ...findMissingFillInContextGlossIssues(qualityPairs(), cognates),
      ...findAppendedForeignParentheticalIssues(qualityPairs()),
      ...findUntranslatedLearnerPromptIssues(qualityPairs(), cognates),
      ...findEnglishFramingInstructionIssues(instructionsDe),
    ];
  };

  let qualityIssues = collectQualityIssues();

  // One automatic quality-guard retry (leftover gloss help, missing fill-in cues, untranslated EN prompts, EN framing).
  // Skip if the caller already supplied retry feedback (verifier pass-2 path).
  if (qualityIssues.length > 0 && !args.retryFeedback) {
    const glossOnly = qualityIssues.every(
      (i) =>
        i.includes("parenthetical help") ||
        i.includes("parenthetical") ||
        i.includes("fill-in source cue") ||
        i.includes("fill-in context gloss") ||
        i.includes("appended English parenthetical")
    );
    const feedback = glossOnly
      ? buildGlossRetryFeedback(qualityIssues)
      : buildPromptGuardRetryFeedback(qualityIssues);
    console.warn(
      `[translateTests] category=${args.category}: ${qualityIssues.length} quality issue(s); auto-retrying once.`
    );
    produced = await translateTestsForCategoryOnce(ctx, {
      ...args,
      adminContext: admin,
      retryFeedback: feedback,
      stepName: `tests:${args.category}:quality-retry`,
    });
    qualityIssues = collectQualityIssues();
  }

  if (qualityIssues.length > 0) {
    // Never hard-stop: persist the category and surface the issues. Whether an
    // identical EN/DE word is a real cognate is decided later, after a German check.
    const untranslatedTerms = collectCognateCandidatesFromIssues(qualityIssues);
    console.warn(
      `[translateTests] category=${args.category}: ${qualityIssues.length} quality issue(s); continuing (soft)` +
        (untranslatedTerms.length ? ` untranslated=${untranslatedTerms.join(",")}` : "") +
        "."
    );
    args.stepLogs.push({
      step: `tests:${args.category}:quality-issues`,
      provider: "",
      model: "",
      durationMs: 0,
      inputTokens: null,
      outputTokens: null,
      thinkingTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
      qualityIssues,
    });
    return produced;
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
    // header below, combined with the kind=='test' rule in the DE verifier,
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
      questionType: String((src as any)?.questionType ?? ""),
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

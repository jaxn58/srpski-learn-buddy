/**
 * Content Studio model evaluation — current Markdown pipeline.
 *
 * Compares Creator + Lector on the same Dev prompts and briefs.
 * Never writes to Convex.
 *
 * Run from repo root (Dev env in .env.local):
 *   pnpm exec tsx scripts/model-evaluation/content-studio-model-eval.ts
 *   pnpm exec tsx scripts/model-evaluation/content-studio-model-eval.ts --dry-run
 *
 * Reports land in tmp/model-eval/runs/<timestamp>/ (gitignored).
 */

import { config as loadEnv } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { MODEL_PRICING } from "../../convex/ai/modelPricing";
import {
  buildReasoningParams,
  effectiveMaxTokens,
} from "../../convex/contentStudio/_modelCapabilities";
import { CS_PROMPT_KEYS, formatKnownVocabularyKeys, getSpecialistUserPromptBase } from "../../convex/contentStudio/prompts";
import { parseMarkdownToUnitPackage, validateMarkdownStructure } from "../markdownParser/parser";
import { analyzeGrammarV2 } from "../markdownParser/sectionUtils";
import { parseBriefText, renderBriefText } from "../../shared/contentStudio/briefTemplate";
import { DEFAULT_VOCABULARY_BUDGET, resolveVocabularyBudget } from "../../shared/contentStudio/vocabularyBudget";

loadEnv({ path: ".env.local" });

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const FIXTURE_DIR = path.join("tmp", "model-eval");
const BLOCKING_CODES = new Set(["SERBIAN_ERROR", "TRANSLATION_MISMATCH"]);

const CANDIDATES = ["gemini-2.5-pro", "gemini-3.8-flash"] as const;

type CandidateModel = (typeof CANDIDATES)[number];

type EvalCase = {
  id: string;
  unitNumber: number;
  moduleNumber: number;
  moduleTitle: string;
  title: string;
  description: string;
  brief: string;
};

type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  thinkingTokens?: number;
};

type CallResult = {
  raw: string;
  usage: Usage | null;
  estimatedCostUsd: number | null;
  durationMs: number;
};

function isDryRun(): boolean {
  return process.argv.includes("--dry-run");
}

function readUtf8(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readUtf8(filePath)) as T;
}

function loadPrompt(key: string): string {
  const filePath = path.join(FIXTURE_DIR, `${key}.txt`);
  const text = readUtf8(filePath).trim();
  if (!text) throw new Error(`Prompt ${key} is empty. Refresh fixtures first.`);
  return text;
}

function previousVocabKeys(unitNumber: number): string[] {
  const byUnit = readJson<Record<string, string[]>>(path.join(FIXTURE_DIR, "eval-vocab-keys.json"));
  const keys: string[] = [];
  for (const [unit, list] of Object.entries(byUnit)) {
    if (Number(unit) < unitNumber) keys.push(...list);
  }
  return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
}

function buildU019Brief(): string {
  return renderBriefText({
    moduleNumber: 2,
    fields: {
      unitType: "standard",
      cefrLevel: "A1.2",
      strand: "SET",
      setting: "serbia",
      situation:
        "The learner views a flat in Novi Sad with a landlord. They walk through the rooms, ask where things are, and talk about rent in dinars, the deposit, utilities and the move-in date. Suggested key vocabulary (max 30): stan, soba, kuhinja, kupatilo, balkon, kirija, depozit, račun, struja, voda, grejanje, hiljada, dve hiljade, deset hiljada, u stanu, u kuhinji, na balkonu, od prvog, slobodan, namešten.",
      canDo: [
        "A1.2-SET-01: Can view a flat with a landlord: ask about rent, deposit, utilities and move-in date.",
        "A1.2-DAY-03: Can describe a home and its rooms and say where things are using the locative with u/na.",
        "A1.2-GEN-10: Can understand and say numbers from 1,000 to 100,000 for rent, salaries and dinar prices.",
      ].join("\n"),
      grammarIn:
        "Locative singular as a rule: u/na + -u / -i for masculine/neuter and feminine nouns (u stanu, u kuhinji, na balkonu). Numbers 1,000–100,000 as single words for dinar amounts (hiljada, dve hiljade, deset hiljada).",
      grammarOut:
        "Locative plural (later case block). Motion vs location / accusative of destination (Unit 46). Full dative (Unit 21). Instrumental (Unit 32).",
      chunks: [
        "Koliko je kirija? (How much is the rent?)",
        "depozit (deposit)",
        "od prvog (from the first) — date chunk; rule later",
        "Ima li grejanje? (Is there heating?) — recycle li from Unit 2",
      ].join("\n"),
      recycle: "Regular noun plurals from Unit 17; moći / morati from Unit 15; u/na location chunks from Units 4 and 17.",
      pitfalls: [
        "WRONG: Ja sam u stan. -> CORRECT: Ja sam u stanu. (Location takes locative, not the dictionary form.)",
        "WRONG: u kuhinju (when already inside) -> CORRECT: u kuhinji. (Destination accusative is out of scope; this unit is location.)",
        "WRONG: deset hiljada dinara as 10.000 said digit-by-digit -> CORRECT: say the number as a word (deset hiljada).",
      ].join("\n"),
      scenes: [
        "Entering the hallway: landlord greets, learner says they came to view the flat.",
        "Walking through kitchen and balcony: learner asks where things are using u/na + locative.",
        "At the table: rent, deposit and move-in date in dinars.",
      ].join("\n"),
      listening: "stanu, kuhinji, balkonu, kirija, hiljada",
      cultural: "Flat viewings in Serbia: deposits, dinar vs euro quotes, and asking what is included in the rent.",
      exerciseFocus:
        "Exercises 2 and 3 test locative singular (u/na + ending). Exercise 1 recycles rooms and numbers. Exercise 4 matches rent/deposit phrases. Exercise 5 is the viewing dialogue.",
      vocabularyBudget: "30",
    },
  });
}

function loadCases(): EvalCase[] {
  const drafts = readJson<Record<string, { unitNumber: number; moduleNumber: number; title: string; description: string; brief: string }>>(
    path.join(FIXTURE_DIR, "eval-briefs.json")
  );
  const u1 = drafts["1"];
  const u2 = drafts["2"];
  if (!u1?.brief || !u2?.brief) {
    throw new Error("Missing U001/U002 briefs in tmp/model-eval/eval-briefs.json");
  }
  return [
    {
      id: "u001",
      unitNumber: 1,
      moduleNumber: 1,
      moduleTitle: "The Arrival",
      title: u1.title,
      description: u1.description,
      brief: u1.brief,
    },
    {
      id: "u002",
      unitNumber: 2,
      moduleNumber: 1,
      moduleTitle: "The Arrival",
      title: u2.title,
      description: u2.description,
      brief: u2.brief,
    },
    {
      id: "u019",
      unitNumber: 19,
      moduleNumber: 2,
      moduleTitle: "Daily Life",
      title: "Viewing a Flat",
      description: "View a flat in Novi Sad: rooms, locative location phrases, rent and deposit in dinars.",
      brief: buildU019Brief(),
    },
  ];
}

function vocabularyBudgetBlock(brief: string): string {
  const parsed = parseBriefText(brief);
  const budget = resolveVocabularyBudget({
    brief: parsed.fields.vocabularyBudget,
    settings: DEFAULT_VOCABULARY_BUDGET,
  }).budget;
  return [
    "",
    "=== VOCABULARY BUDGET (target, not a cap) ===",
    `- Aim for about ${budget} vocabulary entries in this unit.`,
    "- Completeness outranks this number: every Serbian word used in the grammar section, dialogues, phrases or exercises MUST appear in the vocabulary table, even if the unit ends up above the target.",
    "- Never drop or omit a word that the unit teaches or uses in order to reach the target. Reduce content instead (fewer new nouns, shorter dialogues) if you need to come down.",
    "",
  ].join("\n");
}

function languageRulesBlock(rules: string): string {
  return rules
    ? `\n=== SERBIAN LANGUAGE RULES (binding for all Serbian text) ===\n${rules}\n`
    : "";
}

function creatorSystemPrompt(creator: string, rules: string, brief: string): string {
  return [
    creator.replace(/\[LANGUAGE\]/g, "English"),
    languageRulesBlock(rules),
    vocabularyBudgetBlock(brief),
  ].join("\n");
}

function creatorUserPrompt(evalCase: EvalCase, knownKeys: string[]): string {
  const draft = {
    moduleNumber: evalCase.moduleNumber,
    moduleTitle: evalCase.moduleTitle,
    unitNumber: evalCase.unitNumber,
    authorNoteName: "Jacksenn",
    authorNoteQuote: "",
  };
  const briefBlock = [
    "CREATOR BRIEF (from user; may be German; output must still be English):",
    evalCase.brief,
  ].join("\n");
  return getSpecialistUserPromptBase(draft, evalCase.title, evalCase.description, briefBlock, knownKeys, "");
}

function lectorSystemPrompt(lector: string, rules: string, evalCase: EvalCase, knownKeys: string[]): string {
  return [
    lector,
    languageRulesBlock(rules),
    "",
    "=== COURSE CONTEXT ===",
    `This is Unit ${evalCase.unitNumber} of a Serbian language course for English speakers.`,
    "The course teaches STANDARD SERBIAN (Ekavian dialect, Latin script primarily).",
    "",
    `VOCABULARY ALREADY TAUGHT IN PREVIOUS UNITS (${knownKeys.length} words):`,
    formatKnownVocabularyKeys(knownKeys),
    "",
    "IMPORTANT: Words from previous units are ALREADY KNOWN to the learner. They do NOT need to be re-introduced. Using them in exercises for REVIEW is encouraged.",
  ].join("\n");
}

function coerceMessageContent(content: unknown): string | null {
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => (typeof part === "object" && part && "text" in part ? String(part.text ?? "") : ""))
      .join("")
      .trim();
    return joined || null;
  }
  return null;
}

function extractRaw(data: unknown): string | null {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (!record) return null;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : null;
  const message = first?.message && typeof first.message === "object" ? (first.message as Record<string, unknown>) : null;
  return coerceMessageContent(message?.content) ?? coerceMessageContent(first?.text);
}

function extractUsage(data: unknown): Usage | null {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const usage = record?.usage && typeof record.usage === "object" ? (record.usage as Record<string, unknown>) : null;
  if (!usage) return null;
  const details =
    usage.completion_tokens_details && typeof usage.completion_tokens_details === "object"
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : null;
  const inputTokens = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const outputTokens = typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined;
  const totalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;
  const thinkingTokens = typeof details?.reasoning_tokens === "number" ? details.reasoning_tokens : undefined;
  if (inputTokens == null && outputTokens == null && totalTokens == null) return null;
  return { inputTokens, outputTokens, totalTokens, ...(thinkingTokens != null ? { thinkingTokens } : {}) };
}

function estimateCostUsd(model: string, usage: Usage | null): number | null {
  if (!usage) return null;
  const rate = MODEL_PRICING[model];
  if (!rate) return null;
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const thinking = usage.thinkingTokens ?? 0;
  if (input <= 0 && output <= 0 && thinking <= 0) return null;
  return Math.round(((input / 1_000_000) * rate.inputUsdPer1M + ((output + thinking) / 1_000_000) * rate.outputUsdPer1M) * 1e6) / 1e6;
}

async function callGemini(params: {
  model: CandidateModel;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  json?: boolean;
}): Promise<CallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing in .env.local");

  const maxTokens = effectiveMaxTokens({
    provider: "gemini",
    model: params.model,
    requestedMaxTokens: params.maxTokens,
    defaultMaxTokens: params.maxTokens,
    reasoningEffort: undefined,
  });

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  let res: Response;
  try {
    res = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
        ...(params.json ? { response_format: { type: "json_object" } } : {}),
        ...buildReasoningParams("gemini", params.model, undefined),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI API timeout after ${params.timeoutMs}ms`);
    }
    throw error;
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data: unknown = await res.json();
  const raw = extractRaw(data);
  if (!raw) throw new Error("AI returned no content");
  const usage = extractUsage(data);
  return {
    raw,
    usage,
    estimatedCostUsd: estimateCostUsd(params.model, usage),
    durationMs: Date.now() - started,
  };
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) return input.slice(start, i + 1);
  }
  return null;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const extracted = extractFirstJsonObject(raw);
    if (!extracted) throw new Error("Lector output is not JSON");
    return JSON.parse(extracted) as Record<string, unknown>;
  }
}

function truncateForAudit(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[TRUNCATED_FOR_AUDIT]`;
}

function buildAuditPayload(pkg: ReturnType<typeof parseMarkdownToUnitPackage>, knownKeys: string[]): Record<string, unknown> {
  const contentEn = pkg.content.en;
  const cats = pkg.exercises.en;
  return {
    schemaVersion: pkg.schemaVersion,
    unitNumber: pkg.unitNumber,
    module: pkg.module,
    title: pkg.title,
    description: pkg.description,
    contentEn: {
      overviewMd: truncateForAudit(contentEn.overviewMd, 2500),
      grammarMd: truncateForAudit(contentEn.grammarMd, 8000),
      phrasesMd: truncateForAudit(contentEn.phrasesMd, 4000),
      dialoguesMd: truncateForAudit(contentEn.dialoguesMd, 4000),
      testIntroductionMd: truncateForAudit(contentEn.testIntroductionMd, 1600),
    },
    vocabularyKeys: pkg.vocabulary.en.map((row) => String(row.serbian || "").trim()).filter(Boolean),
    knownFromPreviousUnits: knownKeys.slice(0, 400),
    vocabularySample: pkg.vocabulary.en.slice(0, 80).map((row) => ({
      serbian: row.serbian,
      en: row.en,
      noteEn: typeof row.noteEn === "string" ? truncateForAudit(row.noteEn, 200) : undefined,
      gender: row.gender,
    })),
    exercises: cats.map((cat) => ({
      category: cat.category,
      categoryInstructions: truncateForAudit(cat.categoryInstructions, 240),
      questions: cat.questions.slice(0, 10).map((q) => ({
        questionId: q.questionId,
        order: q.order,
        questionType: q.questionType,
        question: truncateForAudit(q.question, 220),
        correctAnswer: truncateForAudit(q.correctAnswer, 120),
        options: Array.isArray(q.options) ? q.options.slice(0, 6).map((o) => truncateForAudit(o, 120)) : undefined,
      })),
      totalQuestions: cat.questions.length,
    })),
  };
}

function grammarSection(markdown: string): string {
  const match = markdown.match(/##\s+3\.\s+Grammar[\s\S]+?(?=##\s+\d+\.|$)/);
  return match?.[0] ?? "";
}

function countExampleLines(grammarMd: string): number {
  return grammarMd.split("\n").filter((line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line) && /\(.+\)/.test(line)).length;
}

function summarizeLector(raw: string): {
  parseOk: boolean;
  blockers: number;
  warnings: number;
  codes: string[];
} {
  try {
    const audit = parseJsonObject(raw);
    const issues = [
      ...(Array.isArray(audit.blockers) ? audit.blockers : []),
      ...(Array.isArray(audit.warnings) ? audit.warnings : []),
    ];
    const normalized = issues.map((issue) => {
      const rec = issue && typeof issue === "object" ? (issue as Record<string, unknown>) : {};
      return String(rec.code || "").trim();
    });
    const blockers = normalized.filter((code) => BLOCKING_CODES.has(code)).length;
    return {
      parseOk: true,
      blockers,
      warnings: normalized.length - blockers,
      codes: [...new Set(normalized.filter(Boolean))],
    };
  } catch {
    return { parseOk: false, blockers: 0, warnings: 0, codes: [] };
  }
}

type CaseResult = {
  model: CandidateModel;
  caseId: string;
  creatorOk: boolean;
  parserErrors: string[];
  grammarV2: boolean;
  grammarPoints: number;
  grammarExamples: number;
  vocabCount: number;
  exerciseItems: number;
  creator: { durationMs: number; costUsd: number | null; usage: Usage | null };
  lector: { parseOk: boolean; blockers: number; warnings: number; codes: string[]; durationMs: number; costUsd: number | null; usage: Usage | null } | null;
  error?: string;
};

function writeSummary(outDir: string, results: CaseResult[]): void {
  const lines = [
    "# Content Studio Modell-Eval",
    "",
    "Creator + Lector, keine Revises. Prompts aus Dev (`cs_unit_creator`, `cs_lector`, `cs_language_rules`).",
    "U001/U002: Live-Briefs. U019: lokaler Brief aus UNIT_MAP (nicht in der DB).",
    "Bekannte Vokabeln für U019 nur aus Dev-Units 1–4.",
    "",
    "| Modell | Case | Parser OK | v2 | Punkte | Beispiele | Wörter | Items | Lector-Blocker | Lector-Warn | Creator USD | Lector USD | Creator s |",
    "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const row of results) {
    lines.push(
      [
        row.model,
        row.caseId,
        row.creatorOk ? "ja" : "nein",
        row.grammarV2 ? "ja" : "nein",
        row.grammarPoints,
        row.grammarExamples,
        row.vocabCount,
        row.exerciseItems,
        row.lector?.blockers ?? "–",
        row.lector?.warnings ?? "–",
        row.creator.costUsd ?? "–",
        row.lector?.costUsd ?? "–",
        Math.round(row.creator.durationMs / 1000),
      ].join(" | ").replace(/^/, "| ").concat(" |")
    );
  }
  const failed = results.filter((r) => r.error);
  if (failed.length) {
    lines.push("", "## Fehler", "");
    for (const row of failed) {
      lines.push(`- ${row.model} ${row.caseId}: ${row.error}`);
    }
  }
  writeFileSync(path.join(outDir, "summary.md"), lines.join("\n"), "utf8");
}

async function main(): Promise<void> {
  const dryRun = isDryRun();
  const creatorPrompt = loadPrompt(CS_PROMPT_KEYS.unitCreator);
  const lectorPrompt = loadPrompt(CS_PROMPT_KEYS.lector);
  const languageRules = loadPrompt(CS_PROMPT_KEYS.languageRules);
  const cases = loadCases();

  console.log(`Cases: ${cases.map((c) => c.id).join(", ")}`);
  console.log(`Models: ${CANDIDATES.join(", ")}`);
  console.log(`Creator prompt: ${creatorPrompt.length} chars`);
  console.log(`Lector prompt: ${lectorPrompt.length} chars`);
  if (dryRun) {
    console.log("Dry-run: fixtures loaded, no API calls.");
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing in .env.local");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(FIXTURE_DIR, "runs", stamp);
  mkdirSync(outDir, { recursive: true });

  const results: CaseResult[] = [];
  for (const model of CANDIDATES) {
    for (const evalCase of cases) {
      const knownKeys = previousVocabKeys(evalCase.unitNumber);
      const label = `${model} ${evalCase.id}`;
      console.log(`\n=== ${label} Creator ===`);
      const caseDir = path.join(outDir, `${model}__${evalCase.id}`);
      mkdirSync(caseDir, { recursive: true });

      const base: CaseResult = {
        model,
        caseId: evalCase.id,
        creatorOk: false,
        parserErrors: [],
        grammarV2: false,
        grammarPoints: 0,
        grammarExamples: 0,
        vocabCount: 0,
        exerciseItems: 0,
        creator: { durationMs: 0, costUsd: null, usage: null },
        lector: null,
      };

      try {
        const created = await callGemini({
          model,
          system: creatorSystemPrompt(creatorPrompt, languageRules, evalCase.brief),
          user: creatorUserPrompt(evalCase, knownKeys),
          maxTokens: 12000,
          timeoutMs: 180_000,
        });
        writeFileSync(path.join(caseDir, "creator.md"), created.raw, "utf8");
        base.creator = {
          durationMs: created.durationMs,
          costUsd: created.estimatedCostUsd,
          usage: created.usage,
        };

        const structure = validateMarkdownStructure(created.raw);
        const grammarMd = grammarSection(created.raw);
        const grammar = analyzeGrammarV2(grammarMd);
        base.parserErrors = structure.errors;
        base.creatorOk = structure.valid;
        base.grammarV2 = grammar.isV2;
        base.grammarPoints = grammar.points;
        base.grammarExamples = countExampleLines(grammarMd);
        if (grammar.errors.length) {
          base.parserErrors = [...base.parserErrors, ...grammar.errors];
          base.creatorOk = false;
        }

        try {
          const pkg = parseMarkdownToUnitPackage(created.raw);
          base.vocabCount = pkg.vocabulary.en.length;
          base.exerciseItems = pkg.exercises.en.reduce((sum, cat) => sum + cat.questions.length, 0);

          console.log(`=== ${label} Lector ===`);
          const lectured = await callGemini({
            model,
            system: lectorSystemPrompt(lectorPrompt, languageRules, evalCase, knownKeys),
            user: ["AUDIT PAYLOAD JSON:", JSON.stringify(buildAuditPayload(pkg, knownKeys))].join("\n"),
            maxTokens: 3500,
            timeoutMs: 120_000,
            json: true,
          });
          writeFileSync(path.join(caseDir, "lector.json"), lectured.raw, "utf8");
          const summary = summarizeLector(lectured.raw);
          base.lector = {
            ...summary,
            durationMs: lectured.durationMs,
            costUsd: lectured.estimatedCostUsd,
            usage: lectured.usage,
          };
        } catch (parseError) {
          base.error = parseError instanceof Error ? parseError.message : String(parseError);
        }
      } catch (error) {
        base.error = error instanceof Error ? error.message : String(error);
        console.error(`${label} failed: ${base.error}`);
      }

      results.push(base);
      writeFileSync(path.join(caseDir, "metrics.json"), JSON.stringify(base, null, 2), "utf8");
      console.log(
        `${label}: parser.ok=${base.creatorOk} vocab=${base.vocabCount} items=${base.exerciseItems} lector.blockers=${base.lector?.blockers ?? "n/a"} cost=${base.creator.costUsd ?? "?"}`
      );
    }
  }

  writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2), "utf8");
  writeSummary(outDir, results);
  console.log(`\nWrote ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

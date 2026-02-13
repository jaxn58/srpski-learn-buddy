import { v } from "convex/values";
import { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { UnitPackageSchema, type ValidationIssue } from "../../scripts/unitPackage/schema";
import { autofixUnitPackage } from "../../scripts/unitPackage/autofix";
import { validateMarkdownStructure } from "../../scripts/markdownParser/parser";

export type DraftStatus =
  | "draft"
  | "qc_failed"
  | "qc_passed"
  | "audit_failed"
  | "ready_to_publish"
  | "published";

export type Provider = "gemini" | "openai";
export type Stage = "specialist" | "auditor";
export type Section = "overview" | "grammar" | "phrases" | "dialogues" | "exercises";
export type SkillStage = "specialist" | "auditor";
export type ReleaseStatus = "published" | "preview" | "offline";

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

export async function requireSuperadmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user || user.role !== "superadmin") {
    throw new Error("Unauthorized - Superadmin required");
  }
  return user;
}

export async function requireSuperadminAction(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized - Superadmin required");
  const user = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });
  if (!user || user.role !== "superadmin") throw new Error("Unauthorized - Superadmin required");
  return user;
}

export function issuesToFindings(stage: "validator" | "auditor", issues: ValidationIssue[]) {
  return issues.map((i) => ({
    stage,
    severity: i.level === "error" ? ("error" as const) : ("warning" as const),
    code: stage === "validator" ? "validator" : "auditor",
    message: i.message,
    path: i.path?.length ? i.path.join(".") : undefined,
  }));
}

export function buildValidationReport(params: {
  deepIssues: ValidationIssue[];
  templateIssues: ValidationIssue[];
  autofixChangesCount: number;
}) {
  const deepErrors = params.deepIssues.filter((i) => i.level === "error");
  const deepWarnings = params.deepIssues.filter((i) => i.level === "warning");
  const templateErrors = params.templateIssues.filter((i) => i.level === "error");
  const templateWarnings = params.templateIssues.filter((i) => i.level === "warning");
  const ok = deepErrors.length === 0 && templateErrors.length === 0;

  return {
    ok,
    autofixChangesCount: params.autofixChangesCount,
    counts: {
      deepErrors: deepErrors.length,
      deepWarnings: deepWarnings.length,
      templateErrors: templateErrors.length,
      templateWarnings: templateWarnings.length,
    },
    deepIssues: params.deepIssues,
    templateIssues: params.templateIssues,
  };
}

export function resolveProviderAndModel(params: {
  preferredProvider?: Provider;
  stage: Stage;
  config: null | {
    specialist: { provider: Provider; model: string };
    auditor: { provider: Provider; model: string };
  };
}): { provider: Provider; apiKey: string; apiUrl: string; model: string } {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const preferred = params.preferredProvider;

  const pick = (p: Provider): { provider: Provider; apiKey: string; apiUrl: string } => {
    if (p === "gemini") {
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
      return {
        provider: "gemini",
        apiKey: process.env.GEMINI_API_KEY,
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      };
    }
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      apiUrl: "https://api.openai.com/v1/chat/completions",
    };
  };

  const defaultByStage = (stage: Stage): { provider: Provider; model: string } => {
    if (stage === "specialist") {
      return hasGemini ? { provider: "gemini", model: "gemini-2.5-pro" } : { provider: "openai", model: "gpt-4o" };
    }
    return hasGemini ? { provider: "gemini", model: "gemini-2.5-flash" } : { provider: "openai", model: "gpt-4o-mini" };
  };

  const defaultModelFor = (provider: Provider, stage: Stage): string => {
    if (provider === "gemini") return stage === "specialist" ? "gemini-2.5-pro" : "gemini-2.5-flash";
    return stage === "specialist" ? "gpt-4o" : "gpt-4o-mini";
  };

  const cfgStage = params.stage === "specialist" ? params.config?.specialist : params.config?.auditor;

  // If preferredProvider is specified and differs from configured provider,
  // never reuse the configured model (it may be provider-specific).
  const chosen = preferred
    ? {
        provider: preferred,
        model:
          cfgStage && cfgStage.provider === preferred
            ? cfgStage.model
            : defaultModelFor(preferred, params.stage),
      }
    : cfgStage
      ? cfgStage
      : defaultByStage(params.stage);

  // Fallback if chosen provider has no key configured.
  const providerAvailable =
    (chosen.provider === "gemini" && hasGemini) || (chosen.provider === "openai" && hasOpenAI);
  const fallbackProvider: Provider | null =
    chosen.provider === "gemini" ? (hasOpenAI ? "openai" : null) : hasGemini ? "gemini" : null;

  const finalProvider = providerAvailable ? chosen.provider : fallbackProvider;
  if (!finalProvider) {
    throw new Error("No AI API key configured. Set GEMINI_API_KEY and/or OPENAI_API_KEY.");
  }

  const base = pick(finalProvider);
  // If we switched provider, pick a sane default model for that provider unless cfg explicitly matches provider.
  const model =
    finalProvider === chosen.provider
      ? chosen.model
      : defaultByStage(params.stage).model;

  return { ...base, model };
}

export function coerceMessageContentToString(content: any): string | null {
  if (!content) return null;
  if (typeof content === "string") return content;

  // OpenAI-style "content" can also be an array of parts (Gemini OpenAI-compat can do this)
  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        if (typeof p?.text === "string") return p.text;
        if (p?.type === "text" && typeof p?.text === "string") return p.text;
        return JSON.stringify(p);
      })
      .filter(Boolean);
    const joined = parts.join("\n").trim();
    return joined || null;
  }

  // Single part object
  if (typeof content?.text === "string") return content.text;
  return null;
}

export function extractRawFromAiResponse(data: any): string | null {
  // OpenAI-compatible response
  const msgContent = data?.choices?.[0]?.message?.content;
  const fromChoices = coerceMessageContentToString(msgContent);
  if (fromChoices) return fromChoices;

  const fromChoiceText = coerceMessageContentToString(data?.choices?.[0]?.text);
  if (fromChoiceText) return fromChoiceText;

  // Gemini native-ish response (defensive)
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (joined) return joined;
  }

  return null;
}

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export function extractUsageFromAiResponse(data: any): AiUsage | null {
  const u = data?.usage;
  if (!u || typeof u !== "object") return null;
  const inputTokens =
    typeof u.prompt_tokens === "number"
      ? u.prompt_tokens
      : typeof u.input_tokens === "number"
        ? u.input_tokens
        : undefined;
  const outputTokens =
    typeof u.completion_tokens === "number"
      ? u.completion_tokens
      : typeof u.output_tokens === "number"
        ? u.output_tokens
        : undefined;
  const totalTokens = typeof u.total_tokens === "number" ? u.total_tokens : undefined;
  if (inputTokens == null && outputTokens == null && totalTokens == null) return null;
  return { inputTokens, outputTokens, totalTokens };
}

let cachedPricingTable: Record<string, { input: number; output: number }> | null | "invalid" = null;

export function estimateCostUsdFromEnv(params: {
  provider: string;
  model: string;
  usage: AiUsage | null;
}): number | null {
  const usage = params.usage;
  if (!usage) return null;

  const input = typeof usage.inputTokens === "number" ? usage.inputTokens : 0;
  const output = typeof usage.outputTokens === "number" ? usage.outputTokens : 0;
  if (input <= 0 && output <= 0) return null;

  if (cachedPricingTable === null) {
    const raw = String(process.env.AI_PRICING_USD_PER_1M_JSON || "").trim();
    if (!raw) {
      cachedPricingTable = "invalid";
    } else {
      try {
        const parsed = JSON.parse(raw);
        cachedPricingTable = parsed && typeof parsed === "object" ? (parsed as any) : "invalid";
      } catch {
        cachedPricingTable = "invalid";
      }
    }
  }
  if (cachedPricingTable === "invalid" || !cachedPricingTable) return null;

  const key = `${params.provider}:${params.model}`;
  const rate = cachedPricingTable[key];
  if (!rate || typeof rate.input !== "number" || typeof rate.output !== "number") return null;

  const cost = (input / 1_000_000) * rate.input + (output / 1_000_000) * rate.output;
  // Keep a stable, small decimal representation
  return Math.round(cost * 1e6) / 1e6;
}

export async function callAiJson(ctx: ActionCtx, params: {
  stage: Stage;
  preferredProvider?: Provider;
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ provider: string; model: string; raw: string; usage: AiUsage | null; estimatedCostUsd: number | null }> {
  const configDoc = await ctx.runQuery(api.contentStudio.getModelConfig, {});
  const config = configDoc
    ? {
        specialist: configDoc.specialist,
        auditor: configDoc.auditor,
      }
    : null;
  const { provider, apiKey, apiUrl, model } = resolveProviderAndModel({
    preferredProvider: params.preferredProvider,
    stage: params.stage,
    config,
  });

  const controller = new AbortController();
  const timeoutMs = typeof params.timeoutMs === "number" && params.timeoutMs > 0 ? params.timeoutMs : 90_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: params.maxTokens ?? 2500,
    }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === "AbortError") throw new Error(`AI API timeout (request aborted after ${timeoutMs}ms)`);
    throw e;
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI API error: ${res.status} ${res.statusText} – ${errorText}`);
  }

  const data = (await res.json()) as any;
  if (data?.error?.message) {
    throw new Error(`AI API error payload: ${String(data.error.message)}`);
  }
  const raw = extractRawFromAiResponse(data);
  const usage = extractUsageFromAiResponse(data);
  const estimatedCostUsd = estimateCostUsdFromEnv({ provider, model, usage });
  if (!raw) {
    const preview = JSON.stringify(data ?? {}).slice(0, 1200);
    throw new Error(`AI returned no content. Response preview: ${preview}`);
  }
  return { provider, model, raw, usage, estimatedCostUsd };
}

export async function callAiText(ctx: ActionCtx, params: {
  stage: Stage;
  preferredProvider?: Provider;
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ provider: string; model: string; raw: string; usage: AiUsage | null; estimatedCostUsd: number | null }> {
  const configDoc = await ctx.runQuery(api.contentStudio.getModelConfig, {});
  const config = configDoc
    ? {
        specialist: configDoc.specialist,
        auditor: configDoc.auditor,
      }
    : null;
  const { provider, apiKey, apiUrl, model } = resolveProviderAndModel({
    preferredProvider: params.preferredProvider,
    stage: params.stage,
    config,
  });

  const controller = new AbortController();
  const timeoutMs = typeof params.timeoutMs === "number" && params.timeoutMs > 0 ? params.timeoutMs : 90_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      temperature: 0.2,
      max_tokens: params.maxTokens ?? 3500,
    }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === "AbortError") throw new Error(`AI API timeout (request aborted after ${timeoutMs}ms)`);
    throw e;
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI API error: ${res.status} ${res.statusText} – ${errorText}`);
  }

  const data = (await res.json()) as any;
  if (data?.error?.message) {
    throw new Error(`AI API error payload: ${String(data.error.message)}`);
  }
  const raw = extractRawFromAiResponse(data);
  const usage = extractUsageFromAiResponse(data);
  const estimatedCostUsd = estimateCostUsdFromEnv({ provider, model, usage });
  if (!raw) {
    const preview = JSON.stringify(data ?? {}).slice(0, 1200);
    throw new Error(`AI returned no content. Response preview: ${preview}`);
  }
  return { provider, model, raw, usage, estimatedCostUsd };
}

export function extractFirstJsonObject(input: string): string | null {
  const s = String(input ?? "");
  const start = s.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];

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

    if (depth === 0) {
      return s.slice(start, i + 1);
    }
  }

  return null;
}

export function parseJsonOrThrow(raw: string): any {
  const text = String(raw ?? "");
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const extracted = extractFirstJsonObject(cleaned) ?? extractFirstJsonObject(text);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch (e2: any) {
        const preview2 = extracted.slice(0, 240);
        throw new Error(`Invalid JSON from AI: ${e2?.message || String(e2)}. Preview: ${preview2}`);
      }
    }

    const preview = cleaned.slice(0, 300);
    throw new Error(`Invalid JSON from AI: could not parse. Preview: ${preview}`);
  }
}

export function extractUnitPackageFromAi(parsed: any): any {
  // Preferred shape: { unitPackage: {...} }
  if (parsed && typeof parsed === "object" && (parsed as any).unitPackage) return (parsed as any).unitPackage;
  // Tolerate direct unitPackage.v1 object without wrapper (some models ignore wrapper instruction)
  if (parsed && typeof parsed === "object" && (parsed as any).schemaVersion === "unitPackage.v1") return parsed;
  return null;
}

export function isPublishedStatus(s: unknown): boolean {
  return s === undefined || s === "published";
}

export function isPreviewStatus(s: unknown): boolean {
  return s === "preview";
}

export function truncateForAudit(s: unknown, maxChars: number): string {
  const str = typeof s === "string" ? s : String(s ?? "");
  if (str.length <= maxChars) return str;
  // IMPORTANT: Do not use "…" because the auditor treats that as real truncation in the source content.
  // This marker means "we truncated for audit payload size", not "the content itself is incomplete".
  return `${str.slice(0, maxChars)}\n\n[TRUNCATED_FOR_AUDIT]`;
}

export function looksGerman(text: string): boolean {
  const s = String(text || "");
  if (!s.trim()) return false;
  if (/[äöüßÄÖÜ]/.test(s)) return true;
  const hits = (s.toLowerCase().match(/\b(und|oder|wenn|nicht|aber|dann|weil|zum|zur|der|die|das|du|ihr|euch)\b/g) || [])
    .length;
  return hits >= 2;
}

export function looksGermanMarkdown(md: string): boolean {
  const s = String(md || "");
  if (!s.trim()) return false;
  if (/[äöüßÄÖÜ]/.test(s)) return true;
  // Higher threshold to avoid translating because of a single German word in a heading.
  const hits = (
    s
      .toLowerCase()
      .match(
        /\b(und|oder|wenn|nicht|aber|dann|weil|zum|zur|der|die|das|ich|wir|ihr|euch|bitte|danke|auch|noch|schon|einfach|dass|für|mit|ohne)\b/g
      ) || []
  ).length;
  return hits >= 8;
}

export async function translateShortToEnglishIfNeeded(
  ctx: ActionCtx,
  text: string,
  preferredProvider?: Provider
): Promise<string> {
  const input = String(text || "").trim();
  if (!input) return "";
  if (!looksGerman(input)) return input;

  const system = [
    `You are a translation engine.`,
    `Translate the user's text into natural, learner-friendly English.`,
    `Return ONLY the translated English text (no quotes, no markdown, no commentary).`,
    `Keep it concise; preserve the original tone.`,
  ].join("\n");

  const tryOnce = async (p?: Provider): Promise<string | null> => {
    try {
      const { raw } = await callAiText(ctx, {
        stage: "specialist",
        preferredProvider: p,
        system,
        user: input,
        maxTokens: 800,
      });
      const out = String(raw || "").trim();
      if (!out) return null;
      if (looksGerman(out)) return null;
      return out;
    } catch {
      return null;
    }
  };

  const primary = await tryOnce(preferredProvider);
  if (primary) return primary;

  // Fallback: try the other provider if configured (avoid hard-failing founder note insertion).
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const other: Provider | null =
    preferredProvider === "gemini"
      ? (hasOpenAI ? "openai" : null)
      : preferredProvider === "openai"
        ? (hasGemini ? "gemini" : null)
        : hasGemini
          ? "gemini"
          : hasOpenAI
            ? "openai"
            : null;
  const fallback = other ? await tryOnce(other) : null;
  if (fallback) return fallback;

  // Final fallback: return the original text (better UX than breaking the pipeline).
  return input;
}

export function upsertFounderNoteBlock(md: string, name: string, quote: string): string {
  const safeName = String(name || "").trim().replace(/^"+|"+$/g, "");
  const safeQuote = String(quote || "").trim();

  const stripFounderNotesFromOverview = (input: string): string => {
    const text = String(input || "").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const out: string[] = [];

    let inOverview = false;
    let skipping = false;

    const isOverviewHeader = (line: string) => /^##\s+1\.\s+Overview\b/i.test(line);
    const isNextMajorSection = (line: string) => /^##\s+\d+\.\s+\S/i.test(line);
    const isLearningObjectives = (line: string) => /^#{3,4}\s+Learning Objectives\b/i.test(line);
    const isFounderNoteStart = (line: string) =>
      /^(?:\s*>\s*){0,3}\s*#{0,4}\s*(?:\*{0,2}\s*)?A Note from the (?:Founder|Unit Author)\b/i.test(line);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";

      if (isOverviewHeader(line)) {
        inOverview = true;
        skipping = false;
        out.push(line);
        continue;
      }

      if (inOverview && isNextMajorSection(line) && !/^##\s+1\.\s+Overview\b/i.test(line)) {
        // Leaving Overview (e.g., "## 2. Vocabulary")
        inOverview = false;
        skipping = false;
        out.push(line);
        continue;
      }

      if (inOverview) {
        if (!skipping && isFounderNoteStart(line)) {
          skipping = true;
          continue;
        }

        if (skipping) {
          if (isLearningObjectives(line) || isNextMajorSection(line)) {
            skipping = false;
            out.push(line);
          }
          continue;
        }
      }

      out.push(line);
    }

    return out.join("\n");
  };

  // Remove ANY existing Founder/Author note block in Overview (deterministic),
  // even if the creator generated a non-standard format.
  let next = stripFounderNotesFromOverview(String(md || ""));

  if (!safeName || !safeQuote) return next;

  const block = [
    `#### A Note from the Founder (${safeName})`,
    `> "${safeQuote.replace(/"/g, '\\"')}"`,
    ``,
  ].join("\n");

  const overviewHeader = next.match(/^##\s+1\.\s+Overview\b.*$/m);
  if (overviewHeader?.index != null) {
    const insertAt = overviewHeader.index + overviewHeader[0].length;
    const after = next.slice(insertAt);
    const normalizedAfter = after.replace(/^\n+/, "\n\n");
    return `${next.slice(0, insertAt)}\n\n${block}${normalizedAfter}`;
  }

  return `${block}\n${next}`.trimStart();
}

export async function ensureFounderNoteInMarkdownIfConfigured(
  ctx: ActionCtx,
  draft: any,
  markdown: string,
  preferredProvider?: Provider
): Promise<string> {
  const name = String(draft?.authorNoteName || "").trim();
  const quoteRaw = String(draft?.authorNoteQuote || "").trim();
  if (!name || !quoteRaw) return markdown;

  const quoteEn = await translateShortToEnglishIfNeeded(ctx, quoteRaw, preferredProvider);
  const next = upsertFounderNoteBlock(markdown, name, quoteEn);
  const structure = validateMarkdownStructure(next);
  if (!structure.valid) {
    throw new Error(`Founder note injection produced invalid Markdown structure: ${structure.errors.join("; ")}`);
  }
  return next;
}

export function hasDialogueRoleTable(block: string): boolean {
  return /\|\s*Role\s*\|\s*Serbian\s*\|\s*English\s*\|/i.test(String(block || ""));
}

export function escapeTableCell(text: string): string {
  return String(text || "")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

export function convertRoleQuoteDialogueToTable(block: string): string {
  const normalized = String(block || "").replace(/\r\n/g, "\n");
  if (!normalized.trim()) return normalized;
  if (hasDialogueRoleTable(normalized)) return normalized;

  const lines = normalized.split("\n");
  const preamble: string[] = [];
  const rows: Array<{ role: string; sr: string; en: string }> = [];

  let i = 0;
  // Keep any preamble until first "Role: ..." line.
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^([^:\n]{1,80}):\s+(.+)\s*$/);
    if (m) break;
    preamble.push(lines[i]);
  }

  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = line.match(/^([^:\n]{1,80}):\s+(.+)\s*$/);
    if (!m) continue;
    const role = m[1].trim();
    const sr = m[2].trim();

    // Collect following blockquote lines as English translation.
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    const enLines: string[] = [];
    while (j < lines.length && lines[j].trim().startsWith(">")) {
      enLines.push(lines[j].replace(/^>\s?/, "").trim());
      j++;
    }
    const en = enLines.join(" ").trim();
    rows.push({ role, sr, en });
    i = j - 1;
  }

  if (rows.length === 0) return normalized;

  const out: string[] = [];
  out.push(...preamble);
  if (out.length && out[out.length - 1].trim() !== "") out.push("");
  out.push("| Role | Serbian | English |");
  out.push("| :--- | :--- | :--- |");
  for (const r of rows) {
    out.push(`| ${escapeTableCell(r.role)} | ${escapeTableCell(r.sr)} | ${escapeTableCell(r.en)} |`);
  }
  return out.join("\n").trim();
}

export function canonicalizeDialoguesToUnit1Tables(markdown: string): string {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  if (!normalized.trim()) return normalized;

  // 1) Dedicated Dialogues section
  if (/^##\s+5\.\s+Dialogues\b/m.test(normalized)) {
    return normalized.replace(
      /^##\s+5\.\s+Dialogues[^\n]*\n([\s\S]+?)(?=^##\s+|$)/m,
      (_full, body) => {
        const converted = convertRoleQuoteDialogueToTable(String(body || "").trim());
        return `## 5. Dialogues\n\n${converted}\n`;
      }
    );
  }

  // 2) Dialogue blocks inside Phrases section (Unit 1/2 common pattern)
  const phrasesMatch = normalized.match(/##\s+4\.\s+Phrases[\s\S]+?(?=##\s+\d+\.|$)/);
  if (!phrasesMatch?.[0]) return normalized;

  const phrasesSection = phrasesMatch[0];
  const convertedPhrases = phrasesSection.replace(/###\s+.*Dialogue[\s\S]+?(?=###\s+|$)/g, (block) => {
    return convertRoleQuoteDialogueToTable(block);
  });

  return normalized.replace(phrasesSection, convertedPhrases);
}

export function collectMarkdownLanguageIssuesForFounderNote(pkg: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const overview = String(pkg?.content?.en?.overviewMd || "");
  if (!overview.trim()) return issues;

  // Detect the founder note heading and extract the following blockquote.
  const m = overview.match(/####\s+A Note from the Founder[^\n]*\n([\s\S]*?)(?:\n{2,}|$)/m);
  if (!m) return issues;
  const block = String(m[1] || "");
  const quoteLines = block
    .split("\n")
    .filter((l) => l.trim().startsWith(">"))
    .map((l) => l.replace(/^>\s?/, "").trim())
    .join(" ")
    .trim();
  if (!quoteLines) return issues;

  if (looksGerman(quoteLines)) {
    issues.push({
      level: "error",
      path: ["content", "en", "overviewMd"],
      message:
        `Founder note must be English (Base Language: English). The current founder quote looks non-English (likely German).`,
    });
  }
  return issues;
}

export function collectIncompleteHeadingIssues(pkg: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const mdFields: Array<{ key: string; value: string }> = [
    { key: "overviewMd", value: String(pkg?.content?.en?.overviewMd || "") },
    { key: "grammarMd", value: String(pkg?.content?.en?.grammarMd || "") },
    { key: "phrasesMd", value: String(pkg?.content?.en?.phrasesMd || "") },
    { key: "dialoguesMd", value: String(pkg?.content?.en?.dialoguesMd || "") },
    { key: "testIntroductionMd", value: String(pkg?.content?.en?.testIntroductionMd || "") },
  ];

  for (const f of mdFields) {
    const s = f.value;
    if (!s) continue;
    // Common broken header pattern seen in the wild: "#### #" (hash-only title).
    if (/^#{3,6}\s*#\s*$/m.test(s)) {
      issues.push({
        level: "error",
        path: ["content", "en", f.key],
        message: `Markdown contains an incomplete heading like '#### #' in ${f.key}. Fix or remove it.`,
      });
    }
  }
  return issues;
}

export async function translateUnitMarkdownToEnglishIfNeeded(
  ctx: ActionCtx,
  markdown: string,
  preferredProvider?: Provider
): Promise<string> {
  const input = String(markdown || "").replace(/\r\n/g, "\n").trim();
  if (!looksGermanMarkdown(input)) return input;

  const systemBase = [
    `You are translating ONE Serbian course unit Markdown into English.`,
    `Goal: Ensure ALL explanatory text is English (Base Language: English).`,
    ``,
    `CRITICAL: Preserve Markdown structure EXACTLY (do not reformat):`,
    `- Do NOT reorder headings/sections.`,
    `- Do NOT change tables: keep exact columns, pipes, separators, and one-row-per-line formatting.`,
    `- Do NOT wrap table rows across lines.`,
    `- Preserve blanks EXACTLY as '_____' (five underscores).`,
    `- Preserve lettered options formatting: A) ...  B) ...  C) ...  D) ...`,
    `- Preserve all IDs (e.g., questionId like u2_ex5_q01) exactly.`,
    ``,
    `CRITICAL: Do NOT translate Serbian content:`,
    `- In vocabulary tables: do NOT change the 'Serbian' column values.`,
    `- In exercises: do NOT change Serbian answers, correctAnswer, or any Serbian phrases.`,
    `- Only translate non-English explanatory text (instructions, descriptions, English translations, notes) into English.`,
    ``,
    `Output ONLY the final Markdown content (no commentary, no code fences).`,
  ].join("\n");

  const runOnce = async (attempt: 1 | 2) => {
    const extra =
      attempt === 2
        ? [
            ``,
            `IMPORTANT: Your previous output broke required Markdown structure.`,
            `You MUST keep ALL headings and section markers intact.`,
            `Translate ONLY the German/non-English explanatory text into English.`,
            `Do NOT add/remove any lines that would change the structure.`,
          ].join("\n")
        : "";
    const { raw } = await callAiText(ctx, {
      stage: "specialist",
      preferredProvider,
      system: systemBase + extra,
      user: input,
      maxTokens: 6000,
    });
    return String(raw || "").replace(/\r\n/g, "\n").trim();
  };

  let out = await runOnce(1);
  let structure = validateMarkdownStructure(out);
  if (!structure.valid) {
    out = await runOnce(2);
    structure = validateMarkdownStructure(out);
  }
  if (!structure.valid) {
    throw new Error(`Auto-translation produced invalid Markdown structure: ${structure.errors.join("; ")}`);
  }
  if (looksGermanMarkdown(out)) {
    throw new Error(`Auto-translation did not fully convert content to English (German still detected).`);
  }
  return out;
}

export async function buildStageSkillBlock(ctx: ActionCtx, draft: any, stage: SkillStage): Promise<string> {
  const ids: Array<Id<"contentStudioSkills">> =
    stage === "specialist" ? (draft.specialistSkillIds ?? []) : (draft.auditorSkillIds ?? []);
  if (!Array.isArray(ids) || ids.length === 0) return "";
  const skills = await ctx.runQuery(api.contentStudio.getSkillsByIds, { ids });
  if (!skills || skills.length === 0) return "";
  const lines: string[] = [];
  lines.push(`${stage.toUpperCase()} SKILLS (apply globally for this stage):`);
  for (const sk of skills as any[]) {
    lines.push(`- Skill: ${sk.name}`);
    lines.push(String(sk.prompt));
    lines.push("");
  }
  return lines.join("\n").trim();
}

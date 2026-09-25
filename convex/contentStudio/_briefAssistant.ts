/**
 * Brief Assistant: turns a free-text description of a unit (typed or dictated,
 * German or English) plus the curriculum plan into a structured creator brief.
 *
 * Flow (client: BriefAssistant.tsx):
 *   1. Round 1: userText (+ current form fields) -> fields + up to 5 questions.
 *   2. Round 2 (optional): answers to those questions -> completed fields.
 * The returned fields are rendered into the canonical brief text by the client
 * (shared/contentStudio/briefTemplate.ts), so nothing changes for the Creator.
 *
 * Grounding: for units that exist in curriculumUnits the plan (type, level,
 * strand, setting, grammar target, chunks, recycling, Can-Do statements) is
 * authoritative; the user's text adds situation detail, scenes, pitfalls and
 * personality. Without a plan (e.g. a language school's own course) the
 * assistant asks more questions.
 */
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireSuperadminAction, callAiJson, parseJsonOrThrow, resolvePromptFromDb, languageRulesBlock } from "./_shared";
import { CS_PROMPT_KEYS } from "./prompts";
import {
  BRIEF_FIELDS,
  BRIEF_FIELD_DEFAULTS,
  type BriefFieldId,
  type BriefFields,
} from "../../shared/contentStudio/briefTemplate";

const FIELD_IDS = new Set<string>(BRIEF_FIELDS.map((f) => f.id));

const questionValidator = v.object({
  id: v.string(),
  question: v.string(),
  kind: v.union(v.literal("text"), v.literal("choice")),
  options: v.optional(v.array(v.string())),
  /** Which brief field the answer feeds (for the UI hint). */
  fieldId: v.optional(v.string()),
});

function normalizeSelectValue(fieldId: BriefFieldId, raw: string): string {
  const def = BRIEF_FIELDS.find((f) => f.id === fieldId);
  if (!def?.options) return raw;
  const v0 = raw.trim();
  const hit = def.options.find(
    (o) => o.id.toLowerCase() === v0.toLowerCase() || o.label.toLowerCase() === v0.toLowerCase() || o.label.toLowerCase().startsWith(v0.toLowerCase() + " ")
  );
  return hit ? hit.id : (BRIEF_FIELD_DEFAULTS[fieldId] ?? v0);
}

function sanitizeFields(raw: unknown): BriefFields {
  const out: BriefFields = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!FIELD_IDS.has(k)) continue;
    const id = k as BriefFieldId;
    let text: string;
    if (Array.isArray(val)) text = val.map((x) => String(x ?? "").trim()).filter(Boolean).join("\n");
    else if (typeof val === "string") text = val.trim();
    else if (val == null) continue;
    else text = String(val);
    if (!text) continue;
    const def = BRIEF_FIELDS.find((f) => f.id === id);
    out[id] = def?.kind === "select" ? normalizeSelectValue(id, text) : text;
  }
  return out;
}

function sanitizeQuestions(raw: unknown): Array<{ id: string; question: string; kind: "text" | "choice"; options?: string[]; fieldId?: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ id: string; question: string; kind: "text" | "choice"; options?: string[]; fieldId?: string }> = [];
  for (const q of raw.slice(0, 5)) {
    const question = String((q as any)?.question ?? "").trim();
    if (!question) continue;
    const options = Array.isArray((q as any)?.options)
      ? (q as any).options.map((o: unknown) => String(o ?? "").trim()).filter(Boolean).slice(0, 6)
      : undefined;
    const kind: "text" | "choice" = options && options.length >= 2 ? "choice" : "text";
    const fieldIdRaw = String((q as any)?.fieldId ?? "").trim();
    out.push({
      id: String((q as any)?.id ?? `q${out.length + 1}`).trim() || `q${out.length + 1}`,
      question,
      kind,
      options: kind === "choice" ? options : undefined,
      fieldId: FIELD_IDS.has(fieldIdRaw) ? fieldIdRaw : undefined,
    });
  }
  return out;
}

// @ts-ignore TS2589 – Convex schema depth limit (50+ tables)
export const runBriefAssistant = action({
  args: {
    unitNumber: v.number(),
    moduleNumber: v.number(),
    /** Free-text description from the author (may be empty when a plan exists). */
    userText: v.string(),
    /** Fields already in the form (round 2, or manual edits to keep). */
    currentFields: v.optional(v.record(v.string(), v.string())),
    /** Answers to the previous round's questions. */
    answers: v.optional(v.array(v.object({ questionId: v.string(), question: v.string(), answer: v.string() }))),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  returns: v.object({
    fields: v.record(v.string(), v.string()),
    questions: v.array(questionValidator),
    planFound: v.boolean(),
    summary: v.string(),
    /** Suggested unit title (English, from the plan or the author's text). */
    titleSuggestion: v.optional(v.string()),
    /** Suggested one-sentence unit description (English, max ~120 chars). */
    descriptionSuggestion: v.optional(v.string()),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    thinkingTokens: v.optional(v.number()),
  }),
  // @ts-ignore TS2589 – Convex schema depth limit (50+ tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    const context: any = await ctx.runQuery(api.curriculum.getUnitContext, {
      unitNumber: args.unitNumber,
      moduleNumber: args.moduleNumber,
    });
    const system =
      (await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.briefAssistant)) +
      (await languageRulesBlock(ctx));

    const fieldSpec = BRIEF_FIELDS.map((f) => ({
      id: f.id,
      label: f.label,
      kind: f.kind,
      required: !!f.required,
      options: f.options?.map((o) => o.id),
      help: f.help,
    }));

    // Decision 2026-09-16: the AI decides the grammar of the unit from the
    // CEFR level of the module and from what earlier units already taught.
    // The curriculum map is passed only as a non-binding hint. Topic, places
    // and scenes come from the author only; no content example is passed.
    const payload = {
      unit: { unitNumber: args.unitNumber, moduleNumber: args.moduleNumber },
      courseContext: {
        cefrLevel: context.cefrLevel,
        levelSource: context.levelSource,
        moduleTitleEn: context.moduleTitleEn ?? null,
        previouslyTaught: context.previouslyTaught,
        plannedHint: context.plannedHint,
        nextPlannedHints: context.nextPlannedHints,
      },
      briefFieldSpec: fieldSpec,
      currentFields: args.currentFields ?? {},
      authorText: args.userText,
      answers: args.answers ?? [],
    };

    const { provider, model, raw, usage } = await callAiJson(ctx, {
      stage: "auditor",
      preferredProvider: args.preferredProvider,
      system,
      user: JSON.stringify(payload),
      maxTokens: 3000,
      reasoningEffort: "low",
      timeoutMs: 120_000,
    });

    const parsed = parseJsonOrThrow(raw);
    const fields = sanitizeFields(parsed?.fields);
    // Always keep the header selects filled so the form never shows empty required selects.
    for (const key of ["unitType", "cefrLevel", "strand", "setting"] as BriefFieldId[]) {
      if (!fields[key]) {
        const fromCurrent = args.currentFields?.[key];
        const fromContext = key === "cefrLevel" ? context.cefrLevel : key === "unitType" ? context.plannedHint?.unitType : undefined;
        const fallback = fromCurrent || fromContext || BRIEF_FIELD_DEFAULTS[key];
        if (fallback) fields[key] = normalizeSelectValue(key, String(fallback));
      }
    }
    const questions = sanitizeQuestions(parsed?.questions);
    const summary = String(parsed?.summary ?? "").trim();
    // Title comes from the model (derived from the author's own description).
    // The plan title is deliberately NOT used as a fallback: content is the
    // author's decision, the curriculum only fixes the language scaffold.
    const titleSuggestion = String(parsed?.titleSuggestion ?? "").trim().slice(0, 120) || undefined;
    const descriptionSuggestion = String(parsed?.descriptionSuggestion ?? "").trim().slice(0, 160) || undefined;

    return {
      fields: fields as Record<string, string>,
      questions,
      planFound: !!context.plannedHint,
      summary,
      titleSuggestion,
      descriptionSuggestion,
      provider,
      model,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      thinkingTokens: usage?.thinkingTokens,
    };
  },
});

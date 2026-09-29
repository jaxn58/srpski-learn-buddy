/**
 * Brief Assistant: turns the author's assignment fields into the remaining
 * creator-brief fields (chunks, recycling, pitfalls, scenes, listening,
 * culture, exercise focus).
 *
 * The author fills unit type, strand, setting, situation, what the learner
 * can do, and the one grammar target. The module's CEFR level is fixed.
 * Those values are written back over the model output. The course map is
 * not an input. previouslyTaught is the grammar of earlier units, so the
 * assistant can name recycling and what stays out of scope.
 *
 * Flow (client: BriefAssistant.tsx):
 *   1. Round 1: current assignment fields -> remaining fields + up to 5 questions.
 *   2. Round 2 (optional): answers to those questions -> completed remaining fields.
 * The client renders the canonical brief text (shared/contentStudio/briefTemplate.ts).
 */
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireSuperadminAction, callAiJson, parseJsonOrThrow, resolvePromptFromDb, languageRulesBlock } from "./_shared";
import { CS_PROMPT_KEYS } from "./prompts";
import {
  BRIEF_ASSIGNMENT_FIELD_IDS,
  BRIEF_FIELDS,
  BRIEF_FIELD_DEFAULTS,
  type BriefFieldId,
  type BriefFields,
} from "../../shared/contentStudio/briefTemplate";

const ASSIGNMENT_FIELD_IDS = new Set<string>(BRIEF_ASSIGNMENT_FIELD_IDS);

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

/** Appended after the stored prompt so a stale prompt cannot replace the author's fields. */
function assignmentLockBlock(): string {
  return [
    "",
    "=== ASSIGNMENT FIELDS (binding, overrides anything above) ===",
    "There is no course map in this request. Do not invent or replace the author's assignment.",
    "courseContext.cefrLevel is the module level. fields.cefrLevel MUST equal it.",
    "currentFields already contain the author's unitType, strand, setting, situation, canDo and grammarIn. Copy those values unchanged into fields.",
    "Write only the remaining fields: grammarOut, chunks, recycle, pitfalls, scenes, listening, cultural, exerciseFocus, plus titleSuggestion and descriptionSuggestion derived from the author's situation and grammarIn.",
    "previouslyTaught is grammar earlier units already introduced. Recycle it. Do not make it this unit's grammarIn.",
    "Do not ask questions about unitType, cefrLevel, strand, setting, situation, canDo or grammarIn.",
  ].join("\n");
}

// @ts-ignore TS2589 – Convex schema depth limit (50+ tables)
export const runBriefAssistant = action({
  args: {
    unitNumber: v.number(),
    moduleNumber: v.number(),
    /** Unused for the assignment. Kept so existing clients still send a string. */
    userText: v.string(),
    /** Assignment fields already in the form. These are written back over the model output. */
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
      (await languageRulesBlock(ctx)) +
      assignmentLockBlock();

    const fieldSpec = BRIEF_FIELDS.map((f) => ({
      id: f.id,
      label: f.label,
      kind: f.kind,
      required: !!f.required,
      options: f.options?.map((o) => o.id),
      help: f.help,
    }));

    const payload = {
      unit: { unitNumber: args.unitNumber, moduleNumber: args.moduleNumber },
      courseContext: {
        cefrLevel: context.cefrLevel,
        levelSource: context.levelSource,
        moduleTitleEn: context.moduleTitleEn ?? null,
        previouslyTaught: context.previouslyTaught,
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
    // The module level and the author's assignment fields win over the model.
    fields.cefrLevel = normalizeSelectValue("cefrLevel", String(context.cefrLevel));
    for (const key of BRIEF_ASSIGNMENT_FIELD_IDS) {
      const fromCurrent = args.currentFields?.[key];
      if (!fromCurrent?.trim()) continue;
      const def = BRIEF_FIELDS.find((f) => f.id === key);
      fields[key] = def?.kind === "select" ? normalizeSelectValue(key, fromCurrent) : fromCurrent.trim();
    }
    const questions = sanitizeQuestions(parsed?.questions).filter(
      (q) => !q.fieldId || !ASSIGNMENT_FIELD_IDS.has(q.fieldId),
    );
    const summary = String(parsed?.summary ?? "").trim();
    // Title comes from the model, derived from the author's situation.
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

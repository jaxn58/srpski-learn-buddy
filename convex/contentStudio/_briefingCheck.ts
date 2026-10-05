import { v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import {
  hashBriefingText,
  type BriefingContradiction,
  type BriefingCheckStamp,
} from "../../shared/contentStudio/briefingCheck";
import {
  BRIEFING_CONSISTENCY_PROMPT,
  BRIEFING_CORRECTION_PROMPT,
} from "../../shared/contentStudio/briefingConsistencyPrompt";
import {
  callAiJson,
  languageRulesBlock,
  parseJsonOrThrow,
  requireSuperadminAction,
  resolvePromptFromDb,
} from "./_shared";
import { CS_PROMPT_KEYS } from "./prompts";

export const briefingContradictionValidator = v.object({
  quoteA: v.string(),
  quoteB: v.string(),
  reason: v.string(),
});

export const briefingCheckValidator = v.object({
  notesHash: v.string(),
  ok: v.boolean(),
  contradictions: v.array(briefingContradictionValidator),
  checkedAt: v.number(),
  model: v.string(),
});

const MAX_CONTRADICTIONS = 8;
const MAX_QUOTE = 500;

function formatPreviouslyTaught(rows: Array<{ unitNumber: number; grammar: string }>): string {
  if (rows.length === 0) {
    return [
      "PREVIOUSLY TAUGHT:",
      "(none)",
      "Do not name an earlier unit. A form in the grammar target that is not listed above is taught in this unit.",
    ].join("\n");
  }
  return ["PREVIOUSLY TAUGHT:", ...rows.map((row) => `- Unit ${row.unitNumber}: ${row.grammar}`)].join("\n");
}

async function previouslyTaughtBlock(
  // ActionCtx.runQuery hits the Convex type-depth limit on this file.
  ctx: { runQuery: (...args: never[]) => Promise<unknown> },
  unitNumber: number | undefined,
  moduleNumber: number | undefined,
): Promise<string> {
  if (!unitNumber || !moduleNumber || unitNumber < 1 || moduleNumber < 1) {
    return formatPreviouslyTaught([]);
  }
  const context = await ctx.runQuery(api.curriculum.getUnitContext as never, { unitNumber, moduleNumber } as never) as {
    previouslyTaught?: Array<{ unitNumber: number; grammar: string }>;
  };
  return formatPreviouslyTaught(context.previouslyTaught ?? []);
}

function readContradictions(parsed: unknown): BriefingContradiction[] {
  const list = (parsed as { contradictions?: unknown })?.contradictions;
  if (!Array.isArray(list)) return [];
  const out: BriefingContradiction[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const quoteA = String(row.quoteA ?? "").trim().slice(0, MAX_QUOTE);
    const quoteB = String(row.quoteB ?? "").trim().slice(0, MAX_QUOTE);
    const reason = String(row.reason ?? "").trim().slice(0, MAX_QUOTE);
    if (!quoteA || !quoteB || !reason) continue;
    out.push({ quoteA, quoteB, reason });
    if (out.length >= MAX_CONTRADICTIONS) break;
  }
  return out;
}

/**
 * Copies the consistency prompt into chatPrompts when that row is missing.
 * The check action never reads this module's string itself.
 */
export const installBriefingConsistencyPrompt = internalMutation({
  args: {},
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx) => {
    const prompts = [
      {
        name: CS_PROMPT_KEYS.briefingConsistency,
        content: BRIEFING_CONSISTENCY_PROMPT,
        description: "Briefing consistency check. Quotes contradictions. Does not rewrite the briefing.",
      },
      {
        name: CS_PROMPT_KEYS.briefingCorrection,
        content: BRIEFING_CORRECTION_PROMPT,
        description: "Writes corrected field text after the briefing consistency check.",
      },
    ];
    let created = false;
    for (const prompt of prompts) {
      const existing = await ctx.db
        .query("chatPrompts")
        .withIndex("by_name", (q) => q.eq("name", prompt.name))
        .first();
      if (existing?.content) continue;
      const payload = { ...prompt, updatedAt: Date.now() };
      await ctx.db.insert("chatPromptHistory", payload);
      if (existing) await ctx.db.patch(existing._id, payload);
      else await ctx.db.insert("chatPrompts", payload);
      created = true;
    }
    return { created };
  },
});

// @ts-ignore TS2589 – Convex schema depth limit
export const runBriefingConsistencyCheck = action({
  args: {
    briefingText: v.string(),
    draftId: v.optional(v.id("contentDrafts")),
    unitNumber: v.optional(v.number()),
    moduleNumber: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    notesHash: v.string(),
    contradictions: v.array(briefingContradictionValidator),
    checkedAt: v.number(),
    model: v.string(),
    provider: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    const briefingText = String(args.briefingText ?? "").replace(/\r\n/g, "\n").trim();
    const notesHash = hashBriefingText(briefingText);
    const checkedAt = Date.now();

    if (!briefingText) {
      const contradictions: BriefingContradiction[] = [{
        quoteA: "(empty briefing)",
        quoteB: "(empty briefing)",
        reason: "The briefing has no text to check.",
      }];
      if (args.draftId) {
        await ctx.runMutation(internal.contentStudio.saveBriefingCheck, {
          draftId: args.draftId,
          notes: briefingText,
          briefingCheck: { notesHash, ok: false, contradictions, checkedAt, model: "" },
        });
      }
      return { ok: false, notesHash, contradictions, checkedAt, model: "", provider: "" };
    }

    const basePrompt = await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.briefingConsistency);
    const system = `${basePrompt}\n${await languageRulesBlock(ctx)}`;
    const history = await previouslyTaughtBlock(ctx, args.unitNumber, args.moduleNumber);

    const { provider, model, raw } = await callAiJson(ctx, {
      stage: "specialist",
      system,
      user: [history, "", "BRIEFING:", briefingText].join("\n"),
      maxTokens: 2000,
      timeoutMs: 120_000,
    });

    let contradictions: BriefingContradiction[];
    try {
      contradictions = readContradictions(parseJsonOrThrow(raw));
    } catch {
      contradictions = [{
        quoteA: "(check output)",
        quoteB: "(check output)",
        reason: "The consistency check did not return a readable result. Run it again.",
      }];
    }

    const ok = contradictions.length === 0;
    const stamp: BriefingCheckStamp = { notesHash, ok, contradictions, checkedAt, model };
    if (args.draftId && ok) {
      await ctx.runMutation(internal.contentStudio.saveBriefingCheck, {
        draftId: args.draftId,
        notes: briefingText,
        briefingCheck: stamp,
      });
    }
    return { ok, notesHash, contradictions, checkedAt, model, provider };
  },
});

const fieldPatchValidator = v.record(v.string(), v.string());

// @ts-ignore TS2589 – Convex schema depth limit
export const runBriefingFieldCorrection = action({
  args: {
    briefingText: v.string(),
    contradictions: v.array(briefingContradictionValidator),
    unitNumber: v.optional(v.number()),
    moduleNumber: v.optional(v.number()),
  },
  returns: v.object({
    fields: fieldPatchValidator,
  }),
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    const briefingText = String(args.briefingText ?? "").replace(/\r\n/g, "\n").trim();
    if (!briefingText || args.contradictions.length === 0) return { fields: {} };

    const basePrompt = await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.briefingCorrection);
    const system = `${basePrompt}\n${await languageRulesBlock(ctx)}`;
    const history = await previouslyTaughtBlock(ctx, args.unitNumber, args.moduleNumber);
    const user = [
      history,
      "",
      "BRIEFING:",
      briefingText,
      "",
      "CONTRADICTIONS:",
      JSON.stringify(args.contradictions),
    ].join("\n");

    const { raw } = await callAiJson(ctx, {
      stage: "specialist",
      system,
      user,
      maxTokens: 2500,
      timeoutMs: 120_000,
    });

    let parsed: unknown;
    try {
      parsed = parseJsonOrThrow(raw);
    } catch {
      return { fields: {} };
    }
    const rawFields = (parsed as { fields?: unknown })?.fields;
    if (!rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) return { fields: {} };
    const fields: Record<string, string> = {};
    for (const [id, value] of Object.entries(rawFields as Record<string, unknown>)) {
      const text = String(value ?? "").trim();
      if (text) fields[id] = text;
    }
    return { fields };
  },
});

/**
 * EN/DE identical prompt cognates for the translator quality guard + verifier.
 *
 * Code defaults are conservative. Admins can add more via
 * contentStudioTranslatorCognates (UI + accept-on-fail dialog).
 */

import { v } from "convex/values";
import {
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { requireSuperadmin } from "./_shared";

/** Built-in cognates (lowercased). Keep conservative. */
export const CODE_DEFAULT_PROMPT_COGNATES: readonly string[] = [
  "august",
  "september",
  "november",
  "hotel",
  "restaurant",
  "taxi",
  "bus",
  "radio",
  "video",
  "internet",
  "baby",
  "mango",
  "paprika",
  "salon",
  "bar",
  "cafe",
  "café",
  "orange",
  "kiwi",
];

export function normalizeCognateTerm(term: string): string {
  return String(term || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function mergePromptCognates(
  codeDefaults: readonly string[],
  adminTerms: readonly string[]
): Set<string> {
  const out = new Set<string>();
  for (const t of codeDefaults) {
    const n = normalizeCognateTerm(t);
    if (n) out.add(n);
  }
  for (const t of adminTerms) {
    const n = normalizeCognateTerm(t);
    if (n) out.add(n);
  }
  return out;
}

/**
 * Extract learner-prompt words flagged by quality-guard / verifier texts.
 * Examples:
 *  - learner prompt is still English "orange".
 *  - German question prompt is still English ("_____ = orange").
 */
export function parseUntranslatedPromptGuardFailures(message: string): string[] {
  const out: string[] = [];
  const text = String(message || "");
  for (const m of text.matchAll(/learner prompt is still English "([^"]+)"/gi)) {
    const n = normalizeCognateTerm(
      String(m[1] ?? "")
        .replace(/_+/g, " ")
        .replace(/^\s*=\s*/g, "")
        .replace(/\s*=\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (n) out.push(n);
  }
  for (const m of text.matchAll(/still English\s*\(\s*"([^"]+)"\s*\)/gi)) {
    const n = normalizeCognateTerm(
      String(m[1] ?? "")
        .replace(/_+/g, " ")
        .replace(/^\s*=\s*/g, "")
        .replace(/\s*=\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (n) out.push(n);
  }
  return [...new Set(out)];
}

export const listAdminTranslatorCognates = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("contentStudioTranslatorCognates"),
      term: v.string(),
      note: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    const rows = await ctx.db.query("contentStudioTranslatorCognates").collect();
    rows.sort((a, b) => a.term.localeCompare(b.term));
    return rows.map((r) => ({
      _id: r._id,
      term: r.term,
      note: r.note,
      createdAt: r.createdAt,
    }));
  },
});

export const listAdminTranslatorCognateTermsInternal = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const rows = await ctx.db.query("contentStudioTranslatorCognates").collect();
    return rows.map((r) => r.term);
  },
});

/** Action helper: code defaults ∪ admin DB terms. */
export async function loadMergedPromptCognates(ctx: ActionCtx): Promise<Set<string>> {
  const adminTerms = await ctx.runQuery(
    internal.contentStudio.listAdminTranslatorCognateTermsInternal,
    {}
  );
  return mergePromptCognates(CODE_DEFAULT_PROMPT_COGNATES, adminTerms as string[]);
}

export const addTranslatorCognates = mutation({
  args: {
    terms: v.array(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.object({
    added: v.array(v.string()),
    alreadyPresent: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const now = Date.now();
    const note = typeof args.note === "string" && args.note.trim() ? args.note.trim() : undefined;
    const added: string[] = [];
    const alreadyPresent: string[] = [];

    for (const raw of args.terms) {
      const term = normalizeCognateTerm(raw);
      if (!term) continue;
      if (CODE_DEFAULT_PROMPT_COGNATES.includes(term)) {
        alreadyPresent.push(term);
        continue;
      }
      const existing = await ctx.db
        .query("contentStudioTranslatorCognates")
        .withIndex("by_term", (q) => q.eq("term", term))
        .first();
      if (existing) {
        alreadyPresent.push(term);
        continue;
      }
      await ctx.db.insert("contentStudioTranslatorCognates", {
        term,
        note,
        createdBy: user._id,
        createdAt: now,
      });
      added.push(term);
    }
    return { added, alreadyPresent };
  },
});

export const removeTranslatorCognate = mutation({
  args: { cognateId: v.id("contentStudioTranslatorCognates") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const row = await ctx.db.get(args.cognateId);
    if (!row) throw new Error("Cognate entry not found");
    await ctx.db.delete(args.cognateId);
    return { ok: true };
  },
});

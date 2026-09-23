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
import { callAiText, requireSuperadmin } from "./_shared";

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

function foldLexeme(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "dj")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Citation form plus a short Serbian ending (Sadu, parku, Novom). */
function sameLexeme(a: string, b: string): boolean {
  if (a === b) return a.length >= 2;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 3 || !long.startsWith(short)) return false;
  const extra = long.slice(short.length);
  return extra.length > 0 && extra.length <= 4 && /^[aeioumnj]+$/.test(extra);
}

/**
 * The parenthesis names the Serbian form the learner must produce
 * ("Sad" for "Sadu", "park" for "park"). It is not an English gloss.
 * A real English gloss does not share that stem ("milk" / "mleko").
 */
export function cueNamesSerbianForm(cue: string, serbianForm: string): boolean {
  const cueWords = foldLexeme(cue).split(" ").filter((w) => w.length >= 2);
  const formWords = foldLexeme(serbianForm).split(" ").filter((w) => w.length >= 2);
  if (cueWords.length === 0 || formWords.length === 0) return false;
  return cueWords.every((c) => formWords.some((f) => sameLexeme(c, f)));
}

/** Values after the verifier's Serbian-answer labels, without the English header. */
export function serbianFormsFromAnchor(serbianField: string): string {
  const bits: string[] = [];
  for (const line of String(serbianField || "").split("\n")) {
    if (!/Expected Serbian answer|Answer choices|Accepted Serbian variants/i.test(line)) continue;
    const value = line.match(/:\s*(.+)$/)?.[1]?.trim();
    if (value) bits.push(value);
  }
  return bits.join(" ");
}

/** Short EN=DE identity terms belong in the cognate dialog; sentences do not. */
export function isLikelyCognateCandidateTerm(term: string): boolean {
  const t = normalizeCognateTerm(term);
  if (!t) return false;
  if (/[.!?…]/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 3;
}

function extractCandidateTerm(raw: string): string {
  const n = normalizeCognateTerm(
    String(raw || "")
      .replace(/^[\s(]+/, "")
      .replace(/[\s)]+$/, "")
      .replace(/_+/g, " ")
      .replace(/^\s*=\s*/g, "")
      .replace(/\s*=\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
  return isLikelyCognateCandidateTerm(n) ? n : "";
}

/**
 * Extract EN=DE identity terms from quality-guard / verifier texts.
 * Examples:
 *  - learner prompt is still English "orange".
 *  - fill-in source cue is still English "(park)".
 *  - German question prompt is still English ("_____ = orange").
 */
export function parseUntranslatedPromptGuardFailures(message: string): string[] {
  const out: string[] = [];
  const text = String(message || "");
  const patterns = [
    /fill-in source cue is still English "\(([^)]+)\)"/gi,
    /learner prompt is still English "([^"]+)"/gi,
    /still English\s*\(\s*"([^"]+)"\s*\)/gi,
    /still English "\(([^)]+)\)"/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const n = extractCandidateTerm(m[1] ?? "");
      if (n) out.push(n);
    }
  }
  return [...new Set(out)];
}

export function collectCognateCandidatesFromIssues(issues: readonly string[]): string[] {
  const out = new Set<string>();
  for (const issue of issues) {
    for (const term of parseUntranslatedPromptGuardFailures(issue)) {
      out.add(term);
    }
  }
  return [...out].sort();
}

/**
 * Keep only the terms the German check named, and only if they were actually
 * requested. The model cannot add a word that was not in the untranslated list.
 */
export function selectConfirmedCognates(requested: readonly string[], namedByModel: readonly string[]): string[] {
  const allowed = new Set(requested.map((t) => normalizeCognateTerm(t)).filter(Boolean));
  const out = new Set<string>();
  for (const term of namedByModel) {
    const n = normalizeCognateTerm(term);
    if (n && allowed.has(n)) out.add(n);
  }
  return [...out].sort();
}

/**
 * An untranslated EN=DE word is not a cognate. It becomes a save-button
 * candidate only when German uses the same spelling for the same meaning
 * (park/Park). False friends (sad/traurig) stay translation errors.
 * If the check cannot run, no button is offered.
 */
export async function confirmGermanCognates(ctx: ActionCtx, terms: readonly string[]): Promise<string[]> {
  const requested = [...new Set(terms.map((t) => normalizeCognateTerm(t)).filter((t) => isLikelyCognateCandidateTerm(t)))];
  if (requested.length === 0) return [];
  const system = [
    "You know German and English.",
    "A term is a cognate only when German uses the same spelling, ignoring capitalization, and the same meaning.",
    "Examples that ARE cognates: park/Park, hotel/Hotel, taxi/Taxi, orange/Orange.",
    "Examples that are NOT cognates: sad (German: traurig), gift (German Gift means poison), fast (German fast means almost), also (German also means so), boot (German Boot means boat).",
    "Return ONLY JSON: {\"cognates\":[\"term\"]}. Copy terms from the input. If none qualify, return {\"cognates\":[]}.",
  ].join("\n");
  try {
    const { raw } = await callAiText(ctx, {
      stage: "auditor",
      system,
      user: JSON.stringify({ terms: requested }),
      maxTokens: 400,
      timeoutMs: 30_000,
    });
    const cleaned = String(raw || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { cognates?: unknown };
    const named = Array.isArray(parsed?.cognates) ? parsed.cognates.map((t) => String(t)) : [];
    return selectConfirmedCognates(requested, named);
  } catch (err) {
    console.warn("[cognates] German cognate check failed; no save button offered:", err);
    return [];
  }
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

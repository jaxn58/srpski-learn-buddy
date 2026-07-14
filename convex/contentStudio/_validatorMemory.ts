/**
 * Validator Memory ("Validator-Gehirn") - Content Studio brain module.
 *
 * Stores curated "lessons learned" about previously-fixed validator/auditor
 * findings and feeds them back into three stages:
 *   - Creator (prevention, scope.applyInCreator)
 *   - Fix-Findings AI (reparation, scope.applyInFix)
 *   - Validator (regression check, scope.applyInValidator)
 *
 * Auto-capture happens inside saveUnitPackageSnapshot when a previously-seen
 * finding disappears after a Fix-Findings cycle. Entries start as status
 * "candidate" until an admin curates title+guidance and promotes them to
 * status "active" from the Validator Memory tab in the Content Studio admin.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query, internalQuery } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireSuperadmin } from "./_shared";
import type { ValidationIssue } from "../../scripts/unitPackage/schema";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Build the stable fingerprint used to de-duplicate memory entries.
 * MUST stay in lock-step with the same computation in
 * convex/contentStudio/_mutations.ts (saveUnitPackageSnapshot).
 */
export function makeValidatorMemoryFingerprint(
  stage: string,
  code: string,
  path: string | undefined | null
): string {
  return `${stage}|${code}|${String(path || "").trim().toLowerCase()}`;
}

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
const SCOPE_VALIDATOR = v.object({
  applyInCreator: v.boolean(),
  applyInFix: v.boolean(),
  applyInValidator: v.boolean(),
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
const STATUS_VALIDATOR = v.union(
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  v.literal("candidate"),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  v.literal("active"),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  v.literal("archived")
);

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
const STAGE_VALIDATOR = v.union(
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  v.literal("validator"),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  v.literal("auditor")
);

// ---------------------------------------------------------------------------
// Queries (public, superadmin-gated)
// ---------------------------------------------------------------------------

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const listValidatorMemory = query({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    status: v.optional(STATUS_VALIDATOR),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    if (args.status) {
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      return await ctx.db
        .query("contentStudioValidatorMemory")
        // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("contentStudioValidatorMemory")
      .withIndex("by_last_seen_at")
      .order("desc")
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Internal queries (called from actions/mutations via ctx.runQuery(internal...))
// ---------------------------------------------------------------------------

/**
 * Load ACTIVE memory entries that should influence a given scope.
 * Called by the Creator / Fix / Validator pipelines.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getActiveValidatorMemoryForScope = internalQuery({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    scope: v.union(v.literal("creator"), v.literal("fix"), v.literal("validator")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    limit: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("contentStudioValidatorMemory")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const filtered = all.filter((e) => {
      if (args.scope === "creator") return e.scope.applyInCreator === true;
      if (args.scope === "fix") return e.scope.applyInFix === true;
      return e.scope.applyInValidator === true;
    });
    filtered.sort((a, b) => {
      const ao = a.occurrenceCount ?? 0;
      const bo = b.occurrenceCount ?? 0;
      if (bo !== ao) return bo - ao;
      return (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
    });
    const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 80)));
    return filtered.slice(0, limit);
  },
});

// ---------------------------------------------------------------------------
// Mutations (public, superadmin-gated)
// ---------------------------------------------------------------------------

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const createValidatorMemoryEntry = mutation({
  args: {
    stage: STAGE_VALIDATOR,
    code: v.string(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    path: v.optional(v.string()),
    title: v.string(),
    guidance: v.string(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    exampleBefore: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    exampleAfter: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    pattern: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    patternFlags: v.optional(v.string()),
    scope: SCOPE_VALIDATOR,
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    status: v.optional(STATUS_VALIDATOR),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const now = Date.now();
    const fingerprint = makeValidatorMemoryFingerprint(args.stage, args.code, args.path);

    const existing = await ctx.db
      .query("contentStudioValidatorMemory")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
      .first();
    if (existing) {
      throw new Error(
        `A memory entry with this fingerprint already exists (stage=${args.stage}, code=${args.code}, path=${args.path || ""}). Edit the existing entry instead.`
      );
    }

    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const id = await ctx.db.insert("contentStudioValidatorMemory", {
      fingerprint,
      stage: args.stage,
      code: args.code,
      path: args.path,
      title: args.title.trim(),
      guidance: args.guidance.trim(),
      exampleBefore: args.exampleBefore,
      exampleAfter: args.exampleAfter,
      pattern: args.pattern,
      patternFlags: args.patternFlags,
      scope: args.scope,
      status: args.status ?? "active",
      occurrenceCount: 1,
      lastSeenAt: now,
      createdAt: now,
      createdBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });
    return id;
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const updateValidatorMemoryEntry = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    entryId: v.id("contentStudioValidatorMemory"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    title: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    guidance: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    exampleBefore: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    exampleAfter: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    pattern: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    patternFlags: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    scope: v.optional(SCOPE_VALIDATOR),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const existing = await ctx.db.get(args.entryId);
    if (!existing) throw new Error("Memory entry not found");

    const patch: Partial<Doc<"contentStudioValidatorMemory">> = {
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    if (typeof args.title === "string") patch.title = args.title.trim();
    if (typeof args.guidance === "string") patch.guidance = args.guidance.trim();
    if (typeof args.exampleBefore === "string") patch.exampleBefore = args.exampleBefore;
    if (typeof args.exampleAfter === "string") patch.exampleAfter = args.exampleAfter;
    if (typeof args.pattern === "string") patch.pattern = args.pattern;
    if (typeof args.patternFlags === "string") patch.patternFlags = args.patternFlags;
    if (args.scope) patch.scope = args.scope;

    await ctx.db.patch(args.entryId, patch);
    return { ok: true };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const setValidatorMemoryStatus = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    entryId: v.id("contentStudioValidatorMemory"),
    status: STATUS_VALIDATOR,
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const existing = await ctx.db.get(args.entryId);
    if (!existing) throw new Error("Memory entry not found");
    await ctx.db.patch(args.entryId, {
      status: args.status,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });
    return { ok: true };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const deleteValidatorMemoryEntry = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    entryId: v.id("contentStudioValidatorMemory"),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const existing = await ctx.db.get(args.entryId);
    if (!existing) return { ok: true, deleted: false };
    await ctx.db.delete(args.entryId);
    return { ok: true, deleted: true };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (auto-capture, no auth gate - called only from trusted code)
// ---------------------------------------------------------------------------

/**
 * Upsert a candidate memory entry when a finding was successfully resolved.
 * - New: insert with status="candidate", default scope (creator+fix enabled).
 * - Existing: bump occurrenceCount, update lastSeenAt, fill exampleBefore if empty.
 *
 * Called from saveUnitPackageSnapshot for each "resolved" fingerprint.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalUpsertValidatorMemoryCandidate = internalMutation({
  args: {
    stage: STAGE_VALIDATOR,
    code: v.string(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    path: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    exampleBefore: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    sourceDraftId: v.optional(v.id("contentDrafts")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    sourceUnitNumber: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const now = Date.now();
    const fingerprint = makeValidatorMemoryFingerprint(args.stage, args.code, args.path);
    const existing = await ctx.db
      .query("contentStudioValidatorMemory")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
      .first();

    if (existing) {
      const patch: Partial<Doc<"contentStudioValidatorMemory">> = {
        occurrenceCount: (existing.occurrenceCount ?? 0) + 1,
        lastSeenAt: now,
        updatedAt: now,
      };
      if (!existing.exampleBefore && args.exampleBefore) {
        patch.exampleBefore = args.exampleBefore;
      }
      await ctx.db.patch(existing._id, patch);
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      return { ok: true, inserted: false, entryId: existing._id };
    }

    const id = await ctx.db.insert("contentStudioValidatorMemory", {
      fingerprint,
      stage: args.stage,
      code: args.code,
      path: args.path,
      title: args.code,
      guidance: "",
      exampleBefore: args.exampleBefore,
      exampleAfter: undefined,
      pattern: undefined,
      patternFlags: undefined,
      scope: {
        applyInCreator: true,
        applyInFix: true,
        applyInValidator: false,
      },
      status: "candidate",
      sourceDraftId: args.sourceDraftId,
      sourceUnitNumber: args.sourceUnitNumber,
      occurrenceCount: 1,
      lastSeenAt: now,
      createdAt: now,
      createdBy: undefined,
      updatedAt: now,
      updatedBy: undefined,
    });
    return { ok: true, inserted: true, entryId: id };
  },
});

// ---------------------------------------------------------------------------
// Pure TypeScript helpers (no Convex context) - used by the three stages.
// These consume an already-loaded entry array and produce prompt blocks /
// validation issues without touching the database themselves.
// ---------------------------------------------------------------------------

export type ValidatorMemoryEntryLite = {
  _id?: Id<"contentStudioValidatorMemory"> | string;
  stage: "validator" | "auditor";
  code: string;
  path?: string;
  title: string;
  guidance: string;
  exampleBefore?: string;
  exampleAfter?: string;
  pattern?: string;
  patternFlags?: string;
  scope: {
    applyInCreator: boolean;
    applyInFix: boolean;
    applyInValidator: boolean;
  };
  status: "candidate" | "active" | "archived";
  occurrenceCount?: number;
  lastSeenAt?: number;
};

/**
 * Build a "KNOWN PITFALLS TO AVOID" Markdown block for injection into the
 * Specialist / Section-Revise system prompt.
 */
export function buildValidatorMemoryBlockFromEntries(
  entries: ValidatorMemoryEntryLite[],
  opts: { limit?: number } = {}
): string {
  const limit = Math.max(1, Math.min(60, Math.floor(opts.limit ?? 40)));
  const usable = entries
    .filter((e) => e.status === "active" && e.scope?.applyInCreator)
    .filter((e) => (e.guidance || "").trim().length > 0 || (e.title || "").trim().length > 0)
    .slice(0, limit);
  if (usable.length === 0) return "";

  const bullets = usable.map((e) => {
    const title = (e.title || e.code).trim();
    const guidance = (e.guidance || "").trim();
    const code = e.code.trim();
    const suffix = guidance ? `: ${guidance}` : "";
    return `- [${code}] ${title}${suffix}`;
  });

  return [
    "KNOWN PITFALLS TO AVOID (learned from previous fixes - do NOT repeat these mistakes):",
    ...bullets,
  ].join("\n");
}

/**
 * Pick memory entries relevant for the currently-open findings so the Fix AI
 * can apply the same corrections consistently. Matching priority:
 *   1. exact fingerprint (stage|code|path)
 *   2. stage+code match (same rule, different path)
 *   3. code-only match (rule family)
 */
export function findMemoryForFindingsFromEntries(
  entries: ValidatorMemoryEntryLite[],
  findings: Array<{ stage?: string; code?: string; path?: string }>,
  opts: { maxPerFinding?: number; maxTotal?: number } = {}
): ValidatorMemoryEntryLite[] {
  const maxTotal = Math.max(1, Math.min(60, Math.floor(opts.maxTotal ?? 24)));
  const maxPerFinding = Math.max(1, Math.min(6, Math.floor(opts.maxPerFinding ?? 2)));
  const fixScoped = entries.filter(
    (e) => e.status === "active" && e.scope?.applyInFix
  );
  if (fixScoped.length === 0) return [];

  const byFingerprint = new Map<string, ValidatorMemoryEntryLite>();
  for (const e of fixScoped) {
    byFingerprint.set(
      makeValidatorMemoryFingerprint(e.stage, e.code, e.path),
      e
    );
  }

  const pickedIds = new Set<string>();
  const picked: ValidatorMemoryEntryLite[] = [];

  const addEntry = (e: ValidatorMemoryEntryLite) => {
    const key = String(e._id || makeValidatorMemoryFingerprint(e.stage, e.code, e.path));
    if (pickedIds.has(key)) return false;
    pickedIds.add(key);
    picked.push(e);
    return true;
  };

  for (const f of findings) {
    if (picked.length >= maxTotal) break;
    const stage = (f.stage === "auditor" ? "auditor" : "validator") as "validator" | "auditor";
    const code = String(f.code || "").trim();
    if (!code) continue;
    let perFindingCount = 0;

    const exactFp = makeValidatorMemoryFingerprint(stage, code, f.path);
    const exact = byFingerprint.get(exactFp);
    if (exact && addEntry(exact)) perFindingCount++;

    if (perFindingCount < maxPerFinding) {
      for (const e of fixScoped) {
        if (picked.length >= maxTotal) break;
        if (perFindingCount >= maxPerFinding) break;
        if (e.stage !== stage) continue;
        if (e.code !== code) continue;
        if (addEntry(e)) perFindingCount++;
      }
    }

    if (perFindingCount < maxPerFinding) {
      for (const e of fixScoped) {
        if (picked.length >= maxTotal) break;
        if (perFindingCount >= maxPerFinding) break;
        if (e.code !== code) continue;
        if (addEntry(e)) perFindingCount++;
      }
    }
  }

  return picked.slice(0, maxTotal);
}

/**
 * Format matched memory entries as a "CORRECTION RECIPES" block for the Fix
 * AI user prompt.
 */
export function buildCorrectionRecipesBlock(
  entries: ValidatorMemoryEntryLite[]
): string {
  if (entries.length === 0) return "";
  const lines: string[] = [
    "CORRECTION RECIPES (from past fixes - apply these consistently):",
  ];
  for (const e of entries) {
    const title = (e.title || e.code).trim();
    const guidance = (e.guidance || "").trim();
    lines.push(`- [${e.code}] ${title}${guidance ? `: ${guidance}` : ""}`);
    const before = (e.exampleBefore || "").trim();
    const after = (e.exampleAfter || "").trim();
    if (before) lines.push(`  Example (before): ${before.slice(0, 280)}`);
    if (after) lines.push(`  Example (after): ${after.slice(0, 280)}`);
  }
  return lines.join("\n");
}

/**
 * Apply memory regex patterns to the unitPackage and return soft warnings
 * for each match. Matches are scanned over a set of known text-bearing fields
 * (vocabulary, phrases, exercises) so paths in the resulting ValidationIssue
 * are meaningful.
 */
export function collectMemoryRegressionIssuesFromEntries(
  entries: ValidatorMemoryEntryLite[],
  pkg: unknown
): ValidationIssue[] {
  const scoped = entries.filter(
    (e) =>
      e.status === "active" &&
      e.scope?.applyInValidator === true &&
      typeof e.pattern === "string" &&
      e.pattern.trim().length > 0
  );
  if (scoped.length === 0) return [];

  const targets = collectTextTargets(pkg);
  if (targets.length === 0) return [];

  const issues: ValidationIssue[] = [];
  const MAX_ISSUES_PER_ENTRY = 5;

  for (const entry of scoped) {
    let regex: RegExp;
    try {
      const flags = (entry.patternFlags || "").trim();
      regex = new RegExp(entry.pattern as string, flags.includes("g") ? flags : `${flags}g`);
    } catch {
      continue;
    }
    let hits = 0;
    for (const target of targets) {
      if (hits >= MAX_ISSUES_PER_ENTRY) break;
      regex.lastIndex = 0;
      if (!regex.test(target.text)) continue;
      issues.push({
        level: "warning",
        path: target.path,
        message: `Regression of known issue "${entry.title || entry.code}": ${(entry.guidance || "").trim() || "See Validator Memory for details."}`,
      });
      hits++;
    }
  }

  return issues;
}

type TextTarget = { path: Array<string | number>; text: string };

function collectTextTargets(pkg: unknown): TextTarget[] {
  const out: TextTarget[] = [];
  const root: any = pkg ?? {};

  const pushText = (path: Array<string | number>, val: unknown) => {
    if (typeof val !== "string") return;
    const trimmed = val.trim();
    if (!trimmed) return;
    out.push({ path, text: trimmed });
  };

  const vocabArr: any[] = Array.isArray(root?.vocabulary?.en) ? root.vocabulary.en : [];
  vocabArr.forEach((v: any, i: number) => {
    pushText(["vocabulary", "en", i, "serbian"], v?.serbian);
    pushText(["vocabulary", "en", i, "english"], v?.english ?? v?.en);
    pushText(["vocabulary", "en", i, "notes"], v?.notes ?? v?.noteEn);
  });

  const phrasesArr: any[] = Array.isArray(root?.phrases?.en) ? root.phrases.en : [];
  phrasesArr.forEach((p: any, i: number) => {
    pushText(["phrases", "en", i, "serbian"], p?.serbian);
    pushText(["phrases", "en", i, "english"], p?.english ?? p?.en);
    pushText(["phrases", "en", i, "notes"], p?.notes);
  });

  const walkExercises = (exArr: any[], langKey: "en" | "de") => {
    exArr.forEach((ex: any, i: number) => {
      pushText(["exercises", langKey, i, "instructions"], ex?.instructions);
      const questions: any[] = Array.isArray(ex?.questions) ? ex.questions : [];
      questions.forEach((q: any, j: number) => {
        pushText(["exercises", langKey, i, "questions", j, "question"], q?.question);
        pushText(["exercises", langKey, i, "questions", j, "answer"], q?.answer);
        const options: any[] = Array.isArray(q?.options) ? q.options : [];
        options.forEach((o: any, k: number) => {
          const txt = typeof o === "string" ? o : o?.text ?? o?.label;
          pushText(["exercises", langKey, i, "questions", j, "options", k], txt);
        });
      });
    });
  };
  if (Array.isArray(root?.exercises?.en)) walkExercises(root.exercises.en, "en");
  if (Array.isArray(root?.exercises?.de)) walkExercises(root.exercises.de, "de");

  const grammar: any[] = Array.isArray(root?.grammar?.en) ? root.grammar.en : [];
  grammar.forEach((g: any, i: number) => {
    pushText(["grammar", "en", i, "title"], g?.title);
    pushText(["grammar", "en", i, "explanation"], g?.explanation);
    const examples: any[] = Array.isArray(g?.examples) ? g.examples : [];
    examples.forEach((ex: any, j: number) => {
      pushText(["grammar", "en", i, "examples", j, "serbian"], ex?.serbian);
      pushText(["grammar", "en", i, "examples", j, "english"], ex?.english ?? ex?.en);
    });
  });

  return out;
}

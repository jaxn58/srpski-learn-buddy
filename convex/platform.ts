/**
 * Platform-wide configuration (singleton).
 *
 * Holds global switches that are not tied to a single user. Today this is the
 * master beta-phase switch that governs whether beta testers receive free full
 * access (see convex/featureAccess.ts). Read paths fall back to sane defaults
 * when no config row exists yet, so this is zero-migration.
 */
import { v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isStaffRole } from "./authz";
import {
  DEFAULT_ENERGY_COSTS,
  DEFAULT_TIER_QUOTAS,
  DEFAULT_UPLOAD_MAX_FILE_BYTES,
} from "./energy";

// Default while no config row exists: the closed beta is considered ACTIVE.
// This preserves today's behavior (beta testers keep full access) until a
// superadmin explicitly ends the beta phase.
export const DEFAULT_BETA_PHASE_ACTIVE = true;

// Beta boundaries the test "stakes out" for the whole app. These mirror the
// previously hard-coded values (1 unit, 10 AI messages/day) so behavior is
// unchanged until an admin tunes them.
export const DEFAULT_BETA_MAX_UNITS = 1;
export const DEFAULT_BETA_MAX_AI_PER_DAY = 10;

/**
 * Read the global beta-phase flag from any query/mutation context.
 * Shared by featureAccess resolution so there is one definition of "is beta on".
 */
export async function loadBetaPhaseActive(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const config = await ctx.db.query("platformConfig").first();
  return config?.betaPhaseActive ?? DEFAULT_BETA_PHASE_ACTIVE;
}

/**
 * Max number of learning units a beta user may access. Single source of truth
 * for unit gating (see convex/subscriptions.ts and convex/units.ts).
 */
export async function loadBetaMaxUnits(ctx: QueryCtx | MutationCtx): Promise<number> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const config = await ctx.db.query("platformConfig").first();
  return config?.betaMaxUnits ?? DEFAULT_BETA_MAX_UNITS;
}

/**
 * Max number of AI queries (chat messages) per day for beta users. Single
 * source of truth for the chat rate limit (see convex/chat.ts).
 */
export async function loadBetaMaxAiPerDay(ctx: QueryCtx | MutationCtx): Promise<number> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const config = await ctx.db.query("platformConfig").first();
  return config?.betaMaxAiPerDay ?? DEFAULT_BETA_MAX_AI_PER_DAY;
}

/**
 * Public (staff-only) read of the platform config for the admin UI.
 */
export const getPlatformConfig = query({
  args: {},
  returns: v.object({
    betaPhaseActive: v.boolean(),
    betaMaxUnits: v.number(),
    betaMaxAiPerDay: v.number(),
    // Energy config (always returned, with defaults applied)
    energyCostCompact: v.number(),
    energyCostDetailed: v.number(),
    energyRagSurcharge: v.number(),
    energyVisionSurcharge: v.number(),
    energyUploadBase: v.number(),
    energyUploadPerKb: v.number(),
    energyQuotaFull: v.number(),
    energyQuotaBuddy: v.number(),
    energyQuotaBasic: v.number(),
    uploadMaxFileBytes: v.number(),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || !isStaffRole(user.role)) throw new Error("Unauthorized");

    // @ts-ignore TS2589 – Convex schema depth limit (large schema)
    const config = await ctx.db.query("platformConfig").first();
    return {
      betaPhaseActive: config?.betaPhaseActive ?? DEFAULT_BETA_PHASE_ACTIVE,
      betaMaxUnits: config?.betaMaxUnits ?? DEFAULT_BETA_MAX_UNITS,
      betaMaxAiPerDay: config?.betaMaxAiPerDay ?? DEFAULT_BETA_MAX_AI_PER_DAY,
      energyCostCompact: config?.energyCostCompact ?? DEFAULT_ENERGY_COSTS.compact,
      energyCostDetailed: config?.energyCostDetailed ?? DEFAULT_ENERGY_COSTS.detailed,
      energyRagSurcharge: config?.energyRagSurcharge ?? DEFAULT_ENERGY_COSTS.ragSurcharge,
      energyVisionSurcharge: config?.energyVisionSurcharge ?? DEFAULT_ENERGY_COSTS.visionSurcharge,
      energyUploadBase: config?.energyUploadBase ?? DEFAULT_ENERGY_COSTS.uploadBase,
      energyUploadPerKb: config?.energyUploadPerKb ?? DEFAULT_ENERGY_COSTS.uploadPerKb,
      energyQuotaFull: config?.energyQuotaFull ?? DEFAULT_TIER_QUOTAS.full,
      energyQuotaBuddy: config?.energyQuotaBuddy ?? DEFAULT_TIER_QUOTAS.buddy,
      energyQuotaBasic: config?.energyQuotaBasic ?? DEFAULT_TIER_QUOTAS.basic,
      uploadMaxFileBytes: config?.uploadMaxFileBytes ?? DEFAULT_UPLOAD_MAX_FILE_BYTES,
      updatedAt: config?.updatedAt ?? null,
    };
  },
});

/**
 * Upsert the platform-config singleton with the given partial fields.
 * Always stamps updatedAt/updatedBy. Inserts a fresh row (using current
 * defaults for unspecified fields) when none exists yet.
 */
type EnergyPatchFields = {
  energyCostCompact?: number;
  energyCostDetailed?: number;
  energyRagSurcharge?: number;
  energyVisionSurcharge?: number;
  energyUploadBase?: number;
  energyUploadPerKb?: number;
  energyQuotaFull?: number;
  energyQuotaBuddy?: number;
  energyQuotaBasic?: number;
  uploadMaxFileBytes?: number;
};

async function upsertPlatformConfig(
  ctx: MutationCtx,
  updatedBy: Id<"users">,
  patch: {
    betaPhaseActive?: boolean;
    betaMaxUnits?: number;
    betaMaxAiPerDay?: number;
  } & EnergyPatchFields
): Promise<void> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const existing = await ctx.db.query("platformConfig").first();
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now(), updatedBy });
  } else {
    await ctx.db.insert("platformConfig", {
      betaPhaseActive: patch.betaPhaseActive ?? DEFAULT_BETA_PHASE_ACTIVE,
      betaMaxUnits: patch.betaMaxUnits ?? DEFAULT_BETA_MAX_UNITS,
      betaMaxAiPerDay: patch.betaMaxAiPerDay ?? DEFAULT_BETA_MAX_AI_PER_DAY,
      energyCostCompact: patch.energyCostCompact,
      energyCostDetailed: patch.energyCostDetailed,
      energyRagSurcharge: patch.energyRagSurcharge,
      energyVisionSurcharge: patch.energyVisionSurcharge,
      energyUploadBase: patch.energyUploadBase,
      energyUploadPerKb: patch.energyUploadPerKb,
      energyQuotaFull: patch.energyQuotaFull,
      energyQuotaBuddy: patch.energyQuotaBuddy,
      energyQuotaBasic: patch.energyQuotaBasic,
      uploadMaxFileBytes: patch.uploadMaxFileBytes,
      updatedAt: Date.now(),
      updatedBy,
    });
  }
}

/** Validate a beta limit value: must be a non-negative integer within a sane cap. */
function assertValidLimit(value: number, label: string, max: number): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${label} must be an integer between 0 and ${max}`);
  }
}

/**
 * Toggle the global beta phase (superadmin only). Upserts the singleton row.
 */
export const setBetaPhaseActive = mutation({
  args: { betaPhaseActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new Error("Only superadmin can change the beta phase");
    }

    await upsertPlatformConfig(ctx, user._id, { betaPhaseActive: args.betaPhaseActive });
    return null;
  },
});

/**
 * Set the daily AI-query limit for beta users (superadmin only). Lives next to
 * the beta-phase master switch in the admin UI.
 */
export const setBetaMaxAiPerDay = mutation({
  args: { betaMaxAiPerDay: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new Error("Only superadmin can change the beta AI limit");
    }

    assertValidLimit(args.betaMaxAiPerDay, "Beta AI queries/day", 10000);
    await upsertPlatformConfig(ctx, user._id, { betaMaxAiPerDay: args.betaMaxAiPerDay });
    return null;
  },
});

/**
 * Set how many learning units a beta user may access (staff: admin/superadmin).
 * Surfaced in the content-creation area, next to unit management.
 */
export const setBetaMaxUnits = mutation({
  args: { betaMaxUnits: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || !isStaffRole(user.role)) {
      throw new Error("Only staff can change the beta unit limit");
    }

    assertValidLimit(args.betaMaxUnits, "Beta units", 1000);
    await upsertPlatformConfig(ctx, user._id, { betaMaxUnits: args.betaMaxUnits });
    return null;
  },
});

/** Validate a non-negative finite number (allows decimals for per-KB factor). */
function assertNonNegative(value: number, label: string, max: number): void {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(`${label} must be a number between 0 and ${max}`);
  }
}

/**
 * Set the full AI-Energy configuration (superadmin only). Validates inputs
 * then upserts the singleton. All fields are optional – only the ones present
 * in `args` are patched; the rest keep their existing values.
 *
 * Cost table is integer-bounded (≤ 1000) to prevent typos creating runaway
 * deductions; `uploadPerKb` allows decimals because real cost is sub-integer
 * per KB. Quotas are bounded to 1,000,000 (≈ 1M Energy is far beyond any
 * realistic month).
 */
export const setEnergyConfig = mutation({
  args: {
    energyCostCompact: v.optional(v.number()),
    energyCostDetailed: v.optional(v.number()),
    energyRagSurcharge: v.optional(v.number()),
    energyVisionSurcharge: v.optional(v.number()),
    energyUploadBase: v.optional(v.number()),
    energyUploadPerKb: v.optional(v.number()),
    energyQuotaFull: v.optional(v.number()),
    energyQuotaBuddy: v.optional(v.number()),
    energyQuotaBasic: v.optional(v.number()),
    uploadMaxFileBytes: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new Error("Only superadmin can change the energy configuration");
    }

    if (args.energyCostCompact !== undefined)
      assertValidLimit(args.energyCostCompact, "Compact cost", 1000);
    if (args.energyCostDetailed !== undefined)
      assertValidLimit(args.energyCostDetailed, "Detailed cost", 1000);
    if (args.energyRagSurcharge !== undefined)
      assertValidLimit(args.energyRagSurcharge, "RAG surcharge", 1000);
    if (args.energyVisionSurcharge !== undefined)
      assertValidLimit(args.energyVisionSurcharge, "Vision surcharge", 1000);
    if (args.energyUploadBase !== undefined)
      assertValidLimit(args.energyUploadBase, "Upload base", 1000);
    if (args.energyUploadPerKb !== undefined)
      assertNonNegative(args.energyUploadPerKb, "Upload per KB", 100);
    if (args.energyQuotaFull !== undefined)
      assertValidLimit(args.energyQuotaFull, "Full quota", 1_000_000);
    if (args.energyQuotaBuddy !== undefined)
      assertValidLimit(args.energyQuotaBuddy, "Buddy quota", 1_000_000);
    if (args.energyQuotaBasic !== undefined)
      assertValidLimit(args.energyQuotaBasic, "Basic quota", 1_000_000);
    if (args.uploadMaxFileBytes !== undefined)
      assertValidLimit(args.uploadMaxFileBytes, "Upload max bytes", 200 * 1024 * 1024);

    await upsertPlatformConfig(ctx, user._id, args);
    return null;
  },
});

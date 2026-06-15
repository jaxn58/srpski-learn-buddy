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
      updatedAt: config?.updatedAt ?? null,
    };
  },
});

/**
 * Upsert the platform-config singleton with the given partial fields.
 * Always stamps updatedAt/updatedBy. Inserts a fresh row (using current
 * defaults for unspecified fields) when none exists yet.
 */
async function upsertPlatformConfig(
  ctx: MutationCtx,
  updatedBy: Id<"users">,
  patch: {
    betaPhaseActive?: boolean;
    betaMaxUnits?: number;
    betaMaxAiPerDay?: number;
  }
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

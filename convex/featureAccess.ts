/**
 * Feature Access – Single Source of Truth for the 4-package model.
 *
 * Resolves a user's feature entitlements and AI-Energy state from their
 * subscription (`featureTier` + energy fields) and role. Both the frontend
 * (UI gating) and the backend (enforcement, later phases) read from here so
 * there is exactly one place that knows how access is derived.
 *
 * Design decisions (confirmed with product owner, June 2026):
 *  - Grandfathering (existing/legacy subscriptions without `featureTier`):
 *    resolved to FULL feature access so nobody loses functionality on deploy.
 *  - Energy is NEVER unlimited for learners. Only staff (admin/superadmin) are
 *    unlimited. Learners (incl. beta testers / legacy users) get a concrete,
 *    limited monthly quota (the tier default until per-subscription values or
 *    the admin energy config land in a later phase).
 *
 * This file is purely additive and non-enforcing (Phase 1). No mutation in this
 * phase changes behavior for existing users beyond exposing derived flags.
 */
import { v } from "convex/values";
import { query, internalQuery, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isStaffRole, isLearnerAccountSuspended } from "./authz";

export type FeatureTier = "course" | "buddy" | "basic" | "full";

/**
 * Default inclusive monthly energy quota per tier.
 *
 * These are the launch defaults from docs/restructure/02_TOKEN_SYSTEM.md. They
 * become admin-configurable in Phase 3; until then they are the fallback used
 * whenever a subscription has no explicit `energyQuotaMonthly`. Kept in one
 * place so the later migration to a config table is a single edit.
 */
export const DEFAULT_TIER_ENERGY_QUOTA: Record<FeatureTier, number> = {
  course: 0, // Sprachkurs has only the teaser (separate daily counter), no energy quota
  buddy: 450,
  basic: 120,
  full: 750,
};

type FeatureFlags = {
  learning: boolean;
  buddyChat: boolean;
  contextLinking: boolean;
  documents: boolean;
  community: boolean;
  energyTopUp: boolean;
  teaser: boolean;
};

type EnergyState = {
  unlimited: boolean;
  quotaMonthly: number;
  usedThisPeriod: number;
  topUpBalance: number;
  available: number;
  periodResetAt: number | null;
};

export type FeatureAccess = {
  hasAccess: boolean;
  tier: FeatureTier | null;
  source: "staff" | "override" | "subscription" | "beta" | "past_due" | "none" | "unauthenticated" | "suspended";
  isStaff: boolean;
  features: FeatureFlags;
  energy: EnergyState;
};

// Validator mirror of FeatureAccess for query `returns`.
const featureAccessValidator = v.object({
  hasAccess: v.boolean(),
  tier: v.union(
    v.literal("course"),
    v.literal("buddy"),
    v.literal("basic"),
    v.literal("full"),
    v.null()
  ),
  source: v.union(
    v.literal("staff"),
    v.literal("override"),
    v.literal("subscription"),
    v.literal("beta"),
    v.literal("past_due"),
    v.literal("none"),
    v.literal("unauthenticated"),
    v.literal("suspended")
  ),
  isStaff: v.boolean(),
  features: v.object({
    learning: v.boolean(),
    buddyChat: v.boolean(),
    contextLinking: v.boolean(),
    documents: v.boolean(),
    community: v.boolean(),
    energyTopUp: v.boolean(),
    teaser: v.boolean(),
  }),
  energy: v.object({
    unlimited: v.boolean(),
    quotaMonthly: v.number(),
    usedThisPeriod: v.number(),
    topUpBalance: v.number(),
    available: v.number(),
    periodResetAt: v.union(v.number(), v.null()),
  }),
});

function featuresForTier(tier: FeatureTier): FeatureFlags {
  return {
    learning: tier === "course" || tier === "basic" || tier === "full",
    buddyChat: tier === "buddy" || tier === "basic" || tier === "full",
    contextLinking: tier === "basic" || tier === "full", // NOT for standalone buddy
    documents: tier === "buddy" || tier === "full",
    community: tier === "full",
    energyTopUp: tier === "buddy" || tier === "full",
    teaser: tier === "course", // 1-2 buddy questions / 24h preview
  };
}

const ALL_FEATURES_FALSE: FeatureFlags = {
  learning: false,
  buddyChat: false,
  contextLinking: false,
  documents: false,
  community: false,
  energyTopUp: false,
  teaser: false,
};

const NO_ENERGY: EnergyState = {
  unlimited: false,
  quotaMonthly: 0,
  usedThisPeriod: 0,
  topUpBalance: 0,
  available: 0,
  periodResetAt: null,
};

function noAccess(source: FeatureAccess["source"]): FeatureAccess {
  return {
    hasAccess: false,
    tier: null,
    source,
    isStaff: false,
    features: { ...ALL_FEATURES_FALSE },
    energy: { ...NO_ENERGY },
  };
}

function resolveEnergy(tier: FeatureTier, sub: Doc<"userSubscriptions"> | null | undefined): EnergyState {
  const quotaMonthly = sub?.energyQuotaMonthly ?? DEFAULT_TIER_ENERGY_QUOTA[tier];
  const usedThisPeriod = sub?.energyUsedThisPeriod ?? 0;
  const topUpBalance = sub?.energyTopUpBalance ?? 0;
  const available = Math.max(0, quotaMonthly - usedThisPeriod) + topUpBalance;
  const periodResetAt = sub?.energyPeriodResetAt ?? null;
  return { unlimited: false, quotaMonthly, usedThisPeriod, topUpBalance, available, periodResetAt };
}

/**
 * Pure resolution logic. Kept free of ctx so it stays unit-testable and is the
 * single definition of how entitlements are derived.
 */
export function resolveFeatureAccess(input: {
  user: Doc<"users">;
  activeSub: Doc<"userSubscriptions"> | null;
  pastDueSub: Doc<"userSubscriptions"> | null;
}): FeatureAccess {
  const { user, activeSub, pastDueSub } = input;

  // Staff: full access + unlimited energy (QA, support, content verification).
  if (isStaffRole(user.role)) {
    return {
      hasAccess: true,
      tier: "full",
      source: "staff",
      isStaff: true,
      features: featuresForTier("full"),
      energy: { ...NO_ENERGY, unlimited: true },
    };
  }

  // Superadmin-set override wins over subscription/beta resolution. Used for
  // support, comps and (currently) QA of the 4-package gating. Energy follows
  // the overridden tier's rules (still limited – never unlimited for learners).
  const override = user.featureTierOverride as FeatureTier | undefined;
  if (override) {
    return {
      hasAccess: true,
      tier: override,
      source: "override",
      isStaff: false,
      features: featuresForTier(override),
      energy: resolveEnergy(override, activeSub),
    };
  }

  // Payment failed on an installment plan → access paused entirely
  // (mirrors convex/subscriptions.ts getAccessibleUnits behavior).
  if (pastDueSub) {
    return noAccess("past_due");
  }

  // Active PAID subscription → use its featureTier; legacy subs without the
  // field are grandfathered to full feature access (Zero-Migration).
  if (activeSub && activeSub.planType !== "beta") {
    const tier: FeatureTier = activeSub.featureTier ?? "full";
    return {
      hasAccess: true,
      tier,
      source: "subscription",
      isStaff: false,
      features: featuresForTier(tier),
      energy: resolveEnergy(tier, activeSub),
    };
  }

  // Beta testers (virtual beta sub or flag): full features, but LIMITED energy.
  if (activeSub?.planType === "beta" || user.isBetaTester === true) {
    return {
      hasAccess: true,
      tier: "full",
      source: "beta",
      isStaff: false,
      features: featuresForTier("full"),
      energy: resolveEnergy("full", activeSub ?? null),
    };
  }

  // No entitlement.
  return noAccess("none");
}

async function loadSubscriptions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<{ activeSub: Doc<"userSubscriptions"> | null; pastDueSub: Doc<"userSubscriptions"> | null }> {
  // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
  const activeSub = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
  const pastDueSub = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "past_due"))
    .first();

  return { activeSub: activeSub ?? null, pastDueSub: pastDueSub ?? null };
}

/**
 * Backend helper: resolve feature access for a known user id from any
 * query/mutation context. This is the enforcement entry point used by
 * chat.ts, documents.ts, etc. so gating logic lives in exactly one place.
 */
export async function getFeatureAccessForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<FeatureAccess> {
  // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
  const user = await ctx.db.get(userId);
  if (!user) return noAccess("unauthenticated");
  if (isLearnerAccountSuspended(user)) return noAccess("suspended");

  const { activeSub, pastDueSub } = await loadSubscriptions(ctx, userId);
  return resolveFeatureAccess({ user, activeSub, pastDueSub });
}

/**
 * Public: resolve the current authenticated user's feature access.
 * Returns a fully-derived, safe object in all cases (never throws for normal
 * unauthenticated/suspended states) so the UI can gate without try/catch.
 */
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getFeatureAccess = query({
  args: {},
  returns: featureAccessValidator,
  handler: async (ctx): Promise<FeatureAccess> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return noAccess("unauthenticated");

    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return noAccess("unauthenticated");
    if (isLearnerAccountSuspended(user)) return noAccess("suspended");

    const { activeSub, pastDueSub } = await loadSubscriptions(ctx, user._id);
    return resolveFeatureAccess({ user, activeSub, pastDueSub });
  },
});

/**
 * Internal: resolve feature access for a specific user id. Used by backend
 * functions (e.g. chat enforcement in a later phase) that already know the user.
 */
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const internalGetFeatureAccess = internalQuery({
  args: { userId: v.id("users") },
  returns: featureAccessValidator,
  handler: async (ctx, args): Promise<FeatureAccess> => {
    return await getFeatureAccessForUser(ctx, args.userId);
  },
});

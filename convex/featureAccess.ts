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
import { loadBetaPhaseActive } from "./platform";
import { loadEnergyConfig, DEFAULT_BETA_ENERGY_QUOTA } from "./energy";

/**
 * Canonical feature tier identifiers (Phase 5, June 2026).
 *
 *   course         – Sprachkurs (learning content only, no AI)
 *   standalone     – AI Chat Standalone (AI Buddy + documents, no learning)
 *   course_ai      – Sprachkurs + AI (learning + AI Buddy with context linking)
 *   course_ai_pro  – Sprachkurs + AI Pro (everything: learning, AI, documents, community)
 *
 * The legacy names (buddy | basic | full) are still accepted on input for
 * zero-migration of existing DB records – they are normalized to the canonical
 * names via `normalizeFeatureTier()` before any feature-resolution logic runs.
 */
export type FeatureTier = "course" | "standalone" | "course_ai" | "course_ai_pro";

/**
 * Raw tier as it may appear in the DB or via override (includes legacy aliases).
 * Use `normalizeFeatureTier()` to convert into a canonical FeatureTier.
 */
export type RawFeatureTier = FeatureTier | "buddy" | "basic" | "full";

/**
 * Normalize a legacy tier identifier to its canonical equivalent.
 *   buddy → standalone, basic → course_ai, full → course_ai_pro
 * Canonical IDs pass through unchanged. Returns null for unknown values.
 */
export function normalizeFeatureTier(raw: RawFeatureTier | null | undefined): FeatureTier | null {
  if (!raw) return null;
  switch (raw) {
    case "course":         return "course";
    case "standalone":     return "standalone";
    case "course_ai":      return "course_ai";
    case "course_ai_pro":  return "course_ai_pro";
    // Legacy aliases
    case "buddy":          return "standalone";
    case "basic":          return "course_ai";
    case "full":           return "course_ai_pro";
    default:               return null;
  }
}

/**
 * Per-tier monthly energy quotas used as fallback when a subscription has no
 * explicit `energyQuotaMonthly`. The `course` tier has no energy (teaser-only)
 * by design – the other tiers are admin-tunable via `platformConfig` (see
 * convex/energy.ts and the `loadEnergyConfig` helper).
 *
 * Field names match the legacy tier IDs (full/buddy/basic) for backward
 * compatibility with `loadEnergyConfig` and the admin energy panel; they map
 * to canonical tiers as: full=course_ai_pro, buddy=standalone, basic=course_ai.
 */
type TierQuotas = { full: number; buddy: number; basic: number };

function quotaForTier(tier: FeatureTier, quotas: TierQuotas): number {
  switch (tier) {
    case "course":         return 0;
    case "course_ai_pro":  return quotas.full;
    case "standalone":     return quotas.buddy;
    case "course_ai":      return quotas.basic;
  }
}

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
  debtBalance: number;
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
// Note: `tier` is always the canonical value (legacy aliases are normalized
// before they reach this validator), so the union only lists canonical IDs.
const featureAccessValidator = v.object({
  hasAccess: v.boolean(),
  tier: v.union(
    v.literal("course"),
    v.literal("standalone"),
    v.literal("course_ai"),
    v.literal("course_ai_pro"),
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
    debtBalance: v.number(),
    available: v.number(),
    periodResetAt: v.union(v.number(), v.null()),
  }),
});

function featuresForTier(tier: FeatureTier): FeatureFlags {
  return {
    // Learning content is included in every paid tier EXCEPT the buddy-only "standalone" tier.
    learning: tier === "course" || tier === "course_ai" || tier === "course_ai_pro",
    // AI Buddy chat is included in every tier except "course" (teaser-only).
    buddyChat: tier === "standalone" || tier === "course_ai" || tier === "course_ai_pro",
    // Context linking (Buddy ties answers to current unit/vocab) requires both
    // learning content AND AI. NOT for "standalone" (no learning) and NOT for "course" (no AI).
    contextLinking: tier === "course_ai" || tier === "course_ai_pro",
    // Documents: only the buddy-tiers that include the AI Buddy's full toolset.
    // Excludes "course" (no AI) and "course_ai" (entry-level AI, no documents).
    documents: tier === "standalone" || tier === "course_ai_pro",
    // Community (forum, group exercises) – Pro tier only.
    community: tier === "course_ai_pro",
    // Energy top-up: any tier that has AI Buddy access (excludes "course" – it has 0 energy).
    energyTopUp: tier === "standalone" || tier === "course_ai" || tier === "course_ai_pro",
    // Teaser: the entry-level "course" tier gets 1-2 buddy questions / 24h preview.
    teaser: tier === "course",
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
  debtBalance: 0,
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

function resolveEnergy(
  tier: FeatureTier,
  sub: Doc<"userSubscriptions"> | null | undefined,
  quotas: TierQuotas
): EnergyState {
  const quotaMonthly = sub?.energyQuotaMonthly ?? quotaForTier(tier, quotas);
  const usedThisPeriod = sub?.energyUsedThisPeriod ?? 0;
  const topUpBalance = sub?.energyTopUpBalance ?? 0;
  const debtBalance = sub?.energyDebtBalance ?? 0;
  const quotaRemaining = Math.max(0, quotaMonthly - usedThisPeriod);
  const available = Math.max(0, quotaRemaining + topUpBalance - debtBalance);
  const periodResetAt = sub?.energyPeriodResetAt ?? null;
  return { unlimited: false, quotaMonthly, usedThisPeriod, topUpBalance, debtBalance, available, periodResetAt };
}

/**
 * Beta testers without a subscription row yet: show the beta-specific quota.
 * Once chargeEnergy lazy-creates the beta subscription, resolveEnergy takes
 * over and reads the persisted fields.
 */
function resolveBetaEnergy(): EnergyState {
  return {
    unlimited: false,
    quotaMonthly: DEFAULT_BETA_ENERGY_QUOTA,
    usedThisPeriod: 0,
    topUpBalance: 0,
    debtBalance: 0,
    available: DEFAULT_BETA_ENERGY_QUOTA,
    periodResetAt: null,
  };
}

/**
 * Pure resolution logic. Kept free of ctx so it stays unit-testable and is the
 * single definition of how entitlements are derived.
 */
export function resolveFeatureAccess(input: {
  user: Doc<"users">;
  activeSub: Doc<"userSubscriptions"> | null;
  pastDueSub: Doc<"userSubscriptions"> | null;
  betaPhaseActive: boolean;
  energyQuotas: TierQuotas;
}): FeatureAccess {
  const { user, activeSub, pastDueSub, betaPhaseActive, energyQuotas } = input;

  // Staff: full access + unlimited energy (QA, support, content verification).
  if (isStaffRole(user.role)) {
    return {
      hasAccess: true,
      tier: "course_ai_pro",
      source: "staff",
      isStaff: true,
      features: featuresForTier("course_ai_pro"),
      energy: { ...NO_ENERGY, unlimited: true },
    };
  }

  // Superadmin-set override wins over subscription/beta resolution. Used for
  // support, comps and (currently) QA of the 4-package gating. Energy follows
  // the overridden tier's rules (still limited – never unlimited for learners).
  // Legacy override values (buddy/basic/full) are normalized to canonical IDs.
  const overrideRaw = user.featureTierOverride as RawFeatureTier | undefined;
  const override = normalizeFeatureTier(overrideRaw ?? null);
  if (override) {
    return {
      hasAccess: true,
      tier: override,
      source: "override",
      isStaff: false,
      features: featuresForTier(override),
      energy: resolveEnergy(override, activeSub, energyQuotas),
    };
  }

  // Payment failed on an installment plan → access paused entirely
  // (mirrors convex/subscriptions.ts getAccessibleUnits behavior).
  if (pastDueSub) {
    return noAccess("past_due");
  }

  // Active PAID subscription → use its featureTier; legacy subs without the
  // field are grandfathered to "course_ai_pro" so nobody loses functionality
  // on deploy (Zero-Migration). Legacy tier values (buddy/basic/full) are
  // normalized to canonical IDs before use.
  if (activeSub && activeSub.planType !== "beta") {
    const rawTier = activeSub.featureTier as RawFeatureTier | undefined;
    const tier: FeatureTier = normalizeFeatureTier(rawTier ?? null) ?? "course_ai_pro";
    return {
      hasAccess: true,
      tier,
      source: "subscription",
      isStaff: false,
      features: featuresForTier(tier),
      energy: resolveEnergy(tier, activeSub, energyQuotas),
    };
  }

  // Beta testers (virtual beta sub or flag): full features, but LIMITED energy.
  // Only while the global beta phase is active. Once a superadmin ends the beta
  // phase, beta status no longer grants access – users need a package/override.
  // Beta quota is intentionally low (DEFAULT_BETA_ENERGY_QUOTA) to contain costs
  // while giving testers a representative sample of the AI Buddy experience.
  if (betaPhaseActive && (activeSub?.planType === "beta" || user.isBetaTester === true)) {
    const betaEnergy = activeSub
      ? resolveEnergy("course_ai_pro", activeSub, energyQuotas)
      : resolveBetaEnergy();
    return {
      hasAccess: true,
      tier: "course_ai_pro",
      source: "beta",
      isStaff: false,
      features: featuresForTier("course_ai_pro"),
      energy: betaEnergy,
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
  const betaPhaseActive = await loadBetaPhaseActive(ctx);
  const energyCfg = await loadEnergyConfig(ctx);
  return resolveFeatureAccess({
    user,
    activeSub,
    pastDueSub,
    betaPhaseActive,
    energyQuotas: energyCfg.quotas,
  });
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
    const betaPhaseActive = await loadBetaPhaseActive(ctx);
    const energyCfg = await loadEnergyConfig(ctx);
    return resolveFeatureAccess({
      user,
      activeSub,
      pastDueSub,
      betaPhaseActive,
      energyQuotas: energyCfg.quotas,
    });
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

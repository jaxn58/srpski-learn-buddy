/**
 * Core User & Subscription Tables
 *
 * Central user identity, progress tracking, and billing.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const coreTables = {
  // ============= CORE USER TABLE =============
  users: defineTable({
    clerkId: v.string(), // Clerk user ID (primary identifier)
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    loginMethod: v.optional(v.string()),
    role: v.union(v.literal("superadmin"), v.literal("admin"), v.literal("student")),
    // Multi-language support: User's chosen learning language (optional for backward compatibility)
    learningLanguage: v.optional(v.union(
      v.literal("en"), // English → Serbian
      v.literal("de"), // Deutsch → Serbisch
      v.literal("es"), // Español → Serbio (future)
      v.literal("fr")  // Français → Serbe (future)
    )),
    isActive: v.boolean(),
    isBetaTester: v.boolean(),
    // Gamification fields
    totalXP: v.number(),
    level: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDate: v.optional(v.number()), // timestamp

    // Public profile (for Leaderboard)
    publicNickname: v.optional(v.string()),
    publicAvatarUrl: v.optional(v.string()),
    // Convex Storage ID (preferred for uploads; URLs expire)
    publicAvatarStorageId: v.optional(v.string()),
    // Leaderboard opt-in wish; new users get true on insert; undefined legacy = off
    leaderboardPublicEnabled: v.optional(v.boolean()),

    // ===== Billing =====
    // Tracks one-time 50% beta discount usage after beta ends.
    // If set, the user already consumed the beta discount.
    betaDiscountUsedAt: v.optional(v.number()), // timestamp

    // ===== Feature tier override (support / QA / comp) =====
    // Superadmin-set override that forces a specific feature package regardless
    // of the user's subscription. Highest precedence after staff roles in
    // convex/featureAccess.ts. Optional → undefined means "no override".
    // Primary use today: testing the 4-package gating before tier-specific
    // billing products exist (all real users are otherwise full/beta/staff).
    //
    // The new canonical tier names are: course | standalone | course_ai | course_ai_pro.
    // The legacy names (buddy | basic | full) are kept in the union for
    // zero-migration of existing override records and are normalized in
    // convex/featureAccess.ts (buddy → standalone, basic → course_ai, full → course_ai_pro).
    featureTierOverride: v.optional(v.union(
      v.literal("course"),
      v.literal("standalone"),    // NEW: AI Chat Standalone (was "buddy")
      v.literal("course_ai"),     // NEW: Sprachkurs + AI (was "basic")
      v.literal("course_ai_pro"), // NEW: Sprachkurs + AI Pro (was "full")
      // Legacy aliases (kept for backward compatibility, normalized at read-time)
      v.literal("buddy"),
      v.literal("basic"),
      v.literal("full")
    )),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_language", ["learningLanguage"]), // NEW: Query users by language

  // ============= USER PROGRESS =============
  userProgress: defineTable({
    userId: v.id("users"),
    currentUnit: v.number(),
    completedUnits: v.array(v.number()), // Array of completed unit numbers
    learningDuration: v.number(), // Duration in weeks: 12, 24, 36, 48
    uiLanguage: v.string(), // always "en"
    lastActivityAt: v.optional(v.number()), // last activity timestamp
  }).index("by_user", ["userId"]),

  // ============= USER SUBSCRIPTIONS =============
  userSubscriptions: defineTable({
    userId: v.id("users"),
    planType: v.union(
      v.literal("beta"),
      // ===== Legacy plan IDs (kept for zero-migration – may exist in production) =====
      // Old 4-duration single-tier model
      v.literal("intensive"),
      v.literal("balanced"),
      v.literal("standard"),
      v.literal("relaxed"),
      // First 4-tier × 3-duration iteration (kept for any Beta/QA data)
      v.literal("buddy_3m"),
      v.literal("buddy_6m"),
      v.literal("buddy_12m"),
      v.literal("basic_3m"),
      v.literal("basic_6m"),
      v.literal("basic_12m"),
      v.literal("full_3m"),
      v.literal("full_6m"),
      v.literal("full_12m"),
      // ===== New canonical compound IDs: <tier>_<duration> (Phase 5) =====
      // Three durations across all tiers: 3 / 6 / 12 months
      // Course tier (Sprachkurs) – prepaid-only
      v.literal("course_3m"),
      v.literal("course_6m"),
      v.literal("course_12m"),
      // Standalone tier (AI Chat Standalone)
      v.literal("standalone_3m"),
      v.literal("standalone_6m"),
      v.literal("standalone_12m"),
      // Course + AI tier (Sprachkurs + AI)
      v.literal("course_ai_3m"),
      v.literal("course_ai_6m"),
      v.literal("course_ai_12m"),
      // Course + AI Pro tier (Sprachkurs + AI Pro)
      v.literal("course_ai_pro_3m"),
      v.literal("course_ai_pro_6m"),
      v.literal("course_ai_pro_12m")
    ),
    planDurationMonths: v.number(), // 3, 6, or 12
    planPrice: v.number(), // in cents (e.g., 6900 = €69.00)
    expiresAt: v.number(), // timestamp
    status: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    autoRenew: v.boolean(),
    cancelledAt: v.optional(v.number()),
    maxAccessibleUnits: v.optional(v.number()), // Max units accessible (e.g., 5 for beta, 27 for full)

    // Payment metadata (optional for backwards compatibility)
    paymentMode: v.optional(v.union(v.literal("prepaid"), v.literal("installments"))),
    // Billing provider identifier (optional for backwards compatibility).
    // Keep this as a free-form string to avoid schema breaks on legacy records.
    billingProvider: v.optional(v.string()),
    // Unified subscription id for the active billing provider (e.g., Dodo subscription_id)
    providerSubscriptionId: v.optional(v.string()),
    // Set once we've requested provider-side cancellation (fixed-term subscriptions).
    providerCancelRequestedAt: v.optional(v.number()),
    // Installments tracking (only for paymentMode="installments")
    installmentsTotalMonths: v.optional(v.number()),
    installmentsPaidMonths: v.optional(v.number()),
    installmentMonthlyPrice: v.optional(v.number()), // in cents
    pausedAt: v.optional(v.number()),
    installmentsCompletedAt: v.optional(v.number()),

    // ===== Feature tier (2-axis model: package × duration) =====
    // Which feature package this subscription grants. Optional for backward
    // compatibility: existing/legacy subscriptions without this field are
    // resolved to course_ai_pro feature access (Zero-Migration), see
    // convex/featureAccess.ts.
    //
    // The new canonical tier names are: course | standalone | course_ai | course_ai_pro.
    // The legacy names (buddy | basic | full) are kept in the union for
    // zero-migration of existing subscription records and are normalized in
    // convex/featureAccess.ts (buddy → standalone, basic → course_ai, full → course_ai_pro).
    featureTier: v.optional(v.union(
      // New canonical tier IDs
      v.literal("course"),         // Sprachkurs – learning content only, no AI
      v.literal("standalone"),     // AI Chat Standalone – AI Buddy + documents, no learning
      v.literal("course_ai"),      // Sprachkurs + AI – learning + AI Buddy with context linking
      v.literal("course_ai_pro"),  // Sprachkurs + AI Pro – everything (learning, AI, documents, community)
      // Legacy aliases (kept for backward compatibility, normalized at read-time)
      v.literal("buddy"),  // → standalone
      v.literal("basic"),  // → course_ai
      v.literal("full")    // → course_ai_pro
    )),

    // ===== AI Energy (consumption-based buddy credits) =====
    // All optional → Zero-Migration. Subscriptions without these fields fall back
    // to the tier default quota (see DEFAULT_TIER_ENERGY_QUOTA in featureAccess.ts).
    // Energy is NOT unlimited for learners; only staff (admin/superadmin) are unlimited.
    energyQuotaMonthly: v.optional(v.number()),   // inclusive monthly quota (energy units)
    energyUsedThisPeriod: v.optional(v.number()), // energy consumed in the current period
    energyTopUpBalance: v.optional(v.number()),   // purchased, non-expiring energy balance
    /** Outstanding energy debt from a single overdraft action (cleared on top-up). */
    energyDebtBalance: v.optional(v.number()),
    energyPeriodResetAt: v.optional(v.number()),  // timestamp of the next monthly reset
  }).index("by_user", ["userId"]),

  // ============= SUBSCRIPTION HISTORY =============
  subscriptionHistory: defineTable({
    userId: v.id("users"),
    action: v.union(
      v.literal("purchased"),
      v.literal("upgraded"),
      v.literal("downgraded"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("renewed"),
      v.literal("payment_failed"),
      v.literal("payment_succeeded")
    ),
    previousPlanType: v.optional(v.string()),
    newPlanType: v.optional(v.string()),
    previousExpiresAt: v.optional(v.number()),
    newExpiresAt: v.optional(v.number()),
    cost: v.optional(v.number()), // in cents
    notes: v.optional(v.string()),
  }).index("by_user", ["userId"]),
};

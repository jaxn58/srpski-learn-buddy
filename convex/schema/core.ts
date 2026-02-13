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
    // Privacy guardrail: default OFF (treat undefined as false)
    leaderboardPublicEnabled: v.optional(v.boolean()),

    // ===== Billing =====
    // Tracks one-time 50% beta discount usage after beta ends.
    // If set, the user already consumed the beta discount.
    betaDiscountUsedAt: v.optional(v.number()), // timestamp
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
      v.literal("intensive"),
      v.literal("balanced"),
      v.literal("standard"),
      v.literal("relaxed")
    ),
    planDurationMonths: v.number(), // 3, 6, 9, or 12
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

import { v } from "convex/values";
import { mutation, query, action, QueryCtx, MutationCtx, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

// Subscription plans
const SUBSCRIPTION_PLANS = [
  // NOTE: Prices are in cents (EUR).
  { id: "beta", name: "Beta Access", months: 0, price: 0, unitsPerWeek: 0 },
  { id: "intensive", name: "Intensive", months: 3, price: 6900, unitsPerWeek: 3 },
  { id: "balanced", name: "Balanced", months: 6, price: 7900, unitsPerWeek: 2 },
  { id: "standard", name: "Standard", months: 9, price: 9500, unitsPerWeek: 1.5 },
  { id: "relaxed", name: "Relaxed", months: 12, price: 11900, unitsPerWeek: 1 },
];

type PaidPlanId = "intensive" | "balanced" | "standard" | "relaxed";

function charmRoundUpTo99Cents(rawMonthlyCents: number): number {
  // Round up to the next *.99 EUR boundary (e.g. 1448.33 -> 1499).
  // Ensures monthlyCharge*months is >= raw target, which keeps pay-once attractive.
  const eurosFloor = Math.floor(rawMonthlyCents / 100);
  let candidate = eurosFloor * 100 + 99;
  if (candidate < Math.ceil(rawMonthlyCents)) {
    candidate = (eurosFloor + 1) * 100 + 99;
  }
  return candidate;
}

function getInstallmentMonthlyChargeCents(planType: PaidPlanId): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  if (!plan || !plan.months) return 0;
  const monthlyTotal = Math.round(plan.price * 1.1);
  const rawMonthly = monthlyTotal / plan.months;
  return charmRoundUpTo99Cents(rawMonthly);
}

function getInstallmentTotalCents(planType: PaidPlanId): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  if (!plan || !plan.months) return 0;
  const monthly = getInstallmentMonthlyChargeCents(planType);
  return monthly * plan.months;
}

// Get accessible units for current user based on subscription
export const getAccessibleUnits = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { maxUnits: 0, isBeta: false };

    // Admins/Superadmins always have full access (e.g., for QA and content verification).
    if (user.role === "admin" || user.role === "superadmin") {
      return { maxUnits: 27, isBeta: false };
    }

    // Check for active subscription first
    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    const pastDueSub = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "past_due"))
      .first();

    // If a payment failed for an installment plan, we pause access completely (even for beta testers).
    if (pastDueSub) {
      return { maxUnits: 0, isBeta: false };
    }

    if (subscription?.maxAccessibleUnits) {
      return {
        maxUnits: subscription.maxAccessibleUnits,
        isBeta: subscription.planType === "beta",
      };
    }

    // Fallback: Check Beta Tester Flag (for backwards compatibility)
    // Beta testers have access to the first 3 units of Module 1
    if (user.isBetaTester) {
      return { maxUnits: 3, isBeta: true };
    }

    // Check if they have any paid subscription (full access to all 27 units)
    if (subscription && subscription.planType !== "beta") {
      return { maxUnits: 27, isBeta: false };
    }

    // Default: no access
    return { maxUnits: 0, isBeta: false };
  },
});

// Get user's current subscription (alias for getUserSubscription)
export const getCurrent = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Virtual Beta Subscription for Beta Testers without subscription
    // Beta testers have access to the first 3 units of Module 1
    if (!subscription && user.isBetaTester) {
      return {
        planType: "beta" as const,
        planName: "Beta Access",
        maxAccessibleUnits: 3,
        status: "active" as const,
        expiresAt: null,
        planDurationMonths: 0,
        planPrice: 0,
        autoRenew: false,
        virtual: true,
      };
    }

    if (!subscription) return null;

    // Add plan name for display
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.planType);
    return {
      ...subscription,
      plan: subscription.planType,
      planName: plan?.name || subscription.planType,
      endsAt: subscription.expiresAt,
    };
  },
});

// Get days remaining in subscription
export const getDaysRemaining = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!subscription || !subscription.expiresAt) return 0;

    const now = Date.now();
    const daysRemaining = Math.max(0, Math.ceil((subscription.expiresAt - now) / (1000 * 60 * 60 * 24)));
    return daysRemaining;
  },
});

// Get available plans
export const getPlans = query({
  handler: async () => {
    return SUBSCRIPTION_PLANS.map((p) => {
      if (p.id === "beta") return { ...p, paymentOptions: { prepaidTotal: 0 } };
      const planType = p.id as PaidPlanId;
      const monthly = getInstallmentMonthlyChargeCents(planType);
      const total = getInstallmentTotalCents(planType);
      return {
        ...p,
        paymentOptions: {
          prepaidTotal: p.price,
          installmentsMonthly: monthly,
          installmentsTotal: total,
          installmentsUpliftPercent: 10,
        },
      };
    });
  },
});

// Beta discount status for the current user (computed server-side using BETA_END_DATE)
export const getBetaDiscountStatus = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { betaEnded: false, eligible: false, usedAt: null as number | null };
    }

    const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
    const betaEnded = Number.isFinite(betaEndTs) ? Date.now() > betaEndTs : false;
    const usedAt = user.betaDiscountUsedAt ?? null;
    const eligible = betaEnded && user.isBetaTester === true && usedAt === null;

    return { betaEnded, eligible, usedAt };
  },
});

export const getPaddleCheckoutConfig = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const environment =
      (process.env.PADDLE_ENVIRONMENT || process.env.VITE_PADDLE_ENVIRONMENT || "").trim() === "production"
        ? ("production" as const)
        : ("sandbox" as const);

    // Client token is safe to expose to authenticated clients (similar to a publishable key).
    const clientToken = (process.env.PADDLE_CLIENT_TOKEN || "").trim();

    const normal = {
      intensive: (process.env.PADDLE_PRODUCT_INTENSIVE || "").trim(),
      balanced: (process.env.PADDLE_PRODUCT_BALANCED || "").trim(),
      standard: (process.env.PADDLE_PRODUCT_STANDARD || "").trim(),
      relaxed: (process.env.PADDLE_PRODUCT_RELAXED || "").trim(),
    } as const;

    const installments = {
      intensive: (process.env.PADDLE_PRODUCT_INTENSIVE_MONTHLY || "").trim(),
      balanced: (process.env.PADDLE_PRODUCT_BALANCED_MONTHLY || "").trim(),
      standard: (process.env.PADDLE_PRODUCT_STANDARD_MONTHLY || "").trim(),
      relaxed: (process.env.PADDLE_PRODUCT_RELAXED_MONTHLY || "").trim(),
    } as const;

    // IMPORTANT:
    // Do NOT expose beta50 price IDs to ineligible users. Otherwise they could purchase a discounted price,
    // get charged, and then be denied access by server-side enforcement.
    const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
    const betaEnded = Number.isFinite(betaEndTs) ? Date.now() > betaEndTs : false;
    const betaEligible =
      user?.isBetaTester === true && betaEnded && (user.betaDiscountUsedAt ?? null) === null;

    const beta50 = betaEligible
      ? ({
          intensive: (process.env.PADDLE_PRODUCT_INTENSIVE_BETA50 || "").trim(),
          balanced: (process.env.PADDLE_PRODUCT_BALANCED_BETA50 || "").trim(),
          standard: (process.env.PADDLE_PRODUCT_STANDARD_BETA50 || "").trim(),
          relaxed: (process.env.PADDLE_PRODUCT_RELAXED_BETA50 || "").trim(),
        } as const)
      : ({
          intensive: "",
          balanced: "",
          standard: "",
          relaxed: "",
        } as const);

    return {
      environment,
      clientTokenConfigured: clientToken.length > 0,
      clientToken,
      priceIds: {
        normal,
        installments,
        beta50,
      },
      beta50Eligible: betaEligible,
    };
  },
});

// Calculate upgrade cost
export const calculateUpgradeCost = mutation({
  args: {
    currentPlan: v.string(),
    newPlan: v.string(),
  },
  handler: async (ctx, { currentPlan, newPlan }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const currentPlanInfo = SUBSCRIPTION_PLANS.find(p => p.id === currentPlan);
    const newPlanInfo = SUBSCRIPTION_PLANS.find(p => p.id === newPlan);

    if (!currentPlanInfo || !newPlanInfo) {
      throw new Error("Invalid plan");
    }

    // Simple pro-rated calculation
    const cost = Math.max(0, newPlanInfo.price - currentPlanInfo.price);
    return { cost, newPlan: newPlanInfo };
  },
});

// Cancel subscription
export const cancel = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!subscription) throw new Error("No subscription found");

    await ctx.db.patch(subscription._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "cancelled",
      previousPlanType: subscription.planType,
    });

    return { success: true };
  },
});

// Get analytics (admin only)
export const getAnalytics = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return null;
    }

    const allSubscriptions = await ctx.db.query("userSubscriptions").collect();
    const allHistory = await ctx.db.query("subscriptionHistory").collect();
    const allUsers = await ctx.db.query("users").collect();

    const activeCount = allSubscriptions.filter(s => s.status === "active").length;
    const cancelledCount = allSubscriptions.filter(s => s.status === "cancelled").length;
    // Monetary values are stored in cents.
    const totalRevenue = allHistory
      .filter(h => h.cost)
      .reduce((sum, h) => sum + (h.cost || 0), 0);

    // Calculate MRR (Monthly Recurring Revenue) from active subscriptions
    const mrr = allSubscriptions
      .filter(s => s.status === "active")
      .reduce((sum, s) => {
        // Monthly recurring revenue in cents.
        const monthlyPriceCents = Math.round(s.planPrice / s.planDurationMonths);
        return sum + monthlyPriceCents;
      }, 0);

    // Calculate churn rate (cancelled / total)
    const totalSubs = allSubscriptions.length;
    const churnRate = totalSubs > 0 ? (cancelledCount / totalSubs) * 100 : 0;

    // Calculate conversion rate (upgrades / total users)
    const upgradeCount = allHistory.filter(h => h.action === "upgraded" || h.action === "purchased").length;
    const totalUsers = allUsers.length;
    const conversionRate = totalUsers > 0 ? (upgradeCount / totalUsers) * 100 : 0;

    // Revenue by plan type (in cents)
    const revenueByPlan = {
      intensive: allHistory
        .filter(h => h.newPlanType === "intensive" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0), 0),
      balanced: allHistory
        .filter(h => h.newPlanType === "balanced" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0), 0),
      standard: allHistory
        .filter(h => h.newPlanType === "standard" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0), 0),
      relaxed: allHistory
        .filter(h => h.newPlanType === "relaxed" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0), 0),
    };

    // Count by plan type
    const planCounts: Record<string, number> = {};
    allSubscriptions.forEach(sub => {
      planCounts[sub.planType] = (planCounts[sub.planType] || 0) + 1;
    });

    // Count active users by plan type
    const usersByPlan = {
      intensive: allSubscriptions.filter(s => s.status === "active" && s.planType === "intensive").length,
      balanced: allSubscriptions.filter(s => s.status === "active" && s.planType === "balanced").length,
      standard: allSubscriptions.filter(s => s.status === "active" && s.planType === "standard").length,
      relaxed: allSubscriptions.filter(s => s.status === "active" && s.planType === "relaxed").length,
    };

    return {
      totalSubscriptions: allSubscriptions.length,
      activeSubscriptions: activeCount,
      cancelledSubscriptions: cancelledCount,
      totalRevenue,
      planBreakdown: planCounts,
      recentHistory: allHistory.slice(0, 20),
      // Additional fields for frontend
      mrr,
      churnRate,
      conversionRate,
      upgradeCount,
      totalUsers,
      activeUsers: allUsers.filter(u => u.isActive).length,
      revenueByPlan,
      usersByPlan,
    };
  },
});

// Get user's subscription (original function kept for compatibility)
export const getUserSubscription = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
  },
});

// Create/update subscription
export const createSubscription = mutation({
  args: {
    planType: v.union(
      v.literal("intensive"),
      v.literal("balanced"),
      v.literal("standard"),
      v.literal("relaxed")
    ),
    planDurationMonths: v.number(),
    planPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const expiresAt = Date.now() + args.planDurationMonths * 30 * 24 * 60 * 60 * 1000;

    // Check if subscription exists
    const existing = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      // Record history
      await ctx.db.insert("subscriptionHistory", {
        userId: user._id,
        action: "upgraded",
        previousPlanType: existing.planType,
        newPlanType: args.planType,
        previousExpiresAt: existing.expiresAt,
        newExpiresAt: expiresAt,
        cost: args.planPrice,
      });

      // Update subscription
      await ctx.db.patch(existing._id, {
        planType: args.planType,
        planDurationMonths: args.planDurationMonths,
        planPrice: args.planPrice,
        expiresAt,
        status: "active",
      });

      return existing._id;
    }

    // Create new subscription
    const subId = await ctx.db.insert("userSubscriptions", {
      userId: user._id,
      planType: args.planType,
      planDurationMonths: args.planDurationMonths,
      planPrice: args.planPrice,
      expiresAt,
      status: "active",
      autoRenew: false,
    });

    // Record history
    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "purchased",
      newPlanType: args.planType,
      newExpiresAt: expiresAt,
      cost: args.planPrice,
    });

    return subId;
  },
});

// Cancel subscription
export const cancelSubscription = mutation({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!subscription) throw new Error("No subscription found");

    await ctx.db.patch(subscription._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "cancelled",
      previousPlanType: subscription.planType,
    });
  },
});

// Get subscription history
export const getHistory = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("subscriptionHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

// Get all subscriptions (admin only)
export const getAllSubscriptions = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.query("userSubscriptions").collect();
  },
});

// Toggle auto-renew
export const toggleAutoRenew = mutation({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!subscription) throw new Error("No subscription found");

    await ctx.db.patch(subscription._id, {
      autoRenew: !subscription.autoRenew,
    });

    return !subscription.autoRenew;
  },
});

function parseMoneyToCents(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.round(input * 100);
  }
  if (typeof input === "string") {
    const n = Number.parseFloat(input);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }
  return null;
}

function getPlanPriceCentsFromConfig(args: { planType: string; isBeta50: boolean }): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === args.planType);
  if (!plan) return 0;
  if (!args.isBeta50) return plan.price;
  return Math.round(plan.price / 2);
}

function getPaddlePriceMapFromEnv() {
  const normal = {
    intensive: (process.env.PADDLE_PRODUCT_INTENSIVE || "").trim(),
    balanced: (process.env.PADDLE_PRODUCT_BALANCED || "").trim(),
    standard: (process.env.PADDLE_PRODUCT_STANDARD || "").trim(),
    relaxed: (process.env.PADDLE_PRODUCT_RELAXED || "").trim(),
  } as const;

  const installments = {
    intensive: (process.env.PADDLE_PRODUCT_INTENSIVE_MONTHLY || "").trim(),
    balanced: (process.env.PADDLE_PRODUCT_BALANCED_MONTHLY || "").trim(),
    standard: (process.env.PADDLE_PRODUCT_STANDARD_MONTHLY || "").trim(),
    relaxed: (process.env.PADDLE_PRODUCT_RELAXED_MONTHLY || "").trim(),
  } as const;

  const beta50 = {
    intensive: (process.env.PADDLE_PRODUCT_INTENSIVE_BETA50 || "").trim(),
    balanced: (process.env.PADDLE_PRODUCT_BALANCED_BETA50 || "").trim(),
    standard: (process.env.PADDLE_PRODUCT_STANDARD_BETA50 || "").trim(),
    relaxed: (process.env.PADDLE_PRODUCT_RELAXED_BETA50 || "").trim(),
  } as const;

  const monthsByPlan = {
    intensive: 3,
    balanced: 6,
    standard: 9,
    relaxed: 12,
  } as const;

  const map = new Map<
    string,
    {
      planType: keyof typeof monthsByPlan;
      planDurationMonths: number;
      isBeta50: boolean;
      paymentMode: "prepaid" | "installments";
    }
  >();

  for (const plan of Object.keys(monthsByPlan) as Array<keyof typeof monthsByPlan>) {
    if (normal[plan]) {
      map.set(normal[plan], {
        planType: plan,
        planDurationMonths: monthsByPlan[plan],
        isBeta50: false,
        paymentMode: "prepaid",
      });
    }
    if (beta50[plan]) {
      map.set(beta50[plan], {
        planType: plan,
        planDurationMonths: monthsByPlan[plan],
        isBeta50: true,
        paymentMode: "prepaid",
      });
    }
    if (installments[plan]) {
      map.set(installments[plan], {
        planType: plan,
        planDurationMonths: monthsByPlan[plan],
        isBeta50: false,
        paymentMode: "installments",
      });
    }
  }

  return map;
}

// ===== Paddle webhook helpers (internal) =====
// Applies a prepaid Paddle purchase to our subscription tables.
export const internalApplyPaddlePrepaidPurchase = internalMutation({
  args: {
    paddleEventId: v.string(),
    clerkId: v.string(),
    planType: v.union(
      v.literal("intensive"),
      v.literal("balanced"),
      v.literal("standard"),
      v.literal("relaxed")
    ),
    planDurationMonths: v.number(),
    planPriceCents: v.number(),
    priceId: v.string(),
    transactionId: v.optional(v.string()),
    isBeta50: v.boolean(),
    paymentMode: v.optional(v.union(v.literal("prepaid"), v.literal("installments"))),
    paddleSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) {
      throw new Error(`User not found for clerkId=${args.clerkId}`);
    }

    // Enforce one-time beta discount usage (no expiry), only after beta ends.
    if (args.isBeta50) {
      const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
      const betaEnded = Number.isFinite(betaEndTs) ? now > betaEndTs : false;

      if (!betaEnded) {
        throw new Error("beta_discount_not_active");
      }
      if (user.isBetaTester !== true) {
        throw new Error("beta_discount_not_eligible");
      }
      if (user.betaDiscountUsedAt !== undefined) {
        throw new Error("beta_discount_already_used");
      }

      await ctx.db.patch(user._id, { betaDiscountUsedAt: now });
    }

    const existing = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const baseStart = existing?.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
    const expiresAt = baseStart + args.planDurationMonths * 30 * 24 * 60 * 60 * 1000;

    const maxAccessibleUnits = 27;

    const paymentMode = (args.paymentMode || "prepaid") as "prepaid" | "installments";
    const installmentMonthlyPrice =
      paymentMode === "installments" ? getInstallmentMonthlyChargeCents(args.planType) : undefined;
    const installmentsTotalMonths = paymentMode === "installments" ? args.planDurationMonths : undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        planType: args.planType,
        planDurationMonths: args.planDurationMonths,
        planPrice: args.planPriceCents,
        expiresAt,
        status: "active",
        autoRenew: false,
        cancelledAt: undefined,
        maxAccessibleUnits,
        paymentMode,
        paddleSubscriptionId: args.paddleSubscriptionId,
        installmentsTotalMonths,
        installmentsPaidMonths: paymentMode === "installments" ? 1 : undefined,
        installmentMonthlyPrice,
        pausedAt: undefined,
      });

      await ctx.db.insert("subscriptionHistory", {
        userId: user._id,
        action: existing.planType === args.planType ? "renewed" : "upgraded",
        previousPlanType: existing.planType,
        newPlanType: args.planType,
        previousExpiresAt: existing.expiresAt,
        newExpiresAt: expiresAt,
        // For installments we record revenue per successful charge.
        cost: paymentMode === "installments" ? installmentMonthlyPrice : args.planPriceCents,
        notes: `paddle_event:${args.paddleEventId}${args.transactionId ? ` tx:${args.transactionId}` : ""}`,
      });

      return { subscriptionId: existing._id, userId: user._id };
    }

    const subscriptionId = await ctx.db.insert("userSubscriptions", {
      userId: user._id,
      planType: args.planType,
      planDurationMonths: args.planDurationMonths,
      planPrice: args.planPriceCents,
      expiresAt,
      status: "active",
      autoRenew: false,
      maxAccessibleUnits,
      paymentMode,
      paddleSubscriptionId: args.paddleSubscriptionId,
      installmentsTotalMonths,
      installmentsPaidMonths: paymentMode === "installments" ? 1 : undefined,
      installmentMonthlyPrice,
    });

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "purchased",
      newPlanType: args.planType,
      newExpiresAt: expiresAt,
      cost: paymentMode === "installments" ? installmentMonthlyPrice : args.planPriceCents,
      notes: `paddle_event:${args.paddleEventId}${args.transactionId ? ` tx:${args.transactionId}` : ""}`,
    });

    return { subscriptionId, userId: user._id };
  },
});

async function applyInstallmentRenewal(ctx: MutationCtx, args: { paddleEventId: string; subscriptionId: string }) {
  const now = Date.now();
  const sub = await ctx.db
    .query("userSubscriptions")
    .filter((q) => q.eq(q.field("paddleSubscriptionId"), args.subscriptionId))
    .first();
  if (!sub) return;

  const totalMonths = (sub.installmentsTotalMonths ?? sub.planDurationMonths) || 0;
  const paidMonths = (sub.installmentsPaidMonths ?? 0) + 1;
  const monthlyPrice = sub.installmentMonthlyPrice ?? 0;

  await ctx.db.patch(sub._id, {
    status: "active",
    installmentsPaidMonths: paidMonths,
    pausedAt: undefined,
  });

  await ctx.db.insert("subscriptionHistory", {
    userId: sub.userId,
    action: "renewed",
    previousPlanType: sub.planType,
    newPlanType: sub.planType,
    previousExpiresAt: sub.expiresAt,
    newExpiresAt: sub.expiresAt,
    cost: monthlyPrice,
    notes: `paddle_event:${args.paddleEventId} installments_charge:${paidMonths}/${totalMonths}`,
  });

  if (totalMonths > 0 && paidMonths >= totalMonths) {
    await ctx.db.patch(sub._id, { installmentsCompletedAt: now });
  }
}

async function pauseAccessForFailedInstallment(ctx: MutationCtx, args: { paddleEventId: string; subscriptionId: string }) {
  const now = Date.now();
  const sub = await ctx.db
    .query("userSubscriptions")
    .filter((q) => q.eq(q.field("paddleSubscriptionId"), args.subscriptionId))
    .first();
  if (!sub) return;

  await ctx.db.patch(sub._id, {
    status: "past_due",
    pausedAt: now,
  });

  await ctx.db.insert("subscriptionHistory", {
    userId: sub.userId,
    action: "payment_failed",
    previousPlanType: sub.planType,
    newPlanType: sub.planType,
    cost: undefined,
    notes: `paddle_event:${args.paddleEventId} installments_payment_failed`,
  });
}

export const internalListInstallmentsToCancel = internalQuery({
  handler: async (ctx) => {
    // Cancel subscriptions that reached their fixed term and haven't been cancelled in Paddle yet.
    const subs = await ctx.db
      .query("userSubscriptions")
      .filter((q) => q.eq(q.field("paymentMode"), "installments"))
      .collect();

    return subs
      .filter((s) => {
        if (s.paddleCancelRequestedAt !== undefined) return false;
        if (s.installmentsCompletedAt === undefined) return false;
        const total = s.installmentsTotalMonths ?? s.planDurationMonths;
        const paid = s.installmentsPaidMonths ?? 0;
        return total > 0 && paid >= total && typeof s.paddleSubscriptionId === "string" && s.paddleSubscriptionId.length > 0;
      })
      .map((s) => ({ id: s._id, paddleSubscriptionId: s.paddleSubscriptionId as string }));
  },
});

export const internalMarkPaddleCancelRequested = internalMutation({
  args: { id: v.id("userSubscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { paddleCancelRequestedAt: Date.now() });
  },
});

export const processInstallmentCancellations = internalAction({
  handler: async (ctx) => {
    const apiKey = (process.env.PADDLE_API_KEY || "").trim();
    if (!apiKey) {
      console.warn("[Paddle] PADDLE_API_KEY not configured; skipping installment cancellations.");
      return { attempted: 0, cancelled: 0 };
    }

    const environment =
      (process.env.PADDLE_ENVIRONMENT || process.env.VITE_PADDLE_ENVIRONMENT || "").trim() === "production"
        ? "production"
        : "sandbox";
    const baseUrl = environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

    const toCancel = await ctx.runQuery(internal.subscriptions.internalListInstallmentsToCancel);
    let cancelled = 0;

    for (const item of toCancel) {
      try {
        await fetch(`${baseUrl}/subscriptions/${encodeURIComponent(item.paddleSubscriptionId)}/cancel`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ effective_from: "next_billing_period" }),
        });

        await ctx.runMutation(internal.subscriptions.internalMarkPaddleCancelRequested, { id: item.id });
        cancelled += 1;
      } catch (err) {
        console.warn("[Paddle] Failed to cancel subscription", { paddleSubscriptionId: item.paddleSubscriptionId, err });
      }
    }

    return { attempted: toCancel.length, cancelled };
  },
});

// Receives a verified Paddle webhook payload and applies side effects in an idempotent way.
export const internalProcessPaddleWebhook = internalMutation({
  args: {
    rawBody: v.string(),
    receivedAt: v.number(),
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
  },
  handler: async (ctx, args) => {
    let evt: any;
    try {
      evt = JSON.parse(args.rawBody);
    } catch {
      throw new Error("invalid_json");
    }

    const eventId: string =
      evt?.event_id ?? evt?.eventId ?? evt?.id ?? evt?.notification_id ?? evt?.notificationId ?? "";
    const eventType: string = evt?.event_type ?? evt?.eventType ?? evt?.type ?? "";

    if (!eventId || !eventType) {
      throw new Error("missing_event_id_or_type");
    }

    const already = await ctx.db
      .query("paddleWebhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
      .first();
    if (already) {
      return { status: "duplicate" as const };
    }

    const occurredAtStr: string | undefined = evt?.occurred_at ?? evt?.occurredAt;
    const occurredAt = occurredAtStr ? Date.parse(occurredAtStr) : undefined;

    // Best-effort extraction (kept denormalized for debugging).
    const data = evt?.data ?? {};
    const transactionId: string | undefined =
      data?.id ?? data?.transaction_id ?? data?.transactionId ?? data?.transaction?.id;
    const subscriptionId: string | undefined =
      data?.subscription_id ??
      data?.subscriptionId ??
      data?.subscription?.id ??
      data?.subscription?.subscription_id ??
      data?.subscription?.subscriptionId;
    const firstItem = Array.isArray(data?.items) ? data.items[0] : undefined;
    const priceId: string | undefined =
      firstItem?.price_id ??
      firstItem?.priceId ??
      firstItem?.price?.id ??
      data?.price_id ??
      data?.priceId ??
      data?.price?.id;
    const customData = data?.custom_data ?? data?.customData ?? {};
    const clerkId: string | undefined =
      customData?.clerkId ??
      customData?.clerk_id ??
      customData?.userId ??
      customData?.user_id ??
      customData?.clerk_user_id;

    const eventDocId = await ctx.db.insert("paddleWebhookEvents", {
      eventId,
      eventType,
      receivedAt: args.receivedAt,
      occurredAt: Number.isFinite(occurredAt) ? occurredAt : undefined,
      processedAt: undefined,
      rawPayload: args.rawBody,
      clerkId,
      priceId,
      transactionId,
      environment: args.environment,
    });

    // Handle installment payment failures: pause access.
    if (eventType.includes("payment_failed") && subscriptionId) {
      await pauseAccessForFailedInstallment(ctx, { paddleEventId: eventId, subscriptionId });
      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    // We only apply access after the payment is finalized.
    if (!eventType.startsWith("transaction.")) {
      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "ignored" as const };
    }

    if (eventType !== "transaction.completed") {
      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "ignored" as const };
    }

    if (!priceId) {
      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "ignored" as const };
    }

    const mapping = getPaddlePriceMapFromEnv().get(priceId);
    if (!mapping) {
      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "ignored" as const };
    }

    if (mapping.paymentMode === "installments") {
      // Initial charge: we require clerkId to provision the subscription.
      // Renewals: we can match by stored paddleSubscriptionId.
      if (subscriptionId) {
        const existingInstallment = await ctx.db
          .query("userSubscriptions")
          .filter((q) => q.eq(q.field("paddleSubscriptionId"), subscriptionId))
          .first();

        if (existingInstallment) {
          await applyInstallmentRenewal(ctx, { paddleEventId: eventId, subscriptionId });
        } else if (clerkId) {
          const planPriceCents = getInstallmentTotalCents(mapping.planType);
          await ctx.runMutation(internal.subscriptions.internalApplyPaddlePrepaidPurchase, {
            paddleEventId: eventId,
            clerkId,
            planType: mapping.planType,
            planDurationMonths: mapping.planDurationMonths,
            planPriceCents,
            priceId,
            transactionId,
            isBeta50: false,
            paymentMode: "installments",
            paddleSubscriptionId: subscriptionId,
          });
        }
      } else if (clerkId) {
        // Fallback: should not happen for recurring prices, but keep deterministic behavior.
        const planPriceCents = getInstallmentTotalCents(mapping.planType);
        await ctx.runMutation(internal.subscriptions.internalApplyPaddlePrepaidPurchase, {
          paddleEventId: eventId,
          clerkId,
          planType: mapping.planType,
          planDurationMonths: mapping.planDurationMonths,
          planPriceCents,
          priceId,
          transactionId,
          isBeta50: false,
          paymentMode: "installments",
          paddleSubscriptionId: undefined,
        });
      }

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    // Prepaid (one-time) purchase flow (supports beta50)
    if (!clerkId) {
      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "ignored" as const };
    }

    // Do not rely on webhook money formatting. Use our configured plan prices instead.
    const planPriceCents = getPlanPriceCentsFromConfig({
      planType: mapping.planType,
      isBeta50: mapping.isBeta50,
    });

    await ctx.runMutation(internal.subscriptions.internalApplyPaddlePrepaidPurchase, {
      paddleEventId: eventId,
      clerkId,
      planType: mapping.planType,
      planDurationMonths: mapping.planDurationMonths,
      planPriceCents,
      priceId,
      transactionId,
      isBeta50: mapping.isBeta50,
      paymentMode: "prepaid",
      paddleSubscriptionId: undefined,
    });

    await ctx.db.patch(eventDocId, { processedAt: Date.now() });
    return { status: "applied" as const };
  },
});

// ===== Server-side helpers for migrations =====

const serverUpsertArgs = {
  clerkId: v.string(),
  planType: v.union(
    v.literal("beta"),
    v.literal("intensive"),
    v.literal("balanced"),
    v.literal("standard"),
    v.literal("relaxed")
  ),
  planDurationMonths: v.number(),
  planPrice: v.number(),
  status: v.union(
    v.literal("active"),
    v.literal("past_due"),
    v.literal("expired"),
    v.literal("cancelled")
  ),
  expiresAt: v.number(),
  autoRenew: v.optional(v.boolean()),
  maxAccessibleUnits: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
};

export const internalUpsertSubscriptionForServer = internalMutation({
  args: serverUpsertArgs,
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error(`User with clerkId ${args.clerkId} not found in Convex.`);
    }

    const existing = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const payload = {
      planType: args.planType,
      planDurationMonths: args.planDurationMonths,
      planPrice: args.planPrice,
      status: args.status,
      expiresAt: args.expiresAt,
      autoRenew: args.autoRenew ?? existing?.autoRenew ?? false,
      maxAccessibleUnits: args.maxAccessibleUnits ?? existing?.maxAccessibleUnits,
      cancelledAt: args.cancelledAt ?? existing?.cancelledAt ?? undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("userSubscriptions", {
      userId: user._id,
      ...payload,
    });
  },
});

export const upsertSubscriptionForServer = action({
  args: {
    serverToken: v.string(),
    ...serverUpsertArgs,
  },
  handler: async (ctx, args): Promise<Id<"userSubscriptions">> => {
    if (!process.env.CONVEX_SERVER_TOKEN || args.serverToken !== process.env.CONVEX_SERVER_TOKEN) {
      throw new Error("Unauthorized server token");
    }

    const { serverToken: _token, ...rest } = args;
    return await ctx.runMutation(internal.subscriptions.internalUpsertSubscriptionForServer, rest);
  },
});

const serverHistoryArgs = {
  clerkId: v.string(),
  action: v.union(
    v.literal("purchased"),
    v.literal("upgraded"),
    v.literal("downgraded"),
    v.literal("cancelled"),
    v.literal("expired"),
    v.literal("renewed")
  ),
  previousPlanType: v.optional(v.string()),
  newPlanType: v.optional(v.string()),
  previousExpiresAt: v.optional(v.number()),
  newExpiresAt: v.optional(v.number()),
  cost: v.optional(v.number()),
  notes: v.optional(v.string()),
  migrationId: v.optional(v.string()),
};

export const internalAddSubscriptionHistoryForServer = internalMutation({
  args: serverHistoryArgs,
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error(`User with clerkId ${args.clerkId} not found in Convex.`);
    }

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: args.action,
      previousPlanType: args.previousPlanType,
      newPlanType: args.newPlanType,
      previousExpiresAt: args.previousExpiresAt ?? undefined,
      newExpiresAt: args.newExpiresAt ?? undefined,
      cost: args.cost ?? undefined,
      notes: args.notes ?? args.migrationId ?? undefined,
    });
  },
});

export const addSubscriptionHistoryForServer = action({
  args: {
    serverToken: v.string(),
    ...serverHistoryArgs,
  },
  handler: async (ctx, args) => {
    if (!process.env.CONVEX_SERVER_TOKEN || args.serverToken !== process.env.CONVEX_SERVER_TOKEN) {
      throw new Error("Unauthorized server token");
    }

    const { serverToken: _token, ...rest } = args;
    await ctx.runMutation(internal.subscriptions.internalAddSubscriptionHistoryForServer, rest);
  },
});


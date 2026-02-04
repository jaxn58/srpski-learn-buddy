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

// Get total number of units from database
async function getTotalUnitsCount(ctx: QueryCtx | MutationCtx): Promise<number> {
  const units = await ctx.db
    .query("unitMetadata")
    .collect();
  
  // Filter by English language and get unique unit numbers
  const englishUnits = units.filter(u => u.language === "en");
  const uniqueUnits = new Set(englishUnits.map(u => u.unitNumber));
  return uniqueUnits.size;
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

// Beta phase policy: during beta, only Unit 1 is accessible for normal users.
const BETA_MAX_UNITS = 1;

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
      const totalUnits = await getTotalUnitsCount(ctx);
      return { maxUnits: totalUnits, isBeta: false };
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
    // Beta testers have access to Unit 1 during beta.
    if (user.isBetaTester) {
      return { maxUnits: BETA_MAX_UNITS, isBeta: true };
    }

    // Check if they have any paid subscription (full access to all units)
    if (subscription && subscription.planType !== "beta") {
      const totalUnits = await getTotalUnitsCount(ctx);
      return { maxUnits: totalUnits, isBeta: false };
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
    // Beta testers have access to Unit 1 during beta.
    if (!subscription && user.isBetaTester) {
      return {
        planType: "beta" as const,
        planName: "Beta Access",
        maxAccessibleUnits: BETA_MAX_UNITS,
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

function getBillingProviderFromEnv(): "dodo" {
  // Only Dodo is supported currently; keep the env var for future flexibility.
  return "dodo";
}

function getDodoEnvironmentFromEnv(): "test_mode" | "live_mode" {
  const raw = (process.env.DODO_PAYMENTS_ENVIRONMENT || "").trim().toLowerCase();
  if (raw === "live_mode" || raw === "live") return "live_mode";
  return "test_mode";
}

export const getBillingProviderConfig = query({
  handler: async () => {
    const provider = getBillingProviderFromEnv();

    const dodoEnv = getDodoEnvironmentFromEnv();
    const dodoApiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    const dodoWebhookKey = (process.env.DODO_PAYMENTS_WEBHOOK_KEY || "").trim();

    return {
      provider,
      dodo: {
        environment: dodoEnv,
        // API key is server-only; expose only whether it exists.
        configured: dodoApiKey.length > 0,
        webhookConfigured: dodoWebhookKey.length > 0,
      },
    };
  },
});

type DodoPlanId = "intensive" | "balanced" | "standard" | "relaxed";
type DodoPaymentMode = "prepaid" | "installments";

function dodoEnvToBaseUrl(env: "test_mode" | "live_mode"): string {
  return env === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

function getDodoProductId(args: { planType: DodoPlanId; paymentMode: DodoPaymentMode }): string {
  const planKey = args.planType.toUpperCase();
  const modeKey = args.paymentMode === "prepaid" ? "PREPAID" : "INSTALLMENTS";
  const envKey = `DODO_PRODUCT_${planKey}_${modeKey}`;
  const value = (process.env[envKey] || "").trim();
  if (!value) {
    throw new Error(`missing_dodo_product_id:${envKey}`);
  }
  return value;
}

function getPlanDurationMonths(planType: DodoPlanId): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  return plan?.months ?? 0;
}

// Creates a Dodo checkout session and returns the hosted checkout URL.
// Client should only open the returned URL (never handle API keys).
export const createDodoCheckoutSession = action({
  args: {
    planType: v.union(v.literal("intensive"), v.literal("balanced"), v.literal("standard"), v.literal("relaxed")),
    paymentMode: v.union(v.literal("prepaid"), v.literal("installments")),
    flow: v.union(v.literal("purchase"), v.literal("upgrade")),
    returnUrl: v.string(),
    source: v.optional(v.string()),
    beta50: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string; provider: "dodo" }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(api.users.me);
    if (!user) throw new Error("User not found");

    // Guardrail: Dodo checkout always creates a new subscription/payment session.
    // Avoid duplicate charges by blocking purchase for already active subscribers.
    if (args.flow === "purchase") {
      const existingActive = await ctx.runQuery(api.subscriptions.getCurrent);
      if (existingActive && (existingActive as any)?.status === "active") {
        throw new Error("already_subscribed");
      }
    }

    const environment = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(environment);

    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY not configured");

    const planType = args.planType as DodoPlanId;
    const paymentMode = args.paymentMode as DodoPaymentMode;
    const months = getPlanDurationMonths(planType);
    if (!months) throw new Error("invalid_plan_months");

    const productId = getDodoProductId({ planType, paymentMode });

    const beta50Requested = args.beta50 === true && paymentMode === "prepaid";
    const discountCode =
      beta50Requested && (process.env.DODO_BETA50_DISCOUNT_CODE || "").trim()
        ? (process.env.DODO_BETA50_DISCOUNT_CODE || "").trim()
        : null;

    // Server-side eligibility: only allow beta50 after beta ends.
    const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
    const betaEnded = Number.isFinite(betaEndTs) ? Date.now() > betaEndTs : false;
    const betaEligible =
      beta50Requested && betaEnded && user.isBetaTester === true && (user.betaDiscountUsedAt ?? null) === null;

    const effectiveDiscountCode = betaEligible ? discountCode : null;

    const body = {
      confirm: true,
      allowed_payment_method_types: ["credit", "debit"],
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: args.returnUrl,
      discount_code: effectiveDiscountCode,
      customer: user.email ? { email: user.email, name: user.name ?? undefined } : undefined,
      metadata: {
        clerkId: user.clerkId,
        planType,
        paymentMode,
        flow: args.flow,
        source: args.source ?? "app",
        beta50: betaEligible,
        planDurationMonths: months,
      },
    };

    const resp = await fetch(`${baseUrl}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "<failed_to_read_body>");
      console.warn("[Dodo] Failed to create checkout session", {
        status: resp.status,
        errorText,
        environment,
      });
      throw new Error("dodo_checkout_session_failed");
    }

    const json: any = await resp.json();
    const checkoutUrl: string = String(json?.checkout_url || "");
    if (!checkoutUrl) throw new Error("dodo_missing_checkout_url");

    return { checkoutUrl, provider: "dodo" };
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

export const internalListDodoInstallmentsToCancel = internalQuery({
  handler: async (ctx) => {
    // Cancel Dodo subscriptions that reached their fixed term and haven't been cancelled yet.
    const subs = await ctx.db
      .query("userSubscriptions")
      .filter((q) => q.eq(q.field("billingProvider"), "dodo"))
      .filter((q) => q.eq(q.field("paymentMode"), "installments"))
      .collect();

    return subs
      .filter((s) => {
        if (s.providerCancelRequestedAt !== undefined) return false;
        if (s.installmentsCompletedAt === undefined) return false;
        const total = s.installmentsTotalMonths ?? s.planDurationMonths;
        const paid = s.installmentsPaidMonths ?? 0;
        return (
          total > 0 &&
          paid >= total &&
          typeof s.providerSubscriptionId === "string" &&
          s.providerSubscriptionId.length > 0
        );
      })
      .map((s) => ({ id: s._id, providerSubscriptionId: s.providerSubscriptionId as string }));
  },
});

export const internalMarkProviderCancelRequested = internalMutation({
  args: { id: v.id("userSubscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { providerCancelRequestedAt: Date.now() });
  },
});

export const processDodoInstallmentCancellations = internalAction({
  handler: async (ctx): Promise<{ attempted: number; cancelled: number }> => {
    if (getBillingProviderFromEnv() !== "dodo") {
      return { attempted: 0, cancelled: 0 };
    }

    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) {
      console.warn("[Dodo] DODO_PAYMENTS_API_KEY not configured; skipping installment cancellations.");
      return { attempted: 0, cancelled: 0 };
    }

    const env = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(env);

    const toCancel: Array<{ id: Id<"userSubscriptions">; providerSubscriptionId: string }> =
      (await ctx.runQuery(internal.subscriptions.internalListDodoInstallmentsToCancel)) as any;
    let cancelled = 0;

    for (const item of toCancel) {
      try {
        const resp = await fetch(`${baseUrl}/subscriptions/${encodeURIComponent(item.providerSubscriptionId)}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cancel_at_next_billing_date: true }),
        });

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "<failed_to_read_body>");
          console.warn("[Dodo] Failed to cancel subscription at next billing date", {
            providerSubscriptionId: item.providerSubscriptionId,
            status: resp.status,
            errorText,
          });
          continue;
        }

        await ctx.runMutation(internal.subscriptions.internalMarkProviderCancelRequested, { id: item.id });
        cancelled += 1;
      } catch (err) {
        console.warn("[Dodo] Failed to cancel subscription", { providerSubscriptionId: item.providerSubscriptionId, err });
      }
    }

    return { attempted: toCancel.length, cancelled };
  },
});

function getDodoEnvironmentForEvent(): "test_mode" | "live_mode" {
  return getDodoEnvironmentFromEnv();
}

function safeObject(input: unknown): Record<string, any> {
  return input && typeof input === "object" ? (input as any) : {};
}

function extractDodoMetadata(evt: any): Record<string, any> {
  const data = safeObject(evt?.data);
  const meta = safeObject((data as any)?.metadata);
  return meta;
}

function parseDodoPlanType(meta: Record<string, any>): DodoPlanId | null {
  const raw = String(meta?.planType || meta?.plan || "").trim().toLowerCase();
  if (raw === "intensive" || raw === "balanced" || raw === "standard" || raw === "relaxed") return raw;
  return null;
}

function parseDodoPaymentMode(meta: Record<string, any>): DodoPaymentMode | null {
  const raw = String(meta?.paymentMode || "").trim().toLowerCase();
  if (raw === "prepaid" || raw === "installments") return raw;
  return null;
}

function parseDodoBeta50(meta: Record<string, any>): boolean {
  return meta?.beta50 === true || meta?.beta50 === "true" || meta?.beta50 === 1 || meta?.beta50 === "1";
}

async function findSubscriptionByDodoSubscriptionId(ctx: MutationCtx, subscriptionId: string) {
  return await ctx.db
    .query("userSubscriptions")
    .filter((q) => q.eq(q.field("providerSubscriptionId"), subscriptionId))
    .first();
}

export const internalCancelDodoSubscriptionAtNextBillingDate = internalAction({
  args: { subscriptionId: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) {
      console.warn("[Dodo] DODO_PAYMENTS_API_KEY not configured; skipping cancellation request.");
      return { ok: false };
    }

    const env = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(env);

    try {
      const resp = await fetch(`${baseUrl}/subscriptions/${encodeURIComponent(args.subscriptionId)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancel_at_next_billing_date: true }),
      });

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "<failed_to_read_body>");
        console.warn("[Dodo] Failed to request cancel_at_next_billing_date", {
          subscriptionId: args.subscriptionId,
          status: resp.status,
          errorText,
        });
        return { ok: false };
      }

      return { ok: true };
    } catch (err) {
      console.warn("[Dodo] Failed to request cancel_at_next_billing_date", { subscriptionId: args.subscriptionId, err });
      return { ok: false };
    }
  },
});

// Receives a verified Dodo webhook payload and applies side effects idempotently.
export const internalProcessDodoWebhook = internalMutation({
  args: {
    rawBody: v.string(),
    receivedAt: v.number(),
    webhookId: v.string(),
    environment: v.optional(v.union(v.literal("test_mode"), v.literal("live_mode"))),
  },
  handler: async (ctx, args) => {
    let evt: any;
    try {
      evt = JSON.parse(args.rawBody);
    } catch {
      throw new Error("invalid_json");
    }

    const eventType: string = String(evt?.type || evt?.event_type || evt?.eventType || "").trim();
    if (!eventType) {
      throw new Error("missing_event_type");
    }

    const already = await ctx.db
      .query("dodoWebhookEvents")
      .withIndex("by_webhook_id", (q) => q.eq("webhookId", args.webhookId))
      .first();
    if (already) {
      return { status: "duplicate" as const };
    }

    const data = safeObject(evt?.data);
    const meta = extractDodoMetadata(evt);

    const clerkId: string | undefined = meta?.clerkId ? String(meta.clerkId) : undefined;
    const subscriptionId: string | undefined =
      (data as any)?.subscription_id ? String((data as any).subscription_id) :
      (data as any)?.subscriptionId ? String((data as any).subscriptionId) :
      undefined;
    const paymentId: string | undefined =
      (data as any)?.payment_id ? String((data as any).payment_id) :
      (data as any)?.paymentId ? String((data as any).paymentId) :
      undefined;

    const eventDocId = await ctx.db.insert("dodoWebhookEvents", {
      webhookId: args.webhookId,
      eventType,
      receivedAt: args.receivedAt,
      processedAt: undefined,
      rawPayload: args.rawBody,
      clerkId,
      subscriptionId,
      paymentId,
      environment: args.environment,
    });

    // ===== Payment failures: pause access =====
    if (eventType === "payment.failed" || eventType === "subscription.on_hold") {
      if (subscriptionId) {
        const sub = await findSubscriptionByDodoSubscriptionId(ctx, subscriptionId);
        if (sub) {
          await ctx.db.patch(sub._id, { status: "past_due", pausedAt: Date.now() });
          await ctx.db.insert("subscriptionHistory", {
            userId: sub.userId,
            action: "payment_failed",
            previousPlanType: sub.planType,
            newPlanType: sub.planType,
            notes: `dodo_webhook:${args.webhookId} ${eventType}`,
          });
        }
      }

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    // ===== Subscription cancelled/expired: mirror state =====
    if (eventType === "subscription.cancelled" || eventType === "subscription.expired") {
      if (subscriptionId) {
        const sub = await findSubscriptionByDodoSubscriptionId(ctx, subscriptionId);
        if (sub) {
          await ctx.db.patch(sub._id, {
            status: eventType === "subscription.cancelled" ? "cancelled" : "expired",
            cancelledAt: eventType === "subscription.cancelled" ? Date.now() : sub.cancelledAt,
          });
          await ctx.db.insert("subscriptionHistory", {
            userId: sub.userId,
            action: eventType === "subscription.cancelled" ? "cancelled" : "expired",
            previousPlanType: sub.planType,
            newPlanType: sub.planType,
            notes: `dodo_webhook:${args.webhookId} ${eventType}`,
          });
        }
      }

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    // ===== Prepaid one-time purchase: grant access after payment succeeds =====
    if (eventType === "payment.succeeded") {
      const paymentMode = parseDodoPaymentMode(meta);
      const planType = parseDodoPlanType(meta);
      const beta50 = parseDodoBeta50(meta);

      if (paymentMode !== "prepaid") {
        // Subscription renewals are handled via subscription.renewed to avoid double-counting.
        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "ignored" as const };
      }

      if (!clerkId || !planType) {
        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "ignored" as const };
      }

      const months = getPlanDurationMonths(planType);
      const planPriceCents = getPlanPriceCentsFromConfig({ planType, isBeta50: beta50 });

      await ctx.runMutation(internal.subscriptions.internalApplyDodoPurchase, {
        dodoWebhookId: args.webhookId,
        clerkId,
        planType,
        planDurationMonths: months,
        planPriceCents,
        paymentMode: "prepaid",
        dodoSubscriptionId: undefined,
        isBeta50: beta50,
      });

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    // ===== Installments (subscription): count renewals and enforce fixed-term cancellation =====
    if (eventType === "subscription.renewed") {
      if (!subscriptionId) {
        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "ignored" as const };
      }

      const existing = await findSubscriptionByDodoSubscriptionId(ctx, subscriptionId);
      if (existing) {
        // Increment paid months only for installments.
        if (existing.paymentMode === "installments") {
          const totalMonths = (existing.installmentsTotalMonths ?? existing.planDurationMonths) || 0;
          const paidMonths = (existing.installmentsPaidMonths ?? 0) + 1;
          const monthlyPrice = existing.installmentMonthlyPrice ?? 0;

          await ctx.db.patch(existing._id, {
            status: "active",
            installmentsPaidMonths: paidMonths,
            pausedAt: undefined,
          });

          await ctx.db.insert("subscriptionHistory", {
            userId: existing.userId,
            action: "renewed",
            previousPlanType: existing.planType,
            newPlanType: existing.planType,
            previousExpiresAt: existing.expiresAt,
            newExpiresAt: existing.expiresAt,
            cost: monthlyPrice,
            notes: `dodo_webhook:${args.webhookId} installments_charge:${paidMonths}/${totalMonths}`,
          });

          // When the fixed term is fully paid, request cancellation at next billing date.
          if (totalMonths > 0 && paidMonths >= totalMonths) {
            const now = Date.now();
            const shouldRequestCancel = existing.providerCancelRequestedAt === undefined;
            await ctx.db.patch(existing._id, {
              installmentsCompletedAt: now,
              providerCancelRequestedAt: existing.providerCancelRequestedAt ?? now,
            });
            if (shouldRequestCancel) {
              await ctx.scheduler.runAfter(0, internal.subscriptions.internalCancelDodoSubscriptionAtNextBillingDate, {
                subscriptionId,
              });
            }
          }
        }

        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "applied" as const };
      }

      // First renewal we see (some setups emit subscription.renewed even for the first month).
      // Provision the local subscription if we can.
      const planType = parseDodoPlanType(meta);
      const paymentMode = parseDodoPaymentMode(meta);
      if (!clerkId || !planType || paymentMode !== "installments") {
        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "ignored" as const };
      }

      const months = getPlanDurationMonths(planType);
      const planPriceCents = getInstallmentTotalCents(planType);

      await ctx.runMutation(internal.subscriptions.internalApplyDodoPurchase, {
        dodoWebhookId: args.webhookId,
        clerkId,
        planType,
        planDurationMonths: months,
        planPriceCents,
        paymentMode: "installments",
        dodoSubscriptionId: subscriptionId,
        isBeta50: false,
      });

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    await ctx.db.patch(eventDocId, { processedAt: Date.now() });
    return { status: "ignored" as const };
  },
});

export const internalApplyDodoPurchase = internalMutation({
  args: {
    dodoWebhookId: v.string(),
    clerkId: v.string(),
    planType: v.union(v.literal("intensive"), v.literal("balanced"), v.literal("standard"), v.literal("relaxed")),
    planDurationMonths: v.number(),
    planPriceCents: v.number(),
    paymentMode: v.union(v.literal("prepaid"), v.literal("installments")),
    dodoSubscriptionId: v.optional(v.string()),
    isBeta50: v.boolean(),
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

      if (!betaEnded) throw new Error("beta_discount_not_active");
      if (user.isBetaTester !== true) throw new Error("beta_discount_not_eligible");
      if (user.betaDiscountUsedAt !== undefined) throw new Error("beta_discount_already_used");

      await ctx.db.patch(user._id, { betaDiscountUsedAt: now });
    }

    const existing = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const baseStart = existing?.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
    const expiresAt = baseStart + args.planDurationMonths * 30 * 24 * 60 * 60 * 1000;

    const maxAccessibleUnits = await getTotalUnitsCount(ctx);

    const installmentMonthlyPrice =
      args.paymentMode === "installments" ? getInstallmentMonthlyChargeCents(args.planType) : undefined;
    const installmentsTotalMonths = args.paymentMode === "installments" ? args.planDurationMonths : undefined;

    const payload = {
      planType: args.planType,
      planDurationMonths: args.planDurationMonths,
      planPrice: args.planPriceCents,
      expiresAt,
      status: "active" as const,
      autoRenew: false,
      cancelledAt: undefined as number | undefined,
      maxAccessibleUnits,
      paymentMode: args.paymentMode as "prepaid" | "installments",
      billingProvider: "dodo" as const,
      providerSubscriptionId: args.dodoSubscriptionId,
      installmentsTotalMonths,
      installmentsPaidMonths: args.paymentMode === "installments" ? 1 : undefined,
      installmentMonthlyPrice,
      pausedAt: undefined as number | undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      await ctx.db.insert("subscriptionHistory", {
        userId: user._id,
        action: existing.planType === args.planType ? "renewed" : "upgraded",
        previousPlanType: existing.planType,
        newPlanType: args.planType,
        previousExpiresAt: existing.expiresAt,
        newExpiresAt: expiresAt,
        cost: args.paymentMode === "installments" ? installmentMonthlyPrice : args.planPriceCents,
        notes: `dodo_webhook:${args.dodoWebhookId}`,
      });
      return { subscriptionId: existing._id, userId: user._id };
    }

    const subscriptionId = await ctx.db.insert("userSubscriptions", {
      userId: user._id,
      ...payload,
    });

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "purchased",
      newPlanType: args.planType,
      newExpiresAt: expiresAt,
      cost: args.paymentMode === "installments" ? installmentMonthlyPrice : args.planPriceCents,
      notes: `dodo_webhook:${args.dodoWebhookId}`,
    });

    return { subscriptionId, userId: user._id };
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


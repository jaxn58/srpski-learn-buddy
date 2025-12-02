import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

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
  { id: "intensive", name: "Intensive", months: 3, price: 29, unitsPerWeek: 3 },
  { id: "balanced", name: "Balanced", months: 6, price: 49, unitsPerWeek: 2 },
  { id: "standard", name: "Standard", months: 9, price: 69, unitsPerWeek: 1.5 },
  { id: "relaxed", name: "Relaxed", months: 12, price: 89, unitsPerWeek: 1 },
];

// Get user's current subscription (alias for getUserSubscription)
export const getCurrent = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

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
    return SUBSCRIPTION_PLANS;
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
    const totalRevenue = allHistory
      .filter(h => h.cost)
      .reduce((sum, h) => sum + (h.cost || 0), 0) * 100; // Convert to cents

    // Calculate MRR (Monthly Recurring Revenue) from active subscriptions
    const mrr = allSubscriptions
      .filter(s => s.status === "active")
      .reduce((sum, s) => {
        // Calculate monthly price from plan price and duration
        const monthlyPrice = s.planPrice / s.planDurationMonths;
        return sum + (monthlyPrice * 100); // Convert to cents
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
        .reduce((sum, h) => sum + (h.cost || 0) * 100, 0),
      balanced: allHistory
        .filter(h => h.newPlanType === "balanced" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0) * 100, 0),
      standard: allHistory
        .filter(h => h.newPlanType === "standard" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0) * 100, 0),
      relaxed: allHistory
        .filter(h => h.newPlanType === "relaxed" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0) * 100, 0),
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


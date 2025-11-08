import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getUserSubscription,
  getSubscriptionHistory,
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  hasActiveSubscription,
  isExpiringWithinDays,
  getDaysRemaining,
  PLAN_PRICING,
  PlanType,
  getSubscriptionStats,
  getSubscriptionAnalytics,
} from "../subscription";

export const subscriptionRouter = router({
  /**
   * Get current user's subscription
   */
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getUserSubscription(ctx.user.id);
    
    if (!subscription) {
      return null;
    }

    // Add computed fields
    const daysRemaining = await getDaysRemaining(ctx.user.id);
    const isExpiring = await isExpiringWithinDays(ctx.user.id, 7);

    return {
      ...subscription,
      daysRemaining,
      isExpiring,
      // Convert price from cents to euros
      planPriceEur: (subscription.planPrice / 100).toFixed(2),
    };
  }),

  /**
   * Get subscription history for current user
   */
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return await getSubscriptionHistory(ctx.user.id);
  }),

  /**
   * Check if user has active subscription
   */
  isActive: protectedProcedure.query(async ({ ctx }) => {
    return await hasActiveSubscription(ctx.user.id);
  }),

  /**
   * Get days remaining on subscription
   */
  getDaysRemaining: protectedProcedure.query(async ({ ctx }) => {
    return await getDaysRemaining(ctx.user.id);
  }),

  /**
   * Get available plans (public)
   */
  getPlans: publicProcedure.query(() => {
    return Object.entries(PLAN_PRICING).map(([planType, info]) => ({
      type: planType,
      price: info.price / 100, // Convert to euros
      months: info.months,
      pricePerMonth: (info.price / 100 / info.months).toFixed(2),
    }));
  }),

  /**
   * Calculate upgrade cost
   */
  calculateUpgradeCost: protectedProcedure
    .input(z.object({ newPlanType: z.enum(["intensive", "balanced", "standard", "relaxed"]) }))
    .query(async ({ ctx, input }) => {
      const currentSub = await getUserSubscription(ctx.user.id);
      if (!currentSub) {
        return { error: "No active subscription found" };
      }

      const currentPlan = PLAN_PRICING[currentSub.planType as PlanType];
      const newPlan = PLAN_PRICING[input.newPlanType];

      // Calculate upgrade cost
      const currentCostPerMonth = currentPlan.price / currentPlan.months;
      const newCostPerMonth = newPlan.price / newPlan.months;
      const now = new Date();
      const remainingMs = currentSub.expiresAt.getTime() - now.getTime();
      const remainingMonths = remainingMs / (1000 * 60 * 60 * 24 * 30);

      const upgradeCost = Math.round(
        (newCostPerMonth - currentCostPerMonth) * remainingMonths +
        (newPlan.months - remainingMonths) * newCostPerMonth
      );

      return {
        currentPlan: currentSub.planType,
        newPlan: input.newPlanType,
        upgradeCost: upgradeCost / 100, // Convert to euros
        upgradeCostCents: upgradeCost,
        maxUpgradeCost: 5000, // €50 max (as per policy)
      };
    }),

  /**
   * Create a new subscription (after payment)
   * This should only be called after payment is confirmed
   */
  create: protectedProcedure
    .input(z.object({
      planType: z.enum(["intensive", "balanced", "standard", "relaxed"]),
      paymentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user already has active subscription
      const existing = await getUserSubscription(ctx.user.id);
      if (existing && existing.status === "active") {
        return { success: false, error: "User already has an active subscription" };
      }

      const result = await createSubscription(
        ctx.user.id,
        input.planType,
        `Payment: ${input.paymentId || "manual"}`
      );

      if (result.success) {
        // Notify owner about new subscription
        // await notifyOwner({
        //   title: "New Subscription",
        //   content: `User ${ctx.user.email} purchased ${input.planType} plan`,
        // });
      }

      return result;
    }),

  /**
   * Upgrade subscription to a longer plan
   * This should only be called after payment is confirmed
   */
  upgrade: protectedProcedure
    .input(z.object({
      newPlanType: z.enum(["intensive", "balanced", "standard", "relaxed"]),
      paymentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await upgradeSubscription(
        ctx.user.id,
        input.newPlanType,
        `Upgrade payment: ${input.paymentId || "manual"}`
      );

      if (result.success) {
        // Notify owner about upgrade
        // await notifyOwner({
        //   title: "Subscription Upgraded",
        //   content: `User ${ctx.user.email} upgraded to ${input.newPlanType} plan`,
        // });
      }

      return result;
    }),

  /**
   * Cancel subscription
   */
  cancel: protectedProcedure
    .input(z.object({ reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return await cancelSubscription(ctx.user.id, input.reason);
    }),

  /**
   * Admin: Get subscription stats
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is admin
    if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
      throw new Error("FORBIDDEN");
    }

    return await getSubscriptionStats();
  }),

  /**
   * Admin: Get user's subscription (for admin dashboard)
   */
  getUserSubscription: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new Error("FORBIDDEN");
      }

      return await getUserSubscription(input.userId);
    }),

  /**
   * Admin: Get subscription analytics
   */
  getAnalytics: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is admin
    if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
      throw new Error("FORBIDDEN");
    }

    return await getSubscriptionAnalytics();
  }),
});


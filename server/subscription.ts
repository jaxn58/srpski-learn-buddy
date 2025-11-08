import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import { userSubscriptions, subscriptionHistory, InsertUserSubscription, InsertSubscriptionHistory } from "../drizzle/schema";
import { nanoid } from "nanoid";

// Plan pricing in cents (€)
export const PLAN_PRICING = {
  intensive: { price: 6900, months: 3 }, // €69.00 for 3 months
  balanced: { price: 7900, months: 6 }, // €79.00 for 6 months
  standard: { price: 9500, months: 9 }, // €95.00 for 9 months
  relaxed: { price: 11900, months: 12 }, // €119.00 for 12 months
} as const;

export type PlanType = keyof typeof PLAN_PRICING;

/**
 * Get user's current active subscription
 */
export async function getUserSubscription(userId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get all subscription history for a user
 */
export async function getSubscriptionHistory(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(subscriptionHistory)
    .where(eq(subscriptionHistory.userId, userId))
    .orderBy(desc(subscriptionHistory.createdAt));
}

/**
 * Create a new subscription for a user
 */
export async function createSubscription(
  userId: string,
  planType: PlanType,
  notes?: string
): Promise<{ success: boolean; subscription?: any; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  try {
    const planInfo = PLAN_PRICING[planType];
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + planInfo.months);

    const subscriptionId = nanoid();

    // Create subscription
    const subscription: InsertUserSubscription = {
      id: subscriptionId,
      userId,
      planType,
      planDurationMonths: planInfo.months,
      planPrice: planInfo.price,
      expiresAt,
      status: "active",
      autoRenew: false,
    };

    await db.insert(userSubscriptions).values(subscription);

    // Record in history
    const history: InsertSubscriptionHistory = {
      id: nanoid(),
      userId,
      action: "purchased",
      newPlanType: planType,
      newExpiresAt: expiresAt,
      cost: planInfo.price,
      notes: notes || "Initial purchase",
    };

    await db.insert(subscriptionHistory).values(history);

    return { success: true, subscription };
  } catch (error) {
    console.error("[Subscription] Failed to create subscription:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Upgrade a subscription to a longer plan
 * Calculates the difference cost
 */
export async function upgradeSubscription(
  userId: string,
  newPlanType: PlanType,
  notes?: string
): Promise<{ success: boolean; upgradeCost?: number; newSubscription?: any; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  try {
    const currentSub = await getUserSubscription(userId);
    if (!currentSub) {
      return { success: false, error: "No active subscription found" };
    }

    if (currentSub.status !== "active") {
      return { success: false, error: "Subscription is not active" };
    }

    const currentPlan = PLAN_PRICING[currentSub.planType as PlanType];
    const newPlan = PLAN_PRICING[newPlanType];

    // Calculate upgrade cost (difference only)
    // Cost per month for current plan
    const currentCostPerMonth = currentPlan.price / currentPlan.months;
    // Cost per month for new plan
    const newCostPerMonth = newPlan.price / newPlan.months;
    // Remaining months on current plan
    const now = new Date();
    const remainingMs = currentSub.expiresAt.getTime() - now.getTime();
    const remainingMonths = remainingMs / (1000 * 60 * 60 * 24 * 30);

    // Upgrade cost: (new cost per month - current cost per month) * remaining months + (new months - remaining months) * new cost per month
    const upgradeCost = Math.round(
      (newCostPerMonth - currentCostPerMonth) * remainingMonths +
      (newPlan.months - remainingMonths) * newCostPerMonth
    );

    // Calculate new expiration date
    const newExpiresAt = new Date(currentSub.expiresAt);
    newExpiresAt.setMonth(newExpiresAt.getMonth() + (newPlan.months - currentPlan.months));

    // Update subscription
    await db
      .update(userSubscriptions)
      .set({
        planType: newPlanType,
        planDurationMonths: newPlan.months,
        planPrice: newPlan.price,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));

    // Record in history
    const history: InsertSubscriptionHistory = {
      id: nanoid(),
      userId,
      action: "upgraded",
      previousPlanType: currentSub.planType,
      newPlanType,
      previousExpiresAt: currentSub.expiresAt,
      newExpiresAt,
      cost: upgradeCost,
      notes: notes || `Upgraded from ${currentSub.planType} to ${newPlanType}`,
    };

    await db.insert(subscriptionHistory).values(history);

    const updatedSub = await getUserSubscription(userId);

    return { success: true, upgradeCost, newSubscription: updatedSub };
  } catch (error) {
    console.error("[Subscription] Failed to upgrade subscription:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  userId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  try {
    const currentSub = await getUserSubscription(userId);
    if (!currentSub) {
      return { success: false, error: "No active subscription found" };
    }

    // Update subscription status
    await db
      .update(userSubscriptions)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));

    // Record in history
    const history: InsertSubscriptionHistory = {
      id: nanoid(),
      userId,
      action: "cancelled",
      previousPlanType: currentSub.planType,
      previousExpiresAt: currentSub.expiresAt,
      notes: notes || "Subscription cancelled by user",
    };

    await db.insert(subscriptionHistory).values(history);

    return { success: true };
  } catch (error) {
    console.error("[Subscription] Failed to cancel subscription:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return false;

  // Check if subscription is active and not expired
  if (subscription.status !== "active") return false;
  if (new Date() > subscription.expiresAt) return false;

  return true;
}

/**
 * Check if subscription is expiring soon (within X days)
 */
export async function isExpiringWithinDays(userId: string, days: number = 7): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return false;
  if (subscription.status !== "active") return false;

  const now = new Date();
  const expiryDate = new Date(subscription.expiresAt);
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  return daysUntilExpiry <= days && daysUntilExpiry > 0;
}

/**
 * Get days remaining on subscription
 */
export async function getDaysRemaining(userId: string): Promise<number | null> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return null;
  if (subscription.status !== "active") return null;

  const now = new Date();
  const expiryDate = new Date(subscription.expiresAt);
  const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return Math.max(0, daysRemaining);
}

/**
 * Mark expired subscriptions as expired (run via cron job)
 */
export async function markExpiredSubscriptions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const now = new Date();
    const expiredSubs = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, "active"),
          // @ts-ignore - Drizzle doesn't have a direct comparison operator for dates
        )
      );

    let count = 0;
    for (const sub of expiredSubs) {
      if (sub.expiresAt < now) {
        await db
          .update(userSubscriptions)
          .set({
            status: "expired",
            updatedAt: new Date(),
          })
          .where(eq(userSubscriptions.id, sub.id));

        // Record in history
        await db.insert(subscriptionHistory).values({
          id: nanoid(),
          userId: sub.userId,
          action: "expired",
          previousPlanType: sub.planType,
          previousExpiresAt: sub.expiresAt,
          notes: "Subscription automatically marked as expired",
        });

        count++;
      }
    }

    return count;
  } catch (error) {
    console.error("[Subscription] Failed to mark expired subscriptions:", error);
    return 0;
  }
}

/**
 * Get subscription stats for admin dashboard
 */
export async function getSubscriptionStats() {
  const db = await getDb();
  if (!db) return null;

  try {
    const now = new Date();

    // Count active subscriptions by plan type
    const activeSubs = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.status, "active"));

    const statsByPlan = {
      intensive: 0,
      balanced: 0,
      standard: 0,
      relaxed: 0,
    };

    let totalRevenue = 0;
    let expiringWithin7Days = 0;

    for (const sub of activeSubs) {
      if (sub.expiresAt > now) {
        statsByPlan[sub.planType as PlanType]++;
        totalRevenue += sub.planPrice;

        const daysUntilExpiry = (sub.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry <= 7) {
          expiringWithin7Days++;
        }
      }
    }

    return {
      totalActiveSubscriptions: activeSubs.filter(s => s.expiresAt > now).length,
      statsByPlan,
      totalRevenue,
      expiringWithin7Days,
    };
  } catch (error) {
    console.error("[Subscription] Failed to get stats:", error);
    return null;
  }
}


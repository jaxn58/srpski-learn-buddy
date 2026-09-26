import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { assertLearnerAccountActive } from "./authz";
import type { Id } from "./_generated/dataModel";
import {
  MODULE_COMPLETION_BADGES,
  WEEK_STREAK_BADGES,
  WEEKLY_ACTIVE_DAYS_TARGET,
  WEEKLY_XP_TARGET,
  consecutiveGoalWeeks,
  utcDayStart,
  utcWeekStart,
} from "./gamification";

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (user) {
    assertLearnerAccountActive(user);
  }
  return user;
}

/** Monday–Sunday weeks, current week plus eight before it, matching the weekly goal. */
async function loadGoalWeekStreak(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<number> {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const windowStart = utcWeekStart(utcDayStart(now)) - 8 * 7 * dayMs;

  const activities = await ctx.db
    .query("dailyActivity")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("activityDate", windowStart))
    .collect();

  const chats = await ctx.db
    .query("chatMessages")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("role"), "user"))
    .filter((q) => q.gte(q.field("_creationTime"), windowStart))
    .collect();

  const byDay = new Map<number, { xp: number; active: boolean }>();
  for (const activity of activities) {
    const day = utcDayStart(activity.activityDate);
    const prev = byDay.get(day) ?? { xp: 0, active: false };
    const xp = prev.xp + (activity.xpEarned ?? 0);
    byDay.set(day, { xp, active: prev.active || xp > 0 });
  }
  for (const message of chats) {
    const day = utcDayStart(message._creationTime);
    const prev = byDay.get(day) ?? { xp: 0, active: false };
    byDay.set(day, { xp: prev.xp, active: true });
  }

  return consecutiveGoalWeeks({
    now,
    days: Array.from(byDay.entries()).map(([dayStart, value]) => ({
      dayStart,
      xp: value.xp,
      active: value.active,
    })),
    xpTarget: WEEKLY_XP_TARGET,
    activeDaysTarget: WEEKLY_ACTIVE_DAYS_TARGET,
  });
}

// Get user's badges
export const getUserBadges = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export async function awardDueBadgesForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<string[]> {
  const user = await ctx.db.get(userId);
  if (!user) return [];

  const awardedBadges: string[] = [];
  const existingBadges = await ctx.db
    .query("userBadges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const hasBadge = (badgeId: string) => existingBadges.some((b) => b.badgeId === badgeId);

  const progress = await ctx.db
    .query("userProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const anyCompletion = await ctx.db
    .query("exerciseCompletions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const totalXp = user.totalXP ?? 0;
  const completedUnits = progress?.completedUnits.length ?? 0;
  const goalWeekStreak = await loadGoalWeekStreak(ctx, userId);
  const xpBadges = [
    { id: "xp_100", minXp: 100 },
    { id: "xp_500", minXp: 500 },
    { id: "xp_1000", minXp: 1000 },
    { id: "xp_2000", minXp: 2000 },
    { id: "xp_5000", minXp: 5000 },
    { id: "xp_10000", minXp: 10000 },
    { id: "xp_20000", minXp: 20000 },
    { id: "xp_50000", minXp: 50000 },
  ] as const;

  const badges: Array<{ id: string; condition: () => boolean }> = [
    { id: "first_steps", condition: () => anyCompletion !== null },
    { id: "unit_complete", condition: () => completedUnits >= 1 },
    { id: "five_units", condition: () => completedUnits >= 5 },
    { id: "ten_units", condition: () => completedUnits >= 10 },
    ...MODULE_COMPLETION_BADGES.map((badge) => ({
      id: badge.id,
      condition: () => completedUnits >= badge.units,
    })),
    ...WEEK_STREAK_BADGES.map((badge) => ({
      id: badge.id,
      condition: () => goalWeekStreak >= badge.weeks,
    })),
    ...xpBadges.map((badge) => ({
      id: badge.id,
      condition: () => totalXp >= badge.minXp,
    })),
  ];

  for (const badge of badges) {
    if (!hasBadge(badge.id) && badge.condition()) {
      await ctx.db.insert("userBadges", {
        userId,
        badgeId: badge.id,
      });
      awardedBadges.push(badge.id);
    }
  }
  return awardedBadges;
}

// Award badge to user
export const awardBadge = mutation({
  args: {
    badgeId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check if user already has this badge
    const existing = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("badgeId"), args.badgeId))
      .first();

    if (existing) {
      return existing._id; // Already has badge
    }

    return await ctx.db.insert("userBadges", {
      userId: user._id,
      badgeId: args.badgeId,
    });
  },
});

// Check and award badges based on achievements
export const checkAndAwardBadges = mutation({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    return await awardDueBadgesForUser(ctx, user._id);
  },
});

// Get badge count for user
export const getBadgeCount = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const badges = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return badges.length;
  },
});


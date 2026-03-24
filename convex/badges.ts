import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { assertLearnerAccountActive } from "./authz";

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
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const awardedBadges: string[] = [];

    // Get user's existing badges
    const existingBadges = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const hasBadge = (badgeId: string) =>
      existingBadges.some((b) => b.badgeId === badgeId);

    // Get user progress
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Get exercise completions
    const completions = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Badge definitions
    const badges = [
      { id: "first_steps", condition: () => completions.length >= 1 },
      { id: "unit_complete", condition: () => (progress?.completedUnits.length ?? 0) >= 1 },
      { id: "five_units", condition: () => (progress?.completedUnits.length ?? 0) >= 5 },
      { id: "ten_units", condition: () => (progress?.completedUnits.length ?? 0) >= 10 },
      { id: "streak_3", condition: () => user.currentStreak >= 3 },
      { id: "streak_7", condition: () => user.currentStreak >= 7 },
      { id: "streak_30", condition: () => user.currentStreak >= 30 },
      { id: "xp_100", condition: () => user.totalXP >= 100 },
      { id: "xp_500", condition: () => user.totalXP >= 500 },
      { id: "xp_1000", condition: () => user.totalXP >= 1000 },
      { id: "level_5", condition: () => user.level >= 5 },
      { id: "level_10", condition: () => user.level >= 10 },
    ];

    // Check and award badges
    for (const badge of badges) {
      if (!hasBadge(badge.id) && badge.condition()) {
        await ctx.db.insert("userBadges", {
          userId: user._id,
          badgeId: badge.id,
        });
        awardedBadges.push(badge.id);
      }
    }

    return awardedBadges;
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


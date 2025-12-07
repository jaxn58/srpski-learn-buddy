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

// Helper to check unit access
async function checkUnitAccess(ctx: QueryCtx | MutationCtx, unitNumber: number): Promise<boolean> {
  const user = await getCurrentUser(ctx);
  if (!user) return false;

  // Admins have full access
  if (user.role === "admin" || user.role === "superadmin") {
    return true;
  }

  // Check for active subscription
  const subscription = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (subscription?.maxAccessibleUnits && unitNumber <= subscription.maxAccessibleUnits) {
    return true;
  }

  // Paid subscriptions get full access
  if (subscription && subscription.planType !== "beta" && unitNumber <= 27) {
    return true;
  }

  // Fallback: Beta Tester Flag
  if (user.isBetaTester && unitNumber <= 5) {
    return true;
  }

  return false;
}

// Get exercise results for current user
export const getResults = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("exerciseResults")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Add exercise result
export const addResult = mutation({
  args: {
    unitNumber: v.number(),
    exerciseType: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    correctAnswers: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check unit access
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      throw new Error("UNIT_LOCKED");
    }

    return await ctx.db.insert("exerciseResults", {
      userId: user._id,
      ...args,
    });
  },
});

// Get exercise completions (gamification)
export const getCompletions = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Add exercise completion with XP
export const addCompletion = mutation({
  args: {
    unitNumber: v.number(),
    exerciseId: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    xpEarned: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check unit access
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      throw new Error("UNIT_LOCKED");
    }

    // Add completion record
    await ctx.db.insert("exerciseCompletions", {
      userId: user._id,
      ...args,
    });

    // Update user XP
    const newTotalXP = user.totalXP + args.xpEarned;
    const newLevel = Math.floor(newTotalXP / 100) + 1;

    await ctx.db.patch(user._id, {
      totalXP: newTotalXP,
      level: newLevel,
      lastActiveDate: Date.now(),
    });

    return { totalXP: newTotalXP, level: newLevel, xpEarned: args.xpEarned };
  },
});

// ============= QUIZ PROGRESS =============

// Get quiz progress for a unit
export const getQuizProgress = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();
  },
});

// Get all quiz progress for current user (for auto-selecting next unit)
export const getAllQuizProgress = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const allProgress = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) => q.eq("userId", user._id))
      .collect();

    return allProgress;
  },
});

// Update quiz progress
export const updateQuizProgress = mutation({
  args: {
    unitNumber: v.number(),
    currentIndex: v.number(),
    lastScore: v.optional(v.number()),
    incorrectWordIds: v.optional(v.array(v.string())),
    incrementAttempts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();

    if (existing) {
      const updates: Record<string, unknown> = {
        currentIndex: args.currentIndex,
        lastAttemptAt: Date.now(),
      };

      if (args.lastScore !== undefined) updates.lastScore = args.lastScore;
      if (args.incorrectWordIds !== undefined) updates.incorrectWordIds = args.incorrectWordIds;
      if (args.incrementAttempts) updates.totalAttempts = existing.totalAttempts + 1;

      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("quizProgress", {
        userId: user._id,
        unitNumber: args.unitNumber,
        currentIndex: args.currentIndex,
        totalAttempts: args.incrementAttempts ? 1 : 0,
        lastScore: args.lastScore ?? 0,
        incorrectWordIds: args.incorrectWordIds ?? [],
        lastAttemptAt: Date.now(),
      });
    }
  },
});

// Reset quiz progress
export const resetQuizProgress = mutation({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Get incorrect words for a unit (for targeted practice)
export const getIncorrectWords = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const progress = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();

    return progress?.incorrectWordIds ?? [];
  },
});

// Clear incorrect words after successful practice
export const clearIncorrectWords = mutation({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        incorrectWordIds: [],
      });
    }
  },
});


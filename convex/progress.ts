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

// Get user progress
export const getUserProgress = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return progress;
  },
});

// Update user progress
export const updateProgress = mutation({
  args: {
    currentWeek: v.optional(v.number()),
    currentUnit: v.optional(v.number()),
    learningDuration: v.optional(v.number()),
    uiLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      // Create new progress
      await ctx.db.insert("userProgress", {
        userId: user._id,
        currentWeek: args.currentWeek ?? 1,
        currentUnit: args.currentUnit ?? 1,
        completedUnits: [],
        learningDuration: args.learningDuration ?? 12,
        uiLanguage: args.uiLanguage ?? "en",
      });
    } else {
      // Update existing progress
      const updates: Record<string, unknown> = {};
      if (args.currentWeek !== undefined) updates.currentWeek = args.currentWeek;
      if (args.currentUnit !== undefined) updates.currentUnit = args.currentUnit;
      if (args.learningDuration !== undefined) updates.learningDuration = args.learningDuration;
      if (args.uiLanguage !== undefined) updates.uiLanguage = args.uiLanguage;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(progress._id, updates);
      }
    }
  },
});

// Mark unit as complete
export const completeUnit = mutation({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) throw new Error("User progress not found");

    // Add unit to completed list if not already there
    if (!progress.completedUnits.includes(args.unitNumber)) {
      const newCompletedUnits = [...progress.completedUnits, args.unitNumber];
      await ctx.db.patch(progress._id, {
        completedUnits: newCompletedUnits,
        currentUnit: args.unitNumber + 1,
      });
    }
  },
});

// Get all user progress (admin only)
export const getAllProgress = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.query("userProgress").collect();
  },
});


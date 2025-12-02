import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

// Helper to get the current user from Clerk identity
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// Get current authenticated user
export const me = query({
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

// Sync user from Clerk (called on first sign-in)
export const syncUser = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existing) {
      // Update last active time
      await ctx.db.patch(existing._id, {
        lastActiveDate: Date.now(),
      });
      return existing._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: identity.name ?? undefined,
      email: identity.email ?? undefined,
      loginMethod: "clerk",
      role: "student",
      isActive: false, // New users start inactive
      isBetaTester: false,
      totalXP: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: Date.now(),
    });

    // Create initial user progress
    await ctx.db.insert("userProgress", {
      userId,
      currentWeek: 1,
      currentUnit: 1,
      completedUnits: [],
      learningDuration: 12,
      uiLanguage: "en",
    });

    return userId;
  },
});

// Get all users (admin only)
export const getAllUsers = query({
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.query("users").collect();
  },
});

// Update user role (superadmin only)
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("superadmin"), v.literal("admin"), v.literal("student")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== "superadmin") {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// Activate/deactivate user (admin/superadmin)
export const setUserActive = mutation({
  args: {
    userId: v.id("users"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.userId, { isActive: args.isActive });
  },
});

// Set beta tester status (admin/superadmin)
export const setBetaTester = mutation({
  args: {
    userId: v.id("users"),
    isBetaTester: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.userId, { isBetaTester: args.isBetaTester });
  },
});

// Update user XP and level
export const updateUserXP = mutation({
  args: {
    xpToAdd: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const newTotalXP = user.totalXP + args.xpToAdd;
    // Simple leveling: every 100 XP = 1 level
    const newLevel = Math.floor(newTotalXP / 100) + 1;

    await ctx.db.patch(user._id, {
      totalXP: newTotalXP,
      level: newLevel,
      lastActiveDate: Date.now(),
    });

    return { totalXP: newTotalXP, level: newLevel };
  },
});

// Make user superadmin (for initial setup - remove after use)
export const makeSuperadmin = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error(`User with email ${args.email} not found`);
    }

    await ctx.db.patch(user._id, {
      role: "superadmin",
      isActive: true,
      isBetaTester: true,
    });

    return { success: true, userId: user._id };
  },
});

// Update streak
export const updateStreak = mutation({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const lastActive = user.lastActiveDate;
    let newStreak = user.currentStreak;
    let longestStreak = user.longestStreak;

    if (lastActive) {
      const lastActiveDate = new Date(lastActive);
      lastActiveDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((todayTimestamp - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Consecutive day - increment streak
        newStreak += 1;
        if (newStreak > longestStreak) {
          longestStreak = newStreak;
        }
      } else if (daysDiff > 1) {
        // Streak broken
        newStreak = 1;
      }
      // daysDiff === 0 means same day, don't change streak
    } else {
      // First activity ever
      newStreak = 1;
    }

    await ctx.db.patch(user._id, {
      currentStreak: newStreak,
      longestStreak,
      lastActiveDate: Date.now(),
    });

    return { currentStreak: newStreak, longestStreak };
  },
});


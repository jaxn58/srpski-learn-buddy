import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

// Helper to get the current user and verify admin
async function getAdminUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return null;
  }

  return user;
}

// Get all users (admin only)
export const getAllUsers = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const users = await ctx.db.query("users").collect();
    
    // Enrich with progress and subscription data
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const progress = await ctx.db
          .query("userProgress")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .first();

        // Get user's active subscription
        const subscription = await ctx.db
          .query("userSubscriptions")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .first();

        // Map plan type to display name
        const planNames: Record<string, string> = {
          intensive: "Intensive",
          balanced: "Balanced",
          standard: "Standard",
          relaxed: "Relaxed",
        };

        return {
          ...user,
          progress: progress || null,
          subscription: subscription
            ? {
                ...subscription,
                planName: planNames[subscription.planType] || subscription.planType,
              }
            : null,
        };
      })
    );

    return enrichedUsers;
  },
});

// Get all user progress (admin only)
export const getAllProgress = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const allProgress = await ctx.db.query("userProgress").collect();
    
    // Enrich with user info
    const enrichedProgress = await Promise.all(
      allProgress.map(async (progress) => {
        const user = await ctx.db.get(progress.userId);
        return {
          ...progress,
          userName: user?.name || user?.email || "Unknown",
          userEmail: user?.email || "",
        };
      })
    );

    return enrichedProgress;
  },
});

// Get statistics (admin only)
export const getStatistics = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const allUsers = await ctx.db.query("users").collect();
    const allProgress = await ctx.db.query("userProgress").collect();
    const allSubscriptions = await ctx.db.query("userSubscriptions").collect();
    const allFeedback = await ctx.db.query("feedbackSubmissions").collect();

    const activeUsers = allUsers.filter(u => u.isActive).length;
    const betaTesters = allUsers.filter(u => u.isBetaTester).length;
    const totalProgress = allProgress.length;
    const activeSubscriptions = allSubscriptions.filter(s => s.status === "active").length;
    const pendingFeedback = allFeedback.filter(f => f.status === "new").length;

    // Calculate average progress
    const totalCompletedUnits = allProgress.reduce((sum, p) => sum + (p.completedUnits?.length || 0), 0);
    const avgCompletedUnits = totalProgress > 0 ? totalCompletedUnits / totalProgress : 0;

    return {
      totalUsers: allUsers.length,
      activeUsers,
      betaTesters,
      totalProgress,
      activeSubscriptions,
      pendingFeedback,
      avgCompletedUnits: Math.round(avgCompletedUnits * 10) / 10,
    };
  },
});

// Update user role (admin only)
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("superadmin"), v.literal("admin"), v.literal("student")),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    // Only superadmin can assign superadmin role
    if (args.role === "superadmin" && admin.role !== "superadmin") {
      throw new Error("Only superadmin can assign superadmin role");
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
    });
  },
});

// Toggle user active status (admin only)
export const toggleUserStatus = mutation({
  args: {
    userId: v.id("users"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    await ctx.db.patch(args.userId, {
      isActive: args.isActive,
    });
  },
});

// Toggle beta tester status (admin only)
export const toggleBetaTester = mutation({
  args: {
    userId: v.id("users"),
    isBetaTester: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    await ctx.db.patch(args.userId, {
      isBetaTester: args.isBetaTester,
    });
  },
});

// Delete user (admin only)
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    // Prevent deleting yourself
    if (args.userId === admin._id) {
      throw new Error("Cannot delete your own account");
    }

    // Delete user's progress
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const p of progress) {
      await ctx.db.delete(p._id);
    }

    // Delete user's subscriptions
    const subscriptions = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const s of subscriptions) {
      await ctx.db.delete(s._id);
    }

    // Delete user's feedback
    const feedback = await ctx.db
      .query("feedbackSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const f of feedback) {
      await ctx.db.delete(f._id);
    }

    // Delete user's chat sessions
    const chatSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const session of chatSessions) {
      // Delete messages
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }

      await ctx.db.delete(session._id);
    }

    // Finally delete the user
    await ctx.db.delete(args.userId);
  },
});

// Reset user progress (admin only)
export const resetUserProgress = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (progress) {
      await ctx.db.patch(progress._id, {
        currentWeek: 1,
        currentUnit: 1,
        completedUnits: [],
      });
    } else {
      // Create initial progress if it doesn't exist
      await ctx.db.insert("userProgress", {
        userId: args.userId,
        currentWeek: 1,
        currentUnit: 1,
        completedUnits: [],
        learningDuration: 12,
        uiLanguage: "en",
      });
    }
  },
});


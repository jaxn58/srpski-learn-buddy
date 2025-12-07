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

// Update user learning language (for migration script & admin)
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    learningLanguage: v.optional(v.union(
      v.literal("en"),
      v.literal("de"),
      v.literal("es"),
      v.literal("fr")
    )),
  },
  handler: async (ctx, args) => {
    // This mutation is used by the migration script, so we allow it
    // In production, you might want to add admin checks here
    
    const updateData: any = {};
    
    if (args.learningLanguage !== undefined) {
      updateData.learningLanguage = args.learningLanguage;
    }
    
    if (Object.keys(updateData).length > 0) {
      await ctx.db.patch(args.userId, updateData);
    }
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

    // Get the user to find their Clerk ID
    const userToDelete = await ctx.db.get(args.userId);
    if (!userToDelete) {
      throw new Error("User not found");
    }

    console.log(`[Delete User] Starting deletion for user: ${userToDelete.email || userToDelete.name || args.userId}`);

    let clerkDeletionStatus = "skipped";
    let clerkErrorMessage = "";

    // Delete from Clerk first (if they have a clerkId)
    if (userToDelete.clerkId) {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      
      if (!clerkSecretKey) {
        console.warn(`[Delete User] ⚠️ CLERK_SECRET_KEY not configured. User will be deleted from Convex only.`);
        console.warn(`[Delete User] ⚠️ User can re-register if they're still in Clerk. Set CLERK_SECRET_KEY to prevent this.`);
        clerkDeletionStatus = "no_api_key";
        clerkErrorMessage = "CLERK_SECRET_KEY not set - user not deleted from Clerk";
      } else {
        try {
          console.log(`[Delete User] Attempting to delete from Clerk: ${userToDelete.clerkId}`);
          
          const clerkResponse = await fetch(
            `https://api.clerk.com/v1/users/${userToDelete.clerkId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (clerkResponse.ok) {
            console.log(`[Delete User] ✅ Successfully deleted from Clerk`);
            clerkDeletionStatus = "success";
          } else {
            const errorText = await clerkResponse.text();
            console.error(`[Delete User] ❌ Failed to delete from Clerk (${clerkResponse.status}):`, errorText);
            clerkDeletionStatus = "failed";
            clerkErrorMessage = `Clerk API error: ${clerkResponse.status}`;
            // Continue with Convex deletion even if Clerk deletion fails
          }
        } catch (error) {
          console.error("[Delete User] ❌ Error calling Clerk API:", error);
          clerkDeletionStatus = "error";
          clerkErrorMessage = error instanceof Error ? error.message : "Unknown error";
          // Continue with Convex deletion even if Clerk deletion fails
        }
      }
    } else {
      console.log(`[Delete User] No Clerk ID found, skipping Clerk deletion`);
    }

    console.log(`[Delete User] Deleting from Convex database...`);

    // Delete user's progress
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    console.log(`[Delete User] Deleting ${progress.length} progress records`);
    for (const p of progress) {
      await ctx.db.delete(p._id);
    }

    // Delete user's subscriptions
    const subscriptions = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    console.log(`[Delete User] Deleting ${subscriptions.length} subscriptions`);
    for (const s of subscriptions) {
      await ctx.db.delete(s._id);
    }

    // Delete user's feedback
    const feedback = await ctx.db
      .query("feedbackSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    console.log(`[Delete User] Deleting ${feedback.length} feedback submissions`);
    for (const f of feedback) {
      await ctx.db.delete(f._id);
    }

    // Delete user's chat sessions
    const chatSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    console.log(`[Delete User] Deleting ${chatSessions.length} chat sessions`);
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

    // Finally delete the user from Convex
    await ctx.db.delete(args.userId);
    console.log(`[Delete User] ✅ User deleted from Convex database`);

    // Return status information
    return {
      success: true,
      clerkDeletionStatus,
      clerkErrorMessage,
      warning: clerkDeletionStatus !== "success" 
        ? "User deleted from Convex, but may still exist in Clerk. They can re-register immediately." 
        : "User deleted successfully. They can register again immediately.",
    };
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


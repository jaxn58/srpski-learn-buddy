import { v } from "convex/values";
import { mutation, query, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { VOCABULARY } from "../shared/data/vocabulary/words";
import { UNIT_EXERCISES } from "./unitExercises";
import { upsertDailyActivityByUserId } from "./units";

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

export const getChatPrompt = query({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) {
        console.log("getChatPrompt: Unauthorized");
        throw new Error("Unauthorized");
    }

    const name = args.name || "default";
    console.log(`getChatPrompt: Querying for name="${name}"`);
    const prompt = await ctx.db
      .query("chatPrompts")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();

    console.log(`getChatPrompt: Result found: ${!!prompt}`);
    return prompt || null;
  },
});

// Internal: fetch prompt by name without requiring user identity (for server-side actions).
// NOTE: Do not expose this to clients directly. Use only via `internal.admin.*`.
export const internalGetChatPromptByName = internalQuery({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db
      .query("chatPrompts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    return prompt || null;
  },
});

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
        currentUnit: 1,
        completedUnits: [],
      });
    } else {
      // Create initial progress if it doesn't exist
      await ctx.db.insert("userProgress", {
        userId: args.userId,
        currentUnit: 1,
        completedUnits: [],
        learningDuration: 12,
        uiLanguage: "en",
      });
    }
  },
});

// Reset gamification system for a user (admin only)
// Resets all XP, level, streak, badges, and progress data
export const resetGamificationSystem = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    console.log(`[Reset Gamification] Starting reset for user: ${user.email || user.name || args.userId}`);

    // 1. Reset user gamification fields
    await ctx.db.patch(args.userId, {
      totalXP: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: undefined,
    });
    console.log(`[Reset Gamification] ✅ Reset user XP, level, and streak`);

    // 2. Delete all user badges
    const badges = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const badge of badges) {
      await ctx.db.delete(badge._id);
    }
    console.log(`[Reset Gamification] ✅ Deleted ${badges.length} badges`);

    // 3. Delete all vocabulary progress
    const vocabProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const progress of vocabProgress) {
      await ctx.db.delete(progress._id);
    }
    console.log(`[Reset Gamification] ✅ Deleted ${vocabProgress.length} vocabulary progress entries`);

    // 4. Delete all exercise question progress
    const exerciseQuestionProgress = await ctx.db
      .query("exerciseQuestionProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const progress of exerciseQuestionProgress) {
      await ctx.db.delete(progress._id);
    }
    console.log(`[Reset Gamification] ✅ Deleted ${exerciseQuestionProgress.length} exercise question progress entries`);

    // 5. Delete all question progress (interactive tests)
    const questionProgress = await ctx.db
      .query("questionProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const progress of questionProgress) {
      await ctx.db.delete(progress._id);
    }
    console.log(`[Reset Gamification] ✅ Deleted ${questionProgress.length} question progress entries`);

    // 6. Delete all vocabulary entries (old table - deprecated but still used)
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const vocab of vocabulary) {
      await ctx.db.delete(vocab._id);
    }
    console.log(`[Reset Gamification] ✅ Deleted ${vocabulary.length} vocabulary entries (old table)`);

    // Optional: Delete exercise completions (commented out - uncomment if needed)
    // const exerciseCompletions = await ctx.db
    //   .query("exerciseCompletions")
    //   .withIndex("by_user", (q) => q.eq("userId", args.userId))
    //   .collect();
    // 
    // for (const completion of exerciseCompletions) {
    //   await ctx.db.delete(completion._id);
    // }
    // console.log(`[Reset Gamification] ✅ Deleted ${exerciseCompletions.length} exercise completions`);

    // Optional: Delete quiz progress (commented out - uncomment if needed)
    // const quizProgress = await ctx.db
    //   .query("quizProgress")
    //   .withIndex("by_user_unit", (q) => q.eq("userId", args.userId))
    //   .collect();
    // 
    // for (const progress of quizProgress) {
    //   await ctx.db.delete(progress._id);
    // }
    // console.log(`[Reset Gamification] ✅ Deleted ${quizProgress.length} quiz progress entries`);

    console.log(`[Reset Gamification] ✅ Gamification system reset complete for user: ${user.email || user.name || args.userId}`);

    return {
      success: true,
      badgesDeleted: badges.length,
      vocabProgressDeleted: vocabProgress.length,
      exerciseQuestionProgressDeleted: exerciseQuestionProgress.length,
      questionProgressDeleted: questionProgress.length,
      vocabularyDeleted: vocabulary.length,
    };
  },
});

// Reset all users to English (superadmin only) - BETA rollback
export const resetAllUsersToEnglish = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.role !== "superadmin") {
      throw new Error("Only superadmins can reset user languages");
    }

    const allUsers = await ctx.db.query("users").collect();
    let count = 0;

    for (const user of allUsers) {
      if (user.learningLanguage !== 'en') {
        await ctx.db.patch(user._id, { learningLanguage: 'en' });
        count++;
      }
    }

    return { count, total: allUsers.length };
  },
});

// Upsert chat prompt (admin/superadmin)
export const updateChatPrompt = mutation({
  args: {
    name: v.optional(v.string()),
    content: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const name = args.name || "default";
    const existing = await ctx.db
      .query("chatPrompts")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();

    const payload = {
      name,
      content: args.content,
      description: args.description,
      updatedBy: admin._id as Id<"users">,
      updatedAt: Date.now(),
    };

    // Append to history
    await ctx.db.insert("chatPromptHistory", payload);

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { updated: true, created: false };
    } else {
      await ctx.db.insert("chatPrompts", payload);
      return { updated: false, created: true };
    }
  },
});

// Alias for backward compatibility
export const setChatPrompt = updateChatPrompt;

// Chat prompt history (latest first, limited) with user info
export const getChatPromptHistory = query({
  args: {
    name: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) {
        console.log("getChatPromptHistory: Unauthorized");
        throw new Error("Unauthorized");
    }

    const name = args.name || "default";
    console.log(`getChatPromptHistory: Querying for name="${name}"`);
    const limit = args.limit && args.limit > 0 ? Math.min(args.limit, 50) : 20;
    const history = await ctx.db
      .query("chatPromptHistory")
      .withIndex("by_name_updatedAt", (q) => q.eq("name", name))
      .order("desc")
      .take(limit);
    console.log(`getChatPromptHistory: Found ${history.length} entries`);
    
    // Enrich with user info
    const enrichedHistory = await Promise.all(
      history.map(async (entry) => {
        let userName = "Unknown";
        if (entry.updatedBy) {
          const user = await ctx.db.get(entry.updatedBy);
          userName = user?.name || user?.email || "Unknown";
        }
        return {
          ...entry,
          updatedByName: userName,
        };
      })
    );
    
    return enrichedHistory;
  },
});

// Restore a specific version from history (superadmin only)
export const restoreChatPromptVersion = mutation({
  args: {
    historyId: v.id("chatPromptHistory"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin || admin.role !== "superadmin") {
      throw new Error("Unauthorized: Superadmin access required");
    }

    // Get the history entry
    const historyEntry = await ctx.db.get(args.historyId);
    if (!historyEntry) {
      throw new Error("History entry not found");
    }

    // Get the current prompt
    const existing = await ctx.db
      .query("chatPrompts")
      .withIndex("by_name", (q) => q.eq("name", historyEntry.name))
      .first();

    const payload = {
      name: historyEntry.name,
      content: historyEntry.content,
      description: `Restored from version: ${new Date(historyEntry.updatedAt).toLocaleString()}`,
      updatedBy: admin._id as Id<"users">,
      updatedAt: Date.now(),
    };

    // Save to history
    await ctx.db.insert("chatPromptHistory", payload);

    // Update or create current prompt
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("chatPrompts", payload);
    }

    return { success: true };
  },
});

// Delete a specific version from history (superadmin only)
export const deleteChatPromptVersion = mutation({
  args: {
    historyId: v.id("chatPromptHistory"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin || admin.role !== "superadmin") {
      throw new Error("Unauthorized: Superadmin access required");
    }

    const historyEntry = await ctx.db.get(args.historyId);
    if (!historyEntry) {
      throw new Error("History entry not found");
    }

    await ctx.db.delete(args.historyId);
    return { success: true };
  },
});

// Seed initial chat prompt (for migrations, requires ADMIN_SECRET)
export const seedChatPrompt = mutation({
  args: {
    name: v.string(),
    content: v.string(),
    description: v.optional(v.string()),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin secret from environment
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Invalid admin secret");
    }

    const name = args.name;
    const existing = await ctx.db
      .query("chatPrompts")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();

    const payload = {
      name,
      content: args.content,
      description: args.description,
      updatedBy: undefined, // No user for migration
      updatedAt: Date.now(),
    };

    // Add to history
    await ctx.db.insert("chatPromptHistory", payload);

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { updated: true, created: false, message: "Prompt updated successfully" };
    } else {
      await ctx.db.insert("chatPrompts", payload);
      return { updated: false, created: true, message: "Prompt created successfully" };
    }
  },
});

// Helper to get the current user (non-admin)
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// Mark Unit 1 as complete for current user
// This mutation allows users to mark Unit 1 as complete without redoing all exercises
export const markUnit1Complete = mutation({
  handler: async (ctx) => {
    console.log('[markUnit1Complete] Starting Unit 1 completion process');
    
    const user = await getCurrentUser(ctx);
    if (!user) {
      console.error('[markUnit1Complete] User not authenticated');
      throw new Error("Not authenticated");
    }

    console.log('[markUnit1Complete] User found:', user._id);
    if (user.role !== "superadmin") {
      console.error('[markUnit1Complete] Unauthorized role:', user.role);
      throw new Error("Unauthorized");
    }

    // Unit 1 vocabulary words (from shared/data/vocabulary/words.ts)
    const unit1VocabWords = [
      { serbian: "aerodrom", english: "airport" },
      { serbian: "pasoš", english: "passport" },
      { serbian: "karta", english: "ticket" },
      { serbian: "prtljag", english: "luggage" },
      { serbian: "dobar dan", english: "good day" },
      { serbian: "dobro jutro", english: "good morning" },
      { serbian: "dobro veče", english: "good evening" },
      { serbian: "laku noć", english: "good night" },
      { serbian: "hvala", english: "thank you" },
      { serbian: "molim", english: "please" },
      { serbian: "da", english: "yes" },
      { serbian: "ne", english: "no" },
      { serbian: "izvinite", english: "excuse me" },
      { serbian: "zdravo", english: "hello" },
      { serbian: "ćao", english: "bye" },
      { serbian: "doviđenja", english: "goodbye" },
      { serbian: "ja", english: "I" },
      { serbian: "ti", english: "you (informal)" },
      { serbian: "on", english: "he" },
      { serbian: "ona", english: "she" },
      { serbian: "ono", english: "it" },
      { serbian: "biti", english: "to be" },
      { serbian: "imati", english: "to have" },
    ];

    // 1. Process vocabulary: Set all Unit 1 vocab to Master status
    console.log('[markUnit1Complete] Processing vocabulary...');
    let vocabProcessed = 0;
    const now = Date.now();

    for (const vocabWord of unit1VocabWords) {
      // Use .collect() instead of .first() to find ALL duplicates
      const existingEntries = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", user._id).eq("unitNumber", 1)
        )
        .filter((q) => q.eq(q.field("serbianWord"), vocabWord.serbian))
        .collect();

      if (existingEntries.length > 0) {
        // Sort by creation time to get the oldest entry (keep this one)
        const sortedEntries = existingEntries.sort(
          (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
        );
        const oldestEntry = sortedEntries[0];
        const duplicates = sortedEntries.slice(1);

        // Merge counts from duplicates into oldest entry
        let mergedReviewCount = oldestEntry.reviewCount || 0;
        let mergedCorrectCount = oldestEntry.correctAnswerCount || 0;

        for (const dup of duplicates) {
          mergedReviewCount += dup.reviewCount || 0;
          mergedCorrectCount += dup.correctAnswerCount || 0;
        }

        // Update oldest entry to Master status with merged counts
        await ctx.db.patch(oldestEntry._id, {
          correctAnswerCount: Math.max(mergedCorrectCount, 3),
          mastered: true,
          reviewCount: Math.max(mergedReviewCount, 3),
          lastReviewedAt: now,
        });

        // Delete duplicates immediately
        for (const dup of duplicates) {
          await ctx.db.delete(dup._id);
        }
        vocabProcessed++;
      } else {
        // Create new vocabulary entry with Master status
        const newId = await ctx.db.insert("vocabulary", {
          userId: user._id,
          serbianWord: vocabWord.serbian,
          englishTranslation: vocabWord.english,
          unitNumber: 1,
          mastered: true,
          reviewCount: 3,
          correctAnswerCount: 3,
          incorrectAnswerCount: 0,
          lastReviewedAt: now,
        });

        // Immediate cleanup check: verify no duplicates were created (race condition protection)
        const verifyEntries = await ctx.db
          .query("vocabulary")
          .withIndex("by_user_unit", (q) =>
            q.eq("userId", user._id).eq("unitNumber", 1)
          )
          .filter((q) => q.eq(q.field("serbianWord"), vocabWord.serbian))
          .collect();

        if (verifyEntries.length > 1) {
          // Race condition detected! Clean up immediately
          const sortedVerify = verifyEntries.sort(
            (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
          );
          const keepEntry = sortedVerify[0];
          const verifyDuplicates = sortedVerify.slice(1);

          // Merge counts
          let mergedReviewCount = keepEntry.reviewCount || 0;
          let mergedCorrectCount = keepEntry.correctAnswerCount || 0;

          for (const dup of verifyDuplicates) {
            mergedReviewCount += dup.reviewCount || 0;
            mergedCorrectCount += dup.correctAnswerCount || 0;
          }

          // Update kept entry
          await ctx.db.patch(keepEntry._id, {
            correctAnswerCount: Math.max(mergedCorrectCount, 3),
            mastered: true,
            reviewCount: Math.max(mergedReviewCount, 3),
            lastReviewedAt: now,
          });

          // Delete duplicates
          for (const dup of verifyDuplicates) {
            await ctx.db.delete(dup._id);
          }
        }
        vocabProcessed++;
      }
    }

    console.log(`[markUnit1Complete] Processed ${vocabProcessed} vocabulary words`);

    // 2. Create/update exercise completions for all 3 Unit 1 exercises
    console.log('[markUnit1Complete] Processing exercises...');
    const exercises = [
      {
        exerciseId: "unit1-biti-conjugation",
        exerciseType: "fillInBlank",
        score: 6,
        totalQuestions: 6,
        xpEarned: 16,
      },
      {
        exerciseId: "unit1-basic-phrases",
        exerciseType: "translation",
        score: 5,
        totalQuestions: 5,
        xpEarned: 16,
      },
      {
        exerciseId: "unit1-gender",
        exerciseType: "fillInBlank",
        score: 5,
        totalQuestions: 5,
        xpEarned: 16,
      },
    ];

    let exercisesProcessed = 0;
    let totalXPEarned = 0;

    for (const exercise of exercises) {
      // Check if exercise completion already exists
      const existingCompletion = await ctx.db
        .query("exerciseCompletions")
        .withIndex("by_user_exercise", (q) =>
          q.eq("userId", user._id)
           .eq("exerciseId", exercise.exerciseId)
           .eq("unitNumber", 1)
        )
        .first();

      if (existingCompletion) {
        // Update existing completion to perfect score
        await ctx.db.patch(existingCompletion._id, {
          score: exercise.score,
          totalQuestions: exercise.totalQuestions,
          xpEarned: exercise.xpEarned,
        });
        exercisesProcessed++;
      } else {
        // Create new exercise completion
        await ctx.db.insert("exerciseCompletions", {
          userId: user._id,
          unitNumber: 1,
          exerciseId: exercise.exerciseId,
          score: exercise.score,
          totalQuestions: exercise.totalQuestions,
          xpEarned: exercise.xpEarned,
        });
        exercisesProcessed++;
      }
      totalXPEarned += exercise.xpEarned;
    }

    console.log(`[markUnit1Complete] Processed ${exercisesProcessed} exercises, total XP: ${totalXPEarned}`);

    // 3. Update user progress: Mark Unit 1 as completed and set currentUnit to 2
    console.log('[markUnit1Complete] Updating user progress...');
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (progress) {
      const completedUnits = progress.completedUnits.includes(1)
        ? progress.completedUnits
        : [...progress.completedUnits, 1];
      
      await ctx.db.patch(progress._id, {
        completedUnits,
        currentUnit: Math.max(progress.currentUnit, 2),
      });
      console.log(`[markUnit1Complete] Updated progress: completedUnits=${completedUnits}, currentUnit=${Math.max(progress.currentUnit, 2)}`);
    } else {
      // Create new progress if it doesn't exist
      await ctx.db.insert("userProgress", {
        userId: user._id,
        currentUnit: 2,
        completedUnits: [1],
        learningDuration: 12,
        uiLanguage: "en",
      });
      console.log('[markUnit1Complete] Created new progress record');
    }

    // 4. Update user XP and level
    console.log('[markUnit1Complete] Updating XP and level...');
    const newTotalXP = user.totalXP + totalXPEarned;
    const newLevel = Math.floor(newTotalXP / 300) + 1;

    await ctx.db.patch(user._id, {
      totalXP: newTotalXP,
      level: newLevel,
    });

    if (totalXPEarned > 0) {
      await upsertDailyActivityByUserId(ctx, user._id, {
        xpEarned: totalXPEarned,
        exercisesCompleted: exercisesProcessed,
        unitsCompleted: 1,
      });
    }

    console.log(`[markUnit1Complete] Updated XP: ${user.totalXP} → ${newTotalXP}, Level: ${user.level} → ${newLevel}`);

    console.log('[markUnit1Complete] ✅ Unit 1 completion process finished successfully');

    return {
      success: true,
      vocabProcessed,
      exercisesProcessed,
      xpEarned: totalXPEarned,
      newTotalXP,
      newLevel,
    };
  },
});

export const simulateUnitProgress = mutation({
  args: {
    automationKey: v.string(),
    userId: v.id("users"),
    unitNumber: v.number(),
    targetStatus: v.union(v.literal("completed"), v.literal("mastered")),
    simulatedQuestionCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const automationSecret = process.env.BOT_AUTOMATION_KEY;
    if (!automationSecret) {
      throw new Error("Automation key not configured on server");
    }
    if (args.automationKey !== automationSecret) {
      throw new Error("Invalid automation key");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const unitNumber = Math.max(1, args.unitNumber);
    const now = Date.now();
    const vocabTargetCount = args.targetStatus === "mastered" ? 3 : 1;
    const vocabWords = VOCABULARY.filter((word) => word.unit === unitNumber);
    let vocabProcessed = 0;

    for (const word of vocabWords) {
      // Use .collect() instead of .first() to find ALL duplicates
      const existingEntries = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_unit", (q) => q.eq("userId", args.userId).eq("unitNumber", unitNumber))
        .filter((q) => q.eq(q.field("serbianWord"), word.serbian))
        .collect();

      const payload = {
        userId: args.userId as Id<"users">,
        serbianWord: word.serbian,
        englishTranslation: word.translations?.en || word.translations?.de || "",
        unitNumber,
        mastered: vocabTargetCount >= 3,
        reviewCount: vocabTargetCount,
        correctAnswerCount: vocabTargetCount,
        incorrectAnswerCount: 0,
        lastReviewedAt: now,
        lastAnsweredAt: now,
      };

      if (existingEntries.length > 0) {
        // Sort by creation time to get the oldest entry (keep this one)
        const sortedEntries = existingEntries.sort(
          (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
        );
        const oldestEntry = sortedEntries[0];
        const duplicates = sortedEntries.slice(1);

        // Merge counts from duplicates into oldest entry
        let mergedReviewCount = oldestEntry.reviewCount || 0;
        let mergedCorrectCount = oldestEntry.correctAnswerCount || 0;
        let mergedIncorrectCount = oldestEntry.incorrectAnswerCount || 0;

        for (const dup of duplicates) {
          mergedReviewCount += dup.reviewCount || 0;
          mergedCorrectCount += dup.correctAnswerCount || 0;
          mergedIncorrectCount += dup.incorrectAnswerCount || 0;
        }

        // Update oldest entry with merged counts + target values
        await ctx.db.patch(oldestEntry._id, {
          ...payload,
          reviewCount: Math.max(mergedReviewCount, vocabTargetCount),
          correctAnswerCount: Math.max(mergedCorrectCount, vocabTargetCount),
          incorrectAnswerCount: mergedIncorrectCount,
        });

        // Delete duplicates immediately
        for (const dup of duplicates) {
          await ctx.db.delete(dup._id);
        }
        vocabProcessed++;
      } else {
        const newId = await ctx.db.insert("vocabulary", payload);

        // Immediate cleanup check: verify no duplicates were created (race condition protection)
        const verifyEntries = await ctx.db
          .query("vocabulary")
          .withIndex("by_user_unit", (q) => q.eq("userId", args.userId).eq("unitNumber", unitNumber))
          .filter((q) => q.eq(q.field("serbianWord"), word.serbian))
          .collect();

        if (verifyEntries.length > 1) {
          // Race condition detected! Clean up immediately
          const sortedVerify = verifyEntries.sort(
            (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
          );
          const keepEntry = sortedVerify[0];
          const verifyDuplicates = sortedVerify.slice(1);

          // Merge counts
          let mergedReviewCount = keepEntry.reviewCount || 0;
          let mergedCorrectCount = keepEntry.correctAnswerCount || 0;
          let mergedIncorrectCount = keepEntry.incorrectAnswerCount || 0;

          for (const dup of verifyDuplicates) {
            mergedReviewCount += dup.reviewCount || 0;
            mergedCorrectCount += dup.correctAnswerCount || 0;
            mergedIncorrectCount += dup.incorrectAnswerCount || 0;
          }

          // Update kept entry
          await ctx.db.patch(keepEntry._id, {
            ...payload,
            reviewCount: Math.max(mergedReviewCount, vocabTargetCount),
            correctAnswerCount: Math.max(mergedCorrectCount, vocabTargetCount),
            incorrectAnswerCount: mergedIncorrectCount,
          });

          // Delete duplicates
          for (const dup of verifyDuplicates) {
            await ctx.db.delete(dup._id);
          }
        }
        vocabProcessed++;
      }
    }

    const exerciseIds = UNIT_EXERCISES[unitNumber] || [];
    const xpPerExercise = 16;
    let exercisesProcessed = 0;

    for (const exerciseId of exerciseIds) {
      const completion = await ctx.db
        .query("exerciseCompletions")
        .withIndex("by_user_exercise", (q) =>
          q.eq("userId", args.userId).eq("exerciseId", exerciseId).eq("unitNumber", unitNumber)
        )
        .first();

      const completionPayload = {
        userId: args.userId as Id<"users">,
        unitNumber,
        exerciseId,
        score: 10,
        totalQuestions: 10,
        xpEarned: xpPerExercise,
      };

      if (completion) {
        await ctx.db.patch(completion._id, completionPayload);
      } else {
        await ctx.db.insert("exerciseCompletions", completionPayload);
      }
      exercisesProcessed++;
    }

    if (args.targetStatus === "mastered") {
      const questionCount =
        args.simulatedQuestionCount && args.simulatedQuestionCount > 0
          ? Math.min(args.simulatedQuestionCount, 20)
          : 8;
      for (const exerciseId of exerciseIds) {
        for (let i = 1; i <= questionCount; i++) {
          const questionId = `${exerciseId}-simulated-q${i}`;
          const progressEntry = await ctx.db
            .query("exerciseQuestionProgress")
            .withIndex("by_user_question", (q) =>
              q.eq("userId", args.userId).eq("exerciseId", exerciseId).eq("questionId", questionId)
            )
            .first();

          const questionPayload = {
            userId: args.userId as Id<"users">,
            exerciseId,
            questionId,
            unitNumber,
            correctAnswerCount: 3,
            incorrectAnswerCount: 0,
            mastered: true,
            lastAnsweredAt: now,
            lastReviewedAt: now,
          };

          if (progressEntry) {
            await ctx.db.patch(progressEntry._id, questionPayload);
          } else {
            await ctx.db.insert("exerciseQuestionProgress", questionPayload);
          }
        }
      }
    }

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const completedUnits = progress?.completedUnits || [];
    const nextCompleted = completedUnits.includes(unitNumber)
      ? completedUnits
      : [...completedUnits, unitNumber].sort((a, b) => a - b);
    const nextCurrentUnit = Math.max(progress?.currentUnit || 1, unitNumber + 1);

    if (progress) {
      await ctx.db.patch(progress._id, {
        completedUnits: nextCompleted,
        currentUnit: nextCurrentUnit,
        lastActivityAt: now,
      });
    } else {
      await ctx.db.insert("userProgress", {
        userId: args.userId as Id<"users">,
        currentUnit: nextCurrentUnit,
        completedUnits: nextCompleted,
        learningDuration: 12,
        uiLanguage: "en",
        lastActivityAt: now,
      });
    }

    const xpEarned = exercisesProcessed * xpPerExercise;
    const newTotalXP = user.totalXP + xpEarned;
    const newLevel = Math.floor(newTotalXP / 300) + 1;

    await ctx.db.patch(user._id, {
      totalXP: newTotalXP,
      level: newLevel,
      lastActiveDate: now,
    });

    if (xpEarned > 0) {
      await upsertDailyActivityByUserId(ctx, user._id, {
        xpEarned,
        exercisesCompleted: exercisesProcessed,
        unitsCompleted: 1,
      });
    }

    return {
      success: true,
      unitNumber,
      mode: args.targetStatus,
      vocabProcessed,
      exercisesProcessed,
      xpEarned,
      totalXP: newTotalXP,
      level: newLevel,
    };
  },
});

// ============= TEMPORARY CLEANUP FUNCTIONS (BETA ONLY) =============
// These functions are used for beta cleanup scripts and should be removed after beta

/**
 * TEMPORARY: Get all users without auth (for cleanup scripts)
 * TODO: Remove after beta phase
 */
export const getAllUsersTemp = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users;
  },
});

/**
 * TEMPORARY: Update user language without auth (for cleanup scripts)
 * TODO: Remove after beta phase
 */
export const updateUserLanguageTemp = mutation({
  args: {
    userId: v.id("users"),
    learningLanguage: v.union(
      v.literal("en"),
      v.literal("de"),
      v.literal("es"),
      v.literal("fr")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      learningLanguage: args.learningLanguage,
    });
    return { success: true };
  },
});

/**
 * TEMPORARY: Get all userProgress without auth (for migration scripts)
 * TODO: Remove after migration
 */
export const getAllUserProgressTemp = query({
  handler: async (ctx) => {
    const allProgress = await ctx.db.query("userProgress").collect();
    return allProgress;
  },
});

/**
 * TEMPORARY: Remove currentWeek field from userProgress (for migration)
 * TODO: Remove after migration
 */
export const removeCurrentWeekFromProgress = mutation({
  args: {
    progressId: v.id("userProgress"),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db.get(args.progressId);
    if (!progress) {
      throw new Error("Progress not found");
    }

    // Replace the entire document without currentWeek
    await ctx.db.replace(args.progressId, {
      userId: progress.userId,
      currentUnit: progress.currentUnit,
      completedUnits: progress.completedUnits,
      learningDuration: progress.learningDuration,
      uiLanguage: progress.uiLanguage,
      lastActivityAt: progress.lastActivityAt,
    });

    return { success: true };
  },
});

// ============= BACKUP MANAGEMENT =============

/**
 * Liste alle Backups (Admin only)
 * Zeigt die letzten 100 Backups mit Metadata
 */
export const listBackups = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    return await ctx.db
      .query("backupMetadata")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
  },
});

/**
 * Backup-Download-URL generieren (Admin only)
 * URL ist 1 Stunde gültig
 */
export const getBackupUrl = query({
  args: { backupId: v.id("backupMetadata") },
  handler: async (ctx, { backupId }) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const backup = await ctx.db.get(backupId);
    if (!backup) throw new Error("Backup not found");

    // Convex Storage URL generieren (1h gültig)
    const url = await ctx.storage.getUrl(backup.storageId);
    return url;
  },
});

/**
 * Backup manuell auslösen (Superadmin only)
 * Triggert sofort ein Backup ohne auf den Cron Job zu warten
 */
export const triggerBackupNow = mutation({
  handler: async (ctx) => {
    const user = await getAdminUser(ctx);
    if (!user || user.role !== "superadmin") {
      throw new Error("Unauthorized - Superadmin required");
    }

    await ctx.scheduler.runAfter(0, internal.backup.createDatabaseBackup);
    
    return { success: true, message: "Backup triggered" };
  },
});

// Upsert email template (for migrations, requires ADMIN_SECRET)
export const adminUpsertEmailTemplate = mutation({
  args: {
    adminSecret: v.string(),
    name: v.string(),
    subject: v.string(),
    htmlContent: v.string(),
    description: v.optional(v.string()),
    variables: v.array(v.string()),
    category: v.union(
      v.literal("transactional"),
      v.literal("subscription"),
      v.literal("marketing")
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Verify admin secret from environment
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Invalid admin secret");
    }

    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        subject: args.subject,
        htmlContent: args.htmlContent,
        description: args.description,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create
      return await ctx.db.insert("emailTemplates", {
        name: args.name,
        subject: args.subject,
        htmlContent: args.htmlContent,
        description: args.description,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Upsert email signature (for migrations, requires ADMIN_SECRET)
export const adminUpsertEmailSignature = mutation({
  args: {
    adminSecret: v.string(),
    category: v.union(v.literal("transactional"), v.literal("subscription"), v.literal("marketing")),
    htmlContent: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Invalid admin secret");
    }

    const existing = await ctx.db
      .query("emailSignatures")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        htmlContent: args.htmlContent,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("emailSignatures", {
      category: args.category,
      htmlContent: args.htmlContent,
      isActive: args.isActive,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

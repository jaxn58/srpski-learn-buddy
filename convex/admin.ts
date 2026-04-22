import { v } from "convex/values";
import { assertLearnerAccountActive } from "./authz";
import { mutation, query, internalQuery, internalMutation, action, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { VOCABULARY } from "../shared/data/vocabulary/words";
import { UNIT_EXERCISES } from "./unitExercises";
import { upsertDailyActivityByUserId } from "./units";
import { requireSuperadminAction, callAiText } from "./contentStudio/_shared";

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

export const getAllChatPrompts = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    return await ctx.db.query("chatPrompts").collect();
  },
});

// Internal Query to fetch prompt by name without requiring user identity (for server-side actions).
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

// Get 24-hour registration and activity stats (admin only)
export const get24hStats = query({
  args: {
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const users = await ctx.db.query("users").collect();

    const registrationsLast24h = users.filter(u => u._creationTime > args.since).length;
    const activeUsersLast24h = users.filter(u => u.lastActiveDate && u.lastActiveDate > args.since).length;

    return {
      registrationsLast24h,
      activeUsersLast24h,
      totalUsers: users.length,
    };
  },
});

// Get a single user by ID with progress and subscription (admin only)
export const getUserById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const allSubscriptions = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const activeSubscription = allSubscriptions.find(s => s.status === "active") || null;

    const planNames: Record<string, string> = {
      intensive: "Intensive",
      balanced: "Balanced",
      standard: "Standard",
      relaxed: "Relaxed",
    };

    // Resolve avatar storage URL
    let avatarUrl: string | null = null;
    if (user.publicAvatarStorageId) {
      avatarUrl = await ctx.storage.getUrl(user.publicAvatarStorageId) ?? null;
    } else if (user.publicAvatarUrl) {
      avatarUrl = user.publicAvatarUrl;
    }

    // Resolve newsletter/community updates status
    let newsletterStatus: { subscribed: boolean; pending: boolean } = { subscribed: false, pending: false };
    if (user.email) {
      const contact = await ctx.db
        .query("newsletterContacts")
        // @ts-ignore TS2589 – Convex schema depth limit
        .withIndex("by_email", (q: any) => q.eq("email", user.email!))
        .first();
      if (contact) {
        const pending =
          contact.subscribed !== true &&
          contact.optInPurpose === "community_updates" &&
          typeof contact.optInToken === "string" &&
          contact.optInToken.length > 0;
        newsletterStatus = {
          subscribed: contact.subscribed === true,
          pending,
        };
      }
    }

    return {
      ...user,
      avatarUrl,
      newsletterStatus,
      progress: progress || null,
      subscription: activeSubscription
        ? { ...activeSubscription, planName: planNames[activeSubscription.planType] || activeSubscription.planType }
        : null,
    };
  },
});

// Get all users (admin only) - batch-read to avoid N+1
export const getAllUsers = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const users = await ctx.db.query("users").collect();
    const allProgress = await ctx.db.query("userProgress").collect();
    const allSubscriptions = await ctx.db.query("userSubscriptions").collect();

    const progressByUser = new Map(allProgress.map(p => [p.userId.toString(), p]));
    const activeSubByUser = new Map<string, typeof allSubscriptions[number]>();
    for (const sub of allSubscriptions) {
      if (sub.status === "active") {
        activeSubByUser.set(sub.userId.toString(), sub);
      }
    }

    const planNames: Record<string, string> = {
      intensive: "Intensive",
      balanced: "Balanced",
      standard: "Standard",
      relaxed: "Relaxed",
    };

    return Promise.all(users.map(async (user) => {
      const progress = progressByUser.get(user._id.toString()) || null;
      const subscription = activeSubByUser.get(user._id.toString()) || null;

      let avatarUrl: string | null = null;
      if (user.publicAvatarStorageId) {
        avatarUrl = await ctx.storage.getUrl(user.publicAvatarStorageId) ?? null;
      } else if (user.publicAvatarUrl) {
        avatarUrl = user.publicAvatarUrl;
      }

      return {
        ...user,
        avatarUrl,
        progress,
        subscription: subscription
          ? { ...subscription, planName: planNames[subscription.planType] || subscription.planType }
          : null,
      };
    }));
  },
});

// Get all user progress (admin only) - batch-read to avoid N+1
export const getAllProgress = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const allProgress = await ctx.db.query("userProgress").collect();
    const allUsers = await ctx.db.query("users").collect();
    const allSubscriptions = await ctx.db.query("userSubscriptions").collect();

    const usersById = new Map(allUsers.map(u => [u._id.toString(), u]));
    const activeSubByUser = new Map<string, typeof allSubscriptions[number]>();
    for (const sub of allSubscriptions) {
      if (sub.status === "active") {
        activeSubByUser.set(sub.userId.toString(), sub);
      }
    }

    return allProgress.map(progress => {
      const user = usersById.get(progress.userId.toString());
      const subscription = activeSubByUser.get(progress.userId.toString());
      return {
        ...progress,
        userName: user?.name || user?.email || "Unknown",
        userEmail: user?.email || "",
        planDurationMonths: subscription?.planDurationMonths ?? null,
      };
    });
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

// Update user learning language (internal only, for migration scripts)
export const updateUser = internalMutation({
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

// ============================================================================
// USER DELETION — CENTRAL FLOW
// ============================================================================
// The deletion is split across three functions that all share the same
// cascade logic. `fetch()` to the Clerk API is forbidden inside mutations, so
// the public admin endpoint is an `action` that orchestrates:
//
//   1) internalQuery `_requireAdminForUserDelete`   – auth + look up target
//   2) fetch DELETE https://api.clerk.com/v1/users  – remove from Clerk
//   3) internalMutation `_deleteUserCascade`        – wipe Convex rows
//
// The webhook path (`user.deleted` from Clerk) and the self-service flow
// reuse `_deleteUserCascade` so there is only one place that knows how to
// tear down user data.
// ============================================================================

// Internal auth/lookup for the admin delete action. Returns the target user's
// Clerk ID and a few labels for logging. The action cannot call ctx.db/auth
// itself, so this helper is used via ctx.runQuery().
export const _requireAdminForUserDelete = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    if (args.userId === admin._id) {
      throw new Error("Cannot delete your own account");
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");

    return {
      adminId: admin._id,
      userId: target._id,
      clerkId: target.clerkId ?? null,
      email: target.email ?? null,
      name: target.name ?? null,
    };
  },
});

// Idempotent cascade delete. Safe to call from:
//   - admin action (after Clerk delete succeeded)
//   - Clerk webhook `user.deleted`
//   - self-service action
// If the user row is already gone, returns { alreadyGone: true }.
export const _deleteUserCascade = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return {
        alreadyGone: true as const,
        deleted: {} as Record<string, number>,
        totalRows: 0,
      };
    }

    const counts: Record<string, number> = {};

    const bump = (table: string, n: number) => {
      counts[table] = (counts[table] ?? 0) + n;
    };

    // ---- Core user domain ----
    const userProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of userProgress) await ctx.db.delete(row._id);
    bump("userProgress", userProgress.length);

    const userSubscriptions = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of userSubscriptions) await ctx.db.delete(row._id);
    bump("userSubscriptions", userSubscriptions.length);

    const subscriptionHistory = await ctx.db
      .query("subscriptionHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of subscriptionHistory) await ctx.db.delete(row._id);
    bump("subscriptionHistory", subscriptionHistory.length);

    // ---- Progress & gamification ----
    const exerciseQuestionProgress = await ctx.db
      .query("exerciseQuestionProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of exerciseQuestionProgress) await ctx.db.delete(row._id);
    bump("exerciseQuestionProgress", exerciseQuestionProgress.length);

    const questionProgress = await ctx.db
      .query("questionProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of questionProgress) await ctx.db.delete(row._id);
    bump("questionProgress", questionProgress.length);

    const exerciseResults = await ctx.db
      .query("exerciseResults")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of exerciseResults) await ctx.db.delete(row._id);
    bump("exerciseResults", exerciseResults.length);

    const exerciseCompletions = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of exerciseCompletions) await ctx.db.delete(row._id);
    bump("exerciseCompletions", exerciseCompletions.length);

    const userBadges = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of userBadges) await ctx.db.delete(row._id);
    bump("userBadges", userBadges.length);

    // dailyActivity has composite `by_user_date` index; filter by userId.
    const dailyActivity = await ctx.db
      .query("dailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of dailyActivity) await ctx.db.delete(row._id);
    bump("dailyActivity", dailyActivity.length);

    // ---- Vocabulary ----
    const vocabularyProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of vocabularyProgress) await ctx.db.delete(row._id);
    bump("vocabularyProgress", vocabularyProgress.length);

    const quizProgress = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of quizProgress) await ctx.db.delete(row._id);
    bump("quizProgress", quizProgress.length);

    // ---- Feedback (submissions + all child rows, regardless of author) ----
    const feedbackSubmissions = await ctx.db
      .query("feedbackSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let feedbackMessagesCount = 0;
    let feedbackCommentsCount = 0;
    let feedbackStatusHistoryCount = 0;
    for (const sub of feedbackSubmissions) {
      const msgs = await ctx.db
        .query("feedbackMessages")
        .withIndex("by_feedback", (q) => q.eq("feedbackId", sub._id))
        .collect();
      for (const m of msgs) await ctx.db.delete(m._id);
      feedbackMessagesCount += msgs.length;

      const comments = await ctx.db
        .query("feedbackComments")
        .withIndex("by_feedback", (q) => q.eq("feedbackId", sub._id))
        .collect();
      for (const c of comments) await ctx.db.delete(c._id);
      feedbackCommentsCount += comments.length;

      const history = await ctx.db
        .query("feedbackStatusHistory")
        .withIndex("by_feedback", (q) => q.eq("feedbackId", sub._id))
        .collect();
      for (const h of history) await ctx.db.delete(h._id);
      feedbackStatusHistoryCount += history.length;

      await ctx.db.delete(sub._id);
    }
    bump("feedbackSubmissions", feedbackSubmissions.length);
    bump("feedbackMessages", feedbackMessagesCount);
    bump("feedbackComments", feedbackCommentsCount);
    bump("feedbackStatusHistory", feedbackStatusHistoryCount);

    // Stand-alone feedbackComments authored by this user on OTHER users'
    // submissions (no by_user index exists, so filter scan is acceptable here
    // since the table stays small relative to progress tables).
    const orphanComments = await ctx.db
      .query("feedbackComments")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();
    for (const row of orphanComments) await ctx.db.delete(row._id);
    bump("feedbackCommentsOrphan", orphanComments.length);

    // ---- Wishlist (items the user created + all dependent upvotes) ----
    const wishlistItems = await ctx.db
      .query("wishlistItems")
      .withIndex("by_user_createdAt", (q) => q.eq("createdBy", args.userId))
      .collect();

    let wishlistUpvotesFromItemsCount = 0;
    for (const item of wishlistItems) {
      const upvotes = await ctx.db
        .query("wishlistUpvotes")
        .withIndex("by_item", (q) => q.eq("wishlistItemId", item._id))
        .collect();
      for (const uv of upvotes) await ctx.db.delete(uv._id);
      wishlistUpvotesFromItemsCount += upvotes.length;
      await ctx.db.delete(item._id);
    }
    bump("wishlistItems", wishlistItems.length);
    bump("wishlistUpvotes", wishlistUpvotesFromItemsCount);

    // Upvotes the user gave to OTHER items.
    const wishlistUpvotesByUser = await ctx.db
      .query("wishlistUpvotes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of wishlistUpvotesByUser) await ctx.db.delete(row._id);
    bump("wishlistUpvotes", wishlistUpvotesByUser.length);

    // ---- Chat ----
    const chatSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let chatMessagesCount = 0;
    for (const session of chatSessions) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const m of messages) await ctx.db.delete(m._id);
      chatMessagesCount += messages.length;
      await ctx.db.delete(session._id);
    }
    bump("chatSessions", chatSessions.length);
    bump("chatMessages", chatMessagesCount);

    // ---- Finally, the user row itself ----
    await ctx.db.delete(args.userId);
    bump("users", 1);

    const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

    console.log("[Delete User] Cascade complete", {
      userId: args.userId,
      email: user.email ?? null,
      totalRows,
      counts,
    });

    return {
      alreadyGone: false as const,
      deleted: counts,
      totalRows,
    };
  },
});

// Look up a Convex user by their Clerk ID. Used by the Clerk `user.deleted`
// webhook to find which Convex row to cascade-delete.
export const _findUserIdByClerkId = internalQuery({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return user ? { userId: user._id, email: user.email ?? null } : null;
  },
});

// Public admin endpoint. Runs in the action runtime so we can call the Clerk
// REST API. All DB work is delegated to internal queries/mutations.
export const deleteUser = action({
  args: {
    userId: v.id("users"),
    // When true, proceed with Convex deletion even if the Clerk API call
    // fails (e.g. to clean up orphaned records). Default false.
    forceIfClerkFails: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    clerkDeletionStatus:
      | "success"
      | "already_gone"
      | "no_clerk_id"
      | "no_api_key"
      | "failed"
      | "error"
      | "skipped_by_force_flag";
    clerkErrorMessage: string;
    convexDeletionStatus: "success" | "skipped" | "already_gone";
    deleted: Record<string, number>;
    totalRows: number;
    warning?: string;
  }> => {
    const target = await ctx.runQuery(
      internal.admin._requireAdminForUserDelete,
      { userId: args.userId }
    );

    console.log(
      `[Delete User] Admin ${target.adminId} deleting user: ${target.email || target.name || target.userId}`
    );

    let clerkDeletionStatus:
      | "success"
      | "already_gone"
      | "no_clerk_id"
      | "no_api_key"
      | "failed"
      | "error"
      | "skipped_by_force_flag" = "no_clerk_id";
    let clerkErrorMessage = "";

    if (target.clerkId) {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) {
        clerkDeletionStatus = "no_api_key";
        clerkErrorMessage = "CLERK_SECRET_KEY not set";
        console.warn(
          "[Delete User] CLERK_SECRET_KEY missing - Clerk user will survive"
        );
      } else {
        try {
          const resp = await fetch(
            `https://api.clerk.com/v1/users/${target.clerkId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (resp.ok) {
            clerkDeletionStatus = "success";
            console.log(
              `[Delete User] Clerk delete OK for ${target.clerkId}`
            );
          } else if (resp.status === 404) {
            clerkDeletionStatus = "already_gone";
            console.log(
              `[Delete User] Clerk user ${target.clerkId} already gone (404)`
            );
          } else {
            const body = await resp.text().catch(() => "<read_failed>");
            clerkDeletionStatus = "failed";
            clerkErrorMessage = `Clerk API ${resp.status}: ${body}`;
            console.error(
              `[Delete User] Clerk delete failed (${resp.status})`,
              body
            );
          }
        } catch (error) {
          clerkDeletionStatus = "error";
          clerkErrorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("[Delete User] Clerk API threw", error);
        }
      }
    }

    const clerkOk =
      clerkDeletionStatus === "success" ||
      clerkDeletionStatus === "already_gone" ||
      clerkDeletionStatus === "no_clerk_id";

    if (!clerkOk && !args.forceIfClerkFails) {
      return {
        success: false,
        clerkDeletionStatus,
        clerkErrorMessage,
        convexDeletionStatus: "skipped",
        deleted: {},
        totalRows: 0,
        warning:
          "Clerk deletion failed. Convex data kept intact to avoid a zombie record. Re-run with forceIfClerkFails=true to override.",
      };
    }

    const cascade = await ctx.runMutation(
      internal.admin._deleteUserCascade,
      { userId: args.userId }
    );

    return {
      success: true,
      clerkDeletionStatus,
      clerkErrorMessage,
      convexDeletionStatus: cascade.alreadyGone ? "already_gone" : "success",
      deleted: cascade.deleted,
      totalRows: cascade.totalRows,
      warning:
        clerkDeletionStatus === "no_api_key"
          ? "CLERK_SECRET_KEY was not set - user still exists in Clerk and can sign in."
          : clerkDeletionStatus === "failed" ||
              clerkDeletionStatus === "error"
            ? "Clerk deletion failed but Convex data was removed (forceIfClerkFails)."
            : undefined,
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

    let name = args.name || "default";
    
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
      return { updated: true, created: false, name };
    } else {
      await ctx.db.insert("chatPrompts", payload);
      return { updated: false, created: true, name };
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

  if (user) {
    assertLearnerAccountActive(user);
  }
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

    let vocabProcessed = 0;
    const now = Date.now();

    // 1. Create/update exercise completions for all 3 Unit 1 exercises
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

// Get all email templates (for migrations, requires ADMIN_SECRET)
export const adminGetAllEmailTemplates = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized - Invalid admin secret");
    }

    return await ctx.db.query("emailTemplates").collect();
  },
});

// Get all email signatures (for migrations, requires ADMIN_SECRET)
export const adminGetAllEmailSignatures = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized - Invalid admin secret");
    }

    return await ctx.db.query("emailSignatures").collect();
  },
});

// Upsert email signature (for migrations, requires ADMIN_SECRET)
export const adminUpsertEmailSignature = mutation({
  args: {
    adminSecret: v.string(),
    category: v.union(
      v.literal("transactional"),
      v.literal("subscription"),
      v.literal("marketing")
    ),
    htmlContent: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized - Invalid admin secret");
    }

    const existing = await ctx.db
      .query("emailSignatures")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .first();

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        htmlContent: args.htmlContent,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create
      return await ctx.db.insert("emailSignatures", {
        category: args.category,
        htmlContent: args.htmlContent,
        isActive: args.isActive,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
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

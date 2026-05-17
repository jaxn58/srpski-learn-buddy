import { v } from "convex/values";
import { mutation, query, internalMutation, action, QueryCtx, MutationCtx, internalQuery, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { upsertDailyActivityByUserId } from "./units";
import { assertLearnerAccountActive } from "./authz";

type UserDoc = Doc<"users">;
type FixUserNameResult = { success: boolean; userId: Id<"users">; name: string };
type UpdateXpResult = { totalXP: number; level: number };

function isProductionDeployment() {
  // Keep in sync with other production checks in the codebase (e.g. convex/backup.ts)
  return process.env.CONVEX_CLOUD_URL?.includes("fleet-labrador-324") === true;
}

// Helper to get the current user from Clerk identity
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

// Get current authenticated user
export const me = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    try {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
      return user ?? null;
    } catch (error) {
      console.error("[users.me] Error fetching user", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },
});

// Sync user from Clerk (called on first sign-in)
export const syncUser = mutation({
  args: {
    // Optional: User's chosen learning language (from landing page selection)
    learningLanguage: v.optional(v.union(
      v.literal("en"),
      v.literal("de"),
      v.literal("es"),
      v.literal("fr")
    ))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate identity.subject (Clerk ID)
    if (!identity.subject || typeof identity.subject !== "string") {
      throw new Error("Invalid Clerk ID");
    }

    // Check if user already exists by Clerk ID
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existing) {
      assertLearnerAccountActive(existing);

      const updates: any = {
        lastActiveDate: Date.now(),
      };
      
      // Do NOT overwrite an existing user's language via sync.
      // Language changes are handled explicitly via `updateLearningLanguage`.
      // We only backfill language for legacy users that don't have it set yet.
      if (args.learningLanguage && existing.learningLanguage === undefined) {
        updates.learningLanguage = args.learningLanguage;
      }
      
      const ownerEmail = process.env.OWNER_EMAIL;
      if (ownerEmail && existing.email === ownerEmail && existing.role !== "superadmin") {
        updates.role = "superadmin";
        updates.isActive = true;
        updates.isBetaTester = true;
      }
      
      await ctx.db.patch(existing._id, updates);

      // Update progress.lastActivityAt so Admin "Last Activity" is fresh on login
      const existingProgress = await ctx.db
        .query("userProgress")
        .withIndex("by_user", (q) => q.eq("userId", existing._id))
        .first();
      if (existingProgress) {
        const ts = Date.now();
        await ctx.db.patch(existingProgress._id, { lastActivityAt: ts });
      }

      return existing._id;
    }

    // Determine if beta mode is currently active
    const betaMode = process.env.BETA_MODE === "on" || process.env.BETA_MODE === "true";
    const betaEnd = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : undefined;
    const now = Date.now();
    const shouldBeBetaTester =
      betaMode && (!betaEnd || now <= betaEnd);

    // Handle Clerk account re-creation: if email exists with a different clerkId,
    // re-link the existing account instead of creating a duplicate.
    if (identity.email) {
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email))
        .first();

      if (existingByEmail) {
        console.log("[syncUser] Re-linking user: clerkId changed", {
          email: identity.email,
          oldClerkId: existingByEmail.clerkId,
          newClerkId: identity.subject,
        });
        await ctx.db.patch(existingByEmail._id, {
          clerkId: identity.subject,
          lastActiveDate: Date.now(),
        });

        const existingProgress = await ctx.db
          .query("userProgress")
          .withIndex("by_user", (q) => q.eq("userId", existingByEmail._id))
          .first();
        if (existingProgress) {
          await ctx.db.patch(existingProgress._id, { lastActivityAt: Date.now() });
        }

        return existingByEmail._id;
      }
    }

    // User's learning language (default to English if not provided)
    const userLanguage = args.learningLanguage || "en";

    try {
      // Create new user - always active, beta testers get badge automatically
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        name: identity.name ?? undefined,
        email: identity.email ?? undefined,
        loginMethod: "clerk",
        role: "student",
        learningLanguage: userLanguage,
        isActive: true, // New users are immediately active and have access to beta
        // During beta mode, mark new users automatically as beta testers
        isBetaTester: shouldBeBetaTester,
        totalXP: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: Date.now(),
      });

      // Create initial user progress
      await ctx.db.insert("userProgress", {
        userId,
        currentUnit: 1,
        completedUnits: [],
        learningDuration: 12,
        uiLanguage: "en",
        lastActivityAt: Date.now(),
      });

      // Sync to newsletter contacts: marketing/newsletter opt-in at registration (see newsletter.ts; prior unsubscribes are respected).
      try {
        await ctx.scheduler.runAfter(0, internal.newsletter.syncUserToNewsletter, {
          userId,
          autoSubscribe: true,
        });
      } catch {}

      return userId;
    } catch (error) {
      throw error;
    }
  },
});

// Update user's learning language
export const updateLearningLanguage = mutation({
  args: {
    learningLanguage: v.union(
      v.literal("en"),
      v.literal("de"),
      v.literal("es"),
      v.literal("fr")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(user._id, {
      learningLanguage: args.learningLanguage,
    });

    // Keep newsletter contact in sync so the correct language version is sent.
    if (user.email) {
      await ctx.scheduler.runAfter(0, internal.newsletter.internalSyncUserLocale, {
        email: user.email,
        learningLanguage: args.learningLanguage,
      });
    }

    return { success: true, learningLanguage: args.learningLanguage };
  },
});

// Update public profile fields used for the Leaderboard (nickname/avatar + opt-in)
export const updatePublicProfile = mutation({
  args: {
    publicNickname: v.optional(v.string()),
    publicAvatarUrl: v.optional(v.string()),
    leaderboardPublicEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const updates: Record<string, unknown> = {};

    // Normalize nickname
    if (args.publicNickname !== undefined) {
      const nickname = args.publicNickname.trim().replace(/\s+/g, " ");
      if (nickname.length === 0) {
        updates.publicNickname = undefined;
      } else {
        if (nickname.length < 2 || nickname.length > 32) {
          throw new Error("Nickname must be between 2 and 32 characters.");
        }
        updates.publicNickname = nickname;
      }
    }

    // Normalize avatar URL (optional: manual override; uploads use storageId)
    if (args.publicAvatarUrl !== undefined) {
      const url = args.publicAvatarUrl.trim();
      if (url.length === 0) {
        // Clearing the manual URL should NOT delete an uploaded avatar.
        updates.publicAvatarUrl = undefined;
      } else {
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          throw new Error("Avatar URL must be a valid URL.");
        }
        if (parsed.protocol !== "https:") {
          throw new Error("Avatar URL must start with https://");
        }
        // Manual URL overrides uploaded avatar
        updates.publicAvatarUrl = url;
        updates.publicAvatarStorageId = undefined;
      }
    }

    // Opt-in toggle (default OFF: treat undefined as false)
    if (args.leaderboardPublicEnabled !== undefined) {
      updates.leaderboardPublicEnabled = args.leaderboardPublicEnabled;
    }

    // If enabling public display, require nickname + avatar
    const nextNickname = (updates.publicNickname as string | undefined) ?? user.publicNickname;
    const nextAvatarUrl =
      (updates.publicAvatarUrl as string | undefined) ?? user.publicAvatarUrl;
    const nextAvatarStorageId = user.publicAvatarStorageId ?? null;
    const nextEnabled =
      (updates.leaderboardPublicEnabled as boolean | undefined) ??
      user.leaderboardPublicEnabled ??
      false;

    if (nextEnabled) {
      if (!nextNickname || nextNickname.trim().length < 2) {
        throw new Error("Please set a nickname before enabling public Leaderboard display.");
      }
      const hasAvatar =
        (nextAvatarUrl && nextAvatarUrl.trim().length > 0) || Boolean(nextAvatarStorageId);
      if (!hasAvatar) {
        throw new Error("Please set an avatar before enabling public Leaderboard display.");
      }
    }

    if (Object.keys(updates).length === 0) {
      return {
        publicNickname: user.publicNickname ?? null,
        publicAvatarUrl: user.publicAvatarUrl ?? null,
        leaderboardPublicEnabled: user.leaderboardPublicEnabled ?? false,
      };
    }

    await ctx.db.patch(user._id, updates);

    return {
      publicNickname: nextNickname ?? null,
      publicAvatarUrl: nextAvatarUrl ?? null,
      leaderboardPublicEnabled: nextEnabled,
    };
  },
});

// Get a fresh URL for the currently stored public avatar (storageId preferred)
export const getMyPublicAvatarUrl = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    if (user.publicAvatarStorageId) {
      const url = await ctx.storage.getUrl(user.publicAvatarStorageId);
      return { storageId: user.publicAvatarStorageId, url };
    }

    return { storageId: null, url: user.publicAvatarUrl ?? null };
  },
});

// Avatar upload: generate a Convex Storage upload URL
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("Not authenticated");
    assertLearnerAccountActive(user);
    return await ctx.storage.generateUploadUrl();
  },
});

// Avatar upload: store storageId on user and return a fresh URL (URLs expire)
export const setPublicAvatarFromUpload = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to resolve uploaded avatar URL.");
    }

    await ctx.db.patch(user._id, {
      publicAvatarStorageId: args.storageId,
      // Keep URL field as manual override only; uploaded avatars use storageId.
      publicAvatarUrl: undefined,
    });

    return { storageId: args.storageId, url };
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

// Count inactive users (admin/superadmin; returns 0 for others)
export const getInactiveCount = query({
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return 0;
    }

    const users = await ctx.db.query("users").collect();
    return users.filter((u) => u.isActive === false).length;
  },
});

// Update own learning language
export const updateMyLanguage = mutation({
  args: {
    learningLanguage: v.union(
      v.literal("en"),
      v.literal("de"),
      v.literal("es"),
      v.literal("fr")
    )
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    await ctx.db.patch(user._id, {
      learningLanguage: args.learningLanguage,
    });
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
    // Level calculation: every 300 XP = 1 level (consistent with Drizzle)
    const newLevel = Math.floor(newTotalXP / 300) + 1;

    await ctx.db.patch(user._id, {
      totalXP: newTotalXP,
      level: newLevel,
      lastActiveDate: Date.now(),
    });

    if (args.xpToAdd > 0) {
      await upsertDailyActivityByUserId(ctx, user._id, {
        xpEarned: args.xpToAdd,
      });
    }

    return { totalXP: newTotalXP, level: newLevel };
  },
});

// Make user superadmin (for initial setup via Convex dashboard only)
export const makeSuperadmin = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[makeSuperadmin] Starting for email:', args.email);
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      console.error('[makeSuperadmin] User not found:', args.email);
      throw new Error(`User with email ${args.email} not found`);
    }

    console.log('[makeSuperadmin] Found user:', {
      userId: user._id,
      clerkId: user.clerkId,
      currentRole: user.role,
    });

    await ctx.db.patch(user._id, {
      role: "superadmin",
      isActive: true,
      isBetaTester: true,
    });

    console.log('[makeSuperadmin] Successfully updated user to superadmin');

    return { success: true, userId: user._id };
  },
});

// Make user superadmin by Clerk ID (via Convex dashboard only)
export const makeSuperadminByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[makeSuperadminByClerkId] Starting for clerkId:', args.clerkId);
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      console.error('[makeSuperadminByClerkId] User not found:', args.clerkId);
      throw new Error(`User with Clerk ID ${args.clerkId} not found`);
    }

    console.log('[makeSuperadminByClerkId] Found user:', {
      userId: user._id,
      email: user.email,
      currentRole: user.role,
    });

    await ctx.db.patch(user._id, {
      role: "superadmin",
      isActive: true,
      isBetaTester: true,
    });

    console.log('[makeSuperadminByClerkId] Successfully updated user to superadmin');

    return { success: true, userId: user._id, user };
  },
});

// Fix user name (for debugging - remove after use)
export const fixUserName = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
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
      name: args.name,
    });

    return { success: true, userId: user._id, name: args.name };
  },
});

// Action to fix user name (internal only, via Convex dashboard)
export const fixUserNameAction = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<FixUserNameResult> => {
    return await ctx.runMutation(internal.users.fixUserName, {
      email: args.email,
      name: args.name,
    });
  },
});

// Activate all inactive users (internal migration helper)
export const activateAllUsers = internalMutation({
  handler: async (ctx) => {
    const inactiveUsers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isActive"), false))
      .collect();

    console.log(`[Activate All] Found ${inactiveUsers.length} inactive users`);

    for (const user of inactiveUsers) {
      await ctx.db.patch(user._id, {
        isActive: true,
      });
      console.log(`[Activate All] Activated user: ${user.email || user.name || user._id}`);
    }

    return { 
      success: true, 
      activated: inactiveUsers.length,
      users: inactiveUsers.map(u => ({ email: u.email, name: u.name }))
    };
  },
});

// Mark all users as beta testers (internal migration helper)
export const makeAllUsersBetaTesters = internalMutation({
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const nonBetaUsers = allUsers.filter(u => !u.isBetaTester);

    console.log(`[Beta Testers] Found ${nonBetaUsers.length} non-beta users out of ${allUsers.length} total`);

    for (const user of nonBetaUsers) {
      await ctx.db.patch(user._id, {
        isBetaTester: true,
      });
      console.log(`[Beta Testers] Added beta badge to: ${user.email || user.name || user._id}`);
    }

    return { 
      success: true, 
      updated: nonBetaUsers.length,
      totalUsers: allUsers.length,
      users: nonBetaUsers.map(u => ({ 
        email: u.email, 
        name: u.name,
        role: u.role 
      }))
    };
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

// Internal mutation to update XP by Clerk ID (called from action)
export const internalUpdateXPByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
    xpToAdd: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate input parameters
    if (!args.clerkId || typeof args.clerkId !== 'string') {
      throw new Error(`Invalid clerkId: ${args.clerkId}`);
    }
    if (typeof args.xpToAdd !== 'number' || args.xpToAdd <= 0) {
      throw new Error(`Invalid xpToAdd: ${args.xpToAdd} (must be a positive number)`);
    }

    console.log(`[Convex] internalUpdateXPByClerkId: Looking up user with clerkId=${args.clerkId}, xpToAdd=${args.xpToAdd}`);
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    
    if (!user) {
      const errorMsg = `User with Clerk ID ${args.clerkId} not found in Convex database. User may need to be synced via syncUser mutation.`;
      console.error(`[Convex] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    assertLearnerAccountActive(user);

    const oldTotalXP = user.totalXP || 0;
    const oldLevel = user.level || 1;
    const newTotalXP = oldTotalXP + args.xpToAdd;
    // Level calculation: every 300 XP = 1 level (consistent with Drizzle)
    const newLevel = Math.floor(newTotalXP / 300) + 1;

    console.log(`[Convex] Updating user XP: ${oldTotalXP} -> ${newTotalXP} (+${args.xpToAdd}), Level: ${oldLevel} -> ${newLevel}`);

    await ctx.db.patch(user._id, {
      totalXP: newTotalXP,
      level: newLevel,
      lastActiveDate: Date.now(),
    });

    if (args.xpToAdd > 0) {
      await upsertDailyActivityByUserId(ctx, user._id, {
        xpEarned: args.xpToAdd,
      });
    }

    const result = { totalXP: newTotalXP, level: newLevel };
    console.log(`[Convex] Successfully updated user XP:`, result);
    return result;
  },
});

// Action to update XP by Clerk ID (can be called from tRPC)
export const updateXPByClerkId = action({
  args: {
    clerkId: v.string(),
    xpToAdd: v.number(),
  },
  handler: async (ctx, args): Promise<UpdateXpResult> => {
    console.log(`[Convex] updateXPByClerkId action called: clerkId=${args.clerkId}, xpToAdd=${args.xpToAdd}`);
    
    try {
      // Call internal mutation
      const result: UpdateXpResult = await ctx.runMutation(internal.users.internalUpdateXPByClerkId, {
        clerkId: args.clerkId,
        xpToAdd: args.xpToAdd,
      });
      console.log(`[Convex] updateXPByClerkId action completed successfully:`, result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Convex] updateXPByClerkId action failed:`, {
        xpToAdd: args.xpToAdd,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  },
});

// Server-side helper action to fetch a user by Clerk ID
export const internalGetUserByClerkId = internalQuery({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});


/**
 * Optional client fallback: run after sign-in to ensure enforcement even if webhook delivery is delayed.
 * Production-only; skips superadmin.
 */
export const enforceSingleSession = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    // Do not throw here: on initial load, Clerk may be ready while Convex auth token
    // hasn't propagated yet. Throwing would spam the client with "Server Error".
    if (!identity) {
      return { skipped: true, reason: "no_identity" as const };
    }

    if (!isProductionDeployment()) {
      return { skipped: true, reason: "not_production" };
    }

    // IMPORTANT: actions do not have ctx.db. Use runQuery to access DB via a query.
    const dbUser = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
      clerkId: identity.subject,
    });

    if (dbUser?.role === "superadmin") {
      return { skipped: true, reason: "superadmin" };
    }

    // Revoke all other active sessions for this user
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      console.warn("[enforceSingleSession] CLERK_SECRET_KEY not set - skipping");
      return { skipped: true, reason: "missing_clerk_secret_key" };
    }

    const clerkUserId = identity.subject;
    const revokedSessionIds: string[] = [];
    let offset = 0;
    const limit = 100;

    try {
      // Paginate through all active sessions
      while (true) {
        const listResp = await fetch(
          `https://api.clerk.com/v1/sessions?user_id=${clerkUserId}&status=active&limit=${limit}&offset=${offset}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${clerkSecretKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!listResp.ok) {
          const errorText = await listResp.text().catch(() => "<failed_to_read_body>");
          console.error("[enforceSingleSession] Failed to list sessions", {
            status: listResp.status,
            errorText: String(errorText).slice(0, 200),
          });
          break;
        }

        const listJson = await listResp.json();
        const sessions: any[] = Array.isArray(listJson)
          ? listJson
          : Array.isArray(listJson?.data)
            ? listJson.data
            : [];

        // Revoke all sessions except the current one
        for (const session of sessions) {
          const sid: string | undefined = session?.id;
          if (!sid) continue;
          if (sid === args.sessionId) continue; // Keep the current session

          const revokeResp = await fetch(
            `https://api.clerk.com/v1/sessions/${sid}/revoke`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!revokeResp.ok) {
            const errorText = await revokeResp.text().catch(() => "<failed_to_read_body>");
            console.error("[enforceSingleSession] Failed to revoke session", {
              status: revokeResp.status,
              errorText: String(errorText).slice(0, 200),
            });
            continue;
          }

          revokedSessionIds.push(sid);
        }

        // Check if there are more sessions to fetch
        if (sessions.length < limit) {
          break;
        }

        offset += sessions.length;
      }

      return { skipped: false, revokedCount: revokedSessionIds.length, revokedSessionIds };
    } catch (error) {
      console.error("[enforceSingleSession] Error revoking sessions", {
        error: String(error),
      });
      return { skipped: true, reason: "error", error: String(error) };
    }
  },
});

export const getUserByClerkIdForServer = action({
  args: {
    clerkId: v.string(),
    serverToken: v.string(),
  },
  handler: async (ctx, args): Promise<UserDoc | null> => {
    const serverToken = process.env.CONVEX_SERVER_TOKEN;
    if (!serverToken || args.serverToken !== serverToken) {
      throw new Error("Unauthorized server token");
    }

    return await ctx.runQuery(internal.users.internalGetUserByClerkId, {
      clerkId: args.clerkId,
    });
  },
});

// ============================================================================
// SELF-SERVICE ACCOUNT DELETION (GDPR "Right to be forgotten")
// ============================================================================
// Internal query used by the `deleteMyAccount` action to fetch the caller's
// user row and active subscription status in a single transaction.
export const _internalGetMyAccountForDelete = internalQuery({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    const subscriptions = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const activeSubscription =
      subscriptions.find((s) => s.status === "active") ?? null;

    return {
      userId: user._id,
      clerkId: user.clerkId,
      email: user.email ?? null,
      role: user.role,
      activeSubscription: activeSubscription
        ? {
            planType: activeSubscription.planType,
            expiresAt: activeSubscription.expiresAt,
            autoRenew: activeSubscription.autoRenew,
          }
        : null,
    };
  },
});

/**
 * Lets an authenticated user delete their own account. Requires the user to
 * re-confirm their email address as a safeguard against accidental clicks.
 * Blocks deletion while an active paid subscription exists so we do not orphan
 * a running billing relationship — user must cancel first.
 *
 * Flow: verify identity → match confirmation email → guard subscription →
 *       DELETE https://api.clerk.com/v1/users/:id → cascade-delete Convex data.
 *
 * After a successful return the frontend must call Clerk's signOut().
 */
export const deleteMyAccount = action({
  args: {
    confirmationEmail: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    reason?:
      | "not_authenticated"
      | "user_not_found"
      | "email_mismatch"
      | "active_subscription"
      | "clerk_delete_failed"
      | "no_api_key";
    message?: string;
    deleted?: Record<string, number>;
    totalRows?: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, reason: "not_authenticated" };
    }

    const account = await ctx.runQuery(
      internal.users._internalGetMyAccountForDelete,
      { clerkId: identity.subject }
    );

    if (!account) {
      return { success: false, reason: "user_not_found" };
    }

    // Re-confirmation via email prevents one-click accidents. Compare
    // case-insensitively and ignore surrounding whitespace.
    const expected = (account.email ?? "").trim().toLowerCase();
    const provided = args.confirmationEmail.trim().toLowerCase();
    if (!expected || expected !== provided) {
      return {
        success: false,
        reason: "email_mismatch",
        message:
          "The entered email does not match your account email. Account was not deleted.",
      };
    }

    // Protect billing state: users with an active subscription must cancel
    // first. This avoids "orphan" subscriptions that keep charging after the
    // account is gone and simplifies refunds/disputes.
    if (account.activeSubscription) {
      return {
        success: false,
        reason: "active_subscription",
        message:
          "You have an active subscription. Please cancel it before deleting your account.",
      };
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      console.error(
        "[deleteMyAccount] CLERK_SECRET_KEY missing - aborting delete to avoid orphan"
      );
      return {
        success: false,
        reason: "no_api_key",
        message:
          "Server configuration error. Please contact support to delete your account.",
      };
    }

    try {
      const resp = await fetch(
        `https://api.clerk.com/v1/users/${account.clerkId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      // 404 means "already deleted at Clerk" - treat as success so the
      // user can still clean up their Convex data.
      if (!resp.ok && resp.status !== 404) {
        const body = await resp.text().catch(() => "<read_failed>");
        console.error("[deleteMyAccount] Clerk DELETE failed", {
          status: resp.status,
          body: body.slice(0, 300),
          clerkId: account.clerkId,
        });
        return {
          success: false,
          reason: "clerk_delete_failed",
          message:
            "We could not remove your account from the authentication service. Please try again later or contact support.",
        };
      }
    } catch (error) {
      console.error("[deleteMyAccount] Clerk DELETE threw", error);
      return {
        success: false,
        reason: "clerk_delete_failed",
        message:
          "Network error while removing your account. Please try again later.",
      };
    }

    const cascade = await ctx.runMutation(
      internal.admin._deleteUserCascade,
      { userId: account.userId }
    );

    console.log("[deleteMyAccount] Account deleted", {
      email: account.email,
      totalRows: cascade.totalRows,
    });

    return {
      success: true,
      deleted: cascade.deleted,
      totalRows: cascade.totalRows,
    };
  },
});


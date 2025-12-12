import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx, action } from "./_generated/server";
import { api } from "./_generated/api";

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

// Register for beta (public)
export const register = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    motivation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if email already registered
    const existing = await ctx.db
      .query("betaRegistrations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("Email already registered for beta");
    }

    // Insert registration
    const registrationId = await ctx.db.insert("betaRegistrations", {
      name: args.name,
      email: args.email,
      motivation: args.motivation,
      status: "pending",
    });

    // Schedule email to be sent (non-blocking)
    try {
      await ctx.scheduler.runAfter(0, api.email.sendBetaRegistrationEmail, {
        name: args.name,
        email: args.email,
      });
    } catch (error) {
      console.error("[Beta Registration] Failed to schedule email:", error);
      // Don't throw - email failure shouldn't block registration
    }

    return registrationId;
  },
});

// Get all beta registrations (admin only)
export const getAllRegistrations = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.query("betaRegistrations").order("desc").collect();
  },
});

// Update beta registration status (admin only)
export const updateStatus = mutation({
  args: {
    id: v.id("betaRegistrations"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      reviewedAt: Date.now(),
    });
  },
});

// Get pending registrations count (admin only)
export const getPendingCount = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return 0;
    }

    const pending = await ctx.db
      .query("betaRegistrations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return pending.length;
  },
});

// Alias for frontend compatibility
export const getAll = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return [];
    }

    return await ctx.db.query("betaRegistrations").order("desc").collect();
  },
});

// Delete registration (admin only)
export const deleteRegistration = mutation({
  args: {
    id: v.id("betaRegistrations"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});


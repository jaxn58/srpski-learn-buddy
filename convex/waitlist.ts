import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";

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

// Join waitlist (public mutation)
export const join = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email format");
    }

    // Check if email already exists
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      // If already confirmed, inform user
      if (existing.status === "confirmed") {
        throw new Error("You're already on the waitlist!");
      }
      
      // If pending, resend confirmation email
      if (existing.status === "pending") {
        // Schedule email to be sent
        await ctx.scheduler.runAfter(0, api.email.sendEmail, {
          templateName: "waitlist-opt-in",
          variables: {
            USER_NAME: existing.name || "there",
            USER_EMAIL: existing.email,
            CONFIRMATION_LINK: `${process.env.VITE_APP_URL || "https://learn-with.me"}/waitlist/confirm?token=${existing.confirmationToken}`,
          },
          to: existing.email,
        });
        
        return { success: true, message: "Confirmation email resent" };
      }
    }

    // Generate confirmation token
    const confirmationToken = crypto.randomUUID();

    // Insert into waitlist
    const waitlistId = await ctx.db.insert("waitlist", {
      email: args.email,
      name: args.name,
      status: "pending",
      confirmationToken,
      createdAt: Date.now(),
    });

    // Send opt-in email
    try {
      await ctx.scheduler.runAfter(0, api.email.sendEmail, {
        templateName: "waitlist-opt-in",
        variables: {
          USER_NAME: args.name || "there",
          USER_EMAIL: args.email,
          CONFIRMATION_LINK: `${process.env.VITE_APP_URL || "https://learn-with.me"}/waitlist/confirm?token=${confirmationToken}`,
        },
        to: args.email,
      });
    } catch (error) {
      console.error("[Waitlist] Failed to send opt-in email:", error);
      // Don't throw - registration should succeed even if email fails
    }

    return { success: true, waitlistId };
  },
});

// Confirm waitlist registration (public mutation)
export const confirm = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Find entry by token
    const entry = await ctx.db
      .query("waitlist")
      .withIndex("by_token", (q) => q.eq("confirmationToken", args.token))
      .first();

    if (!entry) {
      throw new Error("Invalid or expired confirmation token");
    }

    if (entry.status === "confirmed") {
      return { success: true, message: "Already confirmed" };
    }

    // Update status to confirmed
    await ctx.db.patch(entry._id, {
      status: "confirmed",
      confirmedAt: Date.now(),
    });

    // Send confirmation email
    try {
      await ctx.scheduler.runAfter(0, api.email.sendEmail, {
        templateName: "waitlist-confirmed",
        variables: {
          USER_NAME: entry.name || "there",
          USER_EMAIL: entry.email,
        },
        to: entry.email,
      });
    } catch (error) {
      console.error("[Waitlist] Failed to send confirmation email:", error);
    }

    return { success: true, email: entry.email };
  },
});

// Get all waitlist entries (admin only)
export const getAll = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    return await ctx.db
      .query("waitlist")
      .order("desc")
      .collect();
  },
});

// Get waitlist statistics (admin only)
export const getStats = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const all = await ctx.db.query("waitlist").collect();

    const pending = all.filter((entry) => entry.status === "pending").length;
    const confirmed = all.filter((entry) => entry.status === "confirmed").length;
    const notified = all.filter((entry) => entry.status === "notified").length;

    return {
      total: all.length,
      pending,
      confirmed,
      notified,
    };
  },
});

// Notify all confirmed users about beta launch (admin only)
export const notifyAll = mutation({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    // Get all confirmed users
    const confirmed = await ctx.db
      .query("waitlist")
      .withIndex("by_status", (q) => q.eq("status", "confirmed"))
      .collect();

    if (confirmed.length === 0) {
      throw new Error("No confirmed users to notify");
    }

    let successCount = 0;
    let errorCount = 0;

    // Send beta launch email to all confirmed users
    for (const entry of confirmed) {
      try {
        await ctx.scheduler.runAfter(0, api.email.sendEmail, {
          templateName: "waitlist-beta-launch",
          variables: {
            USER_NAME: entry.name || "there",
            SIGNUP_URL: `${process.env.VITE_APP_URL || "https://learn-with.me"}/sign-up`,
          },
          to: entry.email,
        });

        // Update status to notified
        await ctx.db.patch(entry._id, {
          status: "notified",
          notifiedAt: Date.now(),
        });

        successCount++;
      } catch (error) {
        console.error(`[Waitlist] Failed to notify ${entry.email}:`, error);
        errorCount++;
      }
    }

    return {
      success: true,
      total: confirmed.length,
      successCount,
      errorCount,
    };
  },
});

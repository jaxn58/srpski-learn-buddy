import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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

// Helper to check if user is admin or superadmin
async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Unauthorized: Admin access required");
  }
  return user;
}

// ============= QUERIES =============

// Get the active banner (public - for all users)
export const getActiveBanner = query({
  handler: async (ctx) => {
    const banner = await ctx.db
      .query("systemBanners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    return banner;
  },
});

// Get all banners (admin only)
export const getAllBanners = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const banners = await ctx.db
      .query("systemBanners")
      .withIndex("by_created")
      .order("desc")
      .collect();

    return banners;
  },
});

// ============= MUTATIONS =============

// Create a new banner
export const createBanner = mutation({
  args: {
    message: v.string(),
    link: v.optional(v.string()),
    linkText: v.optional(v.string()),
    variant: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("success")
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    // Validate message length
    if (args.message.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (args.message.length > 500) {
      throw new Error("Message too long (max 500 characters)");
    }

    // Validate URL if provided
    if (args.link) {
      try {
        new URL(args.link);
      } catch {
        throw new Error("Invalid URL format");
      }
    }

    const now = Date.now();

    const bannerId = await ctx.db.insert("systemBanners", {
      message: args.message,
      link: args.link,
      linkText: args.linkText,
      variant: args.variant,
      isActive: false, // New banners start as inactive
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
    });

    return bannerId;
  },
});

// Update an existing banner
export const updateBanner = mutation({
  args: {
    bannerId: v.id("systemBanners"),
    message: v.string(),
    link: v.optional(v.string()),
    linkText: v.optional(v.string()),
    variant: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("success")
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Validate message length
    if (args.message.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (args.message.length > 500) {
      throw new Error("Message too long (max 500 characters)");
    }

    // Validate URL if provided
    if (args.link) {
      try {
        new URL(args.link);
      } catch {
        throw new Error("Invalid URL format");
      }
    }

    // Check if banner exists
    const banner = await ctx.db.get(args.bannerId);
    if (!banner) {
      throw new Error("Banner not found");
    }

    await ctx.db.patch(args.bannerId, {
      message: args.message,
      link: args.link,
      linkText: args.linkText,
      variant: args.variant,
      updatedAt: Date.now(),
    });

    return args.bannerId;
  },
});

// Toggle banner active status (ensures only one banner is active)
export const toggleBannerStatus = mutation({
  args: {
    bannerId: v.id("systemBanners"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const banner = await ctx.db.get(args.bannerId);
    if (!banner) {
      throw new Error("Banner not found");
    }

    const newStatus = !banner.isActive;

    // If activating this banner, deactivate all others
    if (newStatus) {
      const allBanners = await ctx.db
        .query("systemBanners")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      for (const otherBanner of allBanners) {
        if (otherBanner._id !== args.bannerId) {
          await ctx.db.patch(otherBanner._id, {
            isActive: false,
            updatedAt: Date.now(),
          });
        }
      }
    }

    // Update the target banner
    await ctx.db.patch(args.bannerId, {
      isActive: newStatus,
      updatedAt: Date.now(),
    });

    return { bannerId: args.bannerId, isActive: newStatus };
  },
});

// Delete a banner
export const deleteBanner = mutation({
  args: {
    bannerId: v.id("systemBanners"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const banner = await ctx.db.get(args.bannerId);
    if (!banner) {
      throw new Error("Banner not found");
    }

    await ctx.db.delete(args.bannerId);

    return { success: true };
  },
});

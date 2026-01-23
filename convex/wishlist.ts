import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type WishlistStatus =
  | "submitted"
  | "in_review"
  | "on_todo_list"
  | "im_working_on_it"
  | "shipped"
  | "duplicate"
  | "rejected";

const PUBLIC_STATUSES: WishlistStatus[] = ["on_todo_list", "im_working_on_it", "shipped"];
const UPVOTABLE_STATUSES: WishlistStatus[] = ["on_todo_list", "im_working_on_it"];

const WISHLIST_SUBMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function normalizeTitle(title: string) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

async function getAdminUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) return null;
  return user;
}

function isPublicStatus(status: WishlistStatus, opts?: { includeRejected?: boolean; includeDuplicate?: boolean }) {
  if (PUBLIC_STATUSES.includes(status)) return true;
  if (opts?.includeRejected && status === "rejected") return true;
  if (opts?.includeDuplicate && status === "duplicate") return true;
  return false;
}

async function recomputeUpvoteCount(ctx: MutationCtx, wishlistItemId: Id<"wishlistItems">) {
  const votes = await ctx.db
    .query("wishlistUpvotes")
    .withIndex("by_item", (q) => q.eq("wishlistItemId", wishlistItemId))
    .collect();
  await ctx.db.patch(wishlistItemId, {
    upvoteCount: votes.length,
    updatedAt: Date.now(),
  });
  return votes.length;
}

export const createWishlistItem = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    source: v.optional(
      v.object({
        kind: v.literal("feedback"),
        feedbackId: v.id("feedbackSubmissions"),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const title = String(args.title || "").trim();
    const description = String(args.description || "").trim();
    if (title.length < 10) throw new Error("Title is too short");
    if (title.length > 200) throw new Error("Title is too long");
    if (description.length < 50) throw new Error("Description is too short");
    if (description.length > 5000) throw new Error("Description is too long");

    const now = Date.now();
    const windowStart = now - WISHLIST_SUBMIT_COOLDOWN_MS;

    const isAdmin = user.role === "admin" || user.role === "superadmin";

    // Rate-limit: 1 wishlist suggestion per 24h per user (Admins/Superadmins are exempt)
    if (!isAdmin) {
      const recent = await ctx.db
        .query("wishlistItems")
        .withIndex("by_user_createdAt", (q) =>
          q.eq("createdBy", user._id).gte("createdAt", windowStart)
        )
        .collect();
      if (recent.length >= 1) {
        throw new Error("Rate limit: you can submit 1 wishlist suggestion per 24 hours.");
      }
    }

    // Per-user exact de-dupe: block if same normalized title already exists and isn't rejected.
    const titleNormalized = normalizeTitle(title);
    const existing = await ctx.db
      .query("wishlistItems")
      .withIndex("by_user_titleNormalized", (q) =>
        q.eq("createdBy", user._id).eq("titleNormalized", titleNormalized)
      )
      .first();
    if (existing && existing.status !== "rejected") {
      throw new Error("A similar wishlist item already exists for you.");
    }

    const wishlistItemId = await ctx.db.insert("wishlistItems", {
      createdBy: user._id,
      title,
      titleNormalized,
      description,
      status: "submitted",
      adminStatusNote: undefined,
      duplicateOfWishlistItemId: undefined,
      reviewedAt: undefined,
      reviewedBy: undefined,
      source: args.source,
      createdAt: now,
      updatedAt: now,
      upvoteCount: 0,
    });

    return wishlistItemId;
  },
});

export const getMySubmitCooldown = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { isBlocked: false, nextAllowedAt: null as number | null, remainingMs: 0 };
    }

    const now = Date.now();
    const windowStart = now - WISHLIST_SUBMIT_COOLDOWN_MS;

    const isAdmin = user.role === "admin" || user.role === "superadmin";
    if (isAdmin) {
      return { isBlocked: false, nextAllowedAt: null as number | null, remainingMs: 0 };
    }

    const mostRecentWithinWindow = await ctx.db
      .query("wishlistItems")
      .withIndex("by_user_createdAt", (q) =>
        q.eq("createdBy", user._id).gte("createdAt", windowStart)
      )
      .order("desc")
      .first();

    if (!mostRecentWithinWindow) {
      return { isBlocked: false, nextAllowedAt: null as number | null, remainingMs: 0 };
    }

    const nextAllowedAt = (mostRecentWithinWindow.createdAt || now) + WISHLIST_SUBMIT_COOLDOWN_MS;
    const remainingMs = Math.max(0, nextAllowedAt - now);

    return {
      isBlocked: remainingMs > 0,
      nextAllowedAt: remainingMs > 0 ? nextAllowedAt : null,
      remainingMs,
    };
  },
});

export const listWishlistItems = query({
  args: {
    sort: v.optional(v.union(v.literal("newest"), v.literal("top"))),
    includeRejected: v.optional(v.boolean()),
    includeDuplicate: v.optional(v.boolean()),
    includeMyNonPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const includeMyNonPublic = args.includeMyNonPublic !== false;
    const includeRejected = Boolean(args.includeRejected);
    const includeDuplicate = Boolean(args.includeDuplicate);
    const sort = args.sort ?? "newest";

    const ids = new Set<string>();
    const items: Array<Doc<"wishlistItems">> = [];

    // Public items by status (merge)
    const publicStatuses: WishlistStatus[] = [
      ...PUBLIC_STATUSES,
      ...(includeRejected ? (["rejected"] as WishlistStatus[]) : []),
      ...(includeDuplicate ? (["duplicate"] as WishlistStatus[]) : []),
    ];

    for (const status of publicStatuses) {
      const rows = await ctx.db
        .query("wishlistItems")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      for (const r of rows) {
        const key = String(r._id);
        if (ids.has(key)) continue;
        ids.add(key);
        items.push(r);
      }
    }

    // Also include the current user's own non-public items so they can see review status.
    if (includeMyNonPublic) {
      const mine = await ctx.db
        .query("wishlistItems")
        .withIndex("by_user_createdAt", (q) => q.eq("createdBy", user._id))
        .collect();
      for (const r of mine) {
        if (isPublicStatus(r.status as WishlistStatus, { includeRejected, includeDuplicate })) continue;
        const key = String(r._id);
        if (ids.has(key)) continue;
        ids.add(key);
        items.push(r);
      }
    }

    const sorted = [...items].sort((a, b) => {
      if (sort === "top") {
        const av = Number(a.upvoteCount || 0);
        const bv = Number(b.upvoteCount || 0);
        if (bv !== av) return bv - av;
      }
      const ad = Number(a.createdAt || 0);
      const bd = Number(b.createdAt || 0);
      return bd - ad;
    });

    return sorted;
  },
});

export const getWishlistItem = query({
  args: { id: v.id("wishlistItems") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.id);
    if (!item) return null;

    const canView =
      (user.role === "admin" || user.role === "superadmin") ||
      item.createdBy === user._id ||
      isPublicStatus(item.status as WishlistStatus, { includeDuplicate: false, includeRejected: false });

    if (!canView) {
      throw new Error("Unauthorized");
    }

    const upvote = await ctx.db
      .query("wishlistUpvotes")
      .withIndex("by_item_user", (q) => q.eq("wishlistItemId", item._id).eq("userId", user._id))
      .first();

    const status = item.status as WishlistStatus;
    const canUpvote = UPVOTABLE_STATUSES.includes(status);

    return {
      item,
      myHasUpvoted: Boolean(upvote),
      canUpvote,
    };
  },
});

export const toggleUpvote = mutation({
  args: { wishlistItemId: v.id("wishlistItems") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.wishlistItemId);
    if (!item) throw new Error("Wishlist item not found");

    const status = item.status as WishlistStatus;
    if (!UPVOTABLE_STATUSES.includes(status)) {
      throw new Error("This item cannot be upvoted in its current status.");
    }

    const existing = await ctx.db
      .query("wishlistUpvotes")
      .withIndex("by_item_user", (q) =>
        q.eq("wishlistItemId", args.wishlistItemId).eq("userId", user._id)
      )
      .collect();

    if (existing.length > 0) {
      // Remove all existing (resilient against rare duplicates)
      for (const e of existing) {
        await ctx.db.delete(e._id);
      }
      const count = await recomputeUpvoteCount(ctx, args.wishlistItemId);
      return { upvoted: false, upvoteCount: count };
    }

    await ctx.db.insert("wishlistUpvotes", {
      wishlistItemId: args.wishlistItemId,
      userId: user._id,
      createdAt: Date.now(),
    });

    const count = await recomputeUpvoteCount(ctx, args.wishlistItemId);
    return { upvoted: true, upvoteCount: count };
  },
});

export const listReviewQueue = query({
  args: {
    includeAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    if (args.includeAll) {
      const all = await ctx.db.query("wishlistItems").collect();
      const sorted = all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return await Promise.all(
        sorted.map(async (item) => {
          const submitter = await ctx.db.get(item.createdBy);
          return {
            ...item,
            submitterName: submitter?.name || submitter?.email || "Unknown",
            submitterEmail: submitter?.email || "",
          } as any;
        })
      );
    }

    const submitted = await ctx.db
      .query("wishlistItems")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const inReview = await ctx.db
      .query("wishlistItems")
      .withIndex("by_status", (q) => q.eq("status", "in_review"))
      .collect();
    // Backward compatibility: earlier iterations used "pending".
    const pendingLegacy = await ctx.db
      .query("wishlistItems")
      .withIndex("by_status", (q) => q.eq("status", "pending" as any))
      .collect();

    const combined = [...submitted, ...inReview, ...pendingLegacy].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );

    // Enrich with submitter info for the admin UI (safe fields only).
    return await Promise.all(
      combined.map(async (item) => {
        const submitter = await ctx.db.get(item.createdBy);
        return {
          ...item,
          submitterName: submitter?.name || submitter?.email || "Unknown",
          submitterEmail: submitter?.email || "",
        } as any;
      })
    );
  },
});

export const updateWishlistStatus = mutation({
  args: {
    id: v.id("wishlistItems"),
    status: v.union(
      v.literal("submitted"),
      v.literal("in_review"),
      v.literal("on_todo_list"),
      v.literal("im_working_on_it"),
      v.literal("shipped"),
      v.literal("duplicate"),
      v.literal("rejected")
    ),
    adminStatusNote: v.optional(v.string()),
    duplicateOfWishlistItemId: v.optional(v.id("wishlistItems")),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Wishlist item not found");

    const status = args.status as WishlistStatus;

    let duplicateOfWishlistItemId: Id<"wishlistItems"> | undefined = args.duplicateOfWishlistItemId;
    if (status === "duplicate") {
      if (!duplicateOfWishlistItemId) {
        throw new Error("duplicateOfWishlistItemId is required for status=duplicate");
      }
      if (String(duplicateOfWishlistItemId) === String(args.id)) {
        throw new Error("duplicateOfWishlistItemId cannot reference itself");
      }
      const target = await ctx.db.get(duplicateOfWishlistItemId);
      if (!target) throw new Error("duplicateOfWishlistItemId not found");
    } else {
      duplicateOfWishlistItemId = undefined;
    }

    const note = args.adminStatusNote ? String(args.adminStatusNote).trim() : undefined;

    await ctx.db.patch(args.id, {
      status,
      adminStatusNote: note && note.length > 0 ? note : undefined,
      duplicateOfWishlistItemId,
      reviewedAt: Date.now(),
      reviewedBy: admin._id,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});


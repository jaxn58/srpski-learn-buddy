/**
 * Feedback & Wishlist Tables
 *
 * User feedback with AI-assisted replies, feature requests (wishlist)
 * with upvoting.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const feedbackTables = {
  // ============= FEEDBACK SUBMISSIONS =============
  feedbackSubmissions: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("bug"),
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("other")
    ),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("new"),
      v.literal("reviewed"),
      v.literal("answered"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("rejected")
    ),
    adminNotes: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),

    // ===== AI assistance (superadmin-only access via dedicated queries) =====
    aiStatus: v.optional(
      v.union(v.literal("pending"), v.literal("ready"), v.literal("error"))
    ),
    aiDraftReply: v.optional(v.string()),
    aiInternalNote: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    aiGeneratedAt: v.optional(v.number()),
    aiError: v.optional(v.string()),

    // Track what was actually sent to the user
    aiSentAt: v.optional(v.number()),
    aiSentBy: v.optional(v.id("users")),
    aiSentContent: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ============= FEEDBACK COMMENTS =============
  feedbackComments: defineTable({
    feedbackId: v.id("feedbackSubmissions"),
    userId: v.id("users"),
    content: v.string(),
    isAdminNote: v.boolean(),
  }).index("by_feedback", ["feedbackId"]),

  // ============= FEEDBACK STATUS HISTORY =============
  feedbackStatusHistory: defineTable({
    feedbackId: v.id("feedbackSubmissions"),
    previousStatus: v.string(),
    newStatus: v.string(),
    changedBy: v.id("users"),
  }).index("by_feedback", ["feedbackId"]),

  // ============= WISHLIST (Feature Requests) =============
  wishlistItems: defineTable({
    createdBy: v.id("users"),
    title: v.string(),
    // Lowercased + whitespace-collapsed title, used for de-dupe checks.
    titleNormalized: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("submitted"),
      v.literal("in_review"),
      v.literal("on_todo_list"),
      v.literal("im_working_on_it"),
      v.literal("shipped"),
      v.literal("duplicate"),
      v.literal("rejected")
    ),
    // Optional admin note (kept in English; short explanation for status/decision)
    adminStatusNote: v.optional(v.string()),
    // If status is "duplicate", points to the canonical wishlist item.
    duplicateOfWishlistItemId: v.optional(v.id("wishlistItems")),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    source: v.optional(
      v.object({
        kind: v.literal("feedback"),
        feedbackId: v.id("feedbackSubmissions"),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    upvoteCount: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_titleNormalized", ["titleNormalized"])
    .index("by_user_titleNormalized", ["createdBy", "titleNormalized"])
    .index("by_user_createdAt", ["createdBy", "createdAt"]),

  wishlistUpvotes: defineTable({
    wishlistItemId: v.id("wishlistItems"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_item", ["wishlistItemId"])
    .index("by_item_user", ["wishlistItemId", "userId"])
    .index("by_user", ["userId"]),
};

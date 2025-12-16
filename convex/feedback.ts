import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

// Get feedback comments
export const getComments = query({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("feedbackComments")
      .withIndex("by_feedback", (q) => q.eq("feedbackId", args.feedbackId))
      .collect();
  },
});

// Add feedback comment
export const addComment = mutation({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    content: v.string(),
    isAdminNote: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // If admin note, verify user is admin
    if (args.isAdminNote && user.role !== "admin" && user.role !== "superadmin") {
      throw new Error("Unauthorized");
    }

    return await ctx.db.insert("feedbackComments", {
      feedbackId: args.feedbackId,
      userId: user._id,
      content: args.content,
      isAdminNote: args.isAdminNote,
    });
  },
});

// Get feedback status history
export const getStatusHistory = query({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("feedbackStatusHistory")
      .withIndex("by_feedback", (q) => q.eq("feedbackId", args.feedbackId))
      .collect();
  },
});

// Get user's feedback submissions
export const getMySubmissions = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("feedbackSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getAllSubmissions = query({
  handler: async (ctx) => {
    try {
      const user = await getCurrentUser(ctx);
      if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
        return [];
      }

      const submissions = await ctx.db.query("feedbackSubmissions").order("desc").collect();
      
      // Enrich with user info
      const enrichedSubmissions = await Promise.all(
        submissions.map(async (sub) => {
          try {
            const submitter = await ctx.db.get(sub.userId);
            return {
              ...sub,
              userName: submitter?.name || submitter?.email || "Unknown",
              userEmail: submitter?.email || "",
            };
          } catch (e) {
            console.error(`Failed to enrich submission ${sub._id}:`, e);
            return {
              ...sub,
              userName: "Unknown (Error)",
              userEmail: "",
            };
          }
        })
      );

      return enrichedSubmissions;
    } catch (error) {
      console.error("Error loading feedback submissions:", error);
      // Return empty array instead of throwing to prevent infinite loading state
      return [];
    }
  },
});

export const submit = mutation({
  args: {
    type: v.union(
      v.literal("bug"),
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("other")
    ),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("feedbackSubmissions", {
      userId: user._id,
      type: args.type,
      title: args.title,
      description: args.description,
      status: "new",
      submittedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("feedbackSubmissions"),
    status: v.union(
      v.literal("new"),
      v.literal("reviewed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("rejected")
    ),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    const feedback = await ctx.db.get(args.id);
    if (!feedback) throw new Error("Feedback not found");

    await ctx.db.patch(args.id, {
      status: args.status,
      adminNotes: args.adminNotes,
      reviewedAt: Date.now(),
    });
  },
});

export const deleteFeedback = mutation({
  args: {
    id: v.id("feedbackSubmissions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});


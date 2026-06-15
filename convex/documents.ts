import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getFeatureAccessForUser } from "./featureAccess";

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
}

// @ts-ignore TS2589
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Document & photo upload (Knowledge Rack) is only included in the buddy
    // and full packages (Phase 2 feature gating).
    const access = await getFeatureAccessForUser(ctx, user._id);
    if (!access.features.documents) {
      throw new Error("Document & photo upload is not included in your current plan.");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

const UPLOAD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// @ts-ignore TS2589
export const checkUploadRateLimit = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (user.role === "admin" || user.role === "superadmin") {
      return { allowed: true, nextAllowedAt: null };
    }

    const cutoff = Date.now() - UPLOAD_COOLDOWN_MS;

    const recentMsg = await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();

    const recentUpload = recentMsg
      ? await ctx.db
          .query("chatMessages")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .order("desc")
          .filter((q: any) =>
            q.and(
              q.neq(q.field("attachmentStorageId"), undefined),
              q.gte(q.field("_creationTime"), cutoff)
            )
          )
          .first()
      : null;

    if (recentUpload) {
      return {
        allowed: false,
        nextAllowedAt: recentUpload._creationTime + UPLOAD_COOLDOWN_MS,
      };
    }

    return { allowed: true, nextAllowedAt: null };
  },
});

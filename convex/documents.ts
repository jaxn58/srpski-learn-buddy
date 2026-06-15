import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getFeatureAccessForUser } from "./featureAccess";
import { estimateEnergyCost, loadEnergyConfig } from "./energy";

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
}

/**
 * Generate an upload URL for an attachment.
 *
 * Energy enforcement (Phase 3): callers MUST pass the actual file size and
 * mime so the backend can:
 *  1) reject uploads over the configured technical cap (uploadMaxFileBytes)
 *  2) reject uploads when the user does not have enough AI Energy to cover
 *     the upload + analysis (Variant A: block early, don't take the upload
 *     and then refuse to answer).
 *
 * Staff / unlimited plans pass through. The acknowledged-cost contract is
 * enforced again at finalize-time so the frontend cannot under-report cost.
 */
// @ts-ignore TS2589
export const generateUploadUrl = mutation({
  args: {
    fileBytes: v.optional(v.number()),
    fileType: v.optional(v.string()),
    acknowledgedCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Document & photo upload (Knowledge Rack) is only included in the buddy
    // and full packages (Phase 2 feature gating).
    const access = await getFeatureAccessForUser(ctx, user._id);
    if (!access.features.documents) {
      throw new Error("Document & photo upload is not included in your current plan.");
    }

    const cfg = await loadEnergyConfig(ctx);

    if (typeof args.fileBytes === "number") {
      if (args.fileBytes < 0 || !Number.isFinite(args.fileBytes)) {
        throw new Error("Invalid file size");
      }
      if (args.fileBytes > cfg.uploadMaxFileBytes) {
        const mb = (cfg.uploadMaxFileBytes / (1024 * 1024)).toFixed(0);
        throw new Error(`File too large. Maximum upload size is ${mb} MB.`);
      }
    }

    // Pre-charge check: skip for unlimited (staff). We do NOT skip for beta
    // testers — they have a metered quota.
    if (!access.energy.unlimited && typeof args.fileBytes === "number") {
      const mime = args.fileType ?? "application/octet-stream";
      const isImage = mime.startsWith("image/");
      const estimate = estimateEnergyCost(cfg, {
        hasImageAttachment: isImage,
        hasFileAttachment: !isImage,
        attachmentBytes: args.fileBytes,
      });

      if (access.energy.available < estimate.cost) {
        throw new Error(
          `Not enough AI Energy: this upload costs ${estimate.cost} Energy, you have ${access.energy.available}. Top up or upgrade to continue.`
        );
      }

      // Optional client-side acknowledgement: if the frontend showed the user
      // a confirmation dialog with a cost, it must echo that cost back. We
      // reject only when the acknowledged cost is strictly below the real
      // cost (frontend tried to under-report).
      if (typeof args.acknowledgedCost === "number" && args.acknowledgedCost < estimate.cost) {
        throw new Error(
          `Cost mismatch: upload requires ${estimate.cost} Energy, but client acknowledged only ${args.acknowledgedCost}. Please retry.`
        );
      }
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

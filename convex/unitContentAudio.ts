import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertLearnerAccountActive } from "./authz";

/**
 * Fetch cached audio info for a given textHash.
 * This is the main lookup path used by the frontend before triggering TTS generation.
 */
export const getByTextHash = query({
  args: {
    textHash: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("unitContentAudio")
      .withIndex("by_text_hash", (q) => q.eq("textHash", args.textHash))
      .first();

    if (!row) return null;

    // Versioning/soft-archive: treat undefined isActive as active
    if (row.isActive === false) return null;

    return {
      audioStorageId: row.audioStorageId,
      unitNumber: row.unitNumber,
      language: row.language,
      contentType: row.contentType,
      voiceKey: row.voiceKey,
      textSr: row.textSr,
      textHash: row.textHash,
    };
  },
});

/**
 * Upsert cached audio for a given textHash.
 * Requires a valid authenticated user (Learner role).
 * Audio is generated on-demand by the server endpoint and then cached here.
 */
export const upsert = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    contentType: v.union(v.literal("phrases"), v.literal("dialogues")),
    textSr: v.string(),
    voiceKey: v.string(),
    textHash: v.string(),
    audioStorageId: v.string(),
    unitVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) {
      throw new Error("Not authenticated");
    }
    assertLearnerAccountActive(user);

    const now = Date.now();

    const existing = await ctx.db
      .query("unitContentAudio")
      .withIndex("by_text_hash", (q) => q.eq("textHash", args.textHash))
      .first();

    const payload = {
      unitNumber: args.unitNumber,
      language: args.language,
      contentType: args.contentType,
      textSr: args.textSr,
      voiceKey: args.voiceKey,
      textHash: args.textHash,
      audioStorageId: args.audioStorageId,
      updatedAt: now,
      // Versioning/soft-archive defaults
      isActive: true,
      archivedAt: undefined,
      unitVersion: args.unitVersion,
    } as const;

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("unitContentAudio", {
      ...payload,
      createdAt: now,
    });
  },
});


import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Unauthorized – admin role required");
  }
  return user;
}

/**
 * List all modules with their units and audio file counts.
 * Returns a tree: modules -> units -> { vocabAudioCount, contentAudioCount }
 */
export const listModulesWithAudioStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const modules = await ctx.db.query("moduleMetadata").collect();
    const sortedModules = modules.sort(
      (a, b) => (a.moduleNumber ?? 0) - (b.moduleNumber ?? 0)
    );

    const result = [];

    for (const mod of sortedModules) {
      const units = await ctx.db
        .query("unitMetadata")
        .withIndex("by_module_metadata", (q) => q.eq("moduleMetadataId", mod._id))
        .collect();

      const enUnits = units
        .filter((u) => u.language === "en")
        .sort((a, b) => a.unitNumber - b.unitNumber);

      const unitStats = [];
      for (const unit of enUnits) {
        const vocabAll = await ctx.db
          .query("courseVocabulary")
          .withIndex("by_unit", (q) => q.eq("unitNumber", unit.unitNumber))
          .collect();
        const vocabWithAudio = vocabAll.filter((v) => !!v.audioStorageId);

        const contentAudio = await ctx.db
          .query("unitContentAudio")
          .withIndex("by_unit_lang_type", (q) =>
            q.eq("unitNumber", unit.unitNumber).eq("language", "en")
          )
          .collect();
        const activeContentAudio = contentAudio.filter(
          (a) => a.isActive !== false
        );

        unitStats.push({
          unitNumber: unit.unitNumber,
          title: unit.title,
          vocabTotal: vocabAll.length,
          vocabWithAudio: vocabWithAudio.length,
          contentAudioCount: activeContentAudio.length,
        });
      }

      const totalVocabAudio = unitStats.reduce((s, u) => s + u.vocabWithAudio, 0);
      const totalContentAudio = unitStats.reduce((s, u) => s + u.contentAudioCount, 0);

      result.push({
        moduleId: mod._id,
        titleEn: mod.titleEn ?? mod.title ?? "Untitled",
        moduleNumber: mod.moduleNumber ?? 0,
        slug: mod.slug,
        units: unitStats,
        totalVocabAudio,
        totalContentAudio,
      });
    }

    return result;
  },
});

/**
 * List all audio entries for a specific unit (vocabulary + content audio).
 */
export const listAudioForUnit = query({
  args: { unitNumber: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const vocabAll = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();

    const vocabAudio = vocabAll
      .filter((v) => !!v.audioStorageId)
      .map((v) => ({
        _id: v._id,
        type: "vocabulary" as const,
        serbian: v.serbian,
        en: v.en,
        audioStorageId: v.audioStorageId!,
      }));

    const contentAudioRaw = await ctx.db
      .query("unitContentAudio")
      .withIndex("by_unit_lang_type", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", "en")
      )
      .collect();

    const contentAudio = contentAudioRaw
      .filter((a) => a.isActive !== false)
      .map((a) => ({
        _id: a._id,
        type: "content" as const,
        contentType: a.contentType,
        textSr: a.textSr,
        voiceKey: a.voiceKey,
        audioStorageId: a.audioStorageId,
        createdAt: a.createdAt,
      }));

    return { vocabAudio, contentAudio };
  },
});

/**
 * Hard-delete a single vocabulary audio: remove from Storage + clear DB field.
 */
export const deleteSingleVocabularyAudio = mutation({
  args: { vocabularyId: v.id("courseVocabulary") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const vocab = await ctx.db.get(args.vocabularyId);
    if (!vocab) throw new Error("Vocabulary entry not found");
    if (!vocab.audioStorageId) return { deleted: false };

    try {
      await ctx.storage.delete(vocab.audioStorageId as any);
    } catch {
      // Storage file may already be gone – proceed with DB cleanup
    }

    await ctx.db.patch(args.vocabularyId, {
      audioStorageId: undefined,
      audioUrl: undefined,
    });

    return { deleted: true, serbian: vocab.serbian, unitNumber: vocab.unitNumber };
  },
});

/**
 * Hard-delete a single content audio: remove from Storage + delete DB row.
 */
export const deleteSingleContentAudio = mutation({
  args: { audioId: v.id("unitContentAudio") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const audio = await ctx.db.get(args.audioId);
    if (!audio) throw new Error("Content audio entry not found");

    try {
      await ctx.storage.delete(audio.audioStorageId as any);
    } catch {
      // Storage file may already be gone
    }

    await ctx.db.delete(args.audioId);

    return { deleted: true, textSr: audio.textSr, unitNumber: audio.unitNumber };
  },
});

/**
 * Hard-delete ALL audio for a unit (both vocabulary + content audio).
 */
export const deleteAllAudioForUnit = mutation({
  args: { unitNumber: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let vocabDeleted = 0;
    let contentDeleted = 0;

    const vocabAll = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();

    for (const vocab of vocabAll) {
      if (vocab.audioStorageId) {
        try {
          await ctx.storage.delete(vocab.audioStorageId as any);
        } catch {
          // proceed
        }
        await ctx.db.patch(vocab._id, {
          audioStorageId: undefined,
          audioUrl: undefined,
        });
        vocabDeleted++;
      }
    }

    const contentAll = await ctx.db
      .query("unitContentAudio")
      .withIndex("by_unit_lang_type", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", "en")
      )
      .collect();

    for (const audio of contentAll) {
      if (audio.isActive !== false) {
        try {
          await ctx.storage.delete(audio.audioStorageId as any);
        } catch {
          // proceed
        }
        await ctx.db.delete(audio._id);
        contentDeleted++;
      }
    }

    return { unitNumber: args.unitNumber, vocabDeleted, contentDeleted };
  },
});

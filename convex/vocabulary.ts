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

// Get all vocabulary for current user
export const getUserVocabulary = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Get vocabulary for a specific unit
export const getUnitVocabulary = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .collect();
  },
});

// Add vocabulary word
export const addVocabulary = mutation({
  args: {
    serbianWord: v.string(),
    englishTranslation: v.string(),
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check if word already exists for this user
    const existing = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .filter((q) => q.eq(q.field("serbianWord"), args.serbianWord))
      .first();

    if (existing) {
      return existing._id; // Already exists
    }

    return await ctx.db.insert("vocabulary", {
      userId: user._id,
      serbianWord: args.serbianWord,
      englishTranslation: args.englishTranslation,
      unitNumber: args.unitNumber,
      mastered: false,
      reviewCount: 0,
      correctAnswerCount: 0,
      incorrectAnswerCount: 0,
    });
  },
});

// Update vocabulary (mark as mastered, update review count)
export const updateVocabulary = mutation({
  args: {
    vocabId: v.id("vocabulary"),
    mastered: v.optional(v.boolean()),
    incrementReview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const vocab = await ctx.db.get(args.vocabId);
    if (!vocab || vocab.userId !== user._id) {
      throw new Error("Vocabulary not found");
    }

    const updates: Record<string, unknown> = {
      lastReviewedAt: Date.now(),
    };

    if (args.mastered !== undefined) {
      updates.mastered = args.mastered;
    }

    if (args.incrementReview) {
      updates.reviewCount = vocab.reviewCount + 1;
    }

    await ctx.db.patch(args.vocabId, updates);
  },
});

// Bulk add vocabulary for a unit
export const addBulkVocabulary = mutation({
  args: {
    words: v.array(
      v.object({
        serbianWord: v.string(),
        englishTranslation: v.string(),
        unitNumber: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const insertedIds = [];
    for (const word of args.words) {
      // Check if already exists
      const existing = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", user._id).eq("unitNumber", word.unitNumber)
        )
        .filter((q) => q.eq(q.field("serbianWord"), word.serbianWord))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("vocabulary", {
          userId: user._id,
          ...word,
          mastered: false,
          reviewCount: 0,
          correctAnswerCount: 0,
          incorrectAnswerCount: 0,
        });
        insertedIds.push(id);
      }
    }

    return insertedIds;
  },
});

// Record vocabulary answer (quiz tracking)
export const recordVocabularyAnswer = mutation({
  args: {
    serbianWord: v.string(),
    unitNumber: v.number(),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Find existing vocabulary entry for this user, word, and unit
    const existing = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .filter((q) => q.eq(q.field("serbianWord"), args.serbianWord))
      .first();

    if (existing) {
      // Update existing entry
      const newCorrectCount = args.isCorrect 
        ? (existing.correctAnswerCount || 0) + 1 
        : (existing.correctAnswerCount || 0);
      const newIncorrectCount = args.isCorrect 
        ? (existing.incorrectAnswerCount || 0) 
        : (existing.incorrectAnswerCount || 0) + 1;
      
      // Mark as mastered if correctAnswerCount >= 3
      const isMastered = newCorrectCount >= 3;

      await ctx.db.patch(existing._id, {
        correctAnswerCount: newCorrectCount,
        incorrectAnswerCount: newIncorrectCount,
        mastered: isMastered,
        lastAnsweredAt: Date.now(),
        lastReviewedAt: Date.now(),
      });

      return existing._id;
    } else {
      // Create new entry (word not yet in user's vocabulary table)
      // We need the translation - for now, we'll create with a placeholder
      // In practice, this should come from the VOCABULARY data
      const newCorrectCount = args.isCorrect ? 1 : 0;
      const newIncorrectCount = args.isCorrect ? 0 : 1;
      const isMastered = newCorrectCount >= 3;

      return await ctx.db.insert("vocabulary", {
        userId: user._id,
        serbianWord: args.serbianWord,
        englishTranslation: "", // Will be populated from VOCABULARY data
        unitNumber: args.unitNumber,
        mastered: isMastered,
        reviewCount: 1,
        correctAnswerCount: newCorrectCount,
        incorrectAnswerCount: newIncorrectCount,
        lastAnsweredAt: Date.now(),
        lastReviewedAt: Date.now(),
      });
    }
  },
});

// Get user vocabulary progress
export const getUserVocabularyProgress = query({
  args: { 
    unitNumber: v.optional(v.number()) 
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    let query = ctx.db
      .query("vocabulary")
      .withIndex("by_user", (q) => q.eq("userId", user._id));

    if (args.unitNumber !== undefined) {
      const unitNumber = args.unitNumber;
      query = ctx.db
        .query("vocabulary")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", user._id).eq("unitNumber", unitNumber)
        );
    }

    return await query.collect();
  },
});

// ============= MULTI-LANGUAGE TRANSLATIONS =============

// Insert vocabulary translation (for migration script)
export const insertVocabularyTranslation = mutation({
  args: {
    vocabularyId: v.id("vocabulary"),
    language: v.string(),
    translation: v.string(),
    alternatives: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vocabularyTranslations")
      .withIndex("by_vocab_lang", (q) =>
        q.eq("vocabularyId", args.vocabularyId).eq("language", args.language)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        translation: args.translation,
        alternatives: args.alternatives,
      });
      return existing._id;
    }

    return await ctx.db.insert("vocabularyTranslations", {
      vocabularyId: args.vocabularyId,
      language: args.language,
      translation: args.translation,
      alternatives: args.alternatives,
    });
  },
});

// Helper: Get translation for a vocabulary word
// Falls back to englishTranslation in vocabulary table if not found in translations table
export const getTranslation = query({
  args: {
    vocabularyId: v.id("vocabulary"),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    // 1. Try to find specific translation
    const translation = await ctx.db
      .query("vocabularyTranslations")
      .withIndex("by_vocab_lang", (q) =>
        q.eq("vocabularyId", args.vocabularyId).eq("language", language)
      )
      .first();

    if (translation) {
      return {
        translation: translation.translation,
        alternatives: translation.alternatives || [],
      };
    }

    // 2. Fallback: Get the vocabulary item itself (englishTranslation)
    const vocab = await ctx.db.get(args.vocabularyId);
    if (!vocab) return null;

    return {
      translation: vocab.englishTranslation,
      alternatives: [], // No alternatives in base table
    };
  },
});

// Find vocabulary ID by serbian word and unit (helper for migration)
export const findVocabularyId = query({
  args: {
    serbianWord: v.string(),
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Note: This might return multiple if multiple users have the same word
    // Migration script should handle this by iterating over all users
    const vocab = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .filter((q) => q.eq(q.field("serbianWord"), args.serbianWord))
      .collect();
      
    return vocab.map(v => v._id);
  },
});


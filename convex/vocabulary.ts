import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ============= COURSE VOCABULARY (Master Data) =============

// Upsert course vocabulary (for migration script)
export const upsertCourseVocabulary = mutation({
  args: {
    unitNumber: v.number(),
    serbian: v.string(),
    translations: v.array(v.object({
      language: v.string(),
      translation: v.string(),
      alt: v.optional(v.string())
    })),
    gender: v.optional(v.string()),
    pronunciation: v.optional(v.string()),
    noteEn: v.optional(v.string()),
    noteDe: v.optional(v.string()),
    noteSr: v.optional(v.string()),
    noteEs: v.optional(v.string()),
    noteFr: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if word already exists in this unit
    const existing = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .filter((q) => q.eq(q.field("serbian"), args.serbian))
      .first();

    if (existing) {
      const updates: Record<string, unknown> = {
        translations: args.translations, // Overwrite translations (source of truth is Markdown)
        gender: args.gender,
        pronunciation: args.pronunciation,
      };
      
      if (args.noteEn !== undefined) updates.noteEn = args.noteEn;
      if (args.noteDe !== undefined) updates.noteDe = args.noteDe;
      if (args.noteSr !== undefined) updates.noteSr = args.noteSr;
      if (args.noteEs !== undefined) updates.noteEs = args.noteEs;
      if (args.noteFr !== undefined) updates.noteFr = args.noteFr;
      
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    const insertData: Record<string, unknown> = {
      unitNumber: args.unitNumber,
      serbian: args.serbian,
      translations: args.translations,
      gender: args.gender,
      pronunciation: args.pronunciation,
    };
    
    if (args.noteEn !== undefined) insertData.noteEn = args.noteEn;
    if (args.noteDe !== undefined) insertData.noteDe = args.noteDe;
    if (args.noteSr !== undefined) insertData.noteSr = args.noteSr;
    if (args.noteEs !== undefined) insertData.noteEs = args.noteEs;
    if (args.noteFr !== undefined) insertData.noteFr = args.noteFr;

    return await ctx.db.insert("courseVocabulary", insertData);
  },
});

// Get all course vocabulary (for frontend migration)
export const getAllCourseVocabulary = query({
  handler: async (ctx) => {
    const allVocab = await ctx.db
      .query("courseVocabulary")
      .collect();
    
    // #region agent log
    const unit6Vocab = allVocab.filter(v => v.unitNumber === 6);
    const unitCounts = allVocab.reduce((acc, v) => {
      acc[v.unitNumber] = (acc[v.unitNumber] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    // Note: Convex queries run server-side, so we can't use fetch here
    // Logging will be done client-side in VocabularyList.tsx
    // #endregion
    
    // Sort by unitNumber (ascending), then alphabetically by serbian
    return allVocab.sort((a, b) => {
      if (a.unitNumber !== b.unitNumber) {
        return a.unitNumber - b.unitNumber;
      }
      return a.serbian.localeCompare(b.serbian);
    });
  },
});

// Helper: Get all unique unitNumbers that have vocabulary (for testing)
export const getAvailableUnitNumbers = query({
  handler: async (ctx) => {
    const allVocab = await ctx.db
      .query("courseVocabulary")
      .collect();
    
    const unitNumbers = new Set(allVocab.map(v => v.unitNumber));
    return Array.from(unitNumbers).sort((a, b) => a - b);
  },
});

// Get vocabulary for a unit (Master Data)
export const getCourseVocabularyByUnit = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Try with index first
    const withIndex = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    
    // If empty, try without index (fallback)
    if (withIndex.length === 0) {
      const allVocab = await ctx.db
        .query("courseVocabulary")
        .collect();
      return allVocab.filter(v => v.unitNumber === args.unitNumber);
    }
    
    return withIndex;
  },
});

// Get vocabulary with progress (JOIN vocabularyProgress + courseVocabulary)
// Returns combined object with master data and user progress
export const getVocabularyWithProgress = query({
  args: {
    unitNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    
    // Get all course vocabulary (or filtered by unit)
    let courseVocabQuery = ctx.db.query("courseVocabulary");
    if (args.unitNumber !== undefined) {
      courseVocabQuery = courseVocabQuery.withIndex("by_unit", (q) => 
        q.eq("unitNumber", args.unitNumber)
      );
    }
    const courseVocab = await courseVocabQuery.collect();

    // If no user, return vocabulary without progress
    if (!user) {
      const result = courseVocab.map(word => ({
        _id: word._id,
        unitNumber: word.unitNumber,
        serbian: word.serbian,
        en: word.en,
        de: word.de,
        sr: word.sr,
        es: word.es,
        fr: word.fr,
        enAlt: word.enAlt,
        deAlt: word.deAlt,
        gender: word.gender,
        pronunciation: word.pronunciation,
        noteEn: word.noteEn,
        noteDe: word.noteDe,
        noteSr: word.noteSr,
        noteEs: word.noteEs,
        noteFr: word.noteFr,
        translations: word.translations,
        progress: null, // No progress without user
      }));
      
      // Sort by unitNumber (ascending), then alphabetically by serbian
      return result.sort((a, b) => {
        if (a.unitNumber !== b.unitNumber) {
          return a.unitNumber - b.unitNumber;
        }
        return a.serbian.localeCompare(b.serbian);
      });
    }

    // Get user's vocabulary progress
    const userProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Create a map of courseVocabularyId -> progress for quick lookup
    const progressMap = new Map(
      userProgress.map(p => [p.courseVocabularyId, p])
    );

    // Combine course vocabulary with progress
    const result = courseVocab.map(word => ({
      _id: word._id,
      unitNumber: word.unitNumber,
      serbian: word.serbian,
      en: word.en,
      de: word.de,
      sr: word.sr,
      es: word.es,
      fr: word.fr,
      enAlt: word.enAlt,
      deAlt: word.deAlt,
      gender: word.gender,
      pronunciation: word.pronunciation,
      noteEn: word.noteEn,
      noteDe: word.noteDe,
      noteSr: word.noteSr,
      noteEs: word.noteEs,
      noteFr: word.noteFr,
      // Include old translations array for backward compatibility
      translations: word.translations,
      // Progress data (or null if no progress)
      progress: progressMap.get(word._id) ? {
        mastered: progressMap.get(word._id)!.mastered,
        reviewCount: progressMap.get(word._id)!.reviewCount,
        lastReviewedAt: progressMap.get(word._id)!.lastReviewedAt,
        correctAnswerCount: progressMap.get(word._id)!.correctAnswerCount,
        incorrectAnswerCount: progressMap.get(word._id)!.incorrectAnswerCount,
        lastAnsweredAt: progressMap.get(word._id)!.lastAnsweredAt,
      } : null,
    }));
    
    // Sort by unitNumber (ascending), then alphabetically by serbian
    return result.sort((a, b) => {
      if (a.unitNumber !== b.unitNumber) {
        return a.unitNumber - b.unitNumber;
      }
      return a.serbian.localeCompare(b.serbian);
    });
  },
});

// Delete vocabulary by unit numbers (for migration/cleanup)
export const deleteVocabularyByUnits = mutation({
  args: {
    unitNumbers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    let totalDeleted = 0;
    
    for (const unitNum of args.unitNumbers) {
      const entries = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNum))
        .collect();
      
      for (const entry of entries) {
        await ctx.db.delete(entry._id);
        totalDeleted++;
      }
    }
    
    return { deleted: totalDeleted };
  },
});

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
  args: {
    userId: v.optional(v.id("users")), // Optional: if provided, requires admin access
  },
  handler: async (ctx, args) => {
    let targetUserId: Id<"users">;
    
    if (args.userId) {
      // Admin access required for migration scripts
      const currentUser = await getCurrentUser(ctx);
      if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
        throw new Error("Unauthorized");
      }
      targetUserId = args.userId;
    } else {
      // Current user's vocabulary
      const user = await getCurrentUser(ctx);
      if (!user) return [];
      targetUserId = user._id;
    }

    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
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

    // Use .collect() instead of .first() to find ALL duplicates
    const existingEntries = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .filter((q) => q.eq(q.field("serbianWord"), args.serbianWord))
      .collect();

    if (existingEntries.length > 0) {
      // Sort by creation time to get the oldest entry
      const sortedEntries = existingEntries.sort(
        (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
      );
      const oldestEntry = sortedEntries[0];
      const duplicates = sortedEntries.slice(1);

      // Delete duplicates immediately
      for (const dup of duplicates) {
        await ctx.db.delete(dup._id);
      }

      return oldestEntry._id; // Return oldest entry
    }

    const newId = await ctx.db.insert("vocabulary", {
      userId: user._id,
      serbianWord: args.serbianWord,
      englishTranslation: args.englishTranslation,
      unitNumber: args.unitNumber,
      mastered: false,
      reviewCount: 0,
      correctAnswerCount: 0,
      incorrectAnswerCount: 0,
    });

    // Immediate cleanup check: verify no duplicates were created (race condition protection)
    const verifyEntries = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .filter((q) => q.eq(q.field("serbianWord"), args.serbianWord))
      .collect();

    if (verifyEntries.length > 1) {
      // Race condition detected! Clean up immediately
      const sortedVerify = verifyEntries.sort(
        (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
      );
      const keepEntry = sortedVerify[0];
      const verifyDuplicates = sortedVerify.slice(1);

      // Delete duplicates
      for (const dup of verifyDuplicates) {
        await ctx.db.delete(dup._id);
      }

      return keepEntry._id;
    }

    return newId;
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
      // Use .collect() instead of .first() to find ALL duplicates
      const existingEntries = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", user._id).eq("unitNumber", word.unitNumber)
        )
        .filter((q) => q.eq(q.field("serbianWord"), word.serbianWord))
        .collect();

      if (existingEntries.length > 0) {
        // Sort by creation time to get the oldest entry
        const sortedEntries = existingEntries.sort(
          (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
        );
        const oldestEntry = sortedEntries[0];
        const duplicates = sortedEntries.slice(1);

        // Delete duplicates immediately
        for (const dup of duplicates) {
          await ctx.db.delete(dup._id);
        }

        insertedIds.push(oldestEntry._id);
      } else {
        const newId = await ctx.db.insert("vocabulary", {
          userId: user._id,
          ...word,
          mastered: false,
          reviewCount: 0,
          correctAnswerCount: 0,
          incorrectAnswerCount: 0,
        });

        // Immediate cleanup check: verify no duplicates were created (race condition protection)
        const verifyEntries = await ctx.db
          .query("vocabulary")
          .withIndex("by_user_unit", (q) =>
            q.eq("userId", user._id).eq("unitNumber", word.unitNumber)
          )
          .filter((q) => q.eq(q.field("serbianWord"), word.serbianWord))
          .collect();

        if (verifyEntries.length > 1) {
          // Race condition detected! Clean up immediately
          const sortedVerify = verifyEntries.sort(
            (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
          );
          const keepEntry = sortedVerify[0];
          const verifyDuplicates = sortedVerify.slice(1);

          // Delete duplicates
          for (const dup of verifyDuplicates) {
            await ctx.db.delete(dup._id);
          }

          insertedIds.push(keepEntry._id);
        } else {
          insertedIds.push(newId);
        }
      }
    }

    return insertedIds;
  },
});

// Record vocabulary answer (quiz tracking)
// DUAL-WRITE: Updates both vocabulary (old) and vocabularyProgress (new) tables
export const recordVocabularyAnswer = mutation({
  args: {
    // OLD: Support for backward compatibility
    serbianWord: v.optional(v.string()),
    unitNumber: v.optional(v.number()),
    // NEW: Preferred method
    courseVocabularyId: v.optional(v.id("courseVocabulary")),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    let courseVocabId: Id<"courseVocabulary"> | null = null;
    let unitNum: number | null = null;

    // Determine courseVocabularyId and unitNumber
    let courseVocab: any = null;
    if (args.courseVocabularyId) {
      // NEW: Direct courseVocabularyId provided
      courseVocabId = args.courseVocabularyId;
      courseVocab = await ctx.db.get(courseVocabId);
      if (!courseVocab) {
        throw new Error(`courseVocabulary not found: ${courseVocabId}`);
      }
      unitNum = courseVocab.unitNumber;
    } else if (args.serbianWord && args.unitNumber) {
      // OLD: Find courseVocabulary by serbianWord + unitNumber
      courseVocab = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit_serbian", (q) =>
          q.eq("unitNumber", args.unitNumber!).eq("serbian", args.serbianWord)
        )
        .first();
      
      if (courseVocab) {
        courseVocabId = courseVocab._id;
        unitNum = args.unitNumber;
      }
    }

    if (!courseVocabId || !unitNum) {
      throw new Error("Either courseVocabularyId or (serbianWord + unitNumber) must be provided");
    }

    // ============= DUAL-WRITE: Update vocabularyProgress (NEW) =============
    let vocabProgressId: Id<"vocabularyProgress"> | null = null;
    
    const existingProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user_course_vocab", (q) =>
        q.eq("userId", user._id).eq("courseVocabularyId", courseVocabId!)
      )
      .first();

    const newCorrectCount = args.isCorrect 
      ? ((existingProgress?.correctAnswerCount || 0) + 1)
      : (existingProgress?.correctAnswerCount || 0);
    const newIncorrectCount = args.isCorrect 
      ? (existingProgress?.incorrectAnswerCount || 0)
      : ((existingProgress?.incorrectAnswerCount || 0) + 1);
    const isMastered = newCorrectCount >= 3;

    // Ensure we have courseVocab (should already be fetched above)
    if (!courseVocab && courseVocabId) {
      courseVocab = await ctx.db.get(courseVocabId);
    }
    if (!courseVocab) {
      throw new Error(`courseVocabulary not found: ${courseVocabId}`);
    }
    
    // Get serbianWord and unitNum for dual-write to vocabulary table
    const serbianWord = args.serbianWord || courseVocab.serbian;
    // unitNum is already set above, but ensure it's set
    if (!unitNum) {
      unitNum = args.unitNumber || courseVocab.unitNumber;
    }

    if (existingProgress) {
      // Update existing progress: increment reviewCount
      await ctx.db.patch(existingProgress._id, {
        correctAnswerCount: newCorrectCount,
        incorrectAnswerCount: newIncorrectCount,
        mastered: isMastered,
        reviewCount: (existingProgress.reviewCount || 0) + 1,
        lastAnsweredAt: Date.now(),
        lastReviewedAt: Date.now(),
      });
      vocabProgressId = existingProgress._id;
    } else {
      // Create new progress entry
      vocabProgressId = await ctx.db.insert("vocabularyProgress", {
        userId: user._id,
        courseVocabularyId: courseVocabId,
        mastered: isMastered,
        reviewCount: 1,
        correctAnswerCount: newCorrectCount,
        incorrectAnswerCount: newIncorrectCount,
        lastAnsweredAt: Date.now(),
        lastReviewedAt: Date.now(),
      });
    }

    // ============= DUAL-WRITE: Update vocabulary (OLD - for backward compatibility) =============
    // Always update vocabulary table if we have serbianWord and unitNumber
    if (serbianWord && unitNum) {
      // Use .collect() instead of .first() to find ALL duplicates
      const existingEntries = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", user._id).eq("unitNumber", unitNum)
        )
        .filter((q) => q.eq(q.field("serbianWord"), serbianWord))
        .collect();

      if (existingEntries.length > 0) {
        // Sort by creation time to get the oldest entry (keep this one)
        const sortedEntries = existingEntries.sort(
          (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
        );
        const oldestEntry = sortedEntries[0];
        const duplicates = sortedEntries.slice(1);

        // Merge counts from duplicates into oldest entry
        let mergedReviewCount = oldestEntry.reviewCount || 0;
        let mergedCorrectCount = oldestEntry.correctAnswerCount || 0;
        let mergedIncorrectCount = oldestEntry.incorrectAnswerCount || 0;

        for (const dup of duplicates) {
          mergedReviewCount += dup.reviewCount || 0;
          mergedCorrectCount += dup.correctAnswerCount || 0;
          mergedIncorrectCount += dup.incorrectAnswerCount || 0;
        }

        // Update oldest entry with merged counts + new answer
        await ctx.db.patch(oldestEntry._id, {
          correctAnswerCount: newCorrectCount,
          incorrectAnswerCount: newIncorrectCount,
          mastered: isMastered,
          reviewCount: mergedReviewCount + 1,
          lastAnsweredAt: Date.now(),
          lastReviewedAt: Date.now(),
        });

        // Delete duplicates immediately
        for (const dup of duplicates) {
          await ctx.db.delete(dup._id);
        }
      } else {
        // Create new entry
        // Get translation from courseVocab (already fetched above)
        const englishTranslation = courseVocab.en || 
          (Array.isArray(courseVocab.translations) 
            ? courseVocab.translations.find((t: any) => t.language === "en")?.translation 
            : "") || "";
        
        const newId = await ctx.db.insert("vocabulary", {
          userId: user._id,
          serbianWord: serbianWord,
          englishTranslation: englishTranslation,
          unitNumber: unitNum,
          mastered: isMastered,
          reviewCount: 1,
          correctAnswerCount: newCorrectCount,
          incorrectAnswerCount: newIncorrectCount,
          lastAnsweredAt: Date.now(),
          lastReviewedAt: Date.now(),
        });

        // Immediate cleanup check: verify no duplicates were created (race condition protection)
        const verifyEntries = await ctx.db
          .query("vocabulary")
          .withIndex("by_user_unit", (q) =>
            q.eq("userId", user._id).eq("unitNumber", unitNum)
          )
          .filter((q) => q.eq(q.field("serbianWord"), serbianWord))
          .collect();

        if (verifyEntries.length > 1) {
          // Race condition detected! Clean up immediately
          const sortedVerify = verifyEntries.sort(
            (a, b) => (a._creationTime || 0) - (b._creationTime || 0)
          );
          const keepEntry = sortedVerify[0];
          const verifyDuplicates = sortedVerify.slice(1);

          // Merge counts
          let mergedReviewCount = keepEntry.reviewCount || 0;
          let mergedCorrectCount = keepEntry.correctAnswerCount || 0;
          let mergedIncorrectCount = keepEntry.incorrectAnswerCount || 0;

          for (const dup of verifyDuplicates) {
            mergedReviewCount += dup.reviewCount || 0;
            mergedCorrectCount += dup.correctAnswerCount || 0;
            mergedIncorrectCount += dup.incorrectAnswerCount || 0;
          }

          // Update kept entry
          await ctx.db.patch(keepEntry._id, {
            reviewCount: mergedReviewCount,
            correctAnswerCount: mergedCorrectCount,
            incorrectAnswerCount: mergedIncorrectCount,
            mastered: isMastered,
            lastAnsweredAt: Date.now(),
            lastReviewedAt: Date.now(),
          });

          // Delete duplicates
          for (const dup of verifyDuplicates) {
            await ctx.db.delete(dup._id);
          }
        }
      }
    }

    return { 
      vocabularyProgressId: vocabProgressId,
      courseVocabularyId: courseVocabId,
    };
  },
});

// Get user vocabulary progress
// NEW: Uses vocabularyProgress with JOIN to courseVocabulary
// FALLBACK: Falls back to vocabulary table if vocabularyProgress is empty
export const getUserVocabularyProgress = query({
  args: { 
    unitNumber: v.optional(v.number()) 
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    // Return empty array if no user (for testing purposes, this is expected)
    if (!user) return [];

    // Try NEW structure first: vocabularyProgress + courseVocabulary JOIN
    let vocabProgressQuery = ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id));

    const vocabProgress = await vocabProgressQuery.collect();

    if (vocabProgress.length > 0) {
      // NEW structure: JOIN with courseVocabulary
      const courseVocabIds = vocabProgress.map(vp => vp.courseVocabularyId);
      const courseVocabMap = new Map();
      
      for (const courseVocabId of courseVocabIds) {
        const courseVocab = await ctx.db.get(courseVocabId);
        if (courseVocab) {
          courseVocabMap.set(courseVocabId, courseVocab);
        }
      }

      // Filter by unitNumber if specified
      let filteredProgress = vocabProgress;
      if (args.unitNumber !== undefined) {
        filteredProgress = vocabProgress.filter(vp => {
          const courseVocab = courseVocabMap.get(vp.courseVocabularyId);
          return courseVocab?.unitNumber === args.unitNumber;
        });
      }

      // Combine progress with course vocabulary data
      return filteredProgress.map(vp => {
        const courseVocab = courseVocabMap.get(vp.courseVocabularyId);
        if (!courseVocab) {
          return null;
        }
        
        return {
          _id: vp._id,
          userId: vp.userId,
          courseVocabularyId: vp.courseVocabularyId,
          serbianWord: courseVocab.serbian,
          englishTranslation: courseVocab.en,
          unitNumber: courseVocab.unitNumber,
          mastered: vp.mastered,
          reviewCount: vp.reviewCount,
          lastReviewedAt: vp.lastReviewedAt,
          correctAnswerCount: vp.correctAnswerCount,
          incorrectAnswerCount: vp.incorrectAnswerCount,
          lastAnsweredAt: vp.lastAnsweredAt,
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
    }

    // FALLBACK: Use old vocabulary table structure
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

// ============= MIGRATION HELPERS (Phase 1) =============

// Update courseVocabulary columns (for migration script)
export const updateCourseVocabularyColumns = mutation({
  args: {
    courseVocabularyId: v.id("courseVocabulary"),
    en: v.string(),
    de: v.string(),
    sr: v.optional(v.string()),
    es: v.optional(v.string()),
    fr: v.optional(v.string()),
    enAlt: v.optional(v.string()),
    deAlt: v.optional(v.string()),
    noteEn: v.optional(v.string()),
    noteDe: v.optional(v.string()),
    noteSr: v.optional(v.string()),
    noteEs: v.optional(v.string()),
    noteFr: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      en: args.en,
      de: args.de,
    };
    
    if (args.sr !== undefined) updates.sr = args.sr;
    if (args.es !== undefined) updates.es = args.es;
    if (args.fr !== undefined) updates.fr = args.fr;
    if (args.enAlt !== undefined) updates.enAlt = args.enAlt;
    if (args.deAlt !== undefined) updates.deAlt = args.deAlt;
    if (args.noteEn !== undefined) updates.noteEn = args.noteEn;
    if (args.noteDe !== undefined) updates.noteDe = args.noteDe;
    if (args.noteSr !== undefined) updates.noteSr = args.noteSr;
    if (args.noteEs !== undefined) updates.noteEs = args.noteEs;
    if (args.noteFr !== undefined) updates.noteFr = args.noteFr;
    
    await ctx.db.patch(args.courseVocabularyId, updates);
    return args.courseVocabularyId;
  },
});

// Find courseVocabulary by serbian and unitNumber
export const findCourseVocabularyBySerbianAndUnit = query({
  args: {
    serbian: v.string(),
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit_serbian", (q) => 
        q.eq("unitNumber", args.unitNumber).eq("serbian", args.serbian)
      )
      .first();
  },
});

// Find all courseVocabulary entries by serbian word (for debugging)
// Returns all units where this word appears
export const findVocabularyBySerbian = query({
  args: {
    serbian: v.string(),
  },
  handler: async (ctx, args) => {
    const allVocab = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_serbian", (q) => q.eq("serbian", args.serbian))
      .collect();
    
    return allVocab.map(word => ({
      _id: word._id,
      unitNumber: word.unitNumber,
      serbian: word.serbian,
      en: word.en,
      de: word.de,
      gender: word.gender,
      pronunciation: word.pronunciation,
    }));
  },
});

// Get vocabulary progress for a user and courseVocabulary
export const getVocabularyProgress = query({
  args: {
    userId: v.id("users"),
    courseVocabularyId: v.id("courseVocabulary"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user_course_vocab", (q) =>
        q.eq("userId", args.userId).eq("courseVocabularyId", args.courseVocabularyId)
      )
      .first();
  },
});

// Create vocabulary progress (for migration script)
export const createVocabularyProgress = mutation({
  args: {
    userId: v.id("users"),
    courseVocabularyId: v.id("courseVocabulary"),
    mastered: v.boolean(),
    reviewCount: v.number(),
    lastReviewedAt: v.optional(v.number()),
    correctAnswerCount: v.number(),
    incorrectAnswerCount: v.number(),
    lastAnsweredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user_course_vocab", (q) =>
        q.eq("userId", args.userId).eq("courseVocabularyId", args.courseVocabularyId)
      )
      .first();
    
    if (existing) {
      return existing._id;
    }
    
    return await ctx.db.insert("vocabularyProgress", {
      userId: args.userId,
      courseVocabularyId: args.courseVocabularyId,
      mastered: args.mastered,
      reviewCount: args.reviewCount,
      lastReviewedAt: args.lastReviewedAt,
      correctAnswerCount: args.correctAnswerCount,
      incorrectAnswerCount: args.incorrectAnswerCount,
      lastAnsweredAt: args.lastAnsweredAt,
    });
  },
});

// ============= ADMIN/CLEANUP HELPERS =============

// Get all vocabularyProgress entries (for cleanup script - requires admin)
export const getAllVocabularyProgress = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }
    
    return await ctx.db
      .query("vocabularyProgress")
      .collect();
  },
});

// Find duplicate vocabulary entries (for cleanup - requires admin)
// Searches BOTH vocabulary (old) and vocabularyProgress (new) tables
export const findDuplicateVocabularyProgress = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }
    
    // Search vocabularyProgress table (new)
    const allProgress = await ctx.db
      .query("vocabularyProgress")
      .collect();
    
    // Search vocabulary table (old) - THIS IS WHERE DUPLICATES LIKELY ARE
    const allVocabulary = await ctx.db
      .query("vocabulary")
      .collect();
    
    // Group vocabularyProgress by userId + courseVocabularyId
    const progressByKey = new Map<string, typeof allProgress>();
    
    for (const progress of allProgress) {
      const key = `${progress.userId}:${progress.courseVocabularyId}`;
      if (!progressByKey.has(key)) {
        progressByKey.set(key, []);
      }
      progressByKey.get(key)!.push(progress);
    }
    
    // Find duplicates in vocabularyProgress
    const progressDuplicates: Array<{
      userId: string;
      courseVocabularyId: string;
      entries: Array<{
        _id: string;
        _creationTime: number;
        correctAnswerCount: number;
        incorrectAnswerCount: number;
        reviewCount: number;
        mastered: boolean;
      }>;
      mergedCounts: {
        correctAnswerCount: number;
        incorrectAnswerCount: number;
        reviewCount: number;
        mastered: boolean;
      };
    }> = [];
    
    for (const [key, entries] of progressByKey.entries()) {
      if (entries.length > 1) {
        const [userId, courseVocabularyId] = key.split(":");
        
        // Sort by creation time (oldest first)
        entries.sort((a, b) => (a._creationTime || 0) - (b._creationTime || 0));
        
        // Calculate merged counts
        let mergedCorrectCount = 0;
        let mergedIncorrectCount = 0;
        let mergedReviewCount = 0;
        let isMastered = false;
        
        for (const entry of entries) {
          mergedCorrectCount += entry.correctAnswerCount || 0;
          mergedIncorrectCount += entry.incorrectAnswerCount || 0;
          mergedReviewCount += entry.reviewCount || 0;
          if (entry.mastered) {
            isMastered = true;
          }
        }
        
        if (mergedCorrectCount >= 3) {
          isMastered = true;
        }
        
        progressDuplicates.push({
          userId,
          courseVocabularyId,
          entries: entries.map(e => ({
            _id: e._id,
            _creationTime: e._creationTime || 0,
            correctAnswerCount: e.correctAnswerCount || 0,
            incorrectAnswerCount: e.incorrectAnswerCount || 0,
            reviewCount: e.reviewCount || 0,
            mastered: e.mastered || false,
            serbianWord: e.serbianWord, // Include original serbianWord for debugging
          })),
          mergedCounts: {
            correctAnswerCount: mergedCorrectCount,
            incorrectAnswerCount: mergedIncorrectCount,
            reviewCount: mergedReviewCount,
            mastered: isMastered,
          },
        });
      }
    }
    
    // Group vocabulary (OLD TABLE) by userId + serbianWord + unitNumber
    const vocabularyByKey = new Map<string, typeof allVocabulary>();
    
    for (const vocab of allVocabulary) {
      const key = `${vocab.userId}:${vocab.serbianWord}:${vocab.unitNumber}`;
      if (!vocabularyByKey.has(key)) {
        vocabularyByKey.set(key, []);
      }
      vocabularyByKey.get(key)!.push(vocab);
    }
    
    // Find duplicates in vocabulary (OLD TABLE) - THIS IS LIKELY WHERE DUPLICATES ARE
    const vocabularyDuplicates: Array<{
      userId: string;
      serbianWord: string;
      unitNumber: number;
      entries: Array<{
        _id: string;
        _creationTime: number;
        correctAnswerCount: number;
        incorrectAnswerCount: number;
        reviewCount: number;
        mastered: boolean;
      }>;
      mergedCounts: {
        correctAnswerCount: number;
        incorrectAnswerCount: number;
        reviewCount: number;
        mastered: boolean;
      };
    }> = [];
    
    for (const [key, entries] of vocabularyByKey.entries()) {
      if (entries.length > 1) {
        const [userId, serbianWord, unitNumberStr] = key.split(":");
        const unitNumber = parseInt(unitNumberStr);
        
        // Sort by creation time (oldest first)
        entries.sort((a, b) => (a._creationTime || 0) - (b._creationTime || 0));
        
        // Calculate merged counts
        let mergedCorrectCount = 0;
        let mergedIncorrectCount = 0;
        let mergedReviewCount = 0;
        let isMastered = false;
        
        for (const entry of entries) {
          mergedCorrectCount += entry.correctAnswerCount || 0;
          mergedIncorrectCount += entry.incorrectAnswerCount || 0;
          mergedReviewCount += entry.reviewCount || 0;
          if (entry.mastered) {
            isMastered = true;
          }
        }
        
        if (mergedCorrectCount >= 3) {
          isMastered = true;
        }
        
        vocabularyDuplicates.push({
          userId,
          serbianWord,
          unitNumber,
          entries: entries.map(e => ({
            _id: e._id,
            _creationTime: e._creationTime || 0,
            correctAnswerCount: e.correctAnswerCount || 0,
            incorrectAnswerCount: e.incorrectAnswerCount || 0,
            reviewCount: e.reviewCount || 0,
            mastered: e.mastered || false,
            serbianWord: e.serbianWord, // Include original serbianWord for debugging
          })),
          mergedCounts: {
            correctAnswerCount: mergedCorrectCount,
            incorrectAnswerCount: mergedIncorrectCount,
            reviewCount: mergedReviewCount,
            mastered: isMastered,
          },
        });
      }
    }
    
    return {
      vocabularyProgress: {
        totalEntries: allProgress.length,
        duplicatesFound: progressDuplicates.length,
        totalDuplicateEntries: progressDuplicates.reduce((sum, d) => sum + d.entries.length, 0),
        duplicates: progressDuplicates,
      },
      vocabulary: {
        totalEntries: allVocabulary.length,
        duplicatesFound: vocabularyDuplicates.length,
        totalDuplicateEntries: vocabularyDuplicates.reduce((sum, d) => sum + d.entries.length, 0),
        duplicates: vocabularyDuplicates,
      },
    };
  },
});

// Update vocabularyProgress (for cleanup script - requires admin)
export const updateVocabularyProgress = mutation({
  args: {
    vocabularyProgressId: v.id("vocabularyProgress"),
    correctAnswerCount: v.number(),
    incorrectAnswerCount: v.number(),
    reviewCount: v.number(),
    mastered: v.boolean(),
    lastAnsweredAt: v.optional(v.number()),
    lastReviewedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }
    
    await ctx.db.patch(args.vocabularyProgressId, {
      correctAnswerCount: args.correctAnswerCount,
      incorrectAnswerCount: args.incorrectAnswerCount,
      reviewCount: args.reviewCount,
      mastered: args.mastered,
      lastAnsweredAt: args.lastAnsweredAt,
      lastReviewedAt: args.lastReviewedAt,
    });
    
    return args.vocabularyProgressId;
  },
});

// Delete vocabularyProgress (for cleanup script - requires admin)
export const deleteVocabularyProgress = mutation({
  args: {
    vocabularyProgressId: v.id("vocabularyProgress"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }
    
    await ctx.db.delete(args.vocabularyProgressId);
    return args.vocabularyProgressId;
  },
});

// ============= CLEANUP OPERATIONS (DELETE) =============

// Batch delete vocabulary by unit numbers (for cleanup scripts)
export const batchDeleteVocabularyByUnits = mutation({
  args: {
    unitNumbers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    let deleted = 0;
    
    for (const unitNumber of args.unitNumbers) {
      const vocabEntries = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
        .collect();
      
      for (const entry of vocabEntries) {
        await ctx.db.delete(entry._id);
        deleted++;
      }
    }
    
    return { deleted };
  },
});


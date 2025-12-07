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

// Get user progress
export const getUserProgress = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return progress;
  },
});

// Update user progress
export const updateProgress = mutation({
  args: {
    currentWeek: v.optional(v.number()),
    currentUnit: v.optional(v.number()),
    learningDuration: v.optional(v.number()),
    uiLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      // Create new progress
      await ctx.db.insert("userProgress", {
        userId: user._id,
        currentWeek: args.currentWeek ?? 1,
        currentUnit: args.currentUnit ?? 1,
        completedUnits: [],
        learningDuration: args.learningDuration ?? 12,
        uiLanguage: args.uiLanguage ?? "en",
      });
    } else {
      // Update existing progress
      const updates: Record<string, unknown> = {};
      if (args.currentWeek !== undefined) updates.currentWeek = args.currentWeek;
      if (args.currentUnit !== undefined) updates.currentUnit = args.currentUnit;
      if (args.learningDuration !== undefined) updates.learningDuration = args.learningDuration;
      if (args.uiLanguage !== undefined) updates.uiLanguage = args.uiLanguage;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(progress._id, updates);
      }
    }
  },
});

// Mark unit as complete
export const completeUnit = mutation({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) throw new Error("User progress not found");

    // Add unit to completed list if not already there
    if (!progress.completedUnits.includes(args.unitNumber)) {
      const newCompletedUnits = [...progress.completedUnits, args.unitNumber];
      await ctx.db.patch(progress._id, {
        completedUnits: newCompletedUnits,
        currentUnit: args.unitNumber + 1,
      });
    }
  },
});

// Get all user progress (admin only)
export const getAllProgress = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.query("userProgress").collect();
  },
});

// Check if unit can be completed (all vocab mastered + all exercises done)
export const canCompleteUnit = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { canComplete: false, reasons: [], vocabMastered: false, vocabTotal: 0, vocabMasteredCount: 0, exercisesCompleted: false };

    const reasons: string[] = [];
    
    // 1. Check if all vocabulary entries in DB are mastered
    // Get all vocabulary progress for this unit
    const userVocabProgress = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .collect();
    
    // Check for any unmastered vocabulary entries
    const unmasteredVocab = userVocabProgress.filter(v => (v.correctAnswerCount || 0) < 3);
    if (unmasteredVocab.length > 0) {
      reasons.push(`${unmasteredVocab.length} Vokabeln noch nicht gemeistert`);
    }
    
    // Count mastered vocabulary
    const masteredVocab = userVocabProgress.filter(v => (v.correctAnswerCount || 0) >= 3);
    
    // 2. Check if vocab quiz is completed with 100%
    // This ensures all vocabulary has been attempted and mastered
    const vocabQuizCompleted = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => 
        q.eq(q.field("unitNumber"), args.unitNumber) &&
        q.eq(q.field("exerciseId"), `vocab_quiz_unit_${args.unitNumber}`)
      )
      .first();
    
    if (!vocabQuizCompleted) {
      reasons.push("Vokabel-Quiz noch nicht absolviert");
    } else {
      // Check if quiz was completed with 100% (all vocab mastered)
      const quizScore = vocabQuizCompleted.totalQuestions > 0 
        ? (vocabQuizCompleted.score / vocabQuizCompleted.totalQuestions) * 100 
        : 0;
      
      if (quizScore < 100) {
        reasons.push("Nicht alle Vokabeln gemeistert (Quiz nicht 100%)");
      }
    }
    
    // 3. Check if other exercises are completed (optional, but if they exist they should be 100%)
    // Get all exercise completions for this unit (excluding vocab quiz)
    const allExerciseCompletions = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => 
        q.eq(q.field("unitNumber"), args.unitNumber) &&
        q.neq(q.field("exerciseId"), `vocab_quiz_unit_${args.unitNumber}`)
      )
      .collect();
    
    // If there are other exercises, they should be completed with 100%
    const incompleteExercises = allExerciseCompletions.filter(e => e.score < e.totalQuestions);
    if (incompleteExercises.length > 0) {
      reasons.push(`${incompleteExercises.length} Übung(en) nicht vollständig abgeschlossen`);
    }
    
    const exercisesCompleted = incompleteExercises.length === 0;
    
    return {
      canComplete: reasons.length === 0,
      reasons,
      vocabMastered: unmasteredVocab.length === 0 && vocabQuizCompleted !== null && vocabQuizCompleted.score === vocabQuizCompleted.totalQuestions,
      vocabTotal: userVocabProgress.length,
      vocabMasteredCount: masteredVocab.length,
      exercisesCompleted,
    };
  },
});


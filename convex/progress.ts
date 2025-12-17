import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { getRequiredExercises } from "./unitExercises";

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    console.log("[getCurrentUser] No identity found");
    return null;
  }

  console.log("[getCurrentUser] Looking up user:", identity.subject);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  console.log("[getCurrentUser] User lookup result:", {
    found: !!user,
    userId: user?._id ?? null
  });

  return user;
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
    console.log(`[Progress] completeUnit called for unit ${args.unitNumber}`);
    
    const user = await getCurrentUser(ctx);
    if (!user) {
      console.error(`[Progress] completeUnit: User not authenticated`);
      throw new Error("Not authenticated");
    }

    console.log(`[Progress] completeUnit: User found: ${user._id}`);

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      console.error(`[Progress] completeUnit: User progress not found`);
      throw new Error("User progress not found");
    }

    console.log(`[Progress] completeUnit: Current progress:`, {
      currentUnit: progress.currentUnit,
      completedUnits: progress.completedUnits,
    });

    // Add unit to completed list if not already there
    if (!progress.completedUnits.includes(args.unitNumber)) {
      const newCompletedUnits = [...progress.completedUnits, args.unitNumber];
      const newCurrentUnit = args.unitNumber + 1;
      
      console.log(`[Progress] completeUnit: Marking unit ${args.unitNumber} as complete`);
      console.log(`[Progress] completeUnit: New completedUnits:`, newCompletedUnits);
      console.log(`[Progress] completeUnit: Setting currentUnit to: ${newCurrentUnit}`);
      
      await ctx.db.patch(progress._id, {
        completedUnits: newCompletedUnits,
        currentUnit: newCurrentUnit,
      });
      
      console.log(`[Progress] completeUnit: Successfully updated progress. Unit ${args.unitNumber} completed, currentUnit now ${newCurrentUnit}`);
    } else {
      console.log(`[Progress] completeUnit: Unit ${args.unitNumber} already in completedUnits, skipping update`);
    }
  },
});

// Allow admins to reset the completion status for a specific unit
export const resetUnitCompletion = mutation({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    if (user.role !== "superadmin" && user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      return {
        updated: false,
        reason: "no_progress_record",
      };
    }

    const completedUnits: number[] = progress.completedUnits || [];
    const newCompletedUnits = completedUnits.filter(
      (unit) => unit !== args.unitNumber
    );

    let newCurrentUnit = progress.currentUnit ?? 1;
    if (newCurrentUnit >= args.unitNumber) {
      newCurrentUnit = Math.max(1, args.unitNumber);
    }

    if (
      newCompletedUnits.length === completedUnits.length &&
      newCurrentUnit === (progress.currentUnit ?? 1)
    ) {
      return {
        updated: false,
        reason: "already_reset",
        progress: {
          currentUnit: progress.currentUnit ?? 1,
          completedUnits,
        },
      };
    }

    const updates: Record<string, unknown> = {};
    if (newCompletedUnits.length !== completedUnits.length) {
      updates.completedUnits = newCompletedUnits;
    }
    if (newCurrentUnit !== (progress.currentUnit ?? 1)) {
      updates.currentUnit = newCurrentUnit;
    }

    await ctx.db.patch(progress._id, updates);

    return {
      updated: true,
      progress: {
        currentUnit: newCurrentUnit,
        completedUnits: newCompletedUnits,
      },
    };
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
    console.log(`[Progress] canCompleteUnit called for unit ${args.unitNumber}`);
    
    const user = await getCurrentUser(ctx);
    if (!user) {
      console.log(`[Progress] canCompleteUnit: User not authenticated`);
      return { canComplete: false, reasons: [], vocabMastered: false, vocabTotal: 0, vocabMasteredCount: 0, exercisesCompleted: false };
    }

    console.log(`[Progress] canCompleteUnit: User found: ${user._id}`);

    const reasons: string[] = [];
    
    // 1. Check if all vocabulary entries in DB are mastered
    // Get all vocabulary progress for this unit
    const userVocabProgress = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .collect();
    
    console.log(`[Progress] canCompleteUnit: Found ${userVocabProgress.length} vocabulary entries for unit ${args.unitNumber}`);
    
    // Check for any unmastered vocabulary entries
    // For unit unlocking: vocabulary needs to be answered correctly at least once (>= 1)
    // "Mastered" status (3x correct) is separate from "passed" status (1x correct)
    const unmasteredVocab = userVocabProgress.filter(v => (v.correctAnswerCount || 0) < 1);
    console.log(`[Progress] canCompleteUnit: Unmastered vocab (not answered correctly yet): ${unmasteredVocab.length}, Passed vocab (answered correctly at least once): ${userVocabProgress.length - unmasteredVocab.length}`);
    
    if (unmasteredVocab.length > 0) {
      reasons.push(`${unmasteredVocab.length} vocabulary item(s) not answered correctly yet`);
    }
    
    // Count passed vocabulary (answered correctly at least once)
    const masteredVocab = userVocabProgress.filter(v => (v.correctAnswerCount || 0) >= 1);
    
    // 2. Check if vocab quiz is completed with 100%
    // This ensures all vocabulary has been attempted and mastered
    // BUT: If all vocabulary is already mastered (3x correct), quiz is optional
    const vocabQuizId = `vocab_quiz_unit_${args.unitNumber}`;
    console.log(`[Progress] canCompleteUnit: Looking for vocab quiz with exerciseId: ${vocabQuizId}`);
    
    const vocabQuizCompleted = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => 
        q.eq(q.field("unitNumber"), args.unitNumber) &&
        q.eq(q.field("exerciseId"), vocabQuizId)
      )
      .first();
    
    const allVocabMastered = unmasteredVocab.length === 0 && userVocabProgress.length > 0;
    
    if (!vocabQuizCompleted) {
      console.log(`[Progress] canCompleteUnit: Vocab quiz NOT found`);
      if (!allVocabMastered) {
        // Only require quiz if vocabulary is not all mastered
        console.log(`[Progress] canCompleteUnit: Requiring quiz because not all vocab mastered`);
        reasons.push("Vocabulary quiz not completed yet");
      } else {
        console.log(`[Progress] canCompleteUnit: Quiz optional - all vocabulary already mastered`);
      }
    } else {
      console.log(`[Progress] canCompleteUnit: Vocab quiz found: score=${vocabQuizCompleted.score}/${vocabQuizCompleted.totalQuestions}`);
      // Check if quiz was completed with 100% (all vocab mastered)
      const quizScore = vocabQuizCompleted.totalQuestions > 0 
        ? (vocabQuizCompleted.score / vocabQuizCompleted.totalQuestions) * 100 
        : 0;
      
      if (quizScore < 100) {
        console.log(`[Progress] canCompleteUnit: Quiz score < 100%: ${quizScore}%`);
        reasons.push("Not all vocabulary mastered (quiz < 100%)");
      } else {
        console.log(`[Progress] canCompleteUnit: Quiz score = 100% ✓`);
      }
    }
    
    // 3. Check if ALL required exercises are completed with perfect score
    // Get list of all required exercises for this unit
    const requiredExercises = getRequiredExercises(args.unitNumber);
    console.log(`[Progress] canCompleteUnit: Required exercises for unit ${args.unitNumber}:`, requiredExercises);
    
    // Get all existing exercise completions for this unit (excluding vocab quiz)
    const allExerciseCompletions = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => 
        q.eq(q.field("unitNumber"), args.unitNumber) &&
        q.neq(q.field("exerciseId"), vocabQuizId)
      )
      .collect();
    
    console.log(`[Progress] canCompleteUnit: Found ${allExerciseCompletions.length} exercise completions for unit ${args.unitNumber}`);
    
    // Create a map of exerciseId -> completion record for quick lookup
    const completionMap = new Map(
      allExerciseCompletions.map(c => [c.exerciseId, c])
    );
    
    // Check if ALL required exercises are completed at least once with perfect score
    const missingExercises: string[] = [];
    const incompleteExercises: Array<{exerciseId: string, score: number, totalQuestions: number}> = [];
    
    for (const exerciseId of requiredExercises) {
      const completion = completionMap.get(exerciseId);
      
      if (!completion) {
        // Exercise was never attempted
        missingExercises.push(exerciseId);
        console.log(`[Progress] canCompleteUnit: Exercise ${exerciseId} not completed yet`);
      } else if (completion.score < completion.totalQuestions) {
        // Exercise was attempted but not completed perfectly
        incompleteExercises.push({
          exerciseId,
          score: completion.score,
          totalQuestions: completion.totalQuestions
        });
        console.log(`[Progress] canCompleteUnit: Exercise ${exerciseId} incomplete: ${completion.score}/${completion.totalQuestions}`);
      } else {
        // Exercise completed perfectly ✓
        console.log(`[Progress] canCompleteUnit: Exercise ${exerciseId} completed perfectly ✓`);
      }
    }
    
    // Add reasons for missing or incomplete exercises
    if (missingExercises.length > 0) {
      reasons.push(`${missingExercises.length} exercise(s) not completed yet: ${missingExercises.join(', ')}`);
    }
    
    if (incompleteExercises.length > 0) {
      incompleteExercises.forEach(ex => {
        reasons.push(`Exercise "${ex.exerciseId}" not fully completed (${ex.score}/${ex.totalQuestions})`);
      });
    }
    
    const exercisesCompleted = missingExercises.length === 0 && incompleteExercises.length === 0;
    
    const result = {
      canComplete: reasons.length === 0,
      reasons,
      vocabMastered: unmasteredVocab.length === 0 && userVocabProgress.length > 0, // All vocab answered correctly at least once
      vocabTotal: userVocabProgress.length,
      vocabMasteredCount: masteredVocab.length, // Count of vocab answered correctly at least once
      exercisesCompleted,
    };
    
    console.log(`[Progress] canCompleteUnit: Result for unit ${args.unitNumber}:`, {
      canComplete: result.canComplete,
      reasons: result.reasons,
      vocabMastered: result.vocabMastered,
      vocabTotal: result.vocabTotal,
      vocabMasteredCount: result.vocabMasteredCount,
      exercisesCompleted: result.exercisesCompleted,
    });
    
    return result;
  },
});

// Determine if a unit is fully mastered (all vocab + exercises answered 3x correctly)
export const getUnitMasteryStatus = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    // Vocabulary mastery
    // Try NEW structure first: vocabularyProgress + courseVocabulary JOIN
    let vocabEntries: Array<{ mastered: boolean; correctAnswerCount: number }> = [];
    
    const vocabProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    if (vocabProgress.length > 0) {
      // NEW structure: Filter by unitNumber via courseVocabulary JOIN
      for (const vp of vocabProgress) {
        const courseVocab = await ctx.db.get(vp.courseVocabularyId);
        if (courseVocab && courseVocab.unitNumber === args.unitNumber) {
          vocabEntries.push({
            mastered: vp.mastered,
            correctAnswerCount: vp.correctAnswerCount,
          });
        }
      }
    } else {
      // FALLBACK: Use old vocabulary table structure
      vocabEntries = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
        )
        .collect();
    }

    const vocabTotal = vocabEntries.length;
    const vocabMasteredCount = vocabEntries.filter(
      (entry) => entry.mastered || (entry.correctAnswerCount ?? 0) >= 3
    ).length;
    const vocabMastered = vocabTotal > 0 && vocabMasteredCount === vocabTotal;

    // Exercise question mastery
    const exerciseQuestionEntries = await ctx.db
      .query("exerciseQuestionProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("unitNumber"), args.unitNumber))
      .collect();

    const exerciseQuestionTotal = exerciseQuestionEntries.length;
    const exerciseQuestionMasteredCount = exerciseQuestionEntries.filter(
      (entry) => entry.mastered || (entry.correctAnswerCount ?? 0) >= 3
    ).length;
    const exerciseQuestionsMastered =
      exerciseQuestionTotal > 0 &&
      exerciseQuestionMasteredCount === exerciseQuestionTotal;

    const isMastered =
      vocabMastered &&
      exerciseQuestionsMastered &&
      vocabTotal > 0 &&
      exerciseQuestionTotal > 0;

    return {
      unitNumber: args.unitNumber,
      vocabTotal,
      vocabMasteredCount,
      vocabMastered,
      exerciseQuestionTotal,
      exerciseQuestionMasteredCount,
      exerciseQuestionsMastered,
      isMastered,
    };
  },
});

// List all units that are fully mastered for the current user
export const getMasteredUnits = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    try {
      // Try NEW structure first: vocabularyProgress + courseVocabulary JOIN
      const vocabProgress = await ctx.db
        .query("vocabularyProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500); // Reduced limit

      let vocabEntries: Array<{ unitNumber: number; mastered: boolean; correctAnswerCount: number }> = [];
      
      if (vocabProgress.length > 0) {
        // NEW structure: Get unitNumber from courseVocabulary
        for (const vp of vocabProgress) {
          const courseVocab = await ctx.db.get(vp.courseVocabularyId);
          if (courseVocab) {
            vocabEntries.push({
              unitNumber: courseVocab.unitNumber,
              mastered: vp.mastered,
              correctAnswerCount: vp.correctAnswerCount,
            });
          }
        }
      } else {
        // FALLBACK: Use old vocabulary table structure
        vocabEntries = await ctx.db
          .query("vocabulary")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .take(500); // Reduced limit
      }

      const exerciseEntries = await ctx.db
        .query("exerciseQuestionProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500); // Reduced limit

      const vocabStats = new Map<number, { total: number; mastered: number }>();
      const exerciseStats = new Map<number, { total: number; mastered: number }>();

      // Process vocabulary data
      for (const entry of vocabEntries) {
        const stat = vocabStats.get(entry.unitNumber) ?? { total: 0, mastered: 0 };
        stat.total += 1;
        if (entry.mastered || (entry.correctAnswerCount ?? 0) >= 3) {
          stat.mastered += 1;
        }
        vocabStats.set(entry.unitNumber, stat);
      }

      // Process exercise data
      for (const entry of exerciseEntries) {
        const stat = exerciseStats.get(entry.unitNumber) ?? { total: 0, mastered: 0 };
        stat.total += 1;
        if (entry.mastered || (entry.correctAnswerCount ?? 0) >= 3) {
          stat.mastered += 1;
        }
        exerciseStats.set(entry.unitNumber, stat);
      }

      const masteredUnits: number[] = [];
      const candidateUnits = Array.from(
        new Set([
          ...Array.from(vocabStats.keys()),
          ...Array.from(exerciseStats.keys())
        ])
      );

      for (const unitNumber of candidateUnits) {
        const vocab = vocabStats.get(unitNumber);
        const exercises = exerciseStats.get(unitNumber);
        const hasVocab = vocab && vocab.total > 0;
        const hasExercises = exercises && exercises.total > 0;

        if (hasVocab && hasExercises && vocab!.mastered === vocab!.total && exercises!.mastered === exercises!.total) {
          masteredUnits.push(unitNumber);
        }
      }

      return masteredUnits;
    } catch (error) {
      // If there's any error, return empty array to prevent client crashes
      console.error("[getMasteredUnits] Error, returning empty array:", error);
      return [];
    }
  },
});

// ============= INTERACTIVE TEST PROGRESS (Block-based with per-question mastery) =============

// Submit results for Interactive Test category (block-based checking)
export const submitCategoryResult = mutation({
  args: {
    unitNumber: v.number(),
    category: v.string(),
    questionResults: v.array(v.object({
      questionId: v.string(),
      isCorrect: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    let totalXP = 0;
    const updatedProgress: Array<{
      questionId: string;
      correctAttempts: number;
      isMastered: boolean;
      xpEarned: number;
    }> = [];

    for (const result of args.questionResults) {
      if (!result.isCorrect) {
        // Falsche Antworten zählen nicht für Progress/XP
        continue;
      }

      // Hole existierenden Progress für diese Frage
      const existingProgress = await ctx.db
        .query("questionProgress")
        .withIndex("by_user_question", (q) => 
          q.eq("userId", user._id).eq("questionId", result.questionId)
        )
        .first();

      const correctAttempts = (existingProgress?.correctAttempts ?? 0) + 1;
      const isMastered = correctAttempts >= 3;

      // XP-Berechnung nach .cursorrules:
      // 1st correct=10 XP, 2nd correct=5 XP, 3rd correct=3 XP, mastered (>3)=0 XP
      let xpForQuestion = 0;
      if (correctAttempts === 1) xpForQuestion = 10;
      else if (correctAttempts === 2) xpForQuestion = 5;
      else if (correctAttempts === 3) xpForQuestion = 3;
      // Nach Mastery (>3): 0 XP

      totalXP += xpForQuestion;

      // Update oder Create Progress
      if (existingProgress) {
        await ctx.db.patch(existingProgress._id, {
          correctAttempts,
          isMastered,
          totalXPEarned: (existingProgress.totalXPEarned ?? 0) + xpForQuestion,
          lastAttemptAt: Date.now(),
        });
      } else {
        await ctx.db.insert("questionProgress", {
          userId: user._id,
          unitNumber: args.unitNumber,
          questionId: result.questionId,
          correctAttempts,
          isMastered,
          totalXPEarned: xpForQuestion,
          lastAttemptAt: Date.now(),
        });
      }

      updatedProgress.push({
        questionId: result.questionId,
        correctAttempts,
        isMastered,
        xpEarned: xpForQuestion,
      });
    }

    // Update User XP
    await ctx.db.patch(user._id, {
      totalXP: (user.totalXP ?? 0) + totalXP,
    });

    console.log(`[Progress] submitCategoryResult: User ${user._id} earned ${totalXP} XP from ${args.category} in unit ${args.unitNumber}`);

    return { 
      earnedXP: totalXP,
      updatedProgress,
    };
  },
});

// Get question progress for a unit (Mastery status)
export const getQuestionProgress = query({
  args: { unitNumber: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const progress = await ctx.db
      .query("questionProgress")
      .withIndex("by_user_unit", (q) => 
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .collect();

    return progress;
  },
});

// Get aggregated dashboard stats for progress page
export const getDashboardStats = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // 1. Get User Progress (Units)
    const userProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // 2. Get Daily Activity (Last 7 days for Chart)
    const dailyActivities = await ctx.db
      .query("dailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(7);

    // 3. Get Vocabulary Stats for Accuracy Chart
    const vocabProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let masteredCount = 0;

    for (const vp of vocabProgress) {
      totalCorrect += vp.correctAnswerCount || 0;
      totalIncorrect += vp.incorrectAnswerCount || 0;
      if (vp.mastered) masteredCount++;
    }

    // 4. Exercise Stats (optional, but good for accuracy)
    const exerciseProgress = await ctx.db
      .query("exerciseQuestionProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const ep of exerciseProgress) {
      totalCorrect += ep.correctAnswerCount || 0;
      totalIncorrect += ep.incorrectAnswerCount || 0;
    }

    return {
      // Gamification
      totalXP: user.totalXP || 0,
      level: user.level || 1,
      currentStreak: user.currentStreak || 0,
      learningLanguage: user.learningLanguage || "en",

      // Progress
      completedUnits: userProgress?.completedUnits || [],
      currentWeek: userProgress?.currentWeek || 1,
      learningDuration: userProgress?.learningDuration || 12,
      creationTime: userProgress?._creationTime || user._creationTime,

      // Charts Data
      activityChart: dailyActivities.reverse().map(a => ({
        date: a.activityDate,
        xp: a.xpEarned,
        units: a.unitsCompleted,
        exercises: a.exercisesCompleted
      })),
      
      accuracyStats: {
        totalCorrect,
        totalIncorrect,
        totalAttempts: totalCorrect + totalIncorrect,
        masteredVocab: masteredCount,
        totalVocabLearned: vocabProgress.length
      }
    };
  }
});

// Check if a questionId has any user progress (for migration safety)
// This is an internal query that can be called from migration scripts
export const hasQuestionProgress = query({
  args: {
    questionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if any user has progress for this question
    const progress = await ctx.db
      .query("questionProgress")
      .withIndex("by_user_question", (q) => q.eq("questionId", args.questionId))
      .first();
    
    return progress !== null;
  },
});

// Get all questionIds that have user progress (for migration safety)
export const getQuestionIdsWithProgress = query({
  handler: async (ctx) => {
    const allProgress = await ctx.db.query("questionProgress").collect();
    const questionIds = new Set(allProgress.map(p => p.questionId));
    return Array.from(questionIds);
  },
});

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { getRequiredExercises } from "./unitExercises";
import { upsertDailyActivityByUserId } from "./units";

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

async function isPreviewUnit(ctx: QueryCtx | MutationCtx, unitNumber: number): Promise<boolean> {
  // We treat a unit as "preview" if there is any active unitMetadata row marked releaseStatus="preview"
  // for English (current base language). Undefined releaseStatus counts as published.
  const metas = await ctx.db
    .query("unitMetadata")
    .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
    .collect();
  return (metas as any[]).some((m) => (m as any).releaseStatus === "preview");
}

// Get user progress
// Automatically corrects currentUnit if it doesn't match completedUnits
export const getUserProgress = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) return null;

    // Calculate the correct currentUnit based on completedUnits.
    // We must never skip ahead on non-consecutive completion data (e.g. [1,5] must yield 2, not 6).
    // Rule: currentUnit is the first missing unit in the sequence starting from 1.
    const completedUnitsRaw = progress.completedUnits || [];
    const completedUnits = Array.from(
      new Set(completedUnitsRaw.filter((n) => Number.isInteger(n) && n > 0))
    ).sort((a, b) => a - b);

    let correctCurrentUnit = 1;
    for (const unit of completedUnits) {
      if (unit === correctCurrentUnit) {
        correctCurrentUnit += 1;
        continue;
      }
      if (unit > correctCurrentUnit) break;
      // unit < correctCurrentUnit: duplicate/out-of-order -> ignore
    }

    // Return corrected progress (don't modify DB in query, just return corrected value)
    if (progress.currentUnit !== correctCurrentUnit) {
      return {
        ...progress,
        currentUnit: correctCurrentUnit,
      };
    }

    return progress;
  },
});

// Update user progress
export const updateProgress = mutation({
  args: {
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
        currentUnit: args.currentUnit ?? 1,
        completedUnits: [],
        learningDuration: args.learningDuration ?? 12,
        uiLanguage: args.uiLanguage ?? "en",
      });
    } else {
      // Update existing progress
      const updates: Record<string, unknown> = {};
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

    // Preview units are read-only (no progress writes)
    if (user.role === "superadmin" && (await isPreviewUnit(ctx, args.unitNumber))) {
      console.log(`[Progress] completeUnit: Preview mode - skipping progress write for unit ${args.unitNumber}`);
      return;
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

    // Preview units are read-only (no XP/progress writes). Still return a successful response
    // so the UI can show correctness feedback without persisting anything.
    if (user.role === "superadmin" && (await isPreviewUnit(ctx, args.unitNumber))) {
      console.log(`[Progress] submitCategoryResult: Preview mode - no writes for unit ${args.unitNumber}`);
      return { earnedXP: 0, updatedProgress: [] as any[] };
    }

    let totalXP = 0;
    const updatedProgress: Array<{
      questionId: string;
      correctAttempts: number;
      incorrectAttempts: number;
      isMastered: boolean;
      xpEarned: number;
    }> = [];

    for (const result of args.questionResults) {
      // Hole existierenden Progress für diese Frage
      const existingProgress = await ctx.db
        .query("questionProgress")
        .withIndex("by_user_question", (q) => 
          q.eq("userId", user._id).eq("questionId", result.questionId)
        )
        .first();

      const prevCorrectAttempts = existingProgress?.correctAttempts ?? 0;
      const prevIncorrectAttempts = existingProgress?.incorrectAttempts ?? 0;

      const correctAttempts = result.isCorrect ? prevCorrectAttempts + 1 : prevCorrectAttempts;
      const incorrectAttempts = result.isCorrect ? prevIncorrectAttempts : prevIncorrectAttempts + 1;
      const isMastered = correctAttempts >= 3;

      // XP-Berechnung: Einheitlich für Vocabulary + Exercises
      // 1st correct=5 XP, 2nd correct=10 XP, 3rd correct=20 XP (Mastered!), danach=0 XP
      let xpForQuestion = 0;
      if (result.isCorrect) {
        if (correctAttempts === 1) xpForQuestion = 5;
        else if (correctAttempts === 2) xpForQuestion = 10;
        else if (correctAttempts === 3) xpForQuestion = 20;
      }
      // Nach Mastery (>3): 0 XP

      totalXP += xpForQuestion;

      // Update oder Create Progress
      if (existingProgress) {
        await ctx.db.patch(existingProgress._id, {
          correctAttempts,
          incorrectAttempts,
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
          incorrectAttempts,
          isMastered,
          totalXPEarned: xpForQuestion,
          lastAttemptAt: Date.now(),
        });
      }

      updatedProgress.push({
        questionId: result.questionId,
        correctAttempts,
        incorrectAttempts,
        isMastered,
        xpEarned: xpForQuestion,
      });
    }

    // Update User XP
    await ctx.db.patch(user._id, {
      totalXP: (user.totalXP ?? 0) + totalXP,
    });

    // Daily activity aggregation (for 7/30-day leaderboards + analytics)
    if (totalXP > 0) {
      await upsertDailyActivityByUserId(ctx, user._id, {
        xpEarned: totalXP,
        exercisesCompleted: 1,
      });
    }

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

    const dayMs = 24 * 60 * 60 * 1000;
    const startOfDay = (ts: number) => {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const todayStart = startOfDay(Date.now());
    const window7Start = todayStart - 6 * dayMs;
    const window30Start = todayStart - 29 * dayMs;
    const windowAllStart = todayStart - (3650 - 1) * dayMs;

    // 1. Get User Progress (Units)
    const userProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // 2. Get Daily Activity (Last 7 days for Chart / Weekly XP)
    const dailyActivities7 = await ctx.db
      .query("dailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .filter((q) => q.gte(q.field("activityDate"), window7Start))
      .collect();
    // Ensure chronological order for chart payload.
    dailyActivities7.sort((a, b) => (a.activityDate ?? 0) - (b.activityDate ?? 0));

    // 2b. Activity stats (Last 30 days)
    const dailyActivities30 = await ctx.db
      .query("dailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .filter((q) => q.gte(q.field("activityDate"), window30Start))
      .collect();

    // Active Days: a day counts if user earned XP OR sent at least one Learn Buddy message that day.
    const activeDaySet30 = new Set<number>();
    for (const a of dailyActivities30) {
      if ((a.xpEarned ?? 0) > 0) activeDaySet30.add(startOfDay(a.activityDate));
    }
    const chatMessages30 = await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("role"), "user"))
      .filter((q) => q.gte(q.field("_creationTime"), window30Start))
      .collect();
    for (const m of chatMessages30) {
      activeDaySet30.add(startOfDay(m._creationTime));
    }
    const activeDays30d = activeDaySet30.size;

    // Weekly goal/progress (must stay consistent with Active Days definition):
    // - XP this week: sum of dailyActivity.xpEarned in last 7 days
    // - Active days this week: union of (xpEarned>0) OR (>=1 chat message with role=user) in last 7 days
    const activeDaySet7 = new Set<number>();
    for (const a of dailyActivities7) {
      if ((a.xpEarned ?? 0) > 0) activeDaySet7.add(startOfDay(a.activityDate));
    }
    const chatMessages7 = await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("role"), "user"))
      .filter((q) => q.gte(q.field("_creationTime"), window7Start))
      .collect();
    for (const m of chatMessages7) {
      activeDaySet7.add(startOfDay(m._creationTime));
    }
    const weeklyProgress = {
      windowDays: 7,
      activeDays: activeDaySet7.size,
      xpSum: dailyActivities7.reduce((sum, a) => sum + (a.xpEarned ?? 0), 0),
    };
    const weeklyGoal = {
      windowDays: 7,
      activeDaysTarget: 3,
      xpTarget: 150,
    };

    // Active Days (for streaks): look back up to 10 years to avoid missing legacy rows.
    const activeDaySetAll = new Set<number>();
    const dailyActivitiesAll = await ctx.db
      .query("dailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .filter((q) => q.gte(q.field("activityDate"), windowAllStart))
      .collect();
    for (const a of dailyActivitiesAll) {
      if ((a.xpEarned ?? 0) > 0) activeDaySetAll.add(startOfDay(a.activityDate));
    }
    const chatMessagesAll = await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("role"), "user"))
      .filter((q) => q.gte(q.field("_creationTime"), windowAllStart))
      .collect();
    for (const m of chatMessagesAll) {
      activeDaySetAll.add(startOfDay(m._creationTime));
    }

    const activeDaysSorted = Array.from(activeDaySetAll).sort((a, b) => a - b);
    const lastActiveDay = activeDaysSorted.length > 0 ? activeDaysSorted[activeDaysSorted.length - 1] : null;
    const streakEnd = activeDaySetAll.has(todayStart) ? todayStart : lastActiveDay;
    let activeDaysCurrentStreak = 0;
    if (streakEnd !== null) {
      for (let d = streakEnd; activeDaySetAll.has(d); d -= dayMs) {
        activeDaysCurrentStreak += 1;
      }
    }

    let activeDaysLongestStreak = 0;
    if (activeDaysSorted.length > 0) {
      let run = 1;
      activeDaysLongestStreak = 1;
      for (let i = 1; i < activeDaysSorted.length; i++) {
        if (activeDaysSorted[i] - activeDaysSorted[i - 1] === dayMs) {
          run += 1;
        } else {
          run = 1;
        }
        if (run > activeDaysLongestStreak) activeDaysLongestStreak = run;
      }
    }

    // 3. Get Vocabulary Stats for Accuracy Chart
    const vocabProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let masteredCount = 0;

    // Mastery quality (how cleanly the user reached mastery)
    let masteredCorrect = 0;
    let masteredIncorrect = 0;

    for (const vp of vocabProgress) {
      totalCorrect += vp.correctAnswerCount || 0;
      totalIncorrect += vp.incorrectAnswerCount || 0;
      if (vp.mastered) {
        masteredCount++;
        masteredCorrect += vp.correctAnswerCount || 0;
        masteredIncorrect += vp.incorrectAnswerCount || 0;
      }
    }

    // 4. Exercise Stats (optional, but good for accuracy)
    const exerciseProgress = await ctx.db
      .query("exerciseQuestionProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const ep of exerciseProgress) {
      totalCorrect += ep.correctAnswerCount || 0;
      totalIncorrect += ep.incorrectAnswerCount || 0;

      if (ep.mastered) {
        masteredCorrect += ep.correctAnswerCount || 0;
        masteredIncorrect += ep.incorrectAnswerCount || 0;
      }
    }

    return {
      // Gamification
      totalXP: user.totalXP || 0,
      level: user.level || 1,
      currentStreak: user.currentStreak || 0,
      activeDaysCurrentStreak,
      activeDaysLongestStreak,
      activeDays30d,
      weeklyGoal,
      weeklyProgress,
      learningLanguage: user.learningLanguage || "en",

      // Progress
      completedUnits: userProgress?.completedUnits || [],
      learningDuration: userProgress?.learningDuration || 12,
      creationTime: userProgress?._creationTime || user._creationTime,

      // Charts Data
      activityChart: dailyActivities7.map(a => ({
        date: a.activityDate,
        xp: a.xpEarned,
        units: a.unitsCompleted,
        exercises: a.exercisesCompleted
      })),
      activityStats30d: (() => {
        const windowDays = 30;
        const activeDays = activeDays30d;
        const xpSum = dailyActivities30.reduce((sum, a) => sum + (a.xpEarned ?? 0), 0);
        const avgXpPerActiveDay = activeDays > 0 ? xpSum / activeDays : 0;
        const activeDaysPerWeek = activeDays / (windowDays / 7);

        return {
          windowDays,
          activeDays,
          xpSum,
          avgXpPerActiveDay,
          activeDaysPerWeek,
        };
      })(),
      
      accuracyStats: {
        totalCorrect,
        totalIncorrect,
        totalAttempts: totalCorrect + totalIncorrect,
        masteredVocab: masteredCount,
        totalVocabLearned: vocabProgress.length
      },

      masteryQuality: {
        masteredCorrect,
        masteredIncorrect,
        masteredAttempts: masteredCorrect + masteredIncorrect,
        masteredEfficiency:
          masteredCorrect + masteredIncorrect > 0
            ? masteredCorrect / (masteredCorrect + masteredIncorrect)
            : null,
      }
    };
  }
});

// Backfill dailyActivity for legacy users (best-effort, runs once per user)
// Strategy:
// - If the user has NO dailyActivity entries: reconstruct best-effort from legacy sources.
// - If the user already has some dailyActivity: reconcile missing XP so Lifetime can match totalXP.
export const backfillDailyActivityForCurrentUser = mutation({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const startOfDay = (ts: number) => {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };

    const totalXP = user.totalXP ?? 0;

    const existingAny = await ctx.db
      .query("dailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .first();
    if (existingAny) {
      // Reconcile: if totalXP is greater than the sum of dailyActivity, add the missing XP as a single synthetic entry.
      const all = await ctx.db
        .query("dailyActivity")
        .withIndex("by_user_date", (q) => q.eq("userId", user._id))
        .collect();
      const sum = all.reduce((s, a) => s + (a.xpEarned ?? 0), 0);
      const delta = totalXP - sum; // + => missing, - => overcount
      if (delta === 0) {
        return { skipped: true, reason: "already_consistent" as const, sumDailyActivity: sum, totalXP };
      }
      if (delta < 0) {
        // dailyActivity overcounts vs totalXP → subtract the extra, prioritizing "synthetic-looking" rows.
        let extra = -delta;
        const isSyntheticLike = (a: any) => (a.unitsCompleted ?? 0) === 0 && (a.exercisesCompleted ?? 0) === 0;
        const candidates = [...all].sort((a: any, b: any) => {
          const sa = isSyntheticLike(a) ? 1 : 0;
          const sb = isSyntheticLike(b) ? 1 : 0;
          if (sa !== sb) return sb - sa;
          return (b.xpEarned ?? 0) - (a.xpEarned ?? 0);
        });

        let patched = 0;
        let deleted = 0;
        for (const a of candidates) {
          if (extra <= 0) break;
          const xp = a.xpEarned ?? 0;
          if (xp <= 0) continue;
          const take = Math.min(extra, xp);
          const next = xp - take;
          if (next <= 0) {
            await ctx.db.delete(a._id);
            deleted += 1;
          } else {
            await ctx.db.patch(a._id, { xpEarned: next });
            patched += 1;
          }
          extra -= take;
        }

        return {
          skipped: false,
          reconciledExtraXp: -delta,
          patched,
          deleted,
          sumDailyActivity: sum,
          totalXP,
          remainingExtra: extra,
        };
      }

      const day = startOfDay(user.lastActiveDate ?? user._creationTime);
      const existingDay = all.find((a) => a.activityDate === day);
      if (existingDay) {
        await ctx.db.patch(existingDay._id, {
          xpEarned: (existingDay.xpEarned ?? 0) + delta,
        });
      } else {
        await ctx.db.insert("dailyActivity", {
          userId: user._id,
          activityDate: day,
          unitsCompleted: 0,
          exercisesCompleted: 0,
          xpEarned: delta,
        });
      }

      return { skipped: false, reconciledMissingXp: delta, day, sumDailyActivity: sum, totalXP };
    }

    const agg = new Map<number, { xp: number; units: number; exercises: number }>();
    const add = (ts: number | undefined | null, xp: number, units: number, exercises: number) => {
      if (!ts || xp <= 0) return;
      const day = startOfDay(ts);
      const prev = agg.get(day) ?? { xp: 0, units: 0, exercises: 0 };
      agg.set(day, { xp: prev.xp + xp, units: prev.units + units, exercises: prev.exercises + exercises });
    };

    // 1) exerciseCompletions: most reliable historic XP source (has xpEarned + _creationTime)
    const completions = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const c of completions) {
      add(c._creationTime, c.xpEarned ?? 0, 0, 1);
    }

    // 2) interactive test questionProgress: totalXPEarned is cumulative per question; attribute to lastAttemptAt
    const questionProgress = await ctx.db
      .query("questionProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const p of questionProgress) {
      add(p.lastAttemptAt, p.totalXPEarned ?? 0, 0, 1);
    }

    // 3) exerciseQuestionProgress: derive max XP per question from correctAnswerCount (10/5/3)
    const exerciseQuestionProgress = await ctx.db
      .query("exerciseQuestionProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const p of exerciseQuestionProgress) {
      const n = Math.min(Math.max(p.correctAnswerCount ?? 0, 0), 3);
      const xpForQuestion = n === 0 ? 0 : n === 1 ? 10 : n === 2 ? 15 : 18;
      add(p.lastAnsweredAt ?? p.lastReviewedAt ?? p._creationTime, xpForQuestion, 0, 1);
    }

    // 4) If still nothing, bail early
    if (agg.size === 0) {
      // As a last-resort fallback for legacy users:
      // If the user has totalXP but we cannot reconstruct timestamps, write a single synthetic day
      // so the Lifetime chart is not empty.
      if (totalXP <= 0) {
        return { skipped: true, reason: "no_legacy_sources" as const };
      }
      const day = startOfDay(user.lastActiveDate ?? user._creationTime);
      await ctx.db.insert("dailyActivity", {
        userId: user._id,
        activityDate: day,
        unitsCompleted: 0,
        exercisesCompleted: 0,
        xpEarned: totalXP,
      });
      return { skipped: false, daysWritten: 1, xpSum: totalXP, synthetic: true as const };
    }

    // If our reconstruction overcounts vs canonical totalXP, reduce the largest buckets first
    // so the resulting sum cannot exceed totalXP.
    if (totalXP > 0) {
      const sumAgg = Array.from(agg.values()).reduce((s, v) => s + (v.xp ?? 0), 0);
      if (sumAgg > totalXP) {
        let extra = sumAgg - totalXP;
        const entries = Array.from(agg.entries()).sort((a, b) => (b[1].xp ?? 0) - (a[1].xp ?? 0));
        for (const [day, v] of entries) {
          if (extra <= 0) break;
          const xp = v.xp ?? 0;
          if (xp <= 0) continue;
          const take = Math.min(extra, xp);
          agg.set(day, { ...v, xp: xp - take });
          extra -= take;
        }
      }
    }

    // Write dailyActivity rows
    let daysWritten = 0;
    let xpSum = 0;
    for (const [day, v] of agg.entries()) {
      if (v.xp <= 0) continue;
      await ctx.db.insert("dailyActivity", {
        userId: user._id,
        activityDate: day,
        unitsCompleted: v.units,
        exercisesCompleted: v.exercises,
        xpEarned: v.xp,
      });
      daysWritten += 1;
      xpSum += v.xp;
    }

    // Reconcile any remaining missing XP (e.g., if legacy sources undercount).
    if (totalXP > 0 && xpSum < totalXP) {
      const missing = totalXP - xpSum;
      const day = startOfDay(user.lastActiveDate ?? user._creationTime);
      // If the reconstruction already wrote that day, patch it; else insert.
      const existing = await ctx.db
        .query("dailyActivity")
        .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("activityDate", day))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { xpEarned: (existing.xpEarned ?? 0) + missing });
      } else {
        await ctx.db.insert("dailyActivity", {
          userId: user._id,
          activityDate: day,
          unitsCompleted: 0,
          exercisesCompleted: 0,
          xpEarned: missing,
        });
        daysWritten += 1;
      }
      xpSum += missing;
      return { skipped: false, daysWritten, xpSum, reconciledMissingXp: missing };
    }

    return { skipped: false, daysWritten, xpSum };
  },
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
      // Index is (userId, questionId), so we can't query by questionId alone here.
      // This query is only used for migration safety checks; a full scan is acceptable.
      .filter((q) => q.eq(q.field("questionId"), args.questionId))
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

// Check if user has any activity in a specific unit (vocabulary, exercises, questions)
// Returns true if user has started working on the unit, false if not yet started
export const hasUnitActivity = query({
  args: { unitNumber: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { hasActivity: false };
    }

    // 1. Check exerciseCompletions - user has done exercises in this unit
    const exerciseCompletion = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("unitNumber"), args.unitNumber))
      .first();
    
    if (exerciseCompletion) {
      return { hasActivity: true };
    }

    // 2. Check questionProgress - user has answered questions in this unit
    const questionProg = await ctx.db
      .query("questionProgress")
      .withIndex("by_user_unit", (q) => 
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();
    
    if (questionProg) {
      return { hasActivity: true };
    }

    // 3. Check vocabularyProgress via courseVocabulary join
    // First get all courseVocabulary IDs for this unit
    const courseVocabForUnit = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    
    if (courseVocabForUnit.length > 0) {
      // Check if user has any progress for these vocabulary items
      for (const vocab of courseVocabForUnit) {
        const vocabProgress = await ctx.db
          .query("vocabularyProgress")
          .withIndex("by_user_course_vocab", (q) => 
            q.eq("userId", user._id).eq("courseVocabularyId", vocab._id)
          )
          .first();
        
        if (vocabProgress) {
          return { hasActivity: true };
        }
      }
    }

    // 4. Also check legacy vocabulary table (for backward compatibility)
    const legacyVocab = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_unit", (q) => 
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();
    
    if (legacyVocab) {
      return { hasActivity: true };
    }

    return { hasActivity: false };
  },
});
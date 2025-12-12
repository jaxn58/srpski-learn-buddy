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

// Helper to check unit access
async function checkUnitAccess(ctx: QueryCtx | MutationCtx, unitNumber: number): Promise<boolean> {
  const user = await getCurrentUser(ctx);
  if (!user) return false;

  // Admins have full access
  if (user.role === "admin" || user.role === "superadmin") {
    return true;
  }

  // Check for active subscription
  const subscription = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (subscription?.maxAccessibleUnits && unitNumber <= subscription.maxAccessibleUnits) {
    return true;
  }

  // Paid subscriptions get full access
  if (subscription && subscription.planType !== "beta" && unitNumber <= 27) {
    return true;
  }

  // Fallback: Beta Tester Flag
  if (user.isBetaTester && unitNumber <= 6) {
    return true;
  }

  return false;
}

// Get exercise results for current user
export const getResults = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("exerciseResults")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Add exercise result
export const addResult = mutation({
  args: {
    unitNumber: v.number(),
    exerciseType: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    correctAnswers: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check unit access
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      throw new Error("UNIT_LOCKED");
    }

    return await ctx.db.insert("exerciseResults", {
      userId: user._id,
      ...args,
    });
  },
});

// Get exercise completions (gamification)
export const getCompletions = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Submit exercise result and award XP (called by Exercise components)
export const submitResult = mutation({
  args: {
    unitNumber: v.number(),
    exerciseType: v.string(),
    exerciseId: v.string(),
    totalQuestions: v.number(),
    correctAnswers: v.number(),
  },
  handler: async (ctx, args) => {
    console.log('[Convex] submitResult called:', {
      unitNumber: args.unitNumber,
      exerciseType: args.exerciseType,
      exerciseId: args.exerciseId,
      totalQuestions: args.totalQuestions,
      correctAnswers: args.correctAnswers,
    });

    const user = await getCurrentUser(ctx);
    if (!user) {
      console.error('[Convex] submitResult: User not authenticated');
      throw new Error("Not authenticated");
    }

    console.log('[Convex] submitResult: User found:', {
      userId: user._id,
      currentXP: user.totalXP,
      currentLevel: user.level,
    });

    // Check unit access
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      console.error('[Convex] submitResult: Unit access denied:', args.unitNumber);
      throw new Error("UNIT_LOCKED");
    }

    const perfectScore = args.correctAnswers === args.totalQuestions;
    console.log('[Convex] submitResult: Perfect score?', perfectScore);
    
    // Calculate XP (16 XP per exercise if perfect, 0 otherwise)
    const xpPerExercise = Math.floor(50 / 3); // 16 XP
    
    // Check if already completed using optimized index
    const existing = await ctx.db
      .query("exerciseCompletions")
      .withIndex("by_user_exercise", (q) =>
        q.eq("userId", user._id)
         .eq("exerciseId", args.exerciseId)
         .eq("unitNumber", args.unitNumber)
      )
      .first();
    
    console.log('[Convex] submitResult: Existing completion?', existing ? 'Yes' : 'No');
    
    let xpEarned = 0;
    let xpAvailable = 0;
    
    if (perfectScore) {
      if (existing) {
        // Already completed - no new XP, but show what was earned before
        xpAvailable = existing.xpEarned || xpPerExercise;
        console.log('[Convex] submitResult: Already completed, xpAvailable:', xpAvailable);
      } else {
        // First time completion with perfect score - award XP
        xpEarned = xpPerExercise;
        xpAvailable = xpPerExercise;
        
        console.log('[Convex] submitResult: Awarding XP:', {
          xpEarned,
          oldTotalXP: user.totalXP,
          newTotalXP: user.totalXP + xpEarned,
        });
        
        // Add completion record
        await ctx.db.insert("exerciseCompletions", {
          userId: user._id,
          unitNumber: args.unitNumber,
          exerciseId: args.exerciseId,
          score: args.correctAnswers,
          totalQuestions: args.totalQuestions,
          xpEarned,
        });
        
        // Update user XP in Convex
        const newTotalXP = user.totalXP + xpEarned;
        // Level calculation: every 300 XP = 1 level (consistent with Drizzle)
        const newLevel = Math.floor(newTotalXP / 300) + 1;
        
        await ctx.db.patch(user._id, {
          totalXP: newTotalXP,
          level: newLevel,
          lastActiveDate: Date.now(),
        });
        
        console.log('[Convex] submitResult: Successfully updated user XP:', {
          xpEarned,
          newTotalXP,
          newLevel,
        });
      }
    } else {
      console.log('[Convex] submitResult: Not perfect score, no XP awarded');
    }
    
    const result = {
      success: true,
      xpEarned,
      xpAvailable,
      perfectScore,
      score: Math.round((args.correctAnswers / args.totalQuestions) * 100),
    };
    
    console.log('[Convex] submitResult: Returning result:', result);
    return result;
  },
});

// Add exercise completion with XP (legacy - kept for compatibility)
export const addCompletion = mutation({
  args: {
    unitNumber: v.number(),
    exerciseId: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    xpEarned: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check unit access
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      throw new Error("UNIT_LOCKED");
    }

    // Add completion record
    await ctx.db.insert("exerciseCompletions", {
      userId: user._id,
      ...args,
    });

    // Update user XP
    const newTotalXP = user.totalXP + args.xpEarned;
    // Level calculation: every 300 XP = 1 level (consistent with Drizzle)
    const newLevel = Math.floor(newTotalXP / 300) + 1;

    await ctx.db.patch(user._id, {
      totalXP: newTotalXP,
      level: newLevel,
      lastActiveDate: Date.now(),
    });

    return { totalXP: newTotalXP, level: newLevel, xpEarned: args.xpEarned };
  },
});

// ============= QUIZ PROGRESS =============

// Get quiz progress for a unit
export const getQuizProgress = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();
  },
});

// Get all quiz progress for current user (for auto-selecting next unit)
export const getAllQuizProgress = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const allProgress = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) => q.eq("userId", user._id))
      .collect();

    return allProgress;
  },
});

// Update quiz progress
export const updateQuizProgress = mutation({
  args: {
    unitNumber: v.number(),
    currentIndex: v.number(),
    lastScore: v.optional(v.number()),
    incorrectWordIds: v.optional(v.array(v.string())),
    incrementAttempts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();

    if (existing) {
      const updates: Record<string, unknown> = {
        currentIndex: args.currentIndex,
        lastAttemptAt: Date.now(),
      };

      if (args.lastScore !== undefined) updates.lastScore = args.lastScore;
      if (args.incorrectWordIds !== undefined) updates.incorrectWordIds = args.incorrectWordIds;
      if (args.incrementAttempts) updates.totalAttempts = existing.totalAttempts + 1;

      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("quizProgress", {
        userId: user._id,
        unitNumber: args.unitNumber,
        currentIndex: args.currentIndex,
        totalAttempts: args.incrementAttempts ? 1 : 0,
        lastScore: args.lastScore ?? 0,
        incorrectWordIds: args.incorrectWordIds ?? [],
        lastAttemptAt: Date.now(),
      });
    }
  },
});

// Reset quiz progress
export const resetQuizProgress = mutation({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Get incorrect words for a unit (for targeted practice)
export const getIncorrectWords = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const progress = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();

    return progress?.incorrectWordIds ?? [];
  },
});

// Clear incorrect words after successful practice
export const clearIncorrectWords = mutation({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", user._id).eq("unitNumber", args.unitNumber)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        incorrectWordIds: [],
      });
    }
  },
});

// ============= EXERCISE QUESTION PROGRESS =============

// Record exercise question answer (similar to recordVocabularyAnswer)
export const recordExerciseQuestionAnswer = mutation({
  args: {
    exerciseId: v.string(),
    questionId: v.string(),
    unitNumber: v.number(),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Update last activity timestamp on progress (for admin Student Progress view)
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (progress) {
      const ts = Date.now();
      await ctx.db.patch(progress._id, { lastActivityAt: ts });
    }

    // Find existing question progress entry
    const existing = await ctx.db
      .query("exerciseQuestionProgress")
      .withIndex("by_user_question", (q) =>
        q.eq("userId", user._id)
         .eq("exerciseId", args.exerciseId)
         .eq("questionId", args.questionId)
      )
      .first();

    // Progressive XP System: Award XP based on repetition level
    let earnedXP = 0;
    const currentCorrectCount = existing?.correctAnswerCount || 0;
    
    if (args.isCorrect) {
      // XP based on Spaced Repetition level
      if (currentCorrectCount === 0) {
        earnedXP = 10; // 1st time correct
      } else if (currentCorrectCount === 1) {
        earnedXP = 5; // 2nd time correct
      } else if (currentCorrectCount === 2) {
        earnedXP = 3; // 3rd time correct (Mastered!)
      }
      // After mastery (3+ correct): NO MORE XP
      
      console.log('[Convex] Progressive XP awarded:', {
        questionId: args.questionId,
        currentCorrectCount,
        earnedXP,
      });
    }

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

      // Award XP to user if earned
      if (earnedXP > 0) {
        const newTotalXP = user.totalXP + earnedXP;
        const newLevel = Math.floor(newTotalXP / 300) + 1;
        
        await ctx.db.patch(user._id, {
          totalXP: newTotalXP,
          level: newLevel,
          lastActiveDate: Date.now(),
        });
        
        console.log('[Convex] Progressive XP granted:', {
          earnedXP,
          oldTotalXP: user.totalXP,
          newTotalXP,
          newLevel,
        });
      }

      return { _id: existing._id, earnedXP: earnedXP || 0 };
    } else {
      // Create new entry
      const newCorrectCount = args.isCorrect ? 1 : 0;
      const newIncorrectCount = args.isCorrect ? 0 : 1;
      const isMastered = newCorrectCount >= 3;

      const insertedId = await ctx.db.insert("exerciseQuestionProgress", {
        userId: user._id,
        exerciseId: args.exerciseId,
        questionId: args.questionId,
        unitNumber: args.unitNumber,
        correctAnswerCount: newCorrectCount,
        incorrectAnswerCount: newIncorrectCount,
        mastered: isMastered,
        lastAnsweredAt: Date.now(),
        lastReviewedAt: Date.now(),
      });
      
      // Award XP to user if earned
      if (earnedXP > 0) {
        const newTotalXP = user.totalXP + earnedXP;
        const newLevel = Math.floor(newTotalXP / 300) + 1;
        
        await ctx.db.patch(user._id, {
          totalXP: newTotalXP,
          level: newLevel,
          lastActiveDate: Date.now(),
        });
        
        console.log('[Convex] Progressive XP granted (new question):', {
          earnedXP,
          oldTotalXP: user.totalXP,
          newTotalXP,
          newLevel,
        });
      }
      
      return { _id: insertedId, earnedXP: earnedXP || 0 };
    }
  },
});

// Get exercise question progress for an exercise
export const getExerciseQuestionProgress = query({
  args: {
    exerciseId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("exerciseQuestionProgress")
      .withIndex("by_user_exercise", (q) =>
        q.eq("userId", user._id).eq("exerciseId", args.exerciseId)
      )
      .collect();
  },
});


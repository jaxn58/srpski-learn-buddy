/**
 * Progress & Gamification Tables
 *
 * Exercise progress, question mastery, badges, daily activity,
 * and exercise completions.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const progressTables = {
  // ============= EXERCISE QUESTION PROGRESS =============
  exerciseQuestionProgress: defineTable({
    userId: v.id("users"),
    exerciseId: v.string(), // z.B. "unit1-biti-conjugation"
    questionId: v.string(), // z.B. "unit1-biti-conjugation-q1"
    unitNumber: v.number(),
    correctAnswerCount: v.number(),
    incorrectAnswerCount: v.number(),
    mastered: v.boolean(),
    lastAnsweredAt: v.optional(v.number()),
    lastReviewedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_exercise", ["userId", "exerciseId"])
    .index("by_user_question", ["userId", "exerciseId", "questionId"]),

  // ============= INTERACTIVE TEST QUESTION PROGRESS (Mastery per Question) =============
  questionProgress: defineTable({
    userId: v.id("users"),
    unitNumber: v.number(),
    questionId: v.string(), // Stable question ID (e.g., "u1_trans_q1")
    correctAttempts: v.number(), // Only correct answers count
    incorrectAttempts: v.optional(v.number()), // Track incorrect attempts (optional for backward compatibility)
    isMastered: v.boolean(), // true after 3 correct attempts
    totalXPEarned: v.number(), // Total XP earned from this question
    lastAttemptAt: v.number(), // Timestamp of last attempt
  })
    .index("by_user", ["userId"])
    .index("by_user_unit", ["userId", "unitNumber"])
    .index("by_user_question", ["userId", "questionId"]),

  // ============= EXERCISE RESULTS =============
  exerciseResults: defineTable({
    userId: v.id("users"),
    unitNumber: v.number(),
    exerciseType: v.string(),
    score: v.number(), // Percentage score
    totalQuestions: v.number(),
    correctAnswers: v.number(),
  }).index("by_user", ["userId"]),

  // ============= GAMIFICATION: EXERCISE COMPLETIONS =============
  exerciseCompletions: defineTable({
    userId: v.id("users"),
    unitNumber: v.number(),
    exerciseId: v.string(), // e.g., "unit1_biti_conjugation"
    score: v.number(), // Number of correct answers
    totalQuestions: v.number(),
    xpEarned: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_exercise", ["userId", "exerciseId", "unitNumber"]),

  // ============= GAMIFICATION: USER BADGES =============
  userBadges: defineTable({
    userId: v.id("users"),
    badgeId: v.string(), // e.g., "first_steps", "cafe_regular"
  }).index("by_user", ["userId"]),

  // ============= GAMIFICATION: DAILY ACTIVITY =============
  dailyActivity: defineTable({
    userId: v.id("users"),
    activityDate: v.number(), // timestamp at midnight
    unitsCompleted: v.number(),
    exercisesCompleted: v.number(),
    xpEarned: v.number(),
  })
    .index("by_user_date", ["userId", "activityDate"])
    .index("by_date", ["activityDate"]),
};

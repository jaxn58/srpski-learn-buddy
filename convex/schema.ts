import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============= CORE USER TABLE =============
  users: defineTable({
    clerkId: v.string(), // Clerk user ID (primary identifier)
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    loginMethod: v.optional(v.string()),
    role: v.union(v.literal("superadmin"), v.literal("admin"), v.literal("student")),
    isActive: v.boolean(),
    isBetaTester: v.boolean(),
    // Gamification fields
    totalXP: v.number(),
    level: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDate: v.optional(v.number()), // timestamp
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // ============= USER PROGRESS =============
  userProgress: defineTable({
    userId: v.id("users"),
    currentWeek: v.number(),
    currentUnit: v.number(),
    completedUnits: v.array(v.number()), // Array of completed unit numbers
    learningDuration: v.number(), // Duration in weeks: 12, 24, 36, 48
    uiLanguage: v.string(), // always "en"
  }).index("by_user", ["userId"]),

  // ============= VOCABULARY =============
  vocabulary: defineTable({
    userId: v.id("users"),
    serbianWord: v.string(),
    englishTranslation: v.string(),
    unitNumber: v.number(),
    mastered: v.boolean(),
    reviewCount: v.number(),
    lastReviewedAt: v.optional(v.number()), // timestamp
  })
    .index("by_user", ["userId"])
    .index("by_user_unit", ["userId", "unitNumber"]),

  // ============= CHAT SESSIONS =============
  chatSessions: defineTable({
    userId: v.id("users"),
    title: v.string(),
  }).index("by_user", ["userId"]),

  // ============= CHAT MESSAGES =============
  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    unitContext: v.optional(v.number()), // Optional: which unit was being studied
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  // ============= EXERCISE RESULTS =============
  exerciseResults: defineTable({
    userId: v.id("users"),
    unitNumber: v.number(),
    exerciseType: v.string(),
    score: v.number(), // Percentage score
    totalQuestions: v.number(),
    correctAnswers: v.number(),
  }).index("by_user", ["userId"]),

  // ============= UNIT EXPLANATIONS (AI-generated content) =============
  unitExplanations: defineTable({
    unitNumber: v.number(),
    overview: v.string(),
    grammarExplained: v.string(),
    practiceExamples: v.string(),
    bookReference: v.optional(v.string()),
  }).index("by_unit", ["unitNumber"]),

  // ============= GAMIFICATION: EXERCISE COMPLETIONS =============
  exerciseCompletions: defineTable({
    userId: v.id("users"),
    unitNumber: v.number(),
    exerciseId: v.string(), // e.g., "unit1_biti_conjugation"
    score: v.number(), // Number of correct answers
    totalQuestions: v.number(),
    xpEarned: v.number(),
  }).index("by_user", ["userId"]),

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
  }).index("by_user_date", ["userId", "activityDate"]),

  // ============= FEEDBACK SUBMISSIONS =============
  feedbackSubmissions: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("bug"),
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("other")
    ),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("new"),
      v.literal("reviewed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("rejected")
    ),
    adminNotes: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ============= BETA REGISTRATIONS =============
  betaRegistrations: defineTable({
    name: v.string(),
    email: v.string(),
    motivation: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  // ============= FEEDBACK COMMENTS =============
  feedbackComments: defineTable({
    feedbackId: v.id("feedbackSubmissions"),
    userId: v.id("users"),
    content: v.string(),
    isAdminNote: v.boolean(),
  }).index("by_feedback", ["feedbackId"]),

  // ============= FEEDBACK STATUS HISTORY =============
  feedbackStatusHistory: defineTable({
    feedbackId: v.id("feedbackSubmissions"),
    previousStatus: v.string(),
    newStatus: v.string(),
    changedBy: v.id("users"),
  }).index("by_feedback", ["feedbackId"]),

  // ============= USER SUBSCRIPTIONS =============
  userSubscriptions: defineTable({
    userId: v.id("users"),
    planType: v.union(
      v.literal("intensive"),
      v.literal("balanced"),
      v.literal("standard"),
      v.literal("relaxed")
    ),
    planDurationMonths: v.number(), // 3, 6, 9, or 12
    planPrice: v.number(), // in cents (e.g., 6900 = €69.00)
    expiresAt: v.number(), // timestamp
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    autoRenew: v.boolean(),
    cancelledAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // ============= SUBSCRIPTION HISTORY =============
  subscriptionHistory: defineTable({
    userId: v.id("users"),
    action: v.union(
      v.literal("purchased"),
      v.literal("upgraded"),
      v.literal("downgraded"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("renewed")
    ),
    previousPlanType: v.optional(v.string()),
    newPlanType: v.optional(v.string()),
    previousExpiresAt: v.optional(v.number()),
    newExpiresAt: v.optional(v.number()),
    cost: v.optional(v.number()), // in cents
    notes: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // ============= QUIZ PROGRESS =============
  quizProgress: defineTable({
    userId: v.id("users"),
    unitNumber: v.number(),
    currentIndex: v.number(), // Current position in quiz
    totalAttempts: v.number(), // How many times user took this quiz
    lastScore: v.number(), // Percentage from last attempt
    incorrectWordIds: v.array(v.string()), // Array of word IDs answered incorrectly
    lastAttemptAt: v.optional(v.number()), // timestamp
  }).index("by_user_unit", ["userId", "unitNumber"]),

  // ============= EMAIL TEMPLATES =============
  emailTemplates: defineTable({
    name: v.string(), // e.g., "beta-registration", "user-activation", "feedback-confirmation"
    subject: v.string(), // Email subject line (can contain {{VARIABLES}})
    htmlContent: v.string(), // Full HTML template with {{VARIABLES}}
    description: v.optional(v.string()), // What this template is for
    variables: v.array(v.string()), // Available variables like ["USER_NAME", "PLAN_NAME"]
    isActive: v.boolean(), // Enable/disable template
    category: v.union(
      v.literal("transactional"), // Beta, feedback, activation
      v.literal("subscription"), // Welcome, expiration, upgrade
      v.literal("marketing") // Promotional emails
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),
});


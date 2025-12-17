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
    // Multi-language support: User's chosen learning language (optional for backward compatibility)
    learningLanguage: v.optional(v.union(
      v.literal("en"), // English → Serbian
      v.literal("de"), // Deutsch → Serbisch
      v.literal("es"), // Español → Serbio (future)
      v.literal("fr")  // Français → Serbe (future)
    )),
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
    .index("by_email", ["email"])
    .index("by_language", ["learningLanguage"]), // NEW: Query users by language

  // ============= USER PROGRESS =============
  userProgress: defineTable({
    userId: v.id("users"),
    currentWeek: v.number(),
    currentUnit: v.number(),
    completedUnits: v.array(v.number()), // Array of completed unit numbers
    learningDuration: v.number(), // Duration in weeks: 12, 24, 36, 48
    uiLanguage: v.string(), // always "en"
    lastActivityAt: v.optional(v.number()), // last activity timestamp
  }).index("by_user", ["userId"]),

  // ============= VOCABULARY (DEPRECATED - Legacy User Progress) =============
  // @deprecated This table is deprecated. Use vocabularyProgress instead.
  // Migration: vocabulary → vocabularyProgress
  // This table will be removed after migration is complete.
  vocabulary: defineTable({
    userId: v.id("users"),
    serbianWord: v.string(),
    englishTranslation: v.string(),
    unitNumber: v.number(),
    mastered: v.boolean(),
    reviewCount: v.number(),
    lastReviewedAt: v.optional(v.number()), // timestamp
    correctAnswerCount: v.number(), // Wie oft richtig beantwortet
    incorrectAnswerCount: v.number(), // Wie oft falsch beantwortet
    lastAnsweredAt: v.optional(v.number()), // Letzter Versuch (timestamp)
  })
    .index("by_user", ["userId"])
    .index("by_user_unit", ["userId", "unitNumber"]),

  // ============= VOCABULARY PROGRESS (NEW - User Progress with Foreign Key) =============
  // Normalized user progress linked to courseVocabulary via Foreign Key
  vocabularyProgress: defineTable({
    userId: v.id("users"),
    courseVocabularyId: v.id("courseVocabulary"), // Foreign Key zu eindeutiger Vokabel-ID
    
    // Nur Fortschritts-Daten (keine Redundanz!)
    mastered: v.boolean(),
    reviewCount: v.number(),
    lastReviewedAt: v.optional(v.number()),
    correctAnswerCount: v.number(),
    incorrectAnswerCount: v.number(),
    lastAnsweredAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_course_vocab", ["courseVocabularyId"])
    .index("by_user_course_vocab", ["userId", "courseVocabularyId"]), // Unique constraint

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
    isMastered: v.boolean(), // true after 3 correct attempts
    totalXPEarned: v.number(), // Total XP earned from this question
    lastAttemptAt: v.number(), // Timestamp of last attempt
  })
    .index("by_user", ["userId"])
    .index("by_user_unit", ["userId", "unitNumber"])
    .index("by_user_question", ["userId", "questionId"]),

  // ============= CHAT SESSIONS =============
  chatSessions: defineTable({
    userId: v.id("users"),
    title: v.string(),
    archived: v.optional(v.boolean()), // optional for backward compatibility
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "archived"]),

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

  // ============= UNIT EXPLANATIONS (DEPRECATED - Legacy table) =============
  // @deprecated This table is deprecated. Use unitContent instead.
  // Migration: unitExplanations → unitContent
  // This table will be removed after migration is complete.
  unitExplanations: defineTable({
    unitNumber: v.number(),
    overview: v.string(),
    grammarExplained: v.string(),
    practiceExamples: v.string(),
    // German translations (optional for backward compatibility)
    overviewGerman: v.optional(v.string()),
    grammarExplainedGerman: v.optional(v.string()),
    practiceExamplesGerman: v.optional(v.string()),
  }).index("by_unit", ["unitNumber"]),

  // ============= NEW CONTENT STRUCTURE METADATA =============
  
  // 1. Unit Metadata (Master-Table for Units, Multi-language)
  // Primary Key: (unitNumber, language) - Composite Primary Key
  // Foreign Key: moduleMetadataId → moduleMetadata._id (NEW: Real Foreign Key)
  unitMetadata: defineTable({
    unitNumber: v.number(), // Primary Key (composite with language)
    language: v.string(), // "en", "de", "es", "fr" - Primary Key (composite with unitNumber)
    title: v.string(), // Translated Title
    topics: v.array(v.string()), // Array of Topics
    grammarFocus: v.array(v.string()), // Array of Grammar Focus points
    vocabularyThemes: v.array(v.string()), // Array of Vocabulary Themes
    
    // NEW: Real Foreign Key to moduleMetadata._id
    moduleMetadataId: v.optional(v.id("moduleMetadata")), // Foreign Key to moduleMetadata._id
    
    // OLD: Deprecated - kept for backward compatibility during migration
    moduleId: v.optional(v.string()), // Foreign Key to moduleMetadata.moduleId - DEPRECATED
  })
    .index("by_unit_lang", ["unitNumber", "language"]) // Composite Primary Key
    .index("by_module", ["moduleId"]) // Old Foreign Key Index (deprecated)
    .index("by_module_metadata", ["moduleMetadataId"]), // New Foreign Key Index

  // 2. Module Metadata (Multi-language)
  // NEW STRUCTURE: One row per module with multilingual columns
  // OLD STRUCTURE: Multiple rows per module (one per language) - deprecated but kept for backward compatibility
  moduleMetadata: defineTable({
    // New multilingual structure (preferred)
    titleDe: v.optional(v.string()),
    titleEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    slug: v.optional(v.string()), // URL-friendly identifier (e.g., "foundation", "daily-life")
    moduleNumber: v.optional(v.number()), // For sorting (1, 2, 3, etc.)
    
    // Old structure (deprecated - kept for backward compatibility during migration)
    moduleId: v.optional(v.string()), // "foundation", "daily-life", etc. - DEPRECATED
    language: v.optional(v.string()), // DEPRECATED
    title: v.optional(v.string()), // DEPRECATED
    description: v.optional(v.string()), // DEPRECATED
  })
    .index("by_module_lang", ["moduleId", "language"]) // Old index (deprecated)
    .index("by_slug", ["slug"]), // New index for URL lookup

  // 3. Week Metadata (Multi-language)
  weekMetadata: defineTable({
    weekNumber: v.number(),
    language: v.string(),
    title: v.string(),
    goals: v.array(v.string()),
    practiceActivities: v.array(v.string()),
  }).index("by_week_lang", ["weekNumber", "language"]),

  // 4. Vocabulary Translations (Multi-language)
  vocabularyTranslations: defineTable({
    vocabularyId: v.id("vocabulary"),
    language: v.string(), // "en", "de", "es", "fr"
    translation: v.string(),
    alternatives: v.optional(v.array(v.string())),
  }).index("by_vocab_lang", ["vocabularyId", "language"]),

  // 5. Interactive Tests (Central Question DB for Gamification)
  // Relational: Foreign Key to unitMetadata (unitNumber, language)
  // Normalized: One row per question
  unitInteractiveTests: defineTable({
    unitNumber: v.number(), // Foreign Key to unitMetadata (composite with language)
    language: v.string(), // Foreign Key to unitMetadata (composite with unitNumber)
    category: v.string(), // "translation", "fillInBlank", "multipleChoice", "vocabularyMatching", "dialogueCompletion"
    categoryInstructions: v.optional(v.string()), // Instructions for this category (e.g. "Translate the following sentences...")

    // Gamification-IDs
    questionId: v.string(), // Stable ID (e.g. "u1_trans_q1") for exerciseQuestionProgress - Unique identifier

    questionType: v.string(), // "translation", "fillInBlank", "multipleChoice", "matching", "dialogue"
    question: v.string(), // The Question/Task
    correctAnswer: v.string(), // Correct Answer
    acceptableAlternatives: v.optional(v.array(v.string())), // Alternative correct answers
    options: v.optional(v.array(v.string())), // For Multiple Choice
    hint: v.optional(v.string()), // Optional Hint
    order: v.number(), // Order within category
  })
    .index("by_unit_lang_category", ["unitNumber", "language", "category"]) // Composite FK + category
    .index("by_unit_lang", ["unitNumber", "language"]) // Foreign Key to unitMetadata
    .index("by_question_id", ["questionId"]), // Unique for Gamification

  // ============= UNIT CONTENT (Modern multi-language support) =============
  // Relational: Foreign Key to unitMetadata (unitNumber, language)
  // Normalized: One row per unit+language+contentType
  // Supports: overview, grammar, phrases, dialogues, testIntroduction
  unitContent: defineTable({
    unitNumber: v.number(), // Foreign Key to unitMetadata (composite with language)
    language: v.string(), // "en", "de", "es", "fr" - Foreign Key to unitMetadata (composite with unitNumber)
    contentType: v.union(
      v.literal("overview"),
      v.literal("grammar"),
      v.literal("phrases"),
      v.literal("dialogues"),
      v.literal("vocabulary"),
      v.literal("testIntroduction"),
      v.literal("practice") // TEMPORARY: For cleanup of legacy data in units 7-27. Remove after cleanup.
    ), // Type-safe content type
    content: v.string(), // The actual markdown content
    version: v.optional(v.number()), // For content versioning
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_unit_lang_type", ["unitNumber", "language", "contentType"]) // Composite FK + contentType
    .index("by_unit_lang", ["unitNumber", "language"]), // Foreign Key to unitMetadata

  // ============= CENTRAL COURSE VOCABULARY (Master Data) =============
  // Stores vocabulary definitions from Units (Markdown)
  // Multi-language ready via column-based translations (preferred) or translations array (deprecated)
  courseVocabulary: defineTable({
    unitNumber: v.number(),
    serbian: v.string(),
    
    // NEW: Column-based translations (preferred)
    // Direct access: word.en, word.de, word.sr, etc.
    en: v.optional(v.string()), // English translation
    de: v.optional(v.string()), // German translation
    sr: v.optional(v.string()), // Serbian (if different from serbian field)
    es: v.optional(v.string()), // Spanish translation (future)
    fr: v.optional(v.string()), // French translation (future)
    enAlt: v.optional(v.string()), // Alternative English translation
    deAlt: v.optional(v.string()), // Alternative German translation
    
    // OLD: Array-based translations (DEPRECATED - kept for backward compatibility during migration)
    // @deprecated Use column-based translations (en, de, etc.) instead
    translations: v.optional(v.array(v.object({
      language: v.string(), // "en", "de", "es", "fr", etc.
      translation: v.string(),
      alt: v.optional(v.string()) // Optional Montenegrin variant or alternatives
    }))),
    
    gender: v.optional(v.string()), // m, f, n
    pronunciation: v.optional(v.string()),
    audioUrl: v.optional(v.string()), // S3 URL für generiertes Audio (Google TTS)
    
    // Multi-language notes (e.g., "informal", "wird verwendet mit...")
    noteEn: v.optional(v.string()), // English note
    noteDe: v.optional(v.string()), // German note
    noteSr: v.optional(v.string()), // Serbian note
    noteEs: v.optional(v.string()), // Spanish note (future)
    noteFr: v.optional(v.string()), // French note (future)
  })
  .index("by_unit", ["unitNumber"])
  .index("by_serbian", ["serbian"])
  .index("by_unit_serbian", ["unitNumber", "serbian"]), // NEW: For finding by unit + serbian

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
    submittedAt: v.optional(v.number()),
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
      v.literal("beta"),
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
    maxAccessibleUnits: v.optional(v.number()), // Max units accessible (e.g., 5 for beta, 27 for full)
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
    
    // OLD: Array of serbianWord strings (DEPRECATED - kept for backward compatibility)
    incorrectWordIds: v.optional(v.array(v.string())), // serbianWord[] - DEPRECATED
    
    // NEW: Array of courseVocabulary IDs (preferred)
    incorrectVocabularyIds: v.optional(v.array(v.id("courseVocabulary"))), // courseVocabularyId[]
    
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

  // ============= CHAT PROMPTS (admin-managed) =============
  chatPrompts: defineTable({
    name: v.string(), // e.g., "default"
    content: v.string(), // system prompt text
    description: v.optional(v.string()), // optional description of changes
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"]),

  // ============= CHAT PROMPT HISTORY =============
  chatPromptHistory: defineTable({
    name: v.string(), // e.g., "default"
    content: v.string(), // system prompt text
    description: v.optional(v.string()), // optional description of changes
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_name_updatedAt", ["name", "updatedAt"]),
});


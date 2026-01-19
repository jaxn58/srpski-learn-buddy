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

    // Public profile (for Leaderboard)
    publicNickname: v.optional(v.string()),
    publicAvatarUrl: v.optional(v.string()),
    // Convex Storage ID (preferred for uploads; URLs expire)
    publicAvatarStorageId: v.optional(v.string()),
    // Privacy guardrail: default OFF (treat undefined as false)
    leaderboardPublicEnabled: v.optional(v.boolean()),

    // ===== Paddle / Billing =====
    // Tracks one-time 50% beta discount usage after beta ends.
    // If set, the user already consumed the beta discount.
    betaDiscountUsedAt: v.optional(v.number()), // timestamp
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_language", ["learningLanguage"]), // NEW: Query users by language

  // ============= USER PROGRESS =============
  userProgress: defineTable({
    userId: v.id("users"),
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
    incorrectAttempts: v.optional(v.number()), // Track incorrect attempts (optional for backward compatibility)
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

  // 3. Vocabulary Translations (Multi-language)
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

    // ===== Versioning / Soft-archive for Replace mode (backward compatible) =====
    // Undefined is treated as active + version 1 in queries.
    isActive: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    unitVersion: v.optional(v.number()),
  })
    .index("by_unit_lang_category", ["unitNumber", "language", "category"]) // Composite FK + category
    .index("by_unit_lang", ["unitNumber", "language"]) // Foreign Key to unitMetadata
    .index("by_question_id", ["questionId"]) // Unique for Gamification
    .index("by_unit_lang_active", ["unitNumber", "language", "isActive"])
    .index("by_unit_lang_active_version", ["unitNumber", "language", "isActive", "unitVersion"]),

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

    // ===== Versioning / Soft-archive for Replace mode (backward compatible) =====
    // Undefined is treated as active + version 1 in queries.
    isActive: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    unitVersion: v.optional(v.number()),
  })
    .index("by_unit_lang_type", ["unitNumber", "language", "contentType"]) // Composite FK + contentType
    .index("by_unit_lang", ["unitNumber", "language"]) // Foreign Key to unitMetadata
    .index("by_unit_lang_type_active", ["unitNumber", "language", "contentType", "isActive"])
    .index("by_unit_lang_type_active_version", ["unitNumber", "language", "contentType", "isActive", "unitVersion"]),

  // ============= UNIT CONTENT AUDIO (Phrases/Dialogues TTS cache) =============
  // Stores generated TTS audio for unit content lines (e.g. a phrase row or a dialogue line).
  // Multi-language ready (row-based, like unitContent). For now we use English units only, but keep language.
  unitContentAudio: defineTable({
    unitNumber: v.number(),
    language: v.string(), // "en" for now
    contentType: v.union(v.literal("phrases"), v.literal("dialogues")),

    // The spoken Serbian text. (We store it for debugging/admin and future migrations.)
    textSr: v.string(),

    // Voice/config variant identifier selected in the UI (e.g. "voice1", "voice2").
    voiceKey: v.string(),

    // Stable cache key derived from (textSr + voiceKey + AUDIO_VERSION_TAG)
    textHash: v.string(),

    // Convex Storage ID for permanent audio storage
    audioStorageId: v.string(),

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),

    // Optional versioning/soft-archive (keeps pattern consistent with unitContent)
    isActive: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    unitVersion: v.optional(v.number()),
  })
    .index("by_text_hash", ["textHash"])
    .index("by_unit_lang_type", ["unitNumber", "language", "contentType"])
    .index("by_unit_lang_type_voice", ["unitNumber", "language", "contentType", "voiceKey"])
    .index("by_unit_lang_type_active", ["unitNumber", "language", "contentType", "isActive"])
    .index("by_unit_lang_type_active_version", ["unitNumber", "language", "contentType", "isActive", "unitVersion"]),

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
    audioUrl: v.optional(v.string()), // @deprecated Use audioStorageId instead (URLs expire after 1h)
    audioStorageId: v.optional(v.string()), // Convex Storage ID for permanent audio storage
    
    // Multi-language notes (e.g., "informal", "wird verwendet mit...")
    noteEn: v.optional(v.string()), // English note
    noteDe: v.optional(v.string()), // German note
    noteSr: v.optional(v.string()), // Serbian note
    noteEs: v.optional(v.string()), // Spanish note (future)
    noteFr: v.optional(v.string()), // French note (future)

    // ===== Versioning / Soft-archive for Replace mode (backward compatible) =====
    // Undefined is treated as active + version 1 in queries.
    isActive: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    unitVersion: v.optional(v.number()),
  })
  .index("by_unit", ["unitNumber"])
  .index("by_serbian", ["serbian"])
  .index("by_unit_serbian", ["unitNumber", "serbian"]) // NEW: For finding by unit + serbian
  .index("by_unit_active", ["unitNumber", "isActive"])
  .index("by_unit_serbian_active", ["unitNumber", "serbian", "isActive"])
  .index("by_unit_active_version", ["unitNumber", "isActive", "unitVersion"]),

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
      v.literal("answered"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("rejected")
    ),
    adminNotes: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),

    // ===== AI assistance (superadmin-only access via dedicated queries) =====
    aiStatus: v.optional(
      v.union(v.literal("pending"), v.literal("ready"), v.literal("error"))
    ),
    aiDraftReply: v.optional(v.string()),
    aiInternalNote: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    aiGeneratedAt: v.optional(v.number()),
    aiError: v.optional(v.string()),

    // Track what was actually sent to the user
    aiSentAt: v.optional(v.number()),
    aiSentBy: v.optional(v.id("users")),
    aiSentContent: v.optional(v.string()),
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
      v.literal("past_due"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    autoRenew: v.boolean(),
    cancelledAt: v.optional(v.number()),
    maxAccessibleUnits: v.optional(v.number()), // Max units accessible (e.g., 5 for beta, 27 for full)

    // Payment metadata (optional for backwards compatibility)
    paymentMode: v.optional(v.union(v.literal("prepaid"), v.literal("installments"))),
    // Paddle subscription id for recurring installment plans
    paddleSubscriptionId: v.optional(v.string()),
    // Installments tracking (only for paymentMode="installments")
    installmentsTotalMonths: v.optional(v.number()),
    installmentsPaidMonths: v.optional(v.number()),
    installmentMonthlyPrice: v.optional(v.number()), // in cents
    pausedAt: v.optional(v.number()),
    installmentsCompletedAt: v.optional(v.number()),
    paddleCancelRequestedAt: v.optional(v.number()),
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
      v.literal("renewed"),
      v.literal("payment_failed"),
      v.literal("payment_succeeded")
    ),
    previousPlanType: v.optional(v.string()),
    newPlanType: v.optional(v.string()),
    previousExpiresAt: v.optional(v.number()),
    newExpiresAt: v.optional(v.number()),
    cost: v.optional(v.number()), // in cents
    notes: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // ============= PADDLE WEBHOOK EVENTS (Idempotency / Audit) =============
  // Stores received webhook events so we can safely ignore duplicates and debug issues.
  paddleWebhookEvents: defineTable({
    eventId: v.string(), // unique id from Paddle (idempotency key)
    eventType: v.string(),
    receivedAt: v.number(), // timestamp when our endpoint received the event
    occurredAt: v.optional(v.number()), // timestamp when Paddle says it occurred (if provided)
    processedAt: v.optional(v.number()), // timestamp when we applied side effects

    // Raw JSON payload for debugging/audit (stringified to keep schema simple)
    rawPayload: v.string(),

    // Useful extracted fields (optional)
    clerkId: v.optional(v.string()),
    priceId: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
  })
    .index("by_event_id", ["eventId"])
    .index("by_type", ["eventType"]),

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

  // ============= EMAIL SIGNATURES =============
  // One signature per category, injected via {{EMAIL_SIGNATURE}} placeholder.
  emailSignatures: defineTable({
    category: v.union(
      v.literal("transactional"),
      v.literal("subscription"),
      v.literal("marketing")
    ),
    htmlContent: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
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

  // ============= APP VERSIONS =============
  appVersions: defineTable({
    version: v.string(), // Semantic Version (e.g., "1.0.0")
    major: v.number(),
    minor: v.number(),
    patch: v.number(),
    environment: v.union(
      v.literal("beta"),
      v.literal("production"),
      v.literal("staging")
    ),
    releaseDate: v.number(), // timestamp
    isCurrent: v.boolean(), // Only one version per environment can be current
    deploymentCommit: v.optional(v.string()), // Git commit hash
    deploymentBranch: v.optional(v.string()), // Git branch name
  })
    .index("by_environment", ["environment"])
    .index("by_version", ["version"])
    .index("by_current", ["environment", "isCurrent"]),

  // ============= CHANGELOG ENTRIES =============
  changelogEntries: defineTable({
    versionId: v.id("appVersions"), // Foreign Key to appVersions
    category: v.union(
      v.literal("added"),
      v.literal("changed"),
      v.literal("fixed"),
      v.literal("removed")
    ),
    title: v.string(), // Short description
    description: v.optional(v.string()), // Detailed description
    language: v.union(
      v.literal("en"),
      v.literal("de")
    ), // Multi-language support
    createdBy: v.id("users"), // Foreign Key to users
    createdAt: v.number(), // timestamp
    order: v.number(), // Sort order within version
  })
    .index("by_version", ["versionId"])
    .index("by_category", ["category"])
    .index("by_language", ["language"]),

  // ============= ONBOARDING STEPS =============
  // Admin-managed onboarding flow with multi-language support
  // NEW STRUCTURE: Column-based multilanguage (preferred)
  // OLD STRUCTURE: Row-based with language field (deprecated - for migration)
  onboardingSteps: defineTable({
    stepNumber: v.number(), // Order of the step (1, 2, 3, 4...)
    
    // NEW: Column-based multilanguage (preferred)
    titleEn: v.optional(v.string()),
    titleDe: v.optional(v.string()),
    titleEs: v.optional(v.string()),
    titleFr: v.optional(v.string()),
    
    descriptionEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    descriptionEs: v.optional(v.string()),
    descriptionFr: v.optional(v.string()),
    
    contentEn: v.optional(v.string()),
    contentDe: v.optional(v.string()),
    contentEs: v.optional(v.string()),
    contentFr: v.optional(v.string()),
    
    icon: v.string(), // Lucide icon name (e.g., "BookOpen", "Trophy", "Brain")
    isActive: v.boolean(), // Whether this step is currently active
    backgroundColor: v.optional(v.string()), // Optional custom background color
    
    // OLD: Row-based (DEPRECATED - kept for backward compatibility during migration)
    language: v.optional(v.string()), // "en", "de", "es", "fr" - DEPRECATED
    title: v.optional(v.string()), // DEPRECATED - use titleEn, titleDe, etc.
    description: v.optional(v.string()), // DEPRECATED - use descriptionEn, descriptionDe, etc.
    content: v.optional(v.string()), // DEPRECATED - use contentEn, contentDe, etc.
    
    createdAt: v.number(), // timestamp
    updatedAt: v.number(), // timestamp
    createdBy: v.optional(v.id("users")), // Admin who created this step
    updatedBy: v.optional(v.id("users")), // Admin who last updated this step
  })
    .index("by_language", ["language"]) // OLD: for migration compatibility
    .index("by_language_active", ["language", "isActive", "stepNumber"]) // OLD: for migration
    .index("by_step_number", ["stepNumber"]), // NEW: primary index

  // ============= BACKUP METADATA =============
  // Tracks automated database backups stored in Convex Storage
  backupMetadata: defineTable({
    storageId: v.string(), // Convex Storage ID
    timestamp: v.number(), // Backup creation timestamp
    environment: v.union(
      v.literal("production"),
      v.literal("development")
    ),
    tableCount: v.number(), // Number of tables backed up
    totalRecords: v.number(), // Total records in backup
    size: v.number(), // Backup size in bytes
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("in_progress")
    ),
    errorMessage: v.optional(v.string()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_environment", ["environment"])
    .index("by_status", ["status"]),

  // ============= CONTENT IMPORT RUNS (Admin Audit Log) =============
  // Stores validation/import runs from the admin content import tool.
  // Keep the report as a JSON string to stay forwards-compatible with report schema changes.
  contentImportRuns: defineTable({
    type: v.union(v.literal("validate"), v.literal("import")),
    status: v.union(v.literal("success"), v.literal("failed")),
    mode: v.optional(v.union(v.literal("update"), v.literal("replace"))),
    unitVersion: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    fileNames: v.array(v.string()),
    filesCount: v.number(),
    unitNumbers: v.array(v.number()),
    totalErrors: v.number(),
    totalWarnings: v.number(),
    reportJson: v.string(),
  })
    .index("by_started_at", ["startedAt"])
    .index("by_created_by", ["createdBy"])
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  // ============= WAITLIST =============
  waitlist: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    // Optional: user consent to receive interim waitlist stories/updates (double opt-in required)
    wantsWaitlistUpdates: v.optional(v.boolean()),
    status: v.union(
      v.literal("pending"),      // Email versendet, wartet auf Bestätigung
      v.literal("confirmed"),     // User hat Opt-In bestätigt
      v.literal("notified")       // User wurde über Beta-Launch benachrichtigt
    ),
    confirmationToken: v.string(), // UUID für Bestätigungslink
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
    notifiedAt: v.optional(v.number()),
    viewedByAdmin: v.optional(v.boolean()), // Tracking ob Admin die Einträge gesehen hat
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_token", ["confirmationToken"])
    .index("by_status_viewed", ["status", "viewedByAdmin"]),

  // ============= NEWSLETTER SYSTEM =============
  
  // Newsletter Contacts - Zentrale Kontaktverwaltung
  newsletterContacts: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    
    // Source tracking
    source: v.union(
      v.literal("waitlist"),      // Von Waitlist synchronisiert
      v.literal("user"),          // Von registrierten Usern
      v.literal("manual")         // Manuell hinzugefügt
    ),
    sourceId: v.optional(v.union(
      v.id("waitlist"),
      v.id("users")
    )), // Referenz zur Quelle (optional für manuelle Einträge)
    
    // Subscription status
    subscribed: v.boolean(), // true = subscribed (marketing), false = not subscribed
    subscribedAt: v.optional(v.number()), // Timestamp der Anmeldung (only if subscribed)
    unsubscribedAt: v.optional(v.number()), // Timestamp der Abmeldung
    unsubscribeToken: v.string(), // UUID für Unsubscribe-Links

    // Double Opt-In (pending/confirm)
    optInToken: v.optional(v.string()),
    optInPurpose: v.optional(v.union(
      v.literal("waitlist_updates"),
      v.literal("community_updates")
    )),
    optInRequestedAt: v.optional(v.number()),
    optInConfirmedAt: v.optional(v.number()),
    
    // Segmentation
    tags: v.array(v.string()), // z.B. ["beta-user", "premium", "german"]
    
    // Environment safety
    environment: v.optional(v.union(
      v.literal("dev"),
      v.literal("prod")
    )),
    
    // DSGVO Compliance
    gdprConsent: v.optional(v.object({
      marketing: v.boolean(),
      tracking: v.boolean(),
      consentedAt: v.number()
    })),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_subscribed", ["subscribed"])
    .index("by_source", ["source"])
    .index("by_unsubscribe_token", ["unsubscribeToken"])
    .index("by_optin_token", ["optInToken"])
    .index("by_tags", ["tags"])
    .index("by_environment", ["environment"]),

  // Newsletter Campaigns - Campaign-Management
  newsletterCampaigns: defineTable({
    name: v.string(), // Campaign name (e.g., "Beta Launch Announcement")
    subject: v.string(), // Email subject line
    templateName: v.string(), // Reference to emailTemplates.name
    description: v.optional(v.string()),
    
    // Targeting
    targetTags: v.array(v.string()), // Nur Kontakte mit diesen Tags
    targetSource: v.optional(v.union(
      v.literal("waitlist"),
      v.literal("user"),
      v.literal("all")
    )),
    
    // Status
    status: v.union(
      v.literal("draft"),      // Entwurf
      v.literal("scheduled"),  // Geplant
      v.literal("sending"),    // Wird versendet
      v.literal("sent"),       // Versendet
      v.literal("cancelled")   // Abgebrochen
    ),
    
    // Test mode for DevOps safety
    testMode: v.boolean(), // Sendet nur an Whitelist
    
    // Scheduling
    scheduledFor: v.optional(v.number()), // Timestamp für geplante Versendung
    
    // Statistics (denormalized for performance)
    totalRecipients: v.optional(v.number()),
    sentCount: v.optional(v.number()),
    deliveredCount: v.optional(v.number()),
    openedCount: v.optional(v.number()),
    clickedCount: v.optional(v.number()),
    bouncedCount: v.optional(v.number()),
    unsubscribedCount: v.optional(v.number()),
    
    // Metadata
    createdBy: v.id("users"), // Admin who created campaign
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"])
    .index("by_scheduled_for", ["scheduledFor"]),

  // Newsletter Email Logs - Detailliertes Email-Tracking
  newsletterEmailLogs: defineTable({
    campaignId: v.id("newsletterCampaigns"),
    contactId: v.id("newsletterContacts"),
    email: v.string(), // Denormalized for easier querying
    
    // Email status
    status: v.union(
      v.literal("pending"),    // In Queue
      v.literal("sent"),       // Versendet
      v.literal("delivered"),  // Zustellung bestätigt
      v.literal("opened"),     // Geöffnet
      v.literal("clicked"),    // Link geklickt
      v.literal("bounced"),    // Bounce
      v.literal("failed")      // Fehler
    ),
    
    // Resend API tracking
    resendMessageId: v.optional(v.string()), // Resend message ID für Webhooks
    
    // Retry tracking
    retryCount: v.optional(v.number()),
    lastError: v.optional(v.string()),
    
    // Engagement tracking
    openedAt: v.optional(v.number()), // Erste Öffnung
    openedCount: v.number(), // Anzahl Öffnungen
    clickedAt: v.optional(v.number()), // Erster Klick
    clickedCount: v.number(), // Anzahl Klicks
    clickedLinks: v.array(v.string()), // Array von geklickten URLs
    
    // Timestamps
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    lastOpenedAt: v.optional(v.number()),
    lastClickedAt: v.optional(v.number()),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_contact", ["contactId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_resend_message_id", ["resendMessageId"]),

  // Newsletter Link Clicks - Link-Click-Tracking
  newsletterLinkClicks: defineTable({
    campaignId: v.id("newsletterCampaigns"),
    contactId: v.id("newsletterContacts"),
    emailLogId: v.id("newsletterEmailLogs"),
    
    // Link information
    originalUrl: v.string(), // Original URL die geklickt wurde
    trackingToken: v.string(), // Unique token für diesen Link-Klick
    linkLabel: v.optional(v.string()), // Optional: Label für Analytics (z.B. "CTA Button")
    
    // Click data
    clickedAt: v.number(), // 0 = noch nicht geklickt
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()), // Nur mit DSGVO-Consent speichern
    referer: v.optional(v.string()),
    
    // Data retention
    dataRetentionDays: v.optional(v.number()), // Default: 90 Tage
  })
    .index("by_campaign", ["campaignId"])
    .index("by_contact", ["contactId"])
    .index("by_email_log", ["emailLogId"])
    .index("by_tracking_token", ["trackingToken"]),
});


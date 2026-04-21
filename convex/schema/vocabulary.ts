/**
 * Vocabulary Tables
 *
 * Course vocabulary master data, user vocabulary progress,
 * and quiz progress.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vocabularyTables = {
  // ============= VOCABULARY PROGRESS (User Progress with Foreign Key) =============
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

  // ============= CENTRAL COURSE VOCABULARY (Master Data) =============
  // Stores vocabulary definitions from Units (Markdown)
  // Multi-language ready via column-based translations (preferred) or translations array (deprecated)
  courseVocabulary: defineTable({
    unitNumber: v.number(),
    serbian: v.string(),
    serbianNormalized: v.optional(v.string()), // Lowercase for case-insensitive search

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

    // Release gating (optional; undefined => published)
    releaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"), v.literal("offline"))),
  })
    .index("by_unit", ["unitNumber"])
    .index("by_serbian", ["serbian"])
    .index("by_serbian_normalized", ["serbianNormalized"]) // Case-insensitive search
    .index("by_unit_serbian", ["unitNumber", "serbian"]) // NEW: For finding by unit + serbian
    .index("by_unit_active", ["unitNumber", "isActive"])
    .index("by_unit_serbian_active", ["unitNumber", "serbian", "isActive"])
    .index("by_unit_active_version", ["unitNumber", "isActive", "unitVersion"])
    .index("by_unit_release_active_version", ["unitNumber", "releaseStatus", "isActive", "unitVersion"]),

  // ============= PROPER-NOUN ALLOWLIST =============
  // Admin-maintained list of Serbian tokens that are explicitly confirmed to be
  // REGULAR VOCABULARY (not proper nouns / personal names). Used to override the
  // name heuristic (`looksLikePersonalNameByContext`) and the AI classifier's
  // `proper_noun` decision in `syncVocabularyCoverageFromExercises`, so the
  // same false positive (e.g. "ćao") never gets filtered again.
  //
  // Key: `serbianNormalized` is the lowercased, punctuation-stripped form
  // produced by `normalizeSerbianKey` so lookups are stable regardless of
  // capitalization/punctuation in the source text.
  vocabularyProperNounAllowlist: defineTable({
    serbianNormalized: v.string(),
    serbianOriginal: v.string(),
    confirmedBy: v.id("users"),
    confirmedAt: v.number(),
    source: v.string(), // e.g. "cleanup_panel"
    note: v.optional(v.string()),
  }).index("by_serbian_normalized", ["serbianNormalized"]),

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
};

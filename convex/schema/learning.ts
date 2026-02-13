/**
 * Learning Content Tables
 *
 * Unit metadata, module metadata, unit content (markdown sections),
 * audio cache, and interactive tests.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const learningTables = {
  // ============= CONTENT STRUCTURE METADATA =============

  // 1. Unit Metadata (Master-Table for Units, Multi-language)
  // Primary Key: (unitNumber, language) - Composite Primary Key
  // Foreign Key: moduleMetadataId → moduleMetadata._id (NEW: Real Foreign Key)
  unitMetadata: defineTable({
    unitNumber: v.number(), // Primary Key (composite with language)
    language: v.string(), // "en", "de", "es", "fr" - Primary Key (composite with unitNumber)
    title: v.string(), // Translated Title
    // Short description shown in the UI (e.g., under the unit title).
    // Optional for backward compatibility; will be backfilled from legacy `topics[0]`.
    description: v.optional(v.string()),
    topics: v.array(v.string()), // Array of Topics
    grammarFocus: v.array(v.string()), // Array of Grammar Focus points
    vocabularyThemes: v.array(v.string()), // Array of Vocabulary Themes

    // NEW: Real Foreign Key to moduleMetadata._id
    moduleMetadataId: v.optional(v.id("moduleMetadata")), // Foreign Key to moduleMetadata._id

    // OLD: Deprecated - kept for backward compatibility during migration
    moduleId: v.optional(v.string()), // Foreign Key to moduleMetadata.moduleId - DEPRECATED

    // Release gating (optional for backward compatibility):
    // - undefined => published (default)
    // - "preview" => visible to superadmin only (1:1 preview UI)
    // - "offline" => hidden from all
    releaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"), v.literal("offline"))),

    // Unit-level offline toggle (reversible). Hidden for students, manageable by admins.
    isOffline: v.optional(v.boolean()),
  })
    .index("by_unit_lang", ["unitNumber", "language"]) // Composite Primary Key
    .index("by_module", ["moduleId"]) // Old Foreign Key Index (deprecated)
    .index("by_module_metadata", ["moduleMetadataId"]) // New Foreign Key Index
    .index("by_unit_lang_release", ["unitNumber", "language", "releaseStatus"]),

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

    // Release gating (optional; undefined => published)
    releaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"), v.literal("offline"))),
  })
    .index("by_unit_lang_category", ["unitNumber", "language", "category"]) // Composite FK + category
    .index("by_unit_lang", ["unitNumber", "language"]) // Foreign Key to unitMetadata
    .index("by_question_id", ["questionId"]) // Unique for Gamification
    .index("by_unit_lang_active", ["unitNumber", "language", "isActive"])
    .index("by_unit_lang_active_version", ["unitNumber", "language", "isActive", "unitVersion"])
    .index("by_unit_lang_release_active_version", ["unitNumber", "language", "releaseStatus", "isActive", "unitVersion"]),

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

    // Release gating (optional; undefined => published)
    releaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"), v.literal("offline"))),
  })
    .index("by_unit_lang_type", ["unitNumber", "language", "contentType"]) // Composite FK + contentType
    .index("by_unit_lang", ["unitNumber", "language"]) // Foreign Key to unitMetadata
    .index("by_unit_lang_type_active", ["unitNumber", "language", "contentType", "isActive"])
    .index("by_unit_lang_type_active_version", ["unitNumber", "language", "contentType", "isActive", "unitVersion"])
    .index("by_unit_lang_type_release_active_version", [
      "unitNumber",
      "language",
      "contentType",
      "releaseStatus",
      "isActive",
      "unitVersion",
    ]),

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
};

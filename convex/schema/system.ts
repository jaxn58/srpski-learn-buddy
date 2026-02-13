/**
 * System & Admin Tables
 *
 * App versioning, changelog, onboarding flow,
 * database backups, and payment webhook events.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const systemTables = {
  // ============= DODO WEBHOOK EVENTS (Idempotency / Audit) =============
  // Stores received Dodo Payments webhooks (Standard Webhooks) for idempotency and debugging.
  dodoWebhookEvents: defineTable({
    webhookId: v.string(), // from `webhook-id` header (idempotency key)
    eventType: v.string(), // e.g. payment.succeeded, subscription.renewed
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),

    // Raw JSON payload for debugging/audit (stringified to keep schema simple)
    rawPayload: v.string(),

    // Extracted fields (best-effort, optional)
    clerkId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    paymentId: v.optional(v.string()),
    environment: v.optional(v.union(v.literal("test_mode"), v.literal("live_mode"))),
  })
    .index("by_webhook_id", ["webhookId"])
    .index("by_type", ["eventType"]),

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
};

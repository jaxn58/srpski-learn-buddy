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
    environment: v.optional(v.union(v.literal("test_mode"), v.literal("live_mode"), v.literal("dev_mode"))),
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

    // Staleness tracking: set independently when EN or DE content changes.
    // isDeOutdated = hasDE && enContentUpdatedAt > (deContentUpdatedAt ?? 0)
    enContentUpdatedAt: v.optional(v.number()),
    deContentUpdatedAt: v.optional(v.number()),
  })
    .index("by_language", ["language"]) // OLD: for migration compatibility
    .index("by_language_active", ["language", "isActive", "stepNumber"]) // OLD: for migration
    .index("by_step_number", ["stepNumber"]), // NEW: primary index

  // ============= DASHBOARD ANNOUNCEMENTS (admin-managed banners) =============
  // Reusable top-of-dashboard messages (e.g. beta welcome). Column-based EN/DE like onboarding.
  dashboardAnnouncements: defineTable({
    /** Stable slug, e.g. "dashboard_beta" — used in code and dismiss localStorage. */
    key: v.string(),
    titleEn: v.string(),
    introEn: v.string(),
    /** Main copy (plain text; line breaks preserved in UI). */
    bodyEn: v.string(),
    titleDe: v.optional(v.string()),
    introDe: v.optional(v.string()),
    bodyDe: v.optional(v.string()),
    isActive: v.boolean(),
    audience: v.union(v.literal("all_authenticated"), v.literal("beta_testers_only")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users")),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  // ============= DODO PRODUCTS (Dynamic Pricing) =============
  // Stores synchronized product data from Dodo Payments to keep the UI reactive.
  dodoProducts: defineTable({
    productId: v.string(), // Dodo product_id
    name: v.string(),
    price: v.number(), // in cents
    currency: v.string(), // e.g. "EUR"
    isRecurring: v.boolean(),
    lastSyncedAt: v.number(), // timestamp
  }).index("by_product_id", ["productId"]),

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

  // ============= PLATFORM CONFIG (Singleton) =============
  // Global, app-wide switches. Exactly one row is expected; helpers read it via
  // `.first()` and fall back to defaults when no row exists yet (zero-migration).
  // Currently holds the master beta-phase switch that governs whether beta
  // testers receive free full access (see convex/featureAccess.ts).
  platformConfig: defineTable({
    // Master switch: is the closed beta currently running?
    // true  → users flagged isBetaTester get course_ai-level access (limited energy).
    // false → beta no longer grants access; users need a package / override.
    betaPhaseActive: v.boolean(),
    // Beta boundaries (admin-tunable): learning units and monthly Energy budget.
    // AI usage is cost-controlled via Energy, not a separate daily message cap.
    betaMaxUnits: v.optional(v.number()),
    /** Monthly AI Energy quota for beta testers (default 120). */
    betaEnergyQuotaMonthly: v.optional(v.number()),
    // Course-tier teaser: number of AI Buddy preview questions per day for
    // teaser-only users. Falls back to DEFAULT_TEASER_DAILY_LIMIT in
    // convex/platform.ts when unset (zero-migration).
    teaserDailyLimit: v.optional(v.number()),

    // ===== AI-Energy configuration (Phase 3) =====
    // All optional → zero-migration. Defaults live in convex/energy.ts and
    // mirror docs/restructure/02_TOKEN_SYSTEM.md so behavior is unchanged
    // until a superadmin tunes them.
    //
    // Cost table (relative to "1 Energy = one compact answer without context").
    energyCostCompact: v.optional(v.number()),       // default 1
    energyCostDetailed: v.optional(v.number()),      // default 3
    energyRagSurcharge: v.optional(v.number()),      // default +1 when context/RAG used
    energyVisionSurcharge: v.optional(v.number()),   // default +3 when image attachment
    energyUploadBase: v.optional(v.number()),        // default 5 (base for any upload)
    energyUploadPerKb: v.optional(v.number()),       // default 0.02 → 1 Energy per 50 KB
    // Monthly inclusive quotas per tier (fallback when subscription has no own value).
    energyQuotaFull: v.optional(v.number()),         // default 750
    energyQuotaBuddy: v.optional(v.number()),        // default 600 (AI Chat Standalone)
    energyQuotaBasic: v.optional(v.number()),        // default 250 (Sprachkurs + AI; June 2026 raised from 120)
    // Technical input limits for uploads (independent of energy balance, see
    // 02_TOKEN_SYSTEM.md 2.2). Hard caps to prevent runaway cost / abuse.
    uploadMaxFileBytes: v.optional(v.number()),      // default 10 MB
    /** Per-tier storage quotas (bytes) for Knowledge Base + attachments. */
    storageQuotaStandaloneBytes: v.optional(v.number()),   // default 500 MB
    storageQuotaCourseAiProBytes: v.optional(v.number()),  // default 1 GB
    storageQuotaBetaBytes: v.optional(v.number()),         // chat-attachment preview during active beta (default 25 MB)
    /** Target USD cost per 1 Energy unit for measured token→Energy conversion. */
    energyUsdPerUnit: v.optional(v.number()),

    // ===== Billing config (Phase 4) =====
    // Welcome-Energy bonus for first-time Full-tier buyers.
    // 0 = feature disabled. Default 500 (see DEFAULT_WELCOME_ENERGY_AMOUNT in platform.ts).
    welcomeEnergyAmount: v.optional(v.number()),
    // Beta-tester discount applied at checkout (percent, 0–100). Default 50.
    betaTesterDiscountPercent: v.optional(v.number()),

    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.id("users")),
  }),
};

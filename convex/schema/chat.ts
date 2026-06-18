/**
 * Chat & Prompt Tables
 *
 * AI tutor chat sessions, messages, and admin-managed system prompts.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const chatTables = {
  // ============= CHAT FOLDERS (user library organization) =============
  chatFolders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    parentId: v.optional(v.id("chatFolders")),
    createdAt: v.number(),
    sortOrder: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_parent", ["userId", "parentId"]),

  // ============= CHAT SESSIONS =============
  chatSessions: defineTable({
    userId: v.id("users"),
    title: v.string(),
    archived: v.optional(v.boolean()), // optional for backward compatibility
    archivedAt: v.optional(v.number()),
    folderId: v.optional(v.id("chatFolders")),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "archived"])
    .index("by_user_and_folder", ["userId", "folderId"]),

  // ============= CHAT MESSAGES =============
  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    unitContext: v.optional(v.number()),
    streamId: v.optional(v.string()),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentFileName: v.optional(v.string()),
    attachmentMimeType: v.optional(v.string()),
    attachmentSizeBytes: v.optional(v.number()),
    responseMode: v.optional(v.union(v.literal("compact"), v.literal("detailed"))),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

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
    name: v.string(),
    content: v.string(),
    description: v.optional(v.string()),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_name_updatedAt", ["name", "updatedAt"]),

  // ============= CHAT MESSAGE FEEDBACK =============
  chatMessageFeedback: defineTable({
    messageId: v.id("chatMessages"),
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
    rating: v.union(v.literal("up"), v.literal("down")),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  // ============= CHAT AI CONFIG (admin-managed model settings) =============
  chatAiConfig: defineTable({
    primaryProvider: v.string(),
    primaryModel: v.string(),
    fallbackProvider: v.optional(v.string()),
    fallbackModel: v.optional(v.string()),
    maxTokens: v.number(),
    temperature: v.optional(v.float64()),
    useAgenticRag: v.optional(v.boolean()),
    enableSemanticSearch: v.optional(v.boolean()),
    // Global daily cost cap in cents (e.g. 100 = $1.00/day). 0 or undefined = no cap.
    dailyBudgetCents: v.optional(v.number()),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }),

  // ============= DYNAMIC CHAT SUGGESTIONS =============
  chatSuggestions: defineTable({
    category: v.union(
      v.literal("language"),
      v.literal("culture"),
      v.literal("sos")
    ),
    unitMin: v.optional(v.number()),
    unitMax: v.optional(v.number()),
    // Holiday/seasonal targeting: MM-DD format for recurring annual dates
    holidayDate: v.optional(v.string()),
    // How many days before/after holidayDate this suggestion is relevant
    holidayWindowDays: v.optional(v.number()),
    // Seasonal tag for broader time ranges
    seasonalTag: v.optional(v.union(
      v.literal("spring"),
      v.literal("summer"),
      v.literal("autumn"),
      v.literal("winter")
    )),
    // Display text per language
    textEn: v.string(),
    textDe: v.string(),
    // The actual message that gets prefilled into the chat input
    prefillEn: v.string(),
    prefillDe: v.string(),
    // Priority: higher = preferred when multiple match
    priority: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_category", ["category", "isActive"])
    .index("by_holiday", ["holidayDate", "isActive"]),

  // ============= KNOWLEDGE CHUNKS (RAG -- Semantic Search) =============
  knowledgeChunks: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),
    sourceType: v.union(
      v.literal("grammar"),
      v.literal("vocabulary"),
      v.literal("phrases"),
      v.literal("dialogues"),
      v.literal("overview"),
      v.literal("culture"),
      v.literal("practical"),
      v.literal("article"),
      v.literal("language"),
      v.literal("cuisine"),
      v.literal("geography"),
      v.literal("immigration"),
      v.literal("history"),
      v.literal("other")
    ),
    sourceId: v.optional(v.string()),
    unitNumber: v.optional(v.number()),
    language: v.string(),
    title: v.optional(v.string()),
    metadata: v.optional(v.string()),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["language", "sourceType"],
    })
    .index("by_source", ["sourceType", "sourceId"]),

  // ============= KNOWLEDGE ARTICLES (RAG -- Admin Knowledge Base) =============
  knowledgeArticles: defineTable({
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("culture"),
      v.literal("practical"),
      v.literal("language"),
      v.literal("cuisine"),
      v.literal("geography"),
      v.literal("immigration"),
      v.literal("history"),
      v.literal("other")
    ),
    customCategory: v.optional(v.string()),
    language: v.string(),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("published")),
    // Links translated articles to their English original
    translationOf: v.optional(v.id("knowledgeArticles")),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    chunkedAt: v.optional(v.number()),
  })
    .index("by_category", ["category", "status"])
    .index("by_status", ["status"])
    .index("by_translation", ["translationOf"]),

  // ============= ENERGY PURCHASES (Top-up history) =============
  // Records one-time energy top-up purchases (Dodo). Only relevant for tiers
  // with top-up entitlement (buddy / full). See docs/restructure/02_TOKEN_SYSTEM.md.
  energyPurchases: defineTable({
    userId: v.id("users"),
    energyAdded: v.number(),
    priceCents: v.number(),
    purchasedAt: v.number(),
    billingProvider: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    // Top-up pack identifier (starter / plus / pro). Optional for backward compat.
    pack: v.optional(v.union(v.literal("starter"), v.literal("plus"), v.literal("pro"))),
  }).index("by_user", ["userId"]),

  // ============= ENERGY LEDGER (Audit / Analytics) =============
  // Append-only record of every energy delta (usage, monthly reset, top-up,
  // admin adjustment). Enables per-user/per-action cost analysis and a
  // transparent consumption history. See docs/restructure/02_TOKEN_SYSTEM.md.
  energyLedger: defineTable({
    userId: v.id("users"),
    delta: v.number(), // +n credit / -n consumption (in energy units)
    reason: v.union(
      v.literal("usage"),
      v.literal("monthly_reset"),
      v.literal("topup"),
      v.literal("admin_adjust"),
      v.literal("welcome_bonus")
    ),
    // For reason="usage": which action type consumed energy (for tuning).
    actionType: v.optional(v.union(
      v.literal("compact"),
      v.literal("balanced"),
      v.literal("detailed"),
      v.literal("photo_scan"),
      v.literal("document_analysis")
    )),
    ragUsed: v.optional(v.boolean()),
    messageId: v.optional(v.id("chatMessages")),
    estInputTokens: v.optional(v.number()),  // measured LLM tokens (internal)
    estOutputTokens: v.optional(v.number()),
    /** Energy estimate shown to user before the action (preview only). */
    estimatedEnergyCost: v.optional(v.number()),
    /** Actual energy charged after measured token usage. */
    actualEnergyCost: v.optional(v.number()),
    // Free-form audit note (admin adjustments include the admin user id).
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // ============= DOCUMENT FOLDERS (Knowledge Base organization) =============
  documentFolders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    parentId: v.optional(v.id("documentFolders")),
    createdAt: v.number(),
    sortOrder: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_parent", ["userId", "parentId"]),

  // ============= USER DOCUMENTS (User Uploads) =============
  userDocuments: defineTable({
    userId: v.id("users"),
    fileName: v.string(),
    fileType: v.string(),
    fileSizeBytes: v.optional(v.number()),
    storageId: v.id("_storage"),
    folderId: v.optional(v.id("documentFolders")),
    tags: v.optional(v.array(v.string())),
    source: v.optional(
      v.union(v.literal("knowledge_rack"), v.literal("chat_attachment"))
    ),
    status: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    totalChunks: v.optional(v.number()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    extractionMethod: v.optional(
      v.union(v.literal("text"), v.literal("vision"))
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_folder", ["userId", "folderId"]),

  // ============= USER DOCUMENT CHUNKS (Embedded User Upload Chunks) =============
  userDocumentChunks: defineTable({
    documentId: v.id("userDocuments"),
    userId: v.id("users"),
    content: v.string(),
    embedding: v.array(v.float64()),
    chunkIndex: v.number(),
  })
    .index("by_document", ["documentId"])
    .vectorIndex("by_user_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["userId"],
    }),
};

/**
 * Chat & Prompt Tables
 *
 * AI tutor chat sessions, messages, and admin-managed system prompts.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const chatTables = {
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
    unitContext: v.optional(v.number()),
    streamId: v.optional(v.string()),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentFileName: v.optional(v.string()),
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
    dailyBudgetCents: v.optional(v.number()),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }),

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

  // ============= USER DOCUMENTS (User Uploads) =============
  userDocuments: defineTable({
    userId: v.id("users"),
    fileName: v.string(),
    fileType: v.string(),
    storageId: v.id("_storage"),
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
    .index("by_user_status", ["userId", "status"]),
};

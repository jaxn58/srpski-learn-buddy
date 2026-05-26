/**
 * Agentic RAG Tool Definitions (RAG v6)
 *
 * Tool definitions for AI-driven context retrieval. The AI decides
 * which tools to call based on the user's question rather than
 * always injecting all context upfront.
 */
import { tool } from "ai";
import { z } from "zod";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { embedText } from "./embeddings";

/**
 * Build the tool set for a given user context.
 * Tools are closures over the Convex action context and user state.
 */
export function buildChatTools(
  ctx: ActionCtx,
  userId: Id<"users"> | undefined,
  learningLanguage: string
) {
  return {
    searchKnowledge: tool({
      description:
        "Search the cultural, practical, and language knowledge base for relevant information. Use for questions about Serbian culture, holidays, food, practical life (banking, renting, healthcare), geography, history, or immigration.",
      inputSchema: z.object({
        query: z.string().describe("The search query describing what information is needed"),
        category: z
          .enum(["culture", "practical", "language", "cuisine", "geography", "immigration", "history"])
          .optional()
          .describe("Optional category filter to narrow the search"),
      }),
      execute: async ({ query }) => {
        try {
          const embedding = await embedText(query);
          const results = await ctx.vectorSearch("knowledgeChunks", "by_embedding", {
            vector: embedding,
            limit: 3,
            filter: (q: any) => q.eq("language", learningLanguage),
          });

          const chunks: string[] = [];
          for (const r of results) {
            const doc = await ctx.runQuery(internal.chat.getKnowledgeChunk, { id: r._id });
            if (doc) chunks.push(doc.content);
          }

          // Fallback: supplement with English if few results in user language
          if (chunks.length < 3 && learningLanguage !== "en") {
            const enResults = await ctx.vectorSearch("knowledgeChunks", "by_embedding", {
              vector: embedding,
              limit: 3 - chunks.length,
              filter: (q: any) => q.eq("language", "en"),
            });
            const seen = new Set(chunks);
            for (const r of enResults) {
              const doc = await ctx.runQuery(internal.chat.getKnowledgeChunk, { id: r._id });
              if (doc && !seen.has(doc.content)) chunks.push(doc.content);
            }
          }

          return chunks.length > 0
            ? chunks.join("\n\n---\n\n")
            : "No relevant knowledge found for this query.";
        } catch (e) {
          return `Knowledge search failed: ${e instanceof Error ? e.message : "unknown error"}`;
        }
      },
    }),

    getUnitContent: tool({
      description:
        "Get vocabulary, grammar, phrases, or dialogues for a specific learning unit. Use when the user asks about a specific unit or needs help with content from a particular lesson.",
      inputSchema: z.object({
        unitNumber: z.number().describe("The unit number to retrieve content for"),
        contentType: z
          .enum(["grammar", "phrases", "dialogues", "vocabulary"])
          .describe("The type of content to retrieve"),
      }),
      execute: async ({ unitNumber, contentType }) => {
        try {
          if (contentType === "vocabulary") {
            const vocabResult = await ctx.runQuery(internal.chat.getUnitVocabulary, {
              unitNumber,
              langKey: learningLanguage,
            });
            return vocabResult || "No vocabulary found for this unit.";
          }

          const contentResult = await ctx.runQuery(internal.chat.getUnitContentByType, {
            unitNumber,
            language: learningLanguage,
            contentType,
          });
          return contentResult || `No ${contentType} content found for Unit ${unitNumber}.`;
        } catch (e) {
          return `Failed to get unit content: ${e instanceof Error ? e.message : "unknown error"}`;
        }
      },
    }),

    getUserProgress: tool({
      description:
        "Get the user's learning progress including current unit, completed units, XP, streak, and weak vocabulary. Use when the user asks about their progress or when personalizing advice.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!userId) return "User not identified \u2014 cannot retrieve progress.";
        try {
          const progress = await ctx.runQuery(internal.chat.getUserProgressForTools, { userId });
          return progress || "No progress data available.";
        } catch (e) {
          return `Failed to get progress: ${e instanceof Error ? e.message : "unknown error"}`;
        }
      },
    }),

    searchVocabulary: tool({
      description:
        "Search for a specific Serbian word or phrase across all units. Use when the user asks about the meaning, conjugation, or usage of a specific Serbian word.",
      inputSchema: z.object({
        query: z.string().describe("The Serbian word or phrase to search for"),
      }),
      execute: async ({ query }) => {
        try {
          const result = await ctx.runQuery(internal.chat.searchVocabularyForTools, {
            query,
            langKey: learningLanguage,
          });
          return result || "Word not found in the vocabulary database.";
        } catch (e) {
          return `Vocabulary search failed: ${e instanceof Error ? e.message : "unknown error"}`;
        }
      },
    }),

    searchUserDocuments: tool({
      description:
        "Search the user's uploaded personal documents (PDFs, notes). Use when the user refers to their uploaded materials or asks about content from their documents.",
      inputSchema: z.object({
        query: z.string().describe("What to search for in the user's documents"),
      }),
      execute: async ({ query }) => {
        if (!userId) return "User not identified \u2014 cannot search documents.";
        try {
          const embedding = await embedText(query);
          const results = await ctx.vectorSearch("userDocumentChunks", "by_user_embedding", {
            vector: embedding,
            limit: 3,
            filter: (q: any) => q.eq("userId", userId),
          });

          const chunks: string[] = [];
          for (const r of results) {
            const doc = await ctx.runQuery(internal.chat.getUserDocChunk, { id: r._id });
            if (doc) chunks.push(doc.content);
          }

          return chunks.length > 0
            ? chunks.join("\n\n---\n\n")
            : "No relevant content found in your documents.";
        } catch (e) {
          return `Document search failed: ${e instanceof Error ? e.message : "unknown error"}`;
        }
      },
    }),
  };
}

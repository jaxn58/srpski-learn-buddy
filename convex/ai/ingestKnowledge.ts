/**
 * Knowledge Ingestion Pipeline (RAG v3+)
 *
 * Processes unit content and knowledge articles into embedded chunks
 * stored in the knowledgeChunks table for vector search.
 */
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { embedTexts, chunkText } from "./embeddings";

// @ts-ignore TS2589
export const ingestAllUnitContent = internalAction({
  args: {},
  handler: async (ctx) => {
    const contentRows: Array<{
      _id: string;
      unitNumber: number;
      language: string;
      contentType: string;
      content: string;
    }> = await ctx.runQuery(internal.ai.ingestKnowledge.listAllUnitContent, {});

    console.log(`[ingest] Found ${contentRows.length} unitContent rows to process`);

    let ingested = 0;
    let skipped = 0;

    for (const row of contentRows) {
      const sourceId = `unitContent:${row._id}`;

      const exists: boolean = await ctx.runQuery(
        internal.ai.ingestKnowledge.chunkExistsForSource,
        { sourceId }
      );
      if (exists) {
        skipped++;
        continue;
      }

      const validTypes = [
        "grammar", "vocabulary", "phrases", "dialogues", "overview",
      ] as const;
      type ValidType = typeof validTypes[number];
      if (!validTypes.includes(row.contentType as ValidType)) continue;

      const prefix = `[Unit ${row.unitNumber} — ${row.contentType}]\n\n`;
      const chunks = chunkText(row.content, 1600);

      if (chunks.length === 0) continue;

      const embeddings = await embedTexts(chunks);

      for (let i = 0; i < chunks.length; i++) {
        await ctx.runMutation(internal.ai.ingestKnowledge.insertChunk, {
          content: prefix + chunks[i],
          embedding: embeddings[i],
          sourceType: row.contentType as ValidType,
          sourceId,
          unitNumber: row.unitNumber,
          language: row.language,
          title: `Unit ${row.unitNumber} — ${row.contentType}`,
        });
      }

      ingested++;
    }

    console.log(`[ingest] Done: ${ingested} rows ingested, ${skipped} skipped (already existed)`);
  },
});

/**
 * Ingest a single knowledge article (called when an article is published).
 */
// @ts-ignore TS2589
export const ingestArticle = internalAction({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const article = await ctx.runQuery(internal.ai.ingestKnowledge.getArticle, {
      articleId: args.articleId,
    });
    if (!article || article.status !== "published") return;

    const sourceId = `article:${args.articleId}`;

    // Remove old chunks for this article
    await ctx.runMutation(internal.ai.ingestKnowledge.deleteChunksBySource, { sourceId });

    const prefix = `[${article.title}]\n\n`;
    const chunks = chunkText(article.content, 1600);
    if (chunks.length === 0) return;

    const embeddings = await embedTexts(chunks);

    for (let i = 0; i < chunks.length; i++) {
      await ctx.runMutation(internal.ai.ingestKnowledge.insertChunk, {
        content: prefix + chunks[i],
        embedding: embeddings[i],
        sourceType: article.category,
        sourceId,
        language: article.language,
        title: article.title,
      });
    }

    // Mark article as chunked
    await ctx.runMutation(internal.ai.ingestKnowledge.markArticleChunked, {
      articleId: args.articleId,
    });

    console.log(`[ingest] Article "${article.title}" ingested (${chunks.length} chunks)`);
  },
});

/**
 * Ingest a user-uploaded document (called after PDF text extraction).
 */
// @ts-ignore TS2589
export const ingestUserDocument = internalAction({
  args: {
    documentId: v.id("userDocuments"),
    userId: v.id("users"),
    extractedText: v.string(),
  },
  handler: async (ctx, args) => {
    const chunks = chunkText(args.extractedText, 1600);
    if (chunks.length === 0) {
      await ctx.runMutation(internal.ai.ingestKnowledge.updateDocumentStatus, {
        documentId: args.documentId,
        status: "error",
        errorMessage: "No text could be extracted from the document",
      });
      return;
    }

    const embeddings = await embedTexts(chunks);

    for (let i = 0; i < chunks.length; i++) {
      await ctx.runMutation(internal.ai.ingestKnowledge.insertUserDocChunk, {
        documentId: args.documentId,
        userId: args.userId,
        content: chunks[i],
        embedding: embeddings[i],
        chunkIndex: i,
      });
    }

    await ctx.runMutation(internal.ai.ingestKnowledge.updateDocumentStatus, {
      documentId: args.documentId,
      status: "ready",
      totalChunks: chunks.length,
    });

    console.log(`[ingest] User document ingested (${chunks.length} chunks)`);
  },
});

// =============================================
// Helper queries and mutations (internal only)
// =============================================

// @ts-ignore TS2589
export const listAllUnitContent = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("unitContent").collect();
    return all.map((row) => ({
      _id: row._id as string,
      unitNumber: row.unitNumber,
      language: row.language,
      contentType: row.contentType,
      content: row.content,
    }));
  },
});

// @ts-ignore TS2589
export const chunkExistsForSource = internalQuery({
  args: { sourceId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("knowledgeChunks")
      .withIndex("by_source", (q) => q.eq("sourceType", "grammar").eq("sourceId", args.sourceId))
      .first();
    if (existing) return true;
    // Also check other source types since by_source index requires sourceType
    const all = await ctx.db.query("knowledgeChunks").collect();
    return all.some((c) => c.sourceId === args.sourceId);
  },
});

// @ts-ignore TS2589
export const getArticle = internalQuery({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.articleId);
  },
});

// @ts-ignore TS2589
export const insertChunk = internalMutation({
  args: {
    content: v.string(),
    embedding: v.array(v.float64()),
    sourceType: v.string(),
    sourceId: v.string(),
    unitNumber: v.optional(v.number()),
    language: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("knowledgeChunks", {
      content: args.content,
      embedding: args.embedding,
      sourceType: args.sourceType as any,
      sourceId: args.sourceId,
      unitNumber: args.unitNumber,
      language: args.language,
      title: args.title,
    });
  },
});

// @ts-ignore TS2589
export const deleteChunksBySource = internalMutation({
  args: { sourceId: v.string() },
  handler: async (ctx, args) => {
    const chunks = await ctx.db.query("knowledgeChunks").collect();
    const toDelete = chunks.filter((c) => c.sourceId === args.sourceId);
    for (const chunk of toDelete) {
      await ctx.db.delete(chunk._id);
    }
  },
});

// @ts-ignore TS2589
export const markArticleChunked = internalMutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.articleId, { chunkedAt: Date.now() });
  },
});

// @ts-ignore TS2589
export const insertUserDocChunk = internalMutation({
  args: {
    documentId: v.id("userDocuments"),
    userId: v.id("users"),
    content: v.string(),
    embedding: v.array(v.float64()),
    chunkIndex: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("userDocumentChunks", {
      documentId: args.documentId,
      userId: args.userId,
      content: args.content,
      embedding: args.embedding,
      chunkIndex: args.chunkIndex,
    });
  },
});

// @ts-ignore TS2589
export const updateDocumentStatus = internalMutation({
  args: {
    documentId: v.id("userDocuments"),
    status: v.string(),
    totalChunks: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    extractionMethod: v.optional(v.union(v.literal("text"), v.literal("vision"))),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = { status: args.status };
    if (args.totalChunks !== undefined) patch.totalChunks = args.totalChunks;
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.extractionMethod !== undefined) patch.extractionMethod = args.extractionMethod;
    await ctx.db.patch(args.documentId, patch);
  },
});


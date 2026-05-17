/**
 * User Document Uploads (RAG v4)
 *
 * Allows users to upload PDFs, text files, and images.
 * Documents are processed (text extraction via parsing or Gemini Vision,
 * chunking, embedding) and made searchable via vector search in the chat.
 *
 * Note: The heavy processing action lives in documentsNode.ts which uses
 * "use node" for Node.js built-in access (pdf-parse + Gemini Vision OCR).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const MAX_DOCUMENTS_PER_USER = 5;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
];

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
}

// @ts-ignore TS2589
export const getUserDocuments = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// @ts-ignore TS2589
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

// @ts-ignore TS2589
export const createDocument = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (!ALLOWED_FILE_TYPES.includes(args.fileType) && !args.fileName.endsWith(".md")) {
      throw new Error("Supported formats: PDF, TXT, Markdown, JPEG, PNG, WebP");
    }

    const docId = await ctx.db.insert("userDocuments", {
      userId: user._id,
      fileName: args.fileName,
      fileType: args.fileType,
      storageId: args.storageId,
      status: "uploaded",
      description: args.description,
      category: args.category,
    });

    // Schedule background processing (runs in Node.js runtime)
    await ctx.scheduler.runAfter(0, internal.documentsNode.processDocument, {
      documentId: docId,
      userId: user._id,
      storageId: args.storageId,
      fileType: args.fileType,
    });

    return docId;
  },
});

// @ts-ignore TS2589
export const deleteDocument = mutation({
  args: { documentId: v.id("userDocuments") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== user._id) {
      throw new Error("Document not found or access denied");
    }

    // Delete chunks
    const chunks = await ctx.db
      .query("userDocumentChunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete storage file
    await ctx.storage.delete(doc.storageId);

    // Delete document record
    await ctx.db.delete(args.documentId);
  },
});

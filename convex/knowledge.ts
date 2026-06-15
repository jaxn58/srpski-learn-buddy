/**
 * Knowledge Base CRUD (RAG v5)
 *
 * Admin-managed articles about Serbian culture, practical life,
 * language, cuisine, geography, immigration, and history.
 * Published articles are auto-ingested into the knowledgeChunks table.
 */
import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const ARTICLE_CATEGORIES = v.union(
  v.literal("culture"),
  v.literal("practical"),
  v.literal("language"),
  v.literal("cuisine"),
  v.literal("geography"),
  v.literal("immigration"),
  v.literal("history"),
  v.literal("other")
);

async function requireAdmin(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Admin access required");
  }
  return user;
}

// @ts-ignore TS2589
export const listCustomCategories = query({
  args: {},
  handler: async (ctx) => {
    const articles = await ctx.db.query("knowledgeArticles").collect();
    const customs = new Set<string>();
    for (const a of articles) {
      if (a.category === "other" && a.customCategory) {
        customs.add(a.customCategory);
      }
    }
    return [...customs].sort();
  },
});

// @ts-ignore TS2589
export const listArticles = query({
  args: {
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let articles;
    if (args.status) {
      articles = await ctx.db
        .query("knowledgeArticles")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      articles = await ctx.db.query("knowledgeArticles").collect();
    }

    if (args.category) {
      articles = articles.filter((a) => a.category === args.category);
    }

    return articles.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// @ts-ignore TS2589
export const getArticle = query({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.articleId);
  },
});

// @ts-ignore TS2589
export const createArticle = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: ARTICLE_CATEGORIES,
    customCategory: v.optional(v.string()),
    language: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);
    return await ctx.db.insert("knowledgeArticles", {
      title: args.title,
      content: args.content,
      category: args.category,
      customCategory: args.category === "other" ? args.customCategory : undefined,
      language: args.language,
      tags: args.tags,
      status: "draft",
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

// @ts-ignore TS2589
export const updateArticle = mutation({
  args: {
    articleId: v.id("knowledgeArticles"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(ARTICLE_CATEGORIES),
    customCategory: v.optional(v.string()),
    language: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { articleId, ...updates } = args;
    if (updates.category && updates.category !== "other") {
      updates.customCategory = undefined;
    }
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(articleId, { ...filtered, updatedAt: Date.now() });
    }
  },
});

// @ts-ignore TS2589
export const publishArticle = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.articleId, {
      status: "published",
      updatedAt: Date.now(),
    });
    // Trigger async ingestion into knowledge chunks
    await ctx.scheduler.runAfter(0, internal.ai.ingestKnowledge.ingestArticle, {
      articleId: args.articleId,
    });
  },
});

// @ts-ignore TS2589
export const unpublishArticle = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.articleId, {
      status: "draft",
      updatedAt: Date.now(),
    });
  },
});

// @ts-ignore TS2589
export const deleteArticle = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Delete associated chunks
    const sourceId = `article:${args.articleId}`;
    const chunks = await ctx.db.query("knowledgeChunks").collect();
    for (const chunk of chunks.filter((c) => c.sourceId === sourceId)) {
      await ctx.db.delete(chunk._id);
    }
    // Delete translations of this article
    const translations = await ctx.db
      .query("knowledgeArticles")
      .withIndex("by_translation", (q) => q.eq("translationOf", args.articleId))
      .collect();
    for (const t of translations) {
      const tSourceId = `article:${t._id}`;
      const tChunks = await ctx.db.query("knowledgeChunks").collect();
      for (const chunk of tChunks.filter((c) => c.sourceId === tSourceId)) {
        await ctx.db.delete(chunk._id);
      }
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(args.articleId);
  },
});

// ============= FILE UPLOAD =============

/**
 * Generate an upload URL for the admin knowledge file upload.
 * Requires admin auth.
 */
// @ts-ignore TS2589
export const generateKnowledgeUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Schedule text extraction from an uploaded file.
 * Creates a background action that extracts the text and creates a draft article.
 */
// @ts-ignore TS2589
export const scheduleExtraction = mutation({
  args: {
    storageId: v.id("_storage"),
    fileType: v.string(),
    fileName: v.string(),
    category: ARTICLE_CATEGORIES,
    customCategory: v.optional(v.string()),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);
    await ctx.scheduler.runAfter(0, internal.documentsNode.extractKnowledgeDocument, {
      storageId: args.storageId,
      fileType: args.fileType,
      fileName: args.fileName,
      category: args.category,
      customCategory: args.category === "other" ? args.customCategory : undefined,
      language: args.language,
      adminUserId: user._id,
    });
  },
});

/**
 * Internal mutation to create a draft article from extracted file content.
 * Called by extractKnowledgeDocument action -- no auth check needed.
 */
// @ts-ignore TS2589
export const createArticleFromUpload = internalMutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.string(),
    customCategory: v.optional(v.string()),
    language: v.string(),
    adminUserId: v.id("users"),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("knowledgeArticles", {
      title: args.title,
      content: args.content,
      category: args.category as "culture" | "practical" | "language" | "cuisine" | "geography" | "immigration" | "history" | "other",
      customCategory: args.customCategory,
      language: args.language,
      tags: args.tags,
      status: "draft",
      createdBy: args.adminUserId,
      createdAt: Date.now(),
    });
  },
});

// ============= TRANSLATIONS =============

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "de", name: "German" },
  { code: "sr", name: "Serbian" },
] as const;

/**
 * Get all translations for a given article.
 */
// @ts-ignore TS2589
export const getTranslations = query({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article) return { original: null, translations: [] };

    // If this IS a translation, find the original
    const originalId = article.translationOf ?? args.articleId;
    const original = article.translationOf ? await ctx.db.get(article.translationOf) : article;

    const translations = await ctx.db
      .query("knowledgeArticles")
      .withIndex("by_translation", (q) => q.eq("translationOf", originalId))
      .collect();

    return { original, translations };
  },
});

/**
 * Get available languages that don't yet have a translation for this article.
 */
// @ts-ignore TS2589
export const getMissingTranslations = query({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article) return [];

    const originalId = article.translationOf ?? args.articleId;
    const original = article.translationOf ? await ctx.db.get(article.translationOf) : article;
    if (!original) return [];

    const translations = await ctx.db
      .query("knowledgeArticles")
      .withIndex("by_translation", (q) => q.eq("translationOf", originalId))
      .collect();

    const existingLangs = new Set([original.language, ...translations.map((t) => t.language)]);
    return SUPPORTED_LANGUAGES.filter((l) => !existingLangs.has(l.code));
  },
});

/**
 * Trigger AI translation of an article into the target language.
 */
// @ts-ignore TS2589
export const translateArticle = mutation({
  args: {
    articleId: v.id("knowledgeArticles"),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");

    // Always translate from the original English source
    const sourceId = article.translationOf ?? args.articleId;
    const source = article.translationOf ? await ctx.db.get(article.translationOf) : article;
    if (!source) throw new Error("Source article not found");

    // Check if translation already exists
    const existing = await ctx.db
      .query("knowledgeArticles")
      .withIndex("by_translation", (q) => q.eq("translationOf", sourceId))
      .collect();

    if (existing.some((t) => t.language === args.targetLanguage)) {
      throw new Error(`Translation to ${args.targetLanguage} already exists`);
    }

    // Create placeholder article in draft status
    const translatedId = await ctx.db.insert("knowledgeArticles", {
      title: `[Translating...] ${source.title}`,
      content: "",
      category: source.category,
      language: args.targetLanguage,
      tags: source.tags,
      status: "draft",
      translationOf: sourceId as Id<"knowledgeArticles">,
      createdBy: source.createdBy,
      createdAt: Date.now(),
    });

    // Schedule AI translation
    await ctx.scheduler.runAfter(0, internal.knowledge.performTranslation, {
      sourceArticleId: sourceId as Id<"knowledgeArticles">,
      targetArticleId: translatedId,
      targetLanguage: args.targetLanguage,
    });

    return translatedId;
  },
});

/**
 * AI-powered translation action (runs in background).
 */
// @ts-ignore TS2589
export const performTranslation = internalAction({
  args: {
    sourceArticleId: v.id("knowledgeArticles"),
    targetArticleId: v.id("knowledgeArticles"),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.runQuery(internal.knowledge.internalGetArticle, {
      articleId: args.sourceArticleId,
    });
    if (!source) {
      await ctx.runMutation(internal.knowledge.internalPatchArticle, {
        articleId: args.targetArticleId,
        patch: { title: "[Translation failed] Source not found", content: "Source article was not found." },
      });
      return;
    }

    const langNames: Record<string, string> = { de: "German", en: "English", sr: "Serbian", es: "Spanish", fr: "French" };
    const targetLangName = langNames[args.targetLanguage] ?? args.targetLanguage;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.knowledge.internalPatchArticle, {
        articleId: args.targetArticleId,
        patch: { title: "[Translation failed] No API key", content: "OPENAI_API_KEY not configured." },
      });
      return;
    }

    try {
      // Translate title
      const titlePrompt = `Translate the following article title from English to ${targetLangName}. Return ONLY the translated title, nothing else.\n\nTitle: ${source.title}`;

      const titleResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: titlePrompt }],
          max_tokens: 200,
          temperature: 0.3,
        }),
      });
      const titleData = await titleResponse.json() as any;
      const translatedTitle = titleData.choices?.[0]?.message?.content?.trim() || source.title;

      // Translate content
      const contentPrompt = `Translate the following knowledge article from English to ${targetLangName}.

Rules:
- Keep all Markdown formatting intact (headings, bold, lists, etc.)
- Keep Serbian words/phrases in their original Serbian form (do NOT translate Serbian terms)
- Keep proper nouns as they are
- Translate naturally, not word-by-word
- The audience is people learning Serbian, so maintain a helpful and informative tone

Article content:

${source.content}`;

      const contentResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: contentPrompt }],
          max_tokens: 4096,
          temperature: 0.3,
        }),
      });
      const contentData = await contentResponse.json() as any;
      const translatedContent = contentData.choices?.[0]?.message?.content?.trim() || "";

      if (!translatedContent) throw new Error("Empty translation result");

      await ctx.runMutation(internal.knowledge.internalPatchArticle, {
        articleId: args.targetArticleId,
        patch: {
          title: translatedTitle,
          content: translatedContent,
          updatedAt: Date.now(),
        },
      });

      console.log(`[translate] "${source.title}" → ${targetLangName} completed`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      await ctx.runMutation(internal.knowledge.internalPatchArticle, {
        articleId: args.targetArticleId,
        patch: {
          title: `[Translation failed] ${source.title}`,
          content: `Translation error: ${errorMsg}\n\nOriginal content preserved below:\n\n${source.content}`,
        },
      });
      console.error("[translate] Failed:", e);
    }
  },
});

// ============= INTERNAL HELPERS =============

// @ts-ignore TS2589
export const internalGetArticle = internalQuery({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.articleId);
  },
});

// @ts-ignore TS2589
export const internalPatchArticle = internalMutation({
  args: {
    articleId: v.id("knowledgeArticles"),
    patch: v.object({
      title: v.optional(v.string()),
      content: v.optional(v.string()),
      updatedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const filtered = Object.fromEntries(
      Object.entries(args.patch).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(args.articleId, filtered);
    }
  },
});


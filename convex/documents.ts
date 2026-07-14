import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getFeatureAccessForUser } from "./featureAccess";
import { estimateEnergyCost, loadEnergyConfig } from "./energy";
import {
  assertDailyUploadRateLimit,
  assertStorageQuotaAvailable,
  formatBytes,
  getUserStorageUsageBytes,
  loadStorageQuotaConfig,
  resolveStorageQuotaBytes,
} from "./storageQuota";
import { loadBetaPhaseActive } from "./platform";
import { deleteUserDocumentCascade } from "./lib/storageHelpers";
import { assertLearnerAccountActive } from "./authz";

async function getCurrentUser(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: { eq: (field: string, value: string) => unknown }) =>
      q.eq("clerkId", identity.subject)
    )
    .first();
  if (user) assertLearnerAccountActive(user);
  return user;
}

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
const uploadSourceValidator = v.union(
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  v.literal("chat_attachment"),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  v.literal("knowledge_rack")
);

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
const documentSummaryValidator = v.object({
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  _id: v.id("userDocuments"),
  _creationTime: v.number(),
  fileName: v.string(),
  fileType: v.string(),
  fileSizeBytes: v.number(),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  folderId: v.optional(v.id("documentFolders")),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  tags: v.optional(v.array(v.string())),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  source: v.optional(
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    v.union(v.literal("knowledge_rack"), v.literal("chat_attachment"))
  ),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  status: v.union(
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    v.literal("uploaded"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    v.literal("processing"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    v.literal("ready"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    v.literal("error")
  ),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  category: v.optional(v.string()),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  description: v.optional(v.string()),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  errorMessage: v.optional(v.string()),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  extractionMethod: v.optional(
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    v.union(v.literal("text"), v.literal("vision"))
  ),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  totalChunks: v.optional(v.number()),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  downloadUrl: v.union(v.string(), v.null()),
});

/**
 * Generate an upload URL for an attachment.
 *
 * Energy enforcement (Phase 3): callers MUST pass the actual file size and
 * mime so the backend can:
 *  1) reject uploads over the configured technical cap (uploadMaxFileBytes)
 *  2) reject uploads when the user does not have enough AI Energy to cover
 *     the upload + analysis (Variant A: block early, don't take the upload
 *     and then refuse to answer).
 *
 * Staff / unlimited plans pass through. The acknowledged-cost contract is
 * enforced again at finalize-time so the frontend cannot under-report cost.
 */
// @ts-ignore TS2589
export const generateUploadUrl = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    fileBytes: v.optional(v.number()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    fileType: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    acknowledgedCost: v.optional(v.number()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    uploadSource: v.optional(uploadSourceValidator),
  },
  returns: v.string(),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const access = await getFeatureAccessForUser(ctx, user._id);
    const source = args.uploadSource ?? "chat_attachment";

    if (source === "knowledge_rack" && !access.features.knowledgeRack) {
      throw new Error("Knowledge Base is not included in your current plan.");
    }
    if (source === "chat_attachment" && !access.features.chatAttachments) {
      throw new Error("Chat attachments are not included in your current plan.");
    }

    await assertDailyUploadRateLimit(
      ctx,
      user._id,
      source,
      access.isStaff
    );

    const cfg = await loadEnergyConfig(ctx);

    if (typeof args.fileBytes === "number") {
      if (args.fileBytes < 0 || !Number.isFinite(args.fileBytes)) {
        throw new Error("Invalid file size");
      }
      if (args.fileBytes > cfg.uploadMaxFileBytes) {
        const mb = (cfg.uploadMaxFileBytes / (1024 * 1024)).toFixed(0);
        throw new Error(`File too large. Maximum upload size is ${mb} MB.`);
      }

      await assertStorageQuotaAvailable(
        ctx,
        user._id,
        access,
        args.fileBytes,
        source
      );
    }

    if (!access.energy.unlimited && typeof args.fileBytes === "number") {
      // Block uploads only when the effective spendable balance is exhausted.
      // Prior debt is subtracted from `available` already; the next successful
      // charge sweeps it out, so carried debt alone is not a blocker.
      if (access.energy.available <= 0) {
        throw new Error(
          access.energy.debtBalance > 0
            ? `Outstanding AI Energy debt of ${access.energy.debtBalance}. Top up to continue.`
            : "AI Energy exhausted. Top up or wait for the monthly reset."
        );
      }

      const mime = args.fileType ?? "application/octet-stream";
      const isImage = mime.startsWith("image/");
      const estimate = estimateEnergyCost(cfg, {
        hasImageAttachment: isImage,
        hasFileAttachment: !isImage,
        attachmentBytes: args.fileBytes,
      });

      if (typeof args.acknowledgedCost === "number" && args.acknowledgedCost < estimate.cost) {
        throw new Error(
          `Cost mismatch: upload requires ${estimate.cost} Energy, but client acknowledged only ${args.acknowledgedCost}. Please retry.`
        );
      }
    }

    return await ctx.storage.generateUploadUrl();
  },
});

const UPLOAD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// @ts-ignore TS2589
export const checkUploadRateLimit = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    uploadSource: v.optional(uploadSourceValidator),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.object({
    allowed: v.boolean(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    nextAllowedAt: v.union(v.number(), v.null()),
  }),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (user.role === "admin" || user.role === "superadmin") {
      return { allowed: true, nextAllowedAt: null };
    }

    const source = args.uploadSource ?? "chat_attachment";
    const cutoff = Date.now() - UPLOAD_COOLDOWN_MS;

    if (source === "chat_attachment") {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const recent = messages.filter(
        (m) => m.attachmentStorageId && m._creationTime >= cutoff
      );
      if (recent.length >= 10) {
        const oldest = recent.reduce((a, b) =>
          a._creationTime < b._creationTime ? a : b
        );
        return {
          allowed: false,
          nextAllowedAt: oldest._creationTime + UPLOAD_COOLDOWN_MS,
        };
      }
      return { allowed: true, nextAllowedAt: null };
    }

    const docs = await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const recent = docs.filter((d) => d._creationTime >= cutoff);
    if (recent.length >= 5) {
      const oldest = recent.reduce((a, b) =>
        a._creationTime < b._creationTime ? a : b
      );
      return {
        allowed: false,
        nextAllowedAt: oldest._creationTime + UPLOAD_COOLDOWN_MS,
      };
    }

    return { allowed: true, nextAllowedAt: null };
  },
});

// @ts-ignore TS2589
export const getUserStorageUsage = query({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.object({
    usedBytes: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    quotaBytes: v.union(v.number(), v.null()),
    usedFormatted: v.string(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    quotaFormatted: v.union(v.string(), v.null()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    percentUsed: v.union(v.number(), v.null()),
  }),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return {
        usedBytes: 0,
        quotaBytes: null,
        usedFormatted: "0 B",
        quotaFormatted: null,
        percentUsed: null,
      };
    }

    const access = await getFeatureAccessForUser(ctx, user._id);
    const quotas = await loadStorageQuotaConfig(ctx);
    const betaPhaseActive = await loadBetaPhaseActive(ctx);
    const quotaBytes = resolveStorageQuotaBytes(access, quotas, betaPhaseActive);
    const usedBytes = await getUserStorageUsageBytes(ctx, user._id);

    return {
      usedBytes,
      quotaBytes,
      usedFormatted: formatBytes(usedBytes),
      quotaFormatted: quotaBytes !== null ? formatBytes(quotaBytes) : null,
      percentUsed:
        quotaBytes !== null && quotaBytes > 0
          ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100))
          : null,
    };
  },
});

// @ts-ignore TS2589
export const getLibraryHubStats = query({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.object({
    chatSessionCount: v.number(),
    chatFolderCount: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    chatLastActivityAt: v.union(v.number(), v.null()),
    documentCount: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    documentLastUploadAt: v.union(v.number(), v.null()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    storage: v.object({
      usedBytes: v.number(),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      quotaBytes: v.union(v.number(), v.null()),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      percentUsed: v.union(v.number(), v.null()),
    }),
  }),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return {
        chatSessionCount: 0,
        chatFolderCount: 0,
        chatLastActivityAt: null,
        documentCount: 0,
        documentLastUploadAt: null,
        storage: { usedBytes: 0, quotaBytes: null, percentUsed: null },
      };
    }

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    const folders = await ctx.db
      .query("chatFolders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let chatLastActivityAt: number | null = null;
    for (const session of sessions) {
      if (!chatLastActivityAt || session._creationTime > chatLastActivityAt) {
        chatLastActivityAt = session._creationTime;
      }
    }

    const docs = await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let documentLastUploadAt: number | null = null;
    for (const doc of docs) {
      if (!documentLastUploadAt || doc._creationTime > documentLastUploadAt) {
        documentLastUploadAt = doc._creationTime;
      }
    }

    const access = await getFeatureAccessForUser(ctx, user._id);
    const quotas = await loadStorageQuotaConfig(ctx);
    const betaPhaseActive = await loadBetaPhaseActive(ctx);
    const quotaBytes = resolveStorageQuotaBytes(access, quotas, betaPhaseActive);
    const usedBytes = await getUserStorageUsageBytes(ctx, user._id);

    return {
      chatSessionCount: sessions.length,
      chatFolderCount: folders.length,
      chatLastActivityAt,
      documentCount: docs.length,
      documentLastUploadAt,
      storage: {
        usedBytes,
        quotaBytes,
        percentUsed:
          quotaBytes !== null && quotaBytes > 0
            ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100))
            : null,
      },
    };
  },
});

// @ts-ignore TS2589
export const getUserDocuments = query({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.array(documentSummaryValidator),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const access = await getFeatureAccessForUser(ctx, user._id);
    if (!access.features.knowledgeRack) return [];

    const docs = await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    return await Promise.all(
      docs.map(async (doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSizeBytes: doc.fileSizeBytes ?? 0,
        folderId: doc.folderId,
        tags: doc.tags,
        source: doc.source,
        status: doc.status,
        category: doc.category,
        description: doc.description,
        errorMessage: doc.errorMessage,
        extractionMethod: doc.extractionMethod,
        totalChunks: doc.totalChunks,
        downloadUrl: await ctx.storage.getUrl(doc.storageId),
      }))
    );
  },
});

// @ts-ignore TS2589
export const listUserDocuments = query({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    search: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    fileTypeFilter: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    statusFilter: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    folderId: v.optional(v.id("documentFolders")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    uncategorizedOnly: v.optional(v.boolean()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    sortBy: v.optional(
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.union(v.literal("date"), v.literal("name"), v.literal("size"))
    ),
    paginationOpts: paginationOptsValidator,
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.object({
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    page: v.array(documentSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const access = await getFeatureAccessForUser(ctx, user._id);
    if (!access.features.knowledgeRack) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    let docs = await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    if (args.uncategorizedOnly) {
      docs = docs.filter((d) => d.folderId === undefined);
    } else if (args.folderId !== undefined) {
      docs = docs.filter((d) => d.folderId === args.folderId);
    }

    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      docs = docs.filter(
        (d) =>
          d.fileName.toLowerCase().includes(q) ||
          d.category?.toLowerCase().includes(q) ||
          // @ts-ignore TS7006 TS2589 – Convex schema depth limit (50 tables)
          d.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (args.fileTypeFilter) {
      const filter = args.fileTypeFilter;
      docs = docs.filter((d) => {
        if (filter === "image") return d.fileType.startsWith("image/");
        if (filter === "pdf") return d.fileType === "application/pdf";
        if (filter === "text") {
          return (
            d.fileType.startsWith("text/") ||
            d.fileType === "application/markdown"
          );
        }
        return true;
      });
    }

    if (args.statusFilter) {
      docs = docs.filter((d) => d.status === args.statusFilter);
    }

    const sortBy = args.sortBy ?? "date";
    docs.sort((a, b) => {
      if (sortBy === "name") return a.fileName.localeCompare(b.fileName);
      if (sortBy === "size") {
        return (b.fileSizeBytes ?? 0) - (a.fileSizeBytes ?? 0);
      }
      return b._creationTime - a._creationTime;
    });

    const { numItems, cursor } = args.paginationOpts;
    const start = cursor ? parseInt(cursor, 10) : 0;
    const slice = docs.slice(start, start + numItems);
    const next = start + numItems;

    const page = await Promise.all(
      slice.map(async (doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSizeBytes: doc.fileSizeBytes ?? 0,
        folderId: doc.folderId,
        tags: doc.tags,
        source: doc.source,
        status: doc.status,
        category: doc.category,
        description: doc.description,
        errorMessage: doc.errorMessage,
        extractionMethod: doc.extractionMethod,
        totalChunks: doc.totalChunks,
        downloadUrl: await ctx.storage.getUrl(doc.storageId),
      }))
    );

    return {
      page,
      isDone: next >= docs.length,
      continueCursor: String(next),
    };
  },
});

// @ts-ignore TS2589
export const createDocument = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSizeBytes: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    folderId: v.optional(v.id("documentFolders")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    category: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    description: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    tags: v.optional(v.array(v.string())),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.id("userDocuments"),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const access = await getFeatureAccessForUser(ctx, user._id);
    if (!access.features.knowledgeRack) {
      throw new Error("Document upload is not included in your current plan.");
    }

    if (args.fileSizeBytes < 0 || !Number.isFinite(args.fileSizeBytes)) {
      throw new Error("Invalid file size");
    }

    await assertStorageQuotaAvailable(
      ctx,
      user._id,
      access,
      args.fileSizeBytes,
      "knowledge_rack"
    );
    await assertDailyUploadRateLimit(ctx, user._id, "knowledge_rack", access.isStaff);

    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        throw new Error("Folder not found");
      }
    }

    const documentId = await ctx.db.insert("userDocuments", {
      userId: user._id,
      fileName: args.fileName.trim(),
      fileType: args.fileType,
      fileSizeBytes: args.fileSizeBytes,
      storageId: args.storageId,
      folderId: args.folderId,
      tags: args.tags,
      source: "knowledge_rack",
      status: "uploaded",
      category: args.category,
      description: args.description,
    });

    await ctx.scheduler.runAfter(0, internal.documentsNode.processDocument, {
      documentId,
      userId: user._id,
      storageId: args.storageId,
      fileType: args.fileType,
    });

    return documentId;
  },
});

// @ts-ignore TS2589
export const renameDocument = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    documentId: v.id("userDocuments"),
    fileName: v.string(),
  },
  returns: v.null(),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== user._id) throw new Error("Document not found");

    const trimmed = args.fileName.trim();
    if (!trimmed) throw new Error("File name is required");

    await ctx.db.patch(args.documentId, { fileName: trimmed });
    return null;
  },
});

// @ts-ignore TS2589
export const updateDocumentMeta = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    documentId: v.id("userDocuments"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    category: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    description: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    tags: v.optional(v.array(v.string())),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    folderId: v.optional(v.union(v.id("documentFolders"), v.null())),
  },
  returns: v.null(),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== user._id) throw new Error("Document not found");

    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        throw new Error("Folder not found");
      }
    }

    const patch: Record<string, unknown> = {};
    if (args.category !== undefined) patch.category = args.category;
    if (args.description !== undefined) patch.description = args.description;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (args.folderId !== undefined) {
      patch.folderId = args.folderId === null ? undefined : args.folderId;
    }

    await ctx.db.patch(args.documentId, patch);
    return null;
  },
});

// @ts-ignore TS2589
export const deleteDocument = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    documentId: v.id("userDocuments"),
  },
  returns: v.null(),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== user._id) throw new Error("Document not found");

    await deleteUserDocumentCascade(ctx, args.documentId);
    return null;
  },
});

// @ts-ignore TS2589
export const deleteDocuments = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    documentIds: v.array(v.id("userDocuments")),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.object({ deletedCount: v.number() }),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    let deletedCount = 0;
    for (const documentId of args.documentIds) {
      const doc = await ctx.db.get(documentId);
      if (!doc || doc.userId !== user._id) continue;
      await deleteUserDocumentCascade(ctx, documentId);
      deletedCount += 1;
    }

    return { deletedCount };
  },
});

// @ts-ignore TS2589
export const moveDocumentsToFolder = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    documentIds: v.array(v.id("userDocuments")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    folderId: v.optional(v.id("documentFolders")),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.object({ movedCount: v.number() }),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user._id) {
        throw new Error("Folder not found");
      }
    }

    let movedCount = 0;
    for (const documentId of args.documentIds) {
      const doc = await ctx.db.get(documentId);
      if (!doc || doc.userId !== user._id) continue;
      await ctx.db.patch(documentId, {
        folderId: args.folderId,
      });
      movedCount += 1;
    }

    return { movedCount };
  },
});

const MAX_DOC_FOLDERS = 50;

// @ts-ignore TS2589
export const listDocumentFolders = query({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.array(
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    v.object({
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      _id: v.id("documentFolders"),
      _creationTime: v.number(),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      userId: v.id("users"),
      name: v.string(),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      parentId: v.optional(v.id("documentFolders")),
      createdAt: v.number(),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      sortOrder: v.optional(v.number()),
    })
  ),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const access = await getFeatureAccessForUser(ctx, user._id);
    if (!access.features.knowledgeRack) return [];

    return await ctx.db
      .query("documentFolders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// @ts-ignore TS2589
export const createDocumentFolder = mutation({
  args: {
    name: v.string(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    parentId: v.optional(v.id("documentFolders")),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.id("documentFolders"),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const access = await getFeatureAccessForUser(ctx, user._id);
    if (!access.features.knowledgeRack) {
      throw new Error("Document storage is not included in your current plan.");
    }

    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Folder name is required");

    const existing = await ctx.db
      .query("documentFolders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.length >= MAX_DOC_FOLDERS) {
      throw new Error(`Maximum of ${MAX_DOC_FOLDERS} folders reached`);
    }

    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.userId !== user._id) {
        throw new Error("Parent folder not found");
      }
    }

    return await ctx.db.insert("documentFolders", {
      userId: user._id,
      name: trimmed,
      parentId: args.parentId,
      createdAt: Date.now(),
    });
  },
});

// @ts-ignore TS2589
export const renameDocumentFolder = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    folderId: v.id("documentFolders"),
    name: v.string(),
  },
  returns: v.null(),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== user._id) throw new Error("Folder not found");

    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Folder name is required");

    await ctx.db.patch(args.folderId, { name: trimmed });
    return null;
  },
});

// @ts-ignore TS2589
export const deleteDocumentFolder = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    folderId: v.id("documentFolders"),
  },
  returns: v.null(),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== user._id) throw new Error("Folder not found");

    const docInFolder = await ctx.db
      .query("userDocuments")
      .withIndex("by_user_folder", (q) =>
        q.eq("userId", user._id).eq("folderId", args.folderId)
      )
      .first();
    if (docInFolder) {
      throw new Error("FOLDER_NOT_EMPTY");
    }

    const childFolder = await ctx.db
      .query("documentFolders")
      .withIndex("by_user_and_parent", (q) =>
        q.eq("userId", user._id).eq("parentId", args.folderId)
      )
      .first();
    if (childFolder) {
      throw new Error("FOLDER_HAS_SUBFOLDERS");
    }

    await ctx.db.delete(args.folderId);
    return null;
  },
});

// @ts-ignore TS2589
export const getDocumentFolderCounts = query({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.record(v.string(), v.number()),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return {};

    const access = await getFeatureAccessForUser(ctx, user._id);
    if (!access.features.knowledgeRack) return {};

    const docs = await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const counts: Record<string, number> = { uncategorized: 0 };
    for (const doc of docs) {
      if (doc.folderId) {
        const key = doc.folderId as string;
        counts[key] = (counts[key] ?? 0) + 1;
      } else {
        counts.uncategorized += 1;
      }
    }
    return counts;
  },
});


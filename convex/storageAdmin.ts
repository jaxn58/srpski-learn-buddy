/**
 * Admin storage monitoring — platform-wide file storage usage.
 */
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { formatBytes, getUserStorageUsageBytes } from "./storageQuota";
import { deleteStorageBlob } from "./lib/storageHelpers";

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Admin access required");
  }

  return user;
}

/** Convex Professional plan included file storage (reference for warnings). */
const CONVEX_INCLUDED_STORAGE_GB = 100;
const CONVEX_INCLUDED_EGRESS_GB = 50;
/** Break-even hint: migrate to R2 when monthly egress exceeds this (GB). */
export const R2_EGRESS_BREAK_EVEN_GB = 50;

// @ts-ignore TS2589
export const getPlatformStorageOverview = query({
  args: {},
  returns: v.object({
    totalUsedBytes: v.number(),
    totalUsedFormatted: v.string(),
    totalDocuments: v.number(),
    totalChatAttachments: v.number(),
    userCountWithStorage: v.number(),
    includedStorageGb: v.number(),
    percentOfIncluded: v.number(),
    r2BreakEvenNote: v.string(),
    topUsers: v.array(
      v.object({
        userId: v.id("users"),
        email: v.union(v.string(), v.null()),
        name: v.union(v.string(), v.null()),
        usedBytes: v.number(),
        usedFormatted: v.string(),
        documentCount: v.number(),
        attachmentCount: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const usageByUser: Array<{
      userId: (typeof users)[0]["_id"];
      email: string | null;
      name: string | null;
      usedBytes: number;
      documentCount: number;
      attachmentCount: number;
    }> = [];

    let totalUsedBytes = 0;
    let totalDocuments = 0;
    let totalChatAttachments = 0;

    for (const user of users) {
      const docs = await ctx.db
        .query("userDocuments")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const attachmentCount = messages.filter((m) => m.attachmentStorageId).length;

      const usedBytes = await getUserStorageUsageBytes(ctx, user._id);
      if (usedBytes <= 0 && docs.length === 0 && attachmentCount === 0) continue;

      totalUsedBytes += usedBytes;
      totalDocuments += docs.length;
      totalChatAttachments += attachmentCount;

      usageByUser.push({
        userId: user._id,
        email: user.email ?? null,
        name: user.name ?? null,
        usedBytes,
        documentCount: docs.length,
        attachmentCount,
      });
    }

    usageByUser.sort((a, b) => b.usedBytes - a.usedBytes);
    const topUsers = usageByUser.slice(0, 10).map((row) => ({
      ...row,
      usedFormatted: formatBytes(row.usedBytes),
    }));

    const includedBytes = CONVEX_INCLUDED_STORAGE_GB * 1024 * 1024 * 1024;
    const percentOfIncluded = Math.min(
      100,
      Math.round((totalUsedBytes / includedBytes) * 100)
    );

    const r2BreakEvenNote =
      `Convex Professional includes ${CONVEX_INCLUDED_STORAGE_GB} GB storage and ${CONVEX_INCLUDED_EGRESS_GB} GB egress/month. ` +
      `Consider Cloudflare R2 (zero egress fees) when active upload users exceed ~200 or monthly egress consistently exceeds ${R2_EGRESS_BREAK_EVEN_GB} GB.`;

    return {
      totalUsedBytes,
      totalUsedFormatted: formatBytes(totalUsedBytes),
      totalDocuments,
      totalChatAttachments,
      userCountWithStorage: usageByUser.length,
      includedStorageGb: CONVEX_INCLUDED_STORAGE_GB,
      percentOfIncluded,
      r2BreakEvenNote,
      topUsers,
    };
  },
});

function addRef(refs: Set<string>, id: string | undefined | null): void {
  if (id && id.trim()) refs.add(id.trim());
}

/** Collect storage IDs referenced across application tables (avoids deleting in-use blobs). */
async function collectReferencedStorageIds(ctx: MutationCtx): Promise<Set<string>> {
  const refs = new Set<string>();

  const messages = await ctx.db.query("chatMessages").collect();
  for (const message of messages) {
    addRef(refs, message.attachmentStorageId as string | undefined);
  }

  const docs = await ctx.db.query("userDocuments").collect();
  for (const doc of docs) {
    addRef(refs, doc.storageId as string);
  }

  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    addRef(refs, user.publicAvatarStorageId);
  }

  const backups = await ctx.db.query("backupMetadata").collect();
  for (const backup of backups) {
    addRef(refs, backup.storageId);
  }

  const vocab = await ctx.db.query("courseVocabulary").collect();
  for (const row of vocab) {
    addRef(refs, row.audioStorageId);
  }

  const unitAudio = await ctx.db.query("unitContentAudio").collect();
  for (const row of unitAudio) {
    addRef(refs, row.audioStorageId);
  }

  const references = await ctx.db.query("contentStudioReferences").collect();
  for (const ref of references) {
    addRef(refs, ref.storageId);
    if (Array.isArray(ref.pdfFiles)) {
      for (const file of ref.pdfFiles) {
        addRef(refs, file?.storageId);
      }
    }
  }

  return refs;
}

/** Paginated orphan blob cleanup — compares `_storage` against app references. */
export const vacuumOrphanStorage = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    scanned: v.number(),
    orphaned: v.number(),
    deleted: v.number(),
    freedBytes: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const refs = await collectReferencedStorageIds(ctx);

    const page = await ctx.db.system.query("_storage").paginate(args.paginationOpts);

    let orphaned = 0;
    let deleted = 0;
    let freedBytes = 0;

    for (const file of page.page) {
      const id = file._id as Id<"_storage">;
      if (refs.has(id)) continue;
      orphaned += 1;
      const size = typeof file.size === "number" ? file.size : 0;
      if (!dryRun) {
        await deleteStorageBlob(ctx, id);
        deleted += 1;
        freedBytes += size;
      } else {
        freedBytes += size;
      }
    }

    return {
      scanned: page.page.length,
      orphaned,
      deleted: dryRun ? 0 : deleted,
      freedBytes,
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

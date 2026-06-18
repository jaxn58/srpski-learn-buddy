import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getFeatureAccessForUser } from "./featureAccess";
import { assertLearnerAccountActive } from "./authz";

const MAX_FOLDERS = 50;
/** Root folder + one subfolder level only (no nesting deeper than that). */
const MAX_FOLDER_DEPTH = 2;

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (user) {
    assertLearnerAccountActive(user);
  }
  return user;
}

async function requireChatLibraryAccess(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const access = await getFeatureAccessForUser(ctx, userId);
  if (!access.features.chatLibrary) {
    throw new Error("My Library is not included in your current plan.");
  }
}

async function getOwnedFolder(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  folderId: Id<"chatFolders">
): Promise<Doc<"chatFolders">> {
  const folder = await ctx.db.get(folderId);
  if (!folder || folder.userId !== userId) {
    throw new Error("Folder not found");
  }
  return folder;
}

async function folderDepth(
  ctx: QueryCtx | MutationCtx,
  folderId: Id<"chatFolders"> | undefined,
  userId: Id<"users">
): Promise<number> {
  if (!folderId) return 0;
  let depth = 0;
  let currentId: Id<"chatFolders"> | undefined = folderId;
  while (currentId) {
    depth += 1;
    const folder = await getOwnedFolder(ctx, userId, currentId);
    currentId = folder.parentId;
  }
  return depth;
}

const folderDocValidator = v.object({
  _id: v.id("chatFolders"),
  _creationTime: v.number(),
  userId: v.id("users"),
  name: v.string(),
  parentId: v.optional(v.id("chatFolders")),
  createdAt: v.number(),
  sortOrder: v.optional(v.number()),
});

const sessionSummaryValidator = v.object({
  _id: v.id("chatSessions"),
  _creationTime: v.number(),
  title: v.string(),
  folderId: v.optional(v.id("chatFolders")),
  messageCount: v.number(),
  attachmentCount: v.number(),
});

export const listFolders = query({
  args: {},
  returns: v.array(folderDocValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    await requireChatLibraryAccess(ctx, user._id);

    return await ctx.db
      .query("chatFolders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const createFolder = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.id("chatFolders")),
  },
  returns: v.id("chatFolders"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await requireChatLibraryAccess(ctx, user._id);

    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Folder name is required");
    if (trimmed.length > 80) throw new Error("Folder name is too long");

    const existing = await ctx.db
      .query("chatFolders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.length >= MAX_FOLDERS) {
      throw new Error(`Maximum of ${MAX_FOLDERS} folders reached`);
    }

    if (args.parentId) {
      await getOwnedFolder(ctx, user._id, args.parentId);
      const parentDepth = await folderDepth(ctx, args.parentId, user._id);
      if (parentDepth >= MAX_FOLDER_DEPTH) {
        throw new Error(`Maximum folder depth of ${MAX_FOLDER_DEPTH} reached`);
      }
    }

    return await ctx.db.insert("chatFolders", {
      userId: user._id,
      name: trimmed,
      parentId: args.parentId,
      createdAt: Date.now(),
    });
  },
});

export const renameFolder = mutation({
  args: {
    folderId: v.id("chatFolders"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await requireChatLibraryAccess(ctx, user._id);

    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Folder name is required");
    if (trimmed.length > 80) throw new Error("Folder name is too long");

    await getOwnedFolder(ctx, user._id, args.folderId);
    await ctx.db.patch(args.folderId, { name: trimmed });
    return null;
  },
});

async function assertChatFolderDeletable(
  ctx: MutationCtx,
  userId: Id<"users">,
  folderId: Id<"chatFolders">
) {
  const sessions = await ctx.db
    .query("chatSessions")
    .withIndex("by_user_and_folder", (q) => q.eq("userId", userId).eq("folderId", folderId))
    .first();
  if (sessions) {
    throw new Error("FOLDER_NOT_EMPTY");
  }

  const childFolder = await ctx.db
    .query("chatFolders")
    .withIndex("by_user_and_parent", (q) => q.eq("userId", userId).eq("parentId", folderId))
    .first();
  if (childFolder) {
    throw new Error("FOLDER_HAS_SUBFOLDERS");
  }
}

export const deleteFolder = mutation({
  args: {
    folderId: v.id("chatFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await requireChatLibraryAccess(ctx, user._id);

    await getOwnedFolder(ctx, user._id, args.folderId);
    await assertChatFolderDeletable(ctx, user._id, args.folderId);
    await ctx.db.delete(args.folderId);
    return null;
  },
});

export const moveSessionToFolder = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    folderId: v.optional(v.id("chatFolders")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await requireChatLibraryAccess(ctx, user._id);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    if (args.folderId) {
      await getOwnedFolder(ctx, user._id, args.folderId);
    }

    await ctx.db.patch(args.sessionId, { folderId: args.folderId });
    return null;
  },
});

export const moveSessionsToFolder = mutation({
  args: {
    sessionIds: v.array(v.id("chatSessions")),
    folderId: v.optional(v.id("chatFolders")),
  },
  returns: v.object({ movedCount: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await requireChatLibraryAccess(ctx, user._id);

    if (args.folderId) {
      await getOwnedFolder(ctx, user._id, args.folderId);
    }

    let movedCount = 0;
    for (const sessionId of args.sessionIds) {
      const session = await ctx.db.get(sessionId);
      if (!session || session.userId !== user._id || session.archived) continue;
      await ctx.db.patch(sessionId, { folderId: args.folderId });
      movedCount += 1;
    }

    return { movedCount };
  },
});

export const archiveSessions = mutation({
  args: {
    sessionIds: v.array(v.id("chatSessions")),
  },
  returns: v.object({ archivedCount: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await requireChatLibraryAccess(ctx, user._id);

    let archivedCount = 0;
    const now = Date.now();
    for (const sessionId of args.sessionIds) {
      const session = await ctx.db.get(sessionId);
      if (!session || session.userId !== user._id || session.archived) continue;
      await ctx.db.patch(sessionId, { archived: true, archivedAt: now });
      archivedCount += 1;
    }

    return { archivedCount };
  },
});

export const getSessionsByFolder = query({
  args: {
    folderId: v.optional(v.id("chatFolders")),
    archivedOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(sessionSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    await requireChatLibraryAccess(ctx, user._id);

    if (args.folderId) {
      await getOwnedFolder(ctx, user._id, args.folderId);
    }

    let baseQuery;
    if (args.archivedOnly) {
      baseQuery = ctx.db
        .query("chatSessions")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("archived"), true));
    } else if (args.folderId !== undefined) {
      baseQuery = ctx.db
        .query("chatSessions")
        .withIndex("by_user_and_folder", (q) =>
          q.eq("userId", user._id).eq("folderId", args.folderId)
        );
    } else {
      baseQuery = ctx.db
        .query("chatSessions")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) =>
          q.and(
            q.neq(q.field("archived"), true),
            q.eq(q.field("folderId"), undefined)
          )
        );
    }

    const paginated =
      args.archivedOnly
        ? await baseQuery.order("desc").paginate(args.paginationOpts)
        : args.folderId !== undefined
          ? await baseQuery
              .filter((q) => q.neq(q.field("archived"), true))
              .order("desc")
              .paginate(args.paginationOpts)
          : await baseQuery.order("desc").paginate(args.paginationOpts);

    const page = await Promise.all(
      paginated.page.map(async (session) => {
        const messages = await ctx.db
          .query("chatMessages")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        const attachmentCount = messages.filter(
          (m) => m.attachmentStorageId !== undefined
        ).length;
        return {
          _id: session._id,
          _creationTime: session._creationTime,
          title: session.title,
          folderId: session.folderId,
          messageCount: messages.length,
          attachmentCount,
        };
      })
    );

    return {
      page,
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor,
    };
  },
});

export const getFolderSessionCounts = query({
  args: {},
  returns: v.record(v.string(), v.number()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return {};

    await requireChatLibraryAccess(ctx, user._id);

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const counts: Record<string, number> = { uncategorized: 0, __archived__: 0 };
    for (const session of sessions) {
      if (session.archived === true) {
        counts.__archived__ += 1;
      } else if (session.folderId) {
        const key = session.folderId as string;
        counts[key] = (counts[key] ?? 0) + 1;
      } else {
        counts.uncategorized += 1;
      }
    }
    return counts;
  },
});

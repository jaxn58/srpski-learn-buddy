import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Delete a single Convex storage blob; logs and continues on failure. */
export async function deleteStorageBlob(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined
): Promise<void> {
  if (!storageId) return;
  try {
    await ctx.storage.delete(storageId);
  } catch (error) {
    console.warn("[storage] Failed to delete blob", storageId, error);
  }
}

/** Delete attachment blobs referenced by chat messages (deduplicated). */
export async function deleteMessageAttachmentBlobs(
  ctx: MutationCtx,
  messages: Array<Pick<Doc<"chatMessages">, "attachmentStorageId">>
): Promise<number> {
  const seen = new Set<string>();
  let deleted = 0;
  for (const message of messages) {
    const id = message.attachmentStorageId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    await deleteStorageBlob(ctx, id);
    deleted += 1;
  }
  return deleted;
}

/** Delete a user document row, its chunks, and the storage blob. */
export async function deleteUserDocumentCascade(
  ctx: MutationCtx,
  documentId: Id<"userDocuments">
): Promise<void> {
  const doc = await ctx.db.get(documentId);
  if (!doc) return;

  const chunks = await ctx.db
    .query("userDocumentChunks")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();
  for (const chunk of chunks) {
    await ctx.db.delete(chunk._id);
  }

  await deleteStorageBlob(ctx, doc.storageId);
  await ctx.db.delete(documentId);
}

/** Delete all user documents (and blobs) for a user. Returns rows deleted. */
export async function deleteAllUserDocumentsForUser(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<{ documents: number; chunks: number; blobs: number }> {
  const docs = await ctx.db
    .query("userDocuments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  let chunksDeleted = 0;
  let blobsDeleted = 0;
  for (const doc of docs) {
    const chunks = await ctx.db
      .query("userDocumentChunks")
      .withIndex("by_document", (q) => q.eq("documentId", doc._id))
      .collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
      chunksDeleted += 1;
    }
    if (doc.storageId) {
      await deleteStorageBlob(ctx, doc.storageId);
      blobsDeleted += 1;
    }
    await ctx.db.delete(doc._id);
  }

  return { documents: docs.length, chunks: chunksDeleted, blobs: blobsDeleted };
}

/** Delete all document folders for a user. */
export async function deleteAllDocumentFoldersForUser(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<number> {
  const folders = await ctx.db
    .query("documentFolders")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const folder of folders) {
    await ctx.db.delete(folder._id);
  }
  return folders.length;
}

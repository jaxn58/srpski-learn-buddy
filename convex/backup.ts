import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { APP_TABLE_NAMES } from "./schema";

const PAGE_SIZE = 25;
const PAGES_PER_STEP = 8;
const MAX_STEP_BYTES = Math.floor(1.5 * 1024 * 1024);
const STALE_AFTER_MS = 15 * 60 * 1000;
const MANIFEST_VERSION = "2.0.0";

const chunkValidator = v.object({
  storageId: v.string(),
  recordCount: v.number(),
});

const exportedTableValidator = v.object({
  name: v.string(),
  storageId: v.string(),
  recordCount: v.number(),
  chunks: v.optional(v.array(chunkValidator)),
});

type BackupChunk = { storageId: string; recordCount: number };

type ExportedTableFile = {
  name: string;
  storageId: string;
  recordCount: number;
  chunks?: BackupChunk[];
};

type BackupEnvironment = "production" | "development";

function currentBackupEnvironment(): BackupEnvironment {
  const url = process.env.CONVEX_CLOUD_URL ?? "";
  return url.includes("fleet-labrador-324") ? "production" : "development";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Backup failed";
}

function tableFileIds(table: ExportedTableFile): string[] {
  if (table.chunks && table.chunks.length > 0) {
    return table.chunks.map((chunk) => chunk.storageId).filter((id) => id.length > 0);
  }
  return table.storageId ? [table.storageId] : [];
}

async function deleteStorageId(ctx: MutationCtx, storageId: string): Promise<void> {
  if (!storageId) return;
  try {
    await ctx.storage.delete(storageId as Id<"_storage">);
  } catch (error) {
    console.error(`[Backup] Error deleting storage file ${storageId}:`, error);
  }
}

async function deleteBackupFiles(ctx: MutationCtx, backup: Doc<"backupMetadata">): Promise<void> {
  const seen = new Set<string>();
  for (const table of backup.exportedTables ?? []) {
    for (const storageId of tableFileIds(table)) {
      if (storageId !== backup.storageId && !seen.has(storageId)) {
        seen.add(storageId);
        await deleteStorageId(ctx, storageId);
      }
    }
  }
  await deleteStorageId(ctx, backup.storageId);
}

function progressAt(backup: Doc<"backupMetadata">): number {
  return backup.lastProgressAt ?? backup.timestamp;
}

async function failStaleBackupsInCtx(ctx: MutationCtx, now: number): Promise<number> {
  const running = await ctx.db
    .query("backupMetadata")
    .withIndex("by_status", (q) => q.eq("status", "in_progress"))
    .collect();

  let failed = 0;
  for (const backup of running) {
    if (now - progressAt(backup) < STALE_AFTER_MS) continue;
    await deleteBackupFiles(ctx, backup);
    await ctx.db.patch(backup._id, {
      status: "failed",
      storageId: "",
      exportedTables: [],
      pageCursor: null,
      errorMessage: "Backup stopped before it finished",
      lastProgressAt: now,
    });
    failed += 1;
    console.log(`[Backup] Marked stale backup ${backup._id} as failed`);
  }
  return failed;
}

function appendChunk(
  tables: ExportedTableFile[] | undefined,
  tableName: string,
  chunk: BackupChunk
): ExportedTableFile[] {
  const list = (tables ?? []).map((table) => ({
    ...table,
    chunks: table.chunks ? [...table.chunks] : undefined,
  }));
  const index = list.findIndex((table) => table.name === tableName);
  if (index < 0) {
    list.push({
      name: tableName,
      storageId: chunk.storageId,
      recordCount: chunk.recordCount,
      chunks: [chunk],
    });
    return list;
  }
  const current = list[index];
  const chunks =
    current.chunks && current.chunks.length > 0
      ? [...current.chunks, chunk]
      : [{ storageId: current.storageId, recordCount: current.recordCount }, chunk];
  list[index] = {
    ...current,
    recordCount: current.recordCount + chunk.recordCount,
    chunks,
  };
  return list;
}

async function scheduleNextStep(
  ctx: MutationCtx,
  metadataId: Id<"backupMetadata">
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.backup.exportBackupStep, { metadataId });
}

/**
 * Starts a document export and schedules the first step.
 * A fresh in-progress run blocks a second one.
 */
export const createDatabaseBackup = internalAction({
  args: {},
  returns: v.object({
    started: v.boolean(),
    metadataId: v.union(v.id("backupMetadata"), v.null()),
  }),
  handler: async (ctx): Promise<{ started: boolean; metadataId: Id<"backupMetadata"> | null }> => {
    return await ctx.runMutation(internal.backup.beginDatabaseBackup, {});
  },
});

export const beginDatabaseBackup = internalMutation({
  args: {},
  returns: v.object({
    started: v.boolean(),
    metadataId: v.union(v.id("backupMetadata"), v.null()),
  }),
  handler: async (ctx): Promise<{ started: boolean; metadataId: Id<"backupMetadata"> | null }> => {
    const now = Date.now();
    await failStaleBackupsInCtx(ctx, now);

    const running = await ctx.db
      .query("backupMetadata")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .first();
    if (running) {
      console.log(`[Backup] Already running: ${running._id}`);
      return { started: false, metadataId: running._id };
    }

    const metadataId = await ctx.db.insert("backupMetadata", {
      storageId: "",
      timestamp: now,
      environment: currentBackupEnvironment(),
      tableCount: 0,
      expectedTableCount: APP_TABLE_NAMES.length,
      totalRecords: 0,
      size: 0,
      status: "in_progress",
      nextTableIndex: 0,
      pageCursor: null,
      lastProgressAt: now,
      failedTables: [],
      exportedTables: [],
    });
    await scheduleNextStep(ctx, metadataId);
    console.log(`[Backup] Started ${metadataId} for ${APP_TABLE_NAMES.length} tables`);
    return { started: true, metadataId };
  },
});

export const failStaleBackups = internalMutation({
  args: {},
  returns: v.object({ failed: v.number() }),
  handler: async (ctx) => {
    const failed = await failStaleBackupsInCtx(ctx, Date.now());
    return { failed };
  },
});

export const getBackupForExport = internalQuery({
  args: { metadataId: v.id("backupMetadata") },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(
        v.literal("completed"),
        v.literal("failed"),
        v.literal("in_progress"),
        v.literal("partial")
      ),
      nextTableIndex: v.number(),
      pageCursor: v.union(v.string(), v.null()),
      tableCount: v.number(),
      totalRecords: v.number(),
      size: v.number(),
      expectedTableCount: v.number(),
      timestamp: v.number(),
      environment: v.union(v.literal("production"), v.literal("development")),
      failedTables: v.array(v.string()),
      exportedTables: v.array(exportedTableValidator),
    })
  ),
  handler: async (ctx, { metadataId }) => {
    const backup = await ctx.db.get(metadataId);
    if (!backup) return null;
    return {
      status: backup.status,
      nextTableIndex: backup.nextTableIndex ?? 0,
      pageCursor: backup.pageCursor ?? null,
      tableCount: backup.tableCount,
      totalRecords: backup.totalRecords,
      size: backup.size,
      expectedTableCount: backup.expectedTableCount ?? APP_TABLE_NAMES.length,
      timestamp: backup.timestamp,
      environment: backup.environment,
      failedTables: backup.failedTables ?? [],
      exportedTables: backup.exportedTables ?? [],
    };
  },
});

export const commitBackupStep = internalMutation({
  args: {
    metadataId: v.id("backupMetadata"),
    tableName: v.string(),
    chunkStorageId: v.optional(v.string()),
    chunkRecordCount: v.optional(v.number()),
    chunkBytes: v.optional(v.number()),
    tableFinished: v.boolean(),
    nextCursor: v.union(v.string(), v.null()),
    failed: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const backup = await ctx.db.get(args.metadataId);
    if (!backup || backup.status !== "in_progress") return false;

    const now = Date.now();
    const failedTables = [...(backup.failedTables ?? [])];
    let exportedTables = backup.exportedTables ? [...backup.exportedTables] : [];
    let tableCount = backup.tableCount;
    let totalRecords = backup.totalRecords;
    let size = backup.size;
    let nextTableIndex = backup.nextTableIndex ?? 0;
    let pageCursor = args.nextCursor;

    if (args.failed) {
      const current = exportedTables.find((table) => table.name === args.tableName);
      if (current) {
        for (const storageId of tableFileIds(current)) {
          await deleteStorageId(ctx, storageId);
        }
        exportedTables = exportedTables.filter((table) => table.name !== args.tableName);
      }
      if (!failedTables.includes(args.tableName)) failedTables.push(args.tableName);
      nextTableIndex += 1;
      pageCursor = null;
      console.error(`[Backup] Table ${args.tableName} failed: ${args.errorMessage ?? "unknown"}`);
    } else {
      if (args.chunkStorageId && args.chunkRecordCount !== undefined && args.chunkBytes !== undefined) {
        exportedTables = appendChunk(exportedTables, args.tableName, {
          storageId: args.chunkStorageId,
          recordCount: args.chunkRecordCount,
        });
        totalRecords += args.chunkRecordCount;
        size += args.chunkBytes;
      }
      if (args.tableFinished) {
        tableCount += 1;
        nextTableIndex += 1;
        pageCursor = null;
        console.log(`[Backup] Finished table ${args.tableName} (${tableCount} tables)`);
      }
    }

    await ctx.db.patch(args.metadataId, {
      exportedTables,
      failedTables,
      tableCount,
      totalRecords,
      size,
      nextTableIndex,
      pageCursor,
      lastProgressAt: now,
    });
    await scheduleNextStep(ctx, args.metadataId);
    return true;
  },
});

export const completeBackup = internalMutation({
  args: {
    metadataId: v.id("backupMetadata"),
    storageId: v.string(),
    status: v.union(v.literal("completed"), v.literal("partial"), v.literal("failed")),
    size: v.number(),
    errorMessage: v.optional(v.string()),
    backupFormat: v.optional(v.union(v.literal("v1"), v.literal("v2"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const backup = await ctx.db.get(args.metadataId);
    if (!backup || backup.status !== "in_progress") return null;
    await ctx.db.patch(args.metadataId, {
      storageId: args.storageId,
      status: args.status,
      size: args.size,
      pageCursor: null,
      lastProgressAt: Date.now(),
      ...(args.errorMessage !== undefined ? { errorMessage: args.errorMessage } : {}),
      ...(args.backupFormat !== undefined ? { backupFormat: args.backupFormat } : {}),
    });
    return null;
  },
});

type ExportState = {
  status: "completed" | "failed" | "in_progress" | "partial";
  nextTableIndex: number;
  pageCursor: string | null;
  tableCount: number;
  totalRecords: number;
  size: number;
  expectedTableCount: number;
  timestamp: number;
  environment: BackupEnvironment;
  failedTables: string[];
  exportedTables: ExportedTableFile[];
};

async function readTablePiece(
  ctx: { runQuery: (ref: typeof internal.backup.exportTablePage, args: { tableName: string; cursor: string | null; numItems: number }) => Promise<{ page: unknown[]; isDone: boolean; continueCursor: string }> },
  tableName: string,
  cursor: string | null
): Promise<{ json: string; recordCount: number; tableFinished: boolean; nextCursor: string | null }> {
  let records: unknown[] = [];
  let json = "[]";
  let pages = 0;
  let nextCursor = cursor;

  while (pages < PAGES_PER_STEP) {
    const result = await ctx.runQuery(internal.backup.exportTablePage, {
      tableName,
      cursor: nextCursor,
      numItems: PAGE_SIZE,
    });
    pages += 1;
    const combined = records.concat(result.page);
    const combinedJson = JSON.stringify(combined);
    if (combinedJson.length > MAX_STEP_BYTES && records.length > 0) {
      break;
    }
    records = combined;
    json = combinedJson;
    if (result.isDone) {
      return { json, recordCount: records.length, tableFinished: true, nextCursor: null };
    }
    if (!result.continueCursor || result.continueCursor === nextCursor) {
      throw new Error(`Pagination stalled for table ${tableName}`);
    }
    nextCursor = result.continueCursor;
    if (json.length >= MAX_STEP_BYTES) break;
  }

  return { json, recordCount: records.length, tableFinished: false, nextCursor };
}

async function finalizeBackup(
  ctx: {
    storage: { store: (blob: Blob) => Promise<Id<"_storage">> };
    runMutation: (
      ref: typeof internal.backup.completeBackup,
      args: {
        metadataId: Id<"backupMetadata">;
        storageId: string;
        status: "completed" | "partial" | "failed";
        size: number;
        errorMessage?: string;
        backupFormat?: "v2";
      }
    ) => Promise<null>;
  },
  metadataId: Id<"backupMetadata">,
  backup: ExportState
): Promise<void> {
  const failedTables = backup.failedTables;
  const errorMessage =
    failedTables.length > 0 ? `Failed tables: ${failedTables.join(", ")}` : undefined;

  if (backup.exportedTables.length === 0) {
    await ctx.runMutation(internal.backup.completeBackup, {
      metadataId,
      storageId: "",
      status: "failed",
      size: backup.size,
      errorMessage: errorMessage ?? "No table could be exported",
    });
    return;
  }

  const status = failedTables.length > 0 ? "partial" : "completed";
  const manifest = {
    version: MANIFEST_VERSION,
    timestamp: backup.timestamp,
    environment: backup.environment,
    tables: Object.fromEntries(
      backup.exportedTables.map((table) => [
        table.name,
        {
          storageId: table.storageId,
          recordCount: table.recordCount,
          chunks: table.chunks ?? [{ storageId: table.storageId, recordCount: table.recordCount }],
        },
      ])
    ),
    failedTables,
    metadata: {
      tableCount: backup.tableCount,
      expectedTableCount: backup.expectedTableCount,
      totalRecords: backup.totalRecords,
    },
  };
  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const storageId = await ctx.storage.store(manifestBlob);
  await ctx.runMutation(internal.backup.completeBackup, {
    metadataId,
    storageId,
    status,
    size: backup.size + manifestBlob.size,
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    backupFormat: "v2",
  });
  console.log(`[Backup] Finished ${metadataId} as ${status}`);
}

/**
 * Exports one bounded piece of the next table, then schedules the following step.
 */
export const exportBackupStep = internalAction({
  args: { metadataId: v.id("backupMetadata") },
  returns: v.null(),
  handler: async (ctx, { metadataId }): Promise<null> => {
    const backup = await ctx.runQuery(internal.backup.getBackupForExport, { metadataId });
    if (!backup || backup.status !== "in_progress") return null;

    if (backup.nextTableIndex >= APP_TABLE_NAMES.length) {
      await finalizeBackup(ctx, metadataId, backup);
      try {
        const deleted = await ctx.runMutation(internal.backup.deleteOldBackups, {
          retentionDays: 30,
        });
        console.log(`[Backup] Deleted ${deleted.deleted} old backups`);
      } catch (error) {
        console.error("[Backup] Retention cleanup failed:", error);
      }
      return null;
    }

    const tableName = APP_TABLE_NAMES[backup.nextTableIndex];
    if (!tableName) {
      await ctx.runMutation(internal.backup.commitBackupStep, {
        metadataId,
        tableName: `index-${backup.nextTableIndex}`,
        tableFinished: false,
        nextCursor: null,
        failed: true,
        errorMessage: "Table index is out of range",
      });
      return null;
    }

    const currentTable = backup.exportedTables.find(
      (table: ExportedTableFile) => table.name === tableName
    );
    const alreadyHasChunks = currentTable !== undefined && tableFileIds(currentTable).length > 0;
    if ((currentTable?.chunks?.length ?? 0) > 2500) {
      await ctx.runMutation(internal.backup.commitBackupStep, {
        metadataId,
        tableName,
        tableFinished: false,
        nextCursor: null,
        failed: true,
        errorMessage: `Pagination limit reached for table ${tableName}`,
      });
      return null;
    }
    let storedId = "";
    try {
      const piece = await readTablePiece(ctx, tableName, backup.pageCursor);
      const storeChunk = piece.recordCount > 0 || (piece.tableFinished && !alreadyHasChunks);
      let chunkBytes = 0;
      if (storeChunk) {
        const blob = new Blob([piece.json], { type: "application/json" });
        storedId = await ctx.storage.store(blob);
        chunkBytes = blob.size;
      }
      const accepted = await ctx.runMutation(internal.backup.commitBackupStep, {
        metadataId,
        tableName,
        ...(storedId
          ? {
              chunkStorageId: storedId,
              chunkRecordCount: piece.recordCount,
              chunkBytes,
            }
          : {}),
        tableFinished: piece.tableFinished,
        nextCursor: piece.nextCursor,
      });
      if (!accepted && storedId) {
        await ctx.storage.delete(storedId as Id<"_storage">);
      }
    } catch (error) {
      console.error(`[Backup] Error exporting table ${tableName}:`, error);
      if (storedId) {
        try {
          await ctx.storage.delete(storedId as Id<"_storage">);
        } catch (deleteError) {
          console.error(`[Backup] Error deleting chunk ${storedId}:`, deleteError);
        }
      }
      await ctx.runMutation(internal.backup.commitBackupStep, {
        metadataId,
        tableName,
        tableFinished: false,
        nextCursor: null,
        failed: true,
        errorMessage: errorText(error),
      });
    }
    return null;
  },
});

/**
 * One page of a table.
 */
export const exportTablePage = internalQuery({
  args: {
    tableName: v.string(),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { tableName, cursor, numItems }) => {
    const queryTable = ctx.db.query.bind(ctx.db) as (table: string) => {
      paginate: (opts: { numItems: number; cursor: string | null }) => Promise<{
        page: unknown[];
        isDone: boolean;
        continueCursor: string;
      }>;
    };
    const result = await queryTable(tableName).paginate({
      numItems,
      cursor,
    });
    return {
      page: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Deletes backups older than the retention window, including chunk files.
 */
export const deleteOldBackups = internalMutation({
  args: { retentionDays: v.number() },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, { retentionDays }) => {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const oldBackups = await ctx.db
      .query("backupMetadata")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .collect();

    console.log(`[Backup] Found ${oldBackups.length} old backups to delete`);

    for (const backup of oldBackups) {
      await deleteBackupFiles(ctx, backup);
      await ctx.db.delete(backup._id);
    }

    return { deleted: oldBackups.length };
  },
});

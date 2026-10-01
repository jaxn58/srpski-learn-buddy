import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { APP_TABLE_NAMES } from "./schema";

const PAGE_SIZE = 25;
const MAX_PAGES_PER_TABLE = 20000;
const MANIFEST_VERSION = "2.0.0";

type ExportedTableFile = {
  name: string;
  storageId: string;
  recordCount: number;
};

type BackupEnvironment = "production" | "development";

function currentBackupEnvironment(): BackupEnvironment {
  const url = process.env.CONVEX_CLOUD_URL ?? "";
  return url.includes("fleet-labrador-324") ? "production" : "development";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Backup failed";
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
  if (backup.exportedTables) {
    for (const file of backup.exportedTables) {
      if (file.storageId !== backup.storageId) {
        await deleteStorageId(ctx, file.storageId);
      }
    }
  }
  await deleteStorageId(ctx, backup.storageId);
}

/**
 * Exports every schema table.
 * Runs daily at 03:00 UTC via cron.
 * Document rows only. Convex Storage files are covered by the dashboard backup.
 */
export const createDatabaseBackup = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    storageId: v.string(),
    tableCount: v.number(),
    expectedTableCount: v.number(),
    totalRecords: v.number(),
    status: v.union(v.literal("completed"), v.literal("partial"), v.literal("failed")),
    duration: v.number(),
  }),
  handler: async (ctx) => {
    const startTime = Date.now();
    const expectedTableCount = APP_TABLE_NAMES.length;
    console.log(`[Backup] Starting database backup of ${expectedTableCount} tables...`);

    let metadataId: Id<"backupMetadata"> | null = null;
    const storedTableFiles: ExportedTableFile[] = [];
    let manifestStorageId = "";

    try {
      metadataId = await ctx.runMutation(internal.backup.createBackupMetadata, {
        status: "in_progress",
      });
      console.log(`[Backup] Created metadata entry: ${metadataId}`);

      const failedTables: string[] = [];
      let totalRecords = 0;
      let totalSize = 0;

      for (const tableName of APP_TABLE_NAMES) {
        try {
          const records: unknown[] = [];
          let cursor: string | null = null;
          let pages = 0;
          let finished = false;

          while (pages < MAX_PAGES_PER_TABLE) {
            const result: {
              page: unknown[];
              isDone: boolean;
              continueCursor: string;
            } = await ctx.runQuery(internal.backup.exportTablePage, {
              tableName,
              cursor,
              numItems: PAGE_SIZE,
            });
            pages += 1;
            records.push(...result.page);
            if (result.isDone) {
              finished = true;
              break;
            }
            if (!result.continueCursor || result.continueCursor === cursor) {
              throw new Error(`Pagination stalled for table ${tableName}`);
            }
            cursor = result.continueCursor;
          }

          if (!finished) {
            throw new Error(`Pagination limit reached for table ${tableName}`);
          }

          const tableJson = JSON.stringify(records);
          const blob = new Blob([tableJson], { type: "application/json" });
          const storageId = await ctx.storage.store(blob);
          storedTableFiles.push({
            name: tableName,
            storageId,
            recordCount: records.length,
          });
          totalRecords += records.length;
          totalSize += blob.size;
          console.log(`[Backup] Exported ${tableName}: ${records.length} records`);
        } catch (error) {
          console.error(`[Backup] Error exporting table ${tableName}:`, error);
          failedTables.push(tableName);
        }
      }

      const exportedCount = storedTableFiles.length;
      let status: "completed" | "partial" | "failed";
      if (failedTables.length === 0) {
        status = "completed";
      } else if (exportedCount === 0) {
        status = "failed";
      } else {
        status = "partial";
      }

      const errorMessage =
        failedTables.length > 0
          ? `Failed tables: ${failedTables.join(", ")}`
          : undefined;

      if (status === "failed") {
        for (const file of storedTableFiles) {
          await ctx.storage.delete(file.storageId as Id<"_storage">);
        }
        storedTableFiles.length = 0;
        await ctx.runMutation(internal.backup.updateBackupMetadata, {
          metadataId,
          storageId: "",
          tableCount: 0,
          expectedTableCount,
          totalRecords: 0,
          size: 0,
          status,
          errorMessage: errorMessage ?? "No table could be exported",
          failedTables,
        });
      } else {
        const manifest = {
          version: MANIFEST_VERSION,
          timestamp: startTime,
          environment: currentBackupEnvironment(),
          tables: Object.fromEntries(
            storedTableFiles.map((file) => [
              file.name,
              { storageId: file.storageId, recordCount: file.recordCount },
            ])
          ),
          failedTables,
          metadata: {
            tableCount: exportedCount,
            expectedTableCount,
            totalRecords,
          },
        };
        const manifestJson = JSON.stringify(manifest, null, 2);
        const manifestBlob = new Blob([manifestJson], { type: "application/json" });
        manifestStorageId = await ctx.storage.store(manifestBlob);
        totalSize += manifestBlob.size;
        console.log(`[Backup] Stored manifest ${manifestStorageId} (${manifestBlob.size} bytes)`);

        await ctx.runMutation(internal.backup.updateBackupMetadata, {
          metadataId,
          storageId: manifestStorageId,
          tableCount: exportedCount,
          expectedTableCount,
          totalRecords,
          size: totalSize,
          status,
          ...(errorMessage !== undefined ? { errorMessage } : {}),
          failedTables,
          backupFormat: "v2",
          exportedTables: storedTableFiles,
        });
      }

      try {
        const deleted = await ctx.runMutation(internal.backup.deleteOldBackups, {
          retentionDays: 30,
        });
        console.log(`[Backup] Deleted ${deleted.deleted} old backups`);
      } catch (error) {
        console.error("[Backup] Retention cleanup failed:", error);
      }

      const duration = Date.now() - startTime;
      console.log(`[Backup] Finished with status ${status} in ${duration}ms`);

      return {
        success: status !== "failed",
        storageId: manifestStorageId,
        tableCount: status === "failed" ? 0 : storedTableFiles.length,
        expectedTableCount,
        totalRecords: status === "failed" ? 0 : totalRecords,
        status,
        duration,
      };
    } catch (error) {
      console.error("[Backup] Backup failed:", error);
      for (const file of storedTableFiles) {
        try {
          await ctx.storage.delete(file.storageId as Id<"_storage">);
        } catch (deleteError) {
          console.error(`[Backup] Error deleting table file ${file.storageId}:`, deleteError);
        }
      }
      if (manifestStorageId) {
        try {
          await ctx.storage.delete(manifestStorageId as Id<"_storage">);
        } catch (deleteError) {
          console.error(`[Backup] Error deleting manifest ${manifestStorageId}:`, deleteError);
        }
      }
      if (metadataId) {
        try {
          await ctx.runMutation(internal.backup.updateBackupMetadata, {
            metadataId,
            storageId: "",
            tableCount: 0,
            expectedTableCount,
            totalRecords: 0,
            size: 0,
            status: "failed",
            errorMessage: errorText(error),
            failedTables: [],
          });
        } catch (updateError) {
          console.error("[Backup] Failed to mark backup as failed:", updateError);
        }
      }
      throw error;
    }
  },
});

/**
 * One page of a table. The action walks pages so a single table is not loaded with collect().
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

export const createBackupMetadata = internalMutation({
  args: { status: v.union(v.literal("in_progress"), v.literal("completed")) },
  returns: v.id("backupMetadata"),
  handler: async (ctx, { status }) => {
    return await ctx.db.insert("backupMetadata", {
      storageId: "",
      timestamp: Date.now(),
      environment: currentBackupEnvironment(),
      tableCount: 0,
      expectedTableCount: APP_TABLE_NAMES.length,
      totalRecords: 0,
      size: 0,
      status,
    });
  },
});

export const updateBackupMetadata = internalMutation({
  args: {
    metadataId: v.id("backupMetadata"),
    storageId: v.string(),
    tableCount: v.number(),
    expectedTableCount: v.number(),
    totalRecords: v.number(),
    size: v.number(),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("partial")),
    errorMessage: v.optional(v.string()),
    failedTables: v.optional(v.array(v.string())),
    backupFormat: v.optional(v.union(v.literal("v1"), v.literal("v2"))),
    exportedTables: v.optional(
      v.array(
        v.object({
          name: v.string(),
          storageId: v.string(),
          recordCount: v.number(),
        })
      )
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: {
      storageId: string;
      tableCount: number;
      expectedTableCount: number;
      totalRecords: number;
      size: number;
      status: "completed" | "failed" | "partial";
      errorMessage?: string;
      failedTables?: string[];
      backupFormat?: "v1" | "v2";
      exportedTables?: ExportedTableFile[];
    } = {
      storageId: args.storageId,
      tableCount: args.tableCount,
      expectedTableCount: args.expectedTableCount,
      totalRecords: args.totalRecords,
      size: args.size,
      status: args.status,
    };
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.failedTables !== undefined) patch.failedTables = args.failedTables;
    if (args.backupFormat !== undefined) patch.backupFormat = args.backupFormat;
    if (args.exportedTables !== undefined) patch.exportedTables = args.exportedTables;
    await ctx.db.patch(args.metadataId, patch);
    return null;
  },
});

/**
 * Deletes backups older than the retention window, including per-table files of v2 manifests.
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

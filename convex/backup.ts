import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Liste aller Tabellen aus dem Schema
const ALL_TABLES = [
  "users", "userProgress", "vocabularyProgress",
  "exerciseQuestionProgress", "questionProgress",
  "chatSessions", "chatMessages", "exerciseResults", "exerciseCompletions",
  "unitMetadata", "moduleMetadata",
  "unitInteractiveTests", "unitContent",
  "courseVocabulary", "userBadges", "dailyActivity",
  "feedbackSubmissions", "feedbackComments",
  "feedbackStatusHistory", "userSubscriptions", "subscriptionHistory",
  "quizProgress", "emailTemplates", "chatPrompts", "chatPromptHistory",
  "appVersions", "changelogEntries", "onboardingSteps"
] as const;

/**
 * Hauptfunktion: Erstellt Backup aller Tabellen
 * Wird täglich um 3:00 UTC via Cron Job ausgeführt
 */
export const createDatabaseBackup = internalAction({
  handler: async (ctx) => {
    const startTime = Date.now();
    console.log("[Backup] Starting database backup...");
    
    try {
      // 1. Metadata-Eintrag erstellen (in_progress)
      const metadataId = await ctx.runMutation(
        internal.backup.createBackupMetadata,
        { status: "in_progress" }
      );
      console.log(`[Backup] Created metadata entry: ${metadataId}`);

      // 2. Alle Tabellen exportieren
      const backup: Record<string, any[]> = {};
      let totalRecords = 0;

      for (const tableName of ALL_TABLES) {
        try {
          const data = await ctx.runQuery(internal.backup.exportTable, {
            tableName,
          });
          backup[tableName] = data;
          totalRecords += data.length;
          console.log(`[Backup] Exported ${tableName}: ${data.length} records`);
        } catch (error) {
          console.error(`[Backup] Error exporting table ${tableName}:`, error);
          // Continue with other tables even if one fails
          backup[tableName] = [];
        }
      }

      // 3. Backup als JSON in Convex Storage speichern
      const backupData = {
        version: "1.0.0",
        timestamp: startTime,
        environment: process.env.CONVEX_CLOUD_URL?.includes("fleet-labrador-324")
          ? "production"
          : "development",
        tables: backup,
        metadata: {
          tableCount: ALL_TABLES.length,
          totalRecords,
        },
      };

      const backupJson = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupJson], {
        type: "application/json",
      });

      console.log(`[Backup] Storing backup to Convex Storage (${blob.size} bytes)...`);
      const storageId = await ctx.storage.store(blob);
      console.log(`[Backup] Stored with ID: ${storageId}`);

      // 4. Metadata aktualisieren (completed)
      await ctx.runMutation(internal.backup.updateBackupMetadata, {
        metadataId,
        storageId,
        tableCount: ALL_TABLES.length,
        totalRecords,
        size: blob.size,
        status: "completed",
      });

      // 5. Alte Backups löschen (30 Tage Retention)
      const deleted = await ctx.runMutation(internal.backup.deleteOldBackups, {
        retentionDays: 30,
      });
      console.log(`[Backup] Deleted ${deleted.deleted} old backups`);

      const duration = Date.now() - startTime;
      console.log(`[Backup] Completed successfully in ${duration}ms`);

      return {
        success: true,
        storageId,
        tableCount: ALL_TABLES.length,
        totalRecords,
        duration,
      };
    } catch (error) {
      console.error("[Backup] Backup failed:", error);
      throw error;
    }
  },
});

/**
 * Helper: Exportiert eine einzelne Tabelle
 */
export const exportTable = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, { tableName }) => {
    return await ctx.db.query(tableName as any).collect();
  },
});

/**
 * Helper: Erstellt initialen Backup-Metadata Eintrag
 */
export const createBackupMetadata = internalMutation({
  args: { status: v.union(v.literal("in_progress"), v.literal("completed")) },
  handler: async (ctx, { status }) => {
    return await ctx.db.insert("backupMetadata", {
      storageId: "",
      timestamp: Date.now(),
      environment: "production",
      tableCount: 0,
      totalRecords: 0,
      size: 0,
      status,
    });
  },
});

/**
 * Helper: Aktualisiert Backup-Metadata nach erfolgreichem Export
 */
export const updateBackupMetadata = internalMutation({
  args: {
    metadataId: v.id("backupMetadata"),
    storageId: v.string(),
    tableCount: v.number(),
    totalRecords: v.number(),
    size: v.number(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.metadataId, {
      storageId: args.storageId,
      tableCount: args.tableCount,
      totalRecords: args.totalRecords,
      size: args.size,
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

/**
 * Helper: Löscht alte Backups basierend auf Retention Policy
 * Standard: 30 Tage
 */
export const deleteOldBackups = internalMutation({
  args: { retentionDays: v.number() },
  handler: async (ctx, { retentionDays }) => {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    
    const oldBackups = await ctx.db
      .query("backupMetadata")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .collect();

    console.log(`[Backup] Found ${oldBackups.length} old backups to delete`);

    for (const backup of oldBackups) {
      // Storage-Datei löschen
      if (backup.storageId) {
        try {
          await ctx.storage.delete(backup.storageId);
          console.log(`[Backup] Deleted storage file: ${backup.storageId}`);
        } catch (error) {
          console.error(`[Backup] Error deleting storage file ${backup.storageId}:`, error);
        }
      }
      // Metadata löschen
      await ctx.db.delete(backup._id);
    }

    return { deleted: oldBackups.length };
  },
});

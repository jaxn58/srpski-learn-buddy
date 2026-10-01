import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Helper to get the current user and verify admin
async function getAdminUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return null;
  }

  return user;
}

/**
 * Liste alle Backups (Admin only)
 * Zeigt die letzten 100 Backups mit Metadata
 */
export const listBackups = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    return await ctx.db
      .query("backupMetadata")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
  },
});

/**
 * Backup-Download-URL generieren (Admin only)
 * URL ist 1 Stunde gültig
 * NOTE: Dies ist eine Mutation (nicht Query), damit sie in Event Handlers aufgerufen werden kann
 */
export const getBackupUrl = mutation({
  args: { backupId: v.id("backupMetadata") },
  returns: v.union(
    v.null(),
    v.object({
      url: v.string(),
      backupFormat: v.union(v.literal("v1"), v.literal("v2")),
      tables: v.array(
        v.object({
          name: v.string(),
          url: v.string(),
        })
      ),
    })
  ),
  handler: async (ctx, { backupId }) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const backup = await ctx.db.get(backupId);
    if (!backup) throw new Error("Backup not found");
    if (!backup.storageId) throw new Error("Backup file is not available");

    const url = await ctx.storage.getUrl(backup.storageId as Id<"_storage">);
    if (!url) return null;

    if (backup.backupFormat !== "v2") {
      return { url, backupFormat: "v1" as const, tables: [] };
    }

    const tables: { name: string; url: string }[] = [];
    for (const file of backup.exportedTables ?? []) {
      const tableUrl = await ctx.storage.getUrl(file.storageId as Id<"_storage">);
      if (!tableUrl) {
        throw new Error(`Backup file for table ${file.name} is not available`);
      }
      tables.push({ name: file.name, url: tableUrl });
    }

    return { url, backupFormat: "v2" as const, tables };
  },
});

/**
 * Backup manuell auslösen (Superadmin only)
 * Triggert sofort ein Backup ohne auf den Cron Job zu warten
 */
export const triggerBackupNow = mutation({
  handler: async (ctx) => {
    const user = await getAdminUser(ctx);
    if (!user || user.role !== "superadmin") {
      throw new Error("Unauthorized - Superadmin required");
    }

    await ctx.scheduler.runAfter(0, internal.backup.createDatabaseBackup);
    
    return { success: true, message: "Backup triggered" };
  },
});

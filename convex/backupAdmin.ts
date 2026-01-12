import { v } from "convex/values";
import { mutation, query, action, QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
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
  handler: async (ctx, { backupId }) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    const backup = await ctx.db.get(backupId);
    if (!backup) throw new Error("Backup not found");

    // Convex Storage URL generieren (1h gültig)
    const url = await ctx.storage.getUrl(backup.storageId);
    return url;
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

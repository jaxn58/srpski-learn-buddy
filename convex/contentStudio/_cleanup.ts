/**
 * Content Studio — Weekly Cleanup of Archived Preview Rows
 *
 * Purpose:
 *   `internalPublishUnitPackageToPreview` (and the newer split chain in
 *   `_mutations.ts`) archives previous preview rows by patching
 *   `isActive: false` instead of deleting them. That is intentional —
 *   published rows must never be touched. Over time however the
 *   preview-only archived rows accumulate in three tables:
 *     - `courseVocabulary`
 *     - `unitContent`
 *     - `unitInteractiveTests`
 *   Those extra rows are what pushed publish over the Convex system-op
 *   ceiling in prod.
 *
 * This module runs a weekly janitor (Sunday 03:00 UTC, see `convex/crons.ts`)
 * that hard-deletes rows meeting ALL of:
 *   - `isActive === false`
 *   - `releaseStatus !== "published"` (published rows are always preserved)
 *   - `archivedAt < cutoff` (older than the retention window, currently 30d)
 *
 * Implementation:
 *   - An `internalAction` orchestrates the job and iterates each table.
 *   - For each table we page through candidates via an `internalQuery` and
 *     hard-delete the returned ids via an `internalMutation`.
 *   - Batch size and safety limit are configurable per run.
 *
 * Rollback:
 *   Convex keeps a point-in-time restore window. If a mis-run is ever
 *   detected, we can restore the database. The Sunday 03:00 UTC slot was
 *   chosen because traffic is low; that also aligns the deletion timestamp
 *   with an admin-friendly window.
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

// ─── Config ──────────────────────────────────────────────────────────────
const RETENTION_DAYS = 30;
// Batch 500 = ~ 500 reads + 500 delete×indexUpdates per mutation call.
// Faktor 3+ Puffer zum Convex 16 384-op mutation limit even for wide tables.
const CLEANUP_BATCH_SIZE = 500;
// Safety cap so a runaway table can never hog the cron forever.
// 100 * 500 = 50 000 rows deleted per table per weekly run — well beyond
// realistic accumulation for a single week.
const CLEANUP_MAX_BATCHES_PER_TABLE = 100;

const CLEANABLE_TABLES = [
  "courseVocabulary",
  "unitContent",
  "unitInteractiveTests",
] as const;
type CleanableTable = (typeof CLEANABLE_TABLES)[number];

// ─── Shared predicate ────────────────────────────────────────────────────
function shouldDelete(row: any, cutoff: number): boolean {
  if (!row) return false;
  if (row.isActive !== false) return false;
  if (row.releaseStatus === "published") return false;
  const archivedAt = row.archivedAt;
  if (typeof archivedAt !== "number") return false;
  if (archivedAt >= cutoff) return false;
  return true;
}

// ─── Queries: page through candidates ────────────────────────────────────
// Three near-identical queries (one per table) so each returns a
// strongly-typed `Id<"...">` list rather than a stringly-typed union.

// NOTE: `returns:` validators are intentionally omitted on all internal
// queries/mutations in this file. Convex's schema is deep enough (50+ tables)
// that adding explicit `v.array(v.id("..."))` return validators triggers
// TS2589 ("Type instantiation is excessively deep"). Internal functions are
// only invoked from the co-located action below, and the shape is stable, so
// omitting the validator here is acceptable. Callers use explicit return-type
// annotations to preserve inference.
// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
export const internalGetArchivedVocabularyIdsPage = internalQuery({
  args: {
    cutoff: v.number(),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50+ tables)
  handler: async (ctx, args) => {
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
    const page = await ctx.db
      .query("courseVocabulary")
      .paginate({ cursor: args.cursor, numItems: args.limit });
    const rows = page.page as any[];
    const ids = rows
      .filter((row) => shouldDelete(row, args.cutoff))
      .map((row) => row._id as Id<"courseVocabulary">);
    return {
      ids,
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
export const internalGetArchivedContentIdsPage = internalQuery({
  args: {
    cutoff: v.number(),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50+ tables)
  handler: async (ctx, args) => {
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
    const page = await ctx.db
      .query("unitContent")
      .paginate({ cursor: args.cursor, numItems: args.limit });
    const rows = page.page as any[];
    const ids = rows
      .filter((row) => shouldDelete(row, args.cutoff))
      .map((row) => row._id as Id<"unitContent">);
    return {
      ids,
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
export const internalGetArchivedTestsIdsPage = internalQuery({
  args: {
    cutoff: v.number(),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50+ tables)
  handler: async (ctx, args) => {
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
    const page = await ctx.db
      .query("unitInteractiveTests")
      .paginate({ cursor: args.cursor, numItems: args.limit });
    const rows = page.page as any[];
    const ids = rows
      .filter((row) => shouldDelete(row, args.cutoff))
      .map((row) => row._id as Id<"unitInteractiveTests">);
    return {
      ids,
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

// ─── Mutations: delete a small typed batch ───────────────────────────────
// Deletes re-verify the predicate to stay race-safe: if the row was somehow
// reactivated (or its releaseStatus flipped to published) between the query
// and the delete, we skip it.

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
export const internalDeleteVocabularyRows = internalMutation({
  args: {
    ids: v.array(v.id("courseVocabulary")),
    cutoff: v.number(),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50+ tables)
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const id of args.ids) {
      // @ts-ignore TS2589 – Convex schema depth limit (50+ tables)
      const row = await ctx.db.get(id);
      if (!row) continue;
      if (!shouldDelete(row as any, args.cutoff)) continue;
      await ctx.db.delete(id);
      deleted += 1;
    }
    return { deleted };
  },
});

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
export const internalDeleteContentRows = internalMutation({
  args: {
    ids: v.array(v.id("unitContent")),
    cutoff: v.number(),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50+ tables)
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const id of args.ids) {
      // @ts-ignore TS2589 – Convex schema depth limit (50+ tables)
      const row = await ctx.db.get(id);
      if (!row) continue;
      if (!shouldDelete(row as any, args.cutoff)) continue;
      await ctx.db.delete(id);
      deleted += 1;
    }
    return { deleted };
  },
});

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
export const internalDeleteTestsRows = internalMutation({
  args: {
    ids: v.array(v.id("unitInteractiveTests")),
    cutoff: v.number(),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50+ tables)
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const id of args.ids) {
      // @ts-ignore TS2589 – Convex schema depth limit (50+ tables)
      const row = await ctx.db.get(id);
      if (!row) continue;
      if (!shouldDelete(row as any, args.cutoff)) continue;
      await ctx.db.delete(id);
      deleted += 1;
    }
    return { deleted };
  },
});

// ─── Orchestrator (weekly cron entry point) ───────────────────────────────

// Return shape of the paginating internal queries. Duplicated as an explicit
// type because the `returns:` validator on the queries was removed to avoid
// TS2589 depth issues (see note above).
type IdsPage<TableName extends "courseVocabulary" | "unitContent" | "unitInteractiveTests"> = {
  ids: Id<TableName>[];
  continueCursor: string | null;
  isDone: boolean;
};

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
export const internalCleanupArchivedContent = internalAction({
  args: {
    // Optional overrides for manual runs during rollout / debugging.
    retentionDaysOverride: v.optional(v.number()),
    batchSizeOverride: v.optional(v.number()),
    maxBatchesOverride: v.optional(v.number()),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50+ tables)
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const retentionDays = Math.max(1, args.retentionDaysOverride ?? RETENTION_DAYS);
    const batchSize = Math.max(1, args.batchSizeOverride ?? CLEANUP_BATCH_SIZE);
    const maxBatches = Math.max(1, args.maxBatchesOverride ?? CLEANUP_MAX_BATCHES_PER_TABLE);
    const cutoff = startedAt - retentionDays * 24 * 60 * 60 * 1000;

    const results: Array<{
      table: string;
      deleted: number;
      batchesRun: number;
      hitBatchLimit: boolean;
    }> = [];

    for (const table of CLEANABLE_TABLES) {
      let deleted = 0;
      let batchesRun = 0;
      let cursor: string | null = null;
      let isDone = false;

      while (!isDone && batchesRun < maxBatches) {
        batchesRun += 1;
        if (table === "courseVocabulary") {
          // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
          const page: IdsPage<"courseVocabulary"> = await ctx.runQuery(
            internal.contentStudio._cleanup.internalGetArchivedVocabularyIdsPage,
            { cutoff, cursor, limit: batchSize },
          );
          if (page.ids.length > 0) {
            // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
            const res: { deleted: number } = await ctx.runMutation(
              internal.contentStudio._cleanup.internalDeleteVocabularyRows,
              { ids: page.ids, cutoff },
            );
            deleted += res.deleted;
          }
          cursor = page.continueCursor;
          isDone = page.isDone;
        } else if (table === "unitContent") {
          // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
          const page: IdsPage<"unitContent"> = await ctx.runQuery(
            internal.contentStudio._cleanup.internalGetArchivedContentIdsPage,
            { cutoff, cursor, limit: batchSize },
          );
          if (page.ids.length > 0) {
            // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
            const res: { deleted: number } = await ctx.runMutation(
              internal.contentStudio._cleanup.internalDeleteContentRows,
              { ids: page.ids, cutoff },
            );
            deleted += res.deleted;
          }
          cursor = page.continueCursor;
          isDone = page.isDone;
        } else {
          // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
          const page: IdsPage<"unitInteractiveTests"> = await ctx.runQuery(
            internal.contentStudio._cleanup.internalGetArchivedTestsIdsPage,
            { cutoff, cursor, limit: batchSize },
          );
          if (page.ids.length > 0) {
            // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50+ tables)
            const res: { deleted: number } = await ctx.runMutation(
              internal.contentStudio._cleanup.internalDeleteTestsRows,
              { ids: page.ids, cutoff },
            );
            deleted += res.deleted;
          }
          cursor = page.continueCursor;
          isDone = page.isDone;
        }
      }

      const hitBatchLimit = !isDone && batchesRun >= maxBatches;
      if (hitBatchLimit) {
        console.warn(
          `[Cleanup] ${table}: hit safety batch limit of ${maxBatches} — ${deleted} rows deleted this run, ` +
            `remainder will be picked up next week.`,
        );
      }
      console.log(`[Cleanup] ${table}: ${deleted} rows deleted in ${batchesRun} batch(es).`);
      results.push({ table, deleted, batchesRun, hitBatchLimit });
    }

    const completedAt = Date.now();
    console.log(
      `[Cleanup] Done. Total ${(completedAt - startedAt) / 1000}s. ` +
        `Retention=${retentionDays}d, cutoff=${new Date(cutoff).toISOString()}.`,
    );
    return { startedAt, completedAt, cutoff, results };
  },
});

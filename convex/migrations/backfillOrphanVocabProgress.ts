/**
 * One-time backfill: repoint orphaned vocabularyProgress rows whose
 * courseVocabularyId points to an inactive/archived vocabulary entry
 * onto the latest active published row with the same (unitNumber, serbian key).
 *
 * Run in Dev:
 *   npx convex run migrations/backfillOrphanVocabProgress:run
 *
 * Dry-run (default):
 *   npx convex run migrations/backfillOrphanVocabProgress:run '{"dryRun":true}'
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  findLatestPublishedVocabForKey,
  mergeOrRepointVocabularyProgress,
  replaceVocabIdInQuizProgressForUnit,
  vocabularySerbianKey,
} from "../contentStudio/_vocabularyProgressRemap";

const BATCH_SIZE = 25;

export const run = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    repointed: v.number(),
    merged: v.number(),
    skipped: v.number(),
    notFound: v.number(),
    quizProgressUpdated: v.number(),
    processed: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;

    let repointed = 0;
    let merged = 0;
    let skipped = 0;
    let notFound = 0;
    let quizProgressUpdated = 0;
    let processed = 0;

    const targetCache = new Map<string, Id<"courseVocabulary"> | null>();
    const quizRemapDone = new Set<string>();

    const page = await ctx.db
      .query("vocabularyProgress")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    for (const prog of page.page) {
      processed += 1;
      const vocab = await ctx.db.get("courseVocabulary", prog.courseVocabularyId);
      if (!vocab) {
        notFound += 1;
        continue;
      }

      const isActivePublished =
        vocab.isActive !== false &&
        vocab.releaseStatus !== "preview" &&
        vocab.releaseStatus !== "offline";

      if (isActivePublished) {
        skipped += 1;
        continue;
      }

      const serbianKey = vocabularySerbianKey(vocab);
      const cacheKey = `${vocab.unitNumber}:${serbianKey}`;
      let targetId = targetCache.get(cacheKey);
      if (targetId === undefined) {
        targetId = await findLatestPublishedVocabForKey(
          ctx,
          vocab.unitNumber,
          serbianKey,
        );
        targetCache.set(cacheKey, targetId);
      }

      if (!targetId || targetId === prog.courseVocabularyId) {
        notFound += 1;
        continue;
      }

      if (dryRun) {
        const existing = await ctx.db
          .query("vocabularyProgress")
          .withIndex("by_user_course_vocab", (q) =>
            q.eq("userId", prog.userId).eq("courseVocabularyId", targetId),
          )
          .first();
        if (existing && existing._id !== prog._id) {
          merged += 1;
        } else {
          repointed += 1;
        }
        continue;
      }

      const result = await mergeOrRepointVocabularyProgress(
        ctx,
        prog.courseVocabularyId,
        targetId,
      );
      repointed += result.repointed;
      merged += result.merged;

      const quizKey = `${vocab.unitNumber}:${prog.courseVocabularyId}:${targetId}`;
      if (!quizRemapDone.has(quizKey)) {
        quizRemapDone.add(quizKey);
        quizProgressUpdated += await replaceVocabIdInQuizProgressForUnit(
          ctx,
          vocab.unitNumber,
          prog.courseVocabularyId,
          targetId,
        );
      }
    }

    return {
      dryRun,
      repointed,
      merged,
      skipped,
      notFound,
      quizProgressUpdated,
      processed,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * Convenience wrapper: runs ONE batch only. Re-invoke with continueCursor until isDone.
 * Example loop (PowerShell):
 *   $cursor = $null; do { ... } while (-not $result.isDone)
 */
export const runAll = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    repointed: v.number(),
    merged: v.number(),
    skipped: v.number(),
    notFound: v.number(),
    quizProgressUpdated: v.number(),
    processed: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Delegate to single-batch run (same args/returns).
    const dryRun = args.dryRun !== false;

    let repointed = 0;
    let merged = 0;
    let skipped = 0;
    let notFound = 0;
    let quizProgressUpdated = 0;
    let processed = 0;

    const targetCache = new Map<string, Id<"courseVocabulary"> | null>();
    const quizRemapDone = new Set<string>();

    const page = await ctx.db
      .query("vocabularyProgress")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    for (const prog of page.page) {
      processed += 1;
      const vocab = await ctx.db.get("courseVocabulary", prog.courseVocabularyId);
      if (!vocab) {
        notFound += 1;
        continue;
      }

      const isActivePublished =
        vocab.isActive !== false &&
        vocab.releaseStatus !== "preview" &&
        vocab.releaseStatus !== "offline";

      if (isActivePublished) {
        skipped += 1;
        continue;
      }

      const serbianKey = vocabularySerbianKey(vocab);
      const cacheKey = `${vocab.unitNumber}:${serbianKey}`;
      let targetId = targetCache.get(cacheKey);
      if (targetId === undefined) {
        targetId = await findLatestPublishedVocabForKey(
          ctx,
          vocab.unitNumber,
          serbianKey,
        );
        targetCache.set(cacheKey, targetId);
      }

      if (!targetId || targetId === prog.courseVocabularyId) {
        notFound += 1;
        continue;
      }

      if (dryRun) {
        const existing = await ctx.db
          .query("vocabularyProgress")
          .withIndex("by_user_course_vocab", (q) =>
            q.eq("userId", prog.userId).eq("courseVocabularyId", targetId),
          )
          .first();
        if (existing && existing._id !== prog._id) {
          merged += 1;
        } else {
          repointed += 1;
        }
        continue;
      }

      const result = await mergeOrRepointVocabularyProgress(
        ctx,
        prog.courseVocabularyId,
        targetId,
      );
      repointed += result.repointed;
      merged += result.merged;

      const quizKey = `${vocab.unitNumber}:${prog.courseVocabularyId}:${targetId}`;
      if (!quizRemapDone.has(quizKey)) {
        quizRemapDone.add(quizKey);
        quizProgressUpdated += await replaceVocabIdInQuizProgressForUnit(
          ctx,
          vocab.unitNumber,
          prog.courseVocabularyId,
          targetId,
        );
      }
    }

    return {
      dryRun,
      repointed,
      merged,
      skipped,
      notFound,
      quizProgressUpdated,
      processed,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

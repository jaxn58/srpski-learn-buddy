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
import {
  findLatestPublishedVocabForKey,
  mergeOrRepointVocabularyProgress,
  replaceVocabIdInQuizProgressForUnit,
  vocabularySerbianKey,
} from "../contentStudio/_vocabularyProgressRemap";

const BATCH_SIZE = 100;

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
      const targetId = await findLatestPublishedVocabForKey(
        ctx,
        vocab.unitNumber,
        serbianKey,
      );

      if (!targetId || targetId === prog.courseVocabularyId) {
        notFound += 1;
        continue;
      }

      if (dryRun) {
        // Count what would happen without writing.
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

      const quizUpdated = await replaceVocabIdInQuizProgressForUnit(
        ctx,
        vocab.unitNumber,
        prog.courseVocabularyId,
        targetId,
      );
      quizProgressUpdated += quizUpdated;
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
 * Convenience wrapper: runs all batches until done.
 * Invoke via CLI with dryRun:false after verifying a single batch.
 */
export const runAll = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    repointed: v.number(),
    merged: v.number(),
    skipped: v.number(),
    notFound: v.number(),
    quizProgressUpdated: v.number(),
    totalProcessed: v.number(),
    batches: v.number(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;
    let cursor: string | null = null;
    let batches = 0;
    const totals = {
      repointed: 0,
      merged: 0,
      skipped: 0,
      notFound: 0,
      quizProgressUpdated: 0,
      totalProcessed: 0,
    };

    // Safety cap: 10 000 batches x 100 rows = 1 M rows max.
    for (let i = 0; i < 10_000; i++) {
      const page = await ctx.db
        .query("vocabularyProgress")
        .paginate({ numItems: BATCH_SIZE, cursor });

      for (const prog of page.page) {
        totals.totalProcessed += 1;
        const vocab = await ctx.db.get("courseVocabulary", prog.courseVocabularyId);
        if (!vocab) {
          totals.notFound += 1;
          continue;
        }

        const isActivePublished =
          vocab.isActive !== false &&
          vocab.releaseStatus !== "preview" &&
          vocab.releaseStatus !== "offline";

        if (isActivePublished) {
          totals.skipped += 1;
          continue;
        }

        const serbianKey = vocabularySerbianKey(vocab);
        const targetId = await findLatestPublishedVocabForKey(
          ctx,
          vocab.unitNumber,
          serbianKey,
        );

        if (!targetId || targetId === prog.courseVocabularyId) {
          totals.notFound += 1;
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
            totals.merged += 1;
          } else {
            totals.repointed += 1;
          }
          continue;
        }

        const result = await mergeOrRepointVocabularyProgress(
          ctx,
          prog.courseVocabularyId,
          targetId,
        );
        totals.repointed += result.repointed;
        totals.merged += result.merged;

        totals.quizProgressUpdated += await replaceVocabIdInQuizProgressForUnit(
          ctx,
          vocab.unitNumber,
          prog.courseVocabularyId,
          targetId,
        );
      }

      batches += 1;
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { dryRun, ...totals, batches };
  },
});

/**
 * One-time cleanup: find active courseVocabulary rows that are duplicates
 * (same serbianNormalized + unitNumber) and archive all but the newest.
 *
 * Run in Dev:
 *   npx convex run migrations/deduplicateVocabulary:run
 *
 * Dry-run (default):
 *   npx convex run migrations/deduplicateVocabulary:run '{"dryRun":true}'
 *
 * After verifying dry-run output, execute:
 *   npx convex run migrations/deduplicateVocabulary:run '{"dryRun":false}'
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const run = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    totalActive: v.number(),
    duplicateGroups: v.number(),
    archived: v.number(),
    progressRemapped: v.number(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;

    const all = await ctx.db.query("courseVocabulary").collect();
    const active = all.filter(
      (v) => v.isActive !== false && (v as any).releaseStatus !== "offline",
    );

    // Group by (serbianNormalized, unitNumber)
    const groups: Record<string, typeof active> = Object.create(null);
    for (const row of active) {
      const norm =
        (row as any).serbianNormalized ||
        String(row.serbian || "").toLowerCase().trim();
      const key = `${norm}__u${row.unitNumber}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    let duplicateGroups = 0;
    let archived = 0;
    let progressRemapped = 0;

    for (const key of Object.keys(groups)) {
      const entries = groups[key];
      if (entries.length <= 1) continue;
      duplicateGroups += 1;

      // Keep the one with the highest unitVersion, or if tied, the one with
      // releaseStatus "published", or as last resort the most recently created (_id ordering).
      entries.sort((a, b) => {
        const vA = (a as any).unitVersion ?? 0;
        const vB = (b as any).unitVersion ?? 0;
        if (vB !== vA) return vB - vA;

        const sA = (a as any).releaseStatus === "published" ? 1 : 0;
        const sB = (b as any).releaseStatus === "published" ? 1 : 0;
        if (sB !== sA) return sB - sA;

        return String(b._id).localeCompare(String(a._id));
      });

      const keeper = entries[0];
      const toArchive = entries.slice(1);

      for (const dup of toArchive) {
        if (!dryRun) {
          // Remap any vocabularyProgress pointing to the duplicate onto the keeper
          const progressRows = await ctx.db
            .query("vocabularyProgress")
            .withIndex("by_course_vocab", (q) =>
              q.eq("courseVocabularyId", dup._id),
            )
            .collect();

          for (const prog of progressRows) {
            // Check if keeper already has progress for this user
            const existingForKeeper = await ctx.db
              .query("vocabularyProgress")
              .withIndex("by_course_vocab", (q) =>
                q.eq("courseVocabularyId", keeper._id),
              )
              .collect();
            const userExisting = existingForKeeper.find(
              (p) => p.userId === prog.userId,
            );

            if (userExisting) {
              // Merge progress: take the MAXIMUM of each metric to preserve
              // all user effort (correct answers, reviews, mastery).
              const keeperCorrect = userExisting.correctAnswerCount ?? 0;
              const dupCorrect = prog.correctAnswerCount ?? 0;
              const keeperIncorrect = userExisting.incorrectAnswerCount ?? 0;
              const dupIncorrect = prog.incorrectAnswerCount ?? 0;
              const keeperReviews = (userExisting as any).reviewCount ?? 0;
              const dupReviews = (prog as any).reviewCount ?? 0;

              const mergedCorrect = Math.max(keeperCorrect, dupCorrect);
              const mergedIncorrect = keeperIncorrect + dupIncorrect;
              const mergedReviews = keeperReviews + dupReviews;
              const mergedMastered = mergedCorrect >= 3;

              await ctx.db.patch(userExisting._id, {
                correctAnswerCount: mergedCorrect,
                incorrectAnswerCount: mergedIncorrect,
                mastered: mergedMastered,
                reviewCount: mergedReviews,
                lastAnsweredAt: Math.max(
                  (userExisting as any).lastAnsweredAt ?? 0,
                  (prog as any).lastAnsweredAt ?? 0,
                ) || undefined,
                lastReviewedAt: Math.max(
                  (userExisting as any).lastReviewedAt ?? 0,
                  (prog as any).lastReviewedAt ?? 0,
                ) || undefined,
              } as any);
              await ctx.db.delete(prog._id);
            } else {
              // No conflict: repoint to keeper
              await ctx.db.patch(prog._id, {
                courseVocabularyId: keeper._id as Id<"courseVocabulary">,
              } as any);
            }
            progressRemapped += 1;
          }

          await ctx.db.patch(dup._id, {
            isActive: false,
            archivedAt: Date.now(),
          } as any);
        }
        archived += 1;
      }
    }

    if (dryRun) {
      console.log(
        `[DRY RUN] Would archive ${archived} duplicate(s) across ${duplicateGroups} group(s). ` +
          `Progress rows to remap: estimated based on groups.`,
      );
    } else {
      console.log(
        `[EXECUTED] Archived ${archived} duplicate(s) across ${duplicateGroups} group(s). ` +
          `Remapped ${progressRemapped} progress row(s).`,
      );
    }

    return {
      dryRun,
      totalActive: active.length,
      duplicateGroups,
      archived,
      progressRemapped,
    };
  },
});

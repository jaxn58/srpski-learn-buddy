import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export function vocabularySerbianKey(entry: {
  serbian?: string;
  serbianNormalized?: string;
}): string {
  return String(entry.serbianNormalized ?? entry.serbian ?? "")
    .toLowerCase()
    .trim();
}

export type VocabProgressRemapResult = {
  repointed: number;
  merged: number;
  quizProgressUpdated: number;
};

/**
 * Remap vocabularyProgress rows from an old courseVocabulary _id to a new one.
 * When the user already has progress on the target id, counters are merged using
 * max/or semantics so mastery is preserved without inflating counts.
 */
export async function mergeOrRepointVocabularyProgress(
  ctx: MutationCtx,
  fromVocabId: Id<"courseVocabulary">,
  toVocabId: Id<"courseVocabulary">,
): Promise<{ repointed: number; merged: number }> {
  let repointed = 0;
  let merged = 0;

  const progressRows = await ctx.db
    .query("vocabularyProgress")
    .withIndex("by_course_vocab", (q) => q.eq("courseVocabularyId", fromVocabId))
    .collect();

  for (const prog of progressRows) {
    const existing = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user_course_vocab", (q) =>
        q.eq("userId", prog.userId).eq("courseVocabularyId", toVocabId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        correctAnswerCount: Math.max(
          existing.correctAnswerCount,
          prog.correctAnswerCount,
        ),
        incorrectAnswerCount: Math.max(
          existing.incorrectAnswerCount,
          prog.incorrectAnswerCount,
        ),
        reviewCount: Math.max(existing.reviewCount, prog.reviewCount),
        mastered: existing.mastered || prog.mastered,
        lastAnsweredAt:
          Math.max(existing.lastAnsweredAt ?? 0, prog.lastAnsweredAt ?? 0) ||
          undefined,
        lastReviewedAt:
          Math.max(existing.lastReviewedAt ?? 0, prog.lastReviewedAt ?? 0) ||
          undefined,
      });
      await ctx.db.delete(prog._id);
      merged += 1;
    } else {
      await ctx.db.patch(prog._id, { courseVocabularyId: toVocabId });
      repointed += 1;
    }
  }

  return { repointed, merged };
}

/**
 * Replace occurrences of fromVocabId with toVocabId in quizProgress.incorrectVocabularyIds
 * for all users who have quiz progress on the given unit.
 */
export async function replaceVocabIdInQuizProgressForUnit(
  ctx: MutationCtx,
  unitNumber: number,
  fromVocabId: Id<"courseVocabulary">,
  toVocabId: Id<"courseVocabulary">,
): Promise<number> {
  let updated = 0;
  const qzRows = await ctx.db
    .query("quizProgress")
    .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
    .collect();

  for (const row of qzRows) {
    const ids = row.incorrectVocabularyIds;
    if (!ids || ids.length === 0) continue;
    if (!ids.some((id) => id === fromVocabId)) continue;

    const nextIds = ids.map((id) => (id === fromVocabId ? toVocabId : id));
    const deduped = Array.from(new Set(nextIds.map(String))).map(
      (id) => id as Id<"courseVocabulary">,
    );

    await ctx.db.patch(row._id, { incorrectVocabularyIds: deduped });
    updated += 1;
  }

  return updated;
}

/**
 * Full remap for one old -> new vocabulary id pair during EN update promote.
 */
export async function remapVocabularyProgressForPromotedEntry(
  ctx: MutationCtx,
  args: {
    unitNumber: number;
    fromVocabId: Id<"courseVocabulary">;
    toVocabId: Id<"courseVocabulary">;
  },
): Promise<VocabProgressRemapResult> {
  const { repointed, merged } = await mergeOrRepointVocabularyProgress(
    ctx,
    args.fromVocabId,
    args.toVocabId,
  );
  const quizProgressUpdated = await replaceVocabIdInQuizProgressForUnit(
    ctx,
    args.unitNumber,
    args.fromVocabId,
    args.toVocabId,
  );

  return { repointed, merged, quizProgressUpdated };
}

/**
 * Find the best active published courseVocabulary row for a given
 * (unitNumber, serbianNormalized) key — highest unitVersion wins.
 */
export async function findLatestPublishedVocabForKey(
  ctx: MutationCtx,
  unitNumber: number,
  serbianKey: string,
): Promise<Id<"courseVocabulary"> | null> {
  if (!serbianKey) return null;

  const rows = await ctx.db
    .query("courseVocabulary")
    .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
    .collect();

  let best: { _id: Id<"courseVocabulary">; unitVersion: number } | null = null;

  for (const row of rows) {
    if (row.isActive === false) continue;
    const status = row.releaseStatus;
    if (status === "preview" || status === "offline") continue;

    const key = vocabularySerbianKey(row);
    if (key !== serbianKey) continue;

    const version = row.unitVersion ?? 1;
    if (!best || version > best.unitVersion) {
      best = { _id: row._id, unitVersion: version };
    }
  }

  return best?._id ?? null;
}

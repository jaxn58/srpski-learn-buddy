import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { isPreviewStatus, isPublishedStatus } from "./_shared";

type ReadCtx = QueryCtx | MutationCtx;

export const OVERVIEW_LANGUAGES = ["en", "de"] as const;
export type OverviewLanguage = (typeof OVERVIEW_LANGUAGES)[number];

export type UnitOverviewLangCounts = {
  sectionCount: number;
  testCount: number;
  vocabCount: number;
  latestContentUpdatedAt?: number;
};

export type UnitOverviewCounts = {
  en: UnitOverviewLangCounts;
  de: UnitOverviewLangCounts | null;
};

type SchedulerCtx = {
  scheduler: MutationCtx["scheduler"];
};

// Active, non-offline rows. Published and preview both count for the admin overview.
export function isVisibleForAdmin(row: {
  isActive?: boolean;
  releaseStatus?: string;
}): boolean {
  if (row.isActive === false) return false;
  if (row.releaseStatus === "offline") return false;
  return true;
}

async function countLanguageContent(
  ctx: ReadCtx,
  unitNumber: number,
  language: OverviewLanguage,
  vocabCount: number,
): Promise<UnitOverviewLangCounts> {
  const contentRows = await ctx.db
    .query("unitContent")
    .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
    .collect();

  const bestByType = new Map<string, Doc<"unitContent">>();
  for (const row of contentRows) {
    if (!isVisibleForAdmin(row)) continue;
    const type = String(row.contentType);
    const prev = bestByType.get(type);
    if (!prev) {
      bestByType.set(type, row);
      continue;
    }
    const rowPrio = isPreviewStatus(row.releaseStatus) ? 2 : 1;
    const prevPrio = isPreviewStatus(prev.releaseStatus) ? 2 : 1;
    const rowVersion = row.unitVersion ?? 1;
    const prevVersion = prev.unitVersion ?? 1;
    if (rowPrio > prevPrio || (rowPrio === prevPrio && rowVersion > prevVersion)) {
      bestByType.set(type, row);
    }
  }

  const testRows = await ctx.db
    .query("unitInteractiveTests")
    .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
    .collect();
  const eligibleTests = testRows.filter((row) => isVisibleForAdmin(row));
  const hasPreviewTests = eligibleTests.some((row) => isPreviewStatus(row.releaseStatus));
  const testPool = hasPreviewTests
    ? eligibleTests.filter((row) => isPreviewStatus(row.releaseStatus))
    : eligibleTests.filter((row) => isPublishedStatus(row.releaseStatus));
  const maxTestVersion = testPool.reduce((max, row) => Math.max(max, Number(row.unitVersion ?? 1) || 1), 1);
  const testCount = testPool.filter((row) => (Number(row.unitVersion ?? 1) || 1) === maxTestVersion).length;

  let latestContentUpdatedAt: number | undefined;
  for (const row of bestByType.values()) {
    const stamp = Number(row.updatedAt ?? row._creationTime ?? 0);
    if (stamp > (latestContentUpdatedAt ?? 0)) latestContentUpdatedAt = stamp;
  }

  return {
    sectionCount: bestByType.size,
    testCount,
    vocabCount,
    ...(latestContentUpdatedAt !== undefined ? { latestContentUpdatedAt } : {}),
  };
}

/**
 * Same counts the Unit Manager overview used to compute inline.
 * Vocabulary is read once per unit. German is omitted when it has no visible content.
 */
export async function computeUnitOverviewCounts(ctx: ReadCtx, unitNumber: number): Promise<UnitOverviewCounts> {
  const vocabRows = await ctx.db
    .query("courseVocabulary")
    .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
    .collect();

  const bestVocabByKey = new Map<string, Doc<"courseVocabulary">>();
  for (const row of vocabRows) {
    if (!isVisibleForAdmin(row)) continue;
    const key = String(row.serbianNormalized ?? row.serbian ?? "").trim().toLowerCase();
    if (!key) continue;
    const prev = bestVocabByKey.get(key);
    if (!prev) {
      bestVocabByKey.set(key, row);
      continue;
    }
    const rowPrio = isPreviewStatus(row.releaseStatus) ? 2 : 1;
    const prevPrio = isPreviewStatus(prev.releaseStatus) ? 2 : 1;
    const rowVersion = Number(row.unitVersion ?? 1) || 1;
    const prevVersion = Number(prev.unitVersion ?? 1) || 1;
    if (rowPrio > prevPrio || (rowPrio === prevPrio && rowVersion > prevVersion)) {
      bestVocabByKey.set(key, row);
    }
  }

  const enVocabCount = bestVocabByKey.size;
  const deVocabCount = [...bestVocabByKey.values()].filter(
    (row) => typeof row.de === "string" && row.de.trim().length > 0,
  ).length;

  const en = await countLanguageContent(ctx, unitNumber, "en", enVocabCount);
  const deCounts = await countLanguageContent(ctx, unitNumber, "de", deVocabCount);
  const de =
    deCounts.sectionCount === 0 && deCounts.testCount === 0 && deCounts.vocabCount === 0 ? null : deCounts;
  return { en, de };
}

async function persistUnitOverviewDigest(ctx: MutationCtx, unitNumber: number, counts: UnitOverviewCounts): Promise<void> {
  const now = Date.now();
  for (const language of OVERVIEW_LANGUAGES) {
    const existing = await ctx.db
      .query("unitOverviewDigest")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .unique();
    const langCounts = counts[language];
    if (!langCounts) {
      if (existing) await ctx.db.delete(existing._id);
      continue;
    }
    const doc = {
      unitNumber,
      language,
      sectionCount: langCounts.sectionCount,
      testCount: langCounts.testCount,
      vocabCount: langCounts.vocabCount,
      updatedAt: now,
      ...(langCounts.latestContentUpdatedAt !== undefined
        ? { latestContentUpdatedAt: langCounts.latestContentUpdatedAt }
        : {}),
    };
    if (existing) {
      await ctx.db.replace(existing._id, doc);
    } else {
      await ctx.db.insert("unitOverviewDigest", doc);
    }
  }
}

export async function deleteUnitOverviewDigest(ctx: MutationCtx, unitNumber: number): Promise<void> {
  const rows = await ctx.db
    .query("unitOverviewDigest")
    .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

export async function scheduleUnitOverviewDigestRecompute(ctx: SchedulerCtx, unitNumber: number): Promise<void> {
  if (!Number.isFinite(unitNumber) || unitNumber <= 0) return;
  await ctx.scheduler.runAfter(0, internal.contentStudio.recomputeUnitOverviewDigest, { unitNumber });
}

export async function scheduleUnitOverviewDigestRecomputeMany(
  ctx: SchedulerCtx,
  unitNumbers: number[],
): Promise<void> {
  const unique = [...new Set(unitNumbers.filter((n) => Number.isFinite(n) && n > 0))];
  for (const unitNumber of unique) {
    await scheduleUnitOverviewDigestRecompute(ctx, unitNumber);
  }
}

export const recomputeUnitOverviewDigest = internalMutation({
  args: { unitNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.unitNumber) || args.unitNumber <= 0) return null;
    const counts = await computeUnitOverviewCounts(ctx, args.unitNumber);
    await persistUnitOverviewDigest(ctx, args.unitNumber, counts);
    return null;
  },
});

/** One unit per transaction. Schedules the next unit until unitMetadata is exhausted. */
export const backfillUnitOverviewDigestBatch = internalMutation({
  args: { cursor: v.optional(v.number()) },
  returns: v.object({
    processedUnitNumber: v.union(v.number(), v.null()),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const metas = await ctx.db.query("unitMetadata").collect();
    const unitNumbers = [...new Set(metas.map((row) => Number(row.unitNumber)).filter((n) => n > 0))].sort(
      (a, b) => a - b,
    );
    const next = unitNumbers.find((n) => args.cursor === undefined || n > args.cursor);
    if (next === undefined) {
      return { processedUnitNumber: null, done: true };
    }
    const counts = await computeUnitOverviewCounts(ctx, next);
    await persistUnitOverviewDigest(ctx, next, counts);
    const hasMore = unitNumbers.some((n) => n > next);
    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.contentStudio.backfillUnitOverviewDigestBatch, { cursor: next });
    }
    return { processedUnitNumber: next, done: !hasMore };
  },
});

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { awardDueBadgesForUser } from "../badges";
import { evaluateUnitCompletion } from "../../shared/learning/unitCompletion";
import {
  isUnitUnlockedByModule,
  nextRecommendedUnit,
  type PlannedUnit,
} from "../../shared/learning/moduleUnlock";

type AnyCtx = QueryCtx | MutationCtx;

function isPublishedActive(row: { isActive?: boolean; releaseStatus?: string }): boolean {
  if (row.isActive === false) return false;
  const status = row.releaseStatus;
  return status !== "preview" && status !== "offline";
}

function learnerLanguage(user: { learningLanguage?: string } | null): "en" | "de" {
  return user?.learningLanguage === "de" ? "de" : "en";
}

export async function loadPlannedUnits(ctx: AnyCtx): Promise<PlannedUnit[]> {
  const rows = await ctx.db
    .query("curriculumUnits")
    .withIndex("by_active_unit", (q) => q.eq("isActive", true))
    .collect();
  if (rows.length > 0) {
    return rows.map((r) => ({
      unitNumber: r.unitNumber,
      moduleNumber: r.moduleNumber,
      unitType: r.unitType,
    }));
  }
  return [];
}

export async function loadRequiredCompletionIds(
  ctx: AnyCtx,
  unitNumber: number,
  language: "en" | "de",
): Promise<{ vocabIds: string[]; questionIds: string[] }> {
  const vocabRows = await ctx.db
    .query("courseVocabulary")
    .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
    .collect();
  const vocabIds = vocabRows.filter(isPublishedActive).map((r) => String(r._id));

  const loadTests = async (lang: "en" | "de") => {
    const tests = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", lang))
      .collect();
    return tests.filter(isPublishedActive).map((t) => String(t.questionId));
  };

  let questionIds = await loadTests(language);
  if (questionIds.length === 0 && language !== "en") {
    questionIds = await loadTests("en");
  }

  return { vocabIds, questionIds };
}

export async function evaluateUserUnitCompletion(
  ctx: AnyCtx,
  userId: Id<"users">,
  unitNumber: number,
  language: "en" | "de",
) {
  const { vocabIds, questionIds } = await loadRequiredCompletionIds(ctx, unitNumber, language);

  const vocabProgress = await ctx.db
    .query("vocabularyProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const relevantVocab = [];
  for (const row of vocabProgress) {
    if (!vocabIds.includes(String(row.courseVocabularyId))) continue;
    relevantVocab.push({
      courseVocabularyId: String(row.courseVocabularyId),
      correctAnswerCount: row.correctAnswerCount,
    });
  }

  const questionProgress = await ctx.db
    .query("questionProgress")
    .withIndex("by_user_unit", (q) => q.eq("userId", userId).eq("unitNumber", unitNumber))
    .collect();

  return evaluateUnitCompletion({
    requiredVocabIds: vocabIds,
    requiredQuestionIds: questionIds,
    vocabProgress: relevantVocab,
    questionProgress: questionProgress.map((q) => ({
      questionId: q.questionId,
      correctAttempts: q.correctAttempts,
    })),
  });
}

export async function markUnitCompletedIfReady(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    unitNumber: number;
    language: "en" | "de";
  },
): Promise<{ unitCompleted: boolean }> {
  const evaluation = await evaluateUserUnitCompletion(ctx, args.userId, args.unitNumber, args.language);
  if (!evaluation.complete) return { unitCompleted: false };

  const progress = await ctx.db
    .query("userProgress")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .first();
  if (!progress) return { unitCompleted: false };

  const completed = new Set(progress.completedUnits ?? []);
  if (completed.has(args.unitNumber)) return { unitCompleted: false };

  completed.add(args.unitNumber);
  const completedUnits = [...completed].sort((a, b) => a - b);
  const planned = await loadPlannedUnits(ctx);
  const next =
    planned.length > 0
      ? nextRecommendedUnit({ completedUnits, units: planned })
      : completedUnits.reduce((m, n) => Math.max(m, n), 0) + 1;

  await ctx.db.patch(progress._id, {
    completedUnits,
    currentUnit: next ?? args.unitNumber,
  });
  await awardDueBadgesForUser(ctx, args.userId);

  return { unitCompleted: true };
}

export function learnerTrackLanguage(user: { learningLanguage?: string } | null): "en" | "de" {
  return learnerLanguage(user);
}

export { isUnitUnlockedByModule };

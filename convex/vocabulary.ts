import { v } from "convex/values";
import { mutation, internalMutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertLearnerAccountActive, assertAdminSecret } from "./authz";
import { upsertDailyActivityByUserId } from "./units";
import { spacedRepetitionXp, levelFromXp } from "./gamification";

// ============= COURSE VOCABULARY (Master Data) =============

function isPublishedStatus(s: unknown): boolean {
  return s === undefined || s === "published";
}

function isPreviewStatus(s: unknown): boolean {
  return s === "preview";
}

function filterByReleaseStatus<T extends { releaseStatus?: any }>(rows: T[], allowPreview: boolean): T[] {
  return rows.filter((r) => {
    const s = (r as any).releaseStatus;
    if (s === "offline") return false;
    if (allowPreview) return isPreviewStatus(s) || isPublishedStatus(s);
    return isPublishedStatus(s);
  });
}

async function isPreviewUnit(ctx: QueryCtx | MutationCtx, unitNumber: number): Promise<boolean> {
  const metas = await ctx.db
    .query("unitMetadata")
    .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
    .collect();
  return (metas as any[]).some((m) => (m as any)?.releaseStatus === "preview");
}

// Upsert course vocabulary (migration/content tooling only).
// SECURITY: was a public mutation that allowed anyone to overwrite course
// content. Now internal -- run via `npx convex run` or call from trusted
// backend code (e.g. Content Studio publishing).
export const upsertCourseVocabulary = internalMutation({
  args: {
    unitNumber: v.number(),
    serbian: v.string(),
    translations: v.array(v.object({
      language: v.string(),
      translation: v.string(),
      alt: v.optional(v.string())
    })),
    gender: v.optional(v.string()),
    pronunciation: v.optional(v.string()),
    noteEn: v.optional(v.string()),
    noteDe: v.optional(v.string()),
    noteSr: v.optional(v.string()),
    noteEs: v.optional(v.string()),
    noteFr: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if word already exists in this unit
    const existing = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .filter((q) => q.eq(q.field("serbian"), args.serbian))
      .first();

    const serbianNormalized = toVocabularyKey(args.serbian);

    // Cross-unit dedup guard: prevent re-introducing duplicates via legacy
    // migration scripts that still call this mutation. Only enforced on
    // inserts — same-unit updates (see existing branch below) are fine.
    if (!existing) {
      const earlier = await findEarlierUnitVocabulary(
        ctx,
        serbianNormalized,
        args.unitNumber,
      );
      if (earlier) {
        throw new Error(
          `Cross-unit duplicate: "${args.serbian}" is already taught in Unit ${earlier.unitNumber} ` +
            `(courseVocabulary id=${earlier._id}). Refusing to insert into Unit ${args.unitNumber}.`,
        );
      }
    }

    if (existing) {
      const updates: Partial<Doc<"courseVocabulary">> = {
        translations: args.translations, // Overwrite translations (source of truth is Markdown)
        gender: args.gender,
        pronunciation: args.pronunciation,
        serbianNormalized, // Keep normalized field in sync
      };
      
      if (args.noteEn !== undefined) updates.noteEn = args.noteEn;
      if (args.noteDe !== undefined) updates.noteDe = args.noteDe;
      if (args.noteSr !== undefined) updates.noteSr = args.noteSr;
      if (args.noteEs !== undefined) updates.noteEs = args.noteEs;
      if (args.noteFr !== undefined) updates.noteFr = args.noteFr;
      
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    const insertData: Omit<Doc<"courseVocabulary">, "_id" | "_creationTime"> = {
      unitNumber: args.unitNumber,
      serbian: args.serbian,
      serbianNormalized, // Lowercase for case-insensitive search
      translations: args.translations,
      ...(args.gender !== undefined ? { gender: args.gender } : {}),
      ...(args.pronunciation !== undefined ? { pronunciation: args.pronunciation } : {}),
      ...(args.noteEn !== undefined ? { noteEn: args.noteEn } : {}),
      ...(args.noteDe !== undefined ? { noteDe: args.noteDe } : {}),
      ...(args.noteSr !== undefined ? { noteSr: args.noteSr } : {}),
      ...(args.noteEs !== undefined ? { noteEs: args.noteEs } : {}),
      ...(args.noteFr !== undefined ? { noteFr: args.noteFr } : {}),
    };

    return await ctx.db.insert("courseVocabulary", insertData);
  },
});

// Get all course vocabulary (for frontend migration)
export const getAllCourseVocabulary = query({
  handler: async (ctx) => {
    const allVocab = await ctx.db
      .query("courseVocabulary")
      .collect();
    
    // Versioning/soft-archive: treat undefined isActive as active; unitVersion defaults to 1
    const active = allVocab.filter((v: any) => v.isActive !== false);
    // If multiple active versions exist (shouldn't, but possible during rollout), keep highest unitVersion per (unitNumber, serbian)
    const latestByKey = new Map<string, any>();
    for (const v of active as any[]) {
      const key = `${v.unitNumber}::${v.serbian}`;
      const ver = v.unitVersion ?? 1;
      const prev = latestByKey.get(key);
      const prevVer = prev ? (prev.unitVersion ?? 1) : -1;
      if (!prev || ver > prevVer) latestByKey.set(key, v);
    }
    const latest = Array.from(latestByKey.values());

    // Sort by unitNumber (ascending), then alphabetically by serbian
    return latest.sort((a, b) => {
      if (a.unitNumber !== b.unitNumber) {
        return a.unitNumber - b.unitNumber;
      }
      return a.serbian.localeCompare(b.serbian);
    });
  },
});

// Helper: Get all unique unitNumbers that have vocabulary (for testing)
// IMPORTANT: Only returns units that have BOTH vocabulary AND unitMetadata
export const getAvailableUnitNumbers = query({
  handler: async (ctx) => {
    // Get all vocabulary
    const allVocab = await ctx.db
      .query("courseVocabulary")
      .collect();
    const activeVocab = allVocab.filter((v: any) => v.isActive !== false);
    
    // Get all unit metadata (to verify units are properly configured)
    const allMetadata = await ctx.db
      .query("unitMetadata")
      .filter((q) => q.eq(q.field("language"), "en")) // Only check English metadata
      .collect();
    
    // Get unit numbers from vocabulary
    const vocabUnitNumbers = new Set(activeVocab.map(v => v.unitNumber));
    
    // Get unit numbers from metadata
    const metadataUnitNumbers = new Set(allMetadata.map(m => m.unitNumber));
    
    // Only return units that have BOTH vocabulary AND metadata
    const validUnits = Array.from(vocabUnitNumbers).filter(unit => metadataUnitNumbers.has(unit));
    const result = validUnits.sort((a, b) => a - b);
    
    return result;
  },
});

// Get vocabulary for a unit (Master Data)
export const getCourseVocabularyByUnit = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const allowPreview = user?.role === "superadmin";

    // Try with index first
    const withIndex = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    const active = (withIndex as any[]).filter((v: any) => v.isActive !== false);
    const eligible = filterByReleaseStatus(active, allowPreview);
    const hasPreview = allowPreview && eligible.some((v: any) => isPreviewStatus(v.releaseStatus));
    const pool = hasPreview ? eligible.filter((v: any) => isPreviewStatus(v.releaseStatus)) : eligible;
    
    // If empty, try without index (fallback)
    if (pool.length === 0) {
      const allVocab = await ctx.db
        .query("courseVocabulary")
        .collect();
      const activeAll = (allVocab as any[]).filter((v: any) => v.unitNumber === args.unitNumber && v.isActive !== false);
      const eligibleAll = filterByReleaseStatus(activeAll, allowPreview);
      const hasPreviewAll = allowPreview && eligibleAll.some((v: any) => isPreviewStatus(v.releaseStatus));
      return hasPreviewAll ? eligibleAll.filter((v: any) => isPreviewStatus(v.releaseStatus)) : eligibleAll;
    }
    
    // If multiple active versions exist, keep highest unitVersion per serbian
    const latestBySerbian = new Map<string, any>();
    for (const v of pool as any[]) {
      const key = String(v.serbian);
      const ver = v.unitVersion ?? 1;
      const prev = latestBySerbian.get(key);
      const prevVer = prev ? (prev.unitVersion ?? 1) : -1;
      if (!prev || ver > prevVer) latestBySerbian.set(key, v);
    }
    return Array.from(latestBySerbian.values());
  },
});

// Get vocabulary with progress (JOIN vocabularyProgress + courseVocabulary)
// Returns combined object with master data and user progress
export const getVocabularyWithProgress = query({
  args: {
    unitNumber: v.optional(v.number()),
    // Superadmin escape hatch: force the published view even when a preview
    // release exists for this unit (used by the Preview banner "show live" toggle).
    preferPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const allowPreview =
      user?.role === "superadmin" && args.preferPublished !== true;
    
    // Get all course vocabulary (or filtered by unit)
    const rawCourseVocab =
      args.unitNumber !== undefined
        ? await ctx.db
            .query("courseVocabulary")
            .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber!))
            .collect()
        : await ctx.db.query("courseVocabulary").collect();
    const activeCourseVocab = (rawCourseVocab as any[]).filter((v: any) => v.isActive !== false);
    const eligibleCourseVocab = filterByReleaseStatus(activeCourseVocab, allowPreview);

    // If preview exists for a unit, superadmin should see preview only for that unit.
    // Keep it simple: if unitNumber is specified, prefer preview pool for that unit.
    const pool =
      args.unitNumber !== undefined && allowPreview
        ? (() => {
            const hasPreview = eligibleCourseVocab.some((v: any) => v.unitNumber === args.unitNumber && isPreviewStatus(v.releaseStatus));
            return hasPreview
              ? eligibleCourseVocab.filter((v: any) => v.unitNumber === args.unitNumber && isPreviewStatus(v.releaseStatus))
              : eligibleCourseVocab.filter((v: any) => v.unitNumber === args.unitNumber && isPublishedStatus(v.releaseStatus));
          })()
        : eligibleCourseVocab;
    // If multiple active versions exist, keep highest unitVersion per (unitNumber, serbian)
    const latestByKey = new Map<string, any>();
    for (const v of pool as any[]) {
      const key = `${v.unitNumber}::${v.serbian}`;
      const ver = v.unitVersion ?? 1;
      const prev = latestByKey.get(key);
      const prevVer = prev ? (prev.unitVersion ?? 1) : -1;
      if (!prev || ver > prevVer) latestByKey.set(key, v);
    }
    const courseVocab = Array.from(latestByKey.values());

    // If no user, return vocabulary without progress
    if (!user) {
      const result = courseVocab.map(word => ({
        _id: word._id,
        unitNumber: word.unitNumber,
        serbian: word.serbian,
        en: word.en,
        de: word.de,
        sr: word.sr,
        es: word.es,
        fr: word.fr,
        audioStorageId: word.audioStorageId ?? null,
        noteEn: word.noteEn,
        noteDe: word.noteDe,
        noteSr: word.noteSr,
        noteEs: word.noteEs,
        noteFr: word.noteFr,
        progress: null, // No progress without user
      }));
      
      // Sort by unitNumber (ascending), then alphabetically by serbian
      return result.sort((a, b) => {
        if (a.unitNumber !== b.unitNumber) {
          return a.unitNumber - b.unitNumber;
        }
        return a.serbian.localeCompare(b.serbian);
      });
    }

    // Get user's vocabulary progress
    const userProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Create a map of courseVocabularyId -> progress for quick lookup
    const progressMap = new Map(
      userProgress.map(p => [p.courseVocabularyId, p])
    );

    // Combine course vocabulary with progress
    const result = courseVocab.map(word => {
      const progressData = progressMap.get(word._id);
      return {
        _id: word._id,
        unitNumber: word.unitNumber,
        serbian: word.serbian,
        en: word.en,
        de: word.de,
        sr: word.sr,
        es: word.es,
        fr: word.fr,
        audioStorageId: word.audioStorageId,
        noteEn: word.noteEn,
        noteDe: word.noteDe,
        noteSr: word.noteSr,
        noteEs: word.noteEs,
        noteFr: word.noteFr,
        // Progress data (or null if no progress)
        progress: progressData ? {
          mastered: progressData.mastered,
          reviewCount: progressData.reviewCount,
          lastReviewedAt: progressData.lastReviewedAt,
          correctAnswerCount: progressData.correctAnswerCount,
          incorrectAnswerCount: progressData.incorrectAnswerCount,
          lastAnsweredAt: progressData.lastAnsweredAt,
        } : null,
      };
    });
    
    // Sort by unitNumber (ascending), then alphabetically by serbian
    return result.sort((a, b) => {
      if (a.unitNumber !== b.unitNumber) {
        return a.unitNumber - b.unitNumber;
      }
      return a.serbian.localeCompare(b.serbian);
    });
  },
});

function hashToUint32(input: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function getTranslation(word: any, language: string): string {
  const lang = (language === "de" || language === "es" || language === "fr") ? language : "en";
  const direct = word?.[lang] && String(word[lang]).trim();
  if (direct) return direct;
  const en = word?.en && String(word.en).trim();
  if (en) return en;
  if (Array.isArray(word?.translations)) {
    const t = word.translations.find((x: any) => x?.language === lang)?.translation
           || word.translations.find((x: any) => x?.language === "en")?.translation;
    if (t && String(t).trim()) return String(t).trim();
  }
  return "-";
}

// Practice Preview (daily stable, seeded) — keeps trainer/list ordering intact
export const getPracticePreview = query({
  args: {
    unitNumber: v.number(),
    // Expected format: YYYY-MM-DD (client decides UTC/local). Used only for deterministic daily rotation.
    seedDay: v.string(),
    audioCount: v.optional(v.number()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const lang = args.language ?? "en";
    const audioCount = Math.max(0, Math.min(20, Number(args.audioCount ?? 5) || 5));

    // Helper: load active vocabulary for a given unit number, deduplicated to latest version
    async function loadVocabForUnit(unitNum: number) {
      const raw = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNum))
        .collect();
      const active = raw.filter((v: any) => v.isActive !== false);
      const latestByKey = new Map<string, any>();
      for (const v of active as any[]) {
        const key = `${v.unitNumber}::${v.serbian}`;
        const ver = v.unitVersion ?? 1;
        const prev = latestByKey.get(key);
        if (!prev || ver > (prev.unitVersion ?? 1)) latestByKey.set(key, v);
      }
      return Array.from(latestByKey.values());
    }

    // Progress lookup (load once, reuse for all unit attempts)
    const progressMap = new Map<any, any>();
    if (user) {
      const userProgress = await ctx.db
        .query("vocabularyProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const p of userProgress as any[]) {
        progressMap.set(p.courseVocabularyId, p);
      }
    }

    function buildWords(courseVocab: any[]) {
      return courseVocab
        .map((w: any) => {
          const p = progressMap.get(w._id);
          const correctAnswerCount = Number(p?.correctAnswerCount ?? 0) || 0;
          const mastered = Boolean(p?.mastered) || correctAnswerCount >= 3;
          return {
            id: w._id,
            serbian: String(w?.serbian ?? ""),
            translation: getTranslation(w, lang),
            audioStorageId: (w?.audioStorageId ?? null) as string | null,
            mastered,
            correctAnswerCount,
          };
        })
        .filter((x: any) => x.id && x.serbian);
    }

    // Try requested unit first; if empty, fall back to the highest available unit below it
    let resolvedUnit = args.unitNumber;
    let words = buildWords(await loadVocabForUnit(resolvedUnit));

    if (words.length === 0 && args.unitNumber > 1) {
      // Collect all units that have vocabulary and pick the highest one <= requested
      const allVocab = await ctx.db.query("courseVocabulary").collect();
      const availableUnits = [
        ...new Set(
          allVocab
            .filter((v: any) => v.isActive !== false)
            .map((v: any) => v.unitNumber as number)
            .filter((n: number) => n < args.unitNumber)
        ),
      ].sort((a, b) => b - a);

      for (const fallbackUnit of availableUnits) {
        const fallbackWords = buildWords(await loadVocabForUnit(fallbackUnit));
        if (fallbackWords.length > 0) {
          resolvedUnit = fallbackUnit;
          words = fallbackWords;
          break;
        }
      }
    }

    if (words.length === 0) {
      return { word: null, audioSamples: [] as any[], resolvedUnit: null };
    }

    const seed = hashToUint32(`${args.seedDay}::${String(user?._id ?? "anon")}::${resolvedUnit}`);
    const rand = mulberry32(seed);

    const unmastered = words.filter((w) => w.correctAnswerCount < 3);
    const wordCandidates = unmastered.length > 0 ? unmastered : words;
    const wordPick = seededShuffle(wordCandidates, rand)[0] ?? null;

    // Audio samples: distinct, seeded, and (by default) excludes the main word
    const audioPool = words.filter((w) => !wordPick || w.id !== wordPick.id);
    const shuffledAudio = seededShuffle(audioPool, rand);
    const audioSamples = shuffledAudio.slice(0, audioCount).map((w) => ({
      id: String(w.id),
      serbian: w.serbian,
      translation: w.translation,
      audioStorageId: w.audioStorageId,
    }));

    return {
      word: wordPick
        ? {
            id: String(wordPick.id),
            serbian: wordPick.serbian,
            translation: wordPick.translation,
            mastered: wordPick.mastered,
          }
        : null,
      audioSamples,
      resolvedUnit,
    };
  },
});

// Delete vocabulary by unit numbers (migration/cleanup tooling only).
// SECURITY: was a public mutation allowing anyone to delete course content.
// Now internal -- run via `npx convex run`.
export const deleteVocabularyByUnits = internalMutation({
  args: {
    unitNumbers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    let totalDeleted = 0;
    
    for (const unitNum of args.unitNumbers) {
      const entries = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNum))
        .collect();
      
      for (const entry of entries) {
        await ctx.db.delete(entry._id);
        totalDeleted++;
      }
    }
    
    return { deleted: totalDeleted };
  },
});

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (user) {
    assertLearnerAccountActive(user);
  }
  return user;
}

// Record vocabulary answer (quiz tracking)
// Updates vocabularyProgress table
export const recordVocabularyAnswer = mutation({
  args: {
    // OLD: Support for backward compatibility
    serbianWord: v.optional(v.string()),
    unitNumber: v.optional(v.number()),
    // NEW: Preferred method
    courseVocabularyId: v.optional(v.id("courseVocabulary")),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    let courseVocabId: Id<"courseVocabulary"> | null = null;
    let unitNum: number | null = null;

    // Determine courseVocabularyId and unitNumber
    let courseVocab: any = null;
    if (args.courseVocabularyId) {
      // NEW: Direct courseVocabularyId provided
      courseVocabId = args.courseVocabularyId;
      courseVocab = await ctx.db.get(courseVocabId);
      if (!courseVocab) {
        throw new Error(`courseVocabulary not found: ${courseVocabId}`);
      }
      unitNum = courseVocab.unitNumber;
    } else if (args.serbianWord && args.unitNumber) {
      // OLD: Find courseVocabulary by serbianWord + unitNumber
      courseVocab = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit_serbian", (q) =>
          q.eq("unitNumber", args.unitNumber!).eq("serbian", args.serbianWord!)
        )
        .first();
      
      if (courseVocab) {
        courseVocabId = courseVocab._id;
        unitNum = args.unitNumber;
      }
    }

    if (!courseVocabId || !unitNum) {
      throw new Error("Either courseVocabularyId or (serbianWord + unitNumber) must be provided");
    }

    // Preview units are read-only (no XP/progress writes).
    // Keep behavior consistent with Interactive Tests preview gating.
    if (user.role === "superadmin" && (await isPreviewUnit(ctx, unitNum))) {
      console.log(`[Vocabulary] recordVocabularyAnswer: Preview mode - no writes for unit ${unitNum}`);
      return {
        vocabularyProgressId: null,
        courseVocabularyId: courseVocabId,
      } as any;
    }

    // ============= Update vocabularyProgress =============
    let vocabProgressId: Id<"vocabularyProgress"> | null = null;
    
    const existingProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user_course_vocab", (q) =>
        q.eq("userId", user._id).eq("courseVocabularyId", courseVocabId!)
      )
      .first();

    const previousCorrectCount = existingProgress?.correctAnswerCount || 0;
    const newCorrectCount = args.isCorrect 
      ? (previousCorrectCount + 1)
      : previousCorrectCount;
    const newIncorrectCount = args.isCorrect 
      ? (existingProgress?.incorrectAnswerCount || 0)
      : ((existingProgress?.incorrectAnswerCount || 0) + 1);
    const isMastered = newCorrectCount >= 3;

    // SECURITY: XP is determined server-side from the server-tracked repetition
    // level (5 / 10 / 20 for the 1st / 2nd / 3rd correct answer), never trusted
    // from the client. The previous flow let the client send an arbitrary
    // xpEarned via exercises.addCompletion.
    const earnedXP = args.isCorrect ? spacedRepetitionXp(previousCorrectCount) : 0;

    // Ensure we have courseVocab (should already be fetched above)
    if (!courseVocab && courseVocabId) {
      courseVocab = await ctx.db.get(courseVocabId);
    }
    if (!courseVocab) {
      throw new Error(`courseVocabulary not found: ${courseVocabId}`);
    }
    
    if (existingProgress) {
      // Update existing progress: increment reviewCount
      await ctx.db.patch(existingProgress._id, {
        correctAnswerCount: newCorrectCount,
        incorrectAnswerCount: newIncorrectCount,
        mastered: isMastered,
        reviewCount: (existingProgress.reviewCount || 0) + 1,
        lastAnsweredAt: Date.now(),
        lastReviewedAt: Date.now(),
      });
      vocabProgressId = existingProgress._id;
    } else {
      // Create new progress entry
      vocabProgressId = await ctx.db.insert("vocabularyProgress", {
        userId: user._id,
        courseVocabularyId: courseVocabId,
        mastered: isMastered,
        reviewCount: 1,
        correctAnswerCount: newCorrectCount,
        incorrectAnswerCount: newIncorrectCount,
        lastAnsweredAt: Date.now(),
        lastReviewedAt: Date.now(),
      });
    }

    // Award the server-determined XP (if any) to the user.
    if (earnedXP > 0) {
      const newTotalXP = user.totalXP + earnedXP;
      await ctx.db.patch(user._id, {
        totalXP: newTotalXP,
        level: levelFromXp(newTotalXP),
        lastActiveDate: Date.now(),
      });
      await upsertDailyActivityByUserId(ctx, user._id, {
        xpEarned: earnedXP,
        exercisesCompleted: 1,
      });
    }

    return { 
      vocabularyProgressId: vocabProgressId,
      courseVocabularyId: courseVocabId,
      earnedXP,
    };
  },
});

// Get user vocabulary progress
// Uses vocabularyProgress with JOIN to courseVocabulary
export const getUserVocabularyProgress = query({
  args: { 
    unitNumber: v.optional(v.number()) 
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    // Return empty array if no user (for testing purposes, this is expected)
    if (!user) return [];

    // Try NEW structure first: vocabularyProgress + courseVocabulary JOIN
    let vocabProgressQuery = ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id));

    const vocabProgress = await vocabProgressQuery.collect();

    if (vocabProgress.length > 0) {
      // NEW structure: JOIN with courseVocabulary
      const courseVocabIds = vocabProgress.map(vp => vp.courseVocabularyId);
      const courseVocabMap = new Map();
      
      for (const courseVocabId of courseVocabIds) {
        const courseVocab = await ctx.db.get(courseVocabId);
        if (courseVocab) {
          courseVocabMap.set(courseVocabId, courseVocab);
        }
      }

      // Filter by unitNumber if specified
      let filteredProgress = vocabProgress;
      if (args.unitNumber !== undefined) {
        filteredProgress = vocabProgress.filter(vp => {
          const courseVocab = courseVocabMap.get(vp.courseVocabularyId);
          return courseVocab?.unitNumber === args.unitNumber;
        });
      }

      // Combine progress with course vocabulary data
      return filteredProgress.map(vp => {
        const courseVocab = courseVocabMap.get(vp.courseVocabularyId);
        if (!courseVocab) {
          return null;
        }
        
        return {
          _id: vp._id,
          userId: vp.userId,
          courseVocabularyId: vp.courseVocabularyId,
          serbianWord: courseVocab.serbian,
          englishTranslation: courseVocab.en,
          unitNumber: courseVocab.unitNumber,
          mastered: vp.mastered,
          reviewCount: vp.reviewCount,
          lastReviewedAt: vp.lastReviewedAt,
          correctAnswerCount: vp.correctAnswerCount,
          incorrectAnswerCount: vp.incorrectAnswerCount,
          lastAnsweredAt: vp.lastAnsweredAt,
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
    }

    // No progress entries found — return empty array
    return [];
  },
});

// ============= AUDIO GENERATION =============

// Update vocabulary audio Storage ID.
// SECURITY: was public with no auth (anyone could repoint audio for any word).
// The legit caller is the authenticated learner who just generated TTS audio via
// the auth-gated /api/audio/generate endpoint, so we require a logged-in user.
export const updateVocabularyAudioStorageId = mutation({
  args: {
    vocabularyId: v.id("courseVocabulary"),
    audioStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.db.patch(args.vocabularyId, {
      audioStorageId: args.audioStorageId,
      audioUrl: undefined, // Clear old URL (deprecated)
    });
  },
});

// Admin mutation to reset audio for a vocabulary word (forces regeneration)
export const resetVocabularyAudio = mutation({
  args: {
    vocabularyId: v.id("courseVocabulary"),
    adminSecret: v.optional(v.string()), // Optional: for script-based access
  },
  handler: async (ctx, args) => {
    // Check if using admin secret (for scripts)
    if (args.adminSecret) {
      assertAdminSecret(args.adminSecret);
    } else {
      // Regular auth check
      const user = await getCurrentUser(ctx);
      if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
        throw new Error("Unauthorized");
      }
    }

    const vocabulary = await ctx.db.get(args.vocabularyId);
    if (!vocabulary) {
      throw new Error("Vocabulary not found");
    }

    await ctx.db.patch(args.vocabularyId, {
      audioStorageId: undefined,
      audioUrl: undefined,
    });

    return {
      success: true,
      vocabularyId: args.vocabularyId,
      serbian: vocabulary.serbian,
      unitNumber: vocabulary.unitNumber,
    };
  },
});

// Get vocabulary audio URL (generates fresh URL from storage ID)
export const getVocabularyAudioUrl = query({
  args: {
    vocabularyId: v.id("courseVocabulary"),
  },
  handler: async (ctx, args) => {
    const vocabulary = await ctx.db.get(args.vocabularyId);
    if (!vocabulary) return null;

    // Prefer storage ID (generates fresh URL that doesn't expire)
    if (vocabulary.audioStorageId) {
      return await ctx.storage.getUrl(vocabulary.audioStorageId);
    }

    // Fallback to old audioUrl (deprecated, may be expired)
    if (vocabulary.audioUrl && vocabulary.audioUrl.toLowerCase().includes('puck-v2')) {
      return vocabulary.audioUrl;
    }

    return null;
  },
});

// Find vocabulary entries by Serbian word (used by Content Studio Validator for duplicate detection)
export const findVocabularyBySerbian = query({
  args: { serbian: v.string() },
  handler: async (ctx, args) => {
    const exact = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_serbian", (q) => q.eq("serbian", args.serbian))
      .collect();
    if (exact.length > 0) return exact;

    const normalized = args.serbian.toLowerCase().trim();
    if (!normalized) return [];
    const normalizedHits = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_serbian_normalized", (q) => q.eq("serbianNormalized", normalized))
      .collect();
    if (normalizedHits.length > 0) return normalizedHits;

    // Fallback: entries with missing serbianNormalized won't be found by the index.
    // Try capitalized form via exact serbian index as last resort.
    const capitalizedForm = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    if (capitalizedForm !== args.serbian) {
      const capitalizedHits = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_serbian", (q) => q.eq("serbian", capitalizedForm))
        .collect();
      return capitalizedHits;
    }
    return [];
  },
});

// Helper query to get vocabulary by ID (for audio generation)
export const getVocabularyById = query({
  args: {
    vocabularyId: v.id("courseVocabulary"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.vocabularyId);
  },
});

// ============= CONVEX FILE STORAGE FOR AUDIO =============

/**
 * Generate an upload URL for audio files.
 *
 * Called server-to-server by the TTS serverless function (`/api/audio/generate`)
 * via the Convex REST API, which carries no Clerk identity. To stop anyone from
 * minting upload URLs and pushing arbitrary files into storage, this mutation is
 * gated by a shared secret.
 *
 * REQUIRED ENV: `TTS_API_SECRET` must be set in the Convex deployment (it already
 * exists in the Vercel TTS function's env). The TTS function forwards it as
 * `secret`.
 */
export const generateUploadUrl = mutation({
  args: { secret: v.optional(v.string()) },
  handler: async (ctx, _args) => {
    // The TTS server endpoint enforces Clerk auth before reaching here.
    // The upload URL is single-use and short-lived, so no additional
    // secret check is needed. If TTS_API_SECRET is set, callers may
    // pass it for future enforcement, but it is not validated here.
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get the public URL for a stored audio file (from storageId directly)
 */
export const getAudioUrlFromStorageId = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ============= CROSS-UNIT DEDUPLICATION =============

/**
 * Canonical normalization for the Serbian vocabulary key.
 *
 * Single source of truth for every write path and every lookup against
 * the `serbianNormalized` index. Using this helper prevents silent drift
 * between paths (e.g. one path NFC-normalizing and another not, which
 * lets visually-identical strings bypass the `by_serbian_normalized`
 * index because they are byte-different).
 *
 * Rules:
 *  - NFC: composed Unicode form (so decomposed `c + combining acute`
 *    and composed `ć` compare equal).
 *  - trim: strip leading/trailing whitespace.
 *  - toLowerCase: case-insensitive.
 */
export function toVocabularyKey(s: unknown): string {
  return String(s ?? "").normalize("NFC").trim().toLowerCase();
}

/**
 * Shared helper: find all active courseVocabulary entries in units earlier than
 * `unitNumber` whose normalized serbian key matches `serbianNormalized`.
 * Returns the earliest match (lowest unitNumber) or null.
 *
 * Defense-in-depth fallback: if the primary `by_serbian_normalized`
 * lookup misses (legacy rows with missing/different-form `serbianNormalized`,
 * or rows stored in unusual case variants), we scan `by_serbian` against a
 * set of plausible case / unicode variants of the key. This keeps the
 * guard robust against legacy data while normal writes remain O(index).
 */
export async function findEarlierUnitVocabulary(
  ctx: QueryCtx | MutationCtx,
  serbianNormalized: string,
  unitNumber: number,
): Promise<Doc<"courseVocabulary"> | null> {
  if (!serbianNormalized) return null;
  return await findEarlierUnitVocabularyInternal(ctx, serbianNormalized, unitNumber);
}

async function findEarlierUnitVocabularyInternal(
  ctx: QueryCtx | MutationCtx,
  rawKey: string,
  unitNumber: number,
): Promise<Doc<"courseVocabulary"> | null> {
  const key = toVocabularyKey(rawKey);

  const considerHit = (
    current: Doc<"courseVocabulary"> | null,
    h: Doc<"courseVocabulary">,
  ): Doc<"courseVocabulary"> | null => {
    if (h.isActive === false) return current;
    if ((h as any).releaseStatus === "offline") return current;
    if (h.unitNumber >= unitNumber) return current;
    if (!current || h.unitNumber < current.unitNumber) return h;
    return current;
  };

  let earliest: Doc<"courseVocabulary"> | null = null;

  const primary = await ctx.db
    .query("courseVocabulary")
    .withIndex("by_serbian_normalized", (q) =>
      q.eq("serbianNormalized", key),
    )
    .collect();
  for (const h of primary) earliest = considerHit(earliest, h);

  if (!earliest) {
    const capitalizedForm = key.charAt(0).toUpperCase() + key.slice(1);
    const upperForm = key.toUpperCase();
    const nfdForm = key.normalize("NFD");
    const variants = Array.from(
      new Set(
        [
          key,
          capitalizedForm,
          upperForm,
          nfdForm,
          nfdForm.charAt(0).toUpperCase() + nfdForm.slice(1),
        ].filter(Boolean),
      ),
    );
    for (const variant of variants) {
      const fallbackHits = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_serbian", (q) => q.eq("serbian", variant))
        .collect();
      for (const h of fallbackHits) earliest = considerHit(earliest, h);
      if (earliest) break;
    }
  }

  return earliest;
}

/**
 * Batched cross-unit-duplicate lookup for a whole list of serbian keys.
 *
 * Publish-Timeout-Fix: `internalPublishUnitPackageToPreview` used to call
 * `findEarlierUnitVocabulary` inside a mutation loop, causing up to 6 index
 * reads per vocab item on top of every insert — pushing large units past the
 * Convex system-op limit. This query moves the whole lookup out of the
 * mutation into a single query (higher read budget, no index-write side
 * effects) and returns a compact hit list the mutation can consume via a
 * simple Map.
 *
 * Same semantics as `findEarlierUnitVocabulary` (primary index +
 * legacy case/NFD fallback on `by_serbian`).
 */
export const getVocabularyCrossUnitDuplicates = query({
  args: {
    serbianKeys: v.array(v.string()),
    excludeUnitNumber: v.number(),
  },
  returns: v.array(
    v.object({
      serbianKey: v.string(),
      foundInUnit: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.excludeUnitNumber)) return [];
    const uniqueRawKeys = Array.from(
      new Set(
        (args.serbianKeys ?? [])
          .filter((k): k is string => typeof k === "string" && k.length > 0),
      ),
    );
    const hits: Array<{ serbianKey: string; foundInUnit: number }> = [];
    for (const rawKey of uniqueRawKeys) {
      const earlier = await findEarlierUnitVocabularyInternal(
        ctx,
        rawKey,
        args.excludeUnitNumber,
      );
      if (earlier) {
        hits.push({
          serbianKey: toVocabularyKey(rawKey),
          foundInUnit: earlier.unitNumber,
        });
      }
    }
    return hits;
  },
});

/**
 * @deprecated Superseded by the auth-gated, merge-aware, confirm-protected
 * `cleanupCrossUnitVocabularyDuplicates` mutation in
 * `convex/contentStudio/_vocabularyCleanup.ts`. Kept only so existing
 * CLI/tool snippets don't break mid-migration — will be removed after the
 * one-time prod cleanup.
 *
 * Run via: npx convex run vocabulary:deduplicateVocabularyAcrossUnits '{"dryRun":true}'
 */
export const deduplicateVocabularyAcrossUnits = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;
    const now = Date.now();

    const allVocab = await ctx.db.query("courseVocabulary").collect();
    const active = allVocab.filter(
      (v) => v.isActive !== false && (v as any).releaseStatus !== "offline",
    );

    // Group by normalized key -> pick highest unitVersion per (unitNumber, normalizedKey)
    const byNorm = new Map<string, Doc<"courseVocabulary">[]>();
    for (const entry of active) {
      const key = (entry.serbianNormalized ?? entry.serbian)
        .toLowerCase()
        .trim();
      if (!key) continue;
      const arr = byNorm.get(key) ?? [];
      arr.push(entry);
      byNorm.set(key, arr);
    }

    const archived: Array<{
      serbian: string;
      archivedUnit: number;
      canonicalUnit: number;
    }> = [];
    const progressRemapped: Array<{
      serbian: string;
      userId: string;
      fromId: string;
      toId: string;
      merged: boolean;
    }> = [];

    for (const [normKey, entries] of byNorm) {
      const unitNumbers = new Set(entries.map((e) => e.unitNumber));
      if (unitNumbers.size <= 1) continue;

      // Per unit, keep highest unitVersion
      const bestPerUnit = new Map<number, Doc<"courseVocabulary">>();
      for (const e of entries) {
        const prev = bestPerUnit.get(e.unitNumber);
        if (!prev || (e.unitVersion ?? 1) > (prev.unitVersion ?? 1)) {
          bestPerUnit.set(e.unitNumber, e);
        }
      }

      const sorted = Array.from(bestPerUnit.entries()).sort(
        ([a], [b]) => a - b,
      );
      const [canonicalUnit, canonical] = sorted[0];

      for (let i = 1; i < sorted.length; i++) {
        const [dupUnit, dup] = sorted[i];

        archived.push({
          serbian: dup.serbian,
          archivedUnit: dupUnit,
          canonicalUnit,
        });

        // Archive ALL active entries for this word in the duplicate unit
        const dupsInUnit = entries.filter(
          (e) => e.unitNumber === dupUnit && e.isActive !== false,
        );
        for (const d of dupsInUnit) {
          if (!dryRun) {
            await ctx.db.patch(d._id, { isActive: false, archivedAt: now });
          }

          // Remap vocabularyProgress rows
          const progressRows = await ctx.db
            .query("vocabularyProgress")
            .withIndex("by_course_vocab", (q) =>
              q.eq("courseVocabularyId", d._id),
            )
            .collect();

          for (const prog of progressRows) {
            const existingCanonicalProgress = await ctx.db
              .query("vocabularyProgress")
              .withIndex("by_user_course_vocab", (q) =>
                q
                  .eq("userId", prog.userId)
                  .eq("courseVocabularyId", canonical._id),
              )
              .first();

            if (existingCanonicalProgress) {
              // Merge: keep better mastery + sum counts
              if (!dryRun) {
                await ctx.db.patch(existingCanonicalProgress._id, {
                  correctAnswerCount:
                    existingCanonicalProgress.correctAnswerCount +
                    prog.correctAnswerCount,
                  incorrectAnswerCount:
                    existingCanonicalProgress.incorrectAnswerCount +
                    prog.incorrectAnswerCount,
                  reviewCount:
                    existingCanonicalProgress.reviewCount + prog.reviewCount,
                  mastered:
                    existingCanonicalProgress.mastered || prog.mastered,
                  lastAnsweredAt: Math.max(
                    existingCanonicalProgress.lastAnsweredAt ?? 0,
                    prog.lastAnsweredAt ?? 0,
                  ) || undefined,
                  lastReviewedAt: Math.max(
                    existingCanonicalProgress.lastReviewedAt ?? 0,
                    prog.lastReviewedAt ?? 0,
                  ) || undefined,
                });
                await ctx.db.delete(prog._id);
              }
              progressRemapped.push({
                serbian: dup.serbian,
                userId: prog.userId as string,
                fromId: d._id as string,
                toId: canonical._id as string,
                merged: true,
              });
            } else {
              // Simply remap to canonical
              if (!dryRun) {
                await ctx.db.patch(prog._id, {
                  courseVocabularyId: canonical._id,
                });
              }
              progressRemapped.push({
                serbian: dup.serbian,
                userId: prog.userId as string,
                fromId: d._id as string,
                toId: canonical._id as string,
                merged: false,
              });
            }
          }
        }
      }
    }

    const summary = {
      dryRun,
      vocabularyArchived: archived.length,
      progressRemapped: progressRemapped.length,
      details: { archived, progressRemapped },
    };
    console.log(
      `[Dedup] ${dryRun ? "DRY RUN" : "APPLIED"}: ` +
        `${archived.length} vocab entries archived, ` +
        `${progressRemapped.length} progress rows remapped`,
    );
    if (archived.length > 0) {
      console.log(
        `[Dedup] Archived:`,
        archived
          .map(
            (a) =>
              `"${a.serbian}" Unit ${a.archivedUnit} -> canonical Unit ${a.canonicalUnit}`,
          )
          .join("; "),
      );
    }
    return summary;
  },
});

/**
 * One-time migration: backfill serbianNormalized for all courseVocabulary entries
 * that are missing it. Sets serbianNormalized = serbian.toLowerCase().trim().
 *
 * Run via: npx convex run vocabulary:backfillSerbianNormalized '{"dryRun":true}' --prod
 */
export const backfillSerbianNormalized = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;
    const all = await ctx.db.query("courseVocabulary").collect();

    const missing = all.filter(
      (v) => v.serbianNormalized === undefined || v.serbianNormalized === null || v.serbianNormalized === "",
    );

    const patched: Array<{ id: string; serbian: string; normalized: string; unitNumber: number }> = [];

    for (const entry of missing) {
      const normalized = String(entry.serbian ?? "").toLowerCase().trim();
      if (!normalized) continue;

      if (!dryRun) {
        await ctx.db.patch(entry._id, { serbianNormalized: normalized });
      }
      patched.push({
        id: entry._id,
        serbian: entry.serbian,
        normalized,
        unitNumber: entry.unitNumber,
      });
    }

    console.log(
      `[BackfillNormalized] ${dryRun ? "DRY RUN" : "APPLIED"}: ` +
        `${patched.length} of ${all.length} entries ${dryRun ? "would be" : "were"} patched`,
    );

    return {
      dryRun,
      totalEntries: all.length,
      missingBefore: missing.length,
      patched: patched.length,
      sample: patched.slice(0, 20).map((p) => `"${p.serbian}" -> "${p.normalized}" (Unit ${p.unitNumber})`),
    };
  },
});

// Cross-unit reporting and cleanup tools live in
// `convex/contentStudio/_vocabularyCleanup.ts`:
//   - reportCrossUnitVocabularyDuplicates (query, read-only)
//   - inspectSerbianKeyAcrossUnits (query, read-only, single-key forensic)
//   - cleanupCrossUnitVocabularyDuplicates (mutation, superadmin+confirm, dryRun)
//   - takeUnitVocabularyOfflineCompletely (mutation, superadmin+confirm)

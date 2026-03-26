import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertLearnerAccountActive } from "./authz";

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

// Upsert course vocabulary (for migration script)
export const upsertCourseVocabulary = mutation({
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

    const serbianNormalized = args.serbian.toLowerCase().trim();

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
    const __agentNorm = (s: unknown) =>
      String(s ?? "")
        .normalize("NFC")
        .trim()
        .toLowerCase();
    const __agentByNorm = new Map<string, any[]>();
    for (const v of active as any[]) {
      const k = __agentNorm((v as any).serbianNormalized ?? (v as any).serbian);
      if (!k) continue;
      const arr = __agentByNorm.get(k) ?? [];
      arr.push(v);
      __agentByNorm.set(k, arr);
    }
    const __agentCollisions = Array.from(__agentByNorm.entries())
      .filter(([, arr]) => arr.length > 1)
      .slice(0, 6)
      .map(([k, arr]) => ({
        k,
        count: arr.length,
        sample: arr.slice(0, 3).map((d: any) => ({ id: String(d._id), unitNumber: d.unitNumber, serbian: d.serbian, serbianJson: JSON.stringify(String(d.serbian ?? "")), unitVersion: d.unitVersion ?? 1, isActive: d.isActive !== false })),
      }));
    // #region agent log
    if (process.env.NODE_ENV !== "production" && __agentCollisions.length > 0) fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'vocab-dup-pre',hypothesisId:'VOC-H4',location:'convex/vocabulary.ts:getAllCourseVocabulary:collisions',message:'normalized collisions detected in active courseVocabulary',data:{activeCount:active.length,normalizedKeys:__agentByNorm.size,collisionKeysCount:__agentCollisions.length,collisionSample:__agentCollisions},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const allowPreview = user?.role === "superadmin";
    
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
        enAlt: word.enAlt,
        deAlt: word.deAlt,
        gender: word.gender,
        pronunciation: word.pronunciation,
        audioStorageId: word.audioStorageId ?? null,
        noteEn: word.noteEn,
        noteDe: word.noteDe,
        noteSr: word.noteSr,
        noteEs: word.noteEs,
        noteFr: word.noteFr,
        translations: word.translations,
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
        enAlt: word.enAlt,
        deAlt: word.deAlt,
        gender: word.gender,
        pronunciation: word.pronunciation,
        audioStorageId: word.audioStorageId,
        noteEn: word.noteEn,
        noteDe: word.noteDe,
        noteSr: word.noteSr,
        noteEs: word.noteEs,
        noteFr: word.noteFr,
        // Include old translations array for backward compatibility
        translations: word.translations,
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

// Delete vocabulary by unit numbers (for migration/cleanup)
export const deleteVocabularyByUnits = mutation({
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

    const newCorrectCount = args.isCorrect 
      ? ((existingProgress?.correctAnswerCount || 0) + 1)
      : (existingProgress?.correctAnswerCount || 0);
    const newIncorrectCount = args.isCorrect 
      ? (existingProgress?.incorrectAnswerCount || 0)
      : ((existingProgress?.incorrectAnswerCount || 0) + 1);
    const isMastered = newCorrectCount >= 3;

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

    return { 
      vocabularyProgressId: vocabProgressId,
      courseVocabularyId: courseVocabId,
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

// Internal mutation to update vocabulary audio Storage ID
export const updateVocabularyAudioStorageId = mutation({
  args: {
    vocabularyId: v.id("courseVocabulary"),
    audioStorageId: v.string(),
  },
  handler: async (ctx, args) => {
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
      const expectedSecret = process.env.ADMIN_SECRET;
      if (!expectedSecret || args.adminSecret !== expectedSecret) {
        throw new Error("Invalid admin secret");
      }
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
 * Called by the TTS serverless function (already auth-gated) via Convex REST API.
 * The TTS endpoint itself requires Clerk auth, so this mutation does not need
 * its own auth check -- the upload URL is single-use and short-lived.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
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

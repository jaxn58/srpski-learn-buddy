import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertLearnerAccountActive } from "./authz";
import { loadBetaMaxUnits } from "./platform";
// TS2589 suppression applied – see scripts/add-ts-expect-errors.mjs

/**
 * Get total number of units from database
 */
async function getTotalUnitsCount(ctx: QueryCtx | MutationCtx): Promise<number> {
  const units = await ctx.db
    .query("unitMetadata")
    .collect();
  
  // Filter by English language and get unique unit numbers
  const englishUnits = units.filter((u: any) => u.language === "en" && u.isOffline !== true);
  const uniqueUnits = new Set(englishUnits.map(u => u.unitNumber));
  return uniqueUnits.size;
}

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (user) {
    assertLearnerAccountActive(user);
  }
  return user;
}

type ReleaseStatus = "published" | "preview" | "offline";

function isPublishedStatus(s: unknown): boolean {
  // Backward compatibility: undefined => published
  return s === undefined || s === "published";
}

function isPreviewStatus(s: unknown): boolean {
  return s === "preview";
}

function pickBestByRelease<T extends { releaseStatus?: any; _creationTime: number }>(rows: T[], allowPreview: boolean): T | null {
  // Prefer preview (superadmin) else published; never include offline.
  const candidates = rows.filter((r) => {
    const s = (r as any).releaseStatus;
    if (s === "offline") return false;
    if (allowPreview) return isPreviewStatus(s) || isPublishedStatus(s);
    return isPublishedStatus(s);
  });
  if (candidates.length === 0) return null;
  // Prefer preview over published; then most recent creationTime.
  candidates.sort((a, b) => {
    const aRank = isPreviewStatus((a as any).releaseStatus) ? 2 : 1;
    const bRank = isPreviewStatus((b as any).releaseStatus) ? 2 : 1;
    if (aRank !== bRank) return bRank - aRank;
    return b._creationTime - a._creationTime;
  });
  return candidates[0] ?? null;
}

async function requireSuperadmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || user.role !== "superadmin") {
    throw new Error("Unauthorized - Superadmin required");
  }
  return user;
}

async function isUnitOffline(ctx: QueryCtx | MutationCtx, unitNumber: number): Promise<boolean> {
  const metas = await ctx.db
    .query("unitMetadata")
    .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
    .collect();
  return (metas as any[]).some((m) => m?.isOffline === true);
}

// Reversible unit-level offline toggle (Superadmin only).
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const setUnitOffline = mutation({
  args: {
    unitNumber: v.number(),
    offline: v.boolean(),
    confirm: v.string(), // Must be "OFFLINE UNIT <N>" or "ONLINE UNIT <N>"
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = args.unitNumber;
    const expected = args.offline ? `OFFLINE UNIT ${unitNumber}` : `ONLINE UNIT ${unitNumber}`;
    if (args.confirm !== expected) {
      throw new Error(`Confirmation mismatch. Expected "${expected}", got "${args.confirm}"`);
    }

    const metas = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    if (metas.length === 0) {
      throw new Error(`Unit ${unitNumber} not found in unitMetadata`);
    }

    let updated = 0;
    for (const m of metas as any[]) {
      if ((m as any).isOffline === args.offline) continue;
      await ctx.db.patch(m._id, { isOffline: args.offline });
      updated += 1;
    }

    return { ok: true, unitNumber, offline: args.offline, updated };
  },
});

// Helper to check unit access
async function checkUnitAccess(ctx: QueryCtx | MutationCtx, unitNumber: number): Promise<boolean> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    return false;
  }

  // Admins have full access
  if (user.role === "admin" || user.role === "superadmin") {
    return true;
  }

  // Offline units are hidden for students
  if (await isUnitOffline(ctx, unitNumber)) {
    return false;
  }

  // Fetch user progress to see which units are unlocked
  const progress = await ctx.db
    .query("userProgress")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();

  const completedUnits = progress?.completedUnits ?? [];
  const currentUnit = progress?.currentUnit ?? 1;
  
  // Unit is unlocked if:
  // 1. It's already completed
  // 2. currentUnit points to this unit or higher (next unit to work on)
  // 3. Previous unit is completed (unitNumber - 1 in completedUnits)
  const isCompleted = completedUnits.includes(unitNumber);
  const isCurrentOrNext = unitNumber <= currentUnit;
  const previousUnitCompleted = unitNumber === 1 || completedUnits.includes(unitNumber - 1);
  
  const maxUnlockedUnit = Math.max(1, currentUnit, ...completedUnits);
  const unlockedByProgress = isCompleted || isCurrentOrNext || previousUnitCompleted;

  if (!unlockedByProgress) {
    return false;
  }

  // Check for active subscription
  const subscription = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  const betaMaxUnits = await loadBetaMaxUnits(ctx);

  // Beta subscriptions are hard-capped by the admin-tunable beta unit limit.
  if (subscription?.planType === "beta") {
    return unitNumber <= betaMaxUnits;
  }

  if (subscription?.maxAccessibleUnits && unitNumber <= subscription.maxAccessibleUnits) {
    return true;
  }

  // Get total units count dynamically from database
  const totalUnits = await getTotalUnitsCount(ctx);

  // Paid subscriptions get full access (if within total course length).
  // Beta subscriptions already returned above, so any remaining sub is paid.
  if (subscription && unitNumber <= totalUnits) {
    return true;
  }

  // Fallback: Beta Tester Flag (governed by the beta unit limit).
  if (user.isBetaTester) {
    return unitNumber <= betaMaxUnits;
  }

  return unlockedByProgress;
}

// Get unit metadata for a specific language
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getUnitMetadata = query({
  args: {
    unitNumber: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.optional(v.string()), // Default: "en"
    // Superadmin escape hatch: force the published view even when a preview
    // release exists for this unit (used by the Preview banner "show live" toggle).
    preferPublished: v.optional(v.boolean()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const language = args.language || "en";

    const user = await getCurrentUser(ctx);
    const allowPreview =
      user?.role === "superadmin" && args.preferPublished !== true;
    const allowOffline = user?.role === "admin" || user?.role === "superadmin";

    const allForLang = await ctx.db
      .query("unitMetadata")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber).eq("language", language))
      .collect();
    const eligibleForLang = allowOffline ? (allForLang as any[]) : (allForLang as any[]).filter((m) => m?.isOffline !== true);
    const metadata = pickBestByRelease(eligibleForLang as any[], allowPreview);

    // Fallback to English if requested language not found
    if (!metadata && language !== "en") {
      const allEn = await ctx.db
        .query("unitMetadata")
        // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber).eq("language", "en"))
        .collect();
      const eligibleEn = allowOffline ? (allEn as any[]) : (allEn as any[]).filter((m) => m?.isOffline !== true);
      const picked = pickBestByRelease(eligibleEn as any[], allowPreview);
      if (picked) return picked;
    }

    return metadata;
  },
});

// Get all units metadata for a specific language
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getAllUnitsMetadata = query({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.optional(v.string()), // Default: "en"
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const language = args.language || "en";
    const user = await getCurrentUser(ctx);
    const allowPreview = user?.role === "superadmin";
    const allowOffline = user?.role === "admin" || user?.role === "superadmin";
    
    // This is not perfectly efficient as we can't sort by unitNumber with the language index easily
    // But for <100 units it's fine
    const allMetadata = await ctx.db.query("unitMetadata").filter((q) => q.eq(q.field("language"), language)).collect();
    const filtered = (allMetadata as any[]).filter((m) => {
      if (!allowOffline && (m as any).isOffline === true) return false;
      const s = (m as any).releaseStatus;
      if (s === "offline") return false;
      if (allowPreview) return isPreviewStatus(s) || isPublishedStatus(s);
      return isPublishedStatus(s);
    });
      
    // If empty and not English, try fallback
    if (filtered.length === 0 && language !== "en") {
      const allEn = await ctx.db.query("unitMetadata").filter((q) => q.eq(q.field("language"), "en")).collect();
      const filteredEn = (allEn as any[]).filter((m) => {
        if (!allowOffline && (m as any).isOffline === true) return false;
        const s = (m as any).releaseStatus;
        if (s === "offline") return false;
        if (allowPreview) return isPreviewStatus(s) || isPublishedStatus(s);
        return isPublishedStatus(s);
      });
      return filteredEn.sort((a, b) => a.unitNumber - b.unitNumber);
    }

    // Deduplicate by unitNumber: prefer preview (superadmin) else published.
    const bestByUnit = new Map<number, any>();
    for (const m of filtered as any[]) {
      const existing = bestByUnit.get(m.unitNumber);
      if (!existing) {
        bestByUnit.set(m.unitNumber, m);
        continue;
      }
      const picked = pickBestByRelease([existing, m], allowPreview);
      if (picked) bestByUnit.set(m.unitNumber, picked);
    }

    return Array.from(bestByUnit.values()).sort((a, b) => a.unitNumber - b.unitNumber);
  },
});

// Get unit content for a specific language (relational - uses FK to unitMetadata)
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getUnitContent = query({
  args: {
    unitNumber: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.optional(v.string()), // Default: "en"
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      throw new Error("UNIT_LOCKED");
    }

    const language = args.language || "en";

    // Referential Integrity: Check if unitMetadata exists (Master-Table)
    const metadata = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", language)
      )
      .first();

    // Fallback to English if requested language not found
    const finalLanguage = metadata ? language : (language !== "en" ? "en" : language);
    const finalMetadata = metadata || await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", "en")
      )
      .first();

    if (!finalMetadata) {
      throw new Error(`Unit ${args.unitNumber} (${finalLanguage}) not found in unitMetadata`);
    }

    // Get all content for this unit and language (FK: unitNumber + language)
    const contents = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", finalLanguage)
      )
      .collect();
    
    // Convert array to object with contentType as keys
    const result: Record<string, string> = {};
    for (const content of contents) {
      result[content.contentType] = content.content;
    }

    return result;
  },
});

// Get complete unit data (relational query with JOIN-equivalent logic)
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getUnitComplete = query({
  args: {
    unitNumber: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.optional(v.string()), // Default: "en"
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      throw new Error("UNIT_LOCKED");
    }

    const language = args.language || "en";

    // 1. Get metadata (Master-Table)
    let metadata = await ctx.db
      .query("unitMetadata")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", language)
      )
      .first();

    // Fallback to English if requested language not found
    const finalLanguage = metadata ? language : (language !== "en" ? "en" : language);
    if (!metadata && finalLanguage === "en") {
      metadata = await ctx.db
        .query("unitMetadata")
        // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
        .withIndex("by_unit_lang", (q) =>
          q.eq("unitNumber", args.unitNumber).eq("language", "en")
        )
        .first();
    }

    if (!metadata) {
      return null;
    }

    // 2. Get content (Foreign Key: unitNumber + language)
    const content = await ctx.db
      .query("unitContent")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", finalLanguage)
      )
      .collect();

    // 3. Get tests (Foreign Key: unitNumber + language)
    const tests = await ctx.db
      .query("unitInteractiveTests")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", finalLanguage)
      )
      .collect();

    // 4. Get module (Foreign Key: moduleId)
    const module = metadata.moduleId
      ? await ctx.db
          .query("moduleMetadata")
          // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
          .withIndex("by_module_lang", (q) =>
            q.eq("moduleId", metadata!.moduleId!).eq("language", finalLanguage)
          )
          .first()
      : null;

    return {
      metadata,
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      content: content.reduce((acc, c) => {
        acc[c.contentType] = c.content;
        return acc;
      }, {} as Record<string, string>),
      tests: tests.sort((a, b) => a.order - b.order),
      module,
    };
  },
});

// Get interactive test for a unit
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getUnitInteractiveTest = query({
  args: {
    unitNumber: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.optional(v.string()), // Default: "en"
    // Superadmin escape hatch: force the published view even when a preview
    // release exists for this unit (used by the Preview banner "show live" toggle).
    preferPublished: v.optional(v.boolean()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const language = args.language || "en";
    const user = await getCurrentUser(ctx);
    const allowPreview =
      user?.role === "superadmin" && args.preferPublished !== true;
    const allowOffline = user?.role === "admin" || user?.role === "superadmin";

    // Hide offline units for students without throwing (keeps UI resilient).
    if (!allowOffline && (await isUnitOffline(ctx, args.unitNumber))) {
      return [];
    }

    const fetchEligible = async (lang: string) => {
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      const all = await ctx.db
        .query("unitInteractiveTests")
        // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
        .withIndex("by_unit_lang", (q) =>
          q.eq("unitNumber", args.unitNumber).eq("language", lang)
        )
        .collect();

      const active = (all as any[]).filter((q: any) => q.isActive !== false);
      return active.filter((q: any) => {
        const s = q.releaseStatus;
        if (s === "offline") return false;
        if (allowPreview) return isPreviewStatus(s) || isPublishedStatus(s);
        return isPublishedStatus(s);
      });
    };

    let eligible = await fetchEligible(language);

    // Fallback to English when no exercises exist for the requested language.
    // Mirrors the pattern used by getUnitContentSections.
    if (eligible.length === 0 && language !== "en") {
      eligible = await fetchEligible("en");
    }

    // Prefer preview questions if any exist (superadmin), else published.
    const hasPreview = allowPreview && eligible.some((q: any) => isPreviewStatus(q.releaseStatus));
    const pool = hasPreview ? eligible.filter((q: any) => isPreviewStatus(q.releaseStatus)) : eligible;

    const maxVersion = pool.reduce((m: number, q: any) => Math.max(m, q.unitVersion ?? 1), 1);
    const questions = pool.filter((q: any) => (q.unitVersion ?? 1) === maxVersion);

    // Sort by order only (Q1, Q2, ... Q45)
    return questions.sort((a, b) => a.order - b.order);
  },
});

// Content-Studio Preview banner: reports whether an active preview release
// exists for a unit alongside the published release. Superadmin-only —
// non-superadmins never see a preview overlay in the first place, so the
// query intentionally returns `hasActivePreview: false` for them.
//
// Backs the sticky Preview banner in `UnitView` (frontend). The banner shows
// vocab counts + version numbers for both preview and published pools and
// offers a "show live" toggle that flips `preferPublished=true` on the other
// unit queries.
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getUnitPreviewOverlayInfo = query({
  args: {
    unitNumber: v.number(),
  },
  returns: v.object({
    isSuperadmin: v.boolean(),
    hasActivePreview: v.boolean(),
    previewUnitVersion: v.optional(v.number()),
    publishedUnitVersion: v.optional(v.number()),
    vocabPreviewCount: v.number(),
    vocabPublishedCount: v.number(),
    contentPreviewCount: v.number(),
    contentPublishedCount: v.number(),
    testsPreviewCount: v.number(),
    testsPublishedCount: v.number(),
  }),
  // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const isSuperadmin = user?.role === "superadmin";

    const empty = {
      isSuperadmin,
      hasActivePreview: false,
      previewUnitVersion: undefined as number | undefined,
      publishedUnitVersion: undefined as number | undefined,
      vocabPreviewCount: 0,
      vocabPublishedCount: 0,
      contentPreviewCount: 0,
      contentPublishedCount: 0,
      testsPreviewCount: 0,
      testsPublishedCount: 0,
    };

    if (!isSuperadmin) return empty;

    // Vocabulary (release-independent language: courseVocabulary rows are
    // not language-scoped; the UI queries them by unit).
    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    const vocabRows = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();

    let vocabPreviewCount = 0;
    let vocabPublishedCount = 0;
    let previewUnitVersion: number | undefined = undefined;
    let publishedUnitVersion: number | undefined = undefined;

    for (const row of vocabRows as any[]) {
      if (row.isActive === false) continue;
      const s = row.releaseStatus;
      if (isPreviewStatus(s)) {
        vocabPreviewCount += 1;
        const v = Number(row.unitVersion ?? 1);
        if (Number.isFinite(v) && (previewUnitVersion === undefined || v > previewUnitVersion)) {
          previewUnitVersion = v;
        }
      } else if (isPublishedStatus(s)) {
        vocabPublishedCount += 1;
        const v = Number(row.unitVersion ?? 1);
        if (Number.isFinite(v) && (publishedUnitVersion === undefined || v > publishedUnitVersion)) {
          publishedUnitVersion = v;
        }
      }
    }

    // Content rows (across all languages / contentTypes) — count active rows
    // per release status. Used by the banner "content sections" summary.
    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    const contentRows = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();

    let contentPreviewCount = 0;
    let contentPublishedCount = 0;
    for (const row of contentRows as any[]) {
      if (row.isActive === false) continue;
      const s = row.releaseStatus;
      if (isPreviewStatus(s)) contentPreviewCount += 1;
      else if (isPublishedStatus(s)) contentPublishedCount += 1;
    }

    // Interactive tests (across all languages) — count active rows per release status.
    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    const testRows = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();

    let testsPreviewCount = 0;
    let testsPublishedCount = 0;
    for (const row of testRows as any[]) {
      if (row.isActive === false) continue;
      const s = row.releaseStatus;
      if (isPreviewStatus(s)) testsPreviewCount += 1;
      else if (isPublishedStatus(s)) testsPublishedCount += 1;
    }

    const hasActivePreview =
      vocabPreviewCount > 0 || contentPreviewCount > 0 || testsPreviewCount > 0;

    return {
      isSuperadmin,
      hasActivePreview,
      previewUnitVersion,
      publishedUnitVersion,
      vocabPreviewCount,
      vocabPublishedCount,
      contentPreviewCount,
      contentPublishedCount,
      testsPreviewCount,
      testsPublishedCount,
    };
  },
});

// Get unit content sections (Overview, Grammar, Phrases, Dialogues)
// Relational: Uses FK relationship to unitMetadata for referential integrity
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getUnitContentSections = query({
  args: {
    unitNumber: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.optional(v.string()), // Default: "en"
    // Superadmin escape hatch: force the published view even when a preview
    // release exists for this unit (used by the Preview banner "show live" toggle).
    preferPublished: v.optional(v.boolean()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const language = args.language || "en";
    const user = await getCurrentUser(ctx);
    const allowPreview =
      user?.role === "superadmin" && args.preferPublished !== true;
    const allowOffline = user?.role === "admin" || user?.role === "superadmin";

    // Hide offline units for students without throwing (keeps UI resilient).
    if (!allowOffline && (await isUnitOffline(ctx, args.unitNumber))) {
      return {};
    }
    
    // Referential Integrity: Check if unitMetadata exists (Master-Table)
    let metadata = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", language)
      )
      .collect();

    const pickedMeta = pickBestByRelease(metadata as any[], allowPreview);
    const finalLanguage = pickedMeta ? language : (language !== "en" ? "en" : language);

    // Fallback to English if requested language not found
    if (!pickedMeta && finalLanguage === "en") {
      const metaEn = await ctx.db
        .query("unitMetadata")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber).eq("language", "en"))
        .collect();
      // Not used further except as existence check; keep behavior consistent.
      pickBestByRelease(metaEn as any[], allowPreview);
    }

    // Get content (FK: unitNumber + language)
    const all = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) => 
        q.eq("unitNumber", args.unitNumber).eq("language", finalLanguage)
      )
      .collect();
      
    const result: Record<string, string> = {};
    // Versioning/soft-archive:
    // - treat undefined isActive as active
    // - pick highest unitVersion per contentType (defaults to 1)
    const byType = new Map<string, any>();
    const eligible = (all as any[]).filter((c: any) => {
      if (c.isActive === false) return false;
      const s = c.releaseStatus;
      if (s === "offline") return false;
      if (allowPreview) return isPreviewStatus(s) || isPublishedStatus(s);
      return isPublishedStatus(s);
    });

    // Prefer preview content per contentType if present (superadmin)
    for (const c of eligible) {
      const type = String(c.contentType);
      const prev = byType.get(type);

      const prevStatus = prev?.releaseStatus;
      const cStatus = c?.releaseStatus;
      const prevRank = allowPreview && isPreviewStatus(prevStatus) ? 2 : 1;
      const cRank = allowPreview && isPreviewStatus(cStatus) ? 2 : 1;

      const v = c.unitVersion ?? c.version ?? 1;
      const prevV = prev ? (prev.unitVersion ?? prev.version ?? 1) : -1;

      if (!prev) {
        byType.set(type, c);
        continue;
      }

      if (cRank > prevRank) {
        byType.set(type, c);
        continue;
      }

      if (cRank === prevRank && v > prevV) {
        byType.set(type, c);
      }
    }

    for (const [type, c] of byType.entries()) result[type] = c.content;
    
    return result;
  },
});

// ============= DAILY ACTIVITY =============

export async function upsertDailyActivityByUserId(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    unitsCompleted?: number;
    exercisesCompleted?: number;
    xpEarned?: number;
  }
) {
  // Get today at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  // Check if activity exists for today
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  const existing = await ctx.db
    .query("dailyActivity")
    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).eq("activityDate", todayTimestamp)
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      unitsCompleted: existing.unitsCompleted + (args.unitsCompleted ?? 0),
      exercisesCompleted:
        existing.exercisesCompleted + (args.exercisesCompleted ?? 0),
      xpEarned: existing.xpEarned + (args.xpEarned ?? 0),
    });
    return existing._id;
  }

  // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
  return await ctx.db.insert("dailyActivity", {
    userId,
    activityDate: todayTimestamp,
    unitsCompleted: args.unitsCompleted ?? 0,
    exercisesCompleted: args.exercisesCompleted ?? 0,
    xpEarned: args.xpEarned ?? 0,
  });
}

// Get daily activity
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getDailyActivity = query({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    days: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const daysToFetch = args.days ?? 30;
    const dayMs = 24 * 60 * 60 * 1000;
    const endOfToday = new Date();
    endOfToday.setHours(0, 0, 0, 0);
    // Inclusive window: "last N days" should include the earliest day fully (midnight boundary).
    const startDate = endOfToday.getTime() - (Math.max(1, daysToFetch) - 1) * dayMs;

    return await ctx.db
      .query("dailyActivity")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .filter((q) => q.gte(q.field("activityDate"), startDate))
      .collect();
  },
});

// Log daily activity
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const logActivity = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    unitsCompleted: v.optional(v.number()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    exercisesCompleted: v.optional(v.number()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    xpEarned: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    return await upsertDailyActivityByUserId(ctx, user._id, {
      unitsCompleted: args.unitsCompleted,
      exercisesCompleted: args.exercisesCompleted,
      xpEarned: args.xpEarned,
    });
  },
});

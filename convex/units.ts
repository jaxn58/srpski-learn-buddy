import { v } from "convex/values";
import { mutation, query, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";

// Get unit explanation
export const getExplanation = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Try unitExplanations FIRST (has correct data for most units)
    const explanation = await ctx.db
      .query("unitExplanations")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .first();

    if (explanation && (explanation.overview || explanation.grammarExplained || explanation.practiceExamples)) {
      return {
        unitNumber: args.unitNumber,
        overview: explanation.overview || null,
        grammarExplained: explanation.grammarExplained || null,
        practiceExamples: explanation.practiceExamples || null,
      };
    }

    console.log(`[getExplanation] No content in unitExplanations, trying unitContent for unit ${args.unitNumber}`);

    // Fallback: Try the new unitContent table
    const [overview, grammar, practice] = await Promise.all([
      ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang_type", (q) =>
          q.eq("unitNumber", args.unitNumber).eq("language", "en").eq("contentType", "overview")
        )
        .first(),
      ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang_type", (q) =>
          q.eq("unitNumber", args.unitNumber).eq("language", "en").eq("contentType", "grammar")
        )
        .first(),
      ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang_type", (q) =>
          q.eq("unitNumber", args.unitNumber).eq("language", "en").eq("contentType", "practice")
        )
        .first()
    ]);

    console.log(`[getExplanation] unitContent results for unit ${args.unitNumber}:`, {
      overviewFound: !!overview,
      grammarFound: !!grammar,
      practiceFound: !!practice,
      overviewLength: overview?.content?.length || 0,
      grammarLength: grammar?.content?.length || 0,
      practiceLength: practice?.content?.length || 0
    });

    // If we have content from unitContent, use it
    if (overview?.content || grammar?.content || practice?.content) {
      console.log(`[getExplanation] Using content from unitContent table for unit ${args.unitNumber}`);
      return {
        unitNumber: args.unitNumber,
        overview: overview?.content || null,
        grammarExplained: grammar?.content || null,
        practiceExamples: practice?.content || null,
      };
    }

    console.log(`[getExplanation] No content found anywhere for unit ${args.unitNumber}`);
    // No content found in either table
    return {
      unitNumber: args.unitNumber,
      overview: null,
      grammarExplained: null,
      practiceExamples: null,
    };
  },
});

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

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

  if (subscription?.maxAccessibleUnits && unitNumber <= subscription.maxAccessibleUnits) {
    return true;
  }

  // Paid subscriptions get full access (if within total course length)
  if (subscription && subscription.planType !== "beta" && unitNumber <= 27) {
    return true;
  }

  // Fallback: Beta Tester Flag (Module 1: Units 1-6)
  if (user.isBetaTester && unitNumber <= 6) {
    return true;
  }

  return unlockedByProgress;
}


// Get all unit explanations
export const getAllExplanations = query({
  handler: async (ctx) => {
    return await ctx.db.query("unitExplanations").collect();
  },
});

// ============= NEW MULTI-LANGUAGE CONTENT TABLE =============

// Insert unit content (for migration script - no auth required)
export const insertUnitContent = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    contentType: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) =>
        q
          .eq("unitNumber", args.unitNumber)
          .eq("language", args.language)
          .eq("contentType", args.contentType)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        content: args.content,
      });
      return existing._id;
    }

    // Insert new
    return await ctx.db.insert("unitContent", {
      unitNumber: args.unitNumber,
      language: args.language,
      contentType: args.contentType,
      content: args.content,
    });
  },
});

// Get unit content for a specific language
export const getUnitContent = query({
  args: {
    unitNumber: v.number(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      throw new Error("UNIT_LOCKED");
    }

    const language = args.language || "en";

    // Get all content for this unit and language
    const contents = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", language)
      )
      .collect();

    // Convert array to object with contentType as keys
    const result: Record<string, string> = {};
    for (const content of contents) {
      result[content.contentType] = content.content;
    }

    // If no content found in new table, fallback to old table (for backward compatibility)
    if (contents.length === 0) {
      const explanation = await ctx.db
        .query("unitExplanations")
        .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
        .first();

      if (explanation) {
        // Map old structure to new structure
        result.overview = explanation.overview;
        result.grammar = explanation.grammarExplained;
        result.practice = explanation.practiceExamples;
        // Note: bookReference is no longer migrated
      }
    }

    return result;
  },
});

// Create/update unit explanation (admin only)
export const upsertExplanation = mutation({
  args: {
    unitNumber: v.number(),
    overview: v.string(),
    grammarExplained: v.string(),
    practiceExamples: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("unitExplanations")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        overview: args.overview,
        grammarExplained: args.grammarExplained,
        practiceExamples: args.practiceExamples,
      });
      return existing._id;
    }

    return await ctx.db.insert("unitExplanations", args);
  },
});

// Update German translations for unit explanation (admin only)
export const updateGermanTranslations = mutation({
  args: {
    unitNumber: v.number(),
    overviewGerman: v.optional(v.string()),
    grammarExplainedGerman: v.optional(v.string()),
    practiceExamplesGerman: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("unitExplanations")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .first();

    if (!existing) {
      throw new Error(`Unit explanation for unit ${args.unitNumber} not found`);
    }

    const updates: Record<string, unknown> = {};
    if (args.overviewGerman !== undefined) updates.overviewGerman = args.overviewGerman;
    if (args.grammarExplainedGerman !== undefined) updates.grammarExplainedGerman = args.grammarExplainedGerman;
    if (args.practiceExamplesGerman !== undefined) updates.practiceExamplesGerman = args.practiceExamplesGerman;

    await ctx.db.patch(existing._id, updates);
    return existing._id;
  },
});

// Temporary mutation to update German translations (for scripts - no auth required)
// TODO: Remove this after translations are complete and use updateGermanTranslations instead
export const updateGermanTranslationsScript = mutation({
  args: {
    unitNumber: v.number(),
    overviewGerman: v.optional(v.string()),
    grammarExplainedGerman: v.optional(v.string()),
    practiceExamplesGerman: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("unitExplanations")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .first();

    if (!existing) {
      throw new Error(`Unit explanation for unit ${args.unitNumber} not found`);
    }

    const updates: Record<string, unknown> = {};
    if (args.overviewGerman !== undefined) updates.overviewGerman = args.overviewGerman;
    if (args.grammarExplainedGerman !== undefined) updates.grammarExplainedGerman = args.grammarExplainedGerman;
    if (args.practiceExamplesGerman !== undefined) updates.practiceExamplesGerman = args.practiceExamplesGerman;

    await ctx.db.patch(existing._id, updates);
    return existing._id;
  },
});

// Seed unit explanation (for data migration - no auth required)
// Remove this after migration is complete
export const seedExplanation = mutation({
  args: {
    unitNumber: v.number(),
    overview: v.string(),
    grammarExplained: v.string(),
    practiceExamples: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("unitExplanations")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        overview: args.overview,
        grammarExplained: args.grammarExplained,
        practiceExamples: args.practiceExamples,
      });
      return existing._id;
    }

    // Insert new
    return await ctx.db.insert("unitExplanations", args);
  },
});

// Remove bookReference fields from all unitExplanations (cleanup migration - no auth required for one-time cleanup)
export const removeBookReferenceFields = mutation({
  handler: async (ctx) => {
    const allExplanations = await ctx.db.query("unitExplanations").collect();
    let updated = 0;
    
    for (const explanation of allExplanations) {
      // Get full document to check for bookReference fields
      const doc = await ctx.db.get(explanation._id);
      if (doc && ('bookReference' in doc || 'bookReferenceGerman' in doc)) {
        // Create new object without bookReference fields
        const { bookReference, bookReferenceGerman, ...cleanDoc } = doc as any;
        
        // Replace document without those fields
        await ctx.db.replace(explanation._id, cleanDoc);
        updated++;
      }
    }
    
    return { updated, total: allExplanations.length };
  },
});

// ============= DAILY ACTIVITY =============

// Get daily activity
export const getDailyActivity = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const daysToFetch = args.days ?? 30;
    const startDate = Date.now() - daysToFetch * 24 * 60 * 60 * 1000;

    return await ctx.db
      .query("dailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .filter((q) => q.gte(q.field("activityDate"), startDate))
      .collect();
  },
});

// Log daily activity
export const logActivity = mutation({
  args: {
    unitsCompleted: v.optional(v.number()),
    exercisesCompleted: v.optional(v.number()),
    xpEarned: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Get today at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Check if activity exists for today
    const existing = await ctx.db
      .query("dailyActivity")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("activityDate", todayTimestamp)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        unitsCompleted: existing.unitsCompleted + (args.unitsCompleted ?? 0),
        exercisesCompleted: existing.exercisesCompleted + (args.exercisesCompleted ?? 0),
        xpEarned: existing.xpEarned + (args.xpEarned ?? 0),
      });
      return existing._id;
    }

    return await ctx.db.insert("dailyActivity", {
      userId: user._id,
      activityDate: todayTimestamp,
      unitsCompleted: args.unitsCompleted ?? 0,
      exercisesCompleted: args.exercisesCompleted ?? 0,
      xpEarned: args.xpEarned ?? 0,
    });
  },
});


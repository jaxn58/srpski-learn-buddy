import { v } from "convex/values";
import { mutation, query, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";

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
  if (!user) return false;

  // Admins have full access
  if (user.role === "admin" || user.role === "superadmin") {
    return true;
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

  // Paid subscriptions get full access
  if (subscription && subscription.planType !== "beta" && unitNumber <= 27) {
    return true;
  }

  // Fallback: Beta Tester Flag
  if (user.isBetaTester && unitNumber <= 5) {
    return true;
  }

  return false;
}

// Get unit explanation
export const getExplanation = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await checkUnitAccess(ctx, args.unitNumber);
    if (!hasAccess) {
      throw new Error("UNIT_LOCKED");
    }

    const user = await getCurrentUser(ctx);
    const userLanguage = user?.learningLanguage || 'en';
    
    const explanation = await ctx.db
      .query("unitExplanations")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .first();
    
    if (!explanation) {
      return null;
    }
    
    // Return German version if available and user language is German
    if (userLanguage === 'de' && explanation.overviewGerman) {
      return {
        ...explanation,
        overview: explanation.overviewGerman,
        grammarExplained: explanation.grammarExplainedGerman || explanation.grammarExplained,
        practiceExamples: explanation.practiceExamplesGerman || explanation.practiceExamples,
        bookReference: explanation.bookReferenceGerman || explanation.bookReference,
      };
    }
    
    // Return English version (default)
    return explanation;
  },
});

// Get all unit explanations
export const getAllExplanations = query({
  handler: async (ctx) => {
    return await ctx.db.query("unitExplanations").collect();
  },
});

// Create/update unit explanation (admin only)
export const upsertExplanation = mutation({
  args: {
    unitNumber: v.number(),
    overview: v.string(),
    grammarExplained: v.string(),
    practiceExamples: v.string(),
    bookReference: v.optional(v.string()),
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
        bookReference: args.bookReference,
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
    bookReferenceGerman: v.optional(v.string()),
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
    if (args.bookReferenceGerman !== undefined) updates.bookReferenceGerman = args.bookReferenceGerman;

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
    bookReferenceGerman: v.optional(v.string()),
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
    if (args.bookReferenceGerman !== undefined) updates.bookReferenceGerman = args.bookReferenceGerman;

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
    bookReference: v.optional(v.string()),
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
        bookReference: args.bookReference,
      });
      return existing._id;
    }

    // Insert new
    return await ctx.db.insert("unitExplanations", args);
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


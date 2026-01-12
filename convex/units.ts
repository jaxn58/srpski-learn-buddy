import { v } from "convex/values";
import { mutation, query, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";

/**
 * @deprecated Use getUnitContent instead. This query will be removed after migration.
 * Get unit explanation (legacy - for backward compatibility only)
 */
export const getExplanation = query({
  args: {
    unitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    console.warn(
      `[DEPRECATED] getExplanation is deprecated. Use getUnitContent instead for unit ${args.unitNumber}`
    );

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
    const [overview, grammar] = await Promise.all([
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
        .first()
    ]);

    console.log(`[getExplanation] unitContent results for unit ${args.unitNumber}:`, {
      overviewFound: !!overview,
      grammarFound: !!grammar,
      overviewLength: overview?.content?.length || 0,
      grammarLength: grammar?.content?.length || 0
    });

    // If we have content from unitContent, use it
    if (overview?.content || grammar?.content) {
      console.log(`[getExplanation] Using content from unitContent table for unit ${args.unitNumber}`);
      return {
        unitNumber: args.unitNumber,
        overview: overview?.content || null,
        grammarExplained: grammar?.content || null,
        practiceExamples: null,
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

  // Fallback: Beta Tester Flag (first 3 units of Module 1)
  if (user.isBetaTester && unitNumber <= 3) {
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

// ============= NEW MULTI-LANGUAGE METADATA (UNIT) =============

// Insert unit metadata (for migration script)
export const insertUnitMetadata = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    title: v.string(),
    topics: v.array(v.string()),
    grammarFocus: v.array(v.string()),
    vocabularyThemes: v.array(v.string()),
    moduleId: v.optional(v.string()), // "foundation", "daily-life", etc.
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", args.language)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        topics: args.topics,
        grammarFocus: args.grammarFocus,
        vocabularyThemes: args.vocabularyThemes,
        ...(args.moduleId !== undefined && { moduleId: args.moduleId }),
      });
      return existing._id;
    }

    return await ctx.db.insert("unitMetadata", {
      unitNumber: args.unitNumber,
      language: args.language,
      title: args.title,
      topics: args.topics,
      grammarFocus: args.grammarFocus,
      vocabularyThemes: args.vocabularyThemes,
      moduleId: args.moduleId,
    });
  },
});

// Get unit metadata for a specific language
export const getUnitMetadata = query({
  args: {
    unitNumber: v.number(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    const metadata = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", language)
      )
      .first();

    // Fallback to English if requested language not found
    if (!metadata && language !== "en") {
      const enMetadata = await ctx.db
        .query("unitMetadata")
        .withIndex("by_unit_lang", (q) =>
          q.eq("unitNumber", args.unitNumber).eq("language", "en")
        )
        .first();
      
      if (enMetadata) return enMetadata;
    }

    return metadata;
  },
});

// Get all units metadata for a specific language
export const getAllUnitsMetadata = query({
  args: {
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    // This is not perfectly efficient as we can't sort by unitNumber with the language index easily
    // But for <100 units it's fine
    const allMetadata = await ctx.db
      .query("unitMetadata")
      .filter((q) => q.eq(q.field("language"), language))
      .collect();
      
    // If empty and not English, try fallback
    if (allMetadata.length === 0 && language !== "en") {
      return await ctx.db
        .query("unitMetadata")
        .filter((q) => q.eq(q.field("language"), "en"))
        .collect();
    }

    return allMetadata.sort((a, b) => a.unitNumber - b.unitNumber);
  },
});

// Get all units for a specific module
// DEPRECATED: Use getUnitsByModuleSlug or getUnitsByModuleId instead
export const getUnitsByModule = query({
  args: {
    moduleId: v.string(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    const units = await ctx.db
      .query("unitMetadata")
      .withIndex("by_module", (q) => q.eq("moduleId", args.moduleId))
      .filter((q) => q.eq(q.field("language"), language))
      .collect();
      
    // If empty and not English, try fallback
    if (units.length === 0 && language !== "en") {
      return await ctx.db
        .query("unitMetadata")
        .withIndex("by_module", (q) => q.eq("moduleId", args.moduleId))
        .filter((q) => q.eq(q.field("language"), "en"))
        .collect();
    }

    return units.sort((a, b) => a.unitNumber - b.unitNumber);
  },
});

// ============= NEW CONSOLIDATED MODULE STRUCTURE =============

// Get all units for a specific module by moduleMetadataId (new structure)
export const getUnitsByModuleId = query({
  args: {
    moduleMetadataId: v.id("moduleMetadata"),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    const units = await ctx.db
      .query("unitMetadata")
      .withIndex("by_module_metadata", (q) => q.eq("moduleMetadataId", args.moduleMetadataId))
      .filter((q) => q.eq(q.field("language"), language))
      .collect();
      
    // If empty and not English, try fallback
    if (units.length === 0 && language !== "en") {
      return await ctx.db
        .query("unitMetadata")
        .withIndex("by_module_metadata", (q) => q.eq("moduleMetadataId", args.moduleMetadataId))
        .filter((q) => q.eq(q.field("language"), "en"))
        .collect();
    }

    return units.sort((a, b) => a.unitNumber - b.unitNumber);
  },
});

// Get all units for a specific module by slug (for URL compatibility)
export const getUnitsByModuleSlug = query({
  args: {
    slug: v.string(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    // First, find the module by slug
    const module = await ctx.db
      .query("moduleMetadata")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    
    if (!module) {
      return [];
    }
    
    // Then get units by moduleMetadataId
    const units = await ctx.db
      .query("unitMetadata")
      .withIndex("by_module_metadata", (q) => q.eq("moduleMetadataId", module._id))
      .filter((q) => q.eq(q.field("language"), language))
      .collect();
      
    // If empty and not English, try fallback
    if (units.length === 0 && language !== "en") {
      return await ctx.db
        .query("unitMetadata")
        .withIndex("by_module_metadata", (q) => q.eq("moduleMetadataId", module._id))
        .filter((q) => q.eq(q.field("language"), "en"))
        .collect();
    }

    return units.sort((a, b) => a.unitNumber - b.unitNumber);
  },
});

// Update moduleMetadataId for a unit metadata entry (for migration)
export const updateUnitModuleMetadataId = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    moduleMetadataId: v.id("moduleMetadata"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", args.language)
      )
      .first();

    if (!existing) {
      throw new Error(`Unit metadata not found for unit ${args.unitNumber}, language ${args.language}`);
    }

    await ctx.db.patch(existing._id, {
      moduleMetadataId: args.moduleMetadataId,
    });

    return existing._id;
  },
});

// Update moduleId for a unit metadata entry (for migration)
export const updateUnitModuleId = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    moduleId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", args.language)
      )
      .first();

    if (!existing) {
      throw new Error(`Unit metadata not found for unit ${args.unitNumber}, language ${args.language}`);
    }

    await ctx.db.patch(existing._id, {
      moduleId: args.moduleId,
    });

    return existing._id;
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

// Get unit content for a specific language (relational - uses FK to unitMetadata)
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
export const getUnitComplete = query({
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

    // 1. Get metadata (Master-Table)
    let metadata = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", language)
      )
      .first();

    // Fallback to English if requested language not found
    const finalLanguage = metadata ? language : (language !== "en" ? "en" : language);
    if (!metadata && finalLanguage === "en") {
      metadata = await ctx.db
        .query("unitMetadata")
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
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", finalLanguage)
      )
      .collect();

    // 3. Get tests (Foreign Key: unitNumber + language)
    const tests = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", finalLanguage)
      )
      .collect();

    // 4. Get module (Foreign Key: moduleId)
    const module = metadata.moduleId
      ? await ctx.db
          .query("moduleMetadata")
          .withIndex("by_module_lang", (q) =>
            q.eq("moduleId", metadata!.moduleId!).eq("language", finalLanguage)
          )
          .first()
      : null;

    return {
      metadata,
      content: content.reduce((acc, c) => {
        acc[c.contentType] = c.content;
        return acc;
      }, {} as Record<string, string>),
      tests: tests.sort((a, b) => a.order - b.order),
      module,
    };
  },
});

// Insert unit interactive test question (for migration script)
export const insertUnitInteractiveTest = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    category: v.string(),
    categoryInstructions: v.optional(v.string()),
    questionId: v.string(),
    questionType: v.string(),
    question: v.string(),
    correctAnswer: v.string(),
    acceptableAlternatives: v.optional(v.array(v.string())),
    options: v.optional(v.array(v.string())),
    hint: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if question already exists (by questionId)
    const existing = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_question_id", (q) => q.eq("questionId", args.questionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        unitNumber: args.unitNumber,
        language: args.language,
        category: args.category,
        categoryInstructions: args.categoryInstructions,
        questionType: args.questionType,
        question: args.question,
        correctAnswer: args.correctAnswer,
        acceptableAlternatives: args.acceptableAlternatives,
        options: args.options,
        hint: args.hint,
        order: args.order,
      });
      return existing._id;
    }

    return await ctx.db.insert("unitInteractiveTests", {
      unitNumber: args.unitNumber,
      language: args.language,
      category: args.category,
      categoryInstructions: args.categoryInstructions,
      questionId: args.questionId,
      questionType: args.questionType,
      question: args.question,
      correctAnswer: args.correctAnswer,
      acceptableAlternatives: args.acceptableAlternatives,
      options: args.options,
      hint: args.hint,
      order: args.order,
    });
  },
});

// Get interactive test for a unit
export const getUnitInteractiveTest = query({
  args: {
    unitNumber: v.number(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    // Fetch all questions for this unit, sorted by order
    const questions = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => 
        q.eq("unitNumber", args.unitNumber).eq("language", language)
      )
      .collect();
      
    // Sort by order only (Q1, Q2, ... Q45)
    return questions.sort((a, b) => a.order - b.order);
  },
});

// Get unit content sections (Overview, Grammar, Phrases, Dialogues)
// Relational: Uses FK relationship to unitMetadata for referential integrity
export const getUnitContentSections = query({
  args: {
    unitNumber: v.number(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    // Referential Integrity: Check if unitMetadata exists (Master-Table)
    let metadata = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("language", language)
      )
      .first();

    // Fallback to English if requested language not found
    const finalLanguage = metadata ? language : (language !== "en" ? "en" : language);
    if (!metadata && finalLanguage === "en") {
      metadata = await ctx.db
        .query("unitMetadata")
        .withIndex("by_unit_lang", (q) =>
          q.eq("unitNumber", args.unitNumber).eq("language", "en")
        )
        .first();
    }

    // Get content (FK: unitNumber + language)
    const contents = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) => 
        q.eq("unitNumber", args.unitNumber).eq("language", finalLanguage)
      )
      .collect();
      
    const result: Record<string, string> = {};
    for (const content of contents) {
      result[content.contentType] = content.content;
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

/**
 * @deprecated Delete all unitExplanations entries (use only after migration is complete)
 * WARNING: This will delete all entries from unitExplanations table.
 * Only use this after:
 * 1. Migration to unitContent is complete
 * 2. Validation scripts pass
 * 3. Frontend is tested and working
 */
export const deleteAllUnitExplanations = mutation({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized - Admin access required");
    }

    const allExplanations = await ctx.db.query("unitExplanations").collect();
    let deleted = 0;

    for (const explanation of allExplanations) {
      await ctx.db.delete(explanation._id);
      deleted++;
    }

    return { deleted, total: allExplanations.length };
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

// Clean Markdown syntax from unitContent
export const cleanMarkdownInContent = mutation({
  args: {
    contentType: v.string(), // e.g. "testIntroduction"
  },
  handler: async (ctx, args) => {
    // Helper function to clean markdown
    function cleanMarkdown(text: string): string {
      if (!text) return text;
      
      let cleaned = text;
      
      // Remove bold: **text** → text
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
      
      // Remove italic: *text* → text
      // But preserve Montenegrin markers (word*)
      cleaned = cleaned.replace(/(?<![a-zA-Z0-9])\*([^*\s][^*]*?)\*(?![a-zA-Z0-9])/g, '$1');
      
      return cleaned;
    }
    
    // Get all content entries of this type
    const contents = await ctx.db
      .query("unitContent")
      .filter((q) => q.eq(q.field("contentType"), args.contentType))
      .collect();
    
    let updated = 0;
    
    for (const content of contents) {
      const cleaned = cleanMarkdown(content.content);
      
      if (cleaned !== content.content) {
        await ctx.db.patch(content._id, {
          content: cleaned
        });
        updated++;
      }
    }
    
    return { updated };
  },
});

// Clean Markdown syntax from unitInteractiveTests
export const cleanMarkdownInTests = mutation({
  args: {},
  handler: async (ctx, args) => {
    // Helper function to clean markdown
    function cleanMarkdown(text: string): string {
      if (!text) return text;
      
      let cleaned = text;
      
      // Remove bold: **text** → text
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
      
      // Remove italic: *text* → text
      // But preserve Montenegrin markers (word*)
      cleaned = cleaned.replace(/(?<![a-zA-Z0-9])\*([^*\s][^*]*?)\*(?![a-zA-Z0-9])/g, '$1');
      
      return cleaned;
    }
    
    // Get all test questions
    const tests = await ctx.db
      .query("unitInteractiveTests")
      .collect();
    
    let updated = 0;
    let categoriesCleaned = 0;
    let questionsCleaned = 0;
    
    for (const test of tests) {
      const cleanedInstructions = test.categoryInstructions ? cleanMarkdown(test.categoryInstructions) : test.categoryInstructions;
      const cleanedQuestion = cleanMarkdown(test.question);
      
      const instructionsChanged = cleanedInstructions !== test.categoryInstructions;
      const questionChanged = cleanedQuestion !== test.question;
      
      if (instructionsChanged || questionChanged) {
        await ctx.db.patch(test._id, {
          ...(instructionsChanged && { categoryInstructions: cleanedInstructions }),
          ...(questionChanged && { question: cleanedQuestion }),
        });
        updated++;
        if (instructionsChanged) categoriesCleaned++;
        if (questionChanged) questionsCleaned++;
      }
    }
    
    return { updated, categoriesCleaned, questionsCleaned };
  },
});

// ============= CLEANUP OPERATIONS =============

// Delete unitContent entries with invalid contentTypes (for cleanup script)
export const deleteInvalidContentTypes = mutation({
  args: {
    unitNumbers: v.array(v.number()), // Array of unit numbers to clean
    contentTypes: v.array(v.string()), // Array of invalid contentTypes to remove (e.g., ["practice", "bookReference"])
    dryRun: v.optional(v.boolean()), // If true, only count without deleting
  },
  handler: async (ctx, args) => {
    console.log(`[deleteInvalidContentTypes] Cleaning units: ${args.unitNumbers.join(", ")}`);
    console.log(`[deleteInvalidContentTypes] ContentTypes: ${args.contentTypes.join(", ")}`);
    console.log(`[deleteInvalidContentTypes] Dry run: ${args.dryRun ?? false}`);
    
    let found = 0;
    let deleted = 0;
    const foundEntries: Array<{ unitNumber: number; language: string; contentType: string; id: string }> = [];

    for (const unitNumber of args.unitNumbers) {
      for (const contentType of args.contentTypes) {
        // Find all entries with this contentType for this unit
        const entries = await ctx.db
          .query("unitContent")
          .filter((q) => 
            q.and(
              q.eq(q.field("unitNumber"), unitNumber),
              q.eq(q.field("contentType"), contentType as any) // Cast to bypass TypeScript check
            )
          )
          .collect();

        found += entries.length;

        for (const entry of entries) {
          foundEntries.push({
            unitNumber: entry.unitNumber,
            language: entry.language,
            contentType: entry.contentType as string,
            id: entry._id,
          });

          if (!args.dryRun) {
            await ctx.db.delete(entry._id);
            deleted++;
          }
        }
      }
    }

    console.log(`[deleteInvalidContentTypes] Found: ${found}, Deleted: ${deleted}`);
    
    return {
      found,
      deleted,
      entries: foundEntries,
      dryRun: args.dryRun ?? false,
    };
  },
});

// Legacy alias for backward compatibility
export const deleteInvalidPracticeContent = mutation({
  args: {
    unitNumbers: v.array(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(api.units.deleteInvalidContentTypes, {
      unitNumbers: args.unitNumbers,
      contentTypes: ["practice"],
      dryRun: args.dryRun,
    });
  },
});

// ============= UNIT COPYING (for migration) =============

// Copy all data from one unit to another (mutation for migration scripts)
export const copyUnitData = mutation({
  args: {
    fromUnitNumber: v.number(),
    toUnitNumber: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(`[copyUnitData] Copying Unit ${args.fromUnitNumber} to Unit ${args.toUnitNumber}`);
    
    let copied = {
      metadata: 0,
      content: 0,
      interactiveTests: 0,
      vocabulary: 0,
      explanations: 0,
    };

    // 1. Copy unitMetadata
    const metadataEntries = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.fromUnitNumber))
      .collect();
    
    for (const meta of metadataEntries) {
      // Check if already exists
      const existing = await ctx.db
        .query("unitMetadata")
        .withIndex("by_unit_lang", (q) =>
          q.eq("unitNumber", args.toUnitNumber).eq("language", meta.language)
        )
        .first();
      
      if (!existing) {
        await ctx.db.insert("unitMetadata", {
          unitNumber: args.toUnitNumber,
          language: meta.language,
          title: meta.title,
          topics: meta.topics,
          grammarFocus: meta.grammarFocus,
          vocabularyThemes: meta.vocabularyThemes,
          moduleId: meta.moduleId,
        });
        copied.metadata++;
      }
    }

    // 2. Copy unitContent
    const contentEntries = await ctx.db
      .query("unitContent")
      .filter((q) => q.eq(q.field("unitNumber"), args.fromUnitNumber))
      .collect();
    
    for (const content of contentEntries) {
      // Check if already exists
      const existing = await ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang_type", (q) =>
          q
            .eq("unitNumber", args.toUnitNumber)
            .eq("language", content.language)
            .eq("contentType", content.contentType)
        )
        .first();
      
      if (!existing) {
        await ctx.db.insert("unitContent", {
          unitNumber: args.toUnitNumber,
          language: content.language,
          contentType: content.contentType,
          content: content.content,
        });
        copied.content++;
      }
    }

    // 3. Copy unitInteractiveTests
    const testQuestions = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.fromUnitNumber))
      .collect();
    
    for (const test of testQuestions) {
      // Generate new questionId for the new unit
      const newQuestionId = test.questionId.replace(
        `u${args.fromUnitNumber}_`,
        `u${args.toUnitNumber}_`
      );
      
      // Check if already exists
      const existing = await ctx.db
        .query("unitInteractiveTests")
        .withIndex("by_question_id", (q) => q.eq("questionId", newQuestionId))
        .first();
      
      if (!existing) {
        await ctx.db.insert("unitInteractiveTests", {
          unitNumber: args.toUnitNumber,
          language: test.language,
          category: test.category,
          categoryInstructions: test.categoryInstructions,
          questionId: newQuestionId,
          questionType: test.questionType,
          question: test.question,
          correctAnswer: test.correctAnswer,
          acceptableAlternatives: test.acceptableAlternatives,
          options: test.options,
          hint: test.hint,
          order: test.order,
        });
        copied.interactiveTests++;
      }
    }

    // 4. Copy courseVocabulary
    const vocabEntries = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.fromUnitNumber))
      .collect();
    
    for (const vocab of vocabEntries) {
      // Check if already exists (same serbian word in new unit)
      const existing = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", args.toUnitNumber))
        .filter((q) => q.eq(q.field("serbian"), vocab.serbian))
        .first();
      
      if (!existing) {
        await ctx.db.insert("courseVocabulary", {
          unitNumber: args.toUnitNumber,
          serbian: vocab.serbian,
          translations: vocab.translations,
          gender: vocab.gender,
          pronunciation: vocab.pronunciation,
        });
        copied.vocabulary++;
      }
    }

    // 5. Copy unitExplanations
    const explanations = await ctx.db
      .query("unitExplanations")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.fromUnitNumber))
      .collect();
    
    for (const explanation of explanations) {
      // Check if already exists
      const existing = await ctx.db
        .query("unitExplanations")
        .withIndex("by_unit", (q) => q.eq("unitNumber", args.toUnitNumber))
        .first();
      
      if (!existing) {
        await ctx.db.insert("unitExplanations", {
          unitNumber: args.toUnitNumber,
          overview: explanation.overview,
          grammarExplained: explanation.grammarExplained,
          practiceExamples: explanation.practiceExamples,
        });
        copied.explanations++;
      }
    }

    console.log(`[copyUnitData] Copied:`, copied);
    return copied;
  },
});

// ============= CLEANUP OPERATIONS (DELETE) =============

// Delete unit metadata by ID (for cleanup scripts)
export const deleteUnitMetadata = mutation({
  args: {
    metadataId: v.id("unitMetadata"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.metadataId);
    return args.metadataId;
  },
});

// Delete unit content by ID (for cleanup scripts)
export const deleteUnitContent = mutation({
  args: {
    contentId: v.id("unitContent"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.contentId);
    return args.contentId;
  },
});

// Delete unit interactive test by ID (for cleanup scripts)
export const deleteUnitInteractiveTest = mutation({
  args: {
    testId: v.id("unitInteractiveTests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.testId);
    return args.testId;
  },
});

// Batch delete units (for cleanup scripts - deletes all data for specified units)
// NO AUTH CHECK - for admin cleanup scripts only
export const batchDeleteUnits = mutation({
  args: {
    unitNumbers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    let deleted = {
      metadata: 0,
      content: 0,
      tests: 0,
    };

    console.log(`[batchDeleteUnits] Deleting units: ${args.unitNumbers.join(", ")}`);

    for (const unitNumber of args.unitNumbers) {
      // Delete metadata (EN + DE)
      for (const lang of ["en", "de"]) {
        const metadata = await ctx.db
          .query("unitMetadata")
          .withIndex("by_unit_lang", (q) =>
            q.eq("unitNumber", unitNumber).eq("language", lang)
          )
          .first();
        
        if (metadata) {
          console.log(`[batchDeleteUnits] Deleting metadata: Unit ${unitNumber} (${lang}), ID: ${metadata._id}`);
          await ctx.db.delete(metadata._id);
          deleted.metadata++;
        }
      }

      // Delete content (EN + DE)
      for (const lang of ["en", "de"]) {
        const contents = await ctx.db
          .query("unitContent")
          .withIndex("by_unit_lang", (q) =>
            q.eq("unitNumber", unitNumber).eq("language", lang)
          )
          .collect();
        
        console.log(`[batchDeleteUnits] Found ${contents.length} content entries for Unit ${unitNumber} (${lang})`);
        for (const content of contents) {
          await ctx.db.delete(content._id);
          deleted.content++;
        }
      }

      // Delete tests (EN + DE)
      for (const lang of ["en", "de"]) {
        const tests = await ctx.db
          .query("unitInteractiveTests")
          .withIndex("by_unit_lang", (q) =>
            q.eq("unitNumber", unitNumber).eq("language", lang)
          )
          .collect();
        
        console.log(`[batchDeleteUnits] Found ${tests.length} tests for Unit ${unitNumber} (${lang})`);
        for (const test of tests) {
          await ctx.db.delete(test._id);
          deleted.tests++;
        }
      }
    }

    console.log(`[batchDeleteUnits] Total deleted: ${JSON.stringify(deleted)}`);
    return deleted;
  },
});


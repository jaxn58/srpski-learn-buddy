import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ============= HELPER FUNCTIONS =============

/**
 * Check if the request is authenticated via Clerk
 * Returns the admin user if authenticated, throws error otherwise
 */
async function requireAdmin(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized - not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Unauthorized - admin access required");
  }

  return user;
}

// ============= PUBLIC QUERIES =============

/**
 * Get all active onboarding steps for a specific language
 * Used by frontend to display onboarding to users
 */
export const getActiveOnboardingSteps = query({
  args: {
    language: v.string(), // "en", "de", "es", "fr"
  },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("onboardingSteps")
      .withIndex("by_language_active", (q) =>
        q
          .eq("language", args.language)
          .eq("isActive", true)
      )
      .collect();

    // Sort by stepNumber (ascending)
    return steps.sort((a, b) => a.stepNumber - b.stepNumber);
  },
});

// ============= ADMIN QUERIES =============

/**
 * Get all onboarding steps (including inactive ones)
 * Admin only
 */
export const getAllOnboardingSteps = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const steps = await ctx.db.query("onboardingSteps").collect();

    // Sort by language, then stepNumber
    return steps.sort((a, b) => {
      const aLang = a.language ?? "";
      const bLang = b.language ?? "";
      if (aLang !== bLang) {
        return aLang.localeCompare(bLang);
      }
      return a.stepNumber - b.stepNumber;
    });
  },
});

/**
 * Get onboarding steps for a specific language (admin view)
 * Includes both active and inactive steps
 */
export const getOnboardingStepsByLanguage = query({
  args: {
    language: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const steps = await ctx.db
      .query("onboardingSteps")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .collect();

    return steps.sort((a, b) => a.stepNumber - b.stepNumber);
  },
});

// ============= ADMIN MUTATIONS =============

/**
 * Create a new onboarding step
 * Admin only
 */
export const createOnboardingStep = mutation({
  args: {
    stepNumber: v.number(),
    language: v.string(),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    icon: v.string(),
    isActive: v.boolean(),
    backgroundColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const now = Date.now();

    const stepId = await ctx.db.insert("onboardingSteps", {
      stepNumber: args.stepNumber,
      language: args.language,
      title: args.title,
      description: args.description,
      content: args.content,
      icon: args.icon,
      isActive: args.isActive,
      backgroundColor: args.backgroundColor,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    console.log("[onboarding] Created new step:", {
      stepId,
      stepNumber: args.stepNumber,
      language: args.language,
      title: args.title,
      createdBy: user.email,
    });

    return stepId;
  },
});

/**
 * Update an existing onboarding step
 * Admin only
 */
export const updateOnboardingStep = mutation({
  args: {
    stepId: v.id("onboardingSteps"),
    stepNumber: v.optional(v.number()),
    language: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    icon: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    backgroundColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized - not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized - admin access required");
    }

    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Onboarding step not found");
    }

    const updates: Partial<Doc<"onboardingSteps">> = {
      updatedAt: Date.now(),
      updatedBy: user._id,
    };

    if (args.stepNumber !== undefined) updates.stepNumber = args.stepNumber;
    if (args.language !== undefined) updates.language = args.language;
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.content !== undefined) updates.content = args.content;
    if (args.icon !== undefined) updates.icon = args.icon;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.backgroundColor !== undefined) updates.backgroundColor = args.backgroundColor;

    await ctx.db.patch(args.stepId, updates);

    console.log("[onboarding] Updated step:", {
      stepId: args.stepId,
      updates,
      updatedBy: user.email,
    });

    return args.stepId;
  },
});

/**
 * Delete an onboarding step
 * Admin only
 */
export const deleteOnboardingStep = mutation({
  args: {
    stepId: v.id("onboardingSteps"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized - not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized - admin access required");
    }

    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Onboarding step not found");
    }

    await ctx.db.delete(args.stepId);

    console.log("[onboarding] Deleted step:", {
      stepId: args.stepId,
      stepNumber: step.stepNumber,
      language: step.language,
      title: step.title,
      deletedBy: user.email,
    });

    return { success: true };
  },
});

/**
 * Toggle step active/inactive status
 * Admin only
 */
export const toggleStepActive = mutation({
  args: {
    stepId: v.id("onboardingSteps"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized - not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized - admin access required");
    }

    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Onboarding step not found");
    }

    const newStatus = !step.isActive;

    await ctx.db.patch(args.stepId, {
      isActive: newStatus,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });

    console.log("[onboarding] Toggled step status:", {
      stepId: args.stepId,
      stepNumber: step.stepNumber,
      language: step.language,
      title: step.title,
      previousStatus: step.isActive,
      newStatus,
      toggledBy: user.email,
    });

    return { success: true, isActive: newStatus };
  },
});

/**
 * DEPRECATED: This function is for V1 row-based schema only
 * Reorder onboarding steps
 * Takes an array of step IDs in the desired order and updates their stepNumber accordingly
 * Admin only
 * 
 * @deprecated Use manual stepNumber updates via updateOnboardingStepV2 instead
 */
export const reorderOnboardingSteps = mutation({
  args: {
    stepIds: v.array(v.id("onboardingSteps")),
    language: v.string(), // Reorder only within a specific language
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized - not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized - admin access required");
    }

    // Update stepNumber for each step based on position in array
    for (let i = 0; i < args.stepIds.length; i++) {
      const stepId = args.stepIds[i];
      const step = await ctx.db.get(stepId);
      
      if (!step) {
        console.error(`[onboarding] Step not found: ${stepId}`);
        continue;
      }

      // DEPRECATED: language field no longer exists in column-based schema
      // This function should not be used anymore
      if (step.language && step.language !== args.language) {
        throw new Error(`Step ${stepId} does not belong to language ${args.language}`);
      }

      await ctx.db.patch(stepId, {
        stepNumber: i + 1, // 1-indexed
        updatedAt: Date.now(),
        updatedBy: user._id,
      });
    }

    console.log("[onboarding] Reordered steps:", {
      language: args.language,
      newOrder: args.stepIds,
      reorderedBy: user.email,
    });

    return { success: true };
  },
});

// ============= MIGRATION MUTATIONS (Admin Secret Auth) =============

/**
 * Create onboarding step with Admin Secret authentication
 * Used by migration scripts
 */
export const createOnboardingStepWithSecret = mutation({
  args: {
    adminSecret: v.string(),
    stepNumber: v.number(),
    language: v.string(),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    icon: v.string(),
    isActive: v.boolean(),
    backgroundColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify admin secret
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Invalid admin secret");
    }

    const now = Date.now();

    const stepId = await ctx.db.insert("onboardingSteps", {
      stepNumber: args.stepNumber,
      language: args.language,
      title: args.title,
      description: args.description,
      content: args.content,
      icon: args.icon,
      isActive: args.isActive,
      backgroundColor: args.backgroundColor,
      createdAt: now,
      updatedAt: now,
      createdBy: undefined, // Migration script
      updatedBy: undefined,
    });

    console.log("[onboarding] Created new step via migration:", {
      stepId,
      stepNumber: args.stepNumber,
      language: args.language,
      title: args.title,
    });

    return stepId;
  },
});

/**
 * MIGRATION HELPER: Get all onboarding steps without authentication
 * Uses ADMIN_SECRET for authentication instead of Clerk
 * Used by migration scripts only
 */
export const getAllOnboardingStepsWithSecret = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate admin secret
    if (args.adminSecret !== process.env.ADMIN_SECRET) {
      throw new Error("Unauthorized: Invalid admin secret");
    }

    const steps = await ctx.db.query("onboardingSteps").collect();

    // Sort by language, then stepNumber
    return steps.sort((a, b) => {
      if (a.language && b.language && a.language !== b.language) {
        return a.language.localeCompare(b.language);
      }
      return a.stepNumber - b.stepNumber;
    });
  },
});

// ============= V2 API - COLUMN-BASED MULTILANGUAGE =============

/**
 * Helper function to capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * V2: Get all active onboarding steps for a specific language (column-based)
 * Used by frontend to display onboarding to users
 */
export const getActiveOnboardingStepsV2 = query({
  args: {
    language: v.string(), // "en", "de", "es", "fr"
  },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("onboardingSteps")
      .withIndex("by_step_number")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const lang = capitalize(args.language);
    
    // Map to language-specific fields with fallback to English
    return steps
      .map((step) => {
        const titleKey = `title${lang}` as keyof typeof step;
        const descKey = `description${lang}` as keyof typeof step;
        const contentKey = `content${lang}` as keyof typeof step;
        
        return {
          _id: step._id,
          stepNumber: step.stepNumber,
          title: (step[titleKey] as string) || step.titleEn || "",
          description: (step[descKey] as string) || step.descriptionEn || "",
          content: (step[contentKey] as string) || step.contentEn || "",
          icon: step.icon,
          backgroundColor: step.backgroundColor,
        };
      })
      .filter((step) => step.title && step.content) // Only return steps with content
      .sort((a, b) => a.stepNumber - b.stepNumber);
  },
});

/**
 * V2: Get all onboarding steps (admin view, column-based)
 * Admin only
 */
export const getAllOnboardingStepsV2 = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const steps = await ctx.db
      .query("onboardingSteps")
      .withIndex("by_step_number")
      .collect();

    return steps.sort((a, b) => a.stepNumber - b.stepNumber);
  },
});

/**
 * V2: Create onboarding step with column-based multilanguage
 * Admin only
 */
export const createOnboardingStepV2 = mutation({
  args: {
    stepNumber: v.number(),
    titleEn: v.optional(v.string()),
    titleDe: v.optional(v.string()),
    titleEs: v.optional(v.string()),
    titleFr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    descriptionEs: v.optional(v.string()),
    descriptionFr: v.optional(v.string()),
    contentEn: v.optional(v.string()),
    contentDe: v.optional(v.string()),
    contentEs: v.optional(v.string()),
    contentFr: v.optional(v.string()),
    icon: v.string(),
    isActive: v.boolean(),
    backgroundColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const now = Date.now();

    const stepId = await ctx.db.insert("onboardingSteps", {
      stepNumber: args.stepNumber,
      titleEn: args.titleEn,
      titleDe: args.titleDe,
      titleEs: args.titleEs,
      titleFr: args.titleFr,
      descriptionEn: args.descriptionEn,
      descriptionDe: args.descriptionDe,
      descriptionEs: args.descriptionEs,
      descriptionFr: args.descriptionFr,
      contentEn: args.contentEn,
      contentDe: args.contentDe,
      contentEs: args.contentEs,
      contentFr: args.contentFr,
      icon: args.icon,
      isActive: args.isActive,
      backgroundColor: args.backgroundColor,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    console.log("[onboarding] Created new step (V2):", {
      stepId,
      stepNumber: args.stepNumber,
      titleEn: args.titleEn,
      createdBy: user.email,
    });

    return stepId;
  },
});

/**
 * V2: Update onboarding step with column-based multilanguage
 * Admin only
 */
export const updateOnboardingStepV2 = mutation({
  args: {
    stepId: v.id("onboardingSteps"),
    stepNumber: v.optional(v.number()),
    titleEn: v.optional(v.string()),
    titleDe: v.optional(v.string()),
    titleEs: v.optional(v.string()),
    titleFr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    descriptionEs: v.optional(v.string()),
    descriptionFr: v.optional(v.string()),
    contentEn: v.optional(v.string()),
    contentDe: v.optional(v.string()),
    contentEs: v.optional(v.string()),
    contentFr: v.optional(v.string()),
    icon: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    backgroundColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Onboarding step not found");
    }

    const updates: Partial<Doc<"onboardingSteps">> = {
      updatedAt: Date.now(),
      updatedBy: user._id,
    };

    if (args.stepNumber !== undefined) updates.stepNumber = args.stepNumber;
    if (args.titleEn !== undefined) updates.titleEn = args.titleEn;
    if (args.titleDe !== undefined) updates.titleDe = args.titleDe;
    if (args.titleEs !== undefined) updates.titleEs = args.titleEs;
    if (args.titleFr !== undefined) updates.titleFr = args.titleFr;
    if (args.descriptionEn !== undefined) updates.descriptionEn = args.descriptionEn;
    if (args.descriptionDe !== undefined) updates.descriptionDe = args.descriptionDe;
    if (args.descriptionEs !== undefined) updates.descriptionEs = args.descriptionEs;
    if (args.descriptionFr !== undefined) updates.descriptionFr = args.descriptionFr;
    if (args.contentEn !== undefined) updates.contentEn = args.contentEn;
    if (args.contentDe !== undefined) updates.contentDe = args.contentDe;
    if (args.contentEs !== undefined) updates.contentEs = args.contentEs;
    if (args.contentFr !== undefined) updates.contentFr = args.contentFr;
    if (args.icon !== undefined) updates.icon = args.icon;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.backgroundColor !== undefined) updates.backgroundColor = args.backgroundColor;

    await ctx.db.patch(args.stepId, updates);

    console.log("[onboarding] Updated step (V2):", {
      stepId: args.stepId,
      updates,
      updatedBy: user.email,
    });

    return args.stepId;
  },
});

/**
 * MIGRATION HELPER: Create onboarding step V2 without Clerk authentication
 * Uses ADMIN_SECRET for authentication instead of Clerk
 * Used by migration scripts only
 */
export const createOnboardingStepV2WithSecret = mutation({
  args: {
    adminSecret: v.string(), // Admin secret for authentication
    stepNumber: v.number(),
    titleEn: v.optional(v.string()),
    titleDe: v.optional(v.string()),
    titleEs: v.optional(v.string()),
    titleFr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    descriptionEs: v.optional(v.string()),
    descriptionFr: v.optional(v.string()),
    contentEn: v.optional(v.string()),
    contentDe: v.optional(v.string()),
    contentEs: v.optional(v.string()),
    contentFr: v.optional(v.string()),
    icon: v.string(),
    isActive: v.boolean(),
    backgroundColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate admin secret
    if (args.adminSecret !== process.env.ADMIN_SECRET) {
      throw new Error("Unauthorized: Invalid admin secret");
    }

    const now = Date.now();

    const stepId = await ctx.db.insert("onboardingSteps", {
      stepNumber: args.stepNumber,
      titleEn: args.titleEn,
      titleDe: args.titleDe,
      titleEs: args.titleEs,
      titleFr: args.titleFr,
      descriptionEn: args.descriptionEn,
      descriptionDe: args.descriptionDe,
      descriptionEs: args.descriptionEs,
      descriptionFr: args.descriptionFr,
      contentEn: args.contentEn,
      contentDe: args.contentDe,
      contentEs: args.contentEs,
      contentFr: args.contentFr,
      icon: args.icon,
      isActive: args.isActive,
      backgroundColor: args.backgroundColor,
      createdAt: now,
      updatedAt: now,
      // createdBy/updatedBy are optional, so we can omit them for migration
    });

    console.log("[onboarding] Created new step via migration (V2):", {
      stepId,
      stepNumber: args.stepNumber,
      titleEn: args.titleEn,
    });

    return stepId;
  },
});

/**
 * MIGRATION HELPER: Delete onboarding step without Clerk authentication
 * Uses ADMIN_SECRET for authentication instead of Clerk
 * Used by cleanup scripts only
 */
export const deleteOnboardingStepWithSecret = mutation({
  args: {
    adminSecret: v.string(),
    stepId: v.id("onboardingSteps"),
  },
  handler: async (ctx, args) => {
    // Validate admin secret
    if (args.adminSecret !== process.env.ADMIN_SECRET) {
      throw new Error("Unauthorized: Invalid admin secret");
    }

    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Onboarding step not found");
    }

    await ctx.db.delete(args.stepId);

    console.log("[onboarding] Deleted step via cleanup script:", {
      stepId: args.stepId,
      stepNumber: step.stepNumber,
    });

    return args.stepId;
  },
});

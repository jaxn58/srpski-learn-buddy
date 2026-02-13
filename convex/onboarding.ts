import { v } from "convex/values";
import { action, ActionCtx, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { callAiJson } from "./contentStudio/_shared";

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

async function requireAdminAction(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized - not authenticated");
  const user = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Unauthorized - admin access required");
  }
  return user;
}

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

// ============= ADMIN MUTATIONS =============

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

function extractVariables(content: string): string[] {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const foundVariables = new Set<string>();
  let match;
  while ((match = variableRegex.exec(content)) !== null) {
    foundVariables.add(match[1]);
  }
  return Array.from(foundVariables);
}

function diffVariables(params: { source: string[]; target: string[] }) {
  const s = new Set(params.source);
  const t = new Set(params.target);
  const missing = Array.from(s).filter((vName) => !t.has(vName));
  const added = Array.from(t).filter((vName) => !s.has(vName));
  return { missing, added };
}

/**
 * Admin-only: translate onboarding EN -> DE (no DB writes).
 * The admin UI uses this to prefill German fields.
 */
export const translateOnboardingEnToDe = action({
  args: {
    titleEn: v.string(),
    descriptionEn: v.string(),
    contentEn: v.string(),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);

    const sourceVars = new Set([
      ...extractVariables(args.titleEn || ""),
      ...extractVariables(args.descriptionEn || ""),
      ...extractVariables(args.contentEn || ""),
    ]);

    const system = [
      "You are a translation engine.",
      "Translate the provided onboarding copy from English to German (de-DE).",
      "Preserve ALL placeholder variables in double curly braces exactly (e.g. {{USER_NAME}}). Do not translate, rename, add, or remove placeholders.",
      "Preserve HTML tags and formatting as much as possible.",
      "Return ONLY valid JSON with keys: titleDe, descriptionDe, contentDe.",
    ].join("\n");

    const user = [
      "Title (EN):",
      args.titleEn,
      "",
      "Description (EN):",
      args.descriptionEn,
      "",
      "Content (EN):",
      args.contentEn,
      "",
      `Placeholders that must remain unchanged: ${Array.from(sourceVars).sort().join(", ") || "(none)"}`,
    ].join("\n");

    const ai = await callAiJson(ctx, {
      stage: "specialist",
      preferredProvider: args.preferredProvider ?? "gemini",
      system,
      user,
      maxTokens: 2500,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(ai.raw);
    } catch {
      throw new Error("AI returned invalid JSON.");
    }

    const titleDe = typeof parsed?.titleDe === "string" ? parsed.titleDe : "";
    const descriptionDe = typeof parsed?.descriptionDe === "string" ? parsed.descriptionDe : "";
    const contentDe = typeof parsed?.contentDe === "string" ? parsed.contentDe : "";

    if (!titleDe || !contentDe) throw new Error("AI returned empty translation fields.");

    const targetVars = [
      ...extractVariables(titleDe),
      ...extractVariables(descriptionDe),
      ...extractVariables(contentDe),
    ];
    const { missing, added } = diffVariables({ source: Array.from(sourceVars), target: targetVars });
    const warnings: string[] = [];
    if (missing.length) warnings.push(`Missing placeholders in DE output: ${missing.join(", ")}`);
    if (added.length) warnings.push(`New placeholders in DE output: ${added.join(", ")}`);

    return {
      titleDe,
      descriptionDe,
      contentDe,
      warnings,
      meta: {
        provider: ai.provider,
        model: ai.model,
        usage: ai.usage,
        estimatedCostUsd: ai.estimatedCostUsd,
      },
    };
  },
});

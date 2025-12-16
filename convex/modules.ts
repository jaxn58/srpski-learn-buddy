import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============= MODULE METADATA =============

// Insert module metadata (for migration script)
export const insertModuleMetadata = mutation({
  args: {
    moduleId: v.string(),
    language: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("moduleMetadata")
      .withIndex("by_module_lang", (q) =>
        q.eq("moduleId", args.moduleId).eq("language", args.language)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        description: args.description,
      });
      return existing._id;
    }

    return await ctx.db.insert("moduleMetadata", {
      moduleId: args.moduleId,
      language: args.language,
      title: args.title,
      description: args.description,
    });
  },
});

// Get module metadata
export const getModuleMetadata = query({
  args: {
    moduleId: v.string(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    const metadata = await ctx.db
      .query("moduleMetadata")
      .withIndex("by_module_lang", (q) =>
        q.eq("moduleId", args.moduleId).eq("language", language)
      )
      .first();

    // Fallback
    if (!metadata && language !== "en") {
      return await ctx.db
        .query("moduleMetadata")
        .withIndex("by_module_lang", (q) =>
          q.eq("moduleId", args.moduleId).eq("language", "en")
        )
        .first();
    }

    return metadata;
  },
});

// Get all modules metadata
// DEPRECATED: Use getAllModulesConsolidated instead
export const getAllModules = query({
  args: {
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    // Fetch all
    const allMetadata = await ctx.db
      .query("moduleMetadata")
      .filter((q) => q.eq(q.field("language"), language))
      .collect();
      
    // If empty and not English, try fallback
    if (allMetadata.length === 0 && language !== "en") {
      return await ctx.db
        .query("moduleMetadata")
        .filter((q) => q.eq(q.field("language"), "en"))
        .collect();
    }

    // We can't sort here easily without module number in DB
    // For now, client will sort based on static config or we add moduleNumber to DB
    return allMetadata;
  },
});

// ============= NEW CONSOLIDATED MODULE STRUCTURE =============

// Insert consolidated module metadata (one row per module with multilingual columns)
export const insertConsolidatedModuleMetadata = mutation({
  args: {
    titleDe: v.string(),
    titleEn: v.string(),
    descriptionDe: v.string(),
    descriptionEn: v.string(),
    slug: v.string(),
    moduleNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("moduleMetadata", {
      titleDe: args.titleDe,
      titleEn: args.titleEn,
      descriptionDe: args.descriptionDe,
      descriptionEn: args.descriptionEn,
      slug: args.slug,
      moduleNumber: args.moduleNumber,
    });
  },
});

// Update consolidated module metadata
export const updateModuleMetadata = mutation({
  args: {
    moduleId: v.id("moduleMetadata"),
    titleDe: v.optional(v.string()),
    titleEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    slug: v.optional(v.string()),
    moduleNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { moduleId, ...updates } = args;
    await ctx.db.patch(moduleId, updates);
    return moduleId;
  },
});

// Get module by ID (new structure)
export const getModuleById = query({
  args: {
    moduleId: v.id("moduleMetadata"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.moduleId);
  },
});

// Get module by slug (for URL compatibility)
export const getModuleBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("moduleMetadata")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// Get all modules (consolidated structure)
// Returns all modules with multilingual fields, sorted by moduleNumber
export const getAllModulesConsolidated = query({
  args: {},
  handler: async (ctx) => {
    // Fetch all modules that have the new structure (have slug field)
    const allModules = await ctx.db
      .query("moduleMetadata")
      .filter((q) => q.neq(q.field("slug"), undefined))
      .collect();
    
    // Sort by moduleNumber
    return allModules.sort((a, b) => {
      const numA = a.moduleNumber ?? 999;
      const numB = b.moduleNumber ?? 999;
      return numA - numB;
    });
  },
});

// ============= CLEANUP UTILITIES =============

// Remove legacy module entries with pattern "module-X" (cleanup migration - no auth required)
export const removeLegacyModuleEntries = mutation({
  handler: async (ctx) => {
    const allModules = await ctx.db.query("moduleMetadata").collect();
    let deleted = 0;
    const deletedIds: string[] = [];
    
    for (const module of allModules) {
      // Check if moduleId matches the legacy pattern "module-X" (where X is a number)
      if (/^module-\d+$/.test(module.moduleId)) {
        deletedIds.push(`${module.moduleId} (${module.language})`);
        await ctx.db.delete(module._id);
        deleted++;
      }
    }
    
    return { 
      deleted, 
      total: allModules.length,
      deletedIds 
    };
  },
});

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

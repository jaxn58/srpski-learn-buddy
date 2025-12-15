import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============= WEEK METADATA =============

// Insert week metadata (for migration script)
export const insertWeekMetadata = mutation({
  args: {
    weekNumber: v.number(),
    language: v.string(),
    title: v.string(),
    goals: v.array(v.string()),
    practiceActivities: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weekMetadata")
      .withIndex("by_week_lang", (q) =>
        q.eq("weekNumber", args.weekNumber).eq("language", args.language)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        goals: args.goals,
        practiceActivities: args.practiceActivities,
      });
      return existing._id;
    }

    return await ctx.db.insert("weekMetadata", {
      weekNumber: args.weekNumber,
      language: args.language,
      title: args.title,
      goals: args.goals,
      practiceActivities: args.practiceActivities,
    });
  },
});

// Get week metadata
export const getWeekMetadata = query({
  args: {
    weekNumber: v.number(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    const metadata = await ctx.db
      .query("weekMetadata")
      .withIndex("by_week_lang", (q) =>
        q.eq("weekNumber", args.weekNumber).eq("language", language)
      )
      .first();

    // Fallback
    if (!metadata && language !== "en") {
      return await ctx.db
        .query("weekMetadata")
        .withIndex("by_week_lang", (q) =>
          q.eq("weekNumber", args.weekNumber).eq("language", "en")
        )
        .first();
    }

    return metadata;
  },
});

// Get all weeks metadata
export const getAllWeeks = query({
  args: {
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    // Fetch all
    const allMetadata = await ctx.db
      .query("weekMetadata")
      .filter((q) => q.eq(q.field("language"), language))
      .collect();
      
    // If empty and not English, try fallback
    if (allMetadata.length === 0 && language !== "en") {
      return await ctx.db
        .query("weekMetadata")
        .filter((q) => q.eq(q.field("language"), "en"))
        .collect();
    }

    return allMetadata.sort((a, b) => a.weekNumber - b.weekNumber);
  },
});

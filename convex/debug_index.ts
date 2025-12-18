import { query } from "./_generated/server";
import { v } from "convex/values";

export const testIndex = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    // 1. Find by scan
    const scanResult = await ctx.db
      .query("chatPrompts")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    // 2. Find by index
    const indexResult = await ctx.db
      .query("chatPrompts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    // 3. Find by history index
    const historyScan = await ctx.db
      .query("chatPromptHistory")
      .filter((q) => q.eq(q.field("name"), args.name))
      .collect();

    const historyIndex = await ctx.db
        .query("chatPromptHistory")
        .withIndex("by_name_updatedAt", (q) => q.eq("name", args.name))
        .collect();

    return {
      name: args.name,
      scanFound: !!scanResult,
      indexFound: !!indexResult,
      scanId: scanResult?._id,
      indexId: indexResult?._id,
      historyScanCount: historyScan.length,
      historyIndexCount: historyIndex.length
    };
  },
});






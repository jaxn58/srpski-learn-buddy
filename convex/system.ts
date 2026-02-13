import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Health check endpoint
 * Returns system status
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const health = query({
  args: {
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return {
      ok: true,
      timestamp: args.timestamp ?? Date.now(),
    };
  },
});

















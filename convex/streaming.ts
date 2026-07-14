import {
  PersistentTextStreaming,
  StreamId,
  StreamIdValidator,
} from "@convex-dev/persistent-text-streaming";
import { components } from "./_generated/api";
import { query, mutation } from "./_generated/server";

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const streamingComponent = new PersistentTextStreaming(
  components.persistentTextStreaming,
);

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getStreamBody = query({
  args: {
    streamId: StreamIdValidator,
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    return await streamingComponent.getStreamBody(
      ctx,
      args.streamId as StreamId,
    );
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const createStream = mutation({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx) => {
    // SECURITY: require authentication so anonymous callers cannot create
    // unlimited stream resources.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await streamingComponent.createStream(ctx);
  },
});

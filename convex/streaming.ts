import {
  PersistentTextStreaming,
  StreamId,
  StreamIdValidator,
} from "@convex-dev/persistent-text-streaming";
import { components } from "./_generated/api";
import { query, mutation } from "./_generated/server";

export const streamingComponent = new PersistentTextStreaming(
  components.persistentTextStreaming,
);

export const getStreamBody = query({
  args: {
    streamId: StreamIdValidator,
  },
  handler: async (ctx, args) => {
    return await streamingComponent.getStreamBody(
      ctx,
      args.streamId as StreamId,
    );
  },
});

export const createStream = mutation({
  args: {},
  handler: async (ctx) => {
    return await streamingComponent.createStream(ctx);
  },
});

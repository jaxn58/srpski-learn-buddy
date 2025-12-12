import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { PaddleTrpcContext } from "./paddleContext";

/**
 * Minimal tRPC setup for Paddle webhook only
 * This will be removed once Paddle is fully migrated to Convex
 */
const t = initTRPC.context<PaddleTrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

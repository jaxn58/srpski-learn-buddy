import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

/**
 * Minimal context for Paddle webhook (no user authentication needed)
 * This will be removed once Paddle is fully migrated to Convex
 */
export type PaddleTrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
};

export async function createPaddleContext(
  opts: CreateExpressContextOptions
): Promise<PaddleTrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
  };
}







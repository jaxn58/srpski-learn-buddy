import { router } from "./_core/trpc";
import { paddleRouter } from "./routers/paddle";

// Simplified router - only Paddle remains (until fully migrated to Convex)
// All other endpoints (auth, system) have been migrated to Convex
export const appRouter = router({
  paddle: paddleRouter,
});

export type AppRouter = typeof appRouter;


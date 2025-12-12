import { router, publicProcedure } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { fetchConvexUserByClerkId } from "./convexUsers";
import { paddleRouter } from "./routers/paddle";

export const appRouter = router({
  system: systemRouter,
  paddle: paddleRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.clerkUserId) {
        return null;
      }

      return await fetchConvexUserByClerkId(ctx.clerkUserId);
    }),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
});

export type AppRouter = typeof appRouter;


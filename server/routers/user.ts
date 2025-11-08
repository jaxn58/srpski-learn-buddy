import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getUser, getDb } from "../db";
import { users } from "../../drizzle/schema";

export const userRouter = router({
  getBadgeCount: protectedProcedure.query(async ({ ctx }) => {
    const { getUserBadgeCount } = await import("../db");
    const count = await getUserBadgeCount(ctx.user.id);
    return { count };
  }),
  
  getBadges: protectedProcedure.query(async ({ ctx }) => {
    const { getUserBadges } = await import("../db");
    const badges = await getUserBadges(ctx.user.id);
    return badges;
  }),
  
  addXP: protectedProcedure
    .input(z.object({ xp: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        return { success: false, message: "Database not available" };
      }

      try {
        const user = await getUser(ctx.user.id);
        if (!user) {
          return { success: false, message: "User not found" };
        }

        const newTotalXP = (user.totalXP || 0) + input.xp;
        
        await db.update(users)
          .set({ totalXP: newTotalXP })
          .where(eq(users.id, ctx.user.id));

        return { success: true, totalXP: newTotalXP, xpAdded: input.xp };
      } catch (error) {
        console.error("Failed to add XP:", error);
        return { success: false, message: "Failed to update XP" };
      }
    }),
});


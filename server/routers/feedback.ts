import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { feedbackSubmissions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// Middleware to check if user is admin or superadmin
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
    throw new TRPCError({ 
      code: 'FORBIDDEN',
      message: 'Admin access required'
    });
  }
  return next({ ctx });
});

export const feedbackRouter = router({
  // Submit feedback (any authenticated user)
  submit: protectedProcedure
    .input(z.object({
      type: z.enum(['bug', 'feature', 'improvement', 'other']),
      title: z.string().min(5).max(200),
      description: z.string().min(10).max(5000)
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const id = randomUUID();
      await db.insert(feedbackSubmissions).values({
        id,
        userId: ctx.user.id,
        type: input.type,
        title: input.title,
        description: input.description,
        status: 'new',
        submittedAt: new Date()
      });

      return { success: true, id };
    }),

  // Get user's own feedback submissions
  getMySubmissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

    const submissions = await db
      .select()
      .from(feedbackSubmissions)
      .where(eq(feedbackSubmissions.userId, ctx.user.id))
      .orderBy(desc(feedbackSubmissions.submittedAt));

    return submissions;
  }),

  // Get all feedback submissions (admin only)
  getAllSubmissions: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

    const submissions = await db
      .select()
      .from(feedbackSubmissions)
      .orderBy(desc(feedbackSubmissions.submittedAt));

    return submissions;
  }),

  // Update feedback status (admin only)
  updateStatus: adminProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['new', 'reviewed', 'in_progress', 'completed', 'rejected']),
      adminNotes: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      await db
        .update(feedbackSubmissions)
        .set({
          status: input.status,
          adminNotes: input.adminNotes,
          reviewedAt: new Date()
        })
        .where(eq(feedbackSubmissions.id, input.id));

      return { success: true };
    }),

  // Delete feedback (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      await db.delete(feedbackSubmissions).where(eq(feedbackSubmissions.id, input.id));

      return { success: true };
    })
});


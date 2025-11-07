import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { feedbackSubmissions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sendFeedbackConfirmationEmail, sendFeedbackAdminNotificationEmail } from "../_core/email";
import { getFeedbackComments, addFeedbackComment, deleteFeedbackComment, getFeedbackStatusHistory, addFeedbackStatusChange } from "../db";

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
      title: z.string().min(3).max(200),
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

      // Send confirmation email to user
      try {
        await sendFeedbackConfirmationEmail(
          ctx.user.name || 'User',
          ctx.user.email || '',
          input.type,
          input.title
        );
      } catch (error) {
        console.error('[Feedback] Failed to send confirmation email:', error);
      }

      // Send admin notification email
      try {
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.RESEND_FROM_EMAIL || 'noreply@mail.jacksenn.me';
        await sendFeedbackAdminNotificationEmail(
          ctx.user.name || 'User',
          ctx.user.email || '',
          input.type,
          input.title,
          input.description,
          adminEmail
        );
      } catch (error) {
        console.error('[Feedback] Failed to send admin notification email:', error);
      }

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
    }),

  // Add comment to feedback (admin/superadmin and feedback owner)
  addComment: protectedProcedure
    .input(z.object({
      feedbackId: z.string(),
      content: z.string().min(1).max(2000),
      isAdminNote: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const feedback = await db.select().from(feedbackSubmissions)
        .where(eq(feedbackSubmissions.id, input.feedbackId))
        .limit(1);

      if (feedback.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback not found' });
      }

      const isAdmin = ctx.user.role === 'admin' || ctx.user.role === 'superadmin';
      const isOwner = feedback[0].userId === ctx.user.id;

      if (!isAdmin && !isOwner) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot comment on this feedback' });
      }

      const commentId = randomUUID();
      await addFeedbackComment({
        id: commentId,
        feedbackId: input.feedbackId,
        userId: ctx.user.id,
        content: input.content,
        isAdminNote: isAdmin && input.isAdminNote ? true : false,
        createdAt: new Date()
      });

      return { success: true, id: commentId };
    }),

  // Get comments for feedback
  getComments: protectedProcedure
    .input(z.object({ feedbackId: z.string() }))
    .query(async ({ input }) => {
      const comments = await getFeedbackComments(input.feedbackId);
      return comments;
    }),

  // Delete comment (superadmin only)
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'superadmin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only superadmin can delete comments' });
      }

      await deleteFeedbackComment(input.commentId);
      return { success: true };
    }),

  // Get status history for feedback
  getStatusHistory: protectedProcedure
    .input(z.object({ feedbackId: z.string() }))
    .query(async ({ input }) => {
      const history = await getFeedbackStatusHistory(input.feedbackId);
      return history;
    })
});

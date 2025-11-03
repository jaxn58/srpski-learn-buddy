import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getAllUsers, updateUserRole, getAllUserProgress, getDb } from "../db";
import { sendUserActivationEmail } from "../_core/email";
import { ENV } from "../_core/env";
import { users, userProgress, vocabulary, chatMessages, exerciseResults } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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

// Middleware to check if user is superadmin
const superadminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'superadmin') {
    throw new TRPCError({ 
      code: 'FORBIDDEN',
      message: 'Superadmin access required'
    });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // Get all users (admin can see students, superadmin can see all)
  getAllUsers: adminProcedure.query(async ({ ctx }) => {
    const users = await getAllUsers();
    
    // If admin (not superadmin), only show students
    if (ctx.user.role === 'admin') {
      return users.filter(u => u.role === 'student');
    }
    
    // Superadmin sees everyone
    return users;
  }),

  // Get all user progress (for admin dashboard)
  getAllProgress: adminProcedure.query(async () => {
    const allProgress = await getAllUserProgress();
    const users = await getAllUsers();
    
    // Combine user info with progress
    return allProgress.map(progress => {
      const user = users.find(u => u.id === progress.userId);
      return {
        ...progress,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        userRole: user?.role || 'student'
      };
    });
  }),

  // Update user role (only superadmin can do this)
  updateUserRole: superadminProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(['superadmin', 'admin', 'student'])
    }))
    .mutation(async ({ input }) => {
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  // Toggle user active status
  toggleUserStatus: superadminProcedure
    .input(z.object({
      userId: z.string(),
      isActive: z.boolean()
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
      
      // If activating user, send activation email
      if (input.isActive) {
        const userResult = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (userResult.length > 0) {
          const user = userResult[0];
          if (user.email) {
            const loginUrl = `${process.env.VITE_OAUTH_PORTAL_URL}?app_id=${ENV.appId}`;
            const emailResult = await sendUserActivationEmail(user.name || 'User', user.email, loginUrl);
            if (!emailResult.success) {
              console.warn(`[Admin] Failed to send activation email: ${emailResult.error}`);
            }
          }
        }
      }
      
      return { success: true };
    }),

  // Toggle beta tester status
  toggleBetaTester: superadminProcedure
    .input(z.object({
      userId: z.string(),
      isBetaTester: z.boolean()
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      await db.update(users).set({ isBetaTester: input.isBetaTester }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Delete user (and all associated data)
  deleteUser: superadminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete yourself' });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      // Delete user progress, vocabulary, chat messages, exercise results
      await db.delete(userProgress).where(eq(userProgress.userId, input.userId));
      await db.delete(vocabulary).where(eq(vocabulary.userId, input.userId));
      await db.delete(chatMessages).where(eq(chatMessages.userId, input.userId));
      await db.delete(exerciseResults).where(eq(exerciseResults.userId, input.userId));
      
      // Finally delete the user
      await db.delete(users).where(eq(users.id, input.userId));
      
      return { success: true };
    }),

  // Reset user progress
  resetUserProgress: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      // Reset progress to week 1, unit 1
      await db.update(userProgress)
        .set({
          currentWeek: 1,
          currentUnit: 1,
          completedUnits: JSON.stringify([]),
          lastActivityAt: new Date()
        })
        .where(eq(userProgress.userId, input.userId));
      
      return { success: true };
    }),

  // Get statistics for admin dashboard
  getStatistics: adminProcedure.query(async ({ ctx }) => {
    const users = await getAllUsers();
    const allProgress = await getAllUserProgress();
    
    let relevantUsers = users;
    if (ctx.user.role === 'admin') {
      // Admins only see students
      relevantUsers = users.filter(u => u.role === 'student');
    }
    
    const totalUsers = relevantUsers.length;
    const activeUsers = allProgress.filter(p => {
      if (!p.lastActivityAt) return false;
      const lastActivity = new Date(p.lastActivityAt);
      const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActivity <= 7; // Active in last 7 days
    }).length;
    
    const totalLessonsCompleted = allProgress.reduce((sum, p) => {
      return sum + (p.completedUnits?.length || 0);
    }, 0);
    
    const averageProgress = totalUsers > 0 
      ? (totalLessonsCompleted / totalUsers / 27 * 100).toFixed(1)
      : 0;
    
    return {
      totalUsers,
      activeUsers,
      totalLessonsCompleted,
      averageProgress: parseFloat(averageProgress as string)
    };
  })
});


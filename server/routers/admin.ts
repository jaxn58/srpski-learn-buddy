import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getAllUsers, updateUserRole, getAllUserProgress } from "../db";

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


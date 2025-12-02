import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  // Check if we have a Clerk user ID but no database user
  // This means the user is authenticated with Clerk but hasn't been synced yet
  if (ctx.clerkUserId && !ctx.user) {
    throw new TRPCError({ 
      code: "UNAUTHORIZED", 
      message: "User not synced. Please call auth.me first." 
    });
  }

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Check if user is active (unless they're superadmin)
  if (!ctx.user.isActive && ctx.user.role !== 'superadmin') {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Your account is pending approval. Please wait for an administrator to activate your account." 
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin')) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

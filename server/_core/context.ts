import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getAuth } from "@clerk/express";
import type { ConvexUser } from "../convexUsers";
import { fetchConvexUserByClerkId } from "../convexUsers";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: ConvexUser | null;
  clerkUserId: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: ConvexUser | null = null;
  let clerkUserId: string | null = null;

  try {
    // Get Clerk authentication data
    const auth = getAuth(opts.req);
    clerkUserId = auth.userId;

    if (clerkUserId) {
      user = await fetchConvexUserByClerkId(clerkUserId);
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    console.error("[Auth] Error getting Clerk auth:", error);
    user = null;
    clerkUserId = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    clerkUserId,
  };
}

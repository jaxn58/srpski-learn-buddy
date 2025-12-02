import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getAuth } from "@clerk/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  clerkUserId: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let clerkUserId: string | null = null;

  try {
    // Get Clerk authentication data
    const auth = getAuth(opts.req);
    clerkUserId = auth.userId;

    if (clerkUserId) {
      // Look up user in our database by Clerk ID
      const dbUser = await db.getUser(clerkUserId);
      user = dbUser ?? null;
      
      // If user doesn't exist in our DB, they might be new
      // The user sync will happen in the auth.me endpoint
      if (!user) {
        console.log(`[Auth] Clerk user ${clerkUserId} not found in database - will sync on auth.me call`);
      }
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

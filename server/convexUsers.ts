import { convexClient, api, SERVER_TOKEN } from "./convexClient";
import type { Doc } from "../convex/_generated/dataModel";

type UserDoc = Doc<"users">;

/**
 * Fetch a Convex user by their Clerk ID
 * This is used by the server-side code to get user information
 */
export async function fetchConvexUserByClerkId(
  clerkId: string
): Promise<UserDoc | null> {
  if (!clerkId) {
    console.error("[fetchConvexUserByClerkId] Missing clerkId");
    return null;
  }

  if (!SERVER_TOKEN) {
    console.warn(
      "[fetchConvexUserByClerkId] CONVEX_SERVER_TOKEN not set, this may fail"
    );
  }

  try {
    const user = await convexClient.action(api.users.getUserByClerkIdForServer, {
      clerkId,
      serverToken: SERVER_TOKEN || "",
    });

    return user;
  } catch (error) {
    console.error("[fetchConvexUserByClerkId] Error fetching user:", {
      clerkId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
















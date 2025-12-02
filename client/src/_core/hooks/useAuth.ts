import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useMemo, useEffect } from "react";

/**
 * Custom useAuth hook that combines Clerk authentication with Convex user data
 * from the database (includes role, isBetaTester, isActive, etc.)
 */
export function useAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerkAuth();

  // Fetch full user data from Convex (includes role, isBetaTester, etc.)
  const dbUser = useQuery(api.users.me);
  
  // Mutation to sync user from Clerk to Convex
  const syncUser = useMutation(api.users.syncUser);

  // Sync user on first sign in
  useEffect(() => {
    if (isSignedIn && clerkLoaded && dbUser === null) {
      // User is signed in but not in database - sync them
      syncUser().catch(console.error);
    }
  }, [isSignedIn, clerkLoaded, dbUser, syncUser]);

  const state = useMemo(() => {
    // Store user info for Manus runtime compatibility
    if (dbUser) {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(dbUser)
      );
    }

    // dbUser is undefined while loading, null if not found
    const isLoading = !clerkLoaded || (isSignedIn && dbUser === undefined);

    return {
      // Return the database user (has role, isBetaTester, isActive, etc.)
      user: dbUser ?? null,
      // Loading if either Clerk or Convex query is loading
      loading: isLoading,
      error: null,
      isAuthenticated: isSignedIn === true && Boolean(dbUser),
      // Also expose Clerk user for additional info
      clerkUser: clerkUser ?? null,
    };
  }, [clerkLoaded, clerkUser, isSignedIn, dbUser]);

  return {
    ...state,
    refresh: () => {
      // Convex handles reactivity automatically, no manual refresh needed
    },
    logout: async () => {
      await signOut();
    },
  };
}

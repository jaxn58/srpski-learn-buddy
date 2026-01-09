import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useMemo, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

/**
 * BETA: Force English for all users
 * TODO: Re-enable multi-language after beta
 */
function detectPreferredLanguage(): "en" {
  return 'en'; // BETA: Force English for all users
}

/**
 * Custom useAuth hook that combines Clerk authentication with Convex user data
 * from the database (includes role, isBetaTester, isActive, etc.)
 */
export function useAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerkAuth();

  // Fetch full user data from Convex (includes role, isBetaTester, etc.)
  const dbUser = useQuery(api.users.me);
  // Beobachte dbUser, keine Debug-Logs mehr
  useEffect(() => {}, [dbUser]);
  
  // Mutation to sync user from Clerk to Convex
  const syncUser = useMutation(api.users.syncUser);

  // Track if we've already attempted to sync to avoid multiple attempts.
  const syncAttemptedRef = useRef(false);

  // Always attempt to sync once the Clerk user is available.
  useEffect(() => {
    if (!isSignedIn || !clerkLoaded || !clerkUser) {
      syncAttemptedRef.current = false;
      return;
    }

    if (syncAttemptedRef.current) {
      return;
    }

    syncAttemptedRef.current = true;
    
    logger.log("[useAuth] Triggering syncUser for Clerk user", {
      clerkId: clerkUser?.id,
      email: clerkUser?.primaryEmailAddress?.emailAddress,
    });

    syncUser({ learningLanguage: "en" })
      .then(() => {
        logger.log("[useAuth] User sync successful");
      })
      .catch((error) => {
        logger.error("[useAuth] Failed to sync user:", error);
        syncAttemptedRef.current = false;
      });
  }, [isSignedIn, clerkLoaded, clerkUser, syncUser]);

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

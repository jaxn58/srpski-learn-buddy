import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useAction } from "convex/react";
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
  const { signOut, sessionId } = useClerkAuth();

  // Fetch full user data from Convex (includes role, isBetaTester, etc.)
  const dbUser = useQuery(api.users.me);
  // Beobachte dbUser, keine Debug-Logs mehr
  useEffect(() => {}, [dbUser]);
  
  // Mutation to sync user from Clerk to Convex
  const syncUser = useMutation(api.users.syncUser);
  const enforceSingleSession = useAction(api.users.enforceSingleSession);

  // Track if we've already attempted to sync to avoid multiple attempts.
  const syncAttemptedRef = useRef(false);
  // Track if we've already attempted to enforce sessions for the current Clerk session.
  const enforceAttemptedSessionRef = useRef<string | null>(null);

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

    syncUser({ learningLanguage: "en" })
      .catch((error) => {
        logger.error("[useAuth] Failed to sync user:", error);
        syncAttemptedRef.current = false;
      });
  }, [isSignedIn, clerkLoaded, clerkUser, syncUser, sessionId, enforceSingleSession]);

  // Optional fallback: ensure single-session enforcement even if webhook delivery is delayed.
  // Important: wait until dbUser is loaded so Convex auth identity is definitely available.
  useEffect(() => {
    if (!isSignedIn || !clerkLoaded || !sessionId) {
      enforceAttemptedSessionRef.current = null;
      return;
    }

    // Wait for Convex user to be resolved; this implies Convex auth identity is ready.
    if (!dbUser) return;

    // Skip superadmin to avoid unnecessary Clerk API calls.
    if (dbUser.role === "superadmin") {
      enforceAttemptedSessionRef.current = sessionId;
      return;
    }

    if (enforceAttemptedSessionRef.current === sessionId) return;
    enforceAttemptedSessionRef.current = sessionId;

    enforceSingleSession({ sessionId }).catch((error) => {
      logger.error("[useAuth] Failed to enforce single session:", error);
    });
  }, [isSignedIn, clerkLoaded, sessionId, dbUser, enforceSingleSession]);

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

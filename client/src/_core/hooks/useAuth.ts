import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useMemo, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

/**
 * Determine preferred UI language for initial user sync (first login).
 * Source of truth after that is `users.learningLanguage` in Convex.
 */
function detectPreferredLanguage(): "en" | "de" {
  // 1) localStorage (used by LanguageContext)
  try {
    const stored = localStorage.getItem("app-language");
    if (stored === "en" || stored === "de") return stored;
  } catch {
    // ignore
  }

  // 2) browser language
  try {
    const navLang = (navigator.language || "").toLowerCase();
    if (navLang.startsWith("de")) return "de";
  } catch {
    // ignore
  }

  return "en";
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

    // Provide preferred language for FIRST sync only.
    // Server-side `syncUser` will not overwrite existing users' languages.
    syncUser({ learningLanguage: detectPreferredLanguage() })
      .catch((error) => {
        logger.error("[useAuth] Failed to sync user:", error);
        syncAttemptedRef.current = false;
      });
  }, [isSignedIn, clerkLoaded, clerkUser, syncUser]);

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

import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useMemo, useEffect } from "react";

/**
 * Detect user's preferred learning language from:
 * 1. URL parameter (?lang=de)
 * 2. URL path (/de/sign-up)
 * 3. localStorage (from landing page selection)
 * 4. Browser language (fallback to English)
 */
function detectPreferredLanguage(): "en" | "de" | "es" | "fr" {
  // 1. Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  if (langParam === 'de' || langParam === 'es' || langParam === 'fr') {
    return langParam;
  }
  
  // 2. Check URL path (e.g., /de/sign-up)
  const pathMatch = window.location.pathname.match(/^\/(de|es|fr)\//);
  if (pathMatch) {
    return pathMatch[1] as "de" | "es" | "fr";
  }
  
  // 3. Check localStorage (set by landing page)
  const storedLang = localStorage.getItem('preferredLanguage');
  if (storedLang === 'de' || storedLang === 'es' || storedLang === 'fr') {
    return storedLang;
  }
  
  // 4. Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('de')) return 'de';
  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('fr')) return 'fr';
  
  // Default to English
  return 'en';
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
  
  // Mutation to sync user from Clerk to Convex
  const syncUser = useMutation(api.users.syncUser);

  // Sync user on first sign in
  useEffect(() => {
    if (isSignedIn && clerkLoaded && dbUser === null) {
      // User is signed in but not in database - sync them with their preferred language
      const preferredLang = detectPreferredLanguage();
      syncUser({ learningLanguage: preferredLang }).catch(console.error);
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

import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { createRoot } from "react-dom/client";
import { deDE } from "@clerk/localizations";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import "./index.css";
import i18n from "./i18n";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

// #region agent log - Production diagnostics
console.log('[DEBUG] Environment check:', {
  hasClerkKey: !!CLERK_PUBLISHABLE_KEY,
  clerkKeyPrefix: CLERK_PUBLISHABLE_KEY?.substring(0, 10),
  hasConvexUrl: !!CONVEX_URL,
  convexUrl: CONVEX_URL,
  hasNavigatorCredentials: !!(typeof window !== 'undefined' && navigator.credentials),
  credentialsGetType: typeof window !== 'undefined' && navigator.credentials ? typeof navigator.credentials.get : 'undefined',
  userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
  isProduction: import.meta.env.PROD,
  timestamp: new Date().toISOString(),
  hypothesisId: 'A,B,D'
});

// Check if credentials API is writable (Hypothesis B)
if (typeof window !== 'undefined' && navigator.credentials) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(navigator.credentials, 'get');
    console.log('[DEBUG] Credentials API check:', {
      hasGet: !!navigator.credentials.get,
      isWritable: descriptor?.writable,
      isConfigurable: descriptor?.configurable,
      isEnumerable: descriptor?.enumerable,
      hypothesisId: 'B,C'
    });
  } catch (e) {
    console.error('[DEBUG] Error checking credentials API:', e, { hypothesisId: 'B' });
  }
}
// #endregion

if (!CLERK_PUBLISHABLE_KEY) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

if (!CONVEX_URL) {
  console.error("Missing VITE_CONVEX_URL environment variable");
}

const convex = new ConvexReactClient(CONVEX_URL);

// Dynamic ClerkProvider wrapper that responds to language changes
function DynamicClerkProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState(() => {
    const stored = localStorage.getItem('preferredLanguage');
    return stored === 'de' ? deDE : undefined;
  });

  useEffect(() => {
    // Listen to i18n language changes
    const handleLanguageChange = (lng: string) => {
      setLocale(lng === 'de' ? deDE : undefined);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  // #region agent log
  useEffect(() => {
    console.log('[DEBUG] ClerkProvider mounted:', {
      hasPublishableKey: !!CLERK_PUBLISHABLE_KEY,
      hasLocale: !!locale,
      currentLanguage: i18n.language,
      hypothesisId: 'A,D'
    });
  }, [locale]);
  // #endregion

  return (
    <ClerkProvider 
      publishableKey={CLERK_PUBLISHABLE_KEY}
      localization={locale}
    >
      {children}
    </ClerkProvider>
  );
}

// #region agent log - Catch all errors
window.addEventListener('error', (event) => {
  console.error('[DEBUG] Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.toString(),
    stack: event.error?.stack,
    isWebAuthn: event.message?.includes('CredentialsContainer') || event.message?.includes('webauthn'),
    hypothesisId: 'B,E'
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[DEBUG] Unhandled promise rejection:', {
    reason: event.reason?.toString(),
    promise: event.promise,
    hypothesisId: 'B,C'
  });
});
// #endregion

console.log('[DEBUG] Starting React app render...', { hypothesisId: 'A,C' });

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <DynamicClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </DynamicClerkProvider>
  </I18nextProvider>
);

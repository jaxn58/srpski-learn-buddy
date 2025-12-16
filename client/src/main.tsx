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

// #region agent log - Production diagnostics + Patch verification
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
  runId: 'post-fix',
  hypothesisId: 'A,B,D'
});

// Send to debug server (Hypothesis D - Convex URL verification)
const logData = {location:'main.tsx:13',message:'Main initialization',data:{hasClerkKey:!!CLERK_PUBLISHABLE_KEY,clerkKeyPrefix:CLERK_PUBLISHABLE_KEY?.substring(0,12),hasConvexUrl:!!CONVEX_URL,convexUrl:CONVEX_URL,isProduction:import.meta.env.PROD,mode:import.meta.env.MODE},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'};
console.log('[DEBUG]', logData);
fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});

// VERIFICATION: Check if polyfill fixed the credentials API (Hypothesis B)
if (typeof window !== 'undefined' && navigator.credentials) {
  try {
    const descriptorNav = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    const descriptorGet = Object.getOwnPropertyDescriptor(navigator.credentials, 'get');
    
    console.log('[DEBUG POST-FIX] Credentials API verification:', {
      // Navigator.credentials descriptor
      navCredentialsWritable: descriptorNav?.writable,
      navCredentialsConfigurable: descriptorNav?.configurable,
      // credentials.get descriptor
      hasGet: !!navigator.credentials.get,
      getIsWritable: descriptorGet?.writable,
      getIsConfigurable: descriptorGet?.configurable,
      getIsEnumerable: descriptorGet?.enumerable,
      // Polyfill check
      polyfillApplied: descriptorNav?.writable === true && descriptorNav?.configurable === true,
      runId: 'post-fix',
      hypothesisId: 'B-FIX'
    });
  } catch (e) {
    console.error('[DEBUG POST-FIX] Error checking credentials API:', e, { runId: 'post-fix', hypothesisId: 'B-FIX' });
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

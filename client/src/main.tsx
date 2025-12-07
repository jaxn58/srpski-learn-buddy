import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { createRoot } from "react-dom/client";
import { deDE } from "@clerk/localizations";
import { useEffect, useState } from "react";
import App from "./App";
import "./index.css";
import i18n from "./i18n";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

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

createRoot(document.getElementById("root")!).render(
  <DynamicClerkProvider>
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <App />
    </ConvexProviderWithClerk>
  </DynamicClerkProvider>
);

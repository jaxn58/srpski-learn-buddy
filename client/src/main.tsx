import { Suspense } from "react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { useTranslation } from "react-i18next";
import { deDE } from "@clerk/localizations";
import App from "./App";
import "./index.css";
import i18n from "./i18n";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

// Stale-deployment guard: auto-reload once when a lazy chunk 404s after a new deployment.
// Vite fires this event for any failed dynamic import (all lazy pages/layouts are affected).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const attempts = parseInt(sessionStorage.getItem('_chunkReload') ?? '0', 10);
  if (attempts < 2) {
    sessionStorage.setItem('_chunkReload', String(attempts + 1));
    window.location.reload();
  }
});


if (!CLERK_PUBLISHABLE_KEY) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

if (!CONVEX_URL) {
  console.error("Missing VITE_CONVEX_URL environment variable");
}

const convex = new ConvexReactClient(CONVEX_URL);

// Dynamic ClerkProvider wrapper that responds to language changes
function DynamicClerkProvider({ children }: { children: React.ReactNode }) {
  const { i18n: i18nInstance } = useTranslation();
  const locale = i18nInstance.language === "de" ? deDE : undefined;

  return (
    <ClerkProvider 
      publishableKey={CLERK_PUBLISHABLE_KEY}
      localization={locale}
    >
      {children}
    </ClerkProvider>
  );
}

// Ensure we only create one root instance across HMR reloads
const rootElement = document.getElementById("root")!;

const appTree = (
  <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
    <I18nextProvider i18n={i18n}>
      <DynamicClerkProvider>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </DynamicClerkProvider>
    </I18nextProvider>
  </Suspense>
);

// Store root in a way that survives HMR. If the root contains prerendered HTML,
// hydrate instead of replacing it (used by `/landing.html`).
if (!(window as any).__react_root__) {
  const hasPrerendered = rootElement.hasAttribute("data-prerendered") || rootElement.childNodes.length > 0;
  if (hasPrerendered) {
    (window as any).__react_root__ = hydrateRoot(rootElement, appTree);
  } else {
    (window as any).__react_root__ = createRoot(rootElement);
  }
}

// Render is safe for both createRoot and hydrateRoot (no-op update when already hydrated).
(window as any).__react_root__.render(appTree);

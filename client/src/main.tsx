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

// WebAuthn Polyfill: Fix "Cannot assign to read only property 'get'" in Clerk
// This patches the CredentialsContainer API to make it writable
if (typeof window !== 'undefined' && navigator.credentials) {
  try {
    const originalGet = navigator.credentials.get.bind(navigator.credentials);
    const descriptorNav = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    const descriptorCreds = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator.credentials), 'get');
    
    // Make navigator.credentials writable if it's readonly
    if (descriptorNav && !descriptorNav.writable) {
      Object.defineProperty(navigator, 'credentials', {
        value: navigator.credentials,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
    
    // Make credentials.get writable if it's readonly
    if (descriptorCreds && !descriptorCreds.writable) {
      Object.defineProperty(navigator.credentials, 'get', {
        value: originalGet,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
    
    console.log('[WebAuthn Polyfill] Successfully patched Credentials API');
  } catch (e) {
    console.error('[WebAuthn Polyfill] Failed to patch:', e);
  }
}

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
  // BETA: Since we force English everywhere, we don't need dynamic locale switching
  // This prevents unnecessary re-renders and re-mounts of ClerkProvider
  const locale = undefined; // Always use default (English)

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

// Store root in a way that survives HMR
if (!(window as any).__react_root__) {
  (window as any).__react_root__ = createRoot(rootElement);
}

(window as any).__react_root__.render(
  <I18nextProvider i18n={i18n}>
    <DynamicClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </DynamicClerkProvider>
  </I18nextProvider>
);

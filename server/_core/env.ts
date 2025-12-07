export const ENV = {
  // Clerk Authentication
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  clerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
  
  // Legacy app config (may be deprecated)
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "your-secret-key-change-in-production",
  
  // Database
  databaseUrl: process.env.DATABASE_URL ?? "",
  
  // Owner/Admin
  ownerId: process.env.OWNER_OPEN_ID ?? "",
  
  // Environment
  isProduction: process.env.NODE_ENV === "production",
  // Beta mode: when true, new users are automatically marked as beta testers
  betaMode: process.env.BETA_MODE === "on" || process.env.BETA_MODE === "true",
  betaEndDate: process.env.BETA_END_DATE ?? "",
  
  // AI/LLM
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: (process.env.BUILT_IN_FORGE_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) ?? "",
};

// Validate required environment variables
if (!ENV.clerkSecretKey) {
  console.warn("[ENV] Missing CLERK_SECRET_KEY - Clerk authentication may not work");
}

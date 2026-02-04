export const ENV = {
  // Clerk Authentication
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  clerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
  
  // Legacy app config (may be deprecated)
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "your-secret-key-change-in-production",
  
  // Environment
  isProduction: process.env.NODE_ENV === "production",
  // Beta mode: when true, new users are automatically marked as beta testers
  betaMode: process.env.BETA_MODE === "on" || process.env.BETA_MODE === "true",
  betaEndDate: process.env.BETA_END_DATE ?? "",
  
  // AI/LLM
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: (process.env.BUILT_IN_FORGE_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) ?? "",

  // Billing provider switch
  billingProvider: (process.env.BILLING_PROVIDER || process.env.VITE_BILLING_PROVIDER || "dodo") ?? "dodo",

  // Dodo Payments
  dodoPaymentsApiKey: process.env.DODO_PAYMENTS_API_KEY ?? "",
  dodoPaymentsWebhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "",
  dodoPaymentsEnvironment: process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode",

  // Google Cloud Text-to-Speech
  googleCloudServiceAccountKey: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ?? "",
};

// Validate required environment variables
if (!ENV.clerkSecretKey) {
  console.warn("[ENV] Missing CLERK_SECRET_KEY - Clerk authentication may not work");
}

if (!ENV.dodoPaymentsApiKey || !ENV.dodoPaymentsWebhookKey) {
  console.warn("[ENV] Dodo Payments keys missing - billing webhooks/checkout disabled until configured");
}

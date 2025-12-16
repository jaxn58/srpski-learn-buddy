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

  // Paddle Payments
  paddleApiKey: process.env.PADDLE_API_KEY ?? "",
  paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET ?? "",
  paddleClientToken: process.env.VITE_PADDLE_CLIENT_TOKEN ?? "",
  paddleProductIntensive: process.env.PADDLE_PRODUCT_INTENSIVE ?? "",
  paddleProductBalanced: process.env.PADDLE_PRODUCT_BALANCED ?? "",
  paddleProductStandard: process.env.PADDLE_PRODUCT_STANDARD ?? "",
  paddleProductRelaxed: process.env.PADDLE_PRODUCT_RELAXED ?? "",
};

// Validate required environment variables
if (!ENV.clerkSecretKey) {
  console.warn("[ENV] Missing CLERK_SECRET_KEY - Clerk authentication may not work");
}

if (!ENV.paddleApiKey || !ENV.paddleWebhookSecret) {
  console.warn("[ENV] Paddle keys missing - payment webhooks disabled until configured");
}

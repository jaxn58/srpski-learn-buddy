export default {
  providers: [
    {
      // Your Clerk domain (from the Clerk dashboard)
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://enabled-chow-3.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};


import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";

/**
 * Paddle Payment Integration Router
 * Handles Paddle webhooks and subscription management
 */
export const paddleRouter = router({
  /**
   * Webhook endpoint for Paddle events
   * This will be called by Paddle when subscription events occur
   */
  webhook: publicProcedure
    .input(
      z.object({
        alert_name: z.string(),
        passthrough: z.string().optional(),
        // Add more Paddle webhook fields as needed
      })
    )
    .mutation(async ({ input }) => {
      console.log("[Paddle Webhook] Received event:", {
        alertName: input.alert_name,
        passthrough: input.passthrough,
      });

      // TODO: Implement Paddle webhook logic
      // - Verify webhook signature
      // - Handle subscription_created, subscription_updated, subscription_cancelled events
      // - Update user subscription in Convex
      // NOTE: This will be migrated to Convex HTTP Action once Paddle is fully implemented

      return { success: true };
    }),

  /**
   * Get Paddle configuration for the client
   */
  getConfig: publicProcedure.query(async () => {
    return {
      vendorId: process.env.PADDLE_VENDOR_ID || "",
      environment: process.env.PADDLE_ENVIRONMENT || "sandbox",
    };
  }),
});














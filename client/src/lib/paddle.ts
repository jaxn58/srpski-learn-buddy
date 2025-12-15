/**
 * Paddle.js integration for payment processing
 * @see https://developer.paddle.com/paddlejs/overview
 */

import { initializePaddle, Paddle } from "@paddle/paddle-js";

let paddleInstance: Paddle | null = null;

/**
 * Check if Paddle is configured with valid credentials
 */
export function hasPaddleConfig(): boolean {
  const vendorId = import.meta.env.VITE_PADDLE_VENDOR_ID;
  return !!vendorId && vendorId !== "";
}

/**
 * Initialize Paddle.js
 * Should be called once when the app starts
 */
export async function initPaddle(): Promise<Paddle | null> {
  if (paddleInstance) {
    return paddleInstance;
  }

  if (!hasPaddleConfig()) {
    console.warn("[Paddle] Vendor ID not configured");
    return null;
  }

  try {
    const vendorId = import.meta.env.VITE_PADDLE_VENDOR_ID;
    const environment =
      import.meta.env.VITE_PADDLE_ENVIRONMENT === "production"
        ? "production"
        : "sandbox";

    paddleInstance = await initializePaddle({
      environment,
      token: vendorId,
    });

    console.log("[Paddle] Initialized successfully");
    return paddleInstance;
  } catch (error) {
    console.error("[Paddle] Initialization failed:", error);
    return null;
  }
}

/**
 * Open Paddle checkout overlay
 */
export async function openCheckout(config: {
  items: Array<{ priceId: string; quantity?: number }>;
  customer?: {
    email?: string;
  };
  customData?: Record<string, unknown>;
}): Promise<void> {
  const paddle = paddleInstance || (await initPaddle());

  if (!paddle) {
    throw new Error("Paddle is not initialized");
  }

  try {
    paddle.Checkout.open(config);
  } catch (error) {
    console.error("[Paddle] Checkout failed:", error);
    throw error;
  }
}

/**
 * Get the Paddle instance
 */
export function getPaddleInstance(): Paddle | null {
  return paddleInstance;
}







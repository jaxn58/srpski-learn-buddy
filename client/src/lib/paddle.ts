/**
 * Paddle.js integration for payment processing
 * @see https://developer.paddle.com/paddlejs/overview
 */

import { initializePaddle, Paddle } from "@paddle/paddle-js";

let paddleInstance: Paddle | null = null;

type CheckoutOpenOptions = Parameters<Paddle["Checkout"]["open"]>[0];

/**
 * Check if Paddle is configured with valid credentials
 */
export function hasPaddleConfig(): boolean {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  return !!token && token !== "";
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
    console.warn("[Paddle] Client token not configured");
    return null;
  }

  try {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
    const environment =
      import.meta.env.VITE_PADDLE_ENVIRONMENT === "production"
        ? "production"
        : "sandbox";

    paddleInstance =
      (await initializePaddle({
        environment,
        token,
      })) ?? null;

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
} & CheckoutOpenOptions): Promise<void> {
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



















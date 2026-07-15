/**
 * Dodo Payments Checkout (overlay) integration.
 *
 * This module intentionally keeps all secrets server-side.
 * The frontend only receives a hosted `checkoutUrl` created via Convex action.
 *
 * Docs:
 * - Overlay checkout: https://docs.dodopayments.com/developer-resources/overlay-checkout
 * - Create checkout session: https://docs.dodopayments.com/api-reference/checkout-sessions/create
 */

import { DodoPayments } from "dodopayments-checkout";

type DodoMode = "test" | "live";

let initialized = false;
let initializedMode: DodoMode | null = null;

export function initDodoPayments(args: { mode: DodoMode }) {
  if (initialized) return;

  DodoPayments.Initialize({
    mode: args.mode,
    displayType: "overlay",
    onEvent: (event) => {
      // Keep logs minimal; checkout is a critical flow for debugging.
      console.log("[DodoPayments] Checkout event", event);
    },
  });

  initialized = true;
  initializedMode = args.mode;
}

export async function openDodoCheckout(args: { checkoutUrl: string; mode?: DodoMode }) {
  const checkoutUrl = (args.checkoutUrl || "").trim();
  if (!checkoutUrl) {
    throw new Error("Missing Dodo checkoutUrl");
  }

  if (!initialized) {
    initDodoPayments({ mode: args.mode ?? "test" });
  }

  // If the app environment switches (rare), re-init is safer than a broken checkout.
  // The SDK does not currently expose a dedicated reset API, so we warn instead.
  if (args.mode && initializedMode && args.mode !== initializedMode) {
    console.warn("[DodoPayments] Initialized in different mode", { initializedMode, nextMode: args.mode });
  }

  DodoPayments.Checkout.open({ checkoutUrl });
}

/** True when Convex rejected paid checkout because the beta phase is still active. */
export function isBetaCheckoutDisabledError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return msg.includes("beta_checkout_disabled");
}


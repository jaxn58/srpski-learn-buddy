import { useEffect, useRef } from "react";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { getSessionPreference, isSessionExpired } from "@/lib/sessionPreference";
import { logger } from "@/lib/logger";

const CHANNEL_NAME = "session-guard-channel";
const SESSION_MARKER = "browser-session-active";
const PONG_TIMEOUT_MS = 500;

/**
 * Checks the user's session-preference on mount and signs out if necessary.
 *
 * - "permanent": no action (Clerk default)
 * - "week": signs out if the login timestamp is older than 7 days
 * - "browser-close": signs out on a fresh browser start (no existing tabs open)
 *
 * Uses BroadcastChannel to avoid false logouts when the user opens a second tab
 * within the same browser session.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { signOut, isSignedIn } = useClerkAuth();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || checkedRef.current) return;
    checkedRef.current = true;

    const pref = getSessionPreference();

    if (pref === "permanent") {
      sessionStorage.setItem(SESSION_MARKER, "true");
      return;
    }

    if (pref === "week") {
      if (isSessionExpired()) {
        logger.info("[SessionGuard] Week-based session expired, signing out.");
        void signOut();
        return;
      }
      sessionStorage.setItem(SESSION_MARKER, "true");
      return;
    }

    // pref === "browser-close"
    const alreadyActive = sessionStorage.getItem(SESSION_MARKER);
    if (alreadyActive) {
      return;
    }

    // This tab has no session marker. Either:
    //   (a) Browser was closed and reopened (fresh session) -> sign out
    //   (b) User opened a new tab manually while another tab is still open -> don't sign out
    // Use BroadcastChannel to distinguish.

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      // BroadcastChannel not supported – fall back to immediate sign-out.
      logger.info("[SessionGuard] BroadcastChannel unavailable, signing out (browser-close mode).");
      void signOut();
      return;
    }

    let receivedPong = false;

    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "pong") {
        receivedPong = true;
        sessionStorage.setItem(SESSION_MARKER, "true");
        channel?.close();
      }
    };

    channel.postMessage({ type: "ping" });

    const timer = setTimeout(() => {
      if (!receivedPong) {
        logger.info("[SessionGuard] No other tab responded, signing out (browser-close mode).");
        void signOut();
      }
      channel?.close();
    }, PONG_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      channel?.close();
    };
  }, [isSignedIn, signOut]);

  // Responder: reply to pings from other tabs.
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "ping") {
        channel?.postMessage({ type: "pong" });
      }
    };

    channel.addEventListener("message", handler);

    return () => {
      channel?.removeEventListener("message", handler);
      channel?.close();
    };
  }, []);

  return <>{children}</>;
}

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import { streamChatMessage } from "./chat";
import { Webhook as SvixWebhook } from "svix";

const http = httpRouter();

function isProductionDeployment() {
  // Keep in sync with other production checks in the codebase (e.g. convex/backup.ts)
  return process.env.CONVEX_CLOUD_URL?.includes("fleet-labrador-324") === true;
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function base64ToBytes(b64: string): Uint8Array {
  // Prefer Node Buffer when available, otherwise fall back to atob.
  // Convex runtime typically supports Web APIs; keep both paths for safety.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGlobal: any = globalThis as any;
  if (typeof anyGlobal?.Buffer?.from === "function") {
    return new Uint8Array(anyGlobal.Buffer.from(b64, "base64"));
  }
  if (typeof anyGlobal?.atob === "function") {
    const bin = anyGlobal.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  throw new Error("base64_decode_unavailable");
}

function bytesToBase64(bytes: ArrayBuffer): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGlobal: any = globalThis as any;
  if (typeof anyGlobal?.Buffer?.from === "function") {
    return anyGlobal.Buffer.from(new Uint8Array(bytes)).toString("base64");
  }
  if (typeof anyGlobal?.btoa === "function") {
    const bin = String.fromCharCode(...new Uint8Array(bytes));
    return anyGlobal.btoa(bin);
  }
  throw new Error("base64_encode_unavailable");
}

async function hmacSha256Base64(keyBytes: Uint8Array, message: string): Promise<string> {
  const enc = new TextEncoder();
  // Avoid TS lib mismatch between ArrayBuffer and SharedArrayBuffer by copying into a fresh Uint8Array.
  // (Some runtimes type Uint8Array.buffer as ArrayBufferLike which includes SharedArrayBuffer.)
  const keyData = Uint8Array.from(keyBytes);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToBase64(sig);
}

function verifyDodoWebhookTimestamp(timestampHeader: string): number | null {
  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) return null;
  const now = Math.floor(Date.now() / 1000);
  const tolerance = 5 * 60; // 5 minutes, Standard Webhooks default
  if (now - ts > tolerance) return null;
  if (ts > now + tolerance) return null;
  return ts;
}

async function verifyDodoWebhookSignature(args: {
  webhookId: string;
  signatureHeader: string;
  timestampHeader: string;
  secret: string;
  rawBody: string;
}): Promise<boolean> {
  // Standard Webhooks spec (as used by Dodo): signature header contains one or more "v1,<sig>" entries separated by spaces.
  // Secret is typically "whsec_<base64>" where the base64 is the raw signing key.
  let secret = (args.secret || "").trim();
  if (!secret) return false;

  const ts = verifyDodoWebhookTimestamp(args.timestampHeader);
  if (ts === null) return false;

  const prefix = "whsec_";
  if (secret.startsWith(prefix)) secret = secret.slice(prefix.length);

  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(secret);
  } catch {
    return false;
  }

  const toSign = `${args.webhookId}.${ts}.${args.rawBody}`;
  const expected = await hmacSha256Base64(keyBytes, toSign);

  const candidates = args.signatureHeader
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const versioned of candidates) {
    const [version, sig] = versioned.split(",");
    if (version !== "v1") continue;
    if (sig && timingSafeEqualString(sig, expected)) return true;
  }

  return false;
}
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payloadString = await request.text();
    const headerPayload = request.headers;

    try {
      const svix_id = headerPayload.get("svix-id");
      const svix_timestamp = headerPayload.get("svix-timestamp");
      const svix_signature = headerPayload.get("svix-signature");

      if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response("Error occured -- no svix headers", {
          status: 400,
        });
      }

      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("CLERK_WEBHOOK_SECRET environment variable not set");
        return new Response("Server configuration error", { status: 500 });
      }

      const wh = new SvixWebhook(webhookSecret);
      const evt = wh.verify(payloadString, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as any;

      const eventType = evt.type;

      if (eventType === "session.created") {
        // NOTE: We enforce single-device sessions in production by revoking all other active sessions
        // for this user, except the newly created one.
        const sessionId: string | undefined = evt?.data?.id;
        const clerkUserId: string | undefined =
          evt?.data?.user_id ?? evt?.data?.userId;

        console.log("[Clerk Webhook] session.created event data", {
          sessionId,
          clerkUserId,
          hasData: Boolean(evt?.data),
        });

        if (!sessionId || !clerkUserId) {
          console.warn("[Clerk Webhook] session.created missing required fields", {
            hasSessionId: Boolean(sessionId),
            hasClerkUserId: Boolean(clerkUserId),
          });
          return new Response("Webhook received", { status: 200 });
        }

        // Enforce single-device sessions in production (skip dev/beta)
        // NOTE: Superadmin check is done client-side in useAuth.ts fallback
        if (!isProductionDeployment()) {
          console.log("[Clerk Webhook] Skipping enforcement: not production");
          return new Response("Webhook received", { status: 200 });
        }

        const clerkSecretKey = process.env.CLERK_SECRET_KEY;
        if (!clerkSecretKey) {
          console.warn("[Clerk Webhook] CLERK_SECRET_KEY not set - skipping session revocation");
          return new Response("Webhook received", { status: 200 });
        }

        // Revoke all other active sessions for this user (newest login wins)
        console.log("[Clerk Webhook] Starting session revocation", { clerkUserId, sessionId });
        
        try {
          const revokedSessionIds: string[] = [];
          let offset = 0;
          const limit = 100;

          // Paginate through all active sessions
          while (true) {
            const listResp = await fetch(
              `https://api.clerk.com/v1/sessions?user_id=${clerkUserId}&status=active&limit=${limit}&offset=${offset}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${clerkSecretKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (!listResp.ok) {
              const errorText = await listResp.text().catch(() => "<failed_to_read_body>");
              console.error("[Clerk Webhook] Failed to list sessions", {
                clerkUserId,
                status: listResp.status,
                errorText,
              });
              break;
            }

            const listJson = await listResp.json();
            const sessions: any[] = Array.isArray(listJson)
              ? listJson
              : Array.isArray(listJson?.data)
                ? listJson.data
                : [];

            // Revoke all sessions except the current one
            for (const session of sessions) {
              const sid: string | undefined = session?.id;
              if (!sid) continue;
              if (sid === sessionId) continue; // Keep the newest session

              const revokeResp = await fetch(
                `https://api.clerk.com/v1/sessions/${sid}/revoke`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${clerkSecretKey}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (!revokeResp.ok) {
                const errorText = await revokeResp.text().catch(() => "<failed_to_read_body>");
                console.error("[Clerk Webhook] Failed to revoke session", {
                  sessionId: sid,
                  status: revokeResp.status,
                  errorText,
                });
                continue;
              }

              revokedSessionIds.push(sid);
            }

            // Check if there are more sessions to fetch
            if (sessions.length < limit) {
              break;
            }

            offset += sessions.length;
          }

          console.log("[Clerk Webhook] Successfully revoked sessions", {
            clerkUserId,
            sessionId,
            revokedCount: revokedSessionIds.length,
            revokedSessionIds,
          });
        } catch (error) {
          console.error("[Clerk Webhook] Error revoking sessions", {
            clerkUserId,
            sessionId,
            error: String(error),
          });
        }

        return new Response("Webhook received", { status: 200 });
      }

      if (eventType === "user.created") {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const email = email_addresses[0]?.email_address;
        const name = `${first_name || ""} ${last_name || ""}`.trim();
        
        console.log("[Clerk Webhook] user.created - Sending emails", {
          email,
          name,
          clerkId: id,
        });

        // Welcome email is sent from syncUser (after first login) so that the
        // user's chosen language (learningLanguage) is known at send time.
      }

      if (eventType === "user.deleted") {
        // Safety net: if a user is deleted directly in the Clerk Dashboard
        // (or by the admin action which also deletes from Clerk), mirror that
        // into Convex so no orphan rows remain.
        const clerkId: string | undefined = evt?.data?.id;
        if (!clerkId) {
          console.warn("[Clerk Webhook] user.deleted missing data.id");
          return new Response("Webhook received", { status: 200 });
        }

        try {
          const found = await ctx.runQuery(
            internal.admin._findUserIdByClerkId,
            { clerkId }
          );
          if (!found) {
            console.log(
              `[Clerk Webhook] user.deleted: no Convex user for clerkId=${clerkId} (already clean)`
            );
            return new Response("Webhook received", { status: 200 });
          }

          const result = await ctx.runMutation(
            internal.admin._deleteUserCascade,
            { userId: found.userId }
          );
          console.log("[Clerk Webhook] user.deleted cascade done", {
            clerkId,
            email: found.email,
            result,
          });
        } catch (error) {
          console.error(
            "[Clerk Webhook] user.deleted cascade failed",
            error
          );
          // Return 500 so Clerk retries the webhook.
          return new Response("Cascade failed", { status: 500 });
        }
      }

      return new Response("Webhook received", { status: 200 });
    } catch (err) {
      console.error("Error processing webhook:", err);
      return new Response("Error occured", { status: 400 });
    }
  }),
});

// ============= NEWSLETTER ENDPOINTS =============

// Resend webhook endpoint for email events (Svix signature verification)
http.route({
  path: "/newsletter/webhook/resend",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const rawBody = await request.text();

      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.warn("[Newsletter Webhook] Missing Svix signature headers");
        return new Response("Missing webhook signature headers", { status: 400 });
      }

      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[Newsletter Webhook] RESEND_WEBHOOK_SECRET not configured");
        return new Response("Server configuration error", { status: 500 });
      }

      let payload: any;
      try {
        const wh = new SvixWebhook(webhookSecret);
        payload = wh.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
      } catch (verifyError) {
        console.error("[Newsletter Webhook] Invalid signature", { error: String(verifyError) });
        return new Response("Invalid webhook signature", { status: 401 });
      }

      const eventType = payload.type;
      const messageId = payload.data?.email_id || payload.data?.message_id;

      if (!messageId) {
        console.warn("[Newsletter Webhook] Missing message_id in payload");
        return new Response("OK", { status: 200 });
      }

      console.log(`[Newsletter Webhook] Received ${eventType} for message ${messageId}`);

      // Find email log by Resend message ID
      const emailLog = await ctx.runQuery(api.newsletter.getEmailLogByResendId, {
        resendMessageId: messageId,
      });

      if (!emailLog) {
        console.warn(`[Newsletter Webhook] Email log not found for message ${messageId}`);
        return new Response("OK", { status: 200 });
      }

      // Update email log based on event type
      switch (eventType) {
        case "email.delivered":
          await ctx.runMutation(internal.newsletter.updateEmailLogFromWebhook, {
            emailLogId: emailLog._id,
            status: "delivered",
            deliveredAt: Date.now(),
          });
          break;

        case "email.opened":
          await ctx.runMutation(internal.newsletter.updateEmailLogFromWebhook, {
            emailLogId: emailLog._id,
            status: "opened",
            openedAt: emailLog.openedAt || Date.now(),
            openedCount: emailLog.openedCount + 1,
            lastOpenedAt: Date.now(),
          });
          break;

        case "email.bounced":
          await ctx.runMutation(internal.newsletter.updateEmailLogFromWebhook, {
            emailLogId: emailLog._id,
            status: "bounced",
          });
          break;

        case "email.complained":
          await ctx.runMutation(internal.newsletter.unsubscribeContact, {
            contactId: emailLog.contactId,
          });
          await ctx.runMutation(internal.newsletter.updateEmailLogFromWebhook, {
            emailLogId: emailLog._id,
            status: "bounced",
          });
          console.log(`[Newsletter Webhook] Unsubscribed ${emailLog.email} due to spam complaint`);
          break;

        default:
          console.log(`[Newsletter Webhook] Unhandled event type: ${eventType}`);
      }

      return new Response("OK", { status: 200 });
    } catch (error: any) {
      console.error("[Newsletter Webhook] Error:", error);
      return new Response("Error", { status: 500 });
    }
  }),
});

// Link tracking endpoint
http.route({
  path: "/newsletter/track/:token",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).pathname.split("/").pop();

    if (!token) {
      return new Response("Invalid tracking token", { status: 400 });
    }

    try {
      // Get link click data
      const linkClick = await ctx.runQuery(api.newsletter.getLinkClickByToken, {
        token,
      });

      if (!linkClick) {
        return new Response("Link not found", { status: 404 });
      }

      // Record the click
      const userAgent = request.headers.get("user-agent") || undefined;
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                        request.headers.get("x-real-ip") || undefined;
      const referer = request.headers.get("referer") || undefined;

      await ctx.runMutation(api.newsletter.recordLinkClick, {
        linkClickId: linkClick._id,
        userAgent,
        ipAddress,
        referer,
      });

      // Redirect to original URL
      return new Response(null, {
        status: 302,
        headers: {
          Location: linkClick.originalUrl,
        },
      });
    } catch (error: any) {
      console.error("[Newsletter] Track error:", error);
      return new Response("Error tracking link", { status: 500 });
    }
  }),
});

// Double opt-in confirmation endpoint
http.route({
  path: "/newsletter/optin/confirm",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Invalid Link</title>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 50px auto; padding: 20px; text-align: center; }
              h1 { color: #dc2626; }
            </style>
          </head>
          <body>
            <h1>Invalid Confirmation Link</h1>
            <p>This confirmation link is invalid or has expired.</p>
          </body>
        </html>`,
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    try {
      const result = await ctx.runMutation(api.newsletter.confirmDoubleOptIn, { token });
      const appUrl = process.env.VITE_APP_URL || "https://learn-with.me";

      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Subscription Confirmed</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 50px auto; padding: 20px; text-align: center; }
              h1 { color: #16a34a; }
              a { color: #2563eb; text-decoration: none; }
            </style>
          </head>
          <body>
            <h1>You're in!</h1>
            <p>Your subscription has been confirmed for <strong>${result.email}</strong>.</p>
            <p><a href="${appUrl}">Return to the app</a></p>
          </body>
        </html>`,
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    } catch (error: any) {
      console.error("[Newsletter DOI] Confirm error:", error);
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Confirmation Failed</title>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 50px auto; padding: 20px; text-align: center; }
              h1 { color: #dc2626; }
            </style>
          </head>
          <body>
            <h1>Confirmation Failed</h1>
            <p>${error?.message || "Something went wrong while confirming your subscription."}</p>
          </body>
        </html>`,
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
  }),
});

// Unsubscribe endpoint
http.route({
  path: "/newsletter/unsubscribe",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    // IMPORTANT:
    // Do NOT unsubscribe on GET. Email clients/link scanners may prefetch.
    // We redirect to the frontend confirm UI which requires an explicit click.
    const appUrl = process.env.VITE_APP_URL || "https://learn-with.me";
    const destination = new URL("/newsletter/unsubscribe", appUrl);
    if (token) destination.searchParams.set("token", token);

    return new Response(null, {
      status: 302,
      headers: {
        Location: destination.toString(),
      },
    });
  }),
});

// One-click unsubscribe endpoint (List-Unsubscribe=One-Click)
http.route({
  path: "/newsletter/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    let token = url.searchParams.get("token") || "";

    // Some email clients send a POST with a form body. Token may be only in query.
    if (!token) {
      try {
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = await request.json();
          token = String(body?.token || "");
        } else {
          const text = await request.text();
          const params = new URLSearchParams(text);
          token = params.get("token") || "";
        }
      } catch {
        // ignore parsing errors
      }
    }

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "missing_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    try {
      const result = await ctx.runMutation(api.newsletter.unsubscribeByToken, { token });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    } catch (error: any) {
      console.error("[Newsletter] One-click unsubscribe error:", error);
      return new Response(JSON.stringify({ success: false, error: "failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  }),
});

// ============= DODO PAYMENTS WEBHOOK (Standard Webhooks) =============
http.route({
  path: "/dodo/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const receivedAt = Date.now();

    const rawBody = await request.text();
    const webhookId = request.headers.get("webhook-id") ?? "";
    const webhookSignature = request.headers.get("webhook-signature") ?? "";
    const webhookTimestamp = request.headers.get("webhook-timestamp") ?? "";

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      return new Response("Missing Dodo webhook headers", { status: 400 });
    }

    const secret = (
      process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
      process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
      ""
    ).trim();
    if (!secret) {
      console.error("[Dodo] DODO_PAYMENTS_WEBHOOK_SECRET not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    const valid = await verifyDodoWebhookSignature({
      webhookId,
      signatureHeader: webhookSignature,
      timestampHeader: webhookTimestamp,
      secret,
      rawBody,
    });
    if (!valid) {
      console.warn("[Dodo] Invalid webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const environment =
      (process.env.DODO_PAYMENTS_ENVIRONMENT || "").trim().toLowerCase() === "live_mode"
        ? ("live_mode" as const)
        : ("test_mode" as const);

    try {
      await ctx.runMutation(internal.subscriptions.internalProcessDodoWebhook, {
        rawBody,
        receivedAt,
        webhookId,
        environment,
      });
      return new Response("OK", { status: 200 });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Dodo] Failed to process webhook", { msg });

      // Non-retryable enforcement failures: acknowledge to stop retries.
      if (
        msg.includes("beta_discount_") ||
        msg.includes("not_eligible") ||
        msg.includes("already_used") ||
        msg.includes("not_active") ||
        msg.includes("missing_event_type") ||
        msg.includes("invalid_json")
      ) {
        return new Response("OK", { status: 200 });
      }

      // Retryable/unknown failure: return 500 so Dodo can retry.
      return new Response("Failed", { status: 500 });
    }
  }),
});

// ============= CHAT STREAMING =============

http.route({
  path: "/chat/stream",
  method: "POST",
  handler: streamChatMessage,
});

http.route({
  path: "/chat/stream",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;

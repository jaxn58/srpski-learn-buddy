import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

function isProductionDeployment() {
  // Keep in sync with other production checks in the codebase (e.g. convex/backup.ts)
  return process.env.CONVEX_CLOUD_URL?.includes("fleet-labrador-324") === true;
}

function parsePaddleSignatureHeader(header: string): { timestamp: string; signatureHex: string } | null {
  // Paddle docs describe a `Paddle-Signature` header similar to: "t=1700000000;h1=<hex>"
  const parts = header
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);

  const kv = new Map<string, string>();
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (k && v) kv.set(k, v);
  }

  const timestamp = kv.get("t") ?? kv.get("ts") ?? kv.get("timestamp");
  const signatureHex = kv.get("h1") ?? kv.get("sig") ?? kv.get("signature");
  if (!timestamp || !signatureHex) return null;
  return { timestamp, signatureHex };
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) {
    out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return out === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const msg = enc.encode(message);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, msg);
  return toHex(sig);
}

async function verifyPaddleSignature(args: {
  header: string;
  secret: string;
  rawBody: string;
}): Promise<boolean> {
  const parsed = parsePaddleSignatureHeader(args.header);
  if (!parsed) return false;
  const signedPayload = `${parsed.timestamp}:${args.rawBody}`;
  const expected = await hmacSha256Hex(args.secret, signedPayload);
  return timingSafeEqualHex(expected, parsed.signatureHex);
}

function parseMoneyToCents(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    // Ambiguous without docs; assume major units and convert to cents.
    return Math.round(input * 100);
  }
  if (typeof input === "string") {
    const n = Number.parseFloat(input);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }
  return null;
}

function getPaddlePriceMapFromEnv() {
  const normal = {
    intensive: (process.env.PADDLE_PRODUCT_INTENSIVE || "").trim(),
    balanced: (process.env.PADDLE_PRODUCT_BALANCED || "").trim(),
    standard: (process.env.PADDLE_PRODUCT_STANDARD || "").trim(),
    relaxed: (process.env.PADDLE_PRODUCT_RELAXED || "").trim(),
  } as const;

  const beta50 = {
    intensive: (process.env.PADDLE_PRODUCT_INTENSIVE_BETA50 || "").trim(),
    balanced: (process.env.PADDLE_PRODUCT_BALANCED_BETA50 || "").trim(),
    standard: (process.env.PADDLE_PRODUCT_STANDARD_BETA50 || "").trim(),
    relaxed: (process.env.PADDLE_PRODUCT_RELAXED_BETA50 || "").trim(),
  } as const;

  const monthsByPlan = {
    intensive: 3,
    balanced: 6,
    standard: 9,
    relaxed: 12,
  } as const;

  const map = new Map<
    string,
    { planType: keyof typeof monthsByPlan; planDurationMonths: number; isBeta50: boolean }
  >();

  for (const plan of Object.keys(monthsByPlan) as Array<keyof typeof monthsByPlan>) {
    if (normal[plan]) {
      map.set(normal[plan], { planType: plan, planDurationMonths: monthsByPlan[plan], isBeta50: false });
    }
    if (beta50[plan]) {
      map.set(beta50[plan], { planType: plan, planDurationMonths: monthsByPlan[plan], isBeta50: true });
    }
  }

  return map;
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

      const wh = new Webhook(webhookSecret);
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

        if (email) {
          // Send welcome email to user (immediate access)
          try {
            await ctx.runAction(internal.email.sendBetaRegistrationEmail, {
              email,
              name: name || "New User",
            });
            console.log("[Clerk Webhook] ✅ User welcome email sent to", email);
          } catch (error) {
            console.error("[Clerk Webhook] ❌ Failed to send welcome email:", error);
          }
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

// Resend webhook endpoint for email events
http.route({
  path: "/newsletter/webhook/resend",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await request.json();
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
          await ctx.runMutation(api.newsletter.updateEmailLogFromWebhook, {
            emailLogId: emailLog._id,
            status: "delivered",
            deliveredAt: Date.now(),
          });
          break;

        case "email.opened":
          await ctx.runMutation(api.newsletter.updateEmailLogFromWebhook, {
            emailLogId: emailLog._id,
            status: "opened",
            openedAt: emailLog.openedAt || Date.now(),
            openedCount: emailLog.openedCount + 1,
            lastOpenedAt: Date.now(),
          });
          break;

        case "email.bounced":
          await ctx.runMutation(api.newsletter.updateEmailLogFromWebhook, {
            emailLogId: emailLog._id,
            status: "bounced",
          });
          break;

        case "email.complained":
          // User marked as spam - unsubscribe them
          await ctx.runMutation(api.newsletter.unsubscribeContact, {
            contactId: emailLog.contactId,
          });
          await ctx.runMutation(api.newsletter.updateEmailLogFromWebhook, {
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
      return new Response(JSON.stringify({ success: true, ...result }), {
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

// ============= PADDLE BILLING WEBHOOK =============
http.route({
  path: "/paddle/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const receivedAt = Date.now();

    const rawBody = await request.text();
    const sigHeader = request.headers.get("Paddle-Signature") ?? request.headers.get("paddle-signature");
    if (!sigHeader) {
      return new Response("Missing Paddle-Signature", { status: 400 });
    }

    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Paddle] PADDLE_WEBHOOK_SECRET not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    const valid = await verifyPaddleSignature({ header: sigHeader, secret, rawBody });
    if (!valid) {
      console.warn("[Paddle] Invalid webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const environment =
      (process.env.PADDLE_ENVIRONMENT || process.env.VITE_PADDLE_ENVIRONMENT || "").trim() === "production"
        ? "production"
        : "sandbox";

    try {
      await ctx.runMutation(internal.subscriptions.internalProcessPaddleWebhook, {
        rawBody,
        receivedAt,
        environment,
      });
      return new Response("OK", { status: 200 });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Paddle] Failed to process webhook", { msg });

      // Non-retryable enforcement failures: acknowledge to stop retries.
      if (
        msg.includes("beta_discount_") ||
        msg.includes("not_eligible") ||
        msg.includes("already_used") ||
        msg.includes("not_active") ||
        msg.includes("missing_event_id_or_type") ||
        msg.includes("invalid_json")
      ) {
        return new Response("OK", { status: 200 });
      }

      // Retryable/unknown failure: return 500 so Paddle can retry.
      return new Response("Failed", { status: 500 });
    }
  }),
});

export default http;

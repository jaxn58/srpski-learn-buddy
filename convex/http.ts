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

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // #region agent log
    console.log(JSON.stringify({location:'http.ts:13',message:'Webhook received - ENTRY',data:{timestamp:new Date().toISOString(),headers:Object.fromEntries(request.headers.entries())},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'}));
    // #endregion
    
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
      
      // #region agent log
      console.log(JSON.stringify({location:'http.ts:43',message:'Webhook verified - event type',data:{eventType,timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'}));
      // #endregion

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
            await ctx.runAction(api.email.sendBetaRegistrationEmail, {
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

export default http;

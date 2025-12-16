import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

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

      if (eventType === "user.created") {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const email = email_addresses[0]?.email_address;
        const name = `${first_name || ""} ${last_name || ""}`.trim();
        
        // #region agent log
        console.log(JSON.stringify({location:'http.ts:51',message:'user.created event - BEFORE email send',data:{email,name,clerkId:id,timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2,H3'}));
        // #endregion

        if (email) {
          await ctx.runAction(api.email.sendBetaRegistrationAdminNotification, {
            email,
            name: name || "Unknown Name",
            clerkId: id,
          });
          
          // #region agent log
          console.log(JSON.stringify({location:'http.ts:60',message:'user.created event - AFTER email send',data:{email,name,clerkId:id,timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2,H3'}));
          // #endregion
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

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

async function requireSuperadminAction(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized - Superadmin required");

  const user = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });

  if (!user || user.role !== "superadmin") {
    throw new Error("Unauthorized - Superadmin required");
  }

  return user;
}

/**
 * Triggers a Vercel Deploy Hook so the landing page can be rebuilt (SSG refresh).
 *
 * Configure `VERCEL_DEPLOY_HOOK_URL` as a Convex env var (server-side only).
 * The hook must never be exposed client-side.
 */
export const triggerVercelDeployHook = action({
  args: {
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (!hookUrl) {
      throw new Error("Missing VERCEL_DEPLOY_HOOK_URL env var");
    }

    const res = await fetch(hookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: args.reason || "manual",
        triggeredAt: new Date().toISOString(),
      }),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`Deploy hook failed: HTTP ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`);
    }

    return {
      ok: true,
      status: res.status,
      // Some deploy hook endpoints return empty bodies; keep a small preview for debugging.
      bodyPreview: text ? text.slice(0, 200) : "",
    };
  },
});


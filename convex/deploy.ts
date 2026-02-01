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
  handler: async (ctx, _args) => {
    await requireSuperadminAction(ctx);

    // Safety: This deploy hook caused confusing "stale/old frontend" incidents when misconfigured.
    // It is intentionally disabled. If we ever re-enable it, do so behind an explicit, audited workflow.
    throw new Error("Vercel deploy hook is disabled.");
  },
});


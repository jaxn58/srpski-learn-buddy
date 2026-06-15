/**
 * AI Energy – administrative operations: monthly resets and superadmin grants.
 *
 * Kept separate from `energy.ts` (which is the pure cost/charge module) so the
 * scheduling-aware code (cron, admin grants) does not pollute the hot-path
 * library used from chat.ts.
 *
 * Monthly reset (cron `hourly-energy-monthly-reset`):
 *  - Resets `energyUsedThisPeriod = 0` and sets `energyPeriodResetAt` to the
 *    next month boundary (UTC). Adds a `monthly_reset` ledger entry per sub.
 *  - Top-ups (`energyTopUpBalance`) are NEVER reset – they carry over.
 *  - Processes a small bounded batch per run; the cron picks up the rest.
 *
 * Admin grant: superadmin-only mutation to add or set top-up energy for a
 * single user. Used for support credits and comp accounts. Writes a
 * `purchase` or `adjustment` ledger entry depending on intent.
 */
import { v } from "convex/values";
import { mutation, internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isResetDue, nextMonthlyResetAt } from "./energy";

const RESET_BATCH_SIZE = 100;

export const processMonthlyEnergyResets = internalMutation({
  args: {},
  returns: v.object({ processed: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    // @ts-ignore TS2589 – Convex schema depth limit (large schema)
    const candidates = await ctx.db
      .query("userSubscriptions")
      .filter((q) => q.eq(q.field("status"), "active"))
      .take(RESET_BATCH_SIZE);

    let processed = 0;
    for (const sub of candidates) {
      if (!isResetDue(sub, now)) continue;

      await ctx.db.patch(sub._id, {
        energyUsedThisPeriod: 0,
        energyPeriodResetAt: nextMonthlyResetAt(now),
      });

      await ctx.db.insert("energyLedger", {
        userId: sub.userId,
        delta: 0,
        reason: "monthly_reset",
        createdAt: now,
      });

      processed += 1;
    }
    return { processed };
  },
});

async function getCurrentUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

/**
 * Superadmin: grant top-up energy to a user (positive delta) or adjust their
 * current usage (negative delta on `energyUsedThisPeriod`).
 *
 * - `mode: "topUp"`: adds `amount` to `energyTopUpBalance` (does not expire).
 * - `mode: "refund"`: subtracts `amount` from `energyUsedThisPeriod` (floored at 0).
 *
 * Both modes write an `adjustment` ledger entry with the admin's userId in
 * the note for auditability.
 */
export const adminGrantEnergy = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    mode: v.union(v.literal("topUp"), v.literal("refund")),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await getCurrentUser(ctx);
    if (admin.role !== "superadmin") {
      throw new Error("Only superadmin can grant energy");
    }
    if (!Number.isInteger(args.amount) || args.amount <= 0 || args.amount > 1_000_000) {
      throw new Error("Amount must be a positive integer ≤ 1,000,000");
    }

    // @ts-ignore TS2589 – Convex schema depth limit (large schema)
    const sub = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!sub) throw new Error("User has no active subscription");

    let delta = 0;
    if (args.mode === "topUp") {
      const newBalance = (sub.energyTopUpBalance ?? 0) + args.amount;
      await ctx.db.patch(sub._id, { energyTopUpBalance: newBalance });
      delta = args.amount;
    } else {
      const used = sub.energyUsedThisPeriod ?? 0;
      const newUsed = Math.max(0, used - args.amount);
      await ctx.db.patch(sub._id, { energyUsedThisPeriod: newUsed });
      delta = used - newUsed; // effectively refunded energy
    }

    await ctx.db.insert("energyLedger", {
      userId: args.userId,
      delta,
      reason: "admin_adjust",
      note: args.note ? `${args.note} (by ${admin._id})` : `by ${admin._id}`,
      createdAt: Date.now(),
    });

    return null;
  },
});

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
 *  - Any outstanding `energyDebtBalance` from a prior overdraft is settled
 *    against the fresh quota: `usedThisPeriod` is pre-set to the debt (capped
 *    by the monthly quota) and `energyDebtBalance` is cleared by that amount.
 *    Without this, users would carry the debt indefinitely and be blocked
 *    even after the new period started.
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
import { getFeatureAccessForUser } from "./featureAccess";

const RESET_BATCH_SIZE = 100;

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const processMonthlyEnergyResets = internalMutation({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.object({ processed: v.number() }),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
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

      const quotaMonthly = sub.energyQuotaMonthly ?? 0;
      const carriedDebt = sub.energyDebtBalance ?? 0;
      // Settle up to one full monthly quota worth of debt from the fresh
      // period. If the debt exceeds the quota (edge case: quota was
      // downgraded), the remainder stays as debt.
      const debtSettled = Math.min(carriedDebt, Math.max(0, quotaMonthly));
      const remainingDebt = carriedDebt - debtSettled;

      await ctx.db.patch(sub._id, {
        energyUsedThisPeriod: debtSettled,
        energyDebtBalance: remainingDebt,
        energyPeriodResetAt: nextMonthlyResetAt(now),
      });

      await ctx.db.insert("energyLedger", {
        userId: sub.userId,
        delta: 0,
        reason: "monthly_reset",
        note:
          debtSettled > 0
            ? `carried debt ${carriedDebt} settled from new quota (${debtSettled} applied, ${remainingDebt} remaining)`
            : undefined,
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
/**
 * One-shot migration/cleanup for accounts stuck with `energyDebtBalance > 0`
 * from the pre-fix era, where the monthly reset did NOT settle debt against
 * the new quota. Applies the same logic that the reset now uses:
 *  - Deducts as much debt as possible from the remaining quota room of the
 *    current period (`energyUsedThisPeriod` is raised, capped at
 *    `energyQuotaMonthly`).
 *  - Then draws any leftover debt from `energyTopUpBalance`.
 *  - Whatever cannot be settled from quota + top-up stays as debt.
 *
 * Idempotent: subs without debt or without an active row are skipped.
 * Writes an `admin_adjust` ledger entry per settled sub.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const settleCarriedEnergyDebt = internalMutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    userId: v.optional(v.id("users")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    limit: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  returns: v.object({
    processed: v.number(),
    totalSettled: v.number(),
  }),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const batchLimit = Math.max(1, Math.min(args.limit ?? 200, 500));
    // @ts-ignore TS2589 – Convex schema depth limit (large schema)
    const candidates = args.userId
      ? await ctx.db
          .query("userSubscriptions")
          .withIndex("by_user", (q) => q.eq("userId", args.userId!))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect()
      : await ctx.db
          .query("userSubscriptions")
          .filter((q) => q.eq(q.field("status"), "active"))
          .take(batchLimit);

    const now = Date.now();
    let processed = 0;
    let totalSettled = 0;

    for (const sub of candidates) {
      const debt = sub.energyDebtBalance ?? 0;
      if (debt <= 0) continue;

      // Legacy subs may not have `energyQuotaMonthly` written directly; the
      // effective monthly quota comes from the feature-access resolver
      // (tier fallback + config). Use the same source so the cleanup mirrors
      // what the user actually sees in the UI.
      const access = await getFeatureAccessForUser(ctx, sub.userId);
      const effectiveQuota = access.energy.unlimited
        ? sub.energyQuotaMonthly ?? 0
        : access.energy.quotaMonthly;

      const used = sub.energyUsedThisPeriod ?? 0;
      const topUp = sub.energyTopUpBalance ?? 0;
      const quotaRoom = Math.max(0, effectiveQuota - used);

      const fromQuota = Math.min(debt, quotaRoom);
      const fromTopUp = Math.min(debt - fromQuota, topUp);
      const settled = fromQuota + fromTopUp;
      if (settled <= 0) continue;

      await ctx.db.patch(sub._id, {
        // Persist the resolved quota when it was previously missing so that
        // future runs (and the monthly reset) can rely on the raw field.
        energyQuotaMonthly: sub.energyQuotaMonthly ?? effectiveQuota,
        energyUsedThisPeriod: used + fromQuota,
        energyTopUpBalance: topUp - fromTopUp,
        energyDebtBalance: debt - settled,
      });

      await ctx.db.insert("energyLedger", {
        userId: sub.userId,
        delta: 0,
        reason: "admin_adjust",
        note: `debt cleanup: settled ${settled} of ${debt} carried debt (from quota: ${fromQuota}, top-up: ${fromTopUp})`,
        createdAt: now,
      });

      processed += 1;
      totalSettled += settled;
    }

    return { processed, totalSettled };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const adminGrantEnergy = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    userId: v.id("users"),
    amount: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    mode: v.union(v.literal("topUp"), v.literal("refund")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    note: v.optional(v.string()),
  },
  returns: v.null(),
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
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

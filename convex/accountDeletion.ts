import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CLAIM_STALE_MS = 10 * 60 * 1000;
const MAX_WEBHOOK_EVENTS = 150;
const MAX_BILLING_CHARGES = 24;
const DEFAULT_REFUND_REASON = "Account deletion within 7-day guarantee";

type DeletionMode =
  | "plain"
  | "refund"
  | "paid_no_refund"
  | "refund_pending"
  | "refund_completed";

type DeletionState = {
  userFound: true;
  userId: Id<"users">;
  email: string | null;
  mode: DeletionMode;
  expiresAt: number | null;
  refundAmountCents: number | null;
  currency: string | null;
  paymentMode: "prepaid" | "installments" | null;
  paymentId: string | null;
  providerSubscriptionId: string | null;
};

type DeletionStateResult = DeletionState | { userFound: false };

type Purchase = {
  key: string;
  isUpgrade: boolean;
  paidAt: number;
  paymentId: string | null;
  amountCents: number | null;
  subscriptionId: string | null;
  paymentMode: "prepaid" | "installments" | null;
  currency: string | null;
};

type RefundActionResult = {
  success: boolean;
  outcome?: "deleted" | "pending";
  reason?:
    | "not_authenticated"
    | "user_not_found"
    | "email_mismatch"
    | "refund_pending"
    | "refund_completed"
    | "not_refundable"
    | "refund_required"
    | "insufficient_balance"
    | "refund_failed"
    | "not_configured"
    | "no_api_key"
    | "clerk_delete_failed"
    | "deletion_failed";
};

function emailsMatch(expected: string | null | undefined, provided: string): boolean {
  const left = (expected ?? "").trim().toLowerCase();
  const right = provided.trim().toLowerCase();
  return left.length > 0 && left === right;
}

function readMinor(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return parseInt(value, 10);
  return null;
}

function parsePaidAt(data: Record<string, unknown>, fallback: number): number {
  const raw = data.created_at ?? data.createdAt;
  if (typeof raw === "string") {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return ms;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw;
  return fallback;
}

function parseAmountCents(data: Record<string, unknown>): number | null {
  return (
    readMinor(data.total_amount) ??
    readMinor(data.amount) ??
    readMinor(data.settlement_amount)
  );
}

function parseCurrency(data: Record<string, unknown>): string | null {
  const raw = data.currency;
  if (typeof raw === "string" && raw.trim()) return raw.trim().toUpperCase();
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

function dodoBaseUrl(): string {
  const raw = (process.env.DODO_PAYMENTS_ENVIRONMENT || "").trim().toLowerCase();
  return raw === "live_mode" || raw === "live"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

function dodoEnvironmentLabel(): string {
  const raw = (process.env.DODO_PAYMENTS_ENVIRONMENT || "").trim().toLowerCase();
  if (raw === "live_mode" || raw === "live") return "live_mode";
  if (raw === "dev_mode" || raw === "dev") return "dev_mode";
  return "test_mode";
}

function textMentionsInsufficient(text: string): boolean {
  return /insufficient/i.test(text);
}

type ParsedCharge = {
  eventType: string;
  paymentId: string | null;
  paidAt: number;
  amountCents: number | null;
  subscriptionId: string | null;
  flow: string;
  paymentMode: "prepaid" | "installments" | null;
  kind: string;
  currency: string | null;
};

function parseWebhookEvent(raw: string, receivedAt: number): ParsedCharge | null {
  let evt: unknown;
  try {
    evt = JSON.parse(raw);
  } catch {
    return null;
  }
  const root = asRecord(evt);
  const eventType = String(root.type || root.event_type || root.eventType || "");
  if (eventType !== "payment.succeeded" && eventType !== "subscription.renewed") return null;
  const data = asRecord(root.data);
  const meta = asRecord(data.metadata);
  const paymentModeRaw = String(meta.paymentMode ?? "").toLowerCase();
  const paymentIdRaw = data.payment_id ?? data.paymentId;
  const subscriptionRaw = data.subscription_id ?? data.subscriptionId;
  return {
    eventType,
    paymentId: typeof paymentIdRaw === "string" && paymentIdRaw ? paymentIdRaw : null,
    paidAt: parsePaidAt(data, receivedAt),
    amountCents: parseAmountCents(data),
    subscriptionId: typeof subscriptionRaw === "string" && subscriptionRaw ? subscriptionRaw : null,
    flow: String(meta.flow ?? "").toLowerCase(),
    paymentMode: paymentModeRaw === "prepaid" || paymentModeRaw === "installments" ? paymentModeRaw : null,
    kind: String(meta.kind ?? "").toLowerCase(),
    currency: parseCurrency(data),
  };
}

function purchaseKey(parsed: ParsedCharge): string | null {
  if (parsed.kind === "topup") return null;
  if (parsed.flow === "upgrade") {
    return parsed.paymentId ? `upgrade:${parsed.paymentId}` : null;
  }
  if (
    parsed.subscriptionId &&
    (parsed.paymentMode === "installments" || parsed.eventType === "subscription.renewed")
  ) {
    return `sub:${parsed.subscriptionId}`;
  }
  if (parsed.paymentId) return `pay:${parsed.paymentId}`;
  if (parsed.subscriptionId) return `sub:${parsed.subscriptionId}`;
  return null;
}

function considerPurchase(purchases: Map<string, Purchase>, next: Purchase) {
  const prev = purchases.get(next.key);
  if (!prev) {
    purchases.set(next.key, next);
    return;
  }
  if (next.paidAt < prev.paidAt) {
    prev.paidAt = next.paidAt;
    if (next.paymentId) prev.paymentId = next.paymentId;
    if (next.amountCents != null) prev.amountCents = next.amountCents;
    if (next.currency) prev.currency = next.currency;
    if (next.subscriptionId) prev.subscriptionId = next.subscriptionId;
    if (next.paymentMode) prev.paymentMode = next.paymentMode;
    return;
  }
  if (!prev.paymentId && next.paymentId) prev.paymentId = next.paymentId;
  if (prev.amountCents == null && next.amountCents != null) prev.amountCents = next.amountCents;
  if (!prev.currency && next.currency) prev.currency = next.currency;
  if (!prev.subscriptionId && next.subscriptionId) prev.subscriptionId = next.subscriptionId;
  if (!prev.paymentMode && next.paymentMode) prev.paymentMode = next.paymentMode;
}

function collectPurchases(
  events: Array<Pick<Doc<"dodoWebhookEvents">, "rawPayload" | "receivedAt">>,
  sub: Doc<"userSubscriptions"> | null,
): Purchase[] {
  const purchases = new Map<string, Purchase>();
  for (const event of events) {
    const parsed = parseWebhookEvent(event.rawPayload, event.receivedAt);
    if (!parsed) continue;
    const key = purchaseKey(parsed);
    if (!key) continue;
    considerPurchase(purchases, {
      key,
      isUpgrade: parsed.flow === "upgrade",
      paidAt: parsed.paidAt,
      paymentId: parsed.paymentId,
      amountCents: parsed.amountCents,
      subscriptionId: parsed.subscriptionId,
      paymentMode:
        parsed.paymentMode ??
        (parsed.eventType === "subscription.renewed" ? "installments" : null),
      currency: parsed.currency,
    });
  }

  if (sub && sub.planType !== "beta" && sub.firstPaymentId) {
    const key = sub.providerSubscriptionId
      ? `sub:${sub.providerSubscriptionId}`
      : `pay:${sub.firstPaymentId}`;
    considerPurchase(purchases, {
      key,
      isUpgrade: false,
      paidAt: sub.firstPaidAt ?? sub._creationTime,
      paymentId: sub.firstPaymentId,
      amountCents: sub.firstPaidAmountCents ?? null,
      subscriptionId: sub.providerSubscriptionId ?? null,
      paymentMode: sub.paymentMode ?? null,
      currency: null,
    });
  }

  return [...purchases.values()];
}

function refundBlocksDeletion(refund: Doc<"accountRefunds"> | null, now: number): DeletionMode | null {
  if (!refund) return null;
  if (refund.status === "succeeded" && !refund.deletionCompletedAt) return "refund_completed";
  if (refund.status === "pending" || refund.status === "review") return "refund_pending";
  if (refund.status === "claimed" && now - refund.requestedAt < CLAIM_STALE_MS) return "refund_pending";
  return null;
}

async function evaluateDeletionState(
  ctx: QueryCtx | MutationCtx,
  clerkId: string,
): Promise<DeletionStateResult> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();
  if (!user) return { userFound: false };

  const now = Date.now();
  const subs = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .take(10);
  const paidSub = subs.find((s) => s.planType !== "beta") ?? null;
  const refund = await ctx.db
    .query("accountRefunds")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();
  const events = await ctx.db
    .query("dodoWebhookEvents")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .take(MAX_WEBHOOK_EVENTS);

  const blocked = refundBlocksDeletion(refund, now);
  if (blocked) {
    return {
      userFound: true,
      userId: user._id,
      email: user.email ?? null,
      mode: blocked,
      expiresAt: paidSub?.expiresAt ?? null,
      refundAmountCents: refund?.amountCents ?? paidSub?.firstPaidAmountCents ?? null,
      currency: refund?.currency ?? null,
      paymentMode: paidSub?.paymentMode ?? null,
      paymentId: refund?.paymentId ?? paidSub?.firstPaymentId ?? null,
      providerSubscriptionId: paidSub?.providerSubscriptionId ?? refund?.providerSubscriptionId ?? null,
    };
  }

  const purchases = collectPurchases(events, paidSub);
  const upgrades = purchases.filter((p) => p.isUpgrade);
  const planPurchases = purchases.filter((p) => !p.isUpgrade);
  const earliest = [...planPurchases].sort((a, b) => a.paidAt - b.paidAt)[0] ?? null;
  const followOn =
    upgrades.length > 0 ||
    planPurchases.length > 1 ||
    (paidSub?.planPurchaseCount ?? 0) > 1;
  const withinWindow = earliest != null && now - earliest.paidAt <= REFUND_WINDOW_MS;
  const paymentId = earliest?.paymentId ?? null;

  let mode: DeletionMode = "plain";
  if (earliest && withinWindow && !followOn && paymentId) {
    mode = "refund";
  } else if (paidSub || planPurchases.length > 0 || upgrades.length > 0) {
    mode = "paid_no_refund";
    if (earliest && withinWindow && !followOn && !paymentId) {
      console.warn("[account-refund] missing_payment_id", { clerkId, at: now });
    }
  }

  return {
    userFound: true,
    userId: user._id,
    email: user.email ?? null,
    mode,
    expiresAt: paidSub?.expiresAt ?? null,
    refundAmountCents: earliest?.amountCents ?? paidSub?.firstPaidAmountCents ?? null,
    currency: earliest?.currency ?? null,
    paymentMode: earliest?.paymentMode ?? paidSub?.paymentMode ?? null,
    paymentId,
    providerSubscriptionId:
      earliest?.subscriptionId ?? paidSub?.providerSubscriptionId ?? null,
  };
}

function publicState(state: DeletionState) {
  return {
    mode: state.mode,
    expiresAt: state.expiresAt,
    refundAmountCents: state.refundAmountCents,
    currency: state.currency,
    paymentMode: state.paymentMode,
  };
}

export const getMyDeletionState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const state = await evaluateDeletionState(ctx, identity.subject);
    if (!state.userFound) return null;
    return publicState(state);
  },
});

export const internalGetDeletionState = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args): Promise<DeletionStateResult> => {
    return await evaluateDeletionState(ctx, args.clerkId);
  },
});

export const claimRefund = internalMutation({
  args: {
    clerkId: v.string(),
    confirmationEmail: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const state = await evaluateDeletionState(ctx, args.clerkId);
    if (!state.userFound) {
      return { proceed: false as const, result: { success: false, reason: "user_not_found" as const } };
    }
    if (!emailsMatch(state.email, args.confirmationEmail)) {
      return { proceed: false as const, result: { success: false, reason: "email_mismatch" as const } };
    }
    if (state.mode === "refund_pending") {
      return { proceed: false as const, result: { success: false, reason: "refund_pending" as const } };
    }
    if (state.mode === "refund_completed") {
      return { proceed: false as const, result: { success: false, reason: "refund_completed" as const } };
    }
    if (state.mode !== "refund" || !state.paymentId) {
      return { proceed: false as const, result: { success: false, reason: "not_refundable" as const } };
    }

    const now = Date.now();
    const reason = (args.reason ?? "").trim().slice(0, 3000);
    const existing = await ctx.db
      .query("accountRefunds")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing && (existing.status === "pending" || existing.status === "review" || existing.status === "succeeded")) {
      const reasonCode = existing.status === "succeeded" ? "refund_completed" as const : "refund_pending" as const;
      return { proceed: false as const, result: { success: false, reason: reasonCode } };
    }
    if (existing && existing.status === "claimed" && now - existing.requestedAt < CLAIM_STALE_MS) {
      return { proceed: false as const, result: { success: false, reason: "refund_pending" as const } };
    }

    const next = {
      clerkId: args.clerkId,
      userId: state.userId,
      paymentId: state.paymentId,
      status: "claimed" as const,
      requestedAt: now,
      ...(state.email ? { email: state.email } : {}),
      ...(state.providerSubscriptionId ? { providerSubscriptionId: state.providerSubscriptionId } : {}),
      ...(state.refundAmountCents != null ? { amountCents: state.refundAmountCents } : {}),
      ...(state.currency ? { currency: state.currency } : {}),
      ...(reason ? { reason } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...next,
        failureCode: undefined,
        dodoRefundId: undefined,
        resolvedAt: undefined,
      });
    } else {
      await ctx.db.insert("accountRefunds", next);
    }

    console.log("[account-refund]", {
      clerkId: args.clerkId,
      paymentId: state.paymentId,
      status: "claimed",
      at: now,
    });

    return {
      proceed: true as const,
      paymentId: state.paymentId,
      providerSubscriptionId: state.providerSubscriptionId,
      amountCents: state.refundAmountCents,
      reason: reason || DEFAULT_REFUND_REASON,
    };
  },
});

export const markRefundOutcome = internalMutation({
  args: {
    clerkId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("review"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    dodoRefundId: v.optional(v.string()),
    amountCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    failureCode: v.optional(v.string()),
    installmentsCancelRequested: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("accountRefunds")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!row) return { updated: false };
    if (row.status === "succeeded" && args.status !== "succeeded") return { updated: false };

    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: args.status,
      dodoRefundId: args.dodoRefundId ?? row.dodoRefundId,
      amountCents: args.amountCents ?? row.amountCents,
      currency: args.currency ?? row.currency,
      failureCode: args.status === "failed" ? args.failureCode : undefined,
      resolvedAt: args.status === "pending" || args.status === "review" ? undefined : now,
      installmentsCancelRequestedAt: args.installmentsCancelRequested
        ? (row.installmentsCancelRequestedAt ?? now)
        : row.installmentsCancelRequestedAt,
    });

    console.log("[account-refund]", {
      clerkId: args.clerkId,
      paymentId: row.paymentId,
      status: args.status,
      failureCode: args.failureCode ?? null,
      at: now,
    });
    return { updated: true };
  },
});

export const applyRefundWebhook = internalMutation({
  args: {
    eventType: v.string(),
    paymentId: v.string(),
    dodoRefundId: v.optional(v.string()),
    amountCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.paymentId) return { scheduleFinalize: false, clerkId: null as string | null };
    const row = await ctx.db
      .query("accountRefunds")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();
    if (!row) return { scheduleFinalize: false, clerkId: null };

    const now = Date.now();
    if (args.eventType === "refund.failed") {
      if (row.status !== "succeeded") {
        await ctx.db.patch(row._id, {
          status: "failed",
          failureCode: "refund_failed",
          dodoRefundId: args.dodoRefundId ?? row.dodoRefundId,
          resolvedAt: now,
        });
        console.log("[account-refund]", {
          clerkId: row.clerkId,
          paymentId: row.paymentId,
          status: "failed",
          at: now,
        });
      }
      return { scheduleFinalize: false, clerkId: row.clerkId };
    }

    if (row.deletionCompletedAt) {
      return { scheduleFinalize: false, clerkId: row.clerkId };
    }

    await ctx.db.patch(row._id, {
      status: "succeeded",
      dodoRefundId: args.dodoRefundId ?? row.dodoRefundId,
      amountCents: args.amountCents ?? row.amountCents,
      failureCode: undefined,
      resolvedAt: row.resolvedAt ?? now,
    });
    console.log("[account-refund]", {
      clerkId: row.clerkId,
      paymentId: row.paymentId,
      status: "succeeded",
      at: now,
    });
    return { scheduleFinalize: true, clerkId: row.clerkId };
  },
});

export const noteProviderCancellation = internalMutation({
  args: { providerSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    const refund = await ctx.db
      .query("accountRefunds")
      .withIndex("by_provider_subscription_id", (q) =>
        q.eq("providerSubscriptionId", args.providerSubscriptionId),
      )
      .first();
    if (!refund) return { inFlight: false };
    if (refund.subscriptionCancelledAt === undefined) {
      await ctx.db.patch(refund._id, { subscriptionCancelledAt: Date.now() });
    }
    const inFlight =
      refund.status === "claimed" || refund.status === "pending" || refund.status === "review";
    return { inFlight };
  },
});

export const noteFirstPlanPayment = internalMutation({
  args: {
    clerkId: v.string(),
    paymentId: v.string(),
    paidAt: v.number(),
    amountCents: v.optional(v.number()),
    flow: v.union(v.literal("purchase"), v.literal("upgrade"), v.literal("installment")),
  },
  handler: async (ctx, args) => {
    if (args.flow === "upgrade" || !args.paymentId) return { updated: false };
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return { updated: false };
    const subs = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(5);
    const sub = subs.find((s) => s.planType !== "beta") ?? subs[0];
    if (!sub || sub.firstPaymentId) return { updated: false };
    await ctx.db.patch(sub._id, {
      firstPaymentId: args.paymentId,
      firstPaidAt: args.paidAt,
      ...(args.amountCents != null ? { firstPaidAmountCents: args.amountCents } : {}),
    });
    return { updated: true };
  },
});

async function findBillingRecord(
  ctx: QueryCtx | MutationCtx,
  args: { clerkId?: string; subscriptionId?: string },
) {
  if (args.subscriptionId) {
    const subscriptionId = args.subscriptionId;
    const bySub = await ctx.db
      .query("billingRecords")
      .withIndex("by_provider_subscription_id", (q) =>
        q.eq("providerSubscriptionId", subscriptionId),
      )
      .first();
    if (bySub) return bySub;
  }
  if (args.clerkId) {
    const clerkId = args.clerkId;
    return await ctx.db
      .query("billingRecords")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
  }
  return null;
}

export const appendRetainedChargeIfAny = internalMutation({
  args: {
    clerkId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    paymentId: v.optional(v.string()),
    amountCents: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await findBillingRecord(ctx, {
      clerkId: args.clerkId,
      subscriptionId: args.subscriptionId,
    });
    if (!row || !args.paymentId) return { appended: false };
    if (row.paymentIds.includes(args.paymentId)) return { appended: false };
    if (row.charges.length >= MAX_BILLING_CHARGES) {
      console.warn("[account-refund] billing_charge_cap", {
        clerkId: row.clerkId,
        paymentId: args.paymentId,
        at: Date.now(),
      });
      return { appended: false };
    }
    await ctx.db.patch(row._id, {
      paymentIds: [...row.paymentIds, args.paymentId],
      charges: [
        ...row.charges,
        {
          paymentId: args.paymentId,
          eventType: args.eventType,
          ...(args.amountCents != null ? { amountCents: args.amountCents } : {}),
          ...(args.paidAt != null ? { paidAt: args.paidAt } : {}),
        },
      ],
    });
    return { appended: true };
  },
});

export const snapshotBilling = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingRecords")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (existing) return { id: existing._id, created: false };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return { id: null, created: false };

    const subs = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(10);
    const paid = subs.find((s) => s.planType !== "beta") ?? null;
    const refund = await ctx.db
      .query("accountRefunds")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    const energy = await ctx.db
      .query("energyPurchases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(20);

    const hasBilling =
      paid != null ||
      Boolean(refund?.paymentId) ||
      energy.some((row) => row.providerPaymentId);
    if (!hasBilling) return { id: null, created: false };

    const charges: Array<{
      paymentId: string;
      amountCents?: number;
      paidAt?: number;
      eventType: string;
    }> = [];
    if (paid?.firstPaymentId) {
      charges.push({
        paymentId: paid.firstPaymentId,
        amountCents: paid.firstPaidAmountCents,
        paidAt: paid.firstPaidAt,
        eventType: "plan_payment",
      });
    }
    if (refund?.paymentId && refund.paymentId !== paid?.firstPaymentId) {
      charges.push({
        paymentId: refund.paymentId,
        amountCents: refund.amountCents,
        eventType: "plan_payment",
      });
    }
    for (const purchase of energy) {
      if (!purchase.providerPaymentId) continue;
      charges.push({
        paymentId: purchase.providerPaymentId,
        amountCents: purchase.priceCents,
        paidAt: purchase.purchasedAt,
        eventType: "topup",
      });
    }
    const capped = charges.slice(0, MAX_BILLING_CHARGES);
    const cleanedCharges = capped.flatMap((charge) => {
      if (!charge.paymentId) return [];
      return [{
        paymentId: charge.paymentId,
        eventType: charge.eventType,
        ...(charge.amountCents != null ? { amountCents: charge.amountCents } : {}),
        ...(charge.paidAt != null ? { paidAt: charge.paidAt } : {}),
      }];
    });
    const installmentsContinue = refund?.installmentsCancelRequestedAt
      ? false
      : paid?.paymentMode === "installments" || Boolean(paid?.providerSubscriptionId);
    const providerSubscriptionId = paid?.providerSubscriptionId ?? refund?.providerSubscriptionId;
    const amountCents = paid?.firstPaidAmountCents ?? refund?.amountCents;
    const refundId = refund?.status === "succeeded" ? refund.dodoRefundId : undefined;

    const id = await ctx.db.insert("billingRecords", {
      clerkId: args.clerkId,
      paymentIds: uniqueStrings(cleanedCharges.map((charge) => charge.paymentId)),
      charges: cleanedCharges,
      installmentsContinue,
      accountDeletedAt: Date.now(),
      reason: refund?.status === "succeeded" ? "refund_completed" : "account_deleted",
      ...(user.email ? { email: user.email } : {}),
      ...(paid?.planType ? { planType: paid.planType } : {}),
      ...(paid?.paymentMode ? { paymentMode: paid.paymentMode } : {}),
      ...(providerSubscriptionId ? { providerSubscriptionId } : {}),
      ...(amountCents != null ? { amountCents } : {}),
      ...(refund?.currency ? { currency: refund.currency } : {}),
      ...(refundId ? { refundId } : {}),
      ...(paid?.expiresAt != null ? { expiresAt: paid.expiresAt } : {}),
    });
    return { id, created: true };
  },
});

export const deleteBillingSnapshot = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return { deleted: false };
    const row = await ctx.db
      .query("billingRecords")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!row) return { deleted: false };
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

export const markDeletionComplete = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("accountRefunds")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!row || row.deletionCompletedAt) return { updated: false };
    await ctx.db.patch(row._id, { deletionCompletedAt: Date.now() });
    return { updated: true };
  },
});

export const prepareRefundDeletion = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const refund = await ctx.db
      .query("accountRefunds")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!refund || refund.status !== "succeeded") return { alreadyDone: true as const, userId: null, needsCascade: false };
    if (refund.deletionCompletedAt) return { alreadyDone: true as const, userId: null, needsCascade: false };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) {
      return { alreadyDone: false as const, userId: null, needsCascade: false };
    }

    await ctx.runMutation(internal.accountDeletion.snapshotBilling, { clerkId: args.clerkId });
    return { alreadyDone: false as const, userId: user._id, needsCascade: true };
  },
});

export async function deleteClerkUser(
  clerkId: string,
): Promise<{ ok: true } | { ok: false; status: number | "no_api_key" | "network" }> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.error("[account-refund] CLERK_SECRET_KEY missing");
    return { ok: false, status: "no_api_key" };
  }
  try {
    const resp = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok && resp.status !== 404) {
      const body = await resp.text().catch(() => "");
      console.error("[account-refund] clerk_delete_failed", {
        status: resp.status,
        body: body.slice(0, 300),
        clerkId,
      });
      return { ok: false, status: resp.status };
    }
    return { ok: true };
  } catch (error) {
    console.error("[account-refund] clerk_delete_threw", error);
    return { ok: false, status: "network" };
  }
}

async function cancelDodoSubscriptionNow(subscriptionId: string): Promise<boolean> {
  const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
  if (!apiKey) return false;
  const resp = await fetch(
    `${dodoBaseUrl()}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    },
  );
  if (resp.ok) return true;
  const text = await resp.text().catch(() => "");
  if ((resp.status === 400 || resp.status === 422) && /already|cancel/i.test(text)) return true;
  console.warn("[account-refund] cancel_failed", {
    subscriptionId,
    status: resp.status,
    body: text.slice(0, 300),
    at: Date.now(),
  });
  return false;
}

async function finalizeRefundedAccountNow(ctx: ActionCtx, clerkId: string) {
  const prep: {
    alreadyDone: boolean;
    userId: Id<"users"> | null;
    needsCascade: boolean;
  } = await ctx.runMutation(internal.accountDeletion.prepareRefundDeletion, { clerkId });
  if (prep.alreadyDone) return { ok: true as const, alreadyDone: true };

  const clerk = await deleteClerkUser(clerkId);
  if (!clerk.ok) return { ok: false as const, reason: "clerk_delete_failed" as const };

  if (prep.needsCascade && prep.userId) {
    await ctx.runMutation(internal.admin._deleteUserCascade, { userId: prep.userId });
  }
  await ctx.runMutation(internal.accountDeletion.markDeletionComplete, { clerkId });
  console.log("[account-refund]", {
    clerkId,
    status: "account_deleted",
    at: Date.now(),
  });
  return { ok: true as const, alreadyDone: false };
}

export const finalizeRefundedAccount = internalAction({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => finalizeRefundedAccountNow(ctx, args.clerkId),
});

export const deleteMyAccountWithRefund = action({
  args: {
    confirmationEmail: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<RefundActionResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, reason: "not_authenticated" };

    const claim: {
      proceed: boolean;
      result?: RefundActionResult;
      paymentId?: string;
      providerSubscriptionId?: string | null;
      amountCents?: number | null;
      reason?: string;
    } = await ctx.runMutation(internal.accountDeletion.claimRefund, {
      clerkId: identity.subject,
      confirmationEmail: args.confirmationEmail,
      reason: args.reason,
    });
    if (!claim.proceed || !claim.paymentId) {
      return claim.result ?? { success: false, reason: "not_refundable" };
    }

    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) {
      await ctx.runMutation(internal.accountDeletion.markRefundOutcome, {
        clerkId: identity.subject,
        status: "failed",
        failureCode: "not_configured",
      });
      return { success: false, reason: "not_configured" };
    }

    let resp: Response;
    try {
      resp = await fetch(`${dodoBaseUrl()}/refunds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_id: claim.paymentId,
          reason: claim.reason || DEFAULT_REFUND_REASON,
          metadata: { user_id: identity.subject },
        }),
      });
    } catch (error) {
      console.error("[account-refund] refund_request_threw", error);
      await ctx.runMutation(internal.accountDeletion.markRefundOutcome, {
        clerkId: identity.subject,
        status: "failed",
        failureCode: "refund_failed",
      });
      return { success: false, reason: "refund_failed" };
    }

    const rawBody = await resp.text().catch(() => "");
    let json: Record<string, unknown> = {};
    try {
      json = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      json = {};
    }

    if (!resp.ok) {
      const insufficient = textMentionsInsufficient(rawBody);
      await ctx.runMutation(internal.accountDeletion.markRefundOutcome, {
        clerkId: identity.subject,
        status: "failed",
        failureCode: insufficient ? "insufficient_balance" : "refund_failed",
      });
      console.warn("[account-refund]", {
        clerkId: identity.subject,
        paymentId: claim.paymentId,
        status: "failed",
        httpStatus: resp.status,
        environment: dodoEnvironmentLabel(),
        at: Date.now(),
      });
      return {
        success: false,
        reason: insufficient ? "insufficient_balance" : "refund_failed",
      };
    }

    const statusRaw = String(json.status ?? "").toLowerCase();
    const dodoRefundId = typeof json.refund_id === "string" ? json.refund_id : undefined;
    const amountCents = readMinor(json.amount) ?? claim.amountCents ?? undefined;
    const currency = parseCurrency(json) ?? undefined;
    const insufficient = textMentionsInsufficient(rawBody) || textMentionsInsufficient(String(json.message ?? ""));

    if (statusRaw === "failed" || insufficient) {
      await ctx.runMutation(internal.accountDeletion.markRefundOutcome, {
        clerkId: identity.subject,
        status: "failed",
        dodoRefundId,
        failureCode: insufficient ? "insufficient_balance" : "refund_failed",
      });
      return {
        success: false,
        reason: insufficient ? "insufficient_balance" : "refund_failed",
      };
    }

    const status = statusRaw === "succeeded" || statusRaw === "review" ? statusRaw : "pending";
    await ctx.runMutation(internal.accountDeletion.markRefundOutcome, {
      clerkId: identity.subject,
      status,
      dodoRefundId,
      amountCents: amountCents ?? undefined,
      currency,
    });

    if (claim.providerSubscriptionId) {
      const cancelled = await cancelDodoSubscriptionNow(claim.providerSubscriptionId);
      if (cancelled) {
        await ctx.runMutation(internal.accountDeletion.markRefundOutcome, {
          clerkId: identity.subject,
          status,
          installmentsCancelRequested: true,
        });
      }
    }

    if (status !== "succeeded") {
      return { success: true, outcome: "pending" };
    }

    const finalized = await finalizeRefundedAccountNow(ctx, identity.subject);
    if (!finalized.ok) return { success: false, reason: "deletion_failed" };
    return { success: true, outcome: "deleted" };
  },
});
